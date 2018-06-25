const Watcher = require('..').Watcher;
const Signals = require('..').Signals;

const Keypath = require('gkeypath');

const watcher = new Watcher({
    connection: {
        uri: process.env.NODE_MONGOURL,
    },
    options: {
        storage: {
            batchSize: 3
        }
    },
    listeners: [{
        collection: 'profile',
        // when: [Watcher.UPDATE],
        // filter: { email: 'pepe@rone.com' },
        // fields: ['ran'],
        topic: 'profile.peperone'
    }]
});

watcher.on('profile.update', changeset => {
    console.log('------ change set ------');
    console.log(changeset.change.documentKey, changeset.change.operationType);
    if (changeset.change.operationType === 'update') {
        console.log('ran: %j', Keypath.get(changeset.change, 'updateDescription.updatedFields.ran'));
    }
});

watcher.start();

let signals = new Signals();

signals.on(Signals.SHUTDOWN_EVENT, event => {
    console.log('shutdown', event);

    watcher.removeAllListeners();

    watcher.storage.commit(true).then(_ => {
        signals.close(event);
    });
});
