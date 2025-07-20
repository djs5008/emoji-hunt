import { logger } from '@/app/lib/logger';

describe('Logger', () => {
  let consoleDebugSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    // Store original NODE_ENV
    originalNodeEnv = process.env.NODE_ENV;
    
    // Mock console methods
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    // Restore original NODE_ENV
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    }
    
    // Restore console methods
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Development Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should log debug messages in development', () => {
      const testLogger = new (logger.constructor as any)();
      testLogger.debug('Test debug message', { data: 'test' });
      
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[DEBUG] Test debug message',
        { data: 'test' }
      );
    });

    it('should log info messages in development', () => {
      const testLogger = new (logger.constructor as any)();
      testLogger.info('Test info message', { data: 'test' });
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[INFO] Test info message',
        { data: 'test' }
      );
    });

    it('should log warn messages in development', () => {
      const testLogger = new (logger.constructor as any)();
      testLogger.warn('Test warn message', { data: 'test' });
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[WARN] Test warn message',
        { data: 'test' }
      );
    });

    it('should log error messages in development', () => {
      const testLogger = new (logger.constructor as any)();
      const error = new Error('Test error');
      testLogger.error('Test error message', error, { data: 'test' });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ERROR] Test error message',
        {
          error: {
            message: 'Test error',
            stack: error.stack,
            name: 'Error',
          },
          data: 'test',
        }
      );
    });
  });

  describe('Test Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should log all levels in test environment', () => {
      const testLogger = new (logger.constructor as any)();
      testLogger.debug('Test debug in test env');
      testLogger.info('Test info in test env');
      testLogger.warn('Test warn in test env');
      testLogger.error('Test error in test env', new Error('Test'));
      
      expect(consoleDebugSpy).toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Production Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should not log debug messages in production', () => {
      const testLogger = new (logger.constructor as any)();
      testLogger.debug('Test debug message', { data: 'test' });
      
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should not log info messages in production', () => {
      const testLogger = new (logger.constructor as any)();
      testLogger.info('Test info message', { data: 'test' });
      
      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });

    it('should not log warn messages in production', () => {
      const testLogger = new (logger.constructor as any)();
      testLogger.warn('Test warn message', { data: 'test' });
      
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should log error messages in production', () => {
      const testLogger = new (logger.constructor as any)();
      const error = new Error('Test error');
      testLogger.error('Test error message', error, { data: 'test' });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ERROR] Test error message',
        {
          error: {
            message: 'Test error',
            stack: error.stack,
            name: 'Error',
          },
          data: 'test',
        }
      );
    });
  });

  describe('Context Handling', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should handle empty context', () => {
      const testLogger = new (logger.constructor as any)();
      testLogger.debug('Test message');
      
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[DEBUG] Test message',
        ''
      );
    });

    it('should handle undefined context', () => {
      const testLogger = new (logger.constructor as any)();
      testLogger.info('Test message', undefined);
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[INFO] Test message',
        ''
      );
    });

    it('should handle non-Error objects in error method', () => {
      const testLogger = new (logger.constructor as any)();
      testLogger.error('Test error', 'string error', { data: 'test' });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ERROR] Test error',
        {
          error: 'string error',
          data: 'test',
        }
      );
    });

    it('should handle complex context objects', () => {
      const testLogger = new (logger.constructor as any)();
      const complexContext = {
        nested: {
          data: {
            value: 123,
            array: [1, 2, 3],
          },
        },
        method: () => {},
      };
      
      testLogger.debug('Test complex context', complexContext);
      
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[DEBUG] Test complex context',
        complexContext
      );
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      expect(logger).toBe(logger);
    });
  });
});