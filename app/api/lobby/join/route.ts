import { NextRequest, NextResponse } from 'next/server';
import { joinLobby } from '@/app/lib/game-state-async';
import { broadcastToLobby, SSE_EVENTS } from '@/app/lib/sse-broadcast';
import { setex } from '@/app/lib/upstash-redis';
import { SessionManager } from '@/app/lib/player-session';
import { withRateLimitedRoute } from '@/app/lib/rate-limit-middleware';
import { logger } from '@/app/lib/logger';


/**
 * Joins an existing game lobby
 * 
 * @description This endpoint allows a player to join an existing lobby using its ID.
 * Players can only join lobbies that are in the 'waiting' state. Once joined, the
 * player is added to the lobby and all other players are notified via SSE.
 * Rate limited to 10 requests per minute to prevent spam.
 * 
 * @param {NextRequest} request - The incoming request containing:
 *   - lobbyId: The ID of the lobby to join (case-insensitive)
 *   - nickname: The display name for the joining player
 * 
 * @returns {NextResponse} JSON response containing:
 *   - lobby: The updated lobby object with the new player
 *   - playerId: The ID assigned to the joining player
 *   - sessionToken: The session token (only for new sessions)
 *   - error: Error message if join failed
 * 
 * @example
 * POST /api/lobby/join
 * Body: { lobbyId: "ABC123", nickname: "Bob" }
 * Response: { 
 *   lobby: { id: "ABC123", players: [...], state: "waiting" },
 *   playerId: "player_xyz"
 * }
 * 
 * @throws {400} If lobbyId or nickname is missing
 * @throws {404} If lobby doesn't exist or game already started
 * @throws {429} If rate limit exceeded
 * @throws {500} If there's a server error joining the lobby
 */
async function handleJoinLobby(request: NextRequest) {
  try {
    // Extract join information from request
    const { lobbyId, nickname } = await request.json();

    // Validate required fields
    if (!lobbyId || !nickname || nickname.trim().length === 0) {
      return NextResponse.json(
        { error: 'Lobby ID and nickname are required' },
        { status: 400 }
      );
    }

    // Get or create player session
    const { session, isNew } = await SessionManager.getOrCreateSession();
    const playerId = session.playerId;
    
    // Attempt to join the lobby (lobby IDs are case-insensitive)
    const lobby = await joinLobby(
      lobbyId.toUpperCase(),
      playerId,
      nickname.trim()
    );

    // Check if lobby exists and is joinable
    if (!lobby) {
      return NextResponse.json(
        { error: 'Lobby not found or game already started' },
        { status: 404 }
      );
    }

    // Set up player heartbeat for connection monitoring
    const upperLobbyId = lobbyId.toUpperCase();
    await setex(`player:${upperLobbyId}:${playerId}:heartbeat`, 10, Date.now().toString());
    
    // Track join time for reconnection handling
    await setex(`player:${upperLobbyId}:${playerId}:joinTime`, 60, Date.now().toString());

    // Notify all players in the lobby about the new player
    await broadcastToLobby(lobbyId.toUpperCase(), SSE_EVENTS.PLAYER_JOINED, {
      lobby,
      playerId,
    });

    const response: any = {
      lobby,
      playerId,
    };

    // Include session token in response only for new sessions
    // This allows the client to verify the session was created
    if (isNew) {
      response.sessionToken = session.id;
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error joining lobby', error as Error);
    return NextResponse.json(
      { error: 'Failed to join lobby' },
      { status: 500 }
    );
  }
}

// Export the rate-limited POST handler with custom session ID getter
export const POST = withRateLimitedRoute(handleJoinLobby, {
  config: 'LOBBY_JOIN',
  errorMessage: 'Too many join attempts. Please wait before trying again.',
  getSessionId: async (request: NextRequest) => {
    // For lobby join, allow rate limiting by IP if no session exists yet
    const sessionData = await SessionManager.getSessionFromCookies();
    if (sessionData) {
      return sessionData.session.id;
    }
    
    // Fallback to IP-based rate limiting for new users
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
    return `ip:${ip}`;
  },
});