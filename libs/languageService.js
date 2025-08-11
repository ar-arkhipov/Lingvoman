/**
 * Language Service - Manage available languages and translation info
 */
const { UiTran } = require('./mongoose.js');
const crypto = require('crypto');

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
            });

            // English is always the master/source language
            const masterLanguage = 'en';
            const hasEnglish = languages[masterLanguage];

            return {
                projectID: parseInt(projectID),
                sourceLanguage: hasEnglish ? masterLanguage : Object.keys(languages)[0] || null,
                availableLanguages: Object.keys(languages),
                languageDetails: languages,
                hasSource: !!hasEnglish || Object.keys(languages).length > 0
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
            // Default to English as master language if not provided
            if (!sourceLocale) {
                sourceLocale = 'en'; // English is always the master language
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
            const sourceBase = sourceDoc.baseHashMap || this.buildBaseHashMap(sourceTranslations || {});
            const targetLanguages = {};

            // Analyze each target language
            allDocs.forEach((doc) => {
                if (doc.locale === sourceLocale) return;

                const targetLocale = doc.locale;
                const targetTranslations = doc.translations || {};
                const syncDifferences = this.findSyncDifferences(sourceTranslations, targetTranslations);
                const targetBase = doc.baseHashMap || {};
                const changedInfo = this.findChangedFromBase(sourceBase, targetBase);

                targetLanguages[targetLocale] = {
                    locale: targetLocale,
                    totalSections: Object.keys(sourceTranslations).length,
                    translatedSections: Object.keys(targetTranslations).length,
                    missingSections: syncDifferences.missing.missingSections,
                    missingKeys: syncDifferences.missing.missingKeys,
                    totalMissingKeys: syncDifferences.missing.totalMissingKeys,
                    extraSections: syncDifferences.extra.extraSections,
                    extraKeys: syncDifferences.extra.extraKeys,
                    totalExtraKeys: syncDifferences.extra.totalExtraKeys,
                    changedSections: changedInfo.changedSections,
                    changedKeys: changedInfo.changedKeys,
                    totalChangedKeys: changedInfo.totalChangedKeys,
                    syncProgress: this.calculateSyncProgress(sourceTranslations, targetTranslations),
                    lastModified: doc.updatedAt || doc.createdAt,
                    needsSync:
                        syncDifferences.missing.totalMissingKeys > 0
                        || syncDifferences.extra.totalExtraKeys > 0
                        || changedInfo.totalChangedKeys > 0
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
                    (locale) => targetLanguages[locale].needsSync
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
    }

    /**
     * Find sync differences between master and target languages
     * Detects both missing keys (to add) and extra keys (to remove)
     * @param {Object} masterTranslations - Master language translations (English)
     * @param {Object} targetTranslations - Target language translations
     * @returns {Object} Sync differences info
     */
    findSyncDifferences(masterTranslations, targetTranslations) {
        const missingSections = [];
        const missingKeys = {};
        const extraSections = [];
        const extraKeys = {};
        let totalMissingKeys = 0;
        let totalExtraKeys = 0;

        // Find missing keys (existing logic from findMissingTranslations)
        Object.keys(masterTranslations).forEach((sectionKey) => {
            const masterSection = masterTranslations[sectionKey];
            const targetSection = targetTranslations[sectionKey];

            if (!targetSection) {
                // Entire section missing
                missingSections.push(sectionKey);
                totalMissingKeys += Object.keys(masterSection).length;
                missingKeys[sectionKey] = Object.keys(masterSection);
            } else {
                // Check for missing keys within section
                const sectionMissingKeys = [];

                Object.keys(masterSection).forEach((key) => {
                    if (!targetSection[key]) {
                        sectionMissingKeys.push(key);
                        totalMissingKeys++;
                    }
                });

                if (sectionMissingKeys.length > 0) {
                    // Always return the section when it contains missing keys
                    if (missingSections.indexOf(sectionKey) === -1) {
                        missingSections.push(sectionKey);
                    }

                    missingKeys[sectionKey] = sectionMissingKeys;
                }
            }
        });

        // Find extra keys (NEW - keys that exist in target but not in master)
        Object.keys(targetTranslations).forEach((sectionKey) => {
            const targetSection = targetTranslations[sectionKey];
            const masterSection = masterTranslations[sectionKey];

            if (!masterSection) {
                // Entire section is extra
                extraSections.push(sectionKey);
                totalExtraKeys += Object.keys(targetSection).length;
                extraKeys[sectionKey] = Object.keys(targetSection);
            } else {
                // Check for extra keys within section
                const sectionExtraKeys = [];

                Object.keys(targetSection).forEach((key) => {
                    if (!masterSection[key]) {
                        sectionExtraKeys.push(key);
                        totalExtraKeys++;
                    }
                });

                if (sectionExtraKeys.length > 0) {
                    // Always return the section when it contains extra keys
                    if (extraSections.indexOf(sectionKey) === -1) {
                        extraSections.push(sectionKey);
                    }

                    extraKeys[sectionKey] = sectionExtraKeys;
                }
            }
        });

        return {
            missing: {
                missingSections,
                missingKeys,
                totalMissingKeys
            },
            extra: {
                extraSections,
                extraKeys,
                totalExtraKeys
            }
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

        if (totalSourceKeys === 0) return 100;

        // Count keys present in both (matched)
        let matchedKeys = 0;

        Object.keys(sourceTranslations).forEach((sectionKey) => {
            const sourceSection = sourceTranslations[sectionKey];
            const targetSection = targetTranslations[sectionKey] || {};

            if (sourceSection && typeof sourceSection === 'object') {
                Object.keys(sourceSection).forEach((key) => {
                    if (Object.prototype.hasOwnProperty.call(targetSection, key)) {
                        matchedKeys++;
                    }
                });
            }
        });

        // Count extra keys present only in target
        let extraKeysCount = 0;

        Object.keys(targetTranslations).forEach((sectionKey) => {
            const targetSection = targetTranslations[sectionKey];
            const sourceSection = sourceTranslations[sectionKey] || {};

            if (targetSection && typeof targetSection === 'object') {
                Object.keys(targetSection).forEach((key) => {
                    if (!Object.prototype.hasOwnProperty.call(sourceSection, key)) {
                        extraKeysCount++;
                    }
                });
            }
        });

        // Extras reduce progress by increasing denominator
        const denominator = totalSourceKeys + extraKeysCount;
        const progress = Math.floor((matchedKeys / denominator) * 100);

        return Math.max(0, Math.min(100, progress));
    }

    /**
     * Count total translation keys in translations object
     * @param {Object} translations - Translations object
     * @returns {number} Total key count
     */
    countTotalKeys(translations) {
        let count = 0;

        Object.values(translations).forEach((section) => {
            if (typeof section === 'object' && section !== null) {
                count += Object.keys(section).length;
            }
        });

        return count;
    }

    /**
     * Normalize translation string for hashing comparisons
     * - Trim
     * - Collapse all whitespace sequences to a single space
     * - Keep punctuation significant
     * @param {string} value
     * @returns {string}
     */
    normalizeTranslationString(value) {
        if (typeof value !== 'string') {
            return '';
        }

        return value.trim().replace(/\s+/g, ' ');
    }

    /**
     * Build base hash map for a translations object.
     * The returned object mirrors the structure of translations (section -> key -> hash).
     * @param {Object} translations
     * @returns {Object}
     */
    buildBaseHashMap(translations = {}) {
        const result = {};

        if (!translations || typeof translations !== 'object') return result;

        Object.keys(translations).forEach((sectionKey) => {
            const section = translations[sectionKey];
            
            if (!section || typeof section !== 'object') {
                return;
            }

            const sectionHashMap = {};

            
            
            Object.keys(section).forEach((key) => {
                const value = section[key];
                
                if (typeof value !== 'string') {
                    return;
                }

                const normalized = this.normalizeTranslationString(value);
                const pathAndValue = `${sectionKey}/${key}|${normalized}`;
                const hash = crypto.createHash('sha256').update(pathAndValue).digest('hex');

                sectionHashMap[key] = hash;
            });

            
            
            if (Object.keys(sectionHashMap).length > 0) {
                result[sectionKey] = sectionHashMap;
            }
        });

        return result;
    }

    /**
     * Compare two base hash maps and find changed keys (by hash inequality).
     * Only considers keys present in the source (English) base map.
     * If target (locale) base map doesn't have a key present in the source map,
     * it's considered changed.
     * @param {Object} sourceBaseHashMap - English base hash map
     * @param {Object} targetBaseHashMap - Locale snapshot base hash map
     * @returns {{changedSections: string[], changedKeys: Object, totalChangedKeys: number}}
     */
    findChangedFromBase(sourceBaseHashMap = {}, targetBaseHashMap = {}) {
        const changedSections = [];
        const changedKeys = {};
        let totalChangedKeys = 0;

        Object.keys(sourceBaseHashMap).forEach((sectionKey) => {
            const sourceSection = sourceBaseHashMap[sectionKey] || {};
            const targetSection = targetBaseHashMap[sectionKey] || {};

            const sectionChanged = [];

            
            Object.keys(sourceSection).forEach((key) => {
                const sourceHash = sourceSection[key];
                const targetHash = targetSection[key];

                if (!targetHash || targetHash !== sourceHash) {
                    sectionChanged.push(key);
                    totalChangedKeys++;
                }
            });

            
            if (sectionChanged.length > 0) {
                changedSections.push(sectionKey);
                changedKeys[sectionKey] = sectionChanged;
            }
        });

        return { changedSections, changedKeys, totalChangedKeys };
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
