import { NextRequest, NextResponse } from 'next/server';
import { joinLobby } from '@/app/lib/game-state-async';
import { nanoid } from 'nanoid';
import { broadcastToLobby, SSE_EVENTS } from '@/app/lib/sse-broadcast';
import { setex } from '@/app/lib/upstash-redis';

/**
 * Joins an existing game lobby
 * 
 * @description This endpoint allows a player to join an existing lobby using its ID.
 * Players can only join lobbies that are in the 'waiting' state. Once joined, the
 * player is added to the lobby and all other players are notified via SSE.
 * 
 * @param {NextRequest} request - The incoming request containing:
 *   - lobbyId: The ID of the lobby to join (case-insensitive)
 *   - nickname: The display name for the joining player
 *   - playerId: Optional existing player ID for rejoining
 * 
 * @returns {NextResponse} JSON response containing:
 *   - lobby: The updated lobby object with the new player
 *   - playerId: The ID assigned to the joining player
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
 * @throws {500} If there's a server error joining the lobby
 */
export async function POST(request: NextRequest) {
  try {
    // Extract join information from request
    const { lobbyId, nickname, playerId: existingPlayerId } = await request.json();

    // Validate required fields
    if (!lobbyId || !nickname || nickname.trim().length === 0) {
      return NextResponse.json(
        { error: 'Lobby ID and nickname are required' },
        { status: 400 }
      );
    }

    // Generate or reuse player ID
    const playerId = existingPlayerId || nanoid();
    
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

    return NextResponse.json({
      lobby,
      playerId,
    });
  } catch (error) {
    console.error('Error joining lobby:', error);
    return NextResponse.json(
      { error: 'Failed to join lobby' },
      { status: 500 }
    );
  }
}