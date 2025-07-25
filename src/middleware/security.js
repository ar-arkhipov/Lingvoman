const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');
const ResponseBuilder = require('../utils/responseBuilder');

/**
 * Security Headers Middleware
 */
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false, // Disable for API compatibility
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    }
});

/**
 * CORS Configuration
 */
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = process.env.ALLOWED_ORIGINS 
            ? process.env.ALLOWED_ORIGINS.split(',')
            : ['http://localhost:3000', 'http://localhost:1337'];
        
        if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            logger.warn('CORS violation attempt', { origin });
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With', 
        'Content-Type', 
        'Accept',
        'Authorization',
        'x-access-token',
        'x-request-id'
    ],
    exposedHeaders: ['x-request-id'],
    maxAge: 86400 // 24 hours
};

/**
 * Rate Limiting Configurations
 */
const createRateLimit = (windowMs, max, message, skipSuccessfulRequests = false) => {
    return rateLimit({
        windowMs,
        max,
        message: {
            success: false,
            error: {
                message,
                code: 'RATE_LIMIT_EXCEEDED'
            }
        },
        skipSuccessfulRequests,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            logger.warn('Rate limit exceeded', {
                ip: req.ip,
                url: req.url,
                userAgent: req.get('User-Agent')
            });
            ResponseBuilder.rateLimit(res, message);
        }
    });
};

// General API rate limit
const generalRateLimit = createRateLimit(
    15 * 60 * 1000, // 15 minutes
    100, // 100 requests per window
    'Too many requests, please try again later.'
);

// Strict rate limit for authentication endpoints
const authRateLimit = createRateLimit(
    15 * 60 * 1000, // 15 minutes
    5, // 5 login attempts per window
    'Too many login attempts, please try again later.',
    true // Don't count successful requests
);

// Rate limit for translation sync (resource intensive)
const syncRateLimit = createRateLimit(
    60 * 60 * 1000, // 1 hour
    10, // 10 sync requests per hour
    'Too many sync requests, please try again later.'
);

// Rate limit for user management
const userManagementRateLimit = createRateLimit(
    60 * 60 * 1000, // 1 hour
    20, // 20 user operations per hour
    'Too many user management requests, please try again later.'
);

/**
 * IP Whitelist Middleware (for admin operations)
 */
const ipWhitelist = (allowedIPs = []) => {
    return (req, res, next) => {
        if (allowedIPs.length === 0 || process.env.NODE_ENV === 'development') {
            return next();
        }

        const clientIP = req.ip || req.connection.remoteAddress;
        const xForwardedFor = req.headers['x-forwarded-for'];
        
        // Check direct IP and forwarded IPs
        const ipsToCheck = [clientIP];

        if (xForwardedFor) {
            ipsToCheck.push(...xForwardedFor.split(',').map((ip) => ip.trim()));
        }

        const isAllowed = ipsToCheck.some((ip) => allowedIPs.includes(ip));
        
        if (!isAllowed) {
            logger.warn('IP access denied', { 
                requestedIP: clientIP,
                xForwardedFor,
                allowedIPs 
            });

            return ResponseBuilder.forbidden(res, 'Access denied from this IP address');
        }

        next();
    };
};

/**
 * Request Size Limiter
 */
const requestSizeLimit = (sizeLimit = '10mb') => {
    return (req, res, next) => {
        const contentLength = req.headers['content-length'];
        const maxSize = typeof sizeLimit === 'string' 
            ? parseInt(sizeLimit) * 1024 * 1024 
            : sizeLimit;

        if (contentLength && parseInt(contentLength) > maxSize) {
            logger.warn('Request size exceeded', {
                contentLength,
                maxSize,
                url: req.url
            });

            return ResponseBuilder.error(
                res, 
                'Request entity too large', 
                413, 
                'REQUEST_TOO_LARGE'
            );
        }

        next();
    };
};

module.exports = {
    securityHeaders,
    corsOptions,
    generalRateLimit,
    authRateLimit,
    syncRateLimit,
    userManagementRateLimit,
    ipWhitelist,
    requestSizeLimit
}; 