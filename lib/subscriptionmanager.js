'use strict';
const extend = require('gextend');
const MongoClient = require('mongodb').MongoClient;
const Subscription = require('./subscription');

const DEFAULTS = {
    subscriptionsCollection: 'subscriptions',
    query: {
        active: true
    }
};

class SubscriptionManager {
    constructor(config) {
        config = extend(this, DEFAULTS, config);
        extend(this, config);
    }

    load(db, query = {}) {
        const query = extend({}, DEFAULTS.query, query);

        const collection = db.collection(this.subscriptionsCollection);

        return collection.find(query).then(subscriptions => {
            return subscriptions.map(json => new Subscription(json));
        });
    }

    save(db, subscriptions) {
        const collection = db.collection(this.subscriptionsCollection);

        collection.createIndex({ 'uuid': 1 });
        const ids = subscriptions.map(sub => { uuid: sub.uuid });
        subscriptions = subscriptions.map(sub => sub.toJSON());
        collection.updateMany(ids, subscriptions, {
            upsert: true
        })
    }

}

module.exports = SubscriptionManager;
