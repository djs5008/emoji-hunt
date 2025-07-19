import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define public routes that don't require session validation
const PUBLIC_ROUTES = [
  '/',
  '/api/health',
  '/api/session',  // Session endpoint itself is public for checking/creating sessions
  '/favicon.ico',
  '/_next',
  '/static',
];

// Define API routes that don't require authentication
const PUBLIC_API_ROUTES = [
  '/api/lobby/[id]',  // GET lobby info is public
  '/api/lobby/[id]/sse',  // SSE streaming is handled separately
  '/api/game/check-progress',
  '/api/game/check-round-end',
  '/api/game/check-round-start',
  '/api/game/preload-round',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Skip middleware for public API routes (exact or pattern match)
  if (PUBLIC_API_ROUTES.some(route => {
    // Handle dynamic routes like /api/lobby/[id]
    const pattern = route.replace(/\[.*?\]/g, '[^/]+');
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(pathname);
  })) {
    return NextResponse.next();
  }

  // For protected API routes, we'll handle session validation in the route handlers
  // This is because Next.js middleware runs in Edge Runtime which has limitations
  // with certain Node.js APIs used in our session management
  
  // Add security headers
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; " +
      "font-src 'self'; " +
      "connect-src 'self' wss: ws:; " +
      "frame-ancestors 'none';"
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
};