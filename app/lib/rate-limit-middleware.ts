import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from './player-session';
import { withRateLimit, addRateLimitHeaders, RateLimitConfig, RATE_LIMITS } from './rate-limiter';
import { logger } from './logger';

/**
 * Rate Limit Middleware for Next.js App Router
 * 
 * @description Provides easy-to-use middleware functions for applying
 * rate limiting to API routes in the emoji hunt game.
 */

export interface RateLimitOptions {
  /** Rate limit configuration or preset name */
  config: RateLimitConfig | keyof typeof RATE_LIMITS;
  /** Custom error message when rate limit is exceeded */
  errorMessage?: string;
  /** Whether to skip rate limiting for certain conditions */
  skip?: (request: NextRequest) => boolean | Promise<boolean>;
  /** Custom session extractor (defaults to using SessionManager) */
  getSessionId?: (request: NextRequest) => Promise<string | null>;
}

/**
 * Higher-order function that wraps an API route handler with rate limiting
 */
export function withRateLimitedRoute(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
  options: RateLimitOptions
) {
  return async function rateLimitedHandler(
    request: NextRequest,
    context?: any
  ): Promise<NextResponse> {
    // Extract endpoint from URL (outside try block so it's available in catch)
    const endpoint = new URL(request.url).pathname;
    let sessionId: string | null = null;
    
    try {
      // Check if rate limiting should be skipped
      if (options.skip && await options.skip(request)) {
        return handler(request, context);
      }
      
      // Get session ID
      if (options.getSessionId) {
        sessionId = await options.getSessionId(request);
      } else {
        // Default: use session from cookies
        const sessionData = await SessionManager.getSessionFromCookies();
        sessionId = sessionData?.session.id || null;
      }
      
      // If no session, return unauthorized
      if (!sessionId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      
      // Check rate limit
      const rateLimitResult = await withRateLimit(sessionId, endpoint, options.config);
      
      // Create response with rate limit headers
      const response = rateLimitResult.allowed
        ? await handler(request, context)
        : NextResponse.json(
            { 
              error: options.errorMessage || 'Rate limit exceeded',
              retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
            },
            { status: 429 }
          );
      
      // Add rate limit headers
      addRateLimitHeaders(response.headers, rateLimitResult);
      
      return response;
    } catch (error) {
      logger.error('Rate limit middleware error', error as Error, { endpoint, sessionId });
      // In case of rate limiter failure, allow the request through
      // This ensures the game remains playable even if rate limiting fails
      return handler(request, context);
    }
  };
}

/**
 * Simplified rate limit wrapper for common use cases
 */
export function rateLimit(configName: keyof typeof RATE_LIMITS) {
  return (handler: (request: NextRequest, context?: any) => Promise<NextResponse>) => {
    return withRateLimitedRoute(handler, { config: configName });
  };
}

/**
 * Rate limit check without wrapping the entire handler
 * Useful for conditional rate limiting within a route
 */
export async function checkRateLimit(
  request: NextRequest,
  configName: keyof typeof RATE_LIMITS
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const sessionData = await SessionManager.getSessionFromCookies();
  
  if (!sessionData) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }
  
  const endpoint = new URL(request.url).pathname;
  const rateLimitResult = await withRateLimit(
    sessionData.session.id,
    endpoint,
    configName
  );
  
  if (!rateLimitResult.allowed) {
    const response = NextResponse.json(
      { 
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
      },
      { status: 429 }
    );
    addRateLimitHeaders(response.headers, rateLimitResult);
    return { allowed: false, response };
  }
  
  return { allowed: true };
}