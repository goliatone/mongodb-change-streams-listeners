'use strict';
const test = require('tape');
const extend = require('gextend');
const sinon = require('sinon');

const Watcher = require('..').Watcher;
const Subscription = require('..').Subscription;

test('Watcher: processChangeEvent fires 3 events', t => {
    const watcher = new Watcher({
        autoinitialize: false,
        makeStorage: function() {
            return {
                setCheckpoint: function() {
                    return Promise.resolve();
                }
            }
        },
        makeDbClient: function() {

        }
    });

    watcher.processChangeEvent(subscription, change);

    t.end();
});

test.only('Watcher: processChangeEvent calls add resume token', t => {
    const watcher = new Watcher({
        autoinitialize: true,
        makeStorage: function() {
            return {
                setCheckpoint: function() {
                    return Promise.resolve();
                }
            }
        },
        makeDbClient: function() {

        }
    });
    const emit = sinon.stub(watcher, 'emit');

    const subscription = new Subscription({
        collection: 'profile'
    });


    const change = {
        operationType: 'update',
        _id: {
            _data: 'glsxD8gAAAACRmRfaWQAZFr7H8r23mgJAhfSbgBaEATcRYwCONNDVbf6Rv+2u9LeBA=='
        }
    }

    watcher.processChangeEvent(subscription, change);

    t.equals(emit.getCall(0).args[0], 'profile.update');
    t.equals(emit.getCall(1).args[0], 'profile.*');
    t.equals(emit.getCall(2).args[0], 'change');

    t.isEquivalent(emit.getCall(0).args[1], { subscription, change });
    t.isEquivalent(emit.getCall(1).args[1], { subscription, change });
    t.isEquivalent(emit.getCall(2).args[1], { subscription, change });

    t.end();
});

test('watcher', t => {
    t.true(true, 'String sanitized.');
    t.end();
});
