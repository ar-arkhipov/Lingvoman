const userService = require('../services/UserService');
const ResponseBuilder = require('../utils/responseBuilder');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * User Controller - HTTP Request/Response Layer
 */
class UserController {
    /**
     * Get all users
     * GET /api/users
     */
    getAllUsers = asyncHandler(async (req, res) => {
        const users = await userService.getAllUsers();

        return ResponseBuilder.success(
            res,
            users,
            'Users retrieved successfully'
        );
    });

    /**
     * Get user by username
     * GET /api/users/:username
     */
    getUserByUsername = asyncHandler(async (req, res) => {
        const { username } = req.params;

        const user = await userService.getUserByUsername(username);

        return ResponseBuilder.success(
            res,
            user,
            'User retrieved successfully'
        );
    });

    /**
     * Create new user
     * PUT /api/users
     */
    createUser = asyncHandler(async (req, res) => {
        const userData = req.body;

        const createdUser = await userService.createUser(userData);

        return ResponseBuilder.success(
            res,
            createdUser,
            'User created successfully',
            201
        );
    });

    /**
     * Update user information
     * PATCH /api/users/:username
     */
    updateUser = asyncHandler(async (req, res) => {
        const { username } = req.params;
        const updateData = req.body;

        const updateResult = await userService.updateUser(username, updateData);

        return ResponseBuilder.success(
            res,
            updateResult,
            'User updated successfully'
        );
    });

    /**
     * Delete user
     * DELETE /api/users?username=johndoe
     */
    deleteUser = asyncHandler(async (req, res) => {
        const { username } = req.query;

        const deleteResult = await userService.deleteUser(username);

        return ResponseBuilder.success(
            res,
            deleteResult,
            'User deleted successfully'
        );
    });

    /**
     * Change user password
     * POST /api/users/:username/change-password
     */
    changePassword = asyncHandler(async (req, res) => {
        const { username } = req.params;
        const { currentPassword, newPassword } = req.body;

        const result = await userService.changePassword(username, currentPassword, newPassword);

        return ResponseBuilder.success(
            res,
            result,
            'Password changed successfully'
        );
    });

    /**
     * Reset user password (admin only)
     * POST /api/users/:username/reset-password
     */
    resetPassword = asyncHandler(async (req, res) => {
        const { username } = req.params;
        const { newPassword } = req.body;

        const result = await userService.resetPassword(username, newPassword);

        return ResponseBuilder.success(
            res,
            result,
            'Password reset successfully'
        );
    });

    /**
     * Get users by role
     * GET /api/users/by-role/:role
     */
    getUsersByRole = asyncHandler(async (req, res) => {
        const { role } = req.params;

        const users = await userService.getUsersByRole(role);

        return ResponseBuilder.success(
            res,
            users,
            `Users with role '${role}' retrieved successfully`
        );
    });

    /**
     * Get user statistics
     * GET /api/users/stats
     */
    getUserStats = asyncHandler(async (req, res) => {
        const stats = await userService.getUserStats();

        return ResponseBuilder.success(
            res,
            stats,
            'User statistics retrieved successfully'
        );
    });

    /**
     * Check if username exists
     * GET /api/users/check-username/:username
     */
    checkUsername = asyncHandler(async (req, res) => {
        const { username } = req.params;

        const exists = await userService.usernameExists(username);

        return ResponseBuilder.success(
            res,
            { username, exists },
            'Username availability checked'
        );
    });

    /**
     * Validate user data
     * POST /api/users/validate
     */
    validateUserData = asyncHandler(async (req, res) => {
        const userData = req.body;

        const validation = userService.validateUserData(userData);

        return ResponseBuilder.success(
            res,
            validation,
            'User data validation completed'
        );
    });
}

module.exports = new UserController(); 