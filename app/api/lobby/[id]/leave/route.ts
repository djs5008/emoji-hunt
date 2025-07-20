import { NextRequest, NextResponse } from 'next/server';
import { del } from '@/app/lib/ioredis-client';
import { checkDisconnectedPlayers } from '@/app/lib/player-heartbeat';
import { SessionManager } from '@/app/lib/player-session';
import { rateLimit } from '@/app/lib/rate-limit-middleware';
import { logger } from '@/app/lib/logger';
import { getLobby } from '@/app/lib/ioredis-storage';

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
    let useGracePeriod = false;
    
    if (contentType?.includes('application/json')) {
      try {
        const data = await request.json();
        isExplicitLeave = data.explicit === true;
        useGracePeriod = data.gracePeriod === true;
      } catch {
        // Body is optional, ignore parse errors
      }
    }
    
    const lobbyId = params.id;
    
    logger.info('Player leaving lobby', {
      lobbyId,
      playerId,
      isExplicitLeave,
      useGracePeriod,
      contentType,
      method: request.method,
      userAgent: request.headers.get('user-agent'),
    });
    
    if (useGracePeriod) {
      // For potential refresh: Mark player as disconnecting but don't remove yet
      // They have time to reconnect before being removed by heartbeat system
      await del(`player:${lobbyId}:${playerId}:heartbeat`);
      // Keep joinTime so they can rejoin
      
      // For solo games, we need to be extra careful not to remove the only player
      const lobby = await getLobby(lobbyId);
      if (lobby && lobby.players.length === 1) {
        logger.info('Solo game detected, skipping immediate cleanup', { lobbyId, playerId });
        // Don't check disconnected players for solo games
        return NextResponse.json({ success: true });
      }
      
      // Don't check disconnected players - let the periodic heartbeat system handle it
      // This gives the player time to rejoin before being removed
    } else {
      // Explicit leave or no grace period: Remove immediately
      await del([
        `player:${lobbyId}:${playerId}:heartbeat`,
        `player:${lobbyId}:${playerId}:joinTime`
      ]);
      
      // Force remove the player
      await checkDisconnectedPlayers(lobbyId, playerId);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error processing leave request', error as Error);
    return NextResponse.json({ error: 'Failed to leave' }, { status: 500 });
  }
});