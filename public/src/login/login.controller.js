'use strict';

(function() {
    angular
        .module('app')
        .controller('LoginCtrl', LoginCtrl);

    LoginCtrl.$inject = ['$window', 'Auth', 'UserAuthFactory', '$rootScope'];

    function LoginCtrl($window, Auth, UserAuthFactory, $rootScope) {
        const vm = this;

        vm.user = {};

        vm.login = function () {
            const username = vm.user.username;
            const password = vm.user.password;

            if (username !== undefined && password !== undefined) {
                UserAuthFactory.login(username, password).$promise.then(function (data) {
                    if (data.token) {
                        $window.sessionStorage.token = data.token;
                        $window.sessionStorage.role = data.user.role;
                        $window.sessionStorage.name = data.user.name;
                        Auth.isLogged = true;
                        console.log('logged in', data.token);
                        $window.location.reload();
                    }
                });
            } else {
                console.log('EMPTY FIELD!');
            }
        };
    }
})();
