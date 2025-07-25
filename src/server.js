const express = require('express');
const methodOverride = require('method-override');
const path = require('path');

// Import configuration and utilities
const config = require('./config');
const { logger, requestLogger } = require('./utils/logger');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { securityHeaders, corsOptions, generalRateLimit } = require('./middleware/security');

// Import routes
const routes = require('./routes');

// Create Express app
const app = express();

// =============================================================================
// MIDDLEWARE SETUP
// =============================================================================

// Trust proxy (for production behind load balancer)
if (config.get('security.trustedProxies').length > 0) {
    app.set('trust proxy', config.get('security.trustedProxies'));
} else if (config.isProduction()) {
    app.set('trust proxy', 1);
}

// Security headers
app.use(securityHeaders);

// CORS configuration
const cors = require('cors');

app.use(cors(corsOptions));

// Request logging
app.use(requestLogger);

// Body parsing middleware
app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
        // Store raw body for webhook verification if needed
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
}));

// Method override for REST API
app.use(methodOverride());

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// General rate limiting (applied to all routes)
app.use(generalRateLimit);

// =============================================================================
// ROUTES
// =============================================================================

// API routes
app.use('/', routes);

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler for unknown routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// =============================================================================
// SERVER STARTUP
// =============================================================================

/**
 * Start the server
 */
const startServer = () => {
    const port = config.get('server.port');
    const host = config.get('server.host');
    const env = config.get('server.env');

    // Validate required environment variables
    try {
        config.validateConfig();
    } catch (error) {
        logger.error('Server startup failed - configuration error', { error: error.message });
        process.exit(1);
    }

    const server = app.listen(port, host, () => {
        logger.info('Server started successfully', {
            port,
            host,
            env,
            pid: process.pid,
            nodeVersion: process.version,
            features: config.get('features')
        });

        // Log configuration warnings
        if (!config.get('services.openai.apiKey')) {
            logger.warn('OpenAI API key not configured - translation features disabled');
        }
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal) => {
        logger.info(`${signal} received, shutting down gracefully`, { signal });
        
        server.close((err) => {
            if (err) {
                logger.error('Error during server shutdown', { error: err.message });
                process.exit(1);
            }
            
            logger.info('Server closed successfully');
            process.exit(0);
        });
    };

    // Handle various shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
        gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection', { 
            reason: reason instanceof Error ? reason.message : reason,
            stack: reason instanceof Error ? reason.stack : undefined
        });
        gracefulShutdown('UNHANDLED_REJECTION');
    });

    return server;
};

// =============================================================================
// HEALTH MONITORING
// =============================================================================

/**
 * Health check function
 */
const healthCheck = () => {
    return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.get('server.env'),
        features: config.get('features')
    };
};

// Export for testing
module.exports = {
    app,
    startServer,
    healthCheck
};

// Start server if this file is run directly
if (require.main === module) {
    startServer();
} 