'use strict';

(function() {
    angular
        .module('app')
        .factory('Auth', Auth);

    Auth.$inject = ['$window'];

    function Auth($window) {
        const auth = {
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
            login (username, password) {
                const loginRes = $resource('/login');

                return loginRes.save({
                    username,
                    password
                });
            },

            logout () {
                if (Auth.isLogged) {
                    delete $window.sessionStorage.token;
                }
            }
        };
    }
})();
