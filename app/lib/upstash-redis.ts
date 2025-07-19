import { Redis } from '@upstash/redis';

/**
 * Upstash Redis Client Module
 * 
 * @description Provides a singleton Redis client for Upstash serverless Redis.
 * Includes helper functions that match the ioredis API for easy migration.
 * Upstash is used for its serverless nature and global edge deployment.
 * 
 * Features:
 * - Singleton pattern prevents multiple connections
 * - Environment-based configuration
 * - Consistent API with ioredis for portability
 * - Automatic JSON serialization/deserialization
 */

// Singleton Redis client instance
let redis: Redis | null = null;

/**
 * Gets or creates the Upstash Redis client
 * 
 * @description Lazy initialization of Redis client with environment credentials.
 * Uses singleton pattern to reuse connections across requests.
 * 
 * @returns {Redis} Configured Upstash Redis client
 * @throws {Error} If environment variables are not configured
 */
export function getUpstashRedis(): Redis {
  if (!redis) {
    // Validate required environment variables
    if (!process.env.UPSTASH_REDIS_REST_KV_REST_API_URL || !process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN) {
      throw new Error('Upstash Redis credentials not configured');
    }
    
    // Initialize with REST API credentials
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL,
      token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN,
    });
  }
  
  return redis;
}

/**
 * Redis Command Wrappers
 * These functions provide a consistent API matching ioredis,
 * making it easy to switch between Redis providers if needed.
 */

/** Set key with expiration */
export async function setex(key: string, ttl: number, value: string): Promise<void> {
  const client = getUpstashRedis();
  await client.setex(key, ttl, value);
}

/** Get value by key */
export async function get(key: string): Promise<string | null> {
  const client = getUpstashRedis();
  return await client.get(key);
}

/** Delete one or more keys */
export async function del(key: string | string[]): Promise<number> {
  const client = getUpstashRedis();
  if (Array.isArray(key)) {
    return await client.del(...key);
  }
  return await client.del(key);
}

/** Check if key exists */
export async function exists(key: string): Promise<number> {
  const client = getUpstashRedis();
  return await client.exists(key);
}

/** Set expiration on existing key */
export async function expire(key: string, ttl: number): Promise<number> {
  const client = getUpstashRedis();
  return await client.expire(key, ttl);
}

/** Find keys matching pattern */
export async function keys(pattern: string): Promise<string[]> {
  const client = getUpstashRedis();
  return await client.keys(pattern);
}

/** Get range of list elements */
export async function lrange(key: string, start: number, stop: number): Promise<any[]> {
  const client = getUpstashRedis();
  return await client.lrange(key, start, stop);
}

/** Push to end of list */
export async function rpush(key: string, ...values: any[]): Promise<number> {
  const client = getUpstashRedis();
  return await client.rpush(key, ...values);
}

