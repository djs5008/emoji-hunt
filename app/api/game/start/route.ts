import { NextRequest, NextResponse } from 'next/server';
import { startGame } from '@/app/lib/game-state-transitions';
import { SessionManager } from '@/app/lib/player-session';
import { rateLimit } from '@/app/lib/rate-limit-middleware';

/**
 * Starts a game session for a lobby
 * 
 * @description This endpoint initiates a new game for a lobby. Only the lobby host
 * (the player who created the lobby) can start the game. This transitions the game
 * state from 'waiting' to 'playing' and begins the first round.
 * Rate limited to standard API limits.
 * 
 * @param {NextRequest} request - The incoming request containing:
 *   - lobbyId: The ID of the lobby to start the game for
 * 
 * @returns {NextResponse} JSON response containing:
 *   - success: Boolean indicating if the game started successfully
 *   - error: Error message if the game couldn't be started
 * 
 * @example
 * POST /api/game/start
 * Body: { lobbyId: "abc123" }
 * Response: { success: true }
 * 
 * @throws {400} If lobbyId is missing
 * @throws {401} If no valid session exists
 * @throws {403} If the player is not the host of the lobby
 * @throws {429} If rate limit exceeded
 * @throws {500} If there's a server error starting the game
 */
export const POST = rateLimit('STANDARD')(async function handleStartGame(request: NextRequest) {
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
    
    // Attempt to start the game (will fail if player is not host)
    const success = await startGame(lobbyId, playerId);
    
    // Check if the player has permission to start the game
    if (!success) {
      return NextResponse.json({ error: 'Failed to start game. Are you the host?' }, { status: 403 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[START GAME] Error:', error);
    return NextResponse.json({ error: 'Failed to start game' }, { status: 500 });
  }
});