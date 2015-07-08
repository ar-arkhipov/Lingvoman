'use strict';
(function() {
    angular
        .module('app')
        .controller('UsersCtrl', UsersCtrl);

    UsersCtrl.$inject = ['$resource', '$rootScope'];

    function UsersCtrl($resource, $rootScope) {
        var vm = this;

        vm.newUser = {
            username: '',
            password: '',
            userObj: {
                name: '',
                role: ''
            }
        };

        vm.usersList = [];
        vm.rolesList = ['admin', 'translater'];

        var users = $resource('/api/users', {}, {
            put: {method: 'PUT'}
        });

        vm.getUsers = function () {
            users.query().$promise.then(function (data) {
                console.log(data);
                vm.usersList = data;
            });
        };

        vm.createUser = function () {
            if(vm.creationForm.$valid) {
                users.put(vm.newUser).$promise.then(function (data) {
                    vm.getUsers();
                    console.log(data);
                    if(data.status != 400)
                    $rootScope.$broadcast('growl', {
                        type: "success",
                        msg: "Пользователь создан"
                    });
                });
            } else {
                $rootScope.$broadcast('growl', {
                    type:'danger',
                    msg:'Форма заполнена не корректно'
                });
            }
        };

        vm.chooseRole = function (role) {
            vm.newUser.userObj.role = role;
        };

        vm.deleteUser = function (user, username) {
            if (confirm('Вы уверены, что хотите удалить пользователя ' + username + ' ?')) {
                users.delete({username: username}).$promise.then(function (data) {
                    console.log(data);
                    if (data.ok) {
                        var index = vm.usersList.indexOf(user);
                        vm.usersList.splice(index, 1);
                        $rootScope.$broadcast('growl', {
                            type: "success",
                            msg: "Пользователь удален"
                        });
                    } else {
                        $rootScope.$broadcast(('growl', {
                            type: "danger",
                            msg: "Не удалось удалить пользователя."
                        }));
                    }
                });
            }
        };

        vm.getUsers();
    }
})();
