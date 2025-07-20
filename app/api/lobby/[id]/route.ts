import { NextRequest, NextResponse } from 'next/server';
import { getLobby } from '@/app/lib/ioredis-storage';
import { SessionManager } from '@/app/lib/player-session';
import { logger } from '@/app/lib/logger';

/**
 * Retrieves lobby information by ID
 * 
 * @description This endpoint fetches the current state of a lobby including all
 * players, scores, and game state. It also identifies the current player based on
 * their session and marks them with an `isCurrent` field. This is typically used 
 * when a player loads the lobby page or needs to refresh their view of the game state.
 * 
 * @param request - The incoming request
 * @param params - Route parameters containing:
 *   - id: The lobby ID to fetch (case-insensitive)
 * 
 * @returns JSON response containing:
 *   - The complete lobby object if found, with players marked with `isCurrent` field
 *   - error: Error message if lobby not found or fetch failed
 * 
 * @example
 * GET /api/lobby/ABC123
 * Response: { 
 *   id: "ABC123",
 *   players: [
 *     { id: "player_123", nickname: "Alice", isCurrent: true, ... },
 *     { id: "player_456", nickname: "Bob", isCurrent: false, ... }
 *   ],
 *   state: "playing",
 *   currentRound: 1,
 *   ...
 * }
 * 
 * @throws {404} If the lobby doesn't exist
 * @throws {500} If there's a server error fetching the lobby
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Fetch lobby data (IDs are case-insensitive)
    const lobby = await getLobby(params.id.toUpperCase());
    
    // Check if lobby exists
    if (!lobby) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }
    
    // Get current player session
    const sessionData = await SessionManager.getSessionFromCookies();
    const currentPlayerId = sessionData?.session.playerId;
    
    // Mark the current player in the players array
    const lobbyWithCurrentPlayer = {
      ...lobby,
      players: lobby.players.map(player => ({
        ...player,
        isCurrent: currentPlayerId ? player.id === currentPlayerId : false
      }))
    };
    
    // Return lobby state with current player marked
    // Note: Sensitive data like emoji positions during gameplay
    // are handled separately via SSE for security
    return NextResponse.json(lobbyWithCurrentPlayer);
  } catch (error) {
    logger.error('Error fetching lobby', error as Error);
    return NextResponse.json({ error: 'Failed to fetch lobby' }, { status: 500 });
  }
}