'use strict';
(function() {
    angular.module('app', ['ngResource', 'ui.bootstrap', 'ui.router']);

    angular.module('app').config(configure);
    angular.module('app').run(runBlock);

    configure.$inject = ['$httpProvider', '$stateProvider', '$urlRouterProvider'];
    runBlock.$inject = ['$rootScope', '$state', 'Auth'];

    function configure($httpProvider, $stateProvider, $urlRouterProvider) {
        $httpProvider.interceptors.push('TokenInterceptor');

        $urlRouterProvider.otherwise('/');
        $urlRouterProvider.when('', '/');

        $stateProvider
            .state('default', {
                url: '/',
                templateUrl: '/views/default.html'
            })
            .state('login', {
                url: '/login',
                templateUrl: '/views/login.html'
            })
            .state('uitranslates', {
                url: '/uitranslates',
                templateUrl: '/views/uitranslates.html'
            })
            .state('users', {
                url: '/users',
                templateUrl: '/views/users.html'
            });
    }

    function runBlock($rootScope, $state, Auth) {
        $rootScope.$on('$stateChangeStart', function (e, toState, toParams, fromState, fromParams) {
            console.log('Going: ' + toState.name);
            if (!Auth.isLogged && toState.name != 'login') {
                e.preventDefault();
                $state.go('login');
            }
            if (Auth.isLogged && toState.name == 'login') {
                e.preventDefault();
                $state.go('default');
            }
        });
    }
})();