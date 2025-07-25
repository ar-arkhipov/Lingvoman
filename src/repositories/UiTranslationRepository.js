const { UiTran, UiReservedTran } = require('../../libs/mongoose.js');
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
     * Update translation document
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

            const result = await UiTran.updateOne(
                query,
                { $set: { translations } },
                { upsert: true }
            );

            logger.info('Translation document updated', {
                projectID,
                locale,
                modifiedCount: result.modifiedCount,
                upsertedCount: result.upsertedCount
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