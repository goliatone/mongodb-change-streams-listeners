'use strict';

const DEFAULTS = {
    signals: [
        'SIGINT',
        'SIGHUP',
        'SIGQUIT',
        'SIGTERM',
        'uncaughtException',
        'exit'
    ],
    messages: {
        SIGINT: '[ctrl-C]',
        uncaughtException: 'Uncaught exception...'
    }
};
//TODO: Merge with core.io/application/signals
class Signals {
    constructor() {}

    install(cleanup, messages = {}) {
        if (this.installed) return;

        this.installed = true;
        this.cleanupHandlers = [];

        this.messages = extend({}, DEFAULTS.messages, messages);

        this.sigintHandler = this.signalHandler.bind(this, 'SIGINT');
        this.sighupHandler = this.signalHandler.bind(this, 'SIGHUP');
        this.sigquitHandler = this.signalHandler.bind(this, 'SIGQUIT');
        this.sigtermHandler = this.signalHandler.bind(this, 'SIGTERM');

        process.on('SIGINT', this.sigintHandler);
        process.on('SIGHUP', this.sighupHandler);
        process.on('SIGQUIT', this.sigquitHandler);
        process.on('SIGTERM', this.sigtermHandler);
        process.on('uncaughtException', this.uncaughtExceptionHandler);
        process.on('exit', this.exitHandler);

        this.addCleanupHanlder(cleanup || this.noCleanup);
    }

    uninstall() {
        if (!this.cleanupHandlers) return;
        process.removeListener('SIGINT', this.sigintHandler);
        process.removeListener('SIGHUP', this.sighupHandler);
        process.removeListener('SIGQUIT', this.sigquitHandler);
        process.removeListener('SIGTERM', this.sigtermHandler);
        process.removeListener('uncaughtException', this.uncaughtExceptionHandler);
        process.removeListener('exit', this.exitHandler);
        this.cleanupHandlers = undefined;
    }

    addCleanupHanlder(handler) {
        this.cleanupHandlers.push(handler);
    }

    noCleanup() {
        return true;
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
                process.stderr.write(this.messages[signal] + '\n');
            }

            /**
             * Cleanup only once
             */
            this.uninstall();
            /**
             * Pass the signal to parent process
             */
            process.kill(process.pid, signal);
        }
    }

    uncaughtExceptionHandler(err) {
        if (this.messages.uncaughtException) {
            process.stderr.write(this.messages.uncaughtException + '\n');
        }
        process.stderr.write(e.stack + '\n');

        /**
         * This calls exitHandler
         */
        process.exit(1);
    }

    exitHandler(code, signal) {
        this.cleanupHandlers.forEach(cleanup => {
            cleanup(code, signal);
        });
    }

}

module.exports = Signals;
module.exports.instance = new Signals();
