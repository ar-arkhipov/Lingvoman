const { UiTran } = require('./mongoose.js');
const OpenAIService = require('./openai.js');

class TranslationSyncService {
    constructor() {
        this.openaiService = new OpenAIService();
    }

    /**
     * Synchronize Japanese translations for a project based on English source
     * @param {number} projectID - The project ID
     * @param {string} projectAlphaId - The project alpha ID
     * @returns {Promise<Object>} Sync result with details
     */
    async syncJapaneseTranslations(projectID, projectAlphaId) {
        try {
            console.log(`Starting sync for project ${projectID} (${projectAlphaId})`);

            // Step 1: Get English source document
            const englishDoc = await this.getDocument(projectID, 'en');
            if (!englishDoc) {
                throw new Error(`English document not found for project ${projectID}`);
            }

            // Step 2: Get or create Japanese document
            let japaneseDoc = await this.getDocument(projectID, 'jp');
            if (!japaneseDoc) {
                japaneseDoc = await this.createJapaneseDocument(projectID, projectAlphaId);
                console.log('Created new Japanese document');
            }

            // Step 3: Compare documents and find missing sections
            const missingSections = this.findMissingSections(
                englishDoc.translations, 
                japaneseDoc.translations
            );

            if (Object.keys(missingSections).length === 0) {
                return {
                    success: true,
                    message: 'All translations are up to date',
                    translatedSections: [],
                    skippedSections: [],
                    totalSections: Object.keys(englishDoc.translations).length
                };
            }

            console.log(`Found ${Object.keys(missingSections).length} sections to translate:`, 
                Object.keys(missingSections));

            // Step 4: Translate missing sections
            const translatedSections = await this.openaiService.translateSections(
                missingSections,
                `Project: ${projectAlphaId} (ID: ${projectID})`
            );

            // Step 5: Merge translations into Japanese document
            const updatedTranslations = this.mergeTranslations(
                japaneseDoc.translations,
                translatedSections
            );

            // Step 6: Update database
            await this.updateDocument(projectID, 'jp', updatedTranslations);

            console.log(`Successfully synced ${Object.keys(translatedSections).length} sections`);

            return {
                success: true,
                message: `Successfully translated ${Object.keys(translatedSections).length} sections`,
                translatedSections: Object.keys(translatedSections),
                skippedSections: this.getExistingSections(englishDoc.translations, japaneseDoc.translations),
                totalSections: Object.keys(englishDoc.translations).length,
                newTranslations: translatedSections
            };

        } catch (error) {
            console.error('Error in syncJapaneseTranslations:', error);
            return {
                success: false,
                message: `Sync failed: ${error.message}`,
                error: error.message
            };
        }
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
     * Create a new Japanese document based on English document structure
     * @param {number} projectID - Project ID
     * @param {string} projectAlphaId - Project alpha ID
     * @returns {Promise<Object>} Created document
     */
    async createJapaneseDocument(projectID, projectAlphaId) {
        try {
            const newDoc = {
                projectID: parseInt(projectID),
                projectAlphaId: projectAlphaId,
                locale: 'jp',
                translations: {}
            };

            const createdDoc = await UiTran.create(newDoc);
            console.log(`Created Japanese document for project ${projectID}`);
            return createdDoc;
        } catch (error) {
            console.error('Error creating Japanese document:', error);
            throw error;
        }
    }

    /**
     * Find sections that exist in English but are missing in Japanese
     * @param {Object} englishTranslations - English translations object
     * @param {Object} japaneseTranslations - Japanese translations object
     * @returns {Object} Missing sections from English
     */
    findMissingSections(englishTranslations, japaneseTranslations = {}) {
        const missingSections = {};

        // Check each top-level section in English
        Object.keys(englishTranslations).forEach(sectionKey => {
            if (!japaneseTranslations[sectionKey]) {
                // Entire section is missing
                missingSections[sectionKey] = englishTranslations[sectionKey];
                console.log(`Missing entire section: ${sectionKey}`);
            } else {
                // Check for missing keys within the section
                const englishSection = englishTranslations[sectionKey];
                const japaneseSection = japaneseTranslations[sectionKey];
                const missingKeys = {};

                Object.keys(englishSection).forEach(key => {
                    if (!japaneseSection[key]) {
                        missingKeys[key] = englishSection[key];
                    }
                });

                // If there are missing keys in this section, include them
                if (Object.keys(missingKeys).length > 0) {
                    missingSections[sectionKey] = missingKeys;
                    console.log(`Missing keys in section ${sectionKey}:`, Object.keys(missingKeys));
                }
            }
        });

        return missingSections;
    }

    /**
     * Get list of sections that already exist in Japanese
     * @param {Object} englishTranslations - English translations
     * @param {Object} japaneseTranslations - Japanese translations
     * @returns {Array} Array of existing section names
     */
    getExistingSections(englishTranslations, japaneseTranslations = {}) {
        return Object.keys(englishTranslations).filter(sectionKey => 
            japaneseTranslations[sectionKey] && 
            Object.keys(japaneseTranslations[sectionKey]).length > 0
        );
    }

    /**
     * Merge new translations into existing Japanese translations
     * @param {Object} existingTranslations - Current Japanese translations
     * @param {Object} newTranslations - New translated sections
     * @returns {Object} Merged translations
     */
    mergeTranslations(existingTranslations = {}, newTranslations) {
        const merged = { ...existingTranslations };

        Object.keys(newTranslations).forEach(sectionKey => {
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
     * Get sync status for a project
     * @param {number} projectID - Project ID
     * @returns {Promise<Object>} Sync status information
     */
    async getSyncStatus(projectID) {
        try {
            const englishDoc = await this.getDocument(projectID, 'en');
            const japaneseDoc = await this.getDocument(projectID, 'jp');

            if (!englishDoc) {
                return {
                    hasEnglish: false,
                    hasJapanese: false,
                    syncNeeded: false,
                    message: 'No English source document found'
                };
            }

            if (!japaneseDoc) {
                return {
                    hasEnglish: true,
                    hasJapanese: false,
                    syncNeeded: true,
                    englishSections: Object.keys(englishDoc.translations),
                    message: 'Japanese document needs to be created'
                };
            }

            const missingSections = this.findMissingSections(
                englishDoc.translations,
                japaneseDoc.translations
            );

            return {
                hasEnglish: true,
                hasJapanese: true,
                syncNeeded: Object.keys(missingSections).length > 0,
                englishSections: Object.keys(englishDoc.translations),
                japaneseSections: Object.keys(japaneseDoc.translations),
                missingSections: Object.keys(missingSections),
                upToDate: Object.keys(missingSections).length === 0
            };

        } catch (error) {
            console.error('Error getting sync status:', error);
            throw error;
        }
    }
}

module.exports = TranslationSyncService; 