// LanguageUtils: Utility methods for language codes and names
'use strict';

(function() {
    angular
        .module('app')
        .service('LanguageUtils', LanguageUtils);

    function LanguageUtils() {
        var availableLanguages = [
            { code: 'en', name: 'English', nativeName: 'English' },
            { code: 'ja', name: 'Japanese', nativeName: '日本語' }
        ];

        this.getAvailableLanguages = function() {
            return availableLanguages;
        };

        this.getLanguageName = function(code) {
            var language = availableLanguages.find(function(lang) {
                return lang.code === code;
            });
            return language ? language.name : code.toUpperCase();
        };
    }
})();
