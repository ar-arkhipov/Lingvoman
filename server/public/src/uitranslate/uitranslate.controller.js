'use strict';
(function() {
    angular
        .module('app')
        .controller('UiTranslatesCtrl', UiTranslatesCtrl);

    UiTranslatesCtrl.$inject = ['$resource', '$rootScope', '$window'];

    function UiTranslatesCtrl($resource, $rootScope, $window) {
        var vm = this;
        vm.id = '';
        vm.locale = '';
        vm.data = [];
        vm.copiesList = [];

//resource list
        var initial = $resource('/api/uitranslate/list');
        var trans = $resource('/api/uitranslate/item', {}, {
            put: {method: 'PUT'}
        });
        var restore = $resource('/api/uitranslate/backup');

//receiving information about available translations (id, locale)
        vm.init = function () {
            initial.query().$promise.then(function (data) {
                console.log(data);
                vm.initList = data;
            });
        };

//set id according to chosen project
        vm.chooseProject = function (project) {
            vm.id = project.projectID;
            vm.chosen = project;
        };

//get a definite translations json from main collection
        vm.getTrans = function () {
            if (vm.gettingForm.$valid) {
                trans.query({'projectID': vm.id, 'locale': vm.locale}).$promise.then(function (data) {
                    console.log(data);
                    vm.data = data;
                    for (var n = 0; n < vm.data.length; n++) {
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
                        "projectID": vm.id,
                        "locale": vm.locale,
                        "projectAlphaId": alphaId
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
                    })
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
            })
        };
// restore definite document from backup collection to main
        vm.restore = function (id, locale) {
            if (confirm('Are you sure you want to recover/replace the document with backup-copy?')) {
                restore.save({"projectID": id, "locale": locale}).$promise.then(function (data) {
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

        vm.init();
    }
})();