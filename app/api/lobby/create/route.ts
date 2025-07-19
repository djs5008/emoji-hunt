import { NextRequest, NextResponse } from 'next/server';
import { createLobby } from '@/app/lib/game-state-async';
import { nanoid } from 'nanoid';
import { setex } from '@/app/lib/upstash-redis';

export async function POST(request: NextRequest) {
  try {
    const { nickname, playerId: existingPlayerId } = await request.json();
    
    if (!nickname || nickname.trim().length === 0) {
      return NextResponse.json({ error: 'Nickname is required' }, { status: 400 });
    }
    
    // Use existing player ID if provided, otherwise generate new one
    const playerId = existingPlayerId || nanoid();
    const lobby = await createLobby(playerId, nickname.trim());
    
    // Set initial heartbeat and join time for the host
    await setex(`player:${lobby.id}:${playerId}:heartbeat`, 10, Date.now().toString());
    await setex(`player:${lobby.id}:${playerId}:joinTime`, 60, Date.now().toString()); // 1 minute expiry
    
    // Generate a host token for this player
    const hostToken = nanoid();
    
    return NextResponse.json({
      lobby,
      playerId,
      hostToken, // Client should store this in session storage
    });
  } catch (error) {
    console.error('Error creating lobby:', error);
    return NextResponse.json({ error: 'Failed to create lobby' }, { status: 500 });
  }
}