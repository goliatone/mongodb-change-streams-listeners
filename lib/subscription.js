'use strict';
const ChangeType = require('./change-type');

class Subscription {
    constructor(config = {}) {
        this.topic = config.topic;
        this.collection = config.collection;
        this.pipeline = [];
        this.options = {};
    }

    toJSON() {
        return {
            topic: this.topic,
            collection: this.collection,
            pipeline: this.pipeline,
            options: this.options
        };
    }

    addPipeline(operation) {
        this.pipeline.push(operation);
    }

    /**
     * Fields:
     * - resumeAfter: Object
     * - fullDocument: String
     * - batchSize: int
     * - maxAwaitTimeMS: int
     * - collation
     */
    addOption() {

    }


    static createSubscription(listener) {
        const subs = new Subscription(listener);

        // Subscription.createOperationTypeFilter(subs, listener);
        // Subscription.createDocumentFilter(subs, listener);
        Subscription.createProjection(subs, listener);
        Subscription.createOptions(subs, listener);

        return subs;
    }

    static createOperationTypeFilter(subscription, options = {}) {
        if (!options.when) return

        const operation = { $match: { operationType: { $in: [] } } };
        options.when.forEach(entry => {
            switch (entry) {
                case ChangeType.CREATE:
                    operation.$match.operationType.$in.push(ChangeType.CREATE);
                    break;
                case ChangeType.UPDATE:
                    operation.$match.operationType.$in.push(ChangeType.UPDATE, ChangeType.REPLACE);
                    break;
                case ChangeType.DELETE:
                    operation.$match.operationType = ChangeType.DELETE;
                    break;
                default:
                    console.log('operation not supported');
            }
        });

        subscription.addPipeline(operation);
    }

    static createDocumentFilter(subscription, options = {}) {
        if (!options.filter) return

        const filter = { $match: Subscription.ensureDocumentFilterFieldNaming(options.filter) };

        subscription.addPipeline(filter);
    }

    static ensureDocumentFilterFieldNaming(filter) {
        const result = {};

        for (var key in filter) {
            let nkey;
            let value = filter[key];
            if (Subscription.isOperatorName(key)) {
                nkey = key;
                value = filter[key].map(entry => Subscription.ensureDocumentFilterFieldNaming(entry));
            } else {
                nkey = Subscription.fixKeyName(key);
                //Do we need this here?! is the same as next line
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
     * It further changes the changeset strcture by turning
     * `updateDescription.updateFields` into `updateFields`.
     * 
     * NOTE: This changes the result format. It removes fields
     * in the changeset.
     * 
     * @param {Subscription} subscription 
     * @param {Object} options 
     */
    static createProjection(subscription, options = {}) {
        if (!Array.isArray(options.fields)) return
        const $project = {
            /**
             * This we need to process change
             */
            operationType: 1,
            documentKey: 1
        };
        options.fields.forEach(field => $project[Subscription.fixKeyName(field)] = 1);
        subscription.addPipeline({ $project });
    }

    static createOptions(subscription, options = {}) {
        //TODO: Make function in Subscriptiont o add option
        subscription.options = {
            fullDocument: options.fields ? 'updateLookup' : 'default'
        };
    }

    static isOperatorName(name) {
        return name.charAt(0) === '$';
    }

    static fixKeyName(key) {
        if (Subscription.isOperatorName(key)) return key;
        if (key.indexOf('fullDocument.') === 0) return key;
        return `fullDocument.${key}`;
    }
}


module.exports = Subscription;
