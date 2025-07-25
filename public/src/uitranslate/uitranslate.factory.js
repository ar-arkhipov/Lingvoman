'use strict';

(function() {
    angular
        .module('app')
        .factory('UiTranslateFactory', UiTranslateFactory);

    UiTranslateFactory.$inject = ['$resource'];

    function UiTranslateFactory($resource) {
        
        // API Resources
        var initial = $resource('/api/uitranslate/list', {}, {
            query: {
                method: 'GET',
                isArray: true
            }
        });

        var trans = $resource('/api/uitranslate/item', {}, {
            query: {
                method: 'GET',
                isArray: false
            },
            save: {
                method: 'POST'
            },
            put: {
                method: 'PUT'
            },
            delete: {
                method: 'DELETE'
            }
        });

        var restore = $resource('/api/uitranslate/backup', {}, {
            query: {
                method: 'GET',
                isArray: true
            },
            save: {
                method: 'POST'
            }
        });

        var flexibleSync = $resource('/api/uitranslate/sync-flexible', {}, {
            save: {
                method: 'POST'
            }
        });

        var syncProgress = $resource('/api/uitranslate/sync-progress/:jobId', {jobId: '@jobId'}, {
            get: {
                method: 'GET'
            }
        });

        var projectLanguages = $resource('/api/uitranslate/languages/:projectID', {projectID: '@projectID'}, {
            query: {
                method: 'GET'
            }
        });

        var unsyncInfo = $resource('/api/uitranslate/unsync-info/:projectID', {projectID: '@projectID'}, {
            query: {
                method: 'GET'
            }
        });

        var addLanguage = $resource('/api/uitranslate/add-language', {}, {
            save: {
                method: 'POST'
            }
        });

        return {
            // Project management
            getProjectsList: function() {
                return initial.query().$promise.then(function(response) {
                    console.log('Projects list response:', response);
                    // Handle both array and object responses
                    if (Array.isArray(response)) {
                        return response;
                    } else if (response && Array.isArray(response.data)) {
                        return response.data;
                    } else {
                        console.warn('Unexpected projects response format:', response);
                        return [];
                    }
                }).catch(function(error) {
                    console.error('Projects fetch error:', error);
                    return [];
                });
            },

            // Translation management
            getTranslationItem: function(projectID, locale) {
                return trans.query({projectID: projectID, locale: locale}).$promise.then(function(response) {
                    console.log('Translation response:', response);
                    // Handle both array and object responses
                    if (Array.isArray(response)) {
                        return response;
                    } else if (response && Array.isArray(response.data)) {
                        return response.data;
                    } else {
                        console.warn('Unexpected response format:', response);
                        return [];
                    }
                }).catch(function(error) {
                    console.error('Translation fetch error:', error);
                    return [];
                });
            },

            saveTranslation: function(translationData) {
                return trans.save(translationData).$promise;
            },

            createTranslation: function(translationData) {
                return trans.put(translationData).$promise;
            },

            deleteTranslation: function(projectID, locale) {
                return trans.delete({projectID: projectID, locale: locale}).$promise;
            },

            // Backup management
            getBackupsList: function() {
                return restore.query().$promise.then(function(response) {
                    console.log('Backups list response:', response);
                    // Handle both array and object responses
                    if (Array.isArray(response)) {
                        return response;
                    } else if (response && Array.isArray(response.data)) {
                        return response.data;
                    } else {
                        console.warn('Unexpected backups response format:', response);
                        return [];
                    }
                }).catch(function(error) {
                    console.error('Backups fetch error:', error);
                    return [];
                });
            },

            restoreFromBackup: function(projectID, locale) {
                return restore.save({projectID: projectID, locale: locale}).$promise;
            },

            // Sync management
            startFlexibleSync: function(syncData) {
                return flexibleSync.save(syncData).$promise;
            },

            getSyncProgress: function(jobId) {
                return syncProgress.get({jobId: jobId}).$promise;
            },

            getProjectLanguages: function(projectID) {
                return projectLanguages.query({projectID: projectID}).$promise.then(function(response) {
                    console.log('Project languages response:', response);
                    // Handle both array and object responses
                    if (Array.isArray(response)) {
                        return response;
                    } else if (response && Array.isArray(response.data)) {
                        return response.data;
                    } else {
                        console.warn('Unexpected project languages response format:', response);
                        return [];
                    }
                }).catch(function(error) {
                    console.error('Project languages fetch error:', error);
                    return [];
                });
            },

            getUnsyncInfo: function(projectID) {
                return unsyncInfo.query({projectID: projectID}).$promise.then(function(response) {
                    console.log('Unsync info response:', response);
                    // Handle both array and object responses
                    if (Array.isArray(response)) {
                        return response;
                    } else if (response && Array.isArray(response.data)) {
                        return response.data;
                    } else {
                        console.warn('Unexpected unsync info response format:', response);
                        return [];
                    }
                }).catch(function(error) {
                    console.error('Unsync info fetch error:', error);
                    return [];
                });
            },

            // Language management
            addLanguageToProject: function(languageData) {
                return addLanguage.save(languageData).$promise;
            },

            // Utility methods
            getAvailableLanguages: function() {
                return [
                    { code: 'en', name: 'English', nativeName: 'English' },
                    { code: 'ja', name: 'Japanese', nativeName: '日本語' }
                ];
            },

            getLanguageName: function(code) {
                var languages = this.getAvailableLanguages();
                var language = languages.find(function(lang) {
                    return lang.code === code;
                });
                return language ? language.name : code.toUpperCase();
            }
        };
    }
})(); 