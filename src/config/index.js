const { logger } = require('../utils/logger');

/**
 * Environment Configuration with Validation
 */
class Config {
    constructor() {
        this.environment = process.env.NODE_ENV || 'development';
        this.config = this.loadConfig();
        this.validateConfig();
    }

    loadConfig() {
        return {
            // Server Configuration
            server: {
                port: this.getEnvNumber('PORT', 1337),
                host: process.env.HOST || '0.0.0.0',
                env: this.environment
            },

            // Database Configuration
            database: {
                mongoUri: process.env.MONGO_URI || 'mongodb://localhost/lingvoman',
                options: {
                    maxPoolSize: this.getEnvNumber('DB_MAX_POOL_SIZE', 10),
                    serverSelectionTimeoutMS: this.getEnvNumber('DB_SERVER_SELECTION_TIMEOUT', 5000),
                    socketTimeoutMS: this.getEnvNumber('DB_SOCKET_TIMEOUT', 45000),
                    bufferMaxEntries: 0,
                    useNewUrlParser: true,
                    useUnifiedTopology: true
                }
            },

            // Security Configuration
            security: {
                jwtSecret: process.env.JWT_SECRET || 'SECRET_SHHHHHH',
                jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
                bcryptRounds: this.getEnvNumber('BCRYPT_ROUNDS', 12),
                allowedOrigins: process.env.ALLOWED_ORIGINS ? 
                    process.env.ALLOWED_ORIGINS.split(',') : 
                    ['http://localhost:3000', 'http://localhost:1337'],
                trustedProxies: process.env.TRUSTED_PROXIES ? 
                    process.env.TRUSTED_PROXIES.split(',') : 
                    []
            },

            // External Services
            services: {
                openai: {
                    apiKey: process.env.OPENAI_API_KEY || '',
                    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
                    maxTokens: this.getEnvNumber('OPENAI_MAX_TOKENS', 20000),
                    temperature: this.getEnvNumber('OPENAI_TEMPERATURE', 0.1)
                }
            },

            // Logging Configuration
            logging: {
                level: process.env.LOG_LEVEL || 'info',
                maxFileSize: this.getEnvNumber('LOG_MAX_FILE_SIZE', 5 * 1024 * 1024), // 5MB
                maxFiles: this.getEnvNumber('LOG_MAX_FILES', 5),
                enableConsole: process.env.NODE_ENV !== 'production'
            },

            // Rate Limiting
            rateLimiting: {
                general: {
                    windowMs: this.getEnvNumber('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
                    max: this.getEnvNumber('RATE_LIMIT_MAX', 100)
                },
                auth: {
                    windowMs: this.getEnvNumber('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
                    max: this.getEnvNumber('AUTH_RATE_LIMIT_MAX', 5)
                },
                sync: {
                    windowMs: this.getEnvNumber('SYNC_RATE_LIMIT_WINDOW_MS', 60 * 60 * 1000),
                    max: this.getEnvNumber('SYNC_RATE_LIMIT_MAX', 10)
                }
            },

            // Feature Flags
            features: {
                enableSwagger: this.getEnvBoolean('ENABLE_SWAGGER', this.environment === 'development'),
                enableMetrics: this.getEnvBoolean('ENABLE_METRICS', false),
                enableCaching: this.getEnvBoolean('ENABLE_CACHING', false),
                enableWebhooks: this.getEnvBoolean('ENABLE_WEBHOOKS', false)
            },

            // Cache Configuration (if enabled)
            cache: {
                redis: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: this.getEnvNumber('REDIS_PORT', 6379),
                    password: process.env.REDIS_PASSWORD || null,
                    db: this.getEnvNumber('REDIS_DB', 0),
                    ttl: this.getEnvNumber('CACHE_TTL', 300) // 5 minutes
                }
            }
        };
    }

    validateConfig() {
        const requiredEnvVars = [
            'MONGO_URI',
            'JWT_SECRET'
        ];

        const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

        if (missingVars.length > 0) {
            const errorMessage = `Missing required environment variables: ${missingVars.join(', ')}`;
            
            if (logger) {
                logger.error('Configuration validation failed', { missingVars });
            } else {
                console.error(errorMessage);
            }
            
            throw new Error(errorMessage);
        }

        // Validate JWT secret strength in production
        if (this.environment === 'production' && this.config.security.jwtSecret.length < 3) {
            const errorMessage = 'JWT_SECRET must be at least 3 characters in production';
            
            if (logger) {
                logger.error('Configuration validation failed', { error: errorMessage });
            } else {
                console.error(errorMessage);
            }
            
            throw new Error(errorMessage);
        }

        // Validate OpenAI API key if features depend on it
        if (!this.config.services.openai.apiKey) {
            const warningMessage = 'OPENAI_API_KEY not configured - translation features will be disabled';
            
            if (logger) {
                logger.warn('Configuration warning', { warning: warningMessage });
            } else {
                console.warn(warningMessage);
            }
        }

        if (logger) {
            logger.info('Configuration loaded successfully', {
                environment: this.environment,
                features: this.config.features
            });
        }
    }

    getEnvNumber(key, defaultValue) {
        const value = process.env[key];
        const parsed = parseInt(value, 10);
        
        return !isNaN(parsed) ? parsed : defaultValue;
    }

    getEnvBoolean(key, defaultValue) {
        const value = process.env[key];
        
        if (value === undefined) return defaultValue;
        
        return value.toLowerCase() === 'true';
    }

    get(path) {
        return path.split('.').reduce((obj, key) => obj && obj[key], this.config);
    }

    isDevelopment() {
        return this.environment === 'development';
    }

    isProduction() {
        return this.environment === 'production';
    }

    isTest() {
        return this.environment === 'test';
    }
}

// Create singleton instance
const config = new Config();

module.exports = config; 
