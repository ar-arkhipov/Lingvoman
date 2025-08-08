/**
 * Flexible Translation Sync Service - Language-Agnostic
 * Flexible translation sync service supporting any target locale
 */
const { UiTran } = require('./mongoose.js');
const FlexibleOpenAIService = require('./flexibleOpenAI.js');
const progressTracker = require('./progressTracker.js');
const languageService = require('./languageService.js');

class FlexibleTranslationSyncService {
    constructor() {
        this.openaiService = new FlexibleOpenAIService();
    }

    /**
     * Synchronize translations for a project to any target language
     * @param {number} projectID - The project ID
     * @param {string} projectAlphaId - The project alpha ID
     * @param {string} targetLocale - Target language code (e.g., 'fr', 'de', 'es')
     * @param {string} sourceLocale - Source language code (auto-detected if null)
     * @returns {Promise<string>} Job ID for progress tracking
     */
    async startTranslationSync(projectID, projectAlphaId, targetLocale, sourceLocale = null) {
        // Default to English as master language if not provided
        if (!sourceLocale) {
            sourceLocale = 'en'; // English is always the master language
        }

        // Validate inputs
        if (!languageService.isValidLocaleFormat(targetLocale)) {
            throw new Error(`Invalid target locale format: ${targetLocale}`);
        }

        if (!sourceLocale || !languageService.isValidLocaleFormat(sourceLocale)) {
            throw new Error(`Invalid or missing source locale: ${sourceLocale}`);
        }

        // Create progress tracking job
        const jobId = progressTracker.createJob({
            projectID: parseInt(projectID),
            projectAlphaId,
            targetLocale,
            sourceLocale,
            type: 'translation_sync'
        });

        // Start async translation process
        this.executeTranslationSync(jobId, projectID, projectAlphaId, targetLocale, sourceLocale)
            .catch((error) => {
                console.error(`Translation sync job ${jobId} failed:`, error);
                progressTracker.updateProgress(jobId, {
                    status: 'failed',
                    message: `Translation sync failed: ${error.message}`,
                    error: error.message
                });
            });

        return jobId;
    }

