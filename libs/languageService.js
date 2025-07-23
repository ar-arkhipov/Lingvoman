/**
 * Language Service - Manage available languages and translation info
 */
const { UiTran } = require('./mongoose.js');

class LanguageService {
    /**
     * Get available languages for a project
     * @param {number} projectID - Project ID
     * @returns {Promise<Object>} Language information
     */
    async getProjectLanguages(projectID) {
        try {
            const docs = await UiTran.find({ projectID: parseInt(projectID) });
            
            const languages = {};
            let sourceLanguage = null;

            docs.forEach((doc) => {
                const locale = doc.locale;
                const sectionsCount = doc.translations ? Object.keys(doc.translations).length : 0;
                let totalKeys = 0;

                // Count total translation keys
                if (doc.translations) {
                    Object.values(doc.translations).forEach((section) => {
                        if (typeof section === 'object') {
                            totalKeys += Object.keys(section).length;
                        }
                    });
                }

                languages[locale] = {
                    locale,
                    sectionsCount,
                    totalKeys,
                    lastModified: doc.updatedAt || doc.createdAt
                };

                // The language with the most keys is considered the source language
                if (!sourceLanguage || totalKeys > (sourceLanguage.totalKeys || 0)) {
                    sourceLanguage = languages[locale];
                }
            });

            return {
                projectID: parseInt(projectID),
                sourceLanguage: sourceLanguage?.locale || Object.keys(languages)[0] || null,
                availableLanguages: Object.keys(languages),
                languageDetails: languages,
                hasSource: !!sourceLanguage
            };

        } catch (error) {
            console.error('Error getting project languages:', error);
            throw error;
        }
    }

    /**
     * Get unsynchronized translation info
     * @param {number} projectID - Project ID
     * @param {string} sourceLocale - Source language (auto-detected if null)
     * @returns {Promise<Object>} Unsync information
     */
    async getUnsyncInfo(projectID, sourceLocale = null) {
        try {
            // Auto-detect source language if not provided
            if (!sourceLocale) {
                const projectInfo = await this.getProjectLanguages(projectID);
                sourceLocale = projectInfo.sourceLanguage;
            }

            if (!sourceLocale) {
                return {
                    error: 'No source language found for this project',
                    projectID: parseInt(projectID),
                    sourceLocale: null,
                    targetLanguages: {}
                };
            }

            const sourceDoc = await UiTran.findOne({
                projectID: parseInt(projectID),
                locale: sourceLocale
            });

            if (!sourceDoc || !sourceDoc.translations) {
                return {
                    error: `Source document (${sourceLocale}) not found`,
                    projectID: parseInt(projectID),
                    sourceLocale,
                    targetLanguages: {}
                };
            }

            const allDocs = await UiTran.find({ projectID: parseInt(projectID) });
            const sourceTranslations = sourceDoc.translations;
            const targetLanguages = {};

            // Analyze each target language
            allDocs.forEach((doc) => {
                if (doc.locale === sourceLocale) return;

                const targetLocale = doc.locale;
                const targetTranslations = doc.translations || {};
                const missingInfo = this.findMissingTranslations(sourceTranslations, targetTranslations);

                targetLanguages[targetLocale] = {
                    locale: targetLocale,
                    totalSections: Object.keys(sourceTranslations).length,
                    translatedSections: Object.keys(targetTranslations).length,
                    missingSections: missingInfo.missingSections,
                    missingKeys: missingInfo.missingKeys,
                    totalMissingKeys: missingInfo.totalMissingKeys,
                    syncProgress: this.calculateSyncProgress(sourceTranslations, targetTranslations),
                    lastModified: doc.updatedAt || doc.createdAt,
                    needsSync: missingInfo.totalMissingKeys > 0
                };
            });

            return {
                projectID: parseInt(projectID),
                sourceLocale,
                sourceInfo: {
                    totalSections: Object.keys(sourceTranslations).length,
                    totalKeys: this.countTotalKeys(sourceTranslations)
                },
                targetLanguages,
                unsyncedLanguages: Object.keys(targetLanguages).filter(
                    locale => targetLanguages[locale].needsSync
                )
            };

        } catch (error) {
            console.error('Error getting unsync info:', error);
            throw error;
        }
    }

    /**
     * Find missing translations between source and target
     * @param {Object} sourceTranslations - Source translations
     * @param {Object} targetTranslations - Target translations
     * @returns {Object} Missing translation info
     */
    findMissingTranslations(sourceTranslations, targetTranslations) {
        const missingSections = [];
        const missingKeys = {};
        let totalMissingKeys = 0;

        Object.keys(sourceTranslations).forEach((sectionKey) => {
            const sourceSection = sourceTranslations[sectionKey];
            const targetSection = targetTranslations[sectionKey];

            if (!targetSection) {
                // Entire section missing
                missingSections.push(sectionKey);
                totalMissingKeys += Object.keys(sourceSection).length;
                missingKeys[sectionKey] = Object.keys(sourceSection);
            } else {
                // Check for missing keys within section
                const sectionMissingKeys = [];

                Object.keys(sourceSection).forEach((key) => {
                    if (!targetSection[key]) {
                        sectionMissingKeys.push(key);
                        totalMissingKeys++;
                    }
                });

                if (sectionMissingKeys.length > 0) {
                    missingKeys[sectionKey] = sectionMissingKeys;
                }
            }
        });

        return {
            missingSections,
            missingKeys,
            totalMissingKeys
        };

        return {
            missingSections,
            missingKeys,
            totalMissingKeys
        };
    }

    /**
     * Calculate sync progress percentage
     * @param {Object} sourceTranslations - Source translations
     * @param {Object} targetTranslations - Target translations
     * @returns {number} Progress percentage (0-100)
     */
    calculateSyncProgress(sourceTranslations, targetTranslations) {
        const totalSourceKeys = this.countTotalKeys(sourceTranslations);
        const totalTargetKeys = this.countTotalKeys(targetTranslations);
        
        if (totalSourceKeys === 0) return 100;
        return Math.round((totalTargetKeys / totalSourceKeys) * 100);
    }

    /**
     * Count total translation keys in translations object
     * @param {Object} translations - Translations object
     * @returns {number} Total key count
     */
    countTotalKeys(translations) {
        let count = 0;
        Object.values(translations).forEach(section => {
            if (typeof section === 'object' && section !== null) {
                count += Object.keys(section).length;
            }
        });
        return count;
    }

    /**
     * Validate if a locale code is valid format
     * @param {string} locale - Locale code to validate
     * @returns {boolean} True if valid format
     */
    isValidLocaleFormat(locale) {
        // Simple validation: 2-letter code or 2-letter with country variant
        const localePattern = /^[a-z]{2}(-[A-Z]{2})?$/;
        return localePattern.test(locale);
    }
}

module.exports = new LanguageService(); 