'use strict';
(function() {
    angular
        .module('app')
        .factory('TokenInterceptor', TokenInterceptor);

    TokenInterceptor.$inject = ['$window', '$rootScope'];

    function TokenInterceptor($window, $rootScope) {
        return {
            request: function (req) {
                if ($window.sessionStorage.token) {
                    req.headers['x-access-token'] = $window.sessionStorage.token;
                }
                return req;
            },

            responseError: function (resp) {
                if ([400, 401].indexOf(resp.status) !== -1 && resp.data.message) {
                    $rootScope.$broadcast('growl', {type: 'danger', msg: resp.data.message});
                } else {
                    $rootScope.$broadcast('growl', {type: 'danger', msg: 'Unexpected error'});
                }
                return resp;
            }
        }
    }
})();