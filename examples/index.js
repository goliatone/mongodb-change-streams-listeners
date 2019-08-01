'use strict';

const Keypath = require('gkeypath');
const Watcher = require('..').Watcher;
const Signals = require('..').Signals;
const SubManager = require('..').SubscriptionManager;

const manager = new SubManager();

const watcher = new Watcher({
    connection: {
        uri: process.env.NODE_MONGODB_ENDPOINT,
    },
    options: {
        storage: {
            batchSize: 3
        }
    },
    listeners: [{
        active: true,
        collection: 'profile',
        // when: [Watcher.UPDATE],
        // filter: { email: 'pepe@rone.com' },
        // fields: ['ran'],
        data: {
            topic: 'profile.peperone'
        }
    }]
});

watcher.on('profile.update', changeset => {
    console.log('------ change set ------');
    console.log(changeset)
    console.log(changeset.change.documentKey, changeset.change.operationType);
    if (changeset.change.operationType === 'update') {
        console.log('ran: %j', Keypath.get(changeset.change, 'updateDescription.updatedFields.ran'));
    }
});

watcher.loadDB().then(db => {
    console.log('DB loaded');

    return manager.load(db).then((subscriptions = []) => {
        console.log('------ LOADED SUBSCRIPTIONS FROM DB ------');
        console.log(subscriptions);

        watcher.subscribeListeners(subscriptions);

        watcher.start().then(_ => {
            // console.log('------ SAVE SUBSCRIPTIONS IN DB ------');
            // manager.save(db, watcher.subscriptions);
        });
    });
}).catch(err => {
    console.error('Error initializing watcher');
    console.error(err);
});

let signals = new Signals();

signals.on(Signals.SHUTDOWN_EVENT, event => {
    console.log('shutdown', event);

    watcher.removeAllListeners();

    watcher.storage.commit(true).then(_ => {
        signals.close(event);
    });
});
