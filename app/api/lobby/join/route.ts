import { NextRequest, NextResponse } from 'next/server';
import { joinLobby } from '@/app/lib/game-state-async';
import { nanoid } from 'nanoid';
import { broadcastToLobby, SSE_EVENTS } from '@/app/lib/sse-broadcast';
import { setex } from '@/app/lib/upstash-redis';

export async function POST(request: NextRequest) {
  try {
    const { lobbyId, nickname, playerId: existingPlayerId } = await request.json();

    if (!lobbyId || !nickname || nickname.trim().length === 0) {
      return NextResponse.json(
        { error: 'Lobby ID and nickname are required' },
        { status: 400 }
      );
    }

    // Use existing player ID if provided, otherwise generate new one
    const playerId = existingPlayerId || nanoid();
    const lobby = await joinLobby(
      lobbyId.toUpperCase(),
      playerId,
      nickname.trim()
    );

    if (!lobby) {
      return NextResponse.json(
        { error: 'Lobby not found or game already started' },
        { status: 404 }
      );
    }

    // Set initial heartbeat and join time for the player
    const upperLobbyId = lobbyId.toUpperCase();
    await setex(`player:${upperLobbyId}:${playerId}:heartbeat`, 10, Date.now().toString());
    await setex(`player:${upperLobbyId}:${playerId}:joinTime`, 60, Date.now().toString()); // 1 minute expiry

    // Broadcast player joined event
    await broadcastToLobby(lobbyId.toUpperCase(), SSE_EVENTS.PLAYER_JOINED, {
      lobby,
      playerId,
    });

    return NextResponse.json({
      lobby,
      playerId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to join lobby' },
      { status: 500 }
    );
  }
}