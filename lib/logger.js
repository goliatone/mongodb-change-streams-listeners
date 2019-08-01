'use strict';

const logger = {};
const methods = ['error', 'warn', 'info', 'log', 'debug', 'assert', 'trace', 'log'];

methods.map(
    k => (logger[k] = console[k].bind(console))
);

module.exports = logger;
