'use strict';

(function() {
    angular
        .module('app')
        .controller('ApplicationCtrl', ApplicationCtrl);

    ApplicationCtrl.$inject = ['$window'];

    function ApplicationCtrl($window) {
        const vm = this;

        vm.role = $window.sessionStorage.role ? $window.sessionStorage.role : '';
        vm.name = $window.sessionStorage.name ? $window.sessionStorage.name : '';
    }
})();
