import { NextRequest, NextResponse } from 'next/server';
import { getLobby } from '@/app/lib/game-state-async';

/**
 * Retrieves lobby information by ID
 * 
 * @description This endpoint fetches the current state of a lobby including all
 * players, scores, and game state. This is typically used when a player loads
 * the lobby page or needs to refresh their view of the game state.
 * 
 * @param request - The incoming request
 * @param params - Route parameters containing:
 *   - id: The lobby ID to fetch (case-insensitive)
 * 
 * @returns JSON response containing:
 *   - The complete lobby object if found
 *   - error: Error message if lobby not found or fetch failed
 * 
 * @example
 * GET /api/lobby/ABC123
 * Response: { 
 *   id: "ABC123",
 *   players: [...],
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
    
    // Return current lobby state
    // Note: Sensitive data like emoji positions during gameplay
    // are handled separately via SSE for security
    return NextResponse.json(lobby);
  } catch (error) {
    console.error('Error fetching lobby:', error);
    return NextResponse.json({ error: 'Failed to fetch lobby' }, { status: 500 });
  }
}