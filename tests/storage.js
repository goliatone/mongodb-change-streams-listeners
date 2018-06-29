'use strict';
const test = require('tape');
const extend = require('gextend');
const sinon = require('sinon');

const Storage = require('..').Storage;

test('storage', t => {
    const store = new Storage({
        batchSize: 1,
        options: {
            dir: './tests/fixtures/localStorage'
        }
    });

    store.start().then(items => {
        console.log('items', items);
        t.true(true, 'Storage start returns all previous items');
        store.setCheckpoint('profile', 'token').then(_ => {
            console.log('done here...');
            t.end();
        });
    });

    // t.end();
});

test('Storage: we should be able to configure batchSize', t => {
    const batchSize = 20;
    const store = new Storage({
        batchSize
    });
    t.equals(store.batchSize, batchSize, 'It matches batch size');
    t.end();
});

test('Storage: batchSize configures the number of items before commit is called', async t => {

    const batchSize = 2;

    const store = new Storage({
        batchSize
    });

    const stub = sinon.stub(store, 'commit');

    await store.setCheckpoint('profile', 'token');

    t.false(stub.called, 'commit should not be called');

    await store.setCheckpoint('profile', 'token');

    t.true(stub.called, 'commit should be called when we reach batch size');

    t.equals(store.batchSize, batchSize, 'It matches batch size');
    t.end();
});

test('Storage: on start we should get all previously stored checkpoints', async t => {
    const expected = getFixture('localStorage').checkpoint;

    const store = new Storage({
        options: {
            dir: './tests/fixtures/localStorage'
        }
    });

    const result = await store.start();

    t.isEquivalent(result, expected, 'we get all previous checkpoints on start');

    t.end();
});

test('Storage: getCheckpointForCollection returns the expected value for a given collection', async t => {
    const expected = getFixture('localStorage').token;

    const store = new Storage({
        options: {
            dir: './tests/fixtures/localStorage'
        }
    });

    await store.start();

    const result = await store.getCheckpointForCollection('profile');

    t.isEquivalent(result, expected, 'we get expected collection');

    t.end();
});

test('Storage: we are able to go from collection to key and back', t => {
    t.plan(1);

    const store = new Storage();
    t.throws(_ => {
        store.getCheckpointForCollection('profile')
    });
    t.end();
});

test('Storage: we are able to go from collection to key and back', t => {
    const store = new Storage();

    let key = store.getKeyFromCollection('profile');
    let collection = store.getCollectionFromKey(key);
    t.equals(collection, 'profile', 'we get expected collection');

    t.end();
});

test.only('Storage: commit should reset our state', async(t) => {
    const store = new Storage();
    await store.start();

    //TODO: this is a hack!
    store.lastToken = getFixture('localStorage').raw;
    store.counter = 10;
    await store.commit();

    t.notOk(store.lastToken, 'lastToken reset');
    t.notOk(store.counter, 'counter reset');

    t.end();
});


function getFixture(name) {
    return {
        checkpoint: { profile: 'token' },
        collection: 'profile',
        token: 'token',
        raw: { "key": "profile:resume_token", "value": "token" },
    };
}
