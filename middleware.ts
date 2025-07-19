import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Only handle direct navigation to /lobby/[id] routes (not API calls)
  if (request.nextUrl.pathname.startsWith('/lobby/') && 
      !request.nextUrl.pathname.includes('/api/') &&
      request.headers.get('accept')?.includes('text/html')) {
    
    const lobbyId = request.nextUrl.pathname.split('/')[2];
    
    if (lobbyId) {
      // Check if player has a playerId cookie
      const playerId = request.cookies.get('playerId')?.value;
      
      // If no playerId cookie, redirect to join screen
      if (!playerId) {
        return NextResponse.redirect(new URL(`/?join=${lobbyId}`, request.url));
      }
      
      // If they have a playerId, let them through to the lobby page
      // The page will handle checking if they're actually in the lobby
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/lobby/:path*',
};