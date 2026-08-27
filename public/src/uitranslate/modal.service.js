// ModalService: Handles modal state management for sync and add language modals
'use strict';

(function() {
    angular
        .module('app')
        .service('ModalService', ModalService);

    function ModalService() {
        var syncModalState = {
            visible: false
        };
        var addLanguageModalState = {
            visible: false
        };

        this.showSyncModal = function() {
            syncModalState.visible = true;
        };
        this.hideSyncModal = function() {
            syncModalState.visible = false;
        };
        this.isSyncModalVisible = function() {
            return syncModalState.visible;
        };

        this.showAddLanguageModal = function() {
            addLanguageModalState.visible = true;
        };
        this.hideAddLanguageModal = function() {
            addLanguageModalState.visible = false;
        };
        this.isAddLanguageModalVisible = function() {
            return addLanguageModalState.visible;
        };
    }
})();
