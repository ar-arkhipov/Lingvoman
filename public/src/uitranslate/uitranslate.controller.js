'use strict';

(function() {
    angular
        .module('app')
        .controller('UiTranslatesCtrl', UiTranslatesCtrl);

    UiTranslatesCtrl.$inject = ['$resource', '$rootScope', '$window', '$timeout'];

    function UiTranslatesCtrl($resource, $rootScope, $window, $timeout) {
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

        // ADD LANGUAGE MODAL VARIABLES
        vm.showAddLanguageModal = false;
        vm.availableLanguages = [];
        vm.selectedLanguage = null;
        vm.addingLanguage = false;

//resource list
        var initial = $resource('/api/uitranslate/list');
        var trans = $resource('/api/uitranslate/item', {}, {
            put: {method: 'PUT'}
        });
        var restore = $resource('/api/uitranslate/backup');
        // FLEXIBLE TRANSLATION RESOURCES
        var flexibleSync = $resource('/api/uitranslate/sync-flexible');
        var syncProgress = $resource('/api/uitranslate/sync-progress/:jobId', {jobId: '@jobId'});
        var projectLanguages = $resource('/api/uitranslate/languages/:projectID', {projectID: '@projectID'}, {
            query: {
                method: 'GET',
                transformResponse: function(data) {
                    var response = JSON.parse(data);
                    return response.status === 'success' ? response.data : null;
                }
            }
        });
        var unsyncInfo = $resource('/api/uitranslate/unsync-info/:projectID', {projectID: '@projectID'}, {
            query: {
                method: 'GET',
                transformResponse: function(data) {
                    var response = JSON.parse(data);
                    return response.status === 'success' ? response.data : null;
                }
            }
        });
        // ADD LANGUAGE RESOURCES
        var addLanguage = $resource('/api/uitranslate/add-language', {}, {
            save: {
                method: 'POST',
                transformResponse: function(data) {
                    var response = JSON.parse(data);
                    return response.status === 'success' ? response : { status: 'error', message: response.message || 'Unknown error' };
                }
            }
        });

        // Hardcoded languages array - no API calls needed
        var availableLanguages = [
            { code: 'en', name: 'English', nativeName: 'English' },
            { code: 'ja', name: 'Japanese', nativeName: '日本語' }
        ];

        /**
         * Get language name by code
         */
        vm.getLanguageName = function(code) {
            var language = availableLanguages.find(function(lang) {
                return lang.code === code;
            });
            return language ? language.name : code.toUpperCase();
        };

//receiving information about available translations (id, locale)
        vm.init = function () {
            console.log('Initializing UiTranslatesCtrl...');
            initial.query().$promise.then(function (data) {
                console.log(data);
                vm.initList = data;
            });
        };

//set id according to chosen project
        vm.chooseProject = function (project) {
            vm.id = project.projectID;
            vm.chosen = project;
            
            console.log('Project chosen:', project); // Debug log
            console.log('Available locales:', project.locales); // Debug log
            
            // Set first available locale as default
            if (project.locales && project.locales.length > 0) {
                vm.locale = project.locales[0];
                console.log('Set locale to', vm.locale); // Debug log
            }
            
            // Force Angular to update the view safely
            // $timeout(function() {
            //     // This ensures the view is updated
            // }, 0);
        };

//get a definite translations json from main collection
        vm.getTrans = function () {
            if (vm.gettingForm.$valid) {
                trans.query({'projectID': vm.id, 'locale': vm.locale}).$promise.then(function (data) {
                    console.log(data);
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

            unsyncInfo.query({
                projectID: vm.chosen.projectID
            }).$promise.then(function (unsyncData) {
                // unsyncData is now the transformed data directly
                vm.unsyncedInfo = unsyncData;
                console.log('Unsync info:', vm.unsyncedInfo);
            }).catch(function (error) {
                console.error('Error loading unsync info:', error);
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

            var syncData = {
                projectID: vm.chosen.projectID,
                projectAlphaId: vm.chosen.projectAlphaId,
                targetLocale: targetLocale,
                sourceLocale: vm.unsyncedInfo.sourceLocale
            };

            console.log('Starting language sync:', syncData);

            flexibleSync.save(syncData).$promise.then(function (response) {
                console.log('Language sync started:', response);
                
                if (response.status === 'success') {
                    vm.currentJobId = response.jobId;
                    vm.syncMessage = response.message;
                    vm.flexibleSyncInProgress = true;
                    vm.startProgressPolling();
                } else {
                    vm.syncingLanguages[targetLocale] = false;
                    $rootScope.$broadcast('growl', {
                        type: 'danger',
                        msg: 'Failed to start sync: ' + response.message
                    });
                }
            }).catch(function (error) {
                console.error('Language sync error:', error);
                vm.syncingLanguages[targetLocale] = false;
                $rootScope.$broadcast('growl', {
                    type: 'danger',
                    msg: 'Failed to start sync: ' + (error.data && error.data.message ? error.data.message : 'Network error')
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
            var currentIndex = 0;

            var syncNextLanguage = function () {
                if (currentIndex >= languagesToSync.length) {
                    vm.flexibleSyncInProgress = false;
                    $rootScope.$broadcast('growl', {
                        type: 'success',
                        msg: 'All languages synced successfully!'
                    });
                    vm.loadUnsyncInfo(); // Refresh the list
                    return;
                }

                var targetLocale = languagesToSync[currentIndex];
                vm.currentTargetLocale = targetLocale;
                vm.syncingLanguages[targetLocale] = true;

                var syncData = {
                    projectID: vm.chosen.projectID,
                    projectAlphaId: vm.chosen.projectAlphaId,
                    targetLocale: targetLocale,
                    sourceLocale: vm.unsyncedInfo.sourceLocale
                };

                flexibleSync.save(syncData).$promise.then(function (response) {
                    if (response.status === 'success') {
                        vm.currentJobId = response.jobId;
                        // Wait for this job to complete before starting next
                        vm.waitForJobCompletion(response.jobId, function () {
                            vm.syncingLanguages[targetLocale] = false;
                            currentIndex++;
                            syncNextLanguage();
                        });
                    } else {
                        vm.syncingLanguages[targetLocale] = false;
                        currentIndex++;
                        syncNextLanguage();
                    }
                }).catch(function (error) {
                    vm.syncingLanguages[targetLocale] = false;
                    currentIndex++;
                    syncNextLanguage();
                });
            };

            syncNextLanguage();
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
                syncProgress.get({
                    jobId: vm.currentJobId
                }).$promise.then(function (response) {
                    if (response.status === 'success') {
                        var jobData = response.data;
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
                syncProgress.get({
                    jobId: jobId
                }).$promise.then(function (response) {
                    if (response.status === 'success') {
                        var jobData = response.data;
                        
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
                console.log(item);
                trans.save(item).$promise.then(function (data) {
                    console.log(data);

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
                    trans.put({
                        'projectID': vm.id,
                        'locale': vm.locale,
                        'projectAlphaId': alphaId
                    }).$promise.then(function (data) {
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
                trans.query({'projectID': newItem.projectID, 'locale': newLang}).$promise.then(function (data) {
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
                trans.delete(item).$promise.then(function (data) {
                    console.log(data);

                    if (data.ok) {
                        var index = vm.data.indexOf(item);

                        vm.data.splice(index, 1);
                        $rootScope.$broadcast('growl', {type: 'success', msg: 'Document has been deleted'});
                    } else {
                        $rootScope.$broadcast('growl', {type: 'danger', msg: 'Unexpected error'});
                    }
                });
            }
        };

// get aggregated list of available documents in backup collection
        vm.checkCopies = function () {
            restore.query({}).$promise.then(function (data) {
                console.log(data);
                vm.copiesList = data;
                vm.data = [];
            });
        };

// restore definite document from backup collection to main
        vm.restore = function (id, locale) {
            if (confirm('Are you sure you want to recover/replace the document with backup-copy?')) {
                restore.save({'projectID': id, locale: locale}).$promise.then(function (data) {
                    console.log(data);

                    if (data.ok) {
                        $rootScope.$broadcast('growl', {type: 'success', msg: 'Document recovered succesfuly!'});
                        vm.copiesList = [];
                        vm.id = id; vm.locale=locale;
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
        vm.openAddLanguageModal = function() {
            if (vm.chosen) {
                console.log('Opening add language modal');
                console.log('Current project:', vm.chosen);
                vm.showAddLanguageModal = true;
                vm.selectedLanguage = null;
                vm.loadCommonLanguages();
            } else {
                $rootScope.$broadcast('growl', {
                    type: 'danger',
                    msg: 'Please select a project first'
                });
            }
        };

        /**
         * Close the add language modal
         */
        vm.closeAddLanguageModal = function() {
            vm.showAddLanguageModal = false;
            vm.selectedLanguage = null;
            vm.addingLanguage = false;
        };

        /**
         * Load list of common languages
         */
        vm.loadCommonLanguages = function() {
            console.log('Loading common languages...');
            console.log('Current project locales:', vm.chosen.locales);
            
            // Hardcoded languages array - no API calls needed
            var availableLanguages = [
                { code: 'en', name: 'English', nativeName: 'English' },
                { code: 'ja', name: 'Japanese', nativeName: '日本語' }
            ];

            console.log('Common languages loaded:', availableLanguages);
            console.log('Languages before filtering:', availableLanguages);
            
            // languages is now the transformed array directly
            vm.availableLanguages = availableLanguages.filter(function(lang) {
                var isAvailable = vm.chosen.locales.indexOf(lang.code) === -1;
                console.log('Language ' + lang.code + ' available: ' + isAvailable);
                return isAvailable;
            });
            
            console.log('Available languages after filtering:', vm.availableLanguages);
        };

        /**
         * Add selected language to project
         */
        vm.addLanguageToProject = function() {
            console.log('addLanguageToProject called');
            console.log('selectedLanguage:', vm.selectedLanguage);
            console.log('availableLanguages:', vm.availableLanguages);
            
            if (!vm.selectedLanguage) {
                console.log('No language selected!');
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

            addLanguage.save(languageData).$promise.then(function(response) {
                console.log('Language added:', response);
                
                if (response.status === 'success') {
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
                        msg: 'Failed to add language: ' + response.message
                    });
                }
                
                vm.addingLanguage = false;
                
            }).catch(function(error) {
                console.error('Language addition error:', error);
                var errorMessage = 'Failed to add language';
                if (error.data && error.data.message) {
                    errorMessage += ': ' + error.data.message;
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
})();
