// Test the ioredis-client module without complex mocking
jest.unmock('@/app/lib/ioredis-client');
jest.unmock('@/app/lib/logger');

import Redis from 'ioredis';
jest.mock('ioredis');

const mockRedis = {
  setex: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue('test-value'),
  del: jest.fn().mockResolvedValue(1),
  rpush: jest.fn().mockResolvedValue(1),
  lrange: jest.fn().mockResolvedValue(['item1', 'item2']),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
  exists: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue(['key1', 'key2']),
};

(Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis as any);

import { 
  getIoRedis, 
  setex, 
  get, 
  del, 
  rpush, 
  lrange, 
  quit,
  __resetForTesting 
} from '@/app/lib/ioredis-client';

describe('ioredis-client simple tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetForTesting();
    process.env.REDIS_URL = 'redis://localhost:6379';
  });

  it('should create Redis client when REDIS_URL is set', () => {
    const client = getIoRedis();
    expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', {
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
    });
    expect(client).toBeDefined();
  });

  it('should throw when REDIS_URL is not set', () => {
    delete process.env.REDIS_URL;
    expect(() => getIoRedis()).toThrow('Redis URL not configured');
  });

  it('should handle basic operations', async () => {
    // These operations should work without errors
    await setex('key', 60, 'value');
    expect(mockRedis.setex).toHaveBeenCalledWith('key', 60, 'value');

    const value = await get('key');
    expect(value).toBe('test-value');

    const deleted = await del('key');
    expect(deleted).toBe(1);
  });

  it('should handle list operations', async () => {
    await rpush('list', 'item1', 'item2');
    // rpush stringifies non-string values
    expect(mockRedis.rpush).toHaveBeenCalled();

    mockRedis.lrange.mockResolvedValue(['{"foo":"bar"}', 'plain']);
    const items = await lrange('list', 0, -1);
    // lrange parses JSON strings
    expect(items).toEqual([{foo: 'bar'}, 'plain']);
  });

  it('should handle quit', async () => {
    getIoRedis(); // Create instance first
    await quit();
    expect(mockRedis.quit).toHaveBeenCalled();
  });
});