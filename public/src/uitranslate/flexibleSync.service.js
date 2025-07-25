// FlexibleSyncService: Handles orchestration of flexible sync operations
'use strict';

(function() {
    angular
        .module('app')
        .service('FlexibleSyncService', FlexibleSyncService);

    FlexibleSyncService.$inject = ['UiTranslateFactory', 'SyncProgressService', '$rootScope', '$timeout'];

    function FlexibleSyncService(UiTranslateFactory, SyncProgressService, $rootScope, $timeout) {
        /**
         * Start sync for a single language, returns Promise with jobId
         */
        this.startLanguageSync = function(projectID, projectAlphaId, sourceLocale, targetLocale) {
            var syncData = {
                projectID: projectID,
                projectAlphaId: projectAlphaId,
                sourceLocale: sourceLocale,
                targetLocale: targetLocale
            };
            return UiTranslateFactory.startFlexibleSync(syncData)
                .then(function(response) {
                    if (response && response.jobId) {
                        return response.jobId;
                    } else {
                        return Promise.reject('No jobId returned from backend');
                    }
                });
        };

        /**
         * Sync a specific language and handle progress
         */
        this.syncOneLanguage = function(vm, targetLocale, updateCallback) {
            vm.syncingLanguages[targetLocale] = true;
            vm.currentTargetLocale = targetLocale;
            vm.languageProgress[targetLocale] = {progress: 0, step: '', message: ''};
            if (vm.unsyncedInfo && vm.unsyncedInfo.targetLanguages && vm.unsyncedInfo.targetLanguages[targetLocale]) {
                vm.unsyncedInfo.targetLanguages[targetLocale].syncProgress = 0;
            }
            return this.startLanguageSync(vm.chosen.projectID, vm.chosen.projectAlphaId, vm.unsyncedInfo.sourceLocale, targetLocale)
                .then(function(jobId) {
                    return SyncProgressService.pollSyncProgress(jobId, targetLocale, updateCallback);
                })
                .then(function(finalJobData) {
                    vm.syncingLanguages[targetLocale] = false;
                    vm.languageProgress[targetLocale].progress = 100;
                    vm.languageProgress[targetLocale].step = 'Completed';
                    vm.languageProgress[targetLocale].message = 'Translation sync completed successfully!';
                    if (vm.unsyncedInfo && vm.unsyncedInfo.targetLanguages && vm.unsyncedInfo.targetLanguages[targetLocale]) {
                        vm.unsyncedInfo.targetLanguages[targetLocale].syncProgress = 100;
                    }
                    $rootScope.$broadcast('growl', {
                        type: 'success',
                        msg: 'Translation to ' + vm.getLanguageName(targetLocale) + ' completed successfully!'
                    });
                })
                .catch(function(error) {
                    vm.syncingLanguages[targetLocale] = false;
                    vm.languageProgress[targetLocale].step = 'Failed';
                    vm.languageProgress[targetLocale].message = error || 'Translation sync failed';
                    if (vm.unsyncedInfo && vm.unsyncedInfo.targetLanguages && vm.unsyncedInfo.targetLanguages[targetLocale]) {
                        vm.unsyncedInfo.targetLanguages[targetLocale].syncProgress = 0;
                    }
                    $rootScope.$broadcast('growl', {
                        type: 'danger',
                        msg: 'Translation sync failed: ' + (error || 'Unknown error')
                    });
                });
        };

        /**
         * Sync all languages that need syncing
         */
        this.syncAllLanguages = function(vm) {
            if (!vm.unsyncedInfo || vm.unsyncedInfo.unsyncedLanguages.length === 0) {
                return;
            }
            vm.flexibleSyncInProgress = true;
            var languagesToSync = vm.unsyncedInfo.unsyncedLanguages.slice();
            var i = 0;
            var self = this;
            function syncLanguagesSequentially() {
                if (i >= languagesToSync.length) {
                    vm.flexibleSyncInProgress = false;
                    $rootScope.$broadcast('growl', {
                        type: 'success',
                        msg: 'All languages synced successfully!'
                    });
                    vm.loadUnsyncInfo();
                    return;
                }
                var targetLocale = languagesToSync[i];
                self.syncOneLanguage(vm, targetLocale, function(jobData) {
                    // Update per-language progress
                    vm.languageProgress[targetLocale].progress = jobData.progress || 0;
                    vm.languageProgress[targetLocale].step = jobData.step || '';
                    vm.languageProgress[targetLocale].message = jobData.message || '';
                    if (vm.unsyncedInfo && vm.unsyncedInfo.targetLanguages && vm.unsyncedInfo.targetLanguages[targetLocale]) {
                        vm.unsyncedInfo.targetLanguages[targetLocale].syncProgress = jobData.progress || 0;
                    }
                    // Update modal progress bar for current language
                    vm.syncProgress = jobData.progress || 0;
                    vm.syncStep = jobData.step || '';
                    vm.syncMessage = jobData.message || '';
                    if (!$rootScope.$$phase) {
                        $rootScope.$apply();
                    }
                }).then(function() {
                    i++;
                    syncLanguagesSequentially();
                });
            }
            syncLanguagesSequentially();
        };
    }
})();
