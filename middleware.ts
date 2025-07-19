/**
 * Next.js Middleware
 * 
 * @description Handles authentication and routing logic for lobby pages.
 * Ensures players have joined a lobby before accessing the game page.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware function to protect lobby routes
 * 
 * @description Intercepts requests to lobby pages and validates player authentication.
 * Players without a valid session cookie are redirected to the join page.
 * 
 * @param {NextRequest} request - Incoming request object
 * @returns {NextResponse} Response object (redirect or pass-through)
 * 
 * Flow:
 * 1. Check if request is for a lobby page (not API)
 * 2. Verify player has authentication cookie
 * 3. Redirect to join page if not authenticated
 * 4. Pass through if authenticated (page will verify lobby membership)
 */
export async function middleware(request: NextRequest) {
  // Only handle direct navigation to /lobby/[id] routes (not API calls)
  // Check for HTML accept header to distinguish page loads from API requests
  if (request.nextUrl.pathname.startsWith('/lobby/') && 
      !request.nextUrl.pathname.includes('/api/') &&
      request.headers.get('accept')?.includes('text/html')) {
    
    // Extract lobby ID from URL path
    const lobbyId = request.nextUrl.pathname.split('/')[2];
    
    if (lobbyId) {
      // Check if player has a session cookie
      const sessionCookie = request.cookies.get('emoji-hunt-session')?.value;
      
      // If no session cookie, redirect to join screen
      // The join parameter pre-fills the lobby code
      if (!sessionCookie) {
        return NextResponse.redirect(new URL(`/?join=${lobbyId}`, request.url));
      }
      
      // If they have a session, let them through to the lobby page
      // The page will handle checking if they're actually in the lobby
    }
  }
  
  // Allow all other requests to proceed
  return NextResponse.next();
}

/**
 * Middleware configuration
 * 
 * @description Specifies which routes this middleware applies to.
 * Only runs on /lobby/* paths for performance.
 */
export const config = {
  matcher: '/lobby/:path*',  // Apply to all lobby routes and sub-routes
};