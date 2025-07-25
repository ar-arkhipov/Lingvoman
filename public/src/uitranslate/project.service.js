// ProjectService: Handles project and language selection/loading logic
'use strict';

(function() {
    angular
        .module('app')
        .service('ProjectService', ProjectService);

    ProjectService.$inject = ['UiTranslateFactory'];

    function ProjectService(UiTranslateFactory) {
        /**
         * Get list of projects
         */
        this.getProjectsList = function() {
            return UiTranslateFactory.getProjectsList();
        };

        /**
         * Get languages for a project
         */
        this.getProjectLanguages = function(projectID) {
            return UiTranslateFactory.getProjectLanguages(projectID);
        };

        /**
         * Load common languages not in current project
         */
        this.loadCommonLanguages = function(chosenProject, availableLanguages) {
            return availableLanguages.filter(function (lang) {
                return chosenProject.locales.indexOf(lang.code) === -1;
            });
        };
    }
})();
