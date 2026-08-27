// SyncProgressService: Handles polling and job completion for translation sync jobs
'use strict';

(function() {
    angular
        .module('app')
        .service('SyncProgressService', SyncProgressService);

    SyncProgressService.$inject = ['UiTranslateFactory', '$timeout', '$rootScope'];

    function SyncProgressService(UiTranslateFactory, $timeout, $rootScope) {
        /**
         * Poll progress for a jobId, updates UI via callback, resolves when finished
         */
        this.pollSyncProgress = function(jobId, targetLocale, updateCallback) {
            return new Promise(function(resolve, reject) {
                function poll() {
                    UiTranslateFactory.getSyncProgress(jobId)
                        .then(function(jobData) {
                            if (updateCallback) {
                                updateCallback(jobData);
                            }
                            $timeout(function(){},0);
                            if (jobData.status === 'completed') {
                                resolve(jobData);
                            } else if (jobData.status === 'failed') {
                                reject(jobData.error || 'Sync failed');
                            } else {
                                $timeout(poll, 2000);
                            }
                        })
                        .catch(function(err) {
                            reject('Failed to poll progress: ' + err);
                        });
                }
                poll();
            });
        };

        /**
         * Wait for job completion (for sync all functionality)
         */
        this.waitForJobCompletion = function(jobId, callback) {
            function pollForCompletion() {
                UiTranslateFactory.getSyncProgress(jobId).then(function (response) {
                    if (response) {
                        var jobData = response;
                        if (jobData.status === 'completed' || jobData.status === 'failed') {
                            callback();
                        } else {
                            $timeout(pollForCompletion, 2000);
                        }
                    } else {
                        callback();
                    }
                }).catch(function () {
                    callback();
                });
            }
            pollForCompletion();
        };
    }
})();
