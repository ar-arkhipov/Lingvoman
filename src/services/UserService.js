const userRepository = require('../repositories/UserRepository');
const { logger } = require('../utils/logger');
const { NotFoundError, ValidationError, ConflictError, AuthenticationError } = require('../utils/errors');
const pwd = require('../../middlewares/pwd.js');

/**
 * User Service - Business Logic Layer
 */
class UserService {
    /**
     * Get all users (excluding passwords)
     * @returns {Promise<Array>} Array of users
     */
    async getAllUsers() {
        const users = await userRepository.findAll();
        
        logger.info('Retrieved users list', { 
            userCount: users.length 
        });

        return users;
    }

    /**
     * Get user by username
     * @param {string} username - Username
     * @returns {Promise<Object>} User data
     */
    async getUserByUsername(username) {
        const user = await userRepository.findByUsername(username);
        
        if (!user) {
            logger.warn('User not found', { username });
            throw new NotFoundError('User');
        }

        // Return user without password
        const userWithoutPassword = user.toObject();

        delete userWithoutPassword.password;

        return userWithoutPassword;
    }

    /**
     * Get user by ID
     * @param {string} userId - User ID
     * @returns {Promise<Object>} User data
     */
    async getUserById(userId) {
        const user = await userRepository.findById(userId);
        
        if (!user) {
            logger.warn('User not found by ID', { userId });
            throw new NotFoundError('User');
        }

        // Return user without password
        const userWithoutPassword = user.toObject();

        delete userWithoutPassword.password;

        return userWithoutPassword;
    }

    /**
     * Create new user
     * @param {Object} userData - User data
     * @returns {Promise<Object>} Created user
     */
    async createUser(userData) {
        const { username, password, userObj } = userData;

        // Check if username already exists
        const existingUser = await userRepository.findByUsername(username);

        if (existingUser) {
            logger.warn('Attempted to create user with existing username', { username });
            throw new ConflictError('Username already exists');
        }

        // Validate role
        const validRoles = ['admin', 'translater'];

        if (!validRoles.includes(userObj.role)) {
            throw new ValidationError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
        }

        // Hash password
        const hashedPassword = pwd.pwdgen(password);

        // Create user
        const createdUser = await userRepository.create({
            username,
            password: hashedPassword,
            userObj: {
                role: userObj.role,
                name: userObj.name
            }
        });

        logger.info('User created successfully', {
            username: createdUser.username,
            role: createdUser.userObj.role,
            userId: createdUser._id
        });

        return createdUser;
    }

    /**
     * Update user information
     * @param {string} username - Username
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Update result
     */
    async updateUser(username, updateData) {
        // Verify user exists
        const existingUser = await userRepository.findByUsername(username);

        if (!existingUser) {
            throw new NotFoundError('User');
        }

        // Validate role if provided
        if (updateData.userObj && updateData.userObj.role) {
            const validRoles = ['admin', 'translater'];

            if (!validRoles.includes(updateData.userObj.role)) {
                throw new ValidationError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
            }
        }

        // Don't allow direct password updates through this method
        if (updateData.password) {
            delete updateData.password;
            logger.warn('Attempted to update password through updateUser method', { username });
        }

        const result = await userRepository.update(username, updateData);

        logger.info('User updated successfully', {
            username,
            modifiedCount: result.modifiedCount
        });

        return {
            username,
            updateResult: result
        };
    }

    /**
     * Change user password
     * @param {string} username - Username
     * @param {string} currentPassword - Current password
     * @param {string} newPassword - New password
     * @returns {Promise<Object>} Update result
     */
    async changePassword(username, currentPassword, newPassword) {
        // Get user with password for verification
        const user = await userRepository.findByUsername(username);

        if (!user) {
            throw new NotFoundError('User');
        }

        // Verify current password
        const passwordParts = user.password.split(':');
        const hashedCurrentPassword = pwd.pwdcheck(currentPassword, passwordParts[1]);
        
        if (passwordParts[0] !== hashedCurrentPassword) {
            logger.warn('Invalid current password provided for password change', { username });
            throw new AuthenticationError('Current password is incorrect');
        }

        // Hash new password
        const hashedNewPassword = pwd.pwdgen(newPassword);

        // Update password
        const result = await userRepository.updatePassword(username, hashedNewPassword);

        logger.info('User password changed successfully', {
            username,
            modifiedCount: result.modifiedCount
        });

        return {
            username,
            message: 'Password changed successfully'
        };
    }

