'use strict';
const extend = require('gextend');
const ChangeType = require('./change-type');
const logger = require('./logger');

const DEFAULTS = {
    logger,
    defaultProjectionProperties: {
        /**
         * This we need to process change
         */
        operationType: 1,
        documentKey: 1
    }
};

/**
 * This class manages our subscription 
 * to change stream events by creating the
 * options used when we register the watch. 
 */
class Subscription {
    constructor(config = {}) {
        config = extend({}, DEFAULTS, config);

        this.configure(config);
        this.fromJSON(config);
    }

    configure(config = {}) {
        const attributes = ['logger', 'defaultProjectionProperties'];
        attributes.map(attr => {
            if (config.hasOwnProperty(attr)) {
                this[attr] = config[attr];
            }
        });
    }


    /**
     * @return {Object}
     */
    toJSON() {
        const json = {
            uuid: this.uuid,
            data: extend({}, this.data),
            collection: this.collection,
            pipeline: (this.pipeline || []).concat(),
            active: !!this.active,
            options: extend({}, this.options)
        };

        return json;
    }

    fromJSON(src = {}) {
        src = extend({}, src);

        this.options = {};
        this.pipeline = [];

        //validate options:
        if (src.options) {
            Object.keys(src.options).map(option => {
                this.addOption(option, src.options[option]);
            });
            delete src.options;
        }

        const attrs = Subscription.serializableAttributes.concat();

        attrs.map(attr => {
            if (src.hasOwnProperty(attr)) {
                this[attr] = src[attr];
            }
        });

        return this;
    }

    /**
     * Supported operations are:
     * - `$match`
     * - `$project`
     * - `$addFields`
     * - `$replaceRoot`
     * - `$redact`
     * 
     * @param {Object} operation Aggregation stage definition
     */
    addPipeline(operation) {
        console.log('add pipeline', operation);
        const supportedOperations = [
            '$match',
            '$project',
            '$addFields',
            '$replaceRoot',
            '$redact'
        ];

        let projection = {};
        Object.keys(operation).map(opKey => {
            console.log('key', opKey);
            if (supportedOperations.hasOwnProperty(opKey)) {
                projection[opKey] = operation[opKey];
            }
        });

        //ensure we have pipeline
        if (!this.pipeline) this.pipeline = [];

        console.log('projection', projection);
        if (Object.keys(projection).length > 0) {
            this.pipeline.push(projection);
        }

        return this;
    }

    getPipeline(optimize = true) {
        //ensure we have pipeline
        if (!this.pipeline) this.pipeline = [];
        let pipeline = this.pipeline.concat();

        /**
         * We want to place any $match operations
         * as early in the aggregation pipeline 
         * as possible.
         */
        if (optimize) {

        }
        return pipeline;
    }

    /**
     * Fields:
     * - resumeAfter: Object
     * - fullDocument: String
     * - batchSize: int
     * - maxAwaitTimeMS: int
     * - collation
     */
    addOption(option, value) {
        if (!this.options) this.options = {};

        //TODO: validate option and type
        const options = Subscription.options;

        if (!options.hasOwnProperty(option)) {
            this.logger.warn('Unknown property %s', option);
            return this;
        }

        if (typeof value !== options[option]) {
            this.logger.warn('Wrong property type %s', option);
            return this;
        }

        if (typeof value === 'object') {
            this.options[option] = extend({}, value);
        } else {
            this.options[option] = value;
        }

        return this;
    }

    static createSubscription(listener) {
        const subs = new Subscription(listener);

        Subscription.createOperationTypeFilter(subs, listener);
        Subscription.createDocumentFilter(subs, listener);
        Subscription.createProjection(subs, listener);
        Subscription.createOptions(subs, listener);

        return subs;
    }

    /**
     * Creates a $match filter for our pipeline.
     * This pics what type of change we want to listen to.
     * 
     * TODO: Verify we can listen to multiple ChangeTypes.
     * 
     * @param {Subscription} subscription Subscription instance
     * @param {Object} options Options object
     */
    static createOperationTypeFilter(subscription, options = {}) {
        if (!options.when) return;

        let modified = false;
        const operation = Subscription.matchTemplate();

        options.when.forEach(entry => {
            switch (entry) {
                case ChangeType.CREATE:
                    console.log('CREATE')
                    modified = true;
                    operation.$match.operationType.$in.push(ChangeType.CREATE);
                    break;
                case ChangeType.UPDATE:
                    modified = true;
                    operation.$match.operationType.$in.push(ChangeType.UPDATE, ChangeType.REPLACE);
                    break;
                case ChangeType.DELETE:
                    modified = true;
                    // operation.$match.operationType = ChangeType.DELETE;
                    operation.$match.operationType.$in.push(ChangeType.DELETE);
                    break;
                default:
                    this.logger.warn('operation not supported');
            }
        });

        /**
         * We should guard against having a when entry but 
         * no supported change type.
         */
        if (modified) {
            console.log('modified');
            subscription.addPipeline(operation);
        }
    }

