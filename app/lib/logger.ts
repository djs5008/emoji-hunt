/**
 * Logger utility for development and production
 * 
 * @description Provides consistent logging interface that:
 * - Logs to console in development
 * - Can be extended for production logging (Sentry, etc)
 * - Includes contextual information
 * - Supports different log levels
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isTest = process.env.NODE_ENV === 'test';

  /**
   * Debug level logging - only in development
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment || this.isTest) {
      console.debug(`[DEBUG] ${message}`, context || '');
    }
  }

  /**
   * Info level logging - only in development
   */
  info(message: string, context?: LogContext): void {
    if (this.isDevelopment || this.isTest) {
      console.info(`[INFO] ${message}`, context || '');
    }
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    if (this.isDevelopment || this.isTest) {
      console.warn(`[WARN] ${message}`, context || '');
    }
    // In production, could send to monitoring service
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.isDevelopment || this.isTest) {
      console.error(`[ERROR] ${message}`, {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : error,
        ...context,
      });
    }
    // In production, could send to Sentry
    // Example: Sentry.captureException(error, { extra: context });
  }

  /**
   * Log with specific level
   */
  log(level: LogLevel, message: string, context?: LogContext): void {
    switch (level) {
      case LogLevel.DEBUG:
        this.debug(message, context);
        break;
      case LogLevel.INFO:
        this.info(message, context);
        break;
      case LogLevel.WARN:
        this.warn(message, context);
        break;
      case LogLevel.ERROR:
        this.error(message, undefined, context);
        break;
    }
  }

  /**
   * Create a child logger with fixed context
   */
  child(context: LogContext): Logger {
    const parent = this;
    const childLogger = Object.create(this);
    
    // Override methods to include parent context
    childLogger.debug = (message: string, ctx?: LogContext) => {
      parent.debug(message, { ...context, ...ctx });
    };
    
    childLogger.info = (message: string, ctx?: LogContext) => {
      parent.info(message, { ...context, ...ctx });
    };
    
    childLogger.warn = (message: string, ctx?: LogContext) => {
      parent.warn(message, { ...context, ...ctx });
    };
    
    childLogger.error = (message: string, error?: Error | unknown, ctx?: LogContext) => {
      parent.error(message, error, { ...context, ...ctx });
    };
    
    return childLogger;
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for testing
export { Logger };