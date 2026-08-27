// BackupService: Handles backup and restore logic for translations
'use strict';

(function() {
    angular
        .module('app')
        .service('BackupService', BackupService);

    BackupService.$inject = ['UiTranslateFactory', '$rootScope'];

    function BackupService(UiTranslateFactory, $rootScope) {
        /**
         * Get aggregated list of available documents in backup collection
         */
        this.checkCopies = function() {
            return UiTranslateFactory.getBackupsList();
        };

        /**
         * Restore definite document from backup collection to main
         */
        this.restore = function(id, locale) {
            return UiTranslateFactory.restoreFromBackup(id, locale);
        };
    }
})();
