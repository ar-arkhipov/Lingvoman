// TranslationService: Handles translation CRUD operations
'use strict';

(function() {
    angular
        .module('app')
        .service('TranslationService', TranslationService);

    TranslationService.$inject = ['UiTranslateFactory', '$rootScope'];

    function TranslationService(UiTranslateFactory, $rootScope) {
        /**
         * Get translation items
         */
        this.getTrans = function(projectID, locale) {
            return UiTranslateFactory.getTranslationItem(projectID, locale);
        };

        /**
         * Save changes to a translation item
         */
        this.changeTranslation = function(item) {
            delete item._id;
            return UiTranslateFactory.saveTranslation(item);
        };

        /**
         * Create a new translation document
         */
        this.makeNew = function(projectID, locale, alphaId) {
            return UiTranslateFactory.createTranslation({
                'projectID': projectID,
                'locale': locale,
                'projectAlphaId': alphaId
            });
        };

        /**
         * Make a local copy of a translation document
         */
        this.makeCopy = function(item, newLang) {
            var newItem = (JSON.parse(JSON.stringify(item)));
            return UiTranslateFactory.getTranslationItem(newItem.projectID, newLang).then(function (data) {
                if (!data.length) {
                    newItem.locale = newLang;
                    return newItem;
                } else {
                    return null;
                }
            });
        };

        /**
         * Remove a translation document
         */
        this.removeDoc = function(projectID, locale) {
            return UiTranslateFactory.deleteTranslation(projectID, locale);
        };
    }
})();
