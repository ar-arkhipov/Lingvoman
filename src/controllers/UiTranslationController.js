const uiTranslationService = require('../services/UiTranslationService');
const ResponseBuilder = require('../utils/responseBuilder');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * UI Translation Controller - HTTP Request/Response Layer
 */
class UiTranslationController {
    /**
     * Get translations for a project
     * GET /uitranslate/:projectID?lang=locale
     */
    getTranslations = asyncHandler(async (req, res) => {
        const { projectID } = req.params;
        const { lang } = req.query;

        const translations = await uiTranslationService.getTranslations(projectID, lang);

        return ResponseBuilder.success(
            res,
            translations,
            lang ? `Translations retrieved for ${lang}` : 'Available locales retrieved'
        );
    });

    /**
     * Get list of all projects with their locales
     * GET /api/uitranslate/list
     */
    getProjectsList = asyncHandler(async (req, res) => {
        const projects = await uiTranslationService.getProjectsList();

        return ResponseBuilder.success(
            res,
            projects,
            'Projects list retrieved successfully'
        );
    });

    /**
     * Get translation item for specific project and locale
     * GET /api/uitranslate/item?projectID=123&locale=en
     */
    getTranslationItem = asyncHandler(async (req, res) => {
        const { projectID, locale } = req.query;

        const translationItem = await uiTranslationService.getTranslationItem(projectID, locale);

        return ResponseBuilder.success(
            res,
            translationItem,
            'Translation item retrieved successfully'
        );
    });

    /**
     * Create new translation document
     * PUT /api/uitranslate/item
     */
    createTranslation = asyncHandler(async (req, res) => {
        const translationData = req.body;

        const createdTranslation = await uiTranslationService.createTranslation(translationData);

        return ResponseBuilder.success(
            res,
            createdTranslation,
            'Translation document created successfully',
            201
        );
    });

    /**
     * Update translation document with safe merge (RECOMMENDED)
     * POST /api/uitranslate/merge
     */
    updateTranslationsWithMerge = asyncHandler(async (req, res) => {
        const { projectID, locale, translations, options = {} } = req.body;

        const updateResult = await uiTranslationService.updateTranslationsWithMerge(
            projectID, 
            locale, 
            translations, 
            options
        );

        return ResponseBuilder.success(
            res,
            updateResult,
            'Translations merged successfully'
        );
    });

    /**
     * Update translation sections atomically
     * POST /api/uitranslate/sections
     */
    updateTranslationSections = asyncHandler(async (req, res) => {
        const { projectID, locale, sectionUpdates } = req.body;

        const updateResult = await uiTranslationService.updateTranslationSections(
            projectID, 
            locale, 
            sectionUpdates
        );

        return ResponseBuilder.success(
            res,
            updateResult,
            'Translation sections updated successfully'
        );
    });

    /**
     * Update translation document (LEGACY - direct replacement)
     * POST /api/uitranslate/item
     */
    updateTranslations = asyncHandler(async (req, res) => {
        const { projectID, locale, translations } = req.body;

        const updateResult = await uiTranslationService.updateTranslations(projectID, locale, translations);

        return ResponseBuilder.success(
            res,
            updateResult,
            'Translations updated successfully (legacy mode - consider using merge endpoint)'
        );
    });

    /**
     * Delete translation document
     * DELETE /api/uitranslate/item?projectID=123&locale=en
     */
    deleteTranslation = asyncHandler(async (req, res) => {
        const { projectID, locale } = req.query;

        const deleteResult = await uiTranslationService.deleteTranslation(projectID, locale);

        return ResponseBuilder.success(
            res,
            deleteResult,
            'Translation document deleted successfully'
        );
    });

    /**
     * Get available languages for a project
     * GET /api/uitranslate/languages/:projectID
     */
    getProjectLanguages = asyncHandler(async (req, res) => {
        const { projectID } = req.params;

        const languages = await uiTranslationService.getProjectLanguages(projectID);

        return ResponseBuilder.success(
            res,
            languages,
            'Project languages retrieved successfully'
        );
    });

    /**
     * Get unsynchronized translation info
     * GET /api/uitranslate/unsync-info/:projectID?sourceLocale=en
     */
    getUnsyncInfo = asyncHandler(async (req, res) => {
        const { projectID } = req.params;
        const { sourceLocale } = req.query;

        const unsyncInfo = await uiTranslationService.getUnsyncInfo(projectID, sourceLocale);

        return ResponseBuilder.success(
            res,
            unsyncInfo,
            'Unsync info retrieved successfully'
        );
    });

    /**
     * Start flexible translation sync
     * POST /api/uitranslate/sync-flexible
     */
    startFlexibleSync = asyncHandler(async (req, res) => {
        const syncData = req.body;

        const syncJob = await uiTranslationService.startFlexibleSync(syncData);

        return ResponseBuilder.success(
            res,
            syncJob,
            `Translation sync to ${syncData.targetLocale} started`,
            202
        );
    });

    /**
     * Get translation sync progress
     * GET /api/uitranslate/sync-progress/:jobId
     */
    getSyncProgress = asyncHandler(async (req, res) => {
        const { jobId } = req.params;

        const progress = await uiTranslationService.getSyncProgress(jobId);

        return ResponseBuilder.success(
            res,
            progress,
            'Sync progress retrieved successfully'
        );
    });

    /**
     * Get sync status for specific locale
     * GET /api/uitranslate/sync-status/:projectID/:targetLocale?sourceLocale=en
     */
    getSyncStatus = asyncHandler(async (req, res) => {
        const { projectID, targetLocale } = req.params;
        const { sourceLocale } = req.query;

        const syncStatus = await uiTranslationService.getSyncStatus(projectID, targetLocale, sourceLocale);

        return ResponseBuilder.success(
            res,
            syncStatus,
            'Sync status retrieved successfully'
        );
    });

    /**
     * Add new language to project
     * POST /api/uitranslate/add-language
     */
    addLanguage = asyncHandler(async (req, res) => {
        const languageData = req.body;

        const newLanguage = await uiTranslationService.addLanguage(languageData);

        return ResponseBuilder.success(
            res,
            newLanguage,
            `Language ${languageData.targetLocale} added successfully`,
            201
        );
    });

    /**
     * Get backup documents list
     * GET /api/uitranslate/backup
     */
    getBackupsList = asyncHandler(async (req, res) => {
        const backupsList = await uiTranslationService.getBackupsList();

        return ResponseBuilder.success(
            res,
            backupsList,
            'Backups list retrieved successfully'
        );
    });

    /**
     * Restore translation from backup
     * POST /api/uitranslate/backup
     */
    restoreFromBackup = asyncHandler(async (req, res) => {
        const { projectID, locale } = req.body;

        const restoreResult = await uiTranslationService.restoreFromBackup(projectID, locale);

        return ResponseBuilder.success(
            res,
            restoreResult,
            'Translation restored from backup successfully'
        );
    });
}

module.exports = new UiTranslationController(); 