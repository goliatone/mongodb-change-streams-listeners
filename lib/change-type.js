'use strict';

module.exports = {
    CREATE: 'insert',
    UPDATE: 'update',
    DELETE: 'delete',
    REPLACE: 'replace',
    /**
     * We are actually matching the mongo
     * operation names, so no need to translate
     * at the moment, but still.
     */
    fromOperation: operation => {
        return operation;
    }
};
