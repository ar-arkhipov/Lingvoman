const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/UserRepository');
const config = require('../config');
const { logger } = require('../utils/logger');
const { AuthenticationError, ValidationError } = require('../utils/errors');
const pwd = require('../../middlewares/pwd.js');

/**
 * Authentication Service - Business Logic Layer
 */
class AuthService {
    /**
     * Authenticate user with username and password
     * @param {string} username - Username
     * @param {string} password - Password
     * @returns {Promise<Object>} Authentication result with token
     */
    async login(username, password) {
        // Validate input
        if (!username || !password) {
            logger.warn('Login attempt with missing credentials');
            throw new ValidationError('Username and password are required');
        }

        // Find user
        const user = await userRepository.findByUsername(username);

        if (!user) {
            logger.warn('Login attempt with non-existent username', { username });
            throw new AuthenticationError('Invalid credentials');
        }

        // Verify password
        const passwordParts = user.password.split(':');

        if (passwordParts.length !== 2) {
            logger.error('Invalid password format in database', { username });
            throw new AuthenticationError('Invalid credentials');
        }

        const hashedPassword = pwd.pwdcheck(password, passwordParts[1]);

        if (passwordParts[0] !== hashedPassword) {
            logger.warn('Login attempt with incorrect password', { username });
            throw new AuthenticationError('Invalid credentials');
        }

        // Generate token
        const tokenData = this.generateToken(user.userObj);

        logger.info('User logged in successfully', {
            username: user.username,
            role: user.userObj.role,
            tokenExpires: new Date(tokenData.expires)
        });

        return {
            success: true,
            user: {
                username: user.username,
                role: user.userObj.role,
                name: user.userObj.name
            },
            token: tokenData.token,
            expires: tokenData.expires,
            expiresIn: config.get('security.jwtExpiresIn')
        };
    }

    /**
     * Generate JWT token
     * @param {Object} userObj - User object to encode in token
     * @returns {Object} Token data
     */
    generateToken(userObj) {
        const expiresIn = config.get('security.jwtExpiresIn');
        const secret = config.get('security.jwtSecret');

        // Calculate expiration timestamp
        const expires = this.calculateExpiration(expiresIn);

        // Create token payload
        const payload = {
            user: {
                role: userObj.role,
                name: userObj.name
            },
            exp: Math.floor(expires / 1000), // JWT expects seconds
            iat: Math.floor(Date.now() / 1000)
        };

        // Generate token
        const token = jwt.sign(payload, secret);

        return {
            token,
            expires,
            expiresIn
        };
    }

    /**
     * Verify and decode JWT token
     * @param {string} token - JWT token
     * @returns {Object} Decoded token data
     */
    verifyToken(token) {
        try {
            const secret = config.get('security.jwtSecret');
            const decoded = jwt.verify(token, secret);

            // Check if token is expired
            if (decoded.exp <= Date.now() / 1000) {
                logger.warn('Expired token verification attempt');
                throw new AuthenticationError('Token expired');
            }

            return {
                valid: true,
                user: decoded.user,
                expiresAt: new Date(decoded.exp * 1000)
            };
        } catch (error) {
            if (error.name === 'JsonWebTokenError') {
                logger.warn('Invalid token verification attempt', { error: error.message });
                throw new AuthenticationError('Invalid token');
            }

            if (error.name === 'TokenExpiredError') {
                logger.warn('Expired token verification attempt');
                throw new AuthenticationError('Token expired');
            }

            logger.error('Token verification error', { error: error.message });
            throw new AuthenticationError('Token verification failed');
        }
    }

    /**
     * Refresh JWT token
     * @param {string} currentToken - Current JWT token
     * @returns {Object} New token data
     */
    refreshToken(currentToken) {
        // Verify current token
        const decoded = this.verifyToken(currentToken);

        // Generate new token with same user data
        const newTokenData = this.generateToken(decoded.user);

        logger.info('Token refreshed successfully', {
            role: decoded.user.role,
            newExpires: new Date(newTokenData.expires)
        });

        return {
            success: true,
            token: newTokenData.token,
            expires: newTokenData.expires,
            expiresIn: config.get('security.jwtExpiresIn')
        };
    }

