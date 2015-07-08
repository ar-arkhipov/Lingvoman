'use strict';
(function() {
    angular
        .module('app')
        .controller('GrowlCtrl', GrowlCtrl);

    GrowlCtrl.$inject = ['$rootScope'];

    function GrowlCtrl($rootScope) {
        var vm = this;

        vm.growls = [];

        vm.closeGrowl = function (index) {
            vm.growls.splice(index, 1);
        };

        $rootScope.$on('growl', function (event, data) {
            vm.growls.push(data);
        });
    }
})();