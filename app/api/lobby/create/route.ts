import { NextRequest, NextResponse } from 'next/server';
import { createLobby, getLobby } from '@/app/lib/game-state-async';
import { nanoid } from 'nanoid';
import { setex } from '@/app/lib/upstash-redis';
import { SessionManager } from '@/app/lib/player-session';
import { withRateLimitedRoute } from '@/app/lib/rate-limit-middleware';
import { logger } from '@/app/lib/logger';

/**
 * Creates a new game lobby
 * 
 * @description This endpoint creates a new game lobby and assigns the creator as the host.
 * The host has special privileges like starting/resetting the game. Each lobby gets a
 * unique ID that other players can use to join.
 * Rate limited to 5 requests per minute to prevent spam.
 * 
 * @param {NextRequest} request - The incoming request containing:
 *   - nickname: The display name for the host player
 * 
 * @returns {NextResponse} JSON response containing:
 *   - lobby: The created lobby object with all game state
 *   - playerId: The ID assigned to the host player
 *   - hostToken: Authentication token for host privileges
 *   - sessionToken: The session token (only for new sessions)
 *   - error: Error message if creation failed
 * 
 * @example
 * POST /api/lobby/create
 * Body: { nickname: "Alice" }
 * Response: { 
 *   lobby: { id: "abc123", players: [...], state: "waiting" },
 *   playerId: "player_xyz",
 *   hostToken: "token_123"
 * }
 * 
 * @throws {400} If nickname is missing or empty
 * @throws {429} If rate limit exceeded
 * @throws {500} If there's a server error creating the lobby
 */
async function handleCreateLobby(request: NextRequest) {
  try {
    // Extract player information from request
    const { nickname } = await request.json();
    
    // Validate nickname
    if (!nickname || nickname.trim().length === 0) {
      return NextResponse.json({ error: 'Nickname is required' }, { status: 400 });
    }
    
    // Get or create player session
    const { session, isNew, token } = await SessionManager.getOrCreateSession();
    const playerId = session.playerId;
    
    logger.debug('Creating lobby', { playerId, nickname: nickname.trim() });
    
    const lobby = await createLobby(playerId, nickname.trim());
    
    logger.info('Lobby created', { 
      lobbyId: lobby.id, 
      playerId, 
      hostId: lobby.hostId,
      isHost: lobby.hostId === playerId 
    });
    
    // Set initial heartbeat for connection monitoring
    await setex(`player:${lobby.id}:${playerId}:heartbeat`, 10, Date.now().toString());
    
    // Track when the player joined (for reconnection logic)
    await setex(`player:${lobby.id}:${playerId}:joinTime`, 60, Date.now().toString());
    
    // Generate a unique host token for authentication
    const hostToken = nanoid();
    
    const response: any = {
      lobby,
      playerId,
      hostToken, // Client should store this securely
    };

    // Include session token in response only for new sessions
    if (isNew) {
      response.sessionToken = session.id;
    }
    
    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error creating lobby', error as Error);
    return NextResponse.json({ error: 'Failed to create lobby' }, { status: 500 });
  }
}

// Export the rate-limited POST handler with custom session ID getter
export const POST = withRateLimitedRoute(handleCreateLobby, {
  config: 'LOBBY_CREATE',
  errorMessage: 'Too many lobby creation attempts. Please wait before trying again.',
  getSessionId: async (request: NextRequest) => {
    // For lobby creation, allow rate limiting by IP if no session exists yet
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