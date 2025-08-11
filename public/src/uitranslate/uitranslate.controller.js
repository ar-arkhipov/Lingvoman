'use strict';

(function() {
    angular
        .module('app')
        .controller('UiTranslatesCtrl', UiTranslatesCtrl);

    UiTranslatesCtrl.$inject = [
        'UiTranslateFactory', '$rootScope', '$window', '$timeout',
        'SyncProgressService', 'FlexibleSyncService', 'ModalService', 'ProjectService',
        'TranslationService', 'BackupService', 'LanguageUtils'
    ];

    function UiTranslatesCtrl(
        UiTranslateFactory, $rootScope, $window, $timeout,
        SyncProgressService, FlexibleSyncService, ModalService, ProjectService,
        TranslationService, BackupService, LanguageUtils
    ) {
        // --- SYNC HELPERS ---

        /**
         * Start sync for a single language, returns Promise with jobId
         */
        // Synchronization logic for translations has been refactored and moved to FlexibleSyncService and SyncProgressService.
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
            return LanguageUtils.getLanguageName(code);
        };

//receiving information about available translations (id, locale)
        vm.init = function () {
            ProjectService.getProjectsList().then(function (data) {
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
            ModalService.hideAddLanguageModal();
        };

//get a definite translations json from main collection
        vm.getTrans = function () {
            if (vm.gettingForm.$valid) {
                TranslationService.getTrans(vm.id, vm.locale).then(function (data) {
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
                // Recalculate progress on the client to ensure consistency
                try {
                    if (vm.unsyncedInfo && vm.unsyncedInfo.sourceInfo && vm.unsyncedInfo.targetLanguages) {
                        var totalSourceKeys = vm.unsyncedInfo.sourceInfo.totalKeys || 0;
                        angular.forEach(vm.unsyncedInfo.targetLanguages, function(langInfo) {
                            if (!langInfo) return;
                            var missing = langInfo.totalMissingKeys || 0;
                            var extra = langInfo.totalExtraKeys || 0;
                            var matched = Math.max(0, totalSourceKeys - missing);
                            var denom = Math.max(1, totalSourceKeys + extra);
                            langInfo.syncProgress = Math.max(0, Math.min(100, Math.floor((matched / denom) * 100)));
                            langInfo.needsSync = missing > 0 || extra > 0;
                        });
                    }
                } catch (e) {
                    console.warn('Progress recompute failed:', e);
                }
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
            FlexibleSyncService.syncOneLanguage(vm, targetLocale, function(jobData) {
                // Update UI for each poll
                vm.languageProgress[targetLocale].progress = jobData.progress || 0;
                vm.languageProgress[targetLocale].step = jobData.step || '';
                vm.languageProgress[targetLocale].message = jobData.message || '';
                if (vm.unsyncedInfo && vm.unsyncedInfo.targetLanguages && vm.unsyncedInfo.targetLanguages[targetLocale]) {
                    vm.unsyncedInfo.targetLanguages[targetLocale].syncProgress = jobData.progress || 0;
                    // If completed, update state
                    if (jobData.progress === 100 || jobData.status === 'completed') {
                        vm.unsyncedInfo.targetLanguages[targetLocale].needsSync = false;
                        vm.unsyncedInfo.targetLanguages[targetLocale].syncProgress = 100;
                    }
                }
                if (!$rootScope.$$phase) {
                    $rootScope.$apply();
                }
            });
        };

        /**
         * Sync all languages that need syncing
         */
        vm.syncAllLanguages = function () {
            FlexibleSyncService.syncAllLanguages(vm);
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
                TranslationService.changeTranslation(item).then(function (data) {
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
                    TranslationService.makeNew(vm.id, vm.locale, alphaId).then(function (data) {
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
            if (newLang) {
                TranslationService.makeCopy(item, newLang).then(function (newItem) {
                    if (newItem) {
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
                TranslationService.removeDoc(item.projectID, item.locale)
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
            BackupService.checkCopies().then(function (data) {
                vm.copiesList = data;
                vm.data = [];
            });
        };

// restore definite document from backup collection to main
        vm.restore = function (id, locale) {
            if (confirm('Are you sure you want to recover/replace the document with backup-copy?')) {
                BackupService.restore(id, locale).then(function (data) {
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
            if (vm.chosen && !ModalService.isAddLanguageModalVisible()) {
                ModalService.showAddLanguageModal();
                vm.selectedLanguage = null;
                vm.loadCommonLanguages();
            } else if (!vm.chosen) {
                $rootScope.$broadcast('growl', {
                    type: 'danger',
                    msg: 'Please select a project first'
                });
            }
        };

        // Getter for modal visibility
        vm.isAddLanguageModalVisible = function () {
            return ModalService.isAddLanguageModalVisible();
        };

        /**
         * Close the add language modal
         */
        vm.closeAddLanguageModal = function () {
            ModalService.hideAddLanguageModal();
            vm.selectedLanguage = null;
            vm.addingLanguage = false;
        };

        /**
         * Load list of common languages
         */
        vm.loadCommonLanguages = function () {
            var availableLanguages = LanguageUtils.getAvailableLanguages();
            vm.availableLanguages = ProjectService.loadCommonLanguages(vm.chosen, availableLanguages);
        };

        /**
         * Quick check used by navbar to decide if "Add Language" should be shown
         */
        vm.canAddLanguage = function () {
            if (!vm.chosen) return false;
            var availableLanguages = LanguageUtils.getAvailableLanguages();
            var remaining = ProjectService.loadCommonLanguages(vm.chosen, availableLanguages);
            return Array.isArray(remaining) && remaining.length > 0;
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
