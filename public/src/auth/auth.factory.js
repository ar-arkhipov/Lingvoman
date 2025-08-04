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

    UserAuthFactory.$inject = ['$window', '$resource', 'Auth', 'APP_CONFIG'];

    function UserAuthFactory($window, $resource, Auth, APP_CONFIG) {
        return {
            login: function(username, password) {
                var loginRes = $resource(APP_CONFIG.getBaseUrl() + '/login', {}, {
                    save: {
                        method: 'POST'
                    }
                });

                return loginRes.save({
                    username: username,
                    password: password
                });
            },

            logout: function() {
                if (Auth.isLogged) {
                    delete $window.sessionStorage.token;
                }
            }
        };
    }
})();
