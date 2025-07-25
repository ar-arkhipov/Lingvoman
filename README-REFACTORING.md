# 🚀 Backend Refactoring Complete - Migration Guide

## 📋 Overview

The Lingvoman backend has been completely refactored from a monolithic structure to a modern, enterprise-ready layered architecture. This document provides guidance on the changes and how to work with the new system.

## 🏗️ New Architecture

### Directory Structure
```
src/
├── controllers/           # HTTP request/response handling
│   ├── AuthController.js
│   ├── UiTranslationController.js
│   └── UserController.js
├── services/             # Business logic layer
│   ├── AuthService.js
│   ├── UiTranslationService.js
│   └── UserService.js
├── repositories/         # Data access layer
│   ├── UiTranslationRepository.js
│   └── UserRepository.js
├── middleware/           # Express middleware
│   ├── authMiddleware.js
│   ├── errorHandler.js
│   ├── security.js
│   └── validation.js
├── dto/                 # Data Transfer Objects (validation schemas)
│   └── index.js
├── utils/               # Utilities and helpers
│   ├── errors.js
│   ├── logger.js
│   └── responseBuilder.js
├── config/              # Configuration management
│   └── index.js
└── routes/              # Route definitions
    └── index.js
```

## 🔄 Migration Changes

### 1. **Old vs New API Responses**

**Old Format:**
```javascript
// Inconsistent responses
res.json({msg: 'Success'});
res.status(400).json({status: 400, message: 'Error'});
```

**New Format:**
```javascript
// Standardized response format
{
  "success": true,
  "message": "Success message",
  "data": {...},
  "error": null,
  "meta": {
    "requestId": "req_123",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0"
  }
}
```

### 2. **Authentication Changes**

**Before:**
- Basic JWT verification in `validateRequest.js`
- Mixed authorization logic

**After:**
- Enhanced `AuthService` with comprehensive token management
- Role-based permissions system
- Multiple auth middleware options:
  - `authenticate` - Require valid token
  - `requireAdmin` - Admin only access
  - `optionalAuth` - Optional authentication
  - `authorize(permissions)` - Permission-based access

### 3. **Input Validation**

**Before:**
- No input validation
- Direct use of `req.body`

**After:**
- Comprehensive Joi-based validation
- DTOs for all endpoints
- Automatic input sanitization
- Structured validation error responses

### 4. **Error Handling**

**Before:**
```javascript
res.status(500).json({msg: 'Internal server error'});
```

**After:**
```javascript
// Custom error classes
throw new ValidationError('Invalid input', details);
throw new NotFoundError('Resource not found');
throw new AuthenticationError('Invalid credentials');

// Centralized error handling with logging
```

### 5. **Security Enhancements**

**Before:**
- Basic CORS with `'*'` origin
- No rate limiting
- No security headers

**After:**
- Proper CORS configuration
- Multiple rate limiting strategies
- Helmet security headers
- Input sanitization
- Request size limits

## 🔧 Environment Variables

### Required Variables
```bash
# Database
MONGO_URI=mongodb://localhost/lingvoman

# Authentication
JWT_SECRET=your-super-secret-jwt-key-at-least-32-chars

# OpenAI (optional)
OPENAI_API_KEY=your-openai-api-key
```

### Optional Variables
```bash
# Server
PORT=1337
HOST=0.0.0.0
NODE_ENV=development

# Logging
LOG_LEVEL=info

# Security
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:1337
TRUSTED_PROXIES=

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=5
SYNC_RATE_LIMIT_MAX=10

# Features
ENABLE_SWAGGER=false
ENABLE_METRICS=false
ENABLE_CACHING=false
```

## 📚 API Documentation

### Authentication Endpoints
- `POST /login` - User login
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - Logout user
- `POST /auth/verify` - Verify token
- `GET /auth/permissions/:role` - Get role permissions

