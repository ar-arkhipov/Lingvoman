'use strict';

(function() {
    angular
        .module('app')
        .factory('TokenInterceptor', TokenInterceptor);

    TokenInterceptor.$inject = ['$window', '$rootScope', '$injector'];

    function TokenInterceptor($window, $rootScope, $injector) {
        return {
            request: function(req) {
                if ($window.sessionStorage.token) {
                    req.headers['x-access-token'] = $window.sessionStorage.token;
                }

                return req;
            },

            responseError: function(resp) {
                var errorMessage = 'Unexpected error';
                
                // Handle simple error response format
                if (resp.data && resp.data.message) {
                    errorMessage = resp.data.message;
                }

                // Handle 401 authentication errors specially
                if (resp.status === 401) {
                    console.log('401 Unauthorized - clearing session and redirecting to login');
                    
                    // Clear session storage
                    delete $window.sessionStorage.token;
                    delete $window.sessionStorage.role;
                    delete $window.sessionStorage.name;
                    
                    // Update Auth service
                    var Auth = $injector.get('Auth');
                    Auth.isLogged = false;
                    
                    // Show error message
                    $rootScope.$broadcast('growl', {
                        type: 'danger', 
                        msg: 'Session expired. Please login again.'
                    });
                    
                    // Redirect to login page
                    var $state = $injector.get('$state');
                    $state.go('login');
                    
                } else if ([400, 403, 422].indexOf(resp.status) !== -1) {
                    $rootScope.$broadcast('growl', {type: 'danger', msg: errorMessage});
                } else {
                    $rootScope.$broadcast('growl', {type: 'danger', msg: errorMessage});
                }

                return resp;
            }
        };
    }
})();