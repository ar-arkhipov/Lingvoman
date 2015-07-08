'use strict';
(function() {
    angular
        .module('app')
        .factory('Auth', Auth);

    Auth.$inject = ['$window'];

    function Auth($window) {
        var auth = {
            isLogged: (function () {
                return !!$window.sessionStorage.token;
            }())
        };
        console.log(auth);
        return auth;
    }

    angular
        .module('app')
        .factory('UserAuthFactory', UserAuthFactory);

    UserAuthFactory.$inject = ['$window', '$resource', 'Auth'];

    function UserAuthFactory($window, $resource, Auth) {
        return {
            login: function (username, password) {
                var loginRes = $resource('/login');
                return loginRes.save({
                    username: username,
                    password: password
                });
            },

            logout: function () {
                if (Auth.isLogged) {
                    delete $window.sessionStorage.token;
                }
            }
        }
    }
})();
