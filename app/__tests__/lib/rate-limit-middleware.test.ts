import { checkRateLimit, withRateLimitedRoute, rateLimit } from '@/app/lib/rate-limit-middleware';
import { SessionManager } from '@/app/lib/player-session';
import { withRateLimit, addRateLimitHeaders } from '@/app/lib/rate-limiter';
import { NextRequest, NextResponse } from 'next/server';

// Mock dependencies
jest.mock('@/app/lib/player-session');
jest.mock('@/app/lib/rate-limiter');

describe('rate-limit-middleware', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock request
    mockRequest = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Mock addRateLimitHeaders to not actually modify headers
    (addRateLimitHeaders as jest.Mock).mockImplementation((headers, result) => {
      // Do nothing - just for testing
    });
  });

  describe('checkRateLimit', () => {
    it('should allow request when under limit', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue({
        session: { id: 'session-123', playerId: 'player-123' },
      });
      
      (withRateLimit as jest.Mock).mockResolvedValue({
        allowed: true,
        current: 1,
        limit: 5,
        remaining: 4,
        resetAt: Date.now() + 10000,
      });
      
      const result = await checkRateLimit(mockRequest, 'STANDARD');
      
      expect(result.allowed).toBe(true);
      expect(result.response).toBeUndefined();
      expect(withRateLimit).toHaveBeenCalledWith(
        'session-123',
        '/api/test',
        'STANDARD'
      );
    });

    it('should block request when over limit', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue({
        session: { id: 'session-123', playerId: 'player-123' },
      });
      
      (withRateLimit as jest.Mock).mockResolvedValue({
        allowed: false,
        current: 6,
        limit: 5,
        remaining: 0,
        resetAt: Date.now() + 10000,
      });
      
      const result = await checkRateLimit(mockRequest, 'STANDARD');
      
      expect(result.allowed).toBe(false);
      expect(result.response).toBeDefined();
      
      // Check response
      const responseData = await result.response!.json();
      expect(result.response!.status).toBe(429);
      expect(responseData.error).toBe('Rate limit exceeded');
    });

    it('should handle missing session', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(null);
      
      const result = await checkRateLimit(mockRequest, 'STANDARD');
      
      expect(result.allowed).toBe(false);
      expect(result.response).toBeDefined();
      expect(result.response!.status).toBe(401);
    });

    it('should return rate limit error message', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue({
        session: { id: 'session-123', playerId: 'player-123' },
      });
      
      (withRateLimit as jest.Mock).mockResolvedValue({
        allowed: false,
        current: 6,
        limit: 5,
        remaining: 0,
        resetAt: Date.now() + 10000,
      });
      
      const result = await checkRateLimit(mockRequest, 'STANDARD');
      
      const responseData = await result.response!.json();
      expect(responseData.error).toBe('Rate limit exceeded');
      expect(responseData.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('withRateLimitedRoute', () => {
    const mockHandler = jest.fn();

    beforeEach(() => {
      mockHandler.mockResolvedValue(
        NextResponse.json({ success: true }, { status: 200 })
      );
    });

    it('should call handler when rate limit not exceeded', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue({
        session: { id: 'session-123', playerId: 'player-123' },
      });
      
      (withRateLimit as jest.Mock).mockResolvedValue({
        allowed: true,
        current: 1,
        limit: 5,
        remaining: 4,
        resetAt: Date.now() + 10000,
      });
      
      const wrappedHandler = withRateLimitedRoute(mockHandler, {
        config: { maxRequests: 5, windowSeconds: 60 },
      });
      
      const response = await wrappedHandler(mockRequest);
      
      expect(mockHandler).toHaveBeenCalledWith(mockRequest, undefined);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should return rate limit error when exceeded', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue({
        session: { id: 'session-123', playerId: 'player-123' },
      });
      
      (withRateLimit as jest.Mock).mockResolvedValue({
        allowed: false,
        current: 6,
        limit: 5,
        remaining: 0,
        resetAt: Date.now() + 10000,
      });
      
      const wrappedHandler = withRateLimitedRoute(mockHandler, {
        config: { maxRequests: 5, windowSeconds: 60 },
      });
      
      const response = await wrappedHandler(mockRequest);
      
      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(429);
    });

    it('should skip rate limiting when skip function returns true', async () => {
      const skipFn = jest.fn().mockReturnValue(true);
      
      const wrappedHandler = withRateLimitedRoute(mockHandler, {
        config: { maxRequests: 5, windowSeconds: 60 },
        skip: skipFn,
      });
      
      const response = await wrappedHandler(mockRequest);
      
      expect(skipFn).toHaveBeenCalledWith(mockRequest);
      expect(withRateLimit).not.toHaveBeenCalled();
      expect(mockHandler).toHaveBeenCalledWith(mockRequest, undefined);
    });

    it('should use custom session extractor', async () => {
      const customExtractor = jest.fn().mockResolvedValue('custom-session-id');
      
      (withRateLimit as jest.Mock).mockResolvedValue({
        allowed: true,
        current: 1,
        limit: 5,
        remaining: 4,
        resetAt: Date.now() + 10000,
      });
      
      const wrappedHandler = withRateLimitedRoute(mockHandler, {
        config: { maxRequests: 5, windowSeconds: 60 },
        getSessionId: customExtractor,
      });
      
      await wrappedHandler(mockRequest);
      
      expect(customExtractor).toHaveBeenCalledWith(mockRequest);
      expect(withRateLimit).toHaveBeenCalledWith(
        'custom-session-id',
        '/api/test',
        { maxRequests: 5, windowSeconds: 60 }
      );
    });

    it('should use predefined config name', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue({
        session: { id: 'session-123', playerId: 'player-123' },
      });
      
      (withRateLimit as jest.Mock).mockResolvedValue({
        allowed: true,
        current: 1,
        limit: 50,
        remaining: 49,
        resetAt: Date.now() + 2000,
      });
      
      const wrappedHandler = withRateLimitedRoute(mockHandler, {
        config: 'GAME_CLICK',
      });
      
      await wrappedHandler(mockRequest);
      
      expect(withRateLimit).toHaveBeenCalledWith(
        'session-123',
        '/api/test',
        'GAME_CLICK'
      );
    });

    it('should handle async skip function', async () => {
      const skipFn = jest.fn().mockResolvedValue(true);
      
      const wrappedHandler = withRateLimitedRoute(mockHandler, {
        config: { maxRequests: 5, windowSeconds: 60 },
        skip: skipFn,
      });
      
      await wrappedHandler(mockRequest);
      
      expect(skipFn).toHaveBeenCalledWith(mockRequest);
      expect(mockHandler).toHaveBeenCalled();
    });

    it('should add rate limit headers to successful response', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue({
        session: { id: 'session-123', playerId: 'player-123' },
      });
      
      const rateLimitResult = {
        allowed: true,
        current: 1,
        limit: 5,
        remaining: 4,
        resetAt: Date.now() + 10000,
      };
      
      (withRateLimit as jest.Mock).mockResolvedValue(rateLimitResult);
      
      const wrappedHandler = withRateLimitedRoute(mockHandler, {
        config: { maxRequests: 5, windowSeconds: 60 },
      });
      
      const response = await wrappedHandler(mockRequest);
      
      expect(addRateLimitHeaders).toHaveBeenCalledWith(
        response.headers,
        rateLimitResult
      );
    });
  });

  describe('rateLimit decorator', () => {
    it('should create a rate limited handler', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );
      
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue({
        session: { id: 'session-123', playerId: 'player-123' },
      });
      
      (withRateLimit as jest.Mock).mockResolvedValue({
        allowed: true,
        current: 1,
        limit: 50,
        remaining: 49,
        resetAt: Date.now() + 2000,
      });
      
      const rateLimitedHandler = rateLimit('GAME_CLICK')(mockHandler);
      const response = await rateLimitedHandler(mockRequest);
      
      expect(withRateLimit).toHaveBeenCalledWith(
        'session-123',
        '/api/test',
        'GAME_CLICK'
      );
      expect(mockHandler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });
});