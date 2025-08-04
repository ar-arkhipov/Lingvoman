const uiTranslationRepository = require('../repositories/UiTranslationRepository');
const languageService = require('../../libs/languageService');
const flexibleTranslationSync = require('../../libs/flexibleTranslationSync');
const progressTracker = require('../../libs/progressTracker');
const { logger } = require('../utils/logger');
const { NotFoundError, ValidationError, ConflictError } = require('../utils/errors');

/**
 * UI Translation Service - Business Logic Layer
 */
class UiTranslationService {
    /**
     * Get translations for a project and locale
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code (optional)
     * @returns {Promise<Object>} Translation data
     */
    async getTranslations(projectID, locale = null) {
        if (locale) {
            // Get specific locale translations
            const doc = await uiTranslationRepository.findByProjectAndLocale(projectID, locale);
            
            if (!doc) {
                logger.warn('Translation document not found', { projectID, locale });
                throw new NotFoundError('Translation document');
            }

            return {
                projectID: doc.projectID,
                projectAlphaId: doc.projectAlphaId,
                locale: doc.locale,
                translations: doc.translations || {}
            };
        } else {
            // Get available locales for project
            const localesData = await uiTranslationRepository.getProjectLocales(projectID);
            
            if (!localesData.locales || localesData.locales.length === 0) {
                logger.warn('No translations found for project', { projectID });

                return { locales: [] };
            }

            return localesData;
        }
    }

    /**
     * Get list of all projects with their locales
     * @returns {Promise<Array>} Projects list
     */
    async getProjectsList() {
        const projects = await uiTranslationRepository.getProjectsList();
        
        logger.info('Retrieved projects list', { 
            projectCount: projects.length 
        });

        return projects;
    }

    /**
     * Get translation item for specific project and locale
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code
     * @returns {Promise<Object>} Translation document
     */
    async getTranslationItem(projectID, locale) {
        const doc = await uiTranslationRepository.findByProjectAndLocale(projectID, locale);
        
        if (!doc) {
            logger.warn('Translation item not found', { projectID, locale });
            throw new NotFoundError('Translation item');
        }

        return {
            projectID: doc.projectID,
            projectAlphaId: doc.projectAlphaId,
            locale: doc.locale,
            translations: doc.translations || {},
            lastModified: doc.updatedAt || doc.createdAt
        };
    }

    /**
     * Create new translation document
     * @param {Object} translationData - Translation data
     * @returns {Promise<Object>} Created document
     */
    async createTranslation(translationData) {
        const { projectID, projectAlphaId, locale, translations = {} } = translationData;

        // Check if project already has translations
        const existingCount = await uiTranslationRepository.countByProject(projectID);
        
        if (existingCount > 0) {
            // Check if this specific locale already exists
            const existingDoc = await uiTranslationRepository.findByProjectAndLocale(projectID, locale);
            
            if (existingDoc) {
                logger.warn('Translation document already exists', { projectID, locale });
                throw new ConflictError('Translation document already exists for this project and locale');
            }
        }

        const createdDoc = await uiTranslationRepository.create({
            projectID,
            projectAlphaId,
            locale,
            translations
        });

        logger.info('Translation document created successfully', {
            projectID: createdDoc.projectID,
            locale: createdDoc.locale,
            translationKeys: Object.keys(translations).length
        });

        return {
            projectID: createdDoc.projectID,
            projectAlphaId: createdDoc.projectAlphaId,
            locale: createdDoc.locale,
            translations: createdDoc.translations,
            documentId: createdDoc._id
        };
    }

    /**
     * Update translation document with safe merge strategy (RECOMMENDED)
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code
     * @param {Object} translations - Updated translations to merge
     * @param {Object} options - Update options
     * @returns {Promise<Object>} Update result with merge info
     */
    async updateTranslationsWithMerge(projectID, locale, translations, options = {}) {
        // Backup current version before updating
        try {
            const existingDoc = await uiTranslationRepository.findByProjectAndLocale(projectID, locale);
            if (existingDoc) {
                await uiTranslationRepository.backup(projectID, locale);
                logger.info('Translation document backed up before merge update', { projectID, locale });
            }
        } catch (backupError) {
            logger.warn('Failed to backup translation document before merge update', {
                projectID,
                locale,
                error: backupError.message
            });
        }

        // Perform safe merge update
        const result = await uiTranslationRepository.mergeTranslations(projectID, locale, translations, options);

        logger.info('Translation document updated with merge successfully', {
            projectID,
            locale,
            mergeInfo: result.mergeInfo,
            modifiedCount: result.modifiedCount
        });

        return {
            projectID,
            locale,
            translationKeys: result.mergeInfo.finalKeyCount,
            updateResult: result,
            mergeInfo: result.mergeInfo
        };
    }

