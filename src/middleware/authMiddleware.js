const authService = require('../services/AuthService');
const ResponseBuilder = require('../utils/responseBuilder');
const { logger } = require('../utils/logger');
const { AuthenticationError } = require('../utils/errors');

/**
 * Enhanced Authentication Middleware
 */

/**
 * Authenticate user using JWT token
 */
const authenticate = (req, res, next) => {
    try {
        const token = req.headers['x-access-token'];

        if (!token) {
            logger.warn('Missing authentication token', {
                requestId: req.requestId,
                url: req.url,
                method: req.method
            });

            return ResponseBuilder.unauthorized(res, 'Authentication token required');
        }

        // Verify token using AuthService
        const verificationResult = authService.verifyToken(token);

        // Attach user info to request
        req.user = verificationResult.user;
        req.tokenExpiry = verificationResult.expiresAt;

        logger.info('User authenticated', {
            requestId: req.requestId,
            user: req.user.role,
            tokenExpiry: verificationResult.expiresAt
        });

        next();
    } catch (error) {
        logger.warn('Authentication failed', {
            requestId: req.requestId,
            error: error.message,
            url: req.url
        });

        if (error instanceof AuthenticationError) {
            return ResponseBuilder.unauthorized(res, error.message);
        }

        return ResponseBuilder.unauthorized(res, 'Authentication failed');
    }
};

/**
 * Authorize user for specific operations
 * @param {string|Array} permissions - Required permission(s)
 * @returns {Function} Authorization middleware
 */
const authorize = (permissions) => {
    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];

    return (req, res, next) => {
        try {
            if (!req.user) {
                logger.warn('Authorization attempted without authentication', {
                    requestId: req.requestId,
                    url: req.url
                });

                return ResponseBuilder.unauthorized(res, 'Authentication required');
            }

            // Check if user has any of the required permissions
            const hasPermission = requiredPermissions.some((permission) => 
                authService.hasPermission(req.user, permission)
            );

            if (!hasPermission) {
                logger.warn('Authorization failed - insufficient permissions', {
                    requestId: req.requestId,
                    user: req.user.role,
                    requiredPermissions,
                    url: req.url
                });

                return ResponseBuilder.forbidden(res, 'Insufficient permissions');
            }

            logger.info('User authorized', {
                requestId: req.requestId,
                user: req.user.role,
                permissions: requiredPermissions
            });

            next();
        } catch (error) {
            logger.error('Authorization error', {
                requestId: req.requestId,
                error: error.message,
                user: req.user?.role
            });

            return ResponseBuilder.forbidden(res, 'Authorization failed');
        }
    };
};

/**
 * Role-based authorization
 * @param {string|Array} roles - Required role(s)
 * @returns {Function} Role authorization middleware
 */
const requireRole = (roles) => {
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    return (req, res, next) => {
        if (!req.user) {
            return ResponseBuilder.unauthorized(res, 'Authentication required');
        }

        if (!requiredRoles.includes(req.user.role)) {
            logger.warn('Role authorization failed', {
                requestId: req.requestId,
                userRole: req.user.role,
                requiredRoles,
                url: req.url
            });

            return ResponseBuilder.forbidden(res, `Access denied. Required role: ${requiredRoles.join(' or ')}`);
        }

        next();
    };
};

/**
 * Admin only access
 */
const requireAdmin = requireRole('admin');

/**
 * Optional authentication - sets user if token is present but doesn't fail if missing
 */
const optionalAuth = (req, res, next) => {
    const token = req.headers['x-access-token'];

    if (!token) {
        return next();
    }

    try {
        const verificationResult = authService.verifyToken(token);

        req.user = verificationResult.user;
        req.tokenExpiry = verificationResult.expiresAt;

        logger.info('Optional authentication successful', {
            requestId: req.requestId,
            user: req.user.role
        });
    } catch (error) {
        // For optional auth, we don't fail on invalid tokens
        logger.info('Optional authentication failed - continuing', {
            requestId: req.requestId,
            error: error.message
        });
    }

    next();
};

/**
 * Check if route should be public (no authentication required)
 */
const isPublicRoute = (req) => {
    const publicRoutes = [
        '/login',
        '/api/uitranslate/sync-progress/',
        '/health',
        '/api/docs'
    ];

    return publicRoutes.some((route) => req.url.startsWith(route));
};

/**
 * Smart authentication middleware - applies authentication based on route
 */
const smartAuth = (req, res, next) => {
    // Skip authentication for public routes
    if (isPublicRoute(req)) {
        return optionalAuth(req, res, next);
    }

    // Require authentication for all other routes
    return authenticate(req, res, next);
};

module.exports = {
    authenticate,
    authorize,
    requireRole,
    requireAdmin,
    optionalAuth,
    smartAuth,
    isPublicRoute
}; 