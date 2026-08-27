const { UiTran, UiReservedTran } = require('../../libs/mongoose.js');
const languageService = require('../../libs/languageService');
const { logger } = require('../utils/logger');
const { DatabaseError, NotFoundError } = require('../utils/errors');

/**
 * UI Translation Repository - Data Access Layer
 */
class UiTranslationRepository {
    /**
     * Find translation document by project ID and locale
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code
     * @returns {Promise<Object|null>} Translation document or null
     */
    async findByProjectAndLocale(projectID, locale) {
        try {
            const doc = await UiTran.findOne({
                projectID: parseInt(projectID),
                locale
            });

            return doc;
        } catch (error) {
            logger.error('Database error in findByProjectAndLocale', {
                projectID,
                locale,
                error: error.message
            });
            throw new DatabaseError('Failed to find translation document', { projectID, locale });
        }
    }

    /**
     * Find all translation documents for a project
     * @param {number} projectID - Project ID
     * @returns {Promise<Array>} Array of translation documents
     */
    async findByProject(projectID) {
        try {
            const docs = await UiTran.find({
                projectID: parseInt(projectID)
            });

            return docs;
        } catch (error) {
            logger.error('Database error in findByProject', {
                projectID,
                error: error.message
            });
            throw new DatabaseError('Failed to find project translations', { projectID });
        }
    }

    /**
     * Get aggregated list of all projects with their locales
     * @returns {Promise<Array>} Aggregated project data
     */
    async getProjectsList() {
        try {
            const data = await UiTran.aggregate([
                {
                    $group: {
                        _id: { projectID: '$projectID', alpha: '$projectAlphaId' },
                        locales: { $addToSet: '$locale' }
                    }
                },
                {
                    $project: {
                        projectID: '$_id.projectID',
                        projectAlphaId: '$_id.alpha',
                        locales: 1
                    }
                },
                { $sort: { projectAlphaId: 1 } }
            ]);

            // Ensure 'en' is first in locales array for each project
            data.forEach((project) => {
                if (Array.isArray(project.locales)) {
                    project.locales.sort((a, b) => {
                        let result;

                        if (a === 'en') {
                            result = -1;
                        } else if (b === 'en') {
                            result = 1;
                        } else {
                            result = a.localeCompare(b);
                        }

                        return result;
                    });
                }
            });

            return data;
        } catch (error) {
            logger.error('Database error in getProjectsList', {
                error: error.message
            });
            throw new DatabaseError('Failed to get projects list');
        }
    }

