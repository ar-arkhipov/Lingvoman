const { logger } = require('../utils/logger');
const ResponseBuilder = require('../utils/responseBuilder');
const { BaseError } = require('../utils/errors');

/**
 * Centralized Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
    // If response already sent, delegate to default Express error handler
    if (res.headersSent) {
        return next(err);
    }

    // Log the error
    logger.error('Error occurred', {
        requestId: req.requestId,
        error: {
            name: err.name,
            message: err.message,
            stack: err.stack,
            statusCode: err.statusCode,
            errorCode: err.errorCode
        },
        request: {
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: req.body,
            params: req.params,
            query: req.query
        }
    });

    // Handle operational errors (known errors)
    if (err.isOperational || err instanceof BaseError) {
        return ResponseBuilder.error(
            res,
            err.message,
            err.statusCode || 500,
            err.errorCode,
            err.details
        );
    }

    // Handle specific error types
    if (err.name === 'ValidationError') {
        return ResponseBuilder.validationError(res, err.details || err.message);
    }

    if (err.name === 'CastError') {
        return ResponseBuilder.error(res, 'Invalid ID format', 400, 'INVALID_ID');
    }

    if (err.code === 11000) {
        // MongoDB duplicate key error
        const field = Object.keys(err.keyValue)[0];

        return ResponseBuilder.conflict(res, `${field} already exists`);
    }

    if (err.name === 'JsonWebTokenError') {
        return ResponseBuilder.unauthorized(res, 'Invalid token');
    }

    if (err.name === 'TokenExpiredError') {
        return ResponseBuilder.unauthorized(res, 'Token expired');
    }

    if (err.type === 'entity.parse.failed') {
        return ResponseBuilder.error(res, 'Invalid JSON in request body', 400, 'INVALID_JSON');
    }

    // Handle programming errors (unexpected errors)
    logger.error('Unexpected error', {
        error: err,
        requestId: req.requestId
    });

    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production') {
        return ResponseBuilder.error(res, 'Internal Server Error', 500, 'INTERNAL_ERROR');
    } else {
        return ResponseBuilder.error(
            res,
            err.message || 'Internal Server Error',
            500,
            'INTERNAL_ERROR',
            {
                stack: err.stack,
                name: err.name
            }
        );
    }
};

/**
 * Handle 404 errors for unknown routes
 */
const notFoundHandler = (req, res) => {
    ResponseBuilder.notFound(res, 'Endpoint');
};

/**
 * Async error wrapper for route handlers
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped handler
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler
}; 