    /**
     * Update translation document (LEGACY - use updateTranslationsWithMerge for safety)
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code
     * @param {Object} translations - Updated translations
     * @returns {Promise<Object>} Update result
     */
    async updateTranslations(projectID, locale, translations) {
        // Validate that the document exists
        const existingDoc = await uiTranslationRepository.findByProjectAndLocale(projectID, locale);
        
        if (!existingDoc) {
            logger.warn('Attempting to update non-existent translation document', { projectID, locale });
            throw new NotFoundError('Translation document');
        }

        // Backup current version before updating
        try {
            await uiTranslationRepository.backup(projectID, locale);
            logger.info('Translation document backed up before update', { projectID, locale });
        } catch (backupError) {
            logger.warn('Failed to backup translation document before update', {
                projectID,
                locale,
                error: backupError.message
            });
        }

        // Update the document
        const result = await uiTranslationRepository.updateTranslations(projectID, locale, translations);

        const translationKeysCount = this.countTranslationKeys(translations);
        
        logger.info('Translation document updated successfully', {
            projectID,
            locale,
            translationKeys: translationKeysCount,
            modifiedCount: result.modifiedCount
        });

        return {
            projectID,
            locale,
            translationKeys: translationKeysCount,
            updateResult: result
        };
    }

    /**
     * Update specific translation sections atomically
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code
     * @param {Object} sectionUpdates - Object with section keys and their updates
     * @returns {Promise<Object>} Update result
     */
    async updateTranslationSections(projectID, locale, sectionUpdates) {
        // Backup current version before updating
        try {
            const existingDoc = await uiTranslationRepository.findByProjectAndLocale(projectID, locale);
            if (existingDoc) {
                await uiTranslationRepository.backup(projectID, locale);
                logger.info('Translation document backed up before section update', { projectID, locale });
            }
        } catch (backupError) {
            logger.warn('Failed to backup translation document before section update', {
                projectID,
                locale,
                error: backupError.message
            });
        }

        // Update sections atomically
        const result = await uiTranslationRepository.updateSections(projectID, locale, sectionUpdates);

        logger.info('Translation sections updated successfully', {
            projectID,
            locale,
            updatedSections: Object.keys(sectionUpdates).length,
            modifiedCount: result.modifiedCount
        });

        return {
            projectID,
            locale,
            updatedSections: Object.keys(sectionUpdates).length,
            updateResult: result
        };
    }

    /**
     * Delete translation document
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code
     * @returns {Promise<Object>} Delete result
     */
    async deleteTranslation(projectID, locale) {
        // Backup before deletion
        try {
            await uiTranslationRepository.backup(projectID, locale);
            logger.info('Translation document backed up before deletion', { projectID, locale });
        } catch (backupError) {
            logger.warn('Failed to backup translation document before deletion', {
                projectID,
                locale,
                error: backupError.message
            });
        }

        const result = await uiTranslationRepository.delete(projectID, locale);

        logger.info('Translation document deleted successfully', {
            projectID,
            locale,
            deletedCount: result.deletedCount
        });

        return {
            projectID,
            locale,
            deleteResult: result
        };
    }

    /**
     * Get available languages for a project
     * @param {number} projectID - Project ID
     * @returns {Promise<Object>} Language information
     */
    async getProjectLanguages(projectID) {
        const languageInfo = await languageService.getProjectLanguages(projectID);
        
        logger.info('Retrieved project languages', {
            projectID,
            availableLanguages: languageInfo.availableLanguages?.length || 0,
            sourceLanguage: languageInfo.sourceLanguage
        });

        return languageInfo;
    }

    /**
     * Get unsynchronized translation info
     * @param {number} projectID - Project ID
     * @param {string} sourceLocale - Source locale (optional)
     * @returns {Promise<Object>} Unsync information
     */
    async getUnsyncInfo(projectID, sourceLocale = null) {
        const unsyncInfo = await languageService.getUnsyncInfo(projectID, sourceLocale);
        
        const unsyncedCount = unsyncInfo.unsyncedLanguages?.length || 0;
        
        logger.info('Retrieved unsync info', {
            projectID,
            sourceLocale: unsyncInfo.sourceLocale,
            unsyncedLanguages: unsyncedCount
        });

        return unsyncInfo;
    }

    /**
     * Start flexible translation sync
     * @param {Object} syncData - Sync request data
     * @returns {Promise<Object>} Job information
     */
    async startFlexibleSync(syncData) {
        const { projectID, projectAlphaId, targetLocale, sourceLocale = null } = syncData;

        // Validate project exists
        const projectDocs = await uiTranslationRepository.findByProject(projectID);
        
        if (projectDocs.length === 0) {
            logger.warn('Attempted sync on non-existent project', { projectID });
            throw new NotFoundError('Project');
        }

        // Validate locale format
        if (!languageService.isValidLocaleFormat(targetLocale)) {
            throw new ValidationError(`Invalid target locale format: ${targetLocale}`);
        }

        if (sourceLocale && !languageService.isValidLocaleFormat(sourceLocale)) {
            throw new ValidationError(`Invalid source locale format: ${sourceLocale}`);
        }

        const jobId = await flexibleTranslationSync.startTranslationSync(
            projectID,
            projectAlphaId,
            targetLocale,
            sourceLocale || 'en'
        );

        logger.info('Translation sync started', {
            projectID,
            projectAlphaId,
            targetLocale,
            sourceLocale,
            jobId
        });

        return {
            jobId,
            projectID,
            projectAlphaId,
            targetLocale,
            sourceLocale: sourceLocale || 'en',
            pollUrl: `/api/uitranslate/sync-progress/${jobId}`,
            status: 'started'
        };
    }

