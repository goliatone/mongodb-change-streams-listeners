'use strict';
const extend = require('gextend');
// const MongoClient = require('mongodb').MongoClient;
// const Subscription = require('./subscription');

const DEFAULTS = {
    subscriptionsCollection: '_pms:subscriptions_',
    query: {
        active: true
    }
};

/**
 * Manage persistence of Subscription entities.
 * Store, load, and update subscriptions.
 */
class SubscriptionManager {

    constructor(config) {
        config = extend(this, DEFAULTS, config);
        extend(this, config);
    }

    /**
     * Load all subscriptions stored in DB.
     * 
     * @param {Mongodb} db Mongo client
     * @param {Object} query Query to pull Subscriptions
     *                       from DB
     * @return {Promise}
     */
    load(db, query = {}) {
        query = extend({}, DEFAULTS.query, query);

        const collection = db.collection(this.subscriptionsCollection);

        return new Promise((resolve, reject) => {
            collection.find(query).toArray((err, res) => {
                console.log('res', res)
                if (err) reject(err);
                else resolve(res);
            });
        });
        // .then(subscriptions => {
        //     return subscriptions.map(json => new Subscription(json));
        // });
    }

    /**
     * 
     * @param {Mongodb} db Mongo client
     * @param {Array} subscriptions Subscription collection
     * @return {Promise}
     */
    save(db, subscriptions) {
        const collection = db.collection(this.subscriptionsCollection);

        /**
         * Create an index in our collection.
         */
        collection.createIndex({ 'uuid': 1 }, { unique: true });

        /*
         * Collect all UUIDs to update our subscriptions.
         */
        const updates = subscriptions.map(sub => {
            return {
                updateOne: {
                    filter: { uuid: sub.uuid },
                    update: sub.toJSON(),
                    upsert: true
                }
            };
        });

        /**
         * This will return an object in the form of:
         * - acknowledged: Boolean
         * - matchedCount: Integer
         * - modifiedCount: Integer:
         * - upsertedId: IDs of object upserted
         */
        return collection.bulkWrite(updates, {
            ordered: false
        });
    }
}

module.exports = SubscriptionManager;
