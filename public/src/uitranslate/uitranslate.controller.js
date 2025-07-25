'use strict';

(function() {
    angular
        .module('app')
        .controller('UiTranslatesCtrl', UiTranslatesCtrl);

    UiTranslatesCtrl.$inject = ['UiTranslateFactory', '$rootScope', '$window', '$timeout'];

    function UiTranslatesCtrl(UiTranslateFactory, $rootScope, $window, $timeout) {
        // --- SYNC HELPERS ---

        /**
         * Start sync for a single language, returns Promise with jobId
         */
        function startLanguageSync(projectID, projectAlphaId, sourceLocale, targetLocale) {
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
        }

        /**
         * Poll progress for a jobId, updates UI, resolves when finished
         */
        function pollSyncProgress(jobId, targetLocale, updateCallback) {
            return new Promise(function(resolve, reject) {
                function poll() {
                    UiTranslateFactory.getSyncProgress(jobId)
                        .then(function(jobData) {
                            if (updateCallback) {
                                updateCallback(jobData);
                            }
                            // Always trigger digest after update
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
        }
        var vm = this;

        vm.id = '';
        vm.locale = '';
        vm.data = [];
        vm.copiesList = [];
        vm.syncInProgress = false;
        vm.syncResult = null;

        // NEW FLEXIBLE SYNC MODAL VARIABLES
        vm.showSyncModal = false;
        vm.flexibleSyncInProgress = false;
        vm.currentJobId = null;
        vm.syncProgress = 0;
        vm.syncStep = '';
        vm.syncMessage = '';
        vm.currentTargetLocale = '';
        vm.unsyncedInfo = null;
        vm.syncingLanguages = {};
        // Per-language progress tracking
        vm.languageProgress = {}; // { [locale]: { progress, step, message } }

        // ADD LANGUAGE MODAL VARIABLES
        vm.showAddLanguageModal = false;
        vm.availableLanguages = [];
        vm.selectedLanguage = null;
        vm.addingLanguage = false;

        /**
         * Get language name by code
         */
        vm.getLanguageName = function (code) {
            return UiTranslateFactory.getLanguageName(code);
        };

//receiving information about available translations (id, locale)
        vm.init = function () {
            UiTranslateFactory.getProjectsList().then(function (data) {
                vm.initList = data;
            });
        };

//set id according to chosen project
        vm.chooseProject = function (project) {
            vm.id = project.projectID;
            vm.chosen = project;
            if (Array.isArray(project.locales) && project.locales.length > 0) {
                vm.locale = project.locales[0];
            }
            vm.showAddLanguageModal = false;
        };

//get a definite translations json from main collection
        vm.getTrans = function () {
            if (vm.gettingForm.$valid) {
                UiTranslateFactory.getTranslationItem(vm.id, vm.locale).then(function (data) {
                    vm.data = data;
                    for (let n = 0; n < vm.data.length; n++) {
                        if (!vm.data[n].translations) {
                            vm.data[n].translations = {};
                        }
                    }
                    if (vm.data.length) {
                        $rootScope.$broadcast('growl', {type: 'success', msg: 'Translations received!'});
                    } else {
                        $rootScope.$broadcast('growl', {
                            type: 'danger',
                            msg: 'Files not found. Check input data.'
                        });
                    }
                });
                vm.copiesList = [];
            }
        };

// DEPRECATED: Japanese-specific sync removed - use flexible sync modal instead

        // NEW FLEXIBLE TRANSLATION SYNC FUNCTIONS

        /**
         * Open the flexible sync modal
         */
        vm.openSyncModal = function () {
            if (!vm.chosen) {
                $rootScope.$broadcast('growl', {
                    type: 'danger',
                    msg: 'Please select a project first'
                });
                return;
            }

            vm.showSyncModal = true;
            vm.unsyncedInfo = null;
            vm.loadUnsyncInfo();
        };

        /**
         * Close the flexible sync modal
         */
        vm.closeSyncModal = function () {
            vm.showSyncModal = false;
            vm.flexibleSyncInProgress = false;
            vm.currentJobId = null;
            vm.syncProgress = 0;
            vm.syncStep = '';

            vm.syncMessage = '';
            vm.currentTargetLocale = '';
            vm.syncingLanguages = {};
        };


        /**
         * Load unsync information for the current project
         */
        vm.loadUnsyncInfo = function () {
            if (!vm.chosen) return;

            UiTranslateFactory.getUnsyncInfo(vm.chosen.projectID).then(function (unsyncData) {
                vm.unsyncedInfo = unsyncData;
            }).catch(function () {
                $rootScope.$broadcast('growl', {
                    type: 'danger',
                    msg: 'Failed to load language information'
                });
            });
        };

        /**
         * Sync a specific language
         */
        vm.syncLanguage = function (targetLocale, $event) {
            if ($event) {
                $event.stopPropagation();
            }

            vm.syncingLanguages[targetLocale] = true;
            vm.currentTargetLocale = targetLocale;
            vm.languageProgress[targetLocale] = {progress: 0, step: '', message: ''};
            if (vm.unsyncedInfo && vm.unsyncedInfo.targetLanguages && vm.unsyncedInfo.targetLanguages[targetLocale]) {
                vm.unsyncedInfo.targetLanguages[targetLocale].syncProgress = 0;
            }

            // Start sync, get jobId, then poll progress
            startLanguageSync(vm.chosen.projectID, vm.chosen.projectAlphaId, vm.unsyncedInfo.sourceLocale, targetLocale)
                .then(function(jobId) {
                    return pollSyncProgress(jobId, targetLocale, function(jobData) {
                        // Update UI for each poll
                        vm.languageProgress[targetLocale].progress = jobData.progress || 0;
                        vm.languageProgress[targetLocale].step = jobData.step || '';
                        vm.languageProgress[targetLocale].message = jobData.message || '';
                        if (vm.unsyncedInfo && vm.unsyncedInfo.targetLanguages && vm.unsyncedInfo.targetLanguages[targetLocale]) {
                            vm.unsyncedInfo.targetLanguages[targetLocale].syncProgress = jobData.progress || 0;
                        }
                        if (!$rootScope.$$phase) {
                            $rootScope.$apply();
                        }
                    });
                })
                .then(function(finalJobData) {
                    // Success
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
                    vm.loadUnsyncInfo();
                })
                .catch(function(error) {
                    // Failure
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
        vm.syncAllLanguages = function () {
            if (!vm.unsyncedInfo || vm.unsyncedInfo.unsyncedLanguages.length === 0) {
                return;
            }

            vm.flexibleSyncInProgress = true;
            var languagesToSync = vm.unsyncedInfo.unsyncedLanguages.slice();
            var i = 0;

            function syncOneLanguage(targetLocale) {
                vm.currentTargetLocale = targetLocale;
                vm.syncingLanguages[targetLocale] = true;
                vm.languageProgress[targetLocale] = {progress: 0, step: '', message: ''};
                if (vm.unsyncedInfo && vm.unsyncedInfo.targetLanguages && vm.unsyncedInfo.targetLanguages[targetLocale]) {
                    vm.unsyncedInfo.targetLanguages[targetLocale].syncProgress = 0;
                }
                return startLanguageSync(vm.chosen.projectID, vm.chosen.projectAlphaId, vm.unsyncedInfo.sourceLocale, targetLocale)
                    .then(function(jobId) {
                        return pollSyncProgress(jobId, targetLocale, function(jobData) {
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
                        });
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
            }

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
                syncOneLanguage(targetLocale).then(function() {
                    i++;
                    syncLanguagesSequentially();
                });
            }
            syncLanguagesSequentially();

        };

        /**
         * Sync a specific section (placeholder for future implementation)
         */


        /**
         * Start progress polling for the current job
         */
        vm.startProgressPolling = function () {
            if (!vm.currentJobId) return;

            var pollProgress = function () {
                UiTranslateFactory.getSyncProgress(vm.currentJobId).then(function (response) {
                    if (response) {
                        var jobData = response;
                        vm.syncProgress = jobData.progress || 0;
                        vm.syncStep = jobData.step || '';
                        vm.syncMessage = jobData.message || '';
                        vm.currentSectionName = '';
                        vm.sectionProgress = '';

                        // Parse section information from step
                        if (jobData.step && jobData.step.includes('Translating section:')) {
                            var sectionMatch = jobData.step.match(/Translating section: (\w+)/);
                            if (sectionMatch) {
                                vm.currentSectionName = sectionMatch[1];
                            }
                        }

                        // Parse section progress from message
                        if (jobData.message && jobData.message.includes('(')) {
                            var progressMatch = jobData.message.match(/\((\d+)\/(\d+)\)/);
                            if (progressMatch) {
                                vm.sectionProgress = progressMatch[1] + ' of ' + progressMatch[2] + ' sections';
                            }
                        }

                        console.log('Progress update:', jobData);

                        if (jobData.status === 'completed') {
                            vm.flexibleSyncInProgress = false;
                            vm.syncProgress = 100;
                            vm.syncStep = 'Completed';
                            vm.syncMessage = 'Translation sync completed successfully!';
                            vm.syncingLanguages[vm.currentTargetLocale] = false;

                            $rootScope.$broadcast('growl', {
                                type: 'success',
                                msg: 'Translation to ' + vm.getLanguageName(vm.currentTargetLocale) + ' completed successfully!'
                            });

                            // Refresh the unsync info
                            vm.loadUnsyncInfo();

                            // Refresh the current view if we're looking at translations
                            if (vm.data.length > 0) {
                                $timeout(function () {
                                    vm.getTrans();
                                }, 1000);
                            }

                        } else if (jobData.status === 'failed') {
                            vm.flexibleSyncInProgress = false;
                            vm.syncStep = 'Failed';
                            vm.syncMessage = jobData.error || 'Translation sync failed';
                            vm.syncingLanguages[vm.currentTargetLocale] = false;

                            $rootScope.$broadcast('growl', {
                                type: 'danger',
                                msg: 'Translation sync failed: ' + (jobData.error || 'Unknown error')
                            });

                        } else if (jobData.status === 'running' || jobData.status === 'pending') {
                            // Continue polling
                            $timeout(pollProgress, 2000);
                        }
                    }
                }).catch(function (error) {
                    console.error('Progress polling error:', error);
                    vm.flexibleSyncInProgress = false;
                    vm.syncStep = 'Error';
                    vm.syncMessage = 'Failed to get progress updates';
                });
            };

            // Start polling
            pollProgress();
        };

        /**
         * Wait for job completion (for sync all functionality)
         */
        vm.waitForJobCompletion = function (jobId, callback) {
            var pollForCompletion = function () {
                UiTranslateFactory.getSyncProgress(jobId).then(function (response) {
                    if (response) {
                        var jobData = response;

                        if (jobData.status === 'completed' || jobData.status === 'failed') {
                            callback();
                        } else {
                            $timeout(pollForCompletion, 2000);
                        }
                    } else {
                        callback(); // Continue anyway
                    }
                }).catch(function (error) {
                    callback(); // Continue anyway
                });
            };

            pollForCompletion();
        };


//save changes
        vm.changeTranslation = function (item) {
            if (confirm('Are you sure you want to save?')) {
                delete item._id;
                UiTranslateFactory.saveTranslation(item).then(function (data) {
                    if (data.ok) {
                        $rootScope.$broadcast('growl', {
                            type: 'success',
                            msg: 'Document ' + item.projectAlphaId + ' ' + item.locale + ' saved'
                        });
                        vm.copiesList = [];
                    }
                });
            }
        };

//creating a fully new document if such ID is not already used
        vm.makeNew = function () {
            if (vm.gettingForm.$valid) {
                var alphaId = prompt('Alphabetical name of the project', 'project');

                if (vm.id && vm.locale && alphaId) {
                    UiTranslateFactory.createTranslation({
                        'projectID': vm.id,
                        'locale': vm.locale,
                        'projectAlphaId': alphaId
                    }).then(function (data) {
                        if (data.status == 400) {
                            $rootScope.$broadcast('growl', {
                                type: 'danger',
                                msg: 'This project already has translation file. Use it please.'
                            });
                        } else {
                            $rootScope.$broadcast('growl', {
                                type: 'success',
                                msg: 'Document created'
                            });
                            vm.getTrans();
                        }
                    });
                }
            }
        };

// remove field from a group
        vm.deleteField = function (obj, key, def) {
            delete obj[key][def];
        };

// add field
        vm.addField = function (obj, key, newField) {
            if (obj[key][newField.toUpperCase()]) {
                console.error('field already exists!');
            } else {
                obj[key][newField.toUpperCase()] = '';
            }
        };

// delete group from a document
        vm.deleteGroup = function (obj, key) {
            console.log('deleted');
            delete obj[key];
        };

// add group
        vm.addGroup = function (obj, newGroup) {
            if (obj[newGroup.toUpperCase()]) {
                console.error('field already exists!');
            } else {
                obj[newGroup.toUpperCase()] = {};
            }
        };

// creating a local copy of document with new locale, should be saved after being filled in
        vm.makeCopy = function (item) {
            var newLang = prompt('Please enter the name of locale: ');
            var newItem = (JSON.parse(JSON.stringify(item)));
            if (newLang) {
                UiTranslateFactory.getTranslationItem(newItem.projectID, newLang).then(function (data) {
                    if (!data.length) {
                        newItem.locale = newLang;
                        vm.data.push(newItem);
                        $rootScope.$broadcast('growl', {
                            type: 'warning',
                            msg: "Document created locally! Don't forget to save it."
                        });
                    } else {
                        $rootScope.$broadcast('growl', {type: 'danger', msg: 'Such document already exists.'});
                    }
                });
            }
        };

// removing document from the main collection
        vm.removeDoc = function (item) {
            if (confirm('You are going to TOTALLY DELETE document ' + item.locale + ' of project ' + item.projectID + '-' + item.projectAlphaId)) {
                UiTranslateFactory.deleteTranslation(item.projectID, item.locale)
                    .then(function (data) {
                        var deleted = false;
                        if (data && typeof data === 'object') {
                            if (data.ok) {
                                deleted = true;
                            } else if (data.deleteResult && data.deleteResult.deletedCount > 0) {
                                deleted = true;
                            }
                        }
                        if (deleted) {
                            var index = vm.data.findIndex(function (doc) {
                                return doc.projectID == item.projectID && doc.locale == item.locale;
                            });
                            if (index > -1) {
                                vm.data.splice(index, 1);
                            }
                            if (vm.locale === item.locale && vm.id === item.projectID) {
                                vm.locale = '';
                                vm.id = '';
                                vm.chosen = null;
                                vm.data = [];
                            }
                            $rootScope.$broadcast('growl', {type: 'success', msg: 'Document has been deleted'});
                        } else {
                            $rootScope.$broadcast('growl', {
                                type: 'danger',
                                msg: 'Unexpected error: Could not delete document.'
                            });
                        }
                    })
                    .catch(function () {
                        var errorMsg = 'Unexpected error';
                        $rootScope.$broadcast('growl', {type: 'danger', msg: errorMsg});
                    });
            }
        };

// get aggregated list of available documents in backup collection
        vm.checkCopies = function () {
            UiTranslateFactory.getBackupsList().then(function (data) {
                vm.copiesList = data;
                vm.data = [];
            });
        };

// restore definite document from backup collection to main
        vm.restore = function (id, locale) {
            if (confirm('Are you sure you want to recover/replace the document with backup-copy?')) {
                UiTranslateFactory.restoreFromBackup(id, locale).then(function (data) {
                    if (data.ok) {
                        $rootScope.$broadcast('growl', {type: 'success', msg: 'Document recovered succesfuly!'});
                        vm.copiesList = [];
                        vm.id = id;
                        vm.locale = locale;
                        vm.init();
                    } else {
                        $rootScope.$broadcast('growl', {type: 'danger', msg: 'Unexpected error.'});
                    }
                });
            }
        };

        // ADD LANGUAGE FUNCTIONALITY

        /**
         * Open the add language modal
         */
        vm.openAddLanguageModal = function () {
            if (vm.chosen && !vm.showAddLanguageModal) {
                vm.showAddLanguageModal = true;
                vm.selectedLanguage = null;
                vm.loadCommonLanguages();
            } else if (!vm.chosen) {
                $rootScope.$broadcast('growl', {
                    type: 'danger',
                    msg: 'Please select a project first'
                });
            }
        };

        /**
         * Close the add language modal
         */
        vm.closeAddLanguageModal = function () {
            vm.showAddLanguageModal = false;
            vm.selectedLanguage = null;
            vm.addingLanguage = false;
        };

        /**
         * Load list of common languages
         */
        vm.loadCommonLanguages = function () {
            var availableLanguages = UiTranslateFactory.getAvailableLanguages();
            vm.availableLanguages = availableLanguages.filter(function (lang) {
                return vm.chosen.locales.indexOf(lang.code) === -1;
            });
        };

        /**
         * Add selected language to project
         */
        vm.addLanguageToProject = function () {
            if (!vm.selectedLanguage) {
                $rootScope.$broadcast('growl', {
                    type: 'warning',
                    msg: 'Please select a language first'
                });
                return;
            }

            vm.addingLanguage = true;

            // Store the selected language before making the API call
            var selectedLang = vm.selectedLanguage;

            var languageData = {
                projectID: vm.chosen.projectID,
                projectAlphaId: vm.chosen.projectAlphaId,
                targetLocale: selectedLang.code
            };

            console.log('Adding language:', languageData);

            UiTranslateFactory.addLanguageToProject(languageData).then(function (response) {
                console.log('Language added:', response);

                if (response) {
                    $rootScope.$broadcast('growl', {
                        type: 'success',
                        msg: 'Language ' + selectedLang.name + ' (' + selectedLang.code + ') successfully added to project ' + vm.chosen.projectAlphaId
                    });

                    // Add the new language to the current project's locales list
                    vm.chosen.locales.push(selectedLang.code);

                    // Refresh the project list to get updated data
                    vm.init();

                    // Close the modal
                    vm.closeAddLanguageModal();

                    // Set the new language as selected locale
                    vm.locale = selectedLang.code;

                } else {
                    $rootScope.$broadcast('growl', {
                        type: 'danger',
                        msg: 'Failed to add language'
                    });
                }
                vm.addingLanguage = false;
            }).catch(function (error) {
                console.error('Language addition error:', error);
                var errorMessage = 'Failed to add language';
                if (error.data && error.data.message) {
                    errorMessage = error.data.message;
                }
                $rootScope.$broadcast('growl', {
                    type: 'danger',
                    msg: errorMessage
                });
                vm.addingLanguage = false;
            });

        };


        vm.init();
    }
})()