    /**
     * Get sync progress
     * @param {string} jobId - Job ID
     * @returns {Promise<Object>} Job status
     */
    async getSyncProgress(jobId) {
        const jobStatus = progressTracker.getJobStatus(jobId);

        if (!jobStatus) {
            logger.warn('Sync progress requested for unknown job', { jobId });
            throw new NotFoundError('Sync job');
        }

        return jobStatus;
    }

    /**
     * Get sync status for specific locale
     * @param {number} projectID - Project ID
     * @param {string} targetLocale - Target locale
     * @param {string} sourceLocale - Source locale (optional)
     * @returns {Promise<Object>} Sync status
     */
    async getSyncStatus(projectID, targetLocale, sourceLocale = null) {
        const syncStatus = await flexibleTranslationSync.getSyncStatus(
            projectID,
            targetLocale,
            sourceLocale
        );

        logger.info('Retrieved sync status', {
            projectID,
            targetLocale,
            sourceLocale,
            syncNeeded: syncStatus.syncNeeded,
            totalMissingKeys: syncStatus.totalMissingKeys
        });

        return syncStatus;
    }

    /**
     * Add new language to project
     * @param {Object} languageData - Language data
     * @returns {Promise<Object>} Created language document
     */
    async addLanguage(languageData) {
        const { projectID, projectAlphaId, targetLocale } = languageData;

        // Validate project exists
        const existingProject = await uiTranslationRepository.findByProject(projectID);
        
        if (existingProject.length === 0) {
            logger.warn('Attempted to add language to non-existent project', { projectID });
            throw new NotFoundError('Project');
        }

        // Check if language already exists
        const existingLanguage = await uiTranslationRepository.findByProjectAndLocale(projectID, targetLocale);
        
        if (existingLanguage) {
            logger.warn('Attempted to add existing language', { projectID, targetLocale });
            throw new ConflictError(`Language ${targetLocale} already exists for project ${projectID}`);
        }

        // Create new language document
        const createdDoc = await uiTranslationRepository.create({
            projectID,
            projectAlphaId,
            locale: targetLocale,
            translations: {}
        });

        logger.info('New language added to project', {
            projectID,
            projectAlphaId,
            targetLocale,
            documentId: createdDoc._id
        });

        return {
            projectID,
            projectAlphaId,
            locale: targetLocale,
            documentId: createdDoc._id,
            translations: {}
        };
    }

    /**
     * Get backup documents list
     * @returns {Promise<Array>} Backup list
     */
    async getBackupsList() {
        const backupsList = await uiTranslationRepository.getBackupsList();
        
        logger.info('Retrieved backups list', {
            backupCount: backupsList.length
        });

        return backupsList;
    }

    /**
     * Restore translation from backup
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code
     * @returns {Promise<Object>} Restore result
     */
    async restoreFromBackup(projectID, locale) {
        const result = await uiTranslationRepository.restoreFromBackup(projectID, locale);

        logger.info('Translation restored from backup', {
            projectID,
            locale,
            modifiedCount: result.modifiedCount,
            upsertedCount: result.upsertedCount
        });

        return {
            projectID,
            locale,
            restoreResult: result
        };
    }

    /**
     * Count translation keys in translations object
     * @param {Object} translations - Translations object
     * @returns {number} Total key count
     */
    countTranslationKeys(translations) {
        let count = 0;

        Object.values(translations).forEach((section) => {
            if (typeof section === 'object' && section !== null) {
                count += Object.keys(section).length;
            }
        });

        return count;
    }

    /**
     * Validate translation data structure
     * @param {Object} translations - Translations to validate
     * @returns {boolean} True if valid
     */
    validateTranslationStructure(translations) {
        if (typeof translations !== 'object' || translations === null) {
            return false;
        }

        for (const [sectionKey, section] of Object.entries(translations)) {
            if (typeof section !== 'object' || section === null) {
                logger.warn('Invalid translation section structure', { sectionKey });

                return false;
            }

            for (const [key, value] of Object.entries(section)) {
                if (typeof value !== 'string') {
                    logger.warn('Invalid translation value type', { sectionKey, key, valueType: typeof value });

                    return false;
                }
            }
        }

        return true;
    }
}

module.exports = new UiTranslationService(); 