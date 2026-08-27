const express = require('express');
const router = express.Router();

// Import controllers
const authController = require('../controllers/AuthController');
const uiTranslationController = require('../controllers/UiTranslationController');
const userController = require('../controllers/UserController');

// Import middleware
const { authenticate, requireAdmin, optionalAuth } = require('../middleware/authMiddleware');
const { validateBody, validateQuery, validateParams } = require('../middleware/validation');
const { authRateLimit, generalRateLimit, syncRateLimit, userManagementRateLimit } = require('../middleware/security');
const { UiTranslationDTOs, UserDTOs, AuthDTOs } = require('../dto');

// Create parameter validation schemas
const Joi = require('joi');
const projectIDSchema = Joi.object({
    projectID: Joi.number().integer().positive().required()
});
const usernameSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required()
});
const jobIdSchema = Joi.object({
    jobId: Joi.string().required()
});

// =============================================================================
// AUTHENTICATION ROUTES
// =============================================================================

/**
 * @route POST /login
 * @desc User login
 * @access Public
 */
router.post('/login', 
    authRateLimit,
    validateBody(AuthDTOs.login),
    authController.login
);

/**
 * @route POST /auth/refresh
 * @desc Refresh JWT token
 * @access Private
 */
router.post('/auth/refresh',
    generalRateLimit,
    validateBody(Joi.object({ token: Joi.string().required() })),
    authController.refreshToken
);

/**
 * @route POST /auth/logout
 * @desc Logout user
 * @access Private
 */
router.post('/auth/logout',
    authenticate,
    authController.logout
);

/**
 * @route POST /auth/verify
 * @desc Verify JWT token
 * @access Public
 */
router.post('/auth/verify',
    validateBody(Joi.object({ token: Joi.string().required() })),
    authController.verifyToken
);

/**
 * @route GET /auth/permissions/:role
 * @desc Get permissions for a role
 * @access Private (Admin)
 */
router.get('/auth/permissions/:role',
    authenticate,
    requireAdmin,
    validateParams(Joi.object({ role: Joi.string().valid('admin', 'translater').required() })),
    authController.getUserPermissions
);

// =============================================================================
// UI TRANSLATIONS ROUTES
// =============================================================================

/**
 * @route GET /uitranslate/:projectID
 * @desc Get translations for a project (PUBLIC ENDPOINT)
 * @access Public
 */
router.get('/uitranslate/:projectID',
    generalRateLimit,
    validateParams(projectIDSchema),
    validateQuery(UiTranslationDTOs.getTranslations),
    uiTranslationController.getTranslations
);

// =============================================================================
// PRIVATE UI TRANSLATIONS API ROUTES
// =============================================================================

/**
 * @route GET /api/uitranslate/list
 * @desc Get list of all projects with their locales
 * @access Private
 */
router.get('/api/uitranslate/list',
    authenticate,
    generalRateLimit,
    uiTranslationController.getProjectsList
);

/**
 * @route GET /api/uitranslate/item
 * @desc Get specific translation document
 * @access Private
 */
router.get('/api/uitranslate/item',
    authenticate,
    generalRateLimit,
    validateQuery(UiTranslationDTOs.getTranslationItem),
    uiTranslationController.getTranslationItem
);

/**
 * @route POST /api/uitranslate/merge
 * @desc Update translation document with safe merge (RECOMMENDED)
 * @access Private
 */
router.post('/api/uitranslate/merge',
    authenticate,
    generalRateLimit,
    validateBody(UiTranslationDTOs.updateTranslation),
    uiTranslationController.updateTranslationsWithMerge
);

/**
 * @route POST /api/uitranslate/sections
 * @desc Update translation sections atomically
 * @access Private
 */
router.post('/api/uitranslate/sections',
    authenticate,
    generalRateLimit,
    validateBody(UiTranslationDTOs.updateTranslation),
    uiTranslationController.updateTranslationSections
);

/**
 * @route POST /api/uitranslate/item
 * @desc Update translation document (LEGACY - direct replacement)
 * @access Private
 */
router.post('/api/uitranslate/item',
    authenticate,
    generalRateLimit,
    validateBody(UiTranslationDTOs.updateTranslation),
    uiTranslationController.updateTranslations
);

/**
 * @route PUT /api/uitranslate/item
 * @desc Create new translation document
 * @access Private
 */
router.put('/api/uitranslate/item',
    authenticate,
    generalRateLimit,
    validateBody(UiTranslationDTOs.createTranslation),
    uiTranslationController.createTranslation
);

/**
 * @route DELETE /api/uitranslate/item
 * @desc Delete translation document
 * @access Private
 */
router.delete('/api/uitranslate/item',
    authenticate,
    generalRateLimit,
    validateQuery(UiTranslationDTOs.deleteTranslation),
    uiTranslationController.deleteTranslation
);

// =============================================================================
// LANGUAGE MANAGEMENT ROUTES
// =============================================================================

/**
 * @route GET /api/uitranslate/languages/:projectID
 * @desc Get available languages for a project
 * @access Private
 */
router.get('/api/uitranslate/languages/:projectID',
    authenticate,
    generalRateLimit,
    validateParams(projectIDSchema),
    uiTranslationController.getProjectLanguages
);

/**
 * @route POST /api/uitranslate/add-language
 * @desc Add new language to project
 * @access Private
 */
router.post('/api/uitranslate/add-language',
    authenticate,
    generalRateLimit,
    validateBody(UiTranslationDTOs.addLanguage),
    uiTranslationController.addLanguage
);

