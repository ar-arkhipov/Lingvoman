const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const logDir = 'logs';

const fs = require('fs');

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { 
        service: 'lingvoman-api',
        version: process.env.npm_package_version || '1.0.0'
    },
    transports: [
        // Write all logs with level 'error' and below to error.log
        new winston.transports.File({ 
            filename: path.join(logDir, 'error.log'), 
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // Write all logs with level 'info' and below to combined.log
        new winston.transports.File({ 
            filename: path.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ],
    exceptionHandlers: [
        new winston.transports.File({ filename: path.join(logDir, 'exceptions.log') })
    ],
    rejectionHandlers: [
        new winston.transports.File({ filename: path.join(logDir, 'rejections.log') })
    ]
});

// If we're not in production, log to the console as well

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                // Clean format for development
                let output = `${timestamp} ${level}: ${message}`;
                
                // Add only essential metadata for development
                if (meta.requestId) {
                    const shortId = meta.requestId.slice(-8);
                    output += ` [${shortId}]`;
                }
                if (meta.method && meta.url) {
                    output += ` ${meta.method} ${meta.url}`;
                }
                if (meta.statusCode) {
                    output += ` (${meta.statusCode})`;
                }
                if (meta.responseTime !== undefined) {
                    output += ` ${meta.responseTime}ms`;
                }
                if (meta.username) {
                    output += ` user:${meta.username}`;
                }
                if (meta.error && meta.error.message) {
                    output += ` - ${meta.error.message}`;
                }
                
                return output;
            })
        )
    }));
}

    // Create request logger middleware

const requestLogger = (req, res, next) => {
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = requestId;
    
    // Skip logging for static files and favicon
    if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        return next();
    }
    
    logger.info('→ Request', {
        requestId,
        method: req.method,
        url: req.url
    });

    const originalSend = res.send;
    res.send = function(data) {
        const responseTime = Date.now() - req.startTime;
        
        // Different log level based on status code
        if (res.statusCode >= 400) {
            logger.warn('← Response', {
                requestId,
                method: req.method,
                url: req.url,
                statusCode: res.statusCode,
                responseTime
            });
        } else {
            logger.info('← Response', {
                requestId,
                method: req.method,
                url: req.url,
                statusCode: res.statusCode,
                responseTime
            });
        }
        
        originalSend.call(this, data);
    };

    req.startTime = Date.now();
    next();
};

module.exports = {
    logger,
    requestLogger
}; 