    /**
     * Reset user password (admin only)
     * @param {string} username - Username
     * @param {string} newPassword - New password
     * @returns {Promise<Object>} Update result
     */
    async resetPassword(username, newPassword) {
        // Verify user exists
        const existingUser = await userRepository.findByUsername(username);

        if (!existingUser) {
            throw new NotFoundError('User');
        }

        // Hash new password
        const hashedNewPassword = pwd.pwdgen(newPassword);

        // Update password
        const result = await userRepository.updatePassword(username, hashedNewPassword);

        logger.info('User password reset by admin', {
            username,
            modifiedCount: result.modifiedCount
        });

        return {
            username,
            message: 'Password reset successfully'
        };
    }

    /**
     * Delete user
     * @param {string} username - Username
     * @returns {Promise<Object>} Delete result
     */
    async deleteUser(username) {
        // Check if user exists and get user data for logging
        const existingUser = await userRepository.findByUsername(username);

        if (!existingUser) {
            throw new NotFoundError('User');
        }

        // Prevent deletion of the last admin user
        if (existingUser.userObj.role === 'admin') {
            const adminUsers = await userRepository.findByRole('admin');

            if (adminUsers.length <= 1) {
                logger.warn('Attempted to delete last admin user', { username });
                throw new ValidationError('Cannot delete the last admin user');
            }
        }

        const result = await userRepository.delete(username);

        logger.info('User deleted successfully', {
            username,
            role: existingUser.userObj.role,
            deletedCount: result.deletedCount
        });

        return {
            username,
            deleteResult: result
        };
    }

    /**
     * Get users by role
     * @param {string} role - User role
     * @returns {Promise<Array>} Users with specified role
     */
    async getUsersByRole(role) {
        const validRoles = ['admin', 'translater'];

        if (!validRoles.includes(role)) {
            throw new ValidationError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
        }

        const users = await userRepository.findByRole(role);

        logger.info('Retrieved users by role', {
            role,
            userCount: users.length
        });

        return users;
    }

    /**
     * Get user statistics
     * @returns {Promise<Object>} User statistics
     */
    async getUserStats() {
        const totalUsers = await userRepository.count();
        const adminUsers = await userRepository.findByRole('admin');
        const translaterUsers = await userRepository.findByRole('translater');

        const stats = {
            totalUsers,
            adminCount: adminUsers.length,
            translaterCount: translaterUsers.length,
            userBreakdown: {
                admin: adminUsers.length,
                translater: translaterUsers.length
            }
        };

        logger.info('Retrieved user statistics', stats);

        return stats;
    }

    /**
     * Check if username exists
     * @param {string} username - Username to check
     * @returns {Promise<boolean>} True if exists
     */
    async usernameExists(username) {
        const exists = await userRepository.exists(username);

        return exists;
    }

    /**
     * Validate user data
     * @param {Object} userData - User data to validate
     * @returns {Object} Validation result
     */
    validateUserData(userData) {
        const errors = [];

        // Username validation
        if (!userData.username || userData.username.trim().length < 3) {
            errors.push('Username must be at least 3 characters long');
        }

        if (userData.username && !/^[a-zA-Z0-9_]+$/.test(userData.username)) {
            errors.push('Username can only contain letters, numbers, and underscores');
        }

        // Password validation
        if (!userData.password || userData.password.length < 6) {
            errors.push('Password must be at least 6 characters long');
        }

        // User object validation
        if (!userData.userObj) {
            errors.push('User object is required');
        } else {
            if (!userData.userObj.name || userData.userObj.name.trim().length === 0) {
                errors.push('Name is required');
            }

            if (!userData.userObj.role) {
                errors.push('Role is required');
            } else {
                const validRoles = ['admin', 'translater'];

                if (!validRoles.includes(userData.userObj.role)) {
                    errors.push(`Role must be one of: ${validRoles.join(', ')}`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

module.exports = new UserService(); 