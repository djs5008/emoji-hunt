import { NextRequest, NextResponse } from 'next/server';
import { del } from '@/app/lib/upstash-redis';
import { checkDisconnectedPlayers } from '@/app/lib/player-heartbeat';

/**
 * Removes a player from a lobby
 * 
 * @description This endpoint handles player departure from a lobby, either through
 * explicit leave action or automatic cleanup (e.g., browser close via beacon API).
 * It removes the player's heartbeat and triggers cleanup to update the lobby state.
 * 
 * @param request - The incoming request containing player information
 * @param params - Route parameters containing:
 *   - id: The lobby ID the player is leaving
 * 
 * Request body can be in multiple formats:
 * - JSON: { playerId: string, explicit?: boolean }
 * - Plain text: Just the playerId or JSON string
 * 
 * @returns JSON response containing:
 *   - success: Boolean indicating if leave was successful
 *   - error: Error message if leave failed
 * 
 * @example
 * POST /api/lobby/ABC123/leave
 * Body: { playerId: "player_xyz", explicit: true }
 * Response: { success: true }
 * 
 * @throws {400} If playerId is missing
 * @throws {500} If there's a server error processing the leave
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Parse request body - supports multiple formats for browser compatibility
    const contentType = request.headers.get('content-type');
    let playerId: string;
    let isExplicitLeave = false;
    
    if (contentType?.includes('application/json')) {
      // Standard JSON request
      const data = await request.json();
      playerId = data.playerId;
      isExplicitLeave = data.explicit === true;
    } else {
      // Handle beacon API which sends as text/plain
      const text = await request.text();
      try {
        const data = JSON.parse(text);
        playerId = data.playerId;
        isExplicitLeave = data.explicit === true;
      } catch {
        // Fallback: plain player ID string
        playerId = text;
      }
    }
    
    const lobbyId = params.id;
    
    // Validate player ID
    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 });
    }
    
    // Remove player's session data immediately
    await del([
      `player:${lobbyId}:${playerId}:heartbeat`,
      `player:${lobbyId}:${playerId}:joinTime`
    ]);
    
    // Trigger cleanup to remove player from lobby and notify others
    await checkDisconnectedPlayers(lobbyId, playerId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[LEAVE] Error:', error);
    return NextResponse.json({ error: 'Failed to leave' }, { status: 500 });
  }
}