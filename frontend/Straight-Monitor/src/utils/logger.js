/**
 * Centralized logging utility
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
    // In production, only show errors and warnings
    // In development, show all logs unless specifically disabled
    this.level = this.getLogLevel();
    this.enabled = this.isLoggingEnabled();
  }

  getLogLevel() {
    // Check for explicit log level setting
    const envLevel = import.meta.env?.VITE_LOG_LEVEL;
    if (envLevel && LOG_LEVELS[envLevel.toUpperCase()] !== undefined) {
      return LOG_LEVELS[envLevel.toUpperCase()];
    }

    // Default based on environment
    const isDev = import.meta.env?.DEV || process.env.NODE_ENV === 'development';
    return isDev ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;
  }

  isLoggingEnabled() {
    // Allow disabling all logging via environment variable
    const disabled = import.meta.env?.VITE_DISABLE_LOGGING === 'true';
    return !disabled;
  }

  error(...args) {
    if (this.enabled && this.level >= LOG_LEVELS.ERROR) {
      console.error(...args);
    }
  }

  warn(...args) {
    if (this.enabled && this.level >= LOG_LEVELS.WARN) {
      console.warn(...args);
    }
  }

  info(...args) {
    if (this.enabled && this.level >= LOG_LEVELS.INFO) {
      console.info(...args);
    }
  }

  debug(...args) {
    if (this.enabled && this.level >= LOG_LEVELS.DEBUG) {
      console.log(...args);
    }
  }

  // Convenience methods for common use cases
  apiSuccess(message, data) {
    this.debug('✅', message, data);
  }

  apiError(message, error) {
    this.error('❌', message, error);
  }

  userAction(action, data) {
    this.debug('👤', action, data);
  }

  systemEvent(event, data) {
    this.info('🔧', event, data);
  }
}

// Create and export singleton instance
const logger = new Logger();

export default logger;

// Also export for convenience
export const { error, warn, info, debug, apiSuccess, apiError, userAction, systemEvent } = logger;