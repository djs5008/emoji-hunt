import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/app/lib/player-session';
import { rateLimit } from '@/app/lib/rate-limit-middleware';

/**
 * Session management endpoint
 * 
 * GET: Validates current session and returns player info
 * DELETE: Clears session (logout)
 * Both endpoints are rate limited to standard API limits.
 */

/**
 * Get current session information
 * 
 * @returns {NextResponse} JSON response containing:
 *   - valid: Boolean indicating if session is valid
 *   - playerId: The player ID if session is valid
 *   - createdAt: Session creation timestamp
 *   - lastActivity: Last activity timestamp
 * @throws {429} If rate limit exceeded
 */
export const GET = rateLimit('STANDARD')(async function handleGetSession(request: NextRequest) {
  try {
    const sessionData = await SessionManager.getSessionFromCookies();
    
    if (!sessionData) {
      return NextResponse.json({ valid: false });
    }
    
    const { session } = sessionData;
    
    return NextResponse.json({
      valid: true,
      playerId: session.playerId,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
    });
  } catch (error) {
    console.error('Error getting session:', error);
    return NextResponse.json({ valid: false });
  }
});

/**
 * Clear session (logout)
 * 
 * @returns {NextResponse} JSON response indicating success
 * @throws {429} If rate limit exceeded
 */
export const DELETE = rateLimit('STANDARD')(async function handleDeleteSession(request: NextRequest) {
  try {
    const sessionData = await SessionManager.getSessionFromCookies();
    
    if (sessionData) {
      // Delete session from Redis
      await SessionManager.deleteSession(sessionData.token);
    }
    
    // Clear cookie
    await SessionManager.clearSessionCookie();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing session:', error);
    return NextResponse.json({ error: 'Failed to clear session' }, { status: 500 });
  }
});