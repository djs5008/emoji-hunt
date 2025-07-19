import { NextRequest, NextResponse } from 'next/server';
import { createLobby } from '@/app/lib/game-state-async';
import { nanoid } from 'nanoid';
import { setex } from '@/app/lib/upstash-redis';

/**
 * Creates a new game lobby
 * 
 * @description This endpoint creates a new game lobby and assigns the creator as the host.
 * The host has special privileges like starting/resetting the game. Each lobby gets a
 * unique ID that other players can use to join.
 * 
 * @param {NextRequest} request - The incoming request containing:
 *   - nickname: The display name for the host player
 *   - playerId: Optional existing player ID to reuse
 * 
 * @returns {NextResponse} JSON response containing:
 *   - lobby: The created lobby object with all game state
 *   - playerId: The ID assigned to the host player
 *   - hostToken: Authentication token for host privileges
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
 * @throws {500} If there's a server error creating the lobby
 */
export async function POST(request: NextRequest) {
  try {
    // Extract player information from request
    const { nickname, playerId: existingPlayerId } = await request.json();
    
    // Validate nickname
    if (!nickname || nickname.trim().length === 0) {
      return NextResponse.json({ error: 'Nickname is required' }, { status: 400 });
    }
    
    // Use existing player ID if provided, otherwise generate new one
    const playerId = existingPlayerId || nanoid();
    const lobby = await createLobby(playerId, nickname.trim());
    
    // Set initial heartbeat for connection monitoring
    await setex(`player:${lobby.id}:${playerId}:heartbeat`, 10, Date.now().toString());
    
    // Track when the player joined (for reconnection logic)
    await setex(`player:${lobby.id}:${playerId}:joinTime`, 60, Date.now().toString());
    
    // Generate a unique host token for authentication
    const hostToken = nanoid();
    
    return NextResponse.json({
      lobby,
      playerId,
      hostToken, // Client should store this securely
    });
  } catch (error) {
    console.error('Error creating lobby:', error);
    return NextResponse.json({ error: 'Failed to create lobby' }, { status: 500 });
  }
}