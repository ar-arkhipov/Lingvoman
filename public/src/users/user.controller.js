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
            query: {
                method: 'GET',
                isArray: true
            },
            put: {
                method: 'PUT'
            },
            delete: {
                method: 'DELETE'
            }
        });

        vm.getUsers = function () {
            users.query().$promise.then(function (data) {
                console.log('Users data:', data);
                vm.usersList = data;
            }).catch(function(error) {
                console.log('Error loading users:', error);
                $rootScope.$broadcast('growl', {
                    type: 'danger',
                    msg: 'Failed to load users'
                });
            });
        };

        vm.createUser = function () {
            if(vm.creationForm.$valid) {
                users.put(vm.newUser).$promise.then(function (data) {
                    console.log('Create user response:', data);
                    
                    vm.getUsers();
                    
                    $rootScope.$broadcast('growl', {
                        type: 'success',
                        msg: 'User created successfully'
                    });
                    
                    // Reset form
                    vm.newUser = {
                        username: '',
                        password: '',
                        userObj: {
                            name: '',
                            role: ''
                        }
                    };
                }).catch(function(error) {
                    console.log('Create user error:', error);
                    var errorMessage = 'Failed to create user';
                    if (error.data && error.data.error && error.data.error.message) {
                        errorMessage = error.data.error.message;
                    }
                    $rootScope.$broadcast('growl', {
                        type: 'danger',
                        msg: errorMessage
                    });
                });
            } else {
                $rootScope.$broadcast('growl', {
                    type:'danger',
                    msg:'Invalid form'
                });
            }
        };

        vm.chooseRole = function (role) {
            vm.newUser.userObj.role = role;
        };

        vm.deleteUser = function (user, username) {
            if (confirm('Are you sure you want to delete user ' + username + ' ?')) {
                users.delete({username: username}).$promise.then(function (data) {
                    console.log('Delete user response:', data);

                    if (data.ok) {
                        var index = vm.usersList.indexOf(user);
                        vm.usersList.splice(index, 1);
                        $rootScope.$broadcast('growl', {
                            type: 'success',
                            msg: 'User deleted successfully'
                        });
                    } else {
                        $rootScope.$broadcast('growl', {
                            type: 'danger',
                            msg: 'Failed to delete user'
                        });
                    }
                }).catch(function(error) {
                    console.log('Delete user error:', error);
                    var errorMessage = 'Failed to delete user';
                    if (error.data && error.data.error && error.data.error.message) {
                        errorMessage = error.data.error.message;
                    }
                    $rootScope.$broadcast('growl', {
                        type: 'danger',
                        msg: errorMessage
                    });
                });
            }
        };

        vm.getUsers();
    }
})();
