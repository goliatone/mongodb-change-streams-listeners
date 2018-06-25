'use strict';

const logger = {};
['error', 'warn', 'info', 'log',
    'debug', 'assert', 'trace', 'log'
].map(k => logger[k] = console[k].bind(console));

module.exports = logger;
