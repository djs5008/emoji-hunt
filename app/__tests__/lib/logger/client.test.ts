/**
 * @jest-environment jsdom
 */
import { logger } from '@/app/lib/logger/client';

describe('Client Logger', () => {
  let consoleDebugSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock console methods
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    // Restore console methods
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('In Test Environment', () => {
    // Client logger logs all levels in test/dev environments
    it('should log debug messages in test environment', () => {
      logger.debug('Test debug message', { data: 'test' });
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[DEBUG] Test debug message',
        { data: 'test' }
      );
    });

    it('should log info messages in test environment', () => {
      logger.info('Test info message', { data: 'test' });
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[INFO] Test info message',
        { data: 'test' }
      );
    });

    it('should log warn messages in test environment', () => {
      logger.warn('Test warn message', { data: 'test' });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[WARN] Test warn message',
        { data: 'test' }
      );
    });

    it('should log error messages in test environment', () => {
      const error = new Error('Test');
      logger.error('Test error message', error, { data: 'test' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ERROR] Test error message',
        error,
        { data: 'test' }
      );
    });
  });

  describe('Logger Interface', () => {
    it('should have debug method', () => {
      expect(logger.debug).toBeDefined();
      expect(typeof logger.debug).toBe('function');
    });

    it('should have info method', () => {
      expect(logger.info).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });

    it('should have warn method', () => {
      expect(logger.warn).toBeDefined();
      expect(typeof logger.warn).toBe('function');
    });

    it('should have error method', () => {
      expect(logger.error).toBeDefined();
      expect(typeof logger.error).toBe('function');
    });
  });

  describe('Method Invocation', () => {
    it('should handle all parameter variations without throwing', () => {
      expect(() => {
        logger.debug('Message');
        logger.debug('Message', null);
        logger.debug('Message', undefined);
        logger.debug('Message', { data: 'test' });
        logger.debug('', {});
        
        logger.info('Message');
        logger.info('Message', null);
        logger.info('Message', undefined);
        logger.info('Message', { data: 'test' });
        
        logger.warn('Message');
        logger.warn('Message', null);
        logger.warn('Message', undefined);
        logger.warn('Message', { data: 'test' });
        
        logger.error('Message');
        logger.error('Message', new Error('Test'));
        logger.error('Message', 'string error');
        logger.error('Message', null, { data: 'test' });
        logger.error('Message', undefined, undefined);
      }).not.toThrow();
    });

    it('should handle circular references without throwing', () => {
      const circular: any = { a: 1 };
      circular.self = circular;
      
      expect(() => {
        logger.debug('Circular', circular);
        logger.info('Circular', circular);
        logger.warn('Circular', circular);
        logger.error('Circular', circular);
      }).not.toThrow();
    });
  });
});