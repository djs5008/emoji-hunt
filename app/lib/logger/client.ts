/**
 * Client-side logger for browser environments
 * 
 * @description This logger is specifically for client-side code and will
 * output to the browser console in development/test mode, with errors
 * always logged in production.
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
const shouldLog = isDevelopment || isTest;

export const logger = {
  debug: (message: string, data?: any) => {
    if (shouldLog) {
      console.debug(`[DEBUG] ${message}`, data || '');
    }
  },
  
  info: (message: string, data?: any) => {
    if (shouldLog) {
      console.info(`[INFO] ${message}`, data || '');
    }
  },
  
  warn: (message: string, data?: any) => {
    if (shouldLog) {
      console.warn(`[WARN] ${message}`, data || '');
    }
  },
  
  error: (message: string, error?: Error | any, data?: any) => {
    // Always log errors, even in production
    console.error(`[ERROR] ${message}`, error, data || '');
  }
};