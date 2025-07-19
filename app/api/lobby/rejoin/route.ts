import { NextRequest, NextResponse } from 'next/server';
import { getLobby } from '@/app/lib/game-state-async';
import { SessionManager } from '@/app/lib/player-session';

/**
 * Allows a player to rejoin an existing lobby
 * 
 * @description This endpoint handles reconnection scenarios where a player who was
 * previously in a lobby needs to rejoin (e.g., after page refresh, network disconnect).
 * It verifies the player was already part of the lobby and returns their current state.
 * 
 * @param {NextRequest} request - The incoming request containing:
 *   - lobbyId: The ID of the lobby to rejoin
 * 
 * @returns {NextResponse} JSON response containing:
 *   - lobby: The current lobby state
 *   - playerId: The player's ID
 *   - player: The player's current data (score, nickname, etc.)
 *   - error: Error message if rejoin failed
 * 
 * @example
 * POST /api/lobby/rejoin
 * Body: { lobbyId: "ABC123" }
 * Response: { 
 *   lobby: { ... },
 *   playerId: "player_xyz",
 *   player: { id: "player_xyz", nickname: "Alice", score: 100 }
 * }
 * 
 * @throws {400} If lobbyId is missing
 * @throws {401} If no valid session exists
 * @throws {404} If lobby doesn't exist or player not found in lobby
 * @throws {500} If there's a server error rejoining
 */
export async function POST(request: NextRequest) {
  try {
    // Get player session from cookies
    const sessionData = await SessionManager.getSessionFromCookies();
    if (!sessionData) {
      return NextResponse.json({ error: 'No valid session' }, { status: 401 });
    }
    
    const { session } = sessionData;
    const playerId = session.playerId;
    
    // Extract lobby ID
    const { lobbyId } = await request.json();
    
    // Validate required fields
    if (!lobbyId) {
      return NextResponse.json({ error: 'Lobby ID is required' }, { status: 400 });
    }
    
    // Fetch lobby data (case-insensitive)
    const lobby = await getLobby(lobbyId.toUpperCase());
    
    if (!lobby) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }
    
    // Verify player was previously in this lobby
    const player = lobby.players.find(p => p.id === playerId);
    if (!player) {
      return NextResponse.json({ error: 'Player not found in lobby' }, { status: 404 });
    }
    
    // Return full state for seamless reconnection
    return NextResponse.json({
      lobby,
      playerId,
      player,
    });
  } catch (error) {
    console.error('Error rejoining lobby:', error);
    return NextResponse.json({ error: 'Failed to rejoin lobby' }, { status: 500 });
  }
}