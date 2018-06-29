'use strict';
const extend = require('gextend');
const Store = require('node-persist');
const EJSON = require('mongodb-extjson');

const logger = require('./logger');

const defaults = {
    autoinitialize: true,
    /**
     * How often do we want to save?
     * If our app crashes between updates
     * and we were unable to update the checkpoint
     * we will pick up the stream were we left it.
     * Meaning we possibly will be processing N items
     * again. 
     * Downstream applications should take that into
     * account and treach each event generated in a 
     * idempotent way.
     */
    batchSize: 10,
    logger,
    options: {
        dir: 'localStorage'
    },
    buildStore: function(context, options = {}) {
        context.store = Store;
        return Store.init(options);
    }
};

/**
 * Storage facility to save and retrieve
 * items from a quick storage engine.
 * 
 * TODO: We do want to replace node-persist ASAP
 */
class Storage {
    constructor(config) {
        config = extend({}, defaults, config);

        if (config.autoinitialize) {
            this.init(config);
        }
    }

    init(config = {}) {
        this.counter = 0;
        this.buffer = [];
        this.store = Store;
        extend(this, config);
    }

    /**
     * Boot our storage backend and return all 
     * previously stored check points.
     * 
     * @return {Promise} This promise resolves to an Array
     *                   of checkpoints.
     */
    start() {
        if (this.started) return this.getAllCheckpoints();

        this.started = true;

        return this.buildStore(this, this.options).then(_ => {
            return this.getAllCheckpoints();
        });
    }

    /**
     * Return how many items we have saved.
     * 
     * @return {Promise} This promise resolves to int.
     */
    count() {
        if (!this.started) throw new Error('Need to initialize store');
        return this.store.length();
    }

    reset() {
        if (!this.started) throw new Error('Need to initialize store');
        return this.store.clear().then(_ => this);
    }

    /**
     * Get all check points.
     */
    getAllCheckpoints() {
        if (!this.started) throw new Error('Need to initialize store');
        //TODO: this.store().then()?
        return this.store.keys().then(async(keys = []) => {
            let tokens = {};

            for (let key of keys) {
                //get collection from key
                const collection = this.getCollectionFromKey(key);
                //get token:
                const token = await this.getCheckpointForCollection(collection);
                tokens[collection] = token;
            }
            return tokens;
        });
    }

    getKeyFromCollection(collection) {
        if (!collection) throw new Error('Undefined collection');
        return `${collection}:resume_token`;
    }

    getCollectionFromKey(key = '') {
        return key.replace(':resume_token', '');
    }

    getCheckpointForCollection(collection) {
        if (!collection) throw new Error('Undefined collection');
        if (!this.started) throw new Error('Need to initialize store');

        const checkpoint = this.getKeyFromCollection(collection);

        return this.store.getItem(checkpoint)
            .then(value => {
                if (typeof value === 'string') {
                    try {
                        value = EJSON.parse(value);
                    } catch (error) {
                        this.logger.error('Parsing error: %s', error);
                    }
                }

                return value;
            });
    }

    /**
     * Sets the token for a given collection, the
     * collection name is used to index the token.
     * TODO: Token is an Object
     * @param {String} collection Name of collection
     * @param {Object} token Token identifiying a checkpoint
     * @returns {Promise}
     */
    setCheckpoint(collection, token) {
        const key = this.getKeyFromCollection(collection);

        if (typeof token !== 'string') {
            token = EJSON.stringify(token);
        }

        const checkpoint = {
            key,
            token
        };
        /**
         * We want to store this in case we crash
         * and we can actually save the token.
         */
        this.lastToken = checkpoint;

        if (this.counter < (this.batchSize - 1)) {
            this.counter++;
            return Promise.resolve(this);
        }

        return this.commit();
    }

    commit(sync = false) {
        const checkpoint = this.lastToken;

        if (!checkpoint) {
            this.logger.warn('Storage::commit: we did not find a checkpoint');
            return Promise.resolve();
        }

        const { key, token } = checkpoint;

        if (typeof checkpoint !== 'object') {
            this.logger.warn('Storage::commit: we did find a checkpoint but is not a valid format');
            return Promise.resolve();
        }

        /**
         * If we don't care about the write output
         * we just commit and pray. It might be 
         * that we are crashing and we don't have
         * the time.
         */
        if (sync) {

        }

        if (!this.started) throw new Error('Need to initialize store');

        return this.store.setItem(key, token).then(_ => {
            this.counter = 0;
            this.lastToken = null;
            this.logger.info('Storage::commit: successfully commited checkpoint');
            return this;
        });
    }
}

module.exports = Storage;
