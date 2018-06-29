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

test('Subscription: createOperationTypeFilter should add a CREATE pipeline', t => {
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

// var htest = test.createHarness();
// htest('Subscription', t => {

// });
test('Subscription: createProjection should only be applied if we have a fields attribute', t => {
    const src = getJsonTemplate();
    const sub = new Subscription(src);
    const stub = sinon.stub(sub, 'addPipeline');

    Subscription.createProjection(sub, {});

    t.false(stub.called, 'We should not add an empty pipeline if no fields present');

    Subscription.createProjection(sub, { fields: [] });

    t.false(stub.called, 'We should not add an empty pipeline if fields empty');

    Subscription.createProjection(sub, { fields: ['email'] });

    t.true(stub.called, 'We should add a pipeline if fields present');

    stub.resetBehavior();

    t.end();
});

test('Subscription: createProjection should create the proper pipeline', t => {
    const src = getJsonTemplate();
    const sub = new Subscription(src);

    Subscription.createProjection(sub, { fields: ['email'] });

    let pipeline = sub.getPipeline();
    const expected = { '$project': { 'fullDocument.email': 1 } };

    t.equal(pipeline.length, 1, 'Pipeline has one item');
    t.isEquivalent(pipeline, [expected], 'We have $project object');

    t.true(pipeline);

    t.end();
});

test('Subscription: fixKeyName should not modify operator names', t => {
    t.equal(Subscription.fixKeyName('$project'), '$project', 'Respect operator keys');
    t.end();
});

test('Subscription: fixKeyName should be idempotent', t => {
    let expected = Subscription.fixKeyName('email');

    t.equal(Subscription.fixKeyName(expected), expected, 'Do not modify multiple times same key');
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
