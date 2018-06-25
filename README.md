## MongoDB Change Streams Listeners

Manage listeners for MongoDB change streams.


```js
const watcher = new Watcher({
    connection: {
        uri: process.env.NODE_MONGOURL,
    },
    options: {
        storage: {
            batchSize: 10
        }
    },
    listeners: [{
        collection: 'profiles',
        when: [Watcher.UPDATE],
        filter: { email: 'goliat@one.com' },
        fields: ['profilePicture', 'presence'],
        data: {
            topic: 'profiles.goliatone'
        }
    }]
});

watcher.on('profile.update', changeset => {
    if (changeset.change.operationType === 'update') {
        console.log('presence: %s', Keypath.get(changeset.change, 'updatedFields.presence'));
    }
});

watcher.start();
```

<!--
https://docs.mongodb.com/manual/reference/method/db.collection.watch/index.html
https://github.com/rlondner/mongodb-node-changestreams-sample/blob/master/listen.js
-->