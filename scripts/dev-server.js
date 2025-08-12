#!/usr/bin/env node

/**
 * Local Development Server
 * Runs Express app directly without Lambda wrapper for faster development
 */

const path = require('path');
const fs = require('fs');

// Set environment variables for local development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.PORT = process.env.PORT || '1337';

// Load environment variables from .env file
const envPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log('✅ Loaded environment variables from .env');
} else {
    console.log('⚠️  .env file not found, using system environment variables');
}

// Validate required environment variables
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'OPENAI_API_KEY'];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach((varName) => {
        console.error(`   - ${varName}`);
    });
    console.error('\nPlease create a .env file with the required variables.');
    process.exit(1);
}

// Load the Express app
try {
    const { app } = require('../src/server');
    
    const port = process.env.PORT;
    const server = app.listen(port, () => {
        console.log('🚀 Development server started successfully!');
        console.log(`   Environment: ${process.env.NODE_ENV}`);
        console.log(`   Port: ${port}`);
        console.log(`   URL: http://localhost:${port}`);
        console.log(`   API: http://localhost:${port}/api/`);
        console.log('\n📋 Available endpoints:');
        console.log('   GET  /health          - Health check');
        console.log('   POST /login           - User authentication');
        console.log('   GET  /api/uitranslate/list - Projects list');
        console.log('   POST /api/uitranslate/sync-flexible - Translation sync');
        console.log('\n🛠️  Development tools:');
        console.log('   Frontend build: npm run build');
        console.log('   Watch mode:     npm run build:watch');
        console.log('   Lint:           npm run lint');
        console.log('\n⚡ Hot reload: Restart this script after code changes');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        server.close(() => {
            console.log('✅ Server closed');
            process.exit(0);
        });
    });

    process.on('SIGINT', () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        server.close(() => {
            console.log('✅ Server closed');
            process.exit(0);
        });
    });

} catch (error) {
    console.error('❌ Failed to start development server:');
    console.error(error.message);
    console.error('\nPlease check your configuration and try again.');
    process.exit(1);
}