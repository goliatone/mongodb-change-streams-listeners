'use strict';
const extend = require('gextend');
const EventDispatcher = require('events');
const MongoClient = require('mongodb').MongoClient;
const logger = require('./logger');
const ChangeType = require('./change-type');
const Subscription = require('./subscription');


const E_CODES = {
    MAJORITY_CONCERN: 148
};

const defaults = {
    autoinitialize: true,
    logger,
    connection: {
        options: {}
    },
    options: {
        storage: {
            autoinitialize: true,
            options: {
                dir: 'localStorage'
            }
        }
    },
    subscriptions: [],

    makeStorage(config) {
        const Storage = require('./storage');
        return new Storage(config);
    },

    makeDbClient(url, config) {
        return MongoClient.connect(url, config);
    }
};

/**
 * Look to use worker threads.
 * https://nodejs.org/api/worker_threads.html
 * 
 * https://www.mongodb.com/blog/post/an-introduction-to-change-streams
 */
class MongoWatcher extends EventDispatcher {

    constructor(config) {
        super();

        config = extend({}, defaults, config);

        if (config.autoinitialize) {
            this.init(config);
        }
    }

    init(config = {}) {
        extend(this, config);

        //TODO: Make async!
        this.storage = this.makeStorage(this.options.storage);

        if (config.listeners) {
            //we assume listers is Array. Fix.
            config.listeners.map(listener => this.subscribeListener(listener));
        }
    }

    /**
     * Subscript a list of Subscription JSON 
     * objects.
     * 
     * @param {Array} listeners Array with Subscription JSON objects.
     */
    subscribeListeners(listeners = []) {
        listeners.map(listener => this.subscribeListener(listener));
    }

    /**
     * Parse the `listener` object creating a 
     * Subscription record, and push it to our queue.
     * 
     * @param {Object} listener Subscription JSON object
     */
    subscribeListener(listener) {

        if (Array.isArray(listener)) {
            return this.subscribeListeners(listener);
        }

        const subscription = Subscription.createSubscription(listener);
        //TODO: Make a way to hash the subscription so that we don't add 
        //duplicates!
        if (this.isRegistered(subscription)) return;
        let validation = subscription.validate();
        if (validation.success === false) {
            console.error('Error Subscribing Listener: %s', validation.message);
            return
        }
        console.log('========> sub %s : %s <======', subscription, subscription.collection)
        this.subscriptions.push(subscription);
    }

    isRegistered(subscription) {
        for (let sub of this.subscriptions) {
            /*
             * Because we add default values when we create a subscription
             * we actually have to go through the process again. Ideally we
             * would make users assign a unique ID to their subscriptions. 
             */
            if (subscription.equals(Subscription.createSubscription(sub).toJSON())) {
                return true;
            }
        }

        return false;
    }

    start() {
        //TODO: check we have actual values!!
        const { uri, options } = this.connection;

        if (!uri) return Promise.reject(new Error('Need to specify a uri option'));

        let database = this.database;

        return this.loadDB().then(_ => {
            return this.storage.start().then((tokens = []) => {
                this.subscriptions.forEach((subscription = {}) => {

                    const resumeAfter = tokens[subscription.collection];

                    /**
                     * If we had a token in our pauch then 
                     * add it to the subscription, this 
                     * will ensure we can recover from 
                     * interruptions.
                     */
                    if (resumeAfter) {
                        subscription.options = extend({}, subscription.options, {
                            resumeAfter
                        });
                    }

                    this.subscribeToChangeStream(subscription);
                });

                return this.subscriptions;
            });
        });
    }

    loadDB() {
        if (this.db) {
            return Promise.resolve(this.db);
        }
        const { uri, options } = this.connection;

        if (!uri) return Promise.reject(new Error('Need to specify a uri option'));

        let database = this.database;
        // console.log('uri %s options %j database %s', uri, options, database)
        return this.makeDbClient(uri, options)
            .then(client => {
                this.db = client.db(database);
                return this.db;
            });
    }

