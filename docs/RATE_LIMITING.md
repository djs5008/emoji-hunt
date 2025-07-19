# Rate Limiting System Documentation

## Overview

The emoji hunt game implements a session-based rate limiting system using Redis and a sliding window algorithm. This ensures fair play and prevents abuse while allowing legitimate rapid gameplay actions.

## Features

- **Session-based limiting**: Rate limits are applied per session (not IP-based)
- **Sliding window algorithm**: Provides smooth rate limiting without sudden resets
- **Configurable limits**: Different endpoints can have different rate limits
- **Real-time game optimized**: Allows rapid clicking during gameplay
- **Graceful degradation**: If rate limiting fails, requests are allowed through
- **HTTP headers**: Rate limit information included in response headers

## Implementation Details

### Core Components

1. **`/app/lib/rate-limiter.ts`**: Core rate limiting logic
   - Implements sliding window algorithm using Redis sorted sets
   - Provides configurable rate limit configurations
   - Handles rate limit checking and resets

2. **`/app/lib/rate-limit-middleware.ts`**: Next.js middleware integration
   - Provides easy-to-use wrappers for API routes
   - Handles session extraction and error responses
   - Adds rate limit headers to responses

### Predefined Rate Limits

```typescript
// Game click endpoint - very permissive for rapid clicking
GAME_CLICK: {
  maxRequests: 50,  // 50 clicks allowed
  windowSeconds: 2,  // per 2 seconds (25 clicks/second max)
}

// Lobby operations - moderate limits
LOBBY_CREATE: {
  maxRequests: 5,   // 5 lobby creations
  windowSeconds: 60, // per minute
}

LOBBY_JOIN: {
  maxRequests: 10,  // 10 join attempts
  windowSeconds: 60, // per minute
}

// Standard API endpoints
STANDARD: {
  maxRequests: 30,  // 30 requests
  windowSeconds: 60, // per minute
}

// Strict limit for sensitive operations
STRICT: {
  maxRequests: 5,   // 5 requests
  windowSeconds: 300, // per 5 minutes
}
```

## Usage Examples

### Basic Usage (Simplified Wrapper)

```typescript
import { rateLimit } from '@/app/lib/rate-limit-middleware';

// Apply standard rate limiting to an endpoint
export const POST = rateLimit('STANDARD')(async (request) => {
  // Your endpoint logic here
  return NextResponse.json({ success: true });
});
```

### Custom Configuration

```typescript
import { withRateLimitedRoute } from '@/app/lib/rate-limit-middleware';

export const POST = withRateLimitedRoute(
  async (request) => {
    // Your endpoint logic here
    return NextResponse.json({ success: true });
  },
  {
    config: {
      maxRequests: 20,
      windowSeconds: 60,
    },
    errorMessage: 'Custom rate limit exceeded message',
  }
);
```

### Conditional Rate Limiting

```typescript
import { checkRateLimit } from '@/app/lib/rate-limit-middleware';

export async function POST(request: NextRequest) {
  const { action } = await request.json();
  
  // Only rate limit certain actions
  if (action === 'sensitive_operation') {
    const check = await checkRateLimit(request, 'STRICT');
    if (!check.allowed) {
      return check.response!;
    }
  }
  
  // Continue with endpoint logic
  return NextResponse.json({ success: true });
}
```

## Applied Endpoints

The following endpoints have rate limiting applied:

1. **Game Operations**:
   - `/api/game/click` - GAME_CLICK (50 req/2s) - Allows rapid clicking
   - `/api/game/start` - STANDARD (30 req/min)
   - `/api/game/reset` - STANDARD (30 req/min)

2. **Lobby Operations**:
   - `/api/lobby/create` - LOBBY_CREATE (5 req/min)
   - `/api/lobby/join` - LOBBY_JOIN (10 req/min)
   - `/api/lobby/[id]/leave` - STANDARD (30 req/min)

3. **Session Management**:
   - `/api/session` (GET/DELETE) - STANDARD (30 req/min)

## Response Headers

Rate limited responses include the following headers:

- `X-RateLimit-Limit`: Maximum requests allowed in the window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp (ms) when the rate limit resets
- `X-RateLimit-Current`: Current number of requests in the window

## Error Response

When rate limit is exceeded:

```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 45  // seconds until rate limit resets
}
```

HTTP Status: 429 (Too Many Requests)

## Testing

To test the rate limiter:

```bash
npx tsx test-rate-limiter.ts
```

This will run various tests including:
- Basic rate limiting
- Separate limits for different endpoints
- Separate limits for different sessions
- Reset functionality
- High-throughput game click simulation

## Considerations

1. **Game Performance**: The game click endpoint has very permissive limits (25 clicks/second) to ensure smooth gameplay
2. **Session-based**: Uses session cookies, not IP addresses, for better user experience behind NAT/proxies
3. **Graceful Degradation**: If Redis fails, requests are allowed through to maintain game availability
4. **Sliding Window**: Provides smooth rate limiting without sudden resets that could interrupt gameplay

## Future Enhancements

1. **Dynamic Limits**: Adjust limits based on game state (e.g., more permissive during active rounds)
2. **Burst Allowance**: Allow short bursts above the limit for better UX
3. **Analytics**: Track rate limit hits for monitoring and adjustment
4. **Per-Player Limits**: Different limits for premium/verified players