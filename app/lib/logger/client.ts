/**
 * Client-side logger for browser environments
 * 
 * @description This logger is specifically for client-side code and will
 * output to the browser console in development mode only.
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  debug: (message: string, data?: any) => {
    if (isDevelopment) {
      console.debug(`[DEBUG] ${message}`, data || '');
    }
  },
  
  info: (message: string, data?: any) => {
    if (isDevelopment) {
      console.info(`[INFO] ${message}`, data || '');
    }
  },
  
  warn: (message: string, data?: any) => {
    if (isDevelopment) {
      console.warn(`[WARN] ${message}`, data || '');
    }
  },
  
  error: (message: string, error?: Error | any, data?: any) => {
    if (isDevelopment) {
      console.error(`[ERROR] ${message}`, error, data || '');
    }
  }
};