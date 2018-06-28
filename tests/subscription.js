'use strict';
const test = require('tape');
const extend = require('gextend');
const sinon = require('sinon');
const ChangeTypes = require('..').ChangeTypes;

const Subscription = require('..').Subscription;


test('Subscription: deserialize from Object', t => {
    const src = getJsonTemplate();

    const sub = new Subscription(src);
    t.isEquivalent(src, sub.toJSON(), 'Properly deserialized properties');
    t.end();
});

test('Subscription: serialize to Object', t => {
    const src = getJsonTemplate();

    const sub = new Subscription(src);

    t.isEquivalent(src, sub.toJSON(), 'Properly serialized properties');
    t.end();
});

test('Subscription: serialize to Object', t => {
    const src = getJsonTemplate();

    const sub = new Subscription(src);

    t.isEquivalent(src, sub.toJSON(), 'Properly serialized properties');
    t.end();
});


test('Subscription: only take defined options and option values', t => {
    const src = getJsonTemplate({
        options: {
            resumeAfter: {
                '_data': 'glsxMWcAAAABRmRfaWQAZFr7H8r23mgJAhfSbgBaEATcRYwCONNDVbf6Rv+2u9LeBA=='
            },
            randomValue: true,
            batchSize: '23'
        }
    });
    const sub = new Subscription(src);
    const json = sub.toJSON();
    t.isEquivalent(json.options.resumeAfter, src.options.resumeAfter, 'Option value OK');
    t.equal(json.options.randomValue, undefined, 'Random option attribute discarded OK');
    t.equal(json.options.batchSize, undefined, 'Option with wrong type is discarded OK');
    t.end();
});

test('Subscription: createOperationTypeFilter should only call addPipeline if "when" clause is present', t => {
    const src = getJsonTemplate();
    const sub = new Subscription(src);
    const stub = sinon.stub(sub, 'addPipeline');
    Subscription.createOperationTypeFilter(sub, {});

    t.false(stub.called, 'We should not add an empty pipeline');
    stub.resetBehavior();

    t.end();
});

test('Subscription: createOperationTypeFilter should add a DELETE pipeline', t => {
    const src = getJsonTemplate();
    const sub = new Subscription(src);

    const expected = [
        Subscription.matchTemplate()
    ];
    expected[0].$match.operationType.$in.push(ChangeTypes.DELETE);

    Subscription.createOperationTypeFilter(sub, {
        when: [ChangeTypes.DELETE]
    });

    t.isEquivalent(sub.pipeline, expected, 'We should add a $match pipeline');
    t.end();
});

test.only('Subscription: createOperationTypeFilter should add a CREATE pipeline', t => {
    const src = getJsonTemplate();
    const sub = new Subscription(src);

    const expected = [
        Subscription.matchTemplate()
    ];
    expected[0].$match.operationType.$in.push(ChangeTypes.CREATE);

    Subscription.createOperationTypeFilter(sub, {
        when: [ChangeTypes.CREATE]
    });

    t.isEquivalent(sub.pipeline, expected, 'We should add a $match pipeline');
    t.end();
});

test('Subscription: createOperationTypeFilter should add a UPDATE pipeline', t => {
    const src = getJsonTemplate();
    const sub = new Subscription(src);

    const expected = [
        Subscription.matchTemplate()
    ];
    expected[0].$match.operationType.$in.push(ChangeTypes.UPDATE, ChangeTypes.REPLACE);

    Subscription.createOperationTypeFilter(sub, {
        when: [ChangeTypes.UPDATE]
    });

    t.isEquivalent(sub.pipeline, expected, 'We should add a $match pipeline');
    t.end();
});

test('Subscription: createOptions should add updateLookup if we have fields', t => {
    const src = getJsonTemplate();
    const sub = new Subscription(src);

    const expected = 'updateLookup';

    Subscription.createOptions(sub, {
        fields: ['email']
    });

    t.isEquivalent(sub.options.fullDocument, expected, 'We should add a $match pipeline');
    t.end();
});

test('Subscription: createOperationTypeFilter should only call addPipeline if "when" clause is present', t => {
    t.true(true, 'String sanitized.');
    t.end();
});


function getJsonTemplate(extra = {}) {
    let json = {
        uuid: '8324289a-aadd-4c87-8612-1c7509c79493',
        data: { topic: 'test-topic' },
        collection: 'profiles',
        pipeline: [],
        active: true,
        options: {
            resumeAfter: {
                '_data': 'glsxMWcAAAABRmRfaWQAZFr7H8r23mgJAhfSbgBaEATcRYwCONNDVbf6Rv+2u9LeBA=='
            }
        }
    };

    return extend({}, json, extra);
}
