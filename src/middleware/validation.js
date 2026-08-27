const { ValidationError } = require('../utils/errors');

/**
 * Validation middleware factory
 * @param {Object} schema - Joi validation schema
 * @param {string} source - Source of data to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware
 */
const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        const dataToValidate = req[source];
        
        const { error, value } = schema.validate(dataToValidate, {
            abortEarly: false, // Return all validation errors
            stripUnknown: true, // Remove unknown fields
            convert: true // Convert types when possible
        });

        if (error) {
            const validationErrors = error.details.map((detail) => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));

            throw new ValidationError('Request validation failed', validationErrors);
        }

        // Replace original data with validated/sanitized data
        req[source] = value;
        next();
    };
};

/**
 * Validate request body
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
const validateBody = (schema) => validate(schema, 'body');

/**
 * Validate query parameters
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
const validateQuery = (schema) => validate(schema, 'query');

/**
 * Validate route parameters
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
const validateParams = (schema) => validate(schema, 'params');

/**
 * Sanitize HTML input to prevent XSS
 * @param {Array} fields - Fields to sanitize
 * @returns {Function} Express middleware
 */
const sanitizeInput = (fields = []) => {
    return (req, res, next) => {
        const sanitizeValue = (value) => {
            if (typeof value === 'string') {
                // Basic HTML entity encoding
                return value
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;')
                    .replace(/\//g, '&#x2F;');
            }

            return value;
        };

        const sanitizeObject = (obj) => {
            if (Array.isArray(obj)) {
                return obj.map((item) => 
                    typeof item === 'object' ? sanitizeObject(item) : sanitizeValue(item)
                );
            }
            
            if (typeof obj === 'object' && obj !== null) {
                const sanitized = {};

                for (const [key, value] of Object.entries(obj)) {
                    sanitized[key] = typeof value === 'object' ? sanitizeObject(value) : sanitizeValue(value);
                }

                return sanitized;
            }
            
            return sanitizeValue(obj);
        };

        // Sanitize specified fields or all body fields if none specified
        const fieldsToSanitize = fields.length > 0 ? fields : Object.keys(req.body || {});
        
        fieldsToSanitize.forEach((field) => {
            if (req.body && req.body[field] !== undefined) {
                req.body[field] = sanitizeObject(req.body[field]);
            }
        });

        next();
    };
};

module.exports = {
    validate,
    validateBody,
    validateQuery,
    validateParams,
    sanitizeInput
}; 