    /**
     * A $match expression that limits what kind 
     * of changes will trigger notifications. This 
     * would be like a WHERE clause in SQL.
     * 
     * Restrictions:
     * You cannot use `$where` in `$match` queries as 
     * part of the aggregation pipeline.
     * 
     * @see https://docs.mongodb.com/manual/reference/operator/aggregation/match/#pipe._S_match
     * @param {Subscription} subscription 
     * @param {Object} options 
     */
    static createDocumentFilter(subscription, options = {}) {
        if (!options.filter) return

        const filter = { $match: Subscription.ensureDocumentFilterFieldNaming(options.filter) };

        subscription.addPipeline(filter);
    }

    static ensureDocumentFilterFieldNaming(filter) {
        const result = {};

        for (let key in filter) {
            let nkey;
            let value = filter[key];
            /**
             * If we are using a mongo operator keyword,
             * e.g. starts with `$`:
             */
            if (Subscription.isOperatorName(key)) {
                nkey = key;
                value = filter[key].map(entry => Subscription.ensureDocumentFilterFieldNaming(entry));
            } else {
                /*
                 * We consider this to be a field, that is
                 * a Model attribute. We need to prepend it
                 * with `fullDocument` which is property of
                 * the result set containing record values.  
                 */
                nkey = Subscription.fixKeyName(key);
                result[nkey] = filter[key];
            }

            result[nkey] = value;
        }

        return result;
    }

    /**
     * Projections work on the returned changeset, not on the
     * updated field.
     * 
     * In a projection we pick which fields from the result
     * set we want to return.
     * 
     * It further changes the changeset strcture by turning
     * `updateDescription.updateFields` into `updateFields`.
     * 
     * NOTE: This changes the result format. It removes fields
     * in the changeset.
     * 
     * @see https://docs.mongodb.com/manual/reference/operator/aggregation/project/index.html
     * 
     * @param {Subscription} subscription 
     * @param {Object} options 
     */
    static createProjection(subscription, options = {}) {
        if (!Array.isArray(options.fields)) return

        const $project = extend({}, this.defaultProjectionProperties);

        options.fields.forEach(field => $project[Subscription.fixKeyName(field)] = 1);
        subscription.addPipeline({ $project });
    }

    /**
     * 
     * @param {Subscription} subscription 
     * @param {Object} options 
     */
    static createOptions(subscription, options = {}) {
        //TODO: Make function in Subscription to add option
        /**
         * Change Events have a property fullDocument 
         * which is the document created or modified 
         * by the operation. 
         * 
         * For `insert` and `replace` this represents 
         * the new document created by the operation.
         * 
         * For `delete` operations, this field is omitted 
         * as the document no longer exists.
         * 
         * For update oprations, this field only appears
         * if you configured the change stream with
         * **fullDocument** set to **updateLookup**.
         * This field then will represent the most 
         * current version of the document.
         */
        const value = options.fields ? 'updateLookup' : 'default';
        subscription.addOption('fullDocument', value);

    }

    static isOperatorName(name) {
        return name.charAt(0) === '$';
    }

    static fixKeyName(key) {
        if (Subscription.isOperatorName(key)) return key;
        if (key.indexOf('fullDocument.') === 0) return key;
        return `fullDocument.${key}`;
    }

    //////////////////////////////////////////////////////
    // TEMPLATES
    //////////////////////////////////////////////////////

    /** 
     * Template for match object pipeline
     */
    static matchTemplate() {
        return extend({}, { $match: { operationType: { $in: [] } } })
    };


}

//TODO: This should be a function call where we clone the opbject.
Subscription.options = {
    resumeAfter: 'object',
    fullDocument: 'string',
    batchSize: 'number',
    maxAwaitTimeMS: 'number',
    collation: 'object'
};

//TODO: This should be a function call where we clone the opbject.
Subscription.serializableAttributes = ['data', 'collection', 'pipeline', 'options', 'uuid', 'active'];

//TODO: This should be a function call where we clone the opbject.


module.exports = Subscription;
