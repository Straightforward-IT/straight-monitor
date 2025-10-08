/**
 * Backend logging utility
 * Controls console output based on environment and log levels
 */

// Log levels (higher number = more verbose)
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor() {
    // Set log level based on environment
    this.level = this.getLogLevel();
    this.enabled = this.isLoggingEnabled();
  }

  getLogLevel() {
    // Check for explicit log level setting
    const envLevel = process.env.LOG_LEVEL;
    if (envLevel && LOG_LEVELS[envLevel.toUpperCase()] !== undefined) {
      return LOG_LEVELS[envLevel.toUpperCase()];
    }

    // Default based on NODE_ENV
    const isProduction = process.env.NODE_ENV === 'production';
    return isProduction ? LOG_LEVELS.WARN : LOG_LEVELS.INFO;
  }

  isLoggingEnabled() {
    // Allow disabling all logging via environment variable
    return process.env.DISABLE_LOGGING !== 'true';
  }

  formatMessage(level, ...args) {
    const timestamp = new Date().toISOString();
    return [`[${timestamp}] ${level}:`, ...args];
  }

  error(...args) {
    if (this.enabled && this.level >= LOG_LEVELS.ERROR) {
      console.error(...this.formatMessage('ERROR', ...args));
    }
  }

  warn(...args) {
    if (this.enabled && this.level >= LOG_LEVELS.WARN) {
      console.warn(...this.formatMessage('WARN', ...args));
    }
  }

  info(...args) {
    if (this.enabled && this.level >= LOG_LEVELS.INFO) {
      console.info(...this.formatMessage('INFO', ...args));
    }
  }

  debug(...args) {
    if (this.enabled && this.level >= LOG_LEVELS.DEBUG) {
      console.log(...this.formatMessage('DEBUG', ...args));
    }
  }

  // Convenience methods for common server use cases
  serverStart(port) {
    this.info(`🚀 Server started on port ${port}`);
  }

  dbConnect(message) {
    this.info('💾 MongoDB connected');
  }

  dbError(error) {
    this.error('💾 MongoDB connection error:', error);
  }

  apiRequest(method, path, user) {
    this.debug(`📡 ${method} ${path}`, user ? `[User: ${user}]` : '');
  }

  cronJob(name, result) {
    this.info(`⏰ Cron job: ${name}`, result ? '✅' : '❌');
  }

  routineStart(name) {
    this.info(`🔄 Running ${name}...`);
  }

  routineError(name, error) {
    this.error(`❌ ${name}:`, error?.message || error);
  }

  authError(message, details) {
    this.warn('🔐 Auth error:', message, details);
  }

  emailSent(to, subject) {
    this.info('📧 Email sent:', { to, subject });
  }

  emailError(error) {
    this.error('📧 Email error:', error);
  }
}

// Create and export singleton instance
const logger = new Logger();

module.exports = logger;

// Also export individual methods for convenience
module.exports.error = logger.error.bind(logger);
module.exports.warn = logger.warn.bind(logger);
module.exports.info = logger.info.bind(logger);
module.exports.debug = logger.debug.bind(logger);
module.exports.serverStart = logger.serverStart.bind(logger);
module.exports.dbConnect = logger.dbConnect.bind(logger);
module.exports.dbError = logger.dbError.bind(logger);
module.exports.apiRequest = logger.apiRequest.bind(logger);
module.exports.cronJob = logger.cronJob.bind(logger);
module.exports.routineStart = logger.routineStart.bind(logger);
module.exports.routineError = logger.routineError.bind(logger);
module.exports.authError = logger.authError.bind(logger);
module.exports.emailSent = logger.emailSent.bind(logger);
module.exports.emailError = logger.emailError.bind(logger);