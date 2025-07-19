import { NextRequest, NextResponse } from 'next/server';
import { del } from '@/app/lib/upstash-redis';
import { checkDisconnectedPlayers } from '@/app/lib/player-heartbeat';
import { SessionManager } from '@/app/lib/player-session';
import { rateLimit } from '@/app/lib/rate-limit-middleware';

/**
 * Removes a player from a lobby
 * 
 * @description This endpoint handles player departure from a lobby, either through
 * explicit leave action or automatic cleanup (e.g., browser close via beacon API).
 * It removes the player's heartbeat and triggers cleanup to update the lobby state.
 * Rate limited to standard API limits.
 * 
 * @param request - The incoming request
 * @param params - Route parameters containing:
 *   - id: The lobby ID the player is leaving
 * 
 * Request body (optional):
 * - JSON: { explicit?: boolean }
 * 
 * @returns JSON response containing:
 *   - success: Boolean indicating if leave was successful
 *   - error: Error message if leave failed
 * 
 * @example
 * POST /api/lobby/ABC123/leave
 * Body: { explicit: true }
 * Response: { success: true }
 * 
 * @throws {401} If no valid session exists
 * @throws {429} If rate limit exceeded
 * @throws {500} If there's a server error processing the leave
 */
export const POST = rateLimit('STANDARD')(async function handleLeaveLobby(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get player session from cookies
    const sessionData = await SessionManager.getSessionFromCookies();
    if (!sessionData) {
      return NextResponse.json({ error: 'No valid session' }, { status: 401 });
    }
    
    const { session } = sessionData;
    const playerId = session.playerId;
    
    // Parse optional request body
    const contentType = request.headers.get('content-type');
    let isExplicitLeave = false;
    
    if (contentType?.includes('application/json')) {
      try {
        const data = await request.json();
        isExplicitLeave = data.explicit === true;
      } catch {
        // Body is optional, ignore parse errors
      }
    }
    
    const lobbyId = params.id;
    
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
});