/**
 * @route GET /api/uitranslate/unsync-info/:projectID
 * @desc Get unsynchronized translation info
 * @access Private
 */
router.get('/api/uitranslate/unsync-info/:projectID',
    authenticate,
    generalRateLimit,
    validateParams(projectIDSchema),
    uiTranslationController.getUnsyncInfo
);

// =============================================================================
// TRANSLATION SYNC ROUTES
// =============================================================================

/**
 * @route POST /api/uitranslate/sync-flexible
 * @desc Start flexible translation sync
 * @access Private
 */
router.post('/api/uitranslate/sync-flexible',
    authenticate,
    syncRateLimit,
    validateBody(UiTranslationDTOs.syncRequest),
    uiTranslationController.startFlexibleSync
);

/**
 * @route GET /api/uitranslate/sync-progress/:jobId
 * @desc Get translation sync progress (PUBLIC for polling)
 * @access Public
 */
router.get('/api/uitranslate/sync-progress/:jobId',
    optionalAuth,
    generalRateLimit,
    validateParams(jobIdSchema),
    uiTranslationController.getSyncProgress
);

/**
 * @route GET /api/uitranslate/sync-status/:projectID/:targetLocale
 * @desc Get sync status for specific locale
 * @access Private
 */
router.get('/api/uitranslate/sync-status/:projectID/:targetLocale',
    authenticate,
    generalRateLimit,
    validateParams(Joi.object({
        projectID: Joi.number().integer().positive().required(),
        targetLocale: Joi.string().pattern(/^[a-z]{2}(-[A-Z]{2})?$/).required()
    })),
    uiTranslationController.getSyncStatus
);

// =============================================================================
// BACKUP ROUTES
// =============================================================================

/**
 * @route GET /api/uitranslate/backup
 * @desc Get list of backup documents
 * @access Private (Admin)
 */
router.get('/api/uitranslate/backup',
    authenticate,
    requireAdmin,
    generalRateLimit,
    uiTranslationController.getBackupsList
);

/**
 * @route POST /api/uitranslate/backup
 * @desc Restore translation from backup
 * @access Private (Admin)
 */
router.post('/api/uitranslate/backup',
    authenticate,
    requireAdmin,
    generalRateLimit,
    validateBody(UiTranslationDTOs.backupRestore),
    uiTranslationController.restoreFromBackup
);

// =============================================================================
// USER MANAGEMENT ROUTES
// =============================================================================

/**
 * @route GET /api/users
 * @desc Get all users
 * @access Private (Admin)
 */
router.get('/api/users',
    authenticate,
    requireAdmin,
    userManagementRateLimit,
    userController.getAllUsers
);

/**
 * @route PUT /api/users
 * @desc Create new user
 * @access Private (Admin)
 */
router.put('/api/users',
    authenticate,
    requireAdmin,
    userManagementRateLimit,
    validateBody(UserDTOs.createUser),
    userController.createUser
);

/**
 * @route DELETE /api/users
 * @desc Delete user
 * @access Private (Admin)
 */
router.delete('/api/users',
    authenticate,
    requireAdmin,
    userManagementRateLimit,
    validateQuery(UserDTOs.deleteUser),
    userController.deleteUser
);

/**
 * @route GET /api/users/stats
 * @desc Get user statistics
 * @access Private (Admin)
 */
router.get('/api/users/stats',
    authenticate,
    requireAdmin,
    generalRateLimit,
    userController.getUserStats
);

/**
 * @route GET /api/users/by-role/:role
 * @desc Get users by role
 * @access Private (Admin)
 */
router.get('/api/users/by-role/:role',
    authenticate,
    requireAdmin,
    generalRateLimit,
    validateParams(Joi.object({ role: Joi.string().valid('admin', 'translater').required() })),
    userController.getUsersByRole
);

/**
 * @route GET /api/users/:username
 * @desc Get user by username
 * @access Private (Admin)
 */
router.get('/api/users/:username',
    authenticate,
    requireAdmin,
    generalRateLimit,
    validateParams(usernameSchema),
    userController.getUserByUsername
);

/**
 * @route PATCH /api/users/:username
 * @desc Update user information
 * @access Private (Admin)
 */
router.patch('/api/users/:username',
    authenticate,
    requireAdmin,
    userManagementRateLimit,
    validateParams(usernameSchema),
    userController.updateUser
);

/**
 * @route POST /api/users/:username/change-password
 * @desc Change user password
 * @access Private
 */
router.post('/api/users/:username/change-password',
    authenticate,
    userManagementRateLimit,
    validateParams(usernameSchema),
    validateBody(Joi.object({
        currentPassword: Joi.string().min(1).required(),
        newPassword: Joi.string().min(6).required()
    })),
    userController.changePassword
);

/**
 * @route POST /api/users/:username/reset-password
 * @desc Reset user password (admin only)
 * @access Private (Admin)
 */
router.post('/api/users/:username/reset-password',
    authenticate,
    requireAdmin,
    userManagementRateLimit,
    validateParams(usernameSchema),
    validateBody(Joi.object({
        newPassword: Joi.string().min(6).required()
    })),
    userController.resetPassword
);

// =============================================================================
// HEALTH CHECK ROUTE
// =============================================================================

/**
 * @route GET /health
 * @desc Health check endpoint
 * @access Public
 */
router.get('/health', (req, res) => {
    const ResponseBuilder = require('../utils/responseBuilder');
    
    ResponseBuilder.success(res, {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
    }, 'Service is healthy');
});

module.exports = router; 