### Translation Endpoints
- `GET /uitranslate/:projectID` - Get translations (public)
- `GET /api/uitranslate/list` - Get projects list
- `GET /api/uitranslate/item` - Get translation item
- `POST /api/uitranslate/item` - Update translations
- `PUT /api/uitranslate/item` - Create translation
- `DELETE /api/uitranslate/item` - Delete translation
- `GET /api/uitranslate/languages/:projectID` - Get project languages
- `POST /api/uitranslate/add-language` - Add new language
- `POST /api/uitranslate/sync-flexible` - Start translation sync
- `GET /api/uitranslate/sync-progress/:jobId` - Get sync progress

### User Management Endpoints
- `GET /api/users` - Get all users (admin)
- `PUT /api/users` - Create user (admin)
- `DELETE /api/users` - Delete user (admin)
- `GET /api/users/stats` - Get user statistics (admin)
- `POST /api/users/:username/change-password` - Change password
- `POST /api/users/:username/reset-password` - Reset password (admin)

### Health Check
- `GET /health` - Health check endpoint

## 🛠️ Development Guidelines

### 1. **Adding New Features**

**Controllers** - Handle HTTP requests/responses only:
```javascript
const myMethod = asyncHandler(async (req, res) => {
    const result = await myService.doSomething(req.body);
    return ResponseBuilder.success(res, result, 'Success message');
});
```

**Services** - Business logic:
```javascript
async doSomething(data) {
    // Validate business rules
    // Call repository methods
    // Return processed data
}
```

**Repositories** - Database operations:
```javascript
async findSomething(id) {
    try {
        const result = await Model.findById(id);
        return result;
    } catch (error) {
        throw new DatabaseError('Failed to find record');
    }
}
```

### 2. **Error Handling**
Always use custom error classes:
```javascript
// Don't do this
throw new Error('Something went wrong');

// Do this
throw new ValidationError('Invalid input data', validationDetails);
throw new NotFoundError('User not found');
throw new AuthenticationError('Invalid credentials');
```

### 3. **Logging**
Use structured logging:
```javascript
const { logger } = require('../utils/logger');

logger.info('Operation completed', {
    userId: user.id,
    operation: 'updateProfile',
    duration: Date.now() - startTime
});
```

### 4. **Validation**
Always validate input using DTOs:
```javascript
// In routes
router.post('/api/something',
    authenticate,
    validateBody(MyDTO.createRequest),
    controller.method
);
```

## 🧪 Testing

### Running the Application
```bash
# Development
npm run dev

# Production
npm run prod

# Check syntax
npm run check

# Lint code
npm run lint
```

### Health Check
```bash
curl http://localhost:1337/health
```

## 🔒 Security Features

1. **Rate Limiting**: Different limits for auth, sync, and general operations
2. **Input Validation**: All inputs validated and sanitized
3. **Security Headers**: Helmet.js for security headers
4. **CORS**: Configurable origin restrictions
5. **Authentication**: JWT with proper expiration and refresh
6. **Authorization**: Role-based permissions system
7. **Logging**: All security events logged with correlation IDs

## 📊 Monitoring & Logging

### Log Files
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- `logs/exceptions.log` - Uncaught exceptions
- `logs/rejections.log` - Unhandled promise rejections

### Log Levels
- `error` - Errors and exceptions
- `warn` - Warnings and security events
- `info` - General information and request logs
- `debug` - Detailed debugging information

## 🚨 Breaking Changes

1. **Response Format**: All API responses now use standardized format
2. **Authentication**: Enhanced token validation and permissions
3. **Validation**: All endpoints now validate input
4. **Error Codes**: New structured error response format
5. **Logging**: Console.log replaced with structured Winston logging

## 🔄 Migration Checklist

- [ ] Update environment variables
- [ ] Test all API endpoints with new response format
- [ ] Update frontend to handle new response structure
- [ ] Verify authentication flow works
- [ ] Test error handling scenarios
- [ ] Configure logging directory permissions
- [ ] Set up monitoring for log files
- [ ] Test rate limiting behavior
- [ ] Verify CORS configuration for your domains

## 📞 Support

If you encounter issues during migration:

1. Check the logs in `logs/` directory
2. Verify all required environment variables are set
3. Test individual endpoints using the health check
4. Review the new response format structure

The refactored backend provides a solid foundation for scaling and maintaining the Lingvoman application with enterprise-level practices. 