import Redis from 'ioredis';

/**
 * ioredis Client Module
 * 
 * @description Provides a drop-in replacement for upstash-redis.ts using ioredis.
 * Maintains the same API for easy switching between Upstash REST and ioredis.
 * Uses Redis Cloud (or any standard Redis instance) instead of Upstash to reduce
 * API call costs and improve performance.
 * 
 * Features:
 * - Singleton pattern prevents multiple connections
 * - Compatible API with upstash-redis.ts  
 * - Direct Redis protocol connection (more efficient than REST)
 * - Uses standard Redis instance to avoid per-command pricing
 * 
 * Note: Unlike Upstash, ioredis returns raw strings for get() operations.
 * JSON parsing must be handled by the caller.
 */

// Singleton Redis client instance
let redis: Redis | null = null;

/**
 * Gets or creates the ioredis client
 * 
 * @description Lazy initialization of Redis client with Upstash connection URL.
 * Uses singleton pattern to reuse connections across requests.
 * 
 * @returns {Redis} Configured ioredis client
 * @throws {Error} If environment variables are not configured
 */
export function getIoRedis(): Redis {
  if (!redis) {
    // Validate required environment variables
    if (!process.env.REDIS_URL) {
      throw new Error('Redis URL not configured');
    }
    
    // Initialize with Redis Cloud connection URL
    redis = new Redis(process.env.REDIS_URL, {
      // ioredis options for better performance
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
    });
    
    redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
  }
  
  return redis;
}

/**
 * Redis Command Wrappers
 * These functions provide the exact same API as upstash-redis.ts,
 * making it a drop-in replacement.
 */

/** Set key with expiration */
export async function setex(key: string, ttl: number, value: string): Promise<void> {
  const client = getIoRedis();
  await client.setex(key, ttl, value);
}

/** Get value by key */
export async function get(key: string): Promise<string | null> {
  const client = getIoRedis();
  return await client.get(key);
}

/** Delete one or more keys */
export async function del(key: string | string[]): Promise<number> {
  const client = getIoRedis();
  if (Array.isArray(key)) {
    return await client.del(...key);
  }
  return await client.del(key);
}

/** Check if key exists */
export async function exists(key: string): Promise<number> {
  const client = getIoRedis();
  return await client.exists(key);
}

/** Set expiration on existing key */
export async function expire(key: string, ttl: number): Promise<number> {
  const client = getIoRedis();
  return await client.expire(key, ttl);
}

/** Find keys matching pattern */
export async function keys(pattern: string): Promise<string[]> {
  const client = getIoRedis();
  return await client.keys(pattern);
}

/** Get range of list elements */
export async function lrange(key: string, start: number, stop: number): Promise<any[]> {
  const client = getIoRedis();
  const results = await client.lrange(key, start, stop);
  // Parse JSON strings back to objects (matching Upstash behavior)
  return results.map(item => {
    try {
      return JSON.parse(item);
    } catch {
      return item;
    }
  });
}

/** Push to end of list */
export async function rpush(key: string, ...values: any[]): Promise<number> {
  const client = getIoRedis();
  // Stringify objects (matching Upstash behavior)
  const stringValues = values.map(v => 
    typeof v === 'string' ? v : JSON.stringify(v)
  );
  return await client.rpush(key, ...stringValues);
}

/** Push to beginning of list (for priority events) */
export async function lpush(key: string, ...values: any[]): Promise<number> {
  const client = getIoRedis();
  // Stringify objects (matching Upstash behavior)
  const stringValues = values.map(v => 
    typeof v === 'string' ? v : JSON.stringify(v)
  );
  return await client.lpush(key, ...stringValues);
}

/** Create a Redis subscriber client for pub/sub */
export function createSubscriber(): Redis {
  if (!process.env.REDIS_URL) {
    throw new Error('Redis URL not configured');
  }
  
  // Create a new connection for pub/sub (required by Redis)
  const subscriber = new Redis(process.env.REDIS_URL, {
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
  });
  
  subscriber.on('error', (err) => {
    console.error('Redis subscriber error:', err);
  });
  
  return subscriber;
}

/** Publish a message to a channel */
export async function publish(channel: string, message: any): Promise<number> {
  const client = getIoRedis();
  const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
  return await client.publish(channel, messageStr);
}

/** Clean up connection (for graceful shutdown) */
export async function quit(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

// For testing only - reset singleton
export function __resetForTesting(): void {
  redis = null;
}