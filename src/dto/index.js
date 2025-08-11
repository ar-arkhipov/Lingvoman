const Joi = require('joi');

/**
 * Common validation schemas
 */
const commonSchemas = {
    projectID: Joi.number().integer().positive().required(),
    locale: Joi.string().pattern(/^[a-z]{2}(-[A-Z]{2})?$/).required(),
    objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/)
};

/**
 * UI Translation DTOs
 */
const UiTranslationDTOs = {
    // Get translations request
    getTranslations: Joi.object({
        projectID: commonSchemas.projectID,
        lang: commonSchemas.locale.optional()
    }),

    // Get translation item request
    getTranslationItem: Joi.object({
        projectID: commonSchemas.projectID,
        locale: commonSchemas.locale
    }),

    // Create translation request
    createTranslation: Joi.object({
        projectID: commonSchemas.projectID,
        projectAlphaId: Joi.string().min(1).max(100).required(),
        locale: commonSchemas.locale,
        translations: Joi.object().pattern(
            Joi.string(),
            Joi.object().pattern(Joi.string(), Joi.string())
        ).optional().default({})
    }),

    // Update translation request
    updateTranslation: Joi.object({
        projectID: commonSchemas.projectID,
        locale: commonSchemas.locale,
        translations: Joi.object().pattern(
            Joi.string(),
            Joi.object().pattern(Joi.string(), Joi.string().allow(''))
        ).required()
    }),

    // Delete translation request
    deleteTranslation: Joi.object({
        projectID: commonSchemas.projectID,
        locale: commonSchemas.locale
    }),

    // Sync request
    syncRequest: Joi.object({
        projectID: commonSchemas.projectID,
        projectAlphaId: Joi.string().min(1).max(100).required(),
        targetLocale: commonSchemas.locale,
        sourceLocale: commonSchemas.locale.optional()
    }),

    // Add language request
    addLanguage: Joi.object({
        projectID: commonSchemas.projectID,
        projectAlphaId: Joi.string().min(1).max(100).required(),
        targetLocale: commonSchemas.locale
    }),

    // Backup restore request
    backupRestore: Joi.object({
        projectID: commonSchemas.projectID,
        locale: commonSchemas.locale
    })
};

/**
 * User Management DTOs
 */
const UserDTOs = {
    // Create user request
    createUser: Joi.object({
        username: Joi.string().alphanum().min(3).max(30).required(),
        password: Joi.string().min(6).max(128).required(),
        userObj: Joi.object({
            role: Joi.string().valid('admin', 'translater').required(),
            name: Joi.string().min(1).max(100).required()
        }).required()
    }),

    // Delete user request
    deleteUser: Joi.object({
        username: Joi.string().alphanum().min(3).max(30).required()
    })
};

/**
 * Authentication DTOs
 */
const AuthDTOs = {
    // Login request
    login: Joi.object({
        username: Joi.string().alphanum().min(3).max(30).required(),
        password: Joi.string().min(1).max(128).required()
    })
};

/**
 * Response DTOs
 */
const ResponseDTOs = {
    // Standard API response
    apiResponse: Joi.object({
        success: Joi.boolean().required(),
        message: Joi.string().allow(null),
        data: Joi.any().allow(null),
        error: Joi.object({
            message: Joi.string().required(),
            code: Joi.string().required(),
            details: Joi.any().allow(null)
        }).allow(null),
        meta: Joi.object({
            requestId: Joi.string().allow(null),
            timestamp: Joi.string().isoDate().required(),
            version: Joi.string().required()
        }).required()
    }),

    // Translation response
    translationResponse: Joi.object({
        projectID: commonSchemas.projectID,
        projectAlphaId: Joi.string(),
        locale: commonSchemas.locale,
        translations: Joi.object().pattern(
            Joi.string(),
            Joi.object().pattern(Joi.string(), Joi.string())
        )
    }),

    // User response
    userResponse: Joi.object({
        _id: commonSchemas.objectId,
        username: Joi.string(),
        userObj: Joi.object({
            role: Joi.string(),
            name: Joi.string()
        })
    }),

    // Job status response
    jobStatusResponse: Joi.object({
        id: Joi.string().required(),
        status: Joi.string().valid('pending', 'running', 'completed', 'failed').required(),
        progress: Joi.number().min(0).max(100).required(),
        message: Joi.string().required(),
        projectID: commonSchemas.projectID,
        targetLocale: commonSchemas.locale,
        sourceLocale: commonSchemas.locale,
        createdAt: Joi.date(),
        updatedAt: Joi.date(),
        result: Joi.object().allow(null)
    })
};

module.exports = {
    UiTranslationDTOs,
    UserDTOs, 
    AuthDTOs,
    ResponseDTOs,
    commonSchemas
}; 