    /**
     * Execute the actual translation sync process
     * @param {string} jobId - Progress tracking job ID
     * @param {number} projectID - Project ID
     * @param {string} projectAlphaId - Project alpha ID
     * @param {string} targetLocale - Target language code
     * @param {string} sourceLocale - Source language code
     */
    async executeTranslationSync(jobId, projectID, projectAlphaId, targetLocale, sourceLocale) {
        try {
            progressTracker.updateProgress(jobId, {
                status: 'running',
                progress: 5,
                step: 'Starting translation sync',
                message: `Starting sync from ${sourceLocale} to ${targetLocale}`
            });

            // Step 1: Get source document
            progressTracker.updateProgress(jobId, {
                progress: 10,
                step: 'Fetching source document',
                message: `Getting ${sourceLocale} source document`
            });

            const sourceDoc = await this.getDocument(projectID, sourceLocale);

            if (!sourceDoc) {
                throw new Error(`Source document (${sourceLocale}) not found for project ${projectID}`);
            }

            // Step 2: Get or create target document
            progressTracker.updateProgress(jobId, {
                progress: 20,
                step: 'Checking target document',
                message: `Checking ${targetLocale} target document`
            });

            let targetDoc = await this.getDocument(projectID, targetLocale);

            if (!targetDoc) {
                targetDoc = await this.createTargetDocument(projectID, projectAlphaId, targetLocale);
                progressTracker.updateProgress(jobId, {
                    progress: 25,
                    step: 'Created target document',
                    message: `Created new ${targetLocale} document`
                });
            }

            // Step 3: Analyze sync differences (missing and extra keys)
            progressTracker.updateProgress(jobId, {
                progress: 30,
                step: 'Analyzing sync differences',
                message: 'Finding missing and extra translations compared to master language'
            });

            const syncDifferences = languageService.findSyncDifferences(
                sourceDoc.translations, 
                targetDoc.translations || {}
            );

            // Step 4: Remove extra keys that don't exist in master language
            if (syncDifferences.extra.totalExtraKeys > 0) {
                progressTracker.updateProgress(jobId, {
                    progress: 35,
                    step: 'Cleaning extra keys',
                    message: `Removing ${syncDifferences.extra.totalExtraKeys} extra keys not in master language`
                });

                targetDoc = await this.removeExtraKeys(projectID, targetLocale, targetDoc, syncDifferences.extra);
                
                console.log(`Removed ${syncDifferences.extra.totalExtraKeys} extra keys from ${targetLocale}`);
            }

            // Check if there are missing keys to translate
            if (syncDifferences.missing.totalMissingKeys === 0) {
                progressTracker.updateProgress(jobId, {
                    status: 'completed',
                    progress: 100,
                    step: 'Sync completed',
                    message: syncDifferences.extra.totalExtraKeys > 0 
                        ? `Sync completed - Removed ${syncDifferences.extra.totalExtraKeys} extra keys` 
                        : 'All translations are up to date',
                    result: {
                        translatedSections: [],
                        skippedSections: Object.keys(sourceDoc.translations),
                        totalSections: Object.keys(sourceDoc.translations).length,
                        totalKeys: languageService.countTotalKeys(sourceDoc.translations),
                        removedExtraKeys: syncDifferences.extra.totalExtraKeys
                    }
                });

                return;
            }

            // Step 5: Translate missing sections with immediate saving
            const missingSections = this.buildMissingSections(sourceDoc.translations, syncDifferences.missing);
            const sectionKeys = Object.keys(missingSections);
            const translatedSections = {};
            let processedSections = 0;
            
            progressTracker.updateProgress(jobId, {
                progress: 40,
                step: 'Starting translation',
                message: `Translating ${syncDifferences.missing.totalMissingKeys} keys in ${sectionKeys.length} sections`
            });

            // Translate and save each section immediately
            for (const sectionKey of sectionKeys) {
                const sectionContent = missingSections[sectionKey];

                console.log(`Translating section: ${sectionKey} to ${targetLocale}`);

                // Update progress before translation
                const translationProgressStart = 40 + ((processedSections / sectionKeys.length) * 40);

                progressTracker.updateProgress(jobId, {
                    progress: Math.round(translationProgressStart),
                    step: `Translating section: ${sectionKey}`,
                    message: `Starting translation for section: ${sectionKey} (${processedSections + 1}/${sectionKeys.length})`
                });

                // Translate the section
                const translatedContent = await this.openaiService.translateSection(
                    sectionContent, 
                    targetLocale,
                    `UI section: ${sectionKey}. Project: ${projectAlphaId} (ID: ${projectID})`
                );

                // Update progress after translation
                const translationProgressEnd = 40 + (((processedSections + 0.5) / sectionKeys.length) * 40);

                progressTracker.updateProgress(jobId, {
                    progress: Math.round(translationProgressEnd),
                    step: `Saving section: ${sectionKey}`,
                    message: `Saving translated section: ${sectionKey} (${processedSections + 1}/${sectionKeys.length})`
                });

                translatedSections[sectionKey] = translatedContent;

                // Save immediately
                await this.saveSectionImmediately(projectID, targetLocale, targetDoc, sectionKey, translatedContent);

                // Update progress after saving
                const translationProgressSaved = 40 + (((processedSections + 1) / sectionKeys.length) * 40);

                progressTracker.updateProgress(jobId, {
                    progress: Math.round(translationProgressSaved),
                    step: `Section saved: ${sectionKey}`,
                    message: `Section ${sectionKey} saved (${processedSections + 1}/${sectionKeys.length})`
                });

                processedSections++;
            }

            // Step 5: Final database sync (sections are already saved individually)
            progressTracker.updateProgress(jobId, {
                progress: 90,
                step: 'Finalizing translations',
                message: 'All sections saved individually during translation'
            });

            // Complete
            progressTracker.updateProgress(jobId, {
                status: 'completed',
                progress: 100,
                step: 'Sync completed',
                message: `Successfully translated ${Object.keys(translatedSections).length} sections to ${targetLocale}`,
                result: {
                    translatedSections: Object.keys(translatedSections),
                    totalTranslatedKeys: syncDifferences.missing.totalMissingKeys,
                    removedExtraKeys: syncDifferences.extra.totalExtraKeys,
                    skippedSections: Object.keys(sourceDoc.translations).filter(
                        (key) => !translatedSections[key]
                    ),
                    totalSections: Object.keys(sourceDoc.translations).length,
                    newTranslations: translatedSections
                }
            });

        } catch (error) {
            console.error(`Error in executeTranslationSync for job ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * Build missing sections object from source translations and missing info
     * @param {Object} sourceTranslations - Source translations
     * @param {Object} missingInfo - Missing translation info (from syncDifferences.missing)
     * @returns {Object} Missing sections to translate
     */
    buildMissingSections(sourceTranslations, missingInfo) {
        const missingSections = {};

        Object.keys(missingInfo.missingKeys).forEach((sectionKey) => {
            const missingKeysInSection = missingInfo.missingKeys[sectionKey];
            const sourceSection = sourceTranslations[sectionKey];
            
            if (missingInfo.missingSections.includes(sectionKey)) {
                // Entire section is missing
                missingSections[sectionKey] = sourceSection;
            } else {
                // Partial section missing
                const partialSection = {};

                missingKeysInSection.forEach((key) => {
                    partialSection[key] = sourceSection[key];
                });
                missingSections[sectionKey] = partialSection;
            }
        });

        return missingSections;
    }

    /**
     * Get a translation document by project ID and locale
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code
     * @returns {Promise<Object|null>} Document or null if not found
     */
    async getDocument(projectID, locale) {
        try {
            const doc = await UiTran.findOne({
                projectID: parseInt(projectID),
                locale
            });

            return doc;
        } catch (error) {
            console.error(`Error fetching document for ${projectID}/${locale}:`, error);
            throw error;
        }
    }

    /**
     * Create a new target document based on source document structure
     * @param {number} projectID - Project ID
     * @param {string} projectAlphaId - Project alpha ID
     * @param {string} targetLocale - Target locale code
     * @returns {Promise<Object>} Created document
     */
    async createTargetDocument(projectID, projectAlphaId, targetLocale) {
        try {
            const newDoc = {
                projectID: parseInt(projectID),
                projectAlphaId,
                locale: targetLocale,
                translations: {}
            };

            const createdDoc = await UiTran.create(newDoc);

            console.log(`Created ${targetLocale} document for project ${projectID}`);

            return createdDoc;
        } catch (error) {
            console.error(`Error creating ${targetLocale} document:`, error);
            throw error;
        }
    }

    /**
     * Merge new translations into existing target translations
     * Note: This method assumes that newTranslations only contains keys that should exist
     * according to the master language. The sync process handles master language enforcement
     * by calling removeExtraKeys() before translation and only translating missing keys.
     * @param {Object} existingTranslations - Current target translations
     * @param {Object} newTranslations - New translated sections
     * @returns {Object} Merged translations
     */
    mergeTranslations(existingTranslations = {}, newTranslations) {
        const merged = { ...existingTranslations };

        Object.keys(newTranslations).forEach((sectionKey) => {
            if (!merged[sectionKey]) {
                // New section entirely
                merged[sectionKey] = newTranslations[sectionKey];
            } else {
                // Merge into existing section
                merged[sectionKey] = {
                    ...merged[sectionKey],
                    ...newTranslations[sectionKey]
                };
            }
        });

        return merged;
    }

    /**
     * Update a translation document in the database with safe merge
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code
     * @param {Object} translations - Updated translations object
     * @param {boolean} useMerge - Whether to use safe merge (default: true for safety)
     * @returns {Promise<Object>} Update result
     */
    async updateDocument(projectID, locale, translations, useMerge = true) {
        try {
            if (useMerge) {
                // Use safe merge to prevent data loss
                return await this.updateDocumentWithMerge(projectID, locale, translations);
            } else {
                // Legacy direct replacement (dangerous)
                const query = {
                    projectID: parseInt(projectID),
                    locale
                };

                const result = await UiTran.updateOne(
                    query,
                    { $set: { translations } },
                    { upsert: true }
                );

                console.log(`Updated ${locale} document for project ${projectID} (direct replacement)`);

                return result;
            }
        } catch (error) {
            console.error('Error updating document:', error);
            throw error;
        }
    }

    /**
     * Update a translation document with safe merge strategy
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code
     * @param {Object} translations - Updated translations object
     * @returns {Promise<Object>} Update result
     */
    async updateDocumentWithMerge(projectID, locale, translations) {
        try {
            const query = {
                projectID: parseInt(projectID),
                locale
            };

            // Get existing document
            const existingDoc = await UiTran.findOne(query);
            
            let mergedTranslations;

            if (!existingDoc || !existingDoc.translations) {
                // New document or no existing translations
                mergedTranslations = translations;
                console.log(`Creating new ${locale} document for project ${projectID}`);
            } else {
                // Merge with existing translations
                mergedTranslations = this.mergeTranslations(existingDoc.translations, translations);
                
                const existingKeyCount = this.countTranslationKeys(existingDoc.translations);
                const newKeyCount = this.countTranslationKeys(translations);
                const mergedKeyCount = this.countTranslationKeys(mergedTranslations);
                
                console.log(`Merging ${locale} document for project ${projectID}: ` +
                    `${existingKeyCount} existing + ${newKeyCount} new = ${mergedKeyCount} total keys`);
                
                // Safety check: ensure we didn't lose data unexpectedly

                if (mergedKeyCount < existingKeyCount) {
                    console.warn('Potential data loss detected: ' +
                        `${existingKeyCount} -> ${mergedKeyCount} keys for ${locale} project ${projectID}`);
                }
            }

            const result = await UiTran.updateOne(
                query,
                { $set: { translations: mergedTranslations } },
                { upsert: true }
            );

            console.log(`Safely updated ${locale} document for project ${projectID} with merge`);

            return result;
        } catch (error) {
            console.error('Error updating document with merge:', error);
            throw error;
        }
    }

    /**
     * Count total translation keys in a translations object
     * @param {Object} translations - Translations object
     * @returns {number} Total key count
     */
    countTranslationKeys(translations) {
        if (!translations || typeof translations !== 'object') {
            return 0;
        }

        let totalKeys = 0;

        Object.keys(translations).forEach((sectionKey) => {
            const section = translations[sectionKey];

            if (section && typeof section === 'object') {
                totalKeys += Object.keys(section).length;
            }
        });

        return totalKeys;
    }

    /**
     * Save a single section of translations immediately to the database.
     * This is useful for immediate feedback and to avoid losing translations
     * if the process crashes after translation but before final save.
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code
     * @param {Object} targetDoc - The current target document
     * @param {string} sectionKey - The key of the section to save
     * @param {Object} translatedContent - The translated content for the section
     * @returns {Promise<void>}
     */
    async saveSectionImmediately(projectID, locale, targetDoc, sectionKey, translatedContent) {
        try {
            const updatedTranslations = {
                ...targetDoc.translations,
                [sectionKey]: translatedContent
            };
            
            await this.updateDocument(projectID, locale, updatedTranslations);
            
            // Update the target document reference to keep it current
            targetDoc.translations = updatedTranslations;
            
            console.log(`Saved section ${sectionKey} for ${locale} document for project ${projectID}`);
        } catch (error) {
            console.error(`Error saving section ${sectionKey} for ${locale} document:`, error);
            throw error;
        }
    }

    /**
     * Remove extra keys from target language that don't exist in master language
     * @param {number} projectID - Project ID
     * @param {string} targetLocale - Target language locale
     * @param {Object} targetDoc - Target document
     * @param {Object} extraInfo - Extra keys information from findSyncDifferences
     * @returns {Promise<Object>} Updated target document
     */
    async removeExtraKeys(projectID, targetLocale, targetDoc, extraInfo) {
        if (extraInfo.totalExtraKeys === 0) {
            console.log(`No extra keys to remove from ${targetLocale}`);

            return targetDoc;
        }

        console.log(`Removing ${extraInfo.totalExtraKeys} extra keys from ${targetLocale} for project ${projectID}`);
        
        const cleanedTranslations = { ...targetDoc.translations };

        // Remove extra sections entirely

        extraInfo.extraSections.forEach((sectionKey) => {
            const keyCount = cleanedTranslations[sectionKey] ? Object.keys(cleanedTranslations[sectionKey]).length : 0;

            delete cleanedTranslations[sectionKey];
            console.log(`  Removed entire section: ${sectionKey} (${keyCount} keys)`);
        });

        // Remove extra keys within sections
        Object.keys(extraInfo.extraKeys).forEach((sectionKey) => {
            if (cleanedTranslations[sectionKey]) {
                extraInfo.extraKeys[sectionKey].forEach((key) => {
                    delete cleanedTranslations[sectionKey][key];
                    console.log(`  Removed key: ${sectionKey}.${key}`);
                });
                
                // Remove section if it becomes empty after key removal
                if (Object.keys(cleanedTranslations[sectionKey]).length === 0) {
                    delete cleanedTranslations[sectionKey];
                    console.log(`  Removed empty section: ${sectionKey}`);
                }
            }
        });

        // Update document immediately with cleaned translations
        await this.updateDocument(projectID, targetLocale, cleanedTranslations, false);
        
        console.log(`Successfully cleaned ${targetLocale} document for project ${projectID}`);
        
        // Return updated document reference
        return { ...targetDoc, translations: cleanedTranslations };
    }

    /**
     * Get sync status for a project and target locale
     * @param {number} projectID - Project ID
     * @param {string} targetLocale - Target locale code
     * @param {string} sourceLocale - Source locale code (defaults to 'en' if null)
     * @returns {Promise<Object>} Sync status information
     */
    async getSyncStatus(projectID, targetLocale, sourceLocale = null) {
        try {
            // Default to English as master language if not provided
            if (!sourceLocale) {
                sourceLocale = 'en'; // English is always the master language
            }

            const [sourceDoc, targetDoc] = await Promise.all([
                this.getDocument(projectID, sourceLocale),
                this.getDocument(projectID, targetLocale)
            ]);

            if (!sourceDoc) {
                return {
                    hasSource: false,
                    hasTarget: false,
                    syncNeeded: false,
                    message: `No ${sourceLocale} source document found`
                };
            }

            if (!targetDoc) {
                return {
                    hasSource: true,
                    hasTarget: false,
                    syncNeeded: true,
                    sourceSections: Object.keys(sourceDoc.translations),
                    totalSourceKeys: languageService.countTotalKeys(sourceDoc.translations),
                    message: `${targetLocale} document needs to be created`
                };
            }

            const syncDifferences = languageService.findSyncDifferences(
                sourceDoc.translations,
                targetDoc.translations
            );

            return {
                hasSource: true,
                hasTarget: true,
                syncNeeded: syncDifferences.missing.totalMissingKeys > 0 || syncDifferences.extra.totalExtraKeys > 0,
                sourceSections: Object.keys(sourceDoc.translations),
                targetSections: Object.keys(targetDoc.translations),
                missingSections: syncDifferences.missing.missingSections,
                missingKeys: syncDifferences.missing.missingKeys,
                totalMissingKeys: syncDifferences.missing.totalMissingKeys,
                extraSections: syncDifferences.extra.extraSections,
                extraKeys: syncDifferences.extra.extraKeys,
                totalExtraKeys: syncDifferences.extra.totalExtraKeys,
                syncProgress: languageService.calculateSyncProgress(sourceDoc.translations, targetDoc.translations),
                upToDate: syncDifferences.missing.totalMissingKeys === 0 && syncDifferences.extra.totalExtraKeys === 0
            };

        } catch (error) {
            console.error('Error getting sync status:', error);
            throw error;
        }
    }
}

module.exports = new FlexibleTranslationSyncService(); 
