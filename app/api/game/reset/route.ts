import { NextRequest, NextResponse } from 'next/server';
import { resetGame } from '@/app/lib/game-state-transitions';

/**
 * Resets a game session to its initial state
 * 
 * @description This endpoint resets a game back to the waiting state, clearing all
 * scores and progress. Only the lobby host can reset the game. This is useful for
 * playing multiple rounds with the same group of players.
 * 
 * @param {NextRequest} request - The incoming request containing:
 *   - lobbyId: The ID of the lobby to reset
 *   - playerId: The ID of the player attempting to reset (must be host)
 * 
 * @returns {NextResponse} JSON response containing:
 *   - success: Boolean indicating if the game was reset successfully
 *   - error: Error message if the game couldn't be reset
 * 
 * @example
 * POST /api/game/reset
 * Body: { lobbyId: "abc123", playerId: "host_player_id" }
 * Response: { success: true }
 * 
 * @throws {400} If lobbyId or playerId is missing
 * @throws {403} If the player is not the host of the lobby
 * @throws {500} If there's a server error resetting the game
 */
export async function POST(request: NextRequest) {
  try {
    // Extract lobby and player information
    const { lobbyId, playerId } = await request.json();
    
    // Validate required fields
    if (!lobbyId || !playerId) {
      return NextResponse.json({ error: 'Lobby ID and player ID are required' }, { status: 400 });
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
}