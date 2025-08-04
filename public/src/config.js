'use strict';

(function() {
    angular
        .module('app')
        .constant('APP_CONFIG', {
            // Get base URL for API calls
            getBaseUrl: function() {
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    return 'http://localhost:1337';
                }
                return 'https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/dev';
            },
            
            // Get timeout for API calls
            getTimeout: function() {
                return 900000; // 15 minutes
            }
        });
})(); 