    /**
     * Get available locales for a project
     * @param {number} projectID - Project ID
     * @returns {Promise<Object>} Project locales data
     */
    async getProjectLocales(projectID) {
        try {
            const data = await UiTran.aggregate([
                { $match: { projectID: parseInt(projectID) } },
                {
                    $group: {
                        _id: '$projectID',
                        locales: { $addToSet: '$locale' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        locales: 1
                    }
                }
            ]);

            return data[0] || { locales: [] };
        } catch (error) {
            logger.error('Database error in getProjectLocales', {
                projectID,
                error: error.message
            });
            throw new DatabaseError('Failed to get project locales', { projectID });
        }
    }

    /**
     * Create new translation document
     * @param {Object} translationData - Translation document data
     * @returns {Promise<Object>} Created document
     */
    async create(translationData) {
        try {
            const doc = await UiTran.create({
                projectID: parseInt(translationData.projectID),
                projectAlphaId: translationData.projectAlphaId,
                locale: translationData.locale,
                translations: translationData.translations || {}
            });

            logger.info('Translation document created', {
                projectID: doc.projectID,
                locale: doc.locale,
                documentId: doc._id
            });

            // If English, compute and persist baseHashMap

            if (doc.locale === 'en') {
                const baseHashMap = languageService.buildBaseHashMap(doc.translations || {});

                await UiTran.updateOne(
                    { _id: doc._id },
                    { $set: { baseHashMap } }
                );
                doc.baseHashMap = baseHashMap;
            }

            return doc;
        } catch (error) {
            logger.error('Database error in create', {
                translationData,
                error: error.message
            });

            if (error.code === 11000) {
                throw new DatabaseError('Translation document already exists', translationData);
            }

            throw new DatabaseError('Failed to create translation document', translationData);
        }
    }

    /**
     * Deep merge utility to safely merge translation objects
     * @param {Object} existing - Existing translations
     * @param {Object} incoming - New translations to merge
     * @returns {Object} Safely merged translations
     */
    _deepMergeTranslations(existing = {}, incoming = {}) {
        const merged = { ...existing };

        Object.keys(incoming).forEach((sectionKey) => {
            const incomingSection = incoming[sectionKey];
            
            if (!incomingSection || typeof incomingSection !== 'object') {
                // Skip invalid sections
                logger.warn('Invalid section data detected, skipping', { sectionKey, incomingSection });

                return;
            }

            if (!merged[sectionKey] || typeof merged[sectionKey] !== 'object') {
                // New section entirely or replacing invalid existing section
                merged[sectionKey] = { ...incomingSection };
            } else {
                // Merge into existing section, preserving existing keys
                merged[sectionKey] = {
                    ...merged[sectionKey],
                    ...incomingSection
                };
            }
        });

        return merged;
    }

    /**
     * Validate translation data structure
     * @param {Object} translations - Translations to validate
     * @returns {Object} Validation result
     */
    _validateTranslationStructure(translations) {
        const issues = [];
        let keyCount = 0;

        if (!translations || typeof translations !== 'object') {
            return { isValid: false, issues: ['Translations must be an object'], keyCount: 0 };
        }

        Object.keys(translations).forEach((sectionKey) => {
            const section = translations[sectionKey];
            
            if (!section || typeof section !== 'object') {
                issues.push(`Section '${sectionKey}' is not a valid object`);

                return;
            }

            const sectionKeys = Object.keys(section);

            keyCount += sectionKeys.length;

            // Check for empty sections
            if (sectionKeys.length === 0) {
                issues.push(`Section '${sectionKey}' is empty`);
            }

            // Validate section content
            sectionKeys.forEach((key) => {
                const value = section[key];
                const isString = typeof value === 'string';
                const isNil = value === null || value === undefined;

                if (!isString && !isNil) {
                    issues.push(
                        `Invalid value type in section '${sectionKey}', key '${key}': expected string, got ${typeof value}`
                    );
                }
            });
        });

        return {
            isValid: issues.length === 0,
            issues,
            keyCount,
            sectionCount: Object.keys(translations).length
        };
    }

    /**
     * Update translation document with safe merge strategy
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code
     * @param {Object} translations - Updated translations
     * @returns {Promise<Object>} Update result
     */
    async updateTranslations(projectID, locale, translations) {
        try {
            const query = {
                projectID: parseInt(projectID),
                locale
            };

            // Validate incoming translations
            const validation = this._validateTranslationStructure(translations);

            if (!validation.isValid) {
                logger.error('Invalid translation structure detected', {
                    projectID,
                    locale,
                    issues: validation.issues
                });
                throw new DatabaseError('Invalid translation structure', { 
                    projectID, 
                    locale, 
                    issues: validation.issues 
                });
            }

            const updateSet = { translations };

            // If English, recompute baseHashMap
            if (locale === 'en') {
                updateSet.baseHashMap = languageService.buildBaseHashMap(translations);
            }

            const result = await UiTran.updateOne(
                query,
                { $set: updateSet },
                { upsert: true }
            );

            logger.info('Translation document updated', {
                projectID,
                locale,
                modifiedCount: result.modifiedCount,
                upsertedCount: result.upsertedCount,
                keyCount: validation.keyCount,
                sectionCount: validation.sectionCount
            });

            return result;
        } catch (error) {
            logger.error('Database error in updateTranslations', {
                projectID,
                locale,
                error: error.message
            });
            throw new DatabaseError('Failed to update translation document', { projectID, locale });
        }
    }

    /**
     * Update translation document with optimistic locking
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code
     * @param {Object} translations - Updated translations to merge
     * @param {number} expectedVersion - Expected document version for optimistic locking
     * @returns {Promise<Object>} Update result with version info
     */
    async updateWithOptimisticLocking(projectID, locale, translations, expectedVersion) {
        try {
            const query = {
                projectID: parseInt(projectID),
                locale,
                version: expectedVersion
            };

            // Validate incoming translations
            const validation = this._validateTranslationStructure(translations);

            if (!validation.isValid) {
                throw new DatabaseError('Invalid translation structure for optimistic update', { 
                    projectID, 
                    locale, 
                    issues: validation.issues 
                });
            }

            // Increment version number
            const newVersion = (expectedVersion || 0) + 1;

            const result = await UiTran.updateOne(
                query,
                { 
                    $set: { 
                        translations,
                        version: newVersion,
                        lastModified: new Date()
                    } 
                },
                { upsert: false } // Don't create if version mismatch
            );

            if (result.matchedCount === 0) {
                // Version conflict or document not found
                const currentDoc = await this.findByProjectAndLocale(projectID, locale);

                if (!currentDoc) {
                    throw new NotFoundError('Translation document');
                } else {
                    throw new DatabaseError('Version conflict - document was modified by another process', {
                        projectID,
                        locale,
                        expectedVersion,
                        currentVersion: currentDoc.version || 0
                    });
                }
            }

            logger.info('Translation document updated with optimistic locking', {
                projectID,
                locale,
                oldVersion: expectedVersion,
                newVersion,
                keyCount: validation.keyCount,
                modifiedCount: result.modifiedCount
            });

            return {
                ...result,
                versionInfo: {
                    oldVersion: expectedVersion,
                    newVersion,
                    keyCount: validation.keyCount
                }
            };
        } catch (error) {
            logger.error('Database error in updateWithOptimisticLocking', {
                projectID,
                locale,
                expectedVersion,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Update translation document with safe merge strategy (prevents data loss)
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code
     * @param {Object} translations - Updated translations to merge
     * @param {Object} options - Update options
     * @returns {Promise<Object>} Update result with merge info
     */
    async mergeTranslations(projectID, locale, translations, options = {}) {
        try {
            const query = {
                projectID: parseInt(projectID),
                locale
            };

            // Validate incoming translations
            const validation = this._validateTranslationStructure(translations);

            if (!validation.isValid) {
                logger.error('Invalid translation structure detected for merge', {
                    projectID,
                    locale,
                    issues: validation.issues
                });
                throw new DatabaseError('Invalid translation structure for merge', { 
                    projectID, 
                    locale, 
                    issues: validation.issues 
                });
            }

            // Get existing document
            const existingDoc = await this.findByProjectAndLocale(projectID, locale);
            
            let mergedTranslations;
            let isNewDocument = false;

            if (!existingDoc) {
                // New document - use incoming translations as-is
                mergedTranslations = translations;
                isNewDocument = true;
                
                logger.info('Creating new document with merge operation', {
                    projectID,
                    locale,
                    keyCount: validation.keyCount
                });
            } else {
                // Existing document - perform safe merge
                const existingValidation = this._validateTranslationStructure(existingDoc.translations || {});
                
                mergedTranslations = this._deepMergeTranslations(
                    existingDoc.translations || {}, 
                    translations
                );

                const mergedValidation = this._validateTranslationStructure(mergedTranslations);

                logger.info('Performing safe merge operation', {
                    projectID,
                    locale,
                    existingKeys: existingValidation.keyCount,
                    incomingKeys: validation.keyCount,
                    mergedKeys: mergedValidation.keyCount,
                    existingSections: existingValidation.sectionCount,
                    incomingSections: validation.sectionCount,
                    mergedSections: mergedValidation.sectionCount
                });

                // Validate that we didn't lose data unexpectedly
                if (mergedValidation.keyCount < existingValidation.keyCount && !options.allowDataLoss) {
                    logger.error('Potential data loss detected in merge operation', {
                        projectID,
                        locale,
                        existingKeys: existingValidation.keyCount,
                        mergedKeys: mergedValidation.keyCount,
                        lostKeys: existingValidation.keyCount - mergedValidation.keyCount
                    });
                    
                    throw new DatabaseError('Merge operation would result in data loss', {
                        projectID,
                        locale,
                        existingKeys: existingValidation.keyCount,
                        mergedKeys: mergedValidation.keyCount
                    });
                }
            }

            // Prepare update with version management
            const updateData = { 
                translations: mergedTranslations,
                lastModified: new Date()
            };

            // If English, recompute baseHashMap
            if (locale === 'en') {
                updateData.baseHashMap = languageService.buildBaseHashMap(mergedTranslations);
            }

            // Add version increment if document exists
            if (!isNewDocument && existingDoc.version !== undefined) {
                updateData.version = (existingDoc.version || 0) + 1;
            } else if (isNewDocument) {
                updateData.version = 1;
            }

            // Perform the update
            const result = await UiTran.updateOne(
                query,
                { $set: updateData },
                { upsert: true }
            );

            const finalValidation = this._validateTranslationStructure(mergedTranslations);

            logger.info('Translation document merged successfully', {
                projectID,
                locale,
                modifiedCount: result.modifiedCount,
                upsertedCount: result.upsertedCount,
                isNewDocument,
                finalKeyCount: finalValidation.keyCount,
                finalSectionCount: finalValidation.sectionCount,
                version: updateData.version
            });

            return {
                ...result,
                mergeInfo: {
                    isNewDocument,
                    finalKeyCount: finalValidation.keyCount,
                    finalSectionCount: finalValidation.sectionCount,
                    incomingKeyCount: validation.keyCount,
                    incomingSectionCount: validation.sectionCount,
                    version: updateData.version
                }
            };
        } catch (error) {
            logger.error('Database error in mergeTranslations', {
                projectID,
                locale,
                error: error.message
            });
            throw new DatabaseError('Failed to merge translation document', { projectID, locale });
        }
    }

    /**
     * Update specific translation sections atomically
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code
     * @param {Object} sectionUpdates - Object with section keys and their updates
     * @returns {Promise<Object>} Update result
     */
    async updateSections(projectID, locale, sectionUpdates) {
        try {
            const query = {
                projectID: parseInt(projectID),
                locale
            };

            // Build MongoDB update operations for each section
            const updateOperations = {};
            let totalKeys = 0;

            Object.keys(sectionUpdates).forEach((sectionKey) => {
                const sectionData = sectionUpdates[sectionKey];
                
                if (!sectionData || typeof sectionData !== 'object') {
                    logger.warn('Invalid section data for atomic update', { sectionKey, sectionData });

                    return;
                }

                Object.keys(sectionData).forEach((key) => {
                    updateOperations[`translations.${sectionKey}.${key}`] = sectionData[key];
                    totalKeys++;
                });
            });

            if (Object.keys(updateOperations).length === 0) {
                throw new DatabaseError('No valid section updates provided', { projectID, locale });
            }

            // If English, we also need to update baseHashMap for the affected keys
            if (locale === 'en') {
                // Fetch current doc to rebuild only changed parts
                const currentDoc = await this.findByProjectAndLocale(projectID, locale);
                const currentTranslations = currentDoc?.translations || {};

                // Apply the sectionUpdates to a clone to compute new hashes
                const updatedTranslations = { ...currentTranslations };

                Object.keys(sectionUpdates).forEach((sectionKey) => {
                    updatedTranslations[sectionKey] = {
                        ...(currentTranslations[sectionKey] || {}),
                        ...sectionUpdates[sectionKey]
                    };
                });

                const newBaseHashMap = languageService.buildBaseHashMap(updatedTranslations);

                updateOperations['baseHashMap'] = newBaseHashMap;
            }

            const result = await UiTran.updateOne(
                query,
                { $set: updateOperations },
                { upsert: true }
            );

            logger.info('Translation sections updated atomically', {
                projectID,
                locale,
                modifiedCount: result.modifiedCount,
                upsertedCount: result.upsertedCount,
                updatedSections: Object.keys(sectionUpdates).length,
                updatedKeys: totalKeys
            });

            return result;
        } catch (error) {
            logger.error('Database error in updateSections', {
                projectID,
                locale,
                error: error.message
            });
            throw new DatabaseError('Failed to update translation sections', { projectID, locale });
        }
    }

    /**
     * Delete translation document
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code
     * @returns {Promise<Object>} Delete result
     */
    async delete(projectID, locale) {
        try {
            const query = {
                projectID: parseInt(projectID),
                locale
            };

            const result = await UiTran.deleteOne(query);

            if (result.deletedCount === 0) {
                throw new NotFoundError('Translation document');
            }

            logger.info('Translation document deleted', {
                projectID,
                locale,
                deletedCount: result.deletedCount
            });

            return result;
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }

            logger.error('Database error in delete', {
                projectID,
                locale,
                error: error.message
            });
            throw new DatabaseError('Failed to delete translation document', { projectID, locale });
        }
    }

    /**
     * Count documents for a project
     * @param {number} projectID - Project ID
     * @returns {Promise<number>} Document count
     */
    async countByProject(projectID) {
        try {
            const count = await UiTran.countDocuments({
                projectID: parseInt(projectID)
            });

            return count;
        } catch (error) {
            logger.error('Database error in countByProject', {
                projectID,
                error: error.message
            });
            throw new DatabaseError('Failed to count project documents', { projectID });
        }
    }

    /**
     * Backup translation document to reserved collection
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code
     * @returns {Promise<Object>} Backup result
     */
    async backup(projectID, locale) {
        try {
            const query = {
                projectID: parseInt(projectID),
                locale
            };

            // Find the current document
            const doc = await UiTran.findOne(query);

            if (!doc) {
                throw new NotFoundError('Translation document to backup');
            }

            // Create backup document (remove _id to allow insertion)
            const backupDoc = JSON.parse(JSON.stringify(doc));

            delete backupDoc._id;

            // Save to backup collection
            const result = await UiReservedTran.updateOne(
                query,
                backupDoc,
                { upsert: true, overwrite: true }
            );

            logger.info('Translation document backed up', {
                projectID,
                locale,
                modifiedCount: result.modifiedCount,
                upsertedCount: result.upsertedCount
            });

            return result;
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }

            logger.error('Database error in backup', {
                projectID,
                locale,
                error: error.message
            });
            throw new DatabaseError('Failed to backup translation document', { projectID, locale });
        }
    }

    /**
     * Get backup documents list
     * @returns {Promise<Array>} Aggregated backup data
     */
    async getBackupsList() {
        try {
            const data = await UiReservedTran.aggregate([
                {
                    $group: {
                        _id: { projectID: '$projectID', alpha: '$projectAlphaId' },
                        locales: { $addToSet: '$locale' }
                    }
                },
                {
                    $project: {
                        projectID: '$_id.projectID',
                        projectAlphaId: '$_id.alpha',
                        locales: 1
                    }
                }
            ]);

            return data;
        } catch (error) {
            logger.error('Database error in getBackupsList', {
                error: error.message
            });
            throw new DatabaseError('Failed to get backups list');
        }
    }

    /**
     * Restore translation document from backup
     * @param {number} projectID - Project ID
     * @param {string} locale - Locale code
     * @returns {Promise<Object>} Restore result
     */
    async restoreFromBackup(projectID, locale) {
        try {
            const query = {
                projectID: parseInt(projectID),
                locale
            };

            // Find backup document
            const backupDoc = await UiReservedTran.findOne(query);

            if (!backupDoc) {
                throw new NotFoundError('Backup document');
            }

            // Create restore document (remove _id to allow insertion)
            const restoreDoc = JSON.parse(JSON.stringify(backupDoc));

            delete restoreDoc._id;

            // Restore to main collection
            const result = await UiTran.updateOne(
                query,
                restoreDoc,
                { upsert: true }
            );

            logger.info('Translation document restored from backup', {
                projectID,
                locale,
                modifiedCount: result.modifiedCount,
                upsertedCount: result.upsertedCount
            });

            return result;
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }

            logger.error('Database error in restoreFromBackup', {
                projectID,
                locale,
                error: error.message
            });
            throw new DatabaseError('Failed to restore from backup', { projectID, locale });
        }
    }
}

module.exports = new UiTranslationRepository();
