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
                        $rootScope.$broadcast('growl', {type: 'success', msg: 'Переводы получены!'});
                    } else {
                        $rootScope.$broadcast('growl', {
                            type: 'danger',
                            msg: 'Подходящих файлов не найдено. Проверьте данные.'
                        });
                    }
                });
                vm.copiesList = [];
            }
        };

//save changes
        vm.changeTranslation = function (item) {
            if (confirm('Вы уверены, что хотите сохранить?')) {
                delete item._id;
                console.log(item);
                trans.save(item).$promise.then(function (data) {
                    console.log(data);
                    if (data.ok) {
                        $rootScope.$broadcast('growl', {
                            type: 'success',
                            msg: 'Документ ' + item.projectAlphaId + ' ' + item.locale + ' сохранен!'
                        });
                        vm.copiesList = [];
                    }
                });
            }
        };

//creating a fully new document if such ID is not already used
        vm.makeNew = function () {
            if (vm.gettingForm.$valid) {
                var alphaId = prompt('Буквенное название проекта', 'project');
                if (vm.id && vm.locale && alphaId) {
                    trans.put({
                        "projectID": vm.id,
                        "locale": vm.locale,
                        "projectAlphaId": alphaId
                    }).$promise.then(function (data) {
                        if (data.status == 400) {
                            $rootScope.$broadcast('growl', {
                                type: 'danger',
                                msg: 'Этот проект уже имеет как минимум 1 файл переводов!'
                            });
                        } else {
                            $rootScope.$broadcast('growl', {
                               type: 'success',
                                msg: 'Документ создан'
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
            if (obj[newGroup.toLowerCase()]) {
                console.error('field already exists!');
            } else {
                obj[newGroup.toLowerCase()] = {};
            }
        };
// creating a local copy of document with new locale, should be saved after being filled in
        vm.makeCopy = function (item) {
            var newLang = prompt('На какой язык переводим?: ');
            var newItem = (JSON.parse(JSON.stringify(item)));
            if (newLang) {
                trans.query({'projectID': newItem.projectID, 'locale': newLang}).$promise.then(function (data) {
                    if (!data.length) {
                        newItem.locale = newLang;
                        vm.data.push(newItem);
                        $rootScope.$broadcast('growl', {
                            type: 'warning',
                            msg: 'Документ создан локально. Не забудьте сохранить изменения!'
                        });
                    } else {
                        $rootScope.$broadcast('growl', {type: 'danger', msg: 'Такой документ уже существует.'});
                    }
                });
            }
        };
// removing document from the main collection
        vm.removeDoc = function (item) {
            if (confirm('Вы собираетесь ПОЛНОСТЬЮ удалить файл переводов ' + item.locale + ' для проекта ' + item.projectID + '-' + item.projectAlphaId)) {
                trans.delete(item).$promise.then(function (data) {
                    console.log(data);
                    if (data.ok) {
                        var index = vm.data.indexOf(item);
                        vm.data.splice(index, 1);
                        $rootScope.$broadcast('growl', {type: 'success', msg: 'Документ успешно удален.'});
                    } else {
                        $rootScope.$broadcast('growl', {type: 'danger', msg: 'Произошла непредвиденная ошибка.'});
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
            if (confirm('Вы хотите восстановить/заменить основной документ резервной копией?')) {
                restore.save({"projectID": id, "locale": locale}).$promise.then(function (data) {
                    console.log(data);
                    if (data.ok) {
                        $rootScope.$broadcast('growl', {type: 'success', msg: 'Документ успешно восстановлен!'});
                        vm.copiesList = [];
                        vm.id = id; vm.locale=locale;
                        vm.init();
                    } else {
                        $rootScope.$broadcast('growl', {type: 'danger', msg: 'Произошла непредвиденная ошибка.'});
                    }
                });
            }
        };

        vm.init();
    }
})();