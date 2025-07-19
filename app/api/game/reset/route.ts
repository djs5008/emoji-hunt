import { NextRequest, NextResponse } from 'next/server';
import { resetGame } from '@/app/lib/game-state-transitions';
import { SessionManager } from '@/app/lib/player-session';
import { rateLimit } from '@/app/lib/rate-limit-middleware';

/**
 * Resets a game session to its initial state
 * 
 * @description This endpoint resets a game back to the waiting state, clearing all
 * scores and progress. Only the lobby host can reset the game. This is useful for
 * playing multiple rounds with the same group of players.
 * Rate limited to standard API limits.
 * 
 * @param {NextRequest} request - The incoming request containing:
 *   - lobbyId: The ID of the lobby to reset
 * 
 * @returns {NextResponse} JSON response containing:
 *   - success: Boolean indicating if the game was reset successfully
 *   - error: Error message if the game couldn't be reset
 * 
 * @example
 * POST /api/game/reset
 * Body: { lobbyId: "abc123" }
 * Response: { success: true }
 * 
 * @throws {400} If lobbyId is missing
 * @throws {401} If no valid session exists
 * @throws {403} If the player is not the host of the lobby
 * @throws {429} If rate limit exceeded
 * @throws {500} If there's a server error resetting the game
 */
export const POST = rateLimit('STANDARD')(async function handleResetGame(request: NextRequest) {
  try {
    // Get player session from cookies
    const sessionData = await SessionManager.getSessionFromCookies();
    if (!sessionData) {
      return NextResponse.json({ error: 'No valid session' }, { status: 401 });
    }
    
    const { session } = sessionData;
    const playerId = session.playerId;
    
    // Extract lobby information
    const { lobbyId } = await request.json();
    
    // Validate required fields
    if (!lobbyId) {
      return NextResponse.json({ error: 'Lobby ID is required' }, { status: 400 });
    }
    
    // Attempt to reset the game (will fail if player is not host)
    const success = await resetGame(lobbyId, playerId);
    
    // Check if the player has permission to reset
    if (!success) {
      return NextResponse.json({ error: 'Failed to reset game. Are you the host?' }, { status: 403 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[RESET GAME] Error:', error);
    return NextResponse.json({ error: 'Failed to reset game' }, { status: 500 });
  }
});