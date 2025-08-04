const serverlessExpress = require('@vendia/serverless-express');
const { app } = require('./server');

// Export the serverless handler
exports.handler = serverlessExpress({ app });

// For local development, also export the app
if (process.env.NODE_ENV === 'development') {
    module.exports.app = app;
} 