const { User } = require('../../libs/mongoose.js');
const { logger } = require('../utils/logger');
const { DatabaseError, NotFoundError } = require('../utils/errors');

/**
 * User Repository - Data Access Layer
 */
class UserRepository {
    /**
     * Find user by username
     * @param {string} username - Username
     * @returns {Promise<Object|null>} User document or null
     */
    async findByUsername(username) {
        try {
            const user = await User.findOne({ username });

            return user;
        } catch (error) {
            logger.error('Database error in findByUsername', {
                username,
                error: error.message
            });
            throw new DatabaseError('Failed to find user', { username });
        }
    }

    /**
     * Find user by ID
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>} User document or null
     */
    async findById(userId) {
        try {
            const user = await User.findById(userId);

            return user;
        } catch (error) {
            logger.error('Database error in findById', {
                userId,
                error: error.message
            });
            throw new DatabaseError('Failed to find user by ID', { userId });
        }
    }

    /**
     * Get all users
     * @returns {Promise<Array>} Array of user documents
     */
    async findAll() {
        try {
            const users = await User.find({}, { password: 0 }); // Exclude password field

            return users;
        } catch (error) {
            logger.error('Database error in findAll', {
                error: error.message
            });
            throw new DatabaseError('Failed to get users list');
        }
    }

    /**
     * Create new user
     * @param {Object} userData - User data
     * @returns {Promise<Object>} Created user document
     */
    async create(userData) {
        try {
            const user = await User.create({
                username: userData.username,
                password: userData.password,
                userObj: userData.userObj
            });

            logger.info('User created', {
                username: user.username,
                role: user.userObj?.role,
                userId: user._id
            });

            // Return user without password
            const userWithoutPassword = user.toObject();

            delete userWithoutPassword.password;
            
            return userWithoutPassword;
        } catch (error) {
            logger.error('Database error in create', {
                username: userData.username,
                error: error.message
            });

            if (error.code === 11000) {
                throw new DatabaseError('Username already exists', { username: userData.username });
            }

            throw new DatabaseError('Failed to create user', { username: userData.username });
        }
    }

    /**
     * Update user
     * @param {string} username - Username
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Update result
     */
    async update(username, updateData) {
        try {
            const result = await User.updateOne(
                { username },
                { $set: updateData }
            );

            if (result.matchedCount === 0) {
                throw new NotFoundError('User');
            }

            logger.info('User updated', {
                username,
                modifiedCount: result.modifiedCount
            });

            return result;
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }

            logger.error('Database error in update', {
                username,
                error: error.message
            });
            throw new DatabaseError('Failed to update user', { username });
        }
    }

    /**
     * Update user password
     * @param {string} username - Username
     * @param {string} hashedPassword - New hashed password
     * @returns {Promise<Object>} Update result
     */
    async updatePassword(username, hashedPassword) {
        try {
            const result = await User.updateOne(
                { username },
                { $set: { password: hashedPassword } }
            );

            if (result.matchedCount === 0) {
                throw new NotFoundError('User');
            }

            logger.info('User password updated', {
                username,
                modifiedCount: result.modifiedCount
            });

            return result;
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }

            logger.error('Database error in updatePassword', {
                username,
                error: error.message
            });
            throw new DatabaseError('Failed to update user password', { username });
        }
    }

    /**
     * Delete user
     * @param {string} username - Username
     * @returns {Promise<Object>} Delete result
     */
    async delete(username) {
        try {
            const result = await User.deleteOne({ username });

            if (result.deletedCount === 0) {
                throw new NotFoundError('User');
            }

            logger.info('User deleted', {
                username,
                deletedCount: result.deletedCount
            });

            return result;
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }

            logger.error('Database error in delete', {
                username,
                error: error.message
            });
            throw new DatabaseError('Failed to delete user', { username });
        }
    }

    /**
     * Count total users
     * @returns {Promise<number>} User count
     */
    async count() {
        try {
            const count = await User.countDocuments();

            return count;
        } catch (error) {
            logger.error('Database error in count', {
                error: error.message
            });
            throw new DatabaseError('Failed to count users');
        }
    }

    /**
     * Find users by role
     * @param {string} role - User role
     * @returns {Promise<Array>} Array of user documents
     */
    async findByRole(role) {
        try {
            const users = await User.find(
                { 'userObj.role': role },
                { password: 0 }
            );

            return users;
        } catch (error) {
            logger.error('Database error in findByRole', {
                role,
                error: error.message
            });
            throw new DatabaseError('Failed to find users by role', { role });
        }
    }

    /**
     * Check if username exists
     * @param {string} username - Username to check
     * @returns {Promise<boolean>} True if username exists
     */
    async exists(username) {
        try {
            const count = await User.countDocuments({ username });

            return count > 0;
        } catch (error) {
            logger.error('Database error in exists', {
                username,
                error: error.message
            });
            throw new DatabaseError('Failed to check username existence', { username });
        }
    }
}

module.exports = new UserRepository(); 