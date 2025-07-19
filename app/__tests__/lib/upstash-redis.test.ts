// Mock Upstash Redis before importing our module
const mockRedisInstance = {
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  keys: jest.fn(),
  lrange: jest.fn(),
  rpush: jest.fn(),
};

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn(() => mockRedisInstance),
}));

import { 
  getUpstashRedis,
  setex,
  get,
  del,
  exists,
  expire,
  keys,
  lrange,
  rpush,
} from '@/app/lib/upstash-redis';

import { Redis } from '@upstash/redis';
const MockRedis = Redis as jest.Mock;

describe('upstash-redis', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Save original environment
    originalEnv = process.env;
    
    // Set up environment variables
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL = 'https://test.upstash.io';
    process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN = 'test-token-123';
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getUpstashRedis', () => {
    it('should create Redis client with environment credentials', () => {
      const client = getUpstashRedis();

      expect(MockRedis).toHaveBeenCalledWith({
        url: 'https://test.upstash.io',
        token: 'test-token-123',
      });
      expect(client).toBe(mockRedisInstance);
    });

    it('should return same instance on subsequent calls (singleton)', () => {
      const client1 = getUpstashRedis();
      const client2 = getUpstashRedis();

      expect(client1).toBe(client2);
      // Note: Redis may already be initialized from previous tests
      expect(client1).toBe(mockRedisInstance);
    });
  });

  describe('setex wrapper function', () => {
    it('should call Redis setex with correct parameters', async () => {
      mockRedisInstance.setex.mockResolvedValue('OK');

      await setex('test-key', 3600, 'test-value');

      expect(mockRedisInstance.setex).toHaveBeenCalledWith('test-key', 3600, 'test-value');
    });

    it('should handle special characters in key and value', async () => {
      mockRedisInstance.setex.mockResolvedValue('OK');

      await setex('test:key-123_special!', 1800, 'value with spaces & symbols');

      expect(mockRedisInstance.setex).toHaveBeenCalledWith('test:key-123_special!', 1800, 'value with spaces & symbols');
    });

    it('should handle different TTL values', async () => {
      mockRedisInstance.setex.mockResolvedValue('OK');

      const testCases = [1, 3600, 86400, 604800];

      for (const ttl of testCases) {
        jest.clearAllMocks();
        await setex('test-key', ttl, 'test-value');
        expect(mockRedisInstance.setex).toHaveBeenCalledWith('test-key', ttl, 'test-value');
      }
    });

    it('should propagate Redis errors', async () => {
      mockRedisInstance.setex.mockRejectedValue(new Error('Redis connection failed'));

      await expect(setex('test-key', 3600, 'test-value')).rejects.toThrow('Redis connection failed');
    });
  });

  describe('get wrapper function', () => {
    it('should call Redis get and return value', async () => {
      mockRedisInstance.get.mockResolvedValue('test-value');

      const result = await get('test-key');

      expect(mockRedisInstance.get).toHaveBeenCalledWith('test-key');
      expect(result).toBe('test-value');
    });

    it('should return null when key does not exist', async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      const result = await get('nonexistent-key');

      expect(mockRedisInstance.get).toHaveBeenCalledWith('nonexistent-key');
      expect(result).toBeNull();
    });

    it('should handle complex JSON string values', async () => {
      const complexValue = JSON.stringify({
        id: 'test-123',
        data: { nested: true, array: [1, 2, 3] },
        timestamp: Date.now()
      });
      mockRedisInstance.get.mockResolvedValue(complexValue);

      const result = await get('json-key');

      expect(mockRedisInstance.get).toHaveBeenCalledWith('json-key');
      expect(result).toBe(complexValue);
    });

    it('should propagate Redis errors', async () => {
      mockRedisInstance.get.mockRejectedValue(new Error('Network timeout'));

      await expect(get('test-key')).rejects.toThrow('Network timeout');
    });
  });

  describe('del wrapper function', () => {
    it('should delete single key and return count', async () => {
      mockRedisInstance.del.mockResolvedValue(1);

      const result = await del('test-key');

      expect(mockRedisInstance.del).toHaveBeenCalledWith('test-key');
      expect(result).toBe(1);
    });

    it('should delete multiple keys from array', async () => {
      mockRedisInstance.del.mockResolvedValue(3);

      const result = await del(['key1', 'key2', 'key3']);

      expect(mockRedisInstance.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
      expect(result).toBe(3);
    });

    it('should handle empty array', async () => {
      mockRedisInstance.del.mockResolvedValue(0);

      const result = await del([]);

      expect(mockRedisInstance.del).toHaveBeenCalledWith();
      expect(result).toBe(0);
    });

    it('should propagate Redis errors', async () => {
      mockRedisInstance.del.mockRejectedValue(new Error('Permission denied'));

      await expect(del('test-key')).rejects.toThrow('Permission denied');
    });
  });

  describe('exists wrapper function', () => {
    it('should return 1 when key exists', async () => {
      mockRedisInstance.exists.mockResolvedValue(1);

      const result = await exists('existing-key');

      expect(mockRedisInstance.exists).toHaveBeenCalledWith('existing-key');
      expect(result).toBe(1);
    });

    it('should return 0 when key does not exist', async () => {
      mockRedisInstance.exists.mockResolvedValue(0);

      const result = await exists('nonexistent-key');

      expect(mockRedisInstance.exists).toHaveBeenCalledWith('nonexistent-key');
      expect(result).toBe(0);
    });

    it('should propagate Redis errors', async () => {
      mockRedisInstance.exists.mockRejectedValue(new Error('Connection lost'));

      await expect(exists('test-key')).rejects.toThrow('Connection lost');
    });
  });

  describe('expire wrapper function', () => {
    it('should set expiration on existing key', async () => {
      mockRedisInstance.expire.mockResolvedValue(1);

      const result = await expire('test-key', 3600);

      expect(mockRedisInstance.expire).toHaveBeenCalledWith('test-key', 3600);
      expect(result).toBe(1);
    });

    it('should return 0 when key does not exist', async () => {
      mockRedisInstance.expire.mockResolvedValue(0);

      const result = await expire('nonexistent-key', 1800);

      expect(mockRedisInstance.expire).toHaveBeenCalledWith('nonexistent-key', 1800);
      expect(result).toBe(0);
    });

    it('should propagate Redis errors', async () => {
      mockRedisInstance.expire.mockRejectedValue(new Error('Invalid TTL'));

      await expect(expire('test-key', 3600)).rejects.toThrow('Invalid TTL');
    });
  });

  describe('keys wrapper function', () => {
    it('should return matching keys for pattern', async () => {
      const mockKeys = ['test:key1', 'test:key2', 'test:key3'];
      mockRedisInstance.keys.mockResolvedValue(mockKeys);

      const result = await keys('test:*');

      expect(mockRedisInstance.keys).toHaveBeenCalledWith('test:*');
      expect(result).toEqual(mockKeys);
    });

    it('should return empty array when no keys match', async () => {
      mockRedisInstance.keys.mockResolvedValue([]);

      const result = await keys('nonexistent:*');

      expect(mockRedisInstance.keys).toHaveBeenCalledWith('nonexistent:*');
      expect(result).toEqual([]);
    });

    it('should handle wildcard patterns', async () => {
      const patterns = ['user:*', 'session:*:data', '*:temp'];
      mockRedisInstance.keys.mockResolvedValue(['match1', 'match2']);

      for (const pattern of patterns) {
        jest.clearAllMocks();

        const result = await keys(pattern);

        expect(mockRedisInstance.keys).toHaveBeenCalledWith(pattern);
        expect(result).toEqual(['match1', 'match2']);
      }
    });

    it('should propagate Redis errors', async () => {
      mockRedisInstance.keys.mockRejectedValue(new Error('Pattern too broad'));

      await expect(keys('*')).rejects.toThrow('Pattern too broad');
    });
  });

  describe('lrange wrapper function', () => {
    it('should return list elements in range', async () => {
      const mockList = ['item1', 'item2', 'item3'];
      mockRedisInstance.lrange.mockResolvedValue(mockList);

      const result = await lrange('test-list', 0, 2);

      expect(mockRedisInstance.lrange).toHaveBeenCalledWith('test-list', 0, 2);
      expect(result).toEqual(mockList);
    });

    it('should return empty array for empty list', async () => {
      mockRedisInstance.lrange.mockResolvedValue([]);

      const result = await lrange('empty-list', 0, -1);

      expect(mockRedisInstance.lrange).toHaveBeenCalledWith('empty-list', 0, -1);
      expect(result).toEqual([]);
    });

    it('should handle negative indices', async () => {
      const mockList = ['last'];
      mockRedisInstance.lrange.mockResolvedValue(mockList);

      const result = await lrange('test-list', -1, -1);

      expect(mockRedisInstance.lrange).toHaveBeenCalledWith('test-list', -1, -1);
      expect(result).toEqual(mockList);
    });

    it('should propagate Redis errors', async () => {
      mockRedisInstance.lrange.mockRejectedValue(new Error('List not found'));

      await expect(lrange('test-list', 0, 5)).rejects.toThrow('List not found');
    });
  });

  describe('rpush wrapper function', () => {
    it('should push single value to list', async () => {
      mockRedisInstance.rpush.mockResolvedValue(1);

      const result = await rpush('test-list', 'new-item');

      expect(mockRedisInstance.rpush).toHaveBeenCalledWith('test-list', 'new-item');
      expect(result).toBe(1);
    });

    it('should push multiple values to list', async () => {
      mockRedisInstance.rpush.mockResolvedValue(4);

      const result = await rpush('test-list', 'item1', 'item2', 'item3');

      expect(mockRedisInstance.rpush).toHaveBeenCalledWith('test-list', 'item1', 'item2', 'item3');
      expect(result).toBe(4);
    });

    it('should handle array spread of values', async () => {
      mockRedisInstance.rpush.mockResolvedValue(3);
      const values = ['a', 'b', 'c'];

      const result = await rpush('test-list', ...values);

      expect(mockRedisInstance.rpush).toHaveBeenCalledWith('test-list', 'a', 'b', 'c');
      expect(result).toBe(3);
    });

    it('should handle complex data types as values', async () => {
      mockRedisInstance.rpush.mockResolvedValue(2);
      const objectValue = { id: 1, name: 'test' };
      const numberValue = 42;

      const result = await rpush('complex-list', objectValue, numberValue);

      expect(mockRedisInstance.rpush).toHaveBeenCalledWith('complex-list', objectValue, numberValue);
      expect(result).toBe(2);
    });

    it('should propagate Redis errors', async () => {
      mockRedisInstance.rpush.mockRejectedValue(new Error('List limit exceeded'));

      await expect(rpush('test-list', 'item')).rejects.toThrow('List limit exceeded');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow: set, get, exists, expire, delete', async () => {
      // Set up mocks
      mockRedisInstance.setex.mockResolvedValue('OK');
      mockRedisInstance.get.mockResolvedValue('test-value');
      mockRedisInstance.exists.mockResolvedValue(1);
      mockRedisInstance.expire.mockResolvedValue(1);
      mockRedisInstance.del.mockResolvedValue(1);

      // Execute workflow
      await setex('workflow-key', 3600, 'test-value');
      const value = await get('workflow-key');
      const keyExists = await exists('workflow-key');
      const expireResult = await expire('workflow-key', 1800);
      const deleteResult = await del('workflow-key');

      // Verify calls
      expect(mockRedisInstance.setex).toHaveBeenCalledWith('workflow-key', 3600, 'test-value');
      expect(mockRedisInstance.get).toHaveBeenCalledWith('workflow-key');
      expect(mockRedisInstance.exists).toHaveBeenCalledWith('workflow-key');
      expect(mockRedisInstance.expire).toHaveBeenCalledWith('workflow-key', 1800);
      expect(mockRedisInstance.del).toHaveBeenCalledWith('workflow-key');

      // Verify results
      expect(value).toBe('test-value');
      expect(keyExists).toBe(1);
      expect(expireResult).toBe(1);
      expect(deleteResult).toBe(1);
    });

    it('should handle list operations workflow', async () => {
      mockRedisInstance.rpush.mockResolvedValue(3);
      mockRedisInstance.lrange.mockResolvedValue(['item1', 'item2', 'item3']);

      await rpush('test-list', 'item1', 'item2', 'item3');
      const items = await lrange('test-list', 0, -1);

      expect(mockRedisInstance.rpush).toHaveBeenCalledWith('test-list', 'item1', 'item2', 'item3');
      expect(mockRedisInstance.lrange).toHaveBeenCalledWith('test-list', 0, -1);
      expect(items).toEqual(['item1', 'item2', 'item3']);
    });
  });

  describe('error handling', () => {
    it('should handle network timeout errors', async () => {
      mockRedisInstance.get.mockRejectedValue(new Error('Network timeout'));

      await expect(get('test-key')).rejects.toThrow('Network timeout');
    });

    it('should handle authentication errors', async () => {
      mockRedisInstance.setex.mockRejectedValue(new Error('Authentication failed'));

      await expect(setex('test-key', 3600, 'value')).rejects.toThrow('Authentication failed');
    });

    it('should handle concurrent operations errors', async () => {
      mockRedisInstance.del.mockRejectedValue(new Error('Concurrent modification'));

      await expect(del(['key1', 'key2'])).rejects.toThrow('Concurrent modification');
    });
  });
});