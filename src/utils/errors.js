/**
 * Custom Error Classes for Lingvoman API
 */

class BaseError extends Error {
    constructor(message, statusCode = 500, errorCode = null, details = null) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.errorCode = errorCode || this.constructor.name.toUpperCase();
        this.details = details;
        this.isOperational = true; // Distinguish operational errors from programming errors

        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            statusCode: this.statusCode,
            errorCode: this.errorCode,
            details: this.details,
            stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
        };
    }
}

class ValidationError extends BaseError {
    constructor(message = 'Validation failed', details = null) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}

class NotFoundError extends BaseError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
    }
}

class AuthenticationError extends BaseError {
    constructor(message = 'Authentication failed') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}

class AuthorizationError extends BaseError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}

class ConflictError extends BaseError {
    constructor(message = 'Resource already exists') {
        super(message, 409, 'CONFLICT_ERROR');
    }
}

class RateLimitError extends BaseError {
    constructor(message = 'Rate limit exceeded') {
        super(message, 429, 'RATE_LIMIT_ERROR');
    }
}

class ExternalServiceError extends BaseError {
    constructor(service = 'External service', message = 'External service error') {
        super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', { service });
    }
}

class DatabaseError extends BaseError {
    constructor(message = 'Database operation failed', details = null) {
        super(message, 500, 'DATABASE_ERROR', details);
    }
}

class TranslationError extends BaseError {
    constructor(message = 'Translation service error', details = null) {
        super(message, 500, 'TRANSLATION_ERROR', details);
    }
}

module.exports = {
    BaseError,
    ValidationError,
    NotFoundError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    RateLimitError,
    ExternalServiceError,
    DatabaseError,
    TranslationError
}; 