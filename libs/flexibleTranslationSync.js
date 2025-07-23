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
        // Auto-detect source language if not provided
        if (!sourceLocale) {
            const projectInfo = await languageService.getProjectLanguages(projectID);
            sourceLocale = projectInfo.sourceLanguage;
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

            // Step 3: Compare documents and find missing sections
            progressTracker.updateProgress(jobId, {
                progress: 30,
                step: 'Analyzing missing translations',
                message: 'Finding sections that need translation'
            });

            const missingInfo = languageService.findMissingTranslations(
                sourceDoc.translations, 
                targetDoc.translations || {}
            );

            if (missingInfo.totalMissingKeys === 0) {
                progressTracker.updateProgress(jobId, {
                    status: 'completed',
                    progress: 100,
                    step: 'Sync completed',
                    message: 'All translations are up to date',
                    result: {
                        translatedSections: [],
                        skippedSections: Object.keys(sourceDoc.translations),
                        totalSections: Object.keys(sourceDoc.translations).length,
                        totalKeys: languageService.countTotalKeys(sourceDoc.translations)
                    }
                });
                return;
            }

            // Step 4: Translate missing sections with progress tracking
            const missingSections = this.buildMissingSections(sourceDoc.translations, missingInfo);
            
            progressTracker.updateProgress(jobId, {
                progress: 40,
                step: 'Starting translation',
                message: `Translating ${missingInfo.totalMissingKeys} keys in ${Object.keys(missingSections).length} sections`
            });

            const translatedSections = await this.openaiService.translateSections(
                missingSections,
                targetLocale,
                `Project: ${projectAlphaId} (ID: ${projectID})`,
                (progressUpdate) => {
                    // Update progress: 40% to 80% for translation
                    const translationProgress = 40 + (progressUpdate.progress * 0.4);
                    progressTracker.updateProgress(jobId, {
                        progress: Math.round(translationProgress),
                        step: progressUpdate.step,
                        message: `${progressUpdate.step} (${progressUpdate.processedSections}/${progressUpdate.totalSections})`
                    });
                }
            );

            // Step 5: Merge translations into target document
            progressTracker.updateProgress(jobId, {
                progress: 85,
                step: 'Merging translations',
                message: 'Updating target document with new translations'
            });

            const updatedTranslations = this.mergeTranslations(
                targetDoc.translations || {},
                translatedSections
            );

            // Step 6: Update database
            progressTracker.updateProgress(jobId, {
                progress: 90,
                step: 'Saving to database',
                message: 'Saving updated translations'
            });

            await this.updateDocument(projectID, targetLocale, updatedTranslations);

            // Complete
            progressTracker.updateProgress(jobId, {
                status: 'completed',
                progress: 100,
                step: 'Sync completed',
                message: `Successfully translated ${Object.keys(translatedSections).length} sections to ${targetLocale}`,
                result: {
                    translatedSections: Object.keys(translatedSections),
                    totalTranslatedKeys: missingInfo.totalMissingKeys,
                    skippedSections: Object.keys(sourceDoc.translations).filter(
                        key => !translatedSections[key]
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
     * @param {Object} missingInfo - Missing translation info
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
                locale: locale
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
                projectAlphaId: projectAlphaId,
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
     * Update a translation document in the database
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code
     * @param {Object} translations - Updated translations object
     * @returns {Promise<Object>} Update result
     */
    async updateDocument(projectID, locale, translations) {
        try {
            const query = {
                projectID: parseInt(projectID),
                locale: locale
            };

            const result = await UiTran.updateOne(
                query,
                { $set: { translations: translations } },
                { upsert: true }
            );

            console.log(`Updated ${locale} document for project ${projectID}`);
            return result;
        } catch (error) {
            console.error('Error updating document:', error);
            throw error;
        }
    }

    /**
     * Get sync status for a project and target locale
     * @param {number} projectID - Project ID
     * @param {string} targetLocale - Target locale code
     * @param {string} sourceLocale - Source locale code (auto-detected if null)
     * @returns {Promise<Object>} Sync status information
     */
    async getSyncStatus(projectID, targetLocale, sourceLocale = null) {
        try {
            // Auto-detect source language if not provided
            if (!sourceLocale) {
                const projectInfo = await languageService.getProjectLanguages(projectID);
                sourceLocale = projectInfo.sourceLanguage;
            }

            const sourceDoc = await this.getDocument(projectID, sourceLocale);
            const targetDoc = await this.getDocument(projectID, targetLocale);

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

            const missingInfo = languageService.findMissingTranslations(
                sourceDoc.translations,
                targetDoc.translations
            );

            return {
                hasSource: true,
                hasTarget: true,
                syncNeeded: missingInfo.totalMissingKeys > 0,
                sourceSections: Object.keys(sourceDoc.translations),
                targetSections: Object.keys(targetDoc.translations),
                missingSections: missingInfo.missingSections,
                missingKeys: missingInfo.missingKeys,
                totalMissingKeys: missingInfo.totalMissingKeys,
                syncProgress: languageService.calculateSyncProgress(sourceDoc.translations, targetDoc.translations),
                upToDate: missingInfo.totalMissingKeys === 0
            };

        } catch (error) {
            console.error('Error getting sync status:', error);
            throw error;
        }
    }
}

module.exports = new FlexibleTranslationSyncService(); 