# Logging System Documentation

This project now uses a centralized logging system to control console output and improve debugging capabilities.

## Quick Start

### Frontend (Vue.js)

```javascript
// In any Vue component
import logger from '@/utils/logger';

export default {
  methods: {
    someMethod() {
      // Instead of: console.log('Debug info:', data)
      logger.debug('Debug info:', data);
      
      // Instead of: console.error('API error:', error)
      logger.error('API error:', error);
      
      // Convenience methods
      logger.apiSuccess('User created', userData);
      logger.userAction('Filter applied', filterData);
    }
  }
}
```

### Backend (Node.js)

```javascript
// In any API file
const logger = require('../utils/logger');

// Instead of: console.log('Server started on port', port)
logger.serverStart(port);

// Instead of: console.error('Database error:', error)
logger.error('Database error:', error);

// Convenience methods
logger.routineStart('daily backup');
logger.apiRequest('POST', '/api/users', userId);
```

## Configuration

### Frontend Environment Variables

Create `.env.local` in the frontend directory:

```bash
# Log levels: ERROR, WARN, INFO, DEBUG
VITE_LOG_LEVEL=DEBUG

# Disable all logging (production)
# VITE_DISABLE_LOGGING=true
```

### Backend Environment Variables

Add to your `.env` file:

```bash
# Log levels: ERROR, WARN, INFO, DEBUG  
LOG_LEVEL=INFO

# Disable all logging (production)
# DISABLE_LOGGING=true
```

## Log Levels

- **ERROR** (0): Only critical errors
- **WARN** (1): Errors and warnings
- **INFO** (2): Errors, warnings, and important information
- **DEBUG** (3): All logs including detailed debugging

**Default behavior:**
- Development: DEBUG level (shows all logs)
- Production: WARN level (errors and warnings only)

## Migration Guide

### Automatic Cleanup

Use the provided cleanup script:

```bash
# Check current console usage
./cleanup-logs.sh check

# Remove console.log statements (keeps error/warn)
./cleanup-logs.sh remove-debug

# Get help for manual replacement
./cleanup-logs.sh replace
```

### Manual Migration

Replace console statements gradually:

```javascript
// OLD
console.log('User data:', userData);
console.error('API failed:', error);
console.warn('Deprecated function used');

// NEW
logger.debug('User data:', userData);
logger.error('API failed:', error);  
logger.warn('Deprecated function used');
```

## Logger Methods

### Frontend Logger

```javascript
import logger from '@/utils/logger';

// Basic levels
logger.error(...args)    // Always shown
logger.warn(...args)     // WARN level and above
logger.info(...args)     // INFO level and above  
logger.debug(...args)    // DEBUG level only

// Convenience methods
logger.apiSuccess(message, data)     // ✅ API success
logger.apiError(message, error)      // ❌ API error
logger.userAction(action, data)      // 👤 User action
logger.systemEvent(event, data)      // 🔧 System event
```

### Backend Logger

```javascript
const logger = require('./utils/logger');

// Basic levels
logger.error(...args)    
logger.warn(...args)     
logger.info(...args)     
logger.debug(...args)    

// Convenience methods
logger.serverStart(port)             // 🚀 Server startup
logger.dbConnect()                   // 💾 Database connection
logger.dbError(error)               // 💾 Database error
logger.routineStart(name)           // 🔄 Routine started
logger.routineError(name, error)    // ❌ Routine error
logger.emailSent(to, subject)       // 📧 Email sent
logger.authError(message, details)  // 🔐 Auth error
```

## Production Setup

For production deployment:

```bash
# Frontend (.env.production)
VITE_LOG_LEVEL=ERROR

# Backend (.env)
NODE_ENV=production
LOG_LEVEL=WARN
```

This will drastically reduce console output while preserving error reporting.

## Benefits

1. **Performance**: Reduced console output in production
2. **Control**: Fine-grained control over log levels
3. **Consistency**: Standardized logging across the application
4. **Debugging**: Better categorization of log messages
5. **Maintenance**: Easier to disable/enable logging globally

## Troubleshooting

### No logs appearing

Check your log level:
```javascript
// Frontend
console.log('Current log level:', import.meta.env.VITE_LOG_LEVEL);

// Backend  
console.log('Current log level:', process.env.LOG_LEVEL);
```

### Too many logs

Lower the log level:
```bash
# Frontend
VITE_LOG_LEVEL=WARN

# Backend
LOG_LEVEL=ERROR
```

### Disable all logging

```bash
# Frontend
VITE_DISABLE_LOGGING=true

# Backend
DISABLE_LOGGING=true
```