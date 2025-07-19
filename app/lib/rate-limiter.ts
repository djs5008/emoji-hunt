import { getUpstashRedis } from './upstash-redis';

/**
 * Rate Limiter Module
 * 
 * @description Implements a sliding window rate limiting algorithm using Redis.
 * Designed specifically for the emoji hunt game to handle both rapid gameplay
 * actions and standard API rate limiting.
 * 
 * Features:
 * - Session-based rate limiting (not IP-based)
 * - Configurable limits per endpoint
 * - Sliding window algorithm for smooth rate limiting
 * - Optimized for real-time gaming with minimal latency
 */

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Optional custom key prefix */
  keyPrefix?: string;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current number of requests in the window */
  current: number;
  /** Maximum allowed requests */
  limit: number;
  /** When the rate limit resets (Unix timestamp in ms) */
  resetAt: number;
  /** Remaining requests in current window */
  remaining: number;
}

/**
 * Predefined rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // Game click endpoint - very permissive for rapid clicking during gameplay
  GAME_CLICK: {
    maxRequests: 50,  // 50 clicks allowed
    windowSeconds: 2,  // per 2 seconds (25 clicks/second max)
  },
  
  // Lobby operations - moderate limits
  LOBBY_CREATE: {
    maxRequests: 5,   // 5 lobby creations
    windowSeconds: 60, // per minute
  },
  
  LOBBY_JOIN: {
    maxRequests: 10,  // 10 join attempts
    windowSeconds: 60, // per minute
  },
  
  // Standard API endpoints
  STANDARD: {
    maxRequests: 30,  // 30 requests
    windowSeconds: 60, // per minute
  },
  
  // Strict limit for sensitive operations
  STRICT: {
    maxRequests: 5,   // 5 requests
    windowSeconds: 300, // per 5 minutes
  },
} as const;

/**
 * RateLimiter class implementing sliding window algorithm
 */
export class RateLimiter {
  private config: RateLimitConfig;
  private redis = getUpstashRedis();
  
  constructor(config: RateLimitConfig) {
    this.config = config;
  }
  
  /**
   * Generate Redis key for rate limiting
   */
  private getKey(identifier: string, endpoint: string): string {
    const prefix = this.config.keyPrefix || 'ratelimit';
    return `${prefix}:${endpoint}:${identifier}`;
  }
  
  /**
   * Check if a request is allowed under the rate limit
   */
  async checkLimit(sessionId: string, endpoint: string): Promise<RateLimitResult> {
    const key = this.getKey(sessionId, endpoint);
    const now = Date.now();
    const windowStart = now - (this.config.windowSeconds * 1000);
    
    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();
      
      // Remove old entries outside the window
      pipeline.zremrangebyscore(key, 0, windowStart);
      
      // Count current entries in the window
      pipeline.zcount(key, windowStart, now);
      
      // Execute pipeline
      const results = await pipeline.exec();
      
      // Extract the count from pipeline results
      // Upstash returns results in a different format than ioredis
      const currentCount = Number(results?.[1]) || 0;
      
      // Check if limit would be exceeded
      const allowed = currentCount < this.config.maxRequests;
      
      if (allowed) {
        // Add current request to the sorted set
        await this.redis.zadd(key, { score: now, member: `${now}-${Math.random()}` });
        
        // Set expiration on the key
        await this.redis.expire(key, this.config.windowSeconds);
      }
      
      // Calculate reset time (when oldest entry expires)
      const resetAt = windowStart + (this.config.windowSeconds * 1000);
      
      return {
        allowed,
        current: allowed ? currentCount + 1 : currentCount,
        limit: this.config.maxRequests,
        resetAt,
        remaining: Math.max(0, this.config.maxRequests - (allowed ? currentCount + 1 : currentCount)),
      };
    } catch (error) {
      console.error('Rate limiter error:', error);
      // On error, allow the request through to avoid blocking users
      return {
        allowed: true,
        current: 0,
        limit: this.config.maxRequests,
        resetAt: now + (this.config.windowSeconds * 1000),
        remaining: this.config.maxRequests,
      };
    }
  }
  
  /**
   * Reset rate limit for a specific session and endpoint
   */
  async reset(sessionId: string, endpoint: string): Promise<void> {
    const key = this.getKey(sessionId, endpoint);
    await this.redis.del(key);
  }
}

/**
 * Factory function to create rate limiters for different endpoints
 */
export function createRateLimiter(
  configOrName: RateLimitConfig | keyof typeof RATE_LIMITS
): RateLimiter {
  const config = typeof configOrName === 'string' 
    ? RATE_LIMITS[configOrName]
    : configOrName;
    
  return new RateLimiter(config);
}

/**
 * Express/Next.js style middleware for rate limiting
 */
export async function withRateLimit(
  sessionId: string,
  endpoint: string,
  config: RateLimitConfig | keyof typeof RATE_LIMITS
): Promise<RateLimitResult> {
  const limiter = createRateLimiter(config);
  return await limiter.checkLimit(sessionId, endpoint);
}

/**
 * Helper to add rate limit headers to response
 */
export function addRateLimitHeaders(headers: Headers, result: RateLimitResult): void {
  headers.set('X-RateLimit-Limit', result.limit.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', result.resetAt.toString());
  headers.set('X-RateLimit-Current', result.current.toString());
}