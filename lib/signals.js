'use strict';

// const human = require('human-time');
const extend = require('gextend');
const EventEmitter = require('events');
const logger = require('./logger');

const DEFAULTS = {
    autoinitialize: true,
    signals: [
        'SIGINT',
        'SIGHUP',
        'SIGTERM',
        'SIGQUIT',
        'SIGBREAK',
        'uncaughtException'
    ],
    handlers: [],
    timeout: 1 * 1000,
    defaultExitCode: 0,
    logger,
    getProcess: function() {
        return process;
    },
    messages: {
        SIGINT: '[ctrl-C]',
        uncaughtException: 'Uncaught exception...'
    }
};
//TODO: Merge with core.io/application/signals
class Signals extends EventEmitter {

    constructor(config) {
        super();

        config = extend({}, DEFAULTS, config);
        if (config.autoinitialize) this.init(config);
    }

    init(config = {}) {
        if (this.initialized) return this;
        this.initialized = true;
        extend(this, config);

        this.handlers.map(handler => {
            this.on(Signals.SHUTDOWN_EVENT, handler);
        });

        this.cleanupHandlers = [];

        this.process = this.getProcess();

        this.registerSingals(this.signals);
        this.process.on('uncaughtException', this.uncaughtExceptionHandler);

        return this;
    }

    registerSingals(signals = DEFAULTS.signals) {
        const self = this;

        function once(signal, codeOrError) {
            if (self.ran) return;
            self.ran = true;

            try {
                self._onShutdown({
                    signal,
                    data: codeOrError
                });
            } catch (error) {
                this.logger.error(error);
                self.exit(1);
            }

            signals.map(signal => {
                self.process.removeListener(signal, once);
            });
        }

        signals.map(signal => {
            this.logger.info('processing shutdown handler for %s', signal);
            this.process.on(signal, once.bind(null, signal));
        });
    }

    _onShutdown(event) {
        if (this.shuttingDown) return;
        this.logger.warn('\nSIGNALS: Got "%s", start shudown process', event.signal);

        // this.logger.warn('SERENE: Timeout will execute in %s',
        //     human(-1 * this.timeout / 1000)
        // );
        if (event.data instanceof Error) {
            this.logger.error('nSIGNALS: Exit due an uncaught exception, %s', event.data.message);
            if (event.data && event.data.stack) {
                this.logger.error(event.data.stack);
            }
        }

        this.shuttingdown = true;

        this.timeoutId = setTimeout(_ => {
            this.exit(1);
        }, this.timeout);

        this.emit(Signals.SHUTDOWN_EVENT, event);
    }

    close(event) {
        this.signalHandler(event.signal);
    }

    uninstall() {
        this.process.removeListener('uncaughtException', this.uncaughtExceptionHandler);
    }

    exit(code) {
        code = code === undefined ? this.defaultExitCode : code;

        this.logger.warn('Request exit, code %s', code);

        clearTimeout(this.timeoutId);

        this.uninstall();

        this.process.exit(code);
    }

    signalHandler(signal) {
        let exit = true;

        this.cleanupHandlers.forEach(cleanup => {
            if (cleanup(null, signal) === false) {
                exit = false;
            }
        });

        if (exit) {

            if (this.messages[signal]) {
                this.process.stderr.write(this.messages[signal] + '\n');
            }

            /**
             * Cleanup only once
             */
            this.uninstall();

            /**
             * Pass the signal to parent process
             */
            this.process.kill(process.pid, signal);
        }
    }

    uncaughtExceptionHandler(err) {
        if (this.messages.uncaughtException) {
            this.process.stderr.write(this.messages.uncaughtException + '\n');
        }
        this.process.stderr.write(e.stack + '\n');

        /**
         * This calls exitHandler
         */
        this.exit(1);
    }

    exitHandler(code, signal) {
        this.cleanupHandlers.forEach(cleanup => {
            cleanup(code, signal);
        });
    }

}

Signals.SHUTDOWN_EVENT = 'shutdown';

module.exports = Signals;
// module.exports.instance = new Signals();