    /**
     * Need either a replica set or a sharded cluster with 
     * replica set shards.
     * 
     * Need to run watch on replica sets that each uses 
     * Wired Tiger
     * 
     * @see https://docs.mongodb.com/manual/reference/method/db.collection.watch/index.html
     * @param {Object} subscription 
     */
    subscribeToChangeStream(subscription) {

        //TODO: We either make this private or async and check for db before 
        const collection = this.db.collection(subscription.collection);

        /**
         * pipeline: A sequence of one or more aggregation stages:
         * - $match
         * - $project
         * - $addFields
         * - $replaceRoot
         * - $redact
         * @see https://docs.mongodb.com/manual/aggregation/
         * 
         * options: Optional options that modify the behavior.
         * - resumeAfter: Each change stream event document includes a resume
         *                token as the _id field. Pass the entire _id field of 
         *                the change event document that represents the opration 
         *                you want to resume after.
         * - fullDocument:  By default watch returns the delta of changed fields
         *                  by an update, instead of the entire document.
         *                  Set to "updateLookup" to get updated doc
         * - batchSize:     Max number of change events to return in each response
         *                  Has the same functionality as cursor.batchSizse()
         * - maxAwaitTimeMS: Time to wait for changes before returning empty batch. 
         *                   Defaults to 1000 milliseconds.
         * - collation:     Collation for cursor doc
         */
        const stream = collection.watch(subscription.getPipeline(), subscription.options);

        if (!stream) {
            return this.logger.error('We could not create a stream for %s', subscription.collection);
        }

        /**
         * Change event payload
         * - _id: Object as resumeToken for resumeAfter parameter
         * - operationType: insert|delete|replace|update|invalidate
         * - fullDocument: insert|replace: new document
         *                 delete: omitted
         *                 update: only appears if fullDocument=updateLookup
         * 
         * @see https://docs.mongodb.com/manual/reference/change-events/#change-stream-output
         */
        stream.on('change', change => {
            this.processChangeEvent(subscription, change);
        });

        stream.on('open', _ => this.logger.info('Opened %s', subscription.collection));
        stream.on('end', _ => this.logger.info('Ended %s', subscription.collection));

        stream.on('error', error => {
            this.logger.error('Error processing stream %s', subscription.collection);
            if (error.code === E_CODES.MAJORITY_CONCERN) {
                this.logger.error('This error probably means that you are not connecting to a MongoDB cluster');
            } else {
                this.logger.error(error.message);
                this.logger.error(error.code);
            }

            this.handleError(error, subscription);
        });
    }

    /**
     * @see https://docs.mongodb.com/manual/reference/change-events/#invalidate-event
     * @param {Subscription} subscription 
     * @param {String} change 
     * 
     * @event change 
     * @event <collection>.*
     * @event <collection>.<operation>
     */
    processChangeEvent(subscription, change) {

        const event = { subscription, change };

        const collection = subscription.collection;
        //operationType might not be defined!
        //TODO: we should convert operationType to ChangeType
        const operation = ChangeType.fromOperation(change.operationType);

        this.addResumeToken(collection, change._id);

        /**
         * Emit e.g: profile.update
         */
        let type = `${collection}.${operation}`;
        this.emit(type, event);

        /**
         * Emit e.g: profile.*
         */
        type = `${collection}.*`;
        this.emit(type, event);

        /**
         * Generic event
         */
        this.emit('change', event);
    }

    /**
     * Store a checkpoint of the current change.
     * 
     * @param {String} collection Collection name
     * @param {String} token MongoDB change token identifier
     * @returns {Promise}
     */
    addResumeToken(collection, token) {
        return this.storage.setCheckpoint(collection, token)
            .then(_ => this);
    }

    handleError(error, subscription) {
        this.emit('error', {
            error,
            subscription
        });
    }

    get database() {
        if (this.connection.database) {
            return this.connection.database;
        }

        const uri = this.connection.uri;


        return uri.match(/\/\/.+\/([^/?]+)/)[1];
    }
}

MongoWatcher.CREATE = ChangeType.CREATE;
MongoWatcher.UPDATE = ChangeType.UPDATE;
MongoWatcher.DELETE = ChangeType.DELETE;


module.exports = MongoWatcher;
