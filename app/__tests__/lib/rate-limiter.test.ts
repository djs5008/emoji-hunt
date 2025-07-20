import { RateLimiter, withRateLimit, addRateLimitHeaders, RATE_LIMITS } from '@/app/lib/rate-limiter';
import { getIoRedis } from '@/app/lib/ioredis-client';
import { NextResponse } from 'next/server';

// Mock dependencies
jest.mock('@/app/lib/ioredis-client');

describe('RateLimiter', () => {
  let mockRedis: any;
  let mockPipeline: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock pipeline
    mockPipeline = {
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcount: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };
    
    // Mock Redis
    mockRedis = {
      pipeline: jest.fn().mockReturnValue(mockPipeline),
      zadd: jest.fn(),
      expire: jest.fn(),
      del: jest.fn(),
    };
    (getIoRedis as jest.Mock).mockReturnValue(mockRedis);
  });

  describe('checkLimit', () => {
    it('should allow first request', async () => {
      // ioredis pipeline returns [[error, result], [error, result]]
      mockPipeline.exec.mockResolvedValue([
        [null, 0], // zremrangebyscore result
        [null, 0]  // zcount result - no existing requests
      ]);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      
      const limiter = new RateLimiter({ maxRequests: 5, windowSeconds: 10 });
      const result = await limiter.checkLimit('session123', '/api/test');
      
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(4);
      expect(result.resetAt).toBeGreaterThan(0);
      expect(result.resetAt).toBeLessThanOrEqual(Date.now() + 10000);
      
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'ratelimit:/api/test:session123',
        expect.any(Number), // score (timestamp)
        expect.any(String)  // member
      );
    });

    it('should track multiple requests', async () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowSeconds: 10 });
      
      // First request
      mockPipeline.exec.mockResolvedValue([[null, 0], [null, 0]]);
      const result1 = await limiter.checkLimit('session123', '/api/test');
      expect(result1.remaining).toBe(4);
      
      // Second request
      mockPipeline.exec.mockResolvedValue([[null, 0], [null, 1]]);
      const result2 = await limiter.checkLimit('session123', '/api/test');
      expect(result2.remaining).toBe(3);
      
      // Third request
      mockPipeline.exec.mockResolvedValue([[null, 0], [null, 2]]);
      const result3 = await limiter.checkLimit('session123', '/api/test');
      expect(result3.remaining).toBe(2);
    });

    it('should block when limit exceeded', async () => {
      mockPipeline.exec.mockResolvedValue([[null, 0], [null, 5]]); // Already at limit
      
      const limiter = new RateLimiter({ maxRequests: 5, windowSeconds: 10 });
      const result = await limiter.checkLimit('session123', '/api/test');
      
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(5);
      expect(result.remaining).toBe(0);
      expect(mockRedis.zadd).not.toHaveBeenCalled(); // Should not add when blocked
    });

    it('should handle different sessions independently', async () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowSeconds: 10 });
      
      mockPipeline.exec.mockResolvedValue([[null, 0], [null, 0]]);
      await limiter.checkLimit('session123', '/api/test');
      
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'ratelimit:/api/test:session123',
        expect.any(Number),
        expect.any(String)
      );
      
      mockRedis.zadd.mockClear();
      
      await limiter.checkLimit('session456', '/api/test');
      
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'ratelimit:/api/test:session456',
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should handle different endpoints independently', async () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowSeconds: 10 });
      
      mockPipeline.exec.mockResolvedValue([[null, 0], [null, 0]]);
      await limiter.checkLimit('session123', '/api/test1');
      
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'ratelimit:/api/test1:session123',
        expect.any(Number),
        expect.any(String)
      );
      
      mockRedis.zadd.mockClear();
      
      await limiter.checkLimit('session123', '/api/test2');
      
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'ratelimit:/api/test2:session123',
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockPipeline.exec.mockRejectedValue(new Error('Redis connection failed'));
      
      const limiter = new RateLimiter({ maxRequests: 5, windowSeconds: 10 });
      const result = await limiter.checkLimit('session123', '/api/test');
      
      // Should allow request on error
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(0);
      expect(result.remaining).toBe(5);
    });
  });

  describe('reset', () => {
    it('should reset rate limit for session and endpoint', async () => {
      mockRedis.del.mockResolvedValue(1);
      
      const limiter = new RateLimiter({ maxRequests: 5, windowSeconds: 10 });
      await limiter.reset('session123', '/api/test');
      
      expect(mockRedis.del).toHaveBeenCalledWith('ratelimit:/api/test:session123');
    });
  });

  describe('withRateLimit', () => {
    it('should allow request when under limit', async () => {
      mockPipeline.exec.mockResolvedValue([[null, 0], [null, 0]]);
      mockRedis.zadd.mockResolvedValue(1);
      
      const result = await withRateLimit(
        'session123',
        '/api/test',
        { maxRequests: 5, windowSeconds: 10 }
      );
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should block request when over limit', async () => {
      mockPipeline.exec.mockResolvedValue([[null, 0], [null, 5]]);
      
      const result = await withRateLimit(
        'session123',
        '/api/test',
        { maxRequests: 5, windowSeconds: 10 }
      );
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should use predefined rate limits', async () => {
      mockPipeline.exec.mockResolvedValue([[null, 0], [null, 0]]);
      
      const result = await withRateLimit(
        'session123',
        '/api/game/click',
        'GAME_CLICK'
      );
      
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(50); // GAME_CLICK limit
    });
  });

  describe('addRateLimitHeaders', () => {
    it('should add rate limit headers to response', () => {
      const headers = new Headers();
      const result = {
        allowed: true,
        limit: 5,
        remaining: 4,
        resetAt: Date.now() + 10000,
        current: 1,
      };
      
      addRateLimitHeaders(headers, result);
      
      expect(headers.get('X-RateLimit-Limit')).toBe('5');
      expect(headers.get('X-RateLimit-Remaining')).toBe('4');
      expect(headers.get('X-RateLimit-Reset')).toBeTruthy();
      expect(headers.get('X-RateLimit-Current')).toBe('1');
    });
  });

  describe('RATE_LIMITS configuration', () => {
    it('should have correct configuration for lobby create', () => {
      expect(RATE_LIMITS.LOBBY_CREATE).toEqual({
        maxRequests: 5,
        windowSeconds: 60,
      });
    });

    it('should have correct configuration for game click', () => {
      expect(RATE_LIMITS.GAME_CLICK).toEqual({
        maxRequests: 50,
        windowSeconds: 2,
      });
    });

    it('should have correct configuration for standard endpoints', () => {
      expect(RATE_LIMITS.STANDARD).toEqual({
        maxRequests: 30,
        windowSeconds: 60,
      });
    });

    it('should have correct configuration for strict endpoints', () => {
      expect(RATE_LIMITS.STRICT).toEqual({
        maxRequests: 5,
        windowSeconds: 300,
      });
    });
  });
});