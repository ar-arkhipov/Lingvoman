const authService = require('../services/AuthService');
const ResponseBuilder = require('../utils/responseBuilder');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Authentication Controller - HTTP Request/Response Layer
 */
class AuthController {
    /**
     * User login
     * POST /login
     */
    login = asyncHandler(async (req, res) => {
        const { username, password } = req.body;

        const authResult = await authService.login(username, password);

        return ResponseBuilder.success(
            res,
            authResult,
            'Login successful'
        );
    });

    /**
     * Refresh JWT token
     * POST /auth/refresh
     */
    refreshToken = asyncHandler(async (req, res) => {
        const { token } = req.body;

        const refreshResult = await authService.refreshToken(token);

        return ResponseBuilder.success(
            res,
            refreshResult,
            'Token refreshed successfully'
        );
    });

    /**
     * Logout user
     * POST /auth/logout
     */
    logout = asyncHandler(async (req, res) => {
        const token = req.headers['x-access-token'];

        const logoutResult = authService.logout(token);

        return ResponseBuilder.success(
            res,
            logoutResult,
            'Logout successful'
        );
    });

    /**
     * Verify token
     * POST /auth/verify
     */
    verifyToken = asyncHandler(async (req, res) => {
        const { token } = req.body;

        const verificationResult = authService.verifyToken(token);

        return ResponseBuilder.success(
            res,
            verificationResult,
            'Token verified successfully'
        );
    });

    /**
     * Check user authorization
     * POST /auth/check-permission
     */
    checkPermission = asyncHandler(async (req, res) => {
        const { user, permission } = req.body;

        const hasPermission = authService.hasPermission(user, permission);

        return ResponseBuilder.success(
            res,
            { hasPermission, permission },
            'Permission check completed'
        );
    });

    /**
     * Validate password strength
     * POST /auth/validate-password
     */
    validatePassword = asyncHandler(async (req, res) => {
        const { password } = req.body;

        const validation = authService.validatePasswordStrength(password);

        return ResponseBuilder.success(
            res,
            validation,
            'Password validation completed'
        );
    });

    /**
     * Get user permissions
     * GET /auth/permissions/:role
     */
    getUserPermissions = asyncHandler(async (req, res) => {
        const { role } = req.params;

        const permissions = authService.getRolePermissions(role);

        return ResponseBuilder.success(
            res,
            { role, permissions },
            'User permissions retrieved successfully'
        );
    });
}

module.exports = new AuthController(); 