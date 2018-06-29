'use strict';

module.exports = {
    CREATE: 'insert',
    UPDATE: 'update',
    DELETE: 'delete',
    REPLACE: 'replace',
    fromOperation: (operation) => {
        return operation;
    }
};
