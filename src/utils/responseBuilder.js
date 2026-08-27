const { logger } = require('./logger');

/**
 * Standardized API Response Builder
 */
class ResponseBuilder {
    /**
     * Send success response
     * @param {Object} res - Express response object
     * @param {*} data - Response data
     * @param {string} message - Success message
     * @param {number} statusCode - HTTP status code
     * @param {Object} meta - Additional metadata
     */
    static success(res, data = null, message = 'Success', statusCode = 200, meta = {}) {
        logger.info('Success response', {
            requestId: res.req?.requestId,
            statusCode,
            message
        });

        // Return simple response - just the data
        return res.status(statusCode).json(data);
    }

    /**
     * Send error response
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     * @param {number} statusCode - HTTP status code
     * @param {string} errorCode - Internal error code
     * @param {Object} details - Error details
     */
    static error(res, message = 'Internal Server Error', statusCode = 500, errorCode = null, details = null) {
        logger.error('Error response', {
            requestId: res.req?.requestId,
            statusCode,
            message,
            errorCode,
            details
        });

        // Return simple error response
        return res.status(statusCode).json({
            message,
            error: errorCode || `HTTP_${statusCode}`,
            details
        });
    }

    /**
     * Send validation error response
     * @param {Object} res - Express response object
     * @param {Array|Object} validationErrors - Validation errors
     * @param {string} message - Error message
     */
    static validationError(res, validationErrors, message = 'Validation failed') {
        return this.error(res, message, 400, 'VALIDATION_ERROR', validationErrors);
    }

    /**
     * Send not found response
     * @param {Object} res - Express response object
     * @param {string} resource - Resource that was not found
     */
    static notFound(res, resource = 'Resource') {
        return this.error(res, `${resource} not found`, 404, 'NOT_FOUND');
    }

    /**
     * Send unauthorized response
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     */
    static unauthorized(res, message = 'Unauthorized') {
        return this.error(res, message, 401, 'UNAUTHORIZED');
    }

    /**
     * Send forbidden response
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     */
    static forbidden(res, message = 'Forbidden') {
        return this.error(res, message, 403, 'FORBIDDEN');
    }

    /**
     * Send conflict response
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     */
    static conflict(res, message = 'Resource already exists') {
        return this.error(res, message, 409, 'CONFLICT');
    }

    /**
     * Send rate limit response
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     */
    static rateLimit(res, message = 'Too many requests') {
        return this.error(res, message, 429, 'RATE_LIMIT_EXCEEDED');
    }
}

module.exports = ResponseBuilder; 