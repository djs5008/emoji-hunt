import { NextRequest, NextResponse } from 'next/server';
import { startGame } from '@/app/lib/game-state-transitions';

/**
 * Starts a game session for a lobby
 * 
 * @description This endpoint initiates a new game for a lobby. Only the lobby host
 * (the player who created the lobby) can start the game. This transitions the game
 * state from 'waiting' to 'playing' and begins the first round.
 * 
 * @param {NextRequest} request - The incoming request containing:
 *   - lobbyId: The ID of the lobby to start the game for
 *   - playerId: The ID of the player attempting to start the game (must be host)
 * 
 * @returns {NextResponse} JSON response containing:
 *   - success: Boolean indicating if the game started successfully
 *   - error: Error message if the game couldn't be started
 * 
 * @example
 * POST /api/game/start
 * Body: { lobbyId: "abc123", playerId: "host_player_id" }
 * Response: { success: true }
 * 
 * @throws {400} If lobbyId or playerId is missing
 * @throws {403} If the player is not the host of the lobby
 * @throws {500} If there's a server error starting the game
 */
export async function POST(request: NextRequest) {
  try {
    // Extract lobby and player information
    const { lobbyId, playerId } = await request.json();
    
    // Validate required fields
    if (!lobbyId || !playerId) {
      return NextResponse.json({ error: 'Lobby ID and player ID are required' }, { status: 400 });
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
}