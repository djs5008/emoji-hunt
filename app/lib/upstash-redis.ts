import { Redis } from '@upstash/redis';

// Initialize Upstash Redis client
let redis: Redis | null = null;

export function getUpstashRedis(): Redis {
  if (!redis) {
    if (!process.env.UPSTASH_REDIS_REST_KV_REST_API_URL || !process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN) {
      throw new Error('Upstash Redis credentials not configured');
    }
    
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL,
      token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN,
    });
  }
  
  return redis;
}

// Helper functions to match ioredis API
export async function setex(key: string, ttl: number, value: string): Promise<void> {
  const client = getUpstashRedis();
  await client.setex(key, ttl, value);
}

export async function get(key: string): Promise<string | null> {
  const client = getUpstashRedis();
  return await client.get(key);
}

export async function del(key: string | string[]): Promise<number> {
  const client = getUpstashRedis();
  if (Array.isArray(key)) {
    return await client.del(...key);
  }
  return await client.del(key);
}

export async function exists(key: string): Promise<number> {
  const client = getUpstashRedis();
  return await client.exists(key);
}

export async function expire(key: string, ttl: number): Promise<number> {
  const client = getUpstashRedis();
  return await client.expire(key, ttl);
}

export async function keys(pattern: string): Promise<string[]> {
  const client = getUpstashRedis();
  return await client.keys(pattern);
}

export async function lrange(key: string, start: number, stop: number): Promise<any[]> {
  const client = getUpstashRedis();
  return await client.lrange(key, start, stop);
}

export async function rpush(key: string, ...values: any[]): Promise<number> {
  const client = getUpstashRedis();
  return await client.rpush(key, ...values);
}

export async function lpush(key: string, ...values: any[]): Promise<number> {
  const client = getUpstashRedis();
  return await client.lpush(key, ...values);
}

export async function ltrim(key: string, start: number, stop: number): Promise<string> {
  const client = getUpstashRedis();
  return await client.ltrim(key, start, stop);
}