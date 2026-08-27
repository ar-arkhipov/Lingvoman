'use strict';

(function() {
    angular
        .module('app')
        .controller('LoginCtrl', LoginCtrl);

    LoginCtrl.$inject = ['$window', 'Auth', 'UserAuthFactory', '$rootScope'];

    function LoginCtrl($window, Auth, UserAuthFactory, $rootScope) {
        var vm = this;

        vm.user = {};

        vm.login = function () {
            var username = vm.user.username;
            var password = vm.user.password;

            if (username !== undefined && password !== undefined) {
                UserAuthFactory.login(username, password).$promise.then(function (data) {

                    if (data && data.token) {
                        $window.sessionStorage.token = data.token;
                        $window.sessionStorage.role = data.user.role;
                        $window.sessionStorage.name = data.user.name;
                        Auth.isLogged = true;
                        console.log('logged in', data.token);
                        $window.location.reload();
                    } else {
                        console.log('Login failed - no token received');
                        $rootScope.$broadcast('growl', {
                            type: 'danger', 
                            msg: 'Login failed - invalid credentials'
                        });
                    }
                }).catch(function(error) {
                    console.log('Login error:', error);
                    var errorMessage = 'Login failed';
                    if (error.data && error.data.message) {
                        errorMessage = error.data.message;
                    }
                    $rootScope.$broadcast('growl', {
                        type: 'danger', 
                        msg: errorMessage
                    });
                });
            } else {
                console.log('EMPTY FIELD!');
                $rootScope.$broadcast('growl', {
                    type: 'warning', 
                    msg: 'Please fill in both username and password'
                });
            }
        };
    }
})();