    /**
     * Check user authorization for specific operations
     * @param {Object} user - User from token
     * @param {string} operation - Operation to check
     * @returns {boolean} True if authorized
     */
    checkAuthorization(user, operation) {
        if (!user || !user.role) {
            return false;
        }

        const permissions = this.getRolePermissions(user.role);

        return permissions.includes(operation) || permissions.includes('*');
    }

    /**
     * Get role permissions
     * @param {string} role - User role
     * @returns {Array} Array of permissions
     */
    getRolePermissions(role) {
        const rolePermissions = {
            admin: ['*'], // Admin has all permissions
            translater: [
                'translations:read',
                'translations:write',
                'translations:sync',
                'projects:read',
                'languages:read',
                'languages:add'
            ]
        };

        return rolePermissions[role] || [];
    }

    /**
     * Check if user has specific permission
     * @param {Object} user - User from token
     * @param {string} permission - Permission to check
     * @returns {boolean} True if user has permission
     */
    hasPermission(user, permission) {
        const permissions = this.getRolePermissions(user.role);

        return permissions.includes(permission) || permissions.includes('*');
    }

    /**
     * Validate password strength
     * @param {string} password - Password to validate
     * @returns {Object} Validation result
     */
    validatePasswordStrength(password) {
        const minLength = 6;
        const errors = [];

        if (!password) {
            errors.push('Password is required');

            return { valid: false, errors };
        }

        if (password.length < minLength) {
            errors.push(`Password must be at least ${minLength} characters long`);
        }

        // Check for at least one letter
        if (!/[a-zA-Z]/.test(password)) {
            errors.push('Password must contain at least one letter');
        }

        // Check for at least one number (recommended but not required)
        const hasNumber = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        // Calculate strength score
        let strength = 'weak';

        if (password.length >= 8 && hasNumber) {
            strength = 'medium';
        }

        if (password.length >= 8 && hasNumber && hasSpecialChar) {
            strength = 'strong';
        }

        return {
            valid: errors.length === 0,
            errors,
            strength,
            recommendations: this.getPasswordRecommendations(password)
        };
    }

    /**
     * Get password recommendations
     * @param {string} password - Password to analyze
     * @returns {Array} Array of recommendations
     */
    getPasswordRecommendations(password) {
        const recommendations = [];

        if (password.length < 8) {
            recommendations.push('Use at least 8 characters for better security');
        }

        if (!/\d/.test(password)) {
            recommendations.push('Include at least one number');
        }

        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            recommendations.push('Include special characters for stronger security');
        }

        if (!/[A-Z]/.test(password)) {
            recommendations.push('Include uppercase letters');
        }

        if (!/[a-z]/.test(password)) {
            recommendations.push('Include lowercase letters');
        }

        return recommendations;
    }

    /**
     * Calculate token expiration timestamp
     * @param {string} expiresIn - Expiration string (e.g., '24h', '7d')
     * @returns {number} Expiration timestamp
     */
    calculateExpiration(expiresIn) {
        const now = Date.now();
        
        // Parse expiration string
        const match = expiresIn.match(/^(\d+)([smhd])$/);

        if (!match) {
            // Default to 1 day if invalid format
            return now + (24 * 60 * 60 * 1000);
        }

        const value = parseInt(match[1]);
        const unit = match[2];

        const multipliers = {
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000
        };

        return now + (value * multipliers[unit]);
    }

    /**
     * Logout user (invalidate token)
     * Note: Since we're using stateless JWT, we can't truly invalidate tokens
     * This method is here for future implementation of token blacklisting
     * @param {string} token - JWT token to invalidate
     * @returns {Object} Logout result
     */
    logout(token) {
        // For future implementation: add token to blacklist
        // Currently, JWT tokens remain valid until expiration

        logger.info('User logged out', { tokenExpiry: 'remains valid until expiration' });

        return {
            success: true,
            message: 'Logged out successfully'
        };
    }
}

module.exports = new AuthService(); 