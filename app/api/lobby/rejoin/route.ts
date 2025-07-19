import { NextRequest, NextResponse } from 'next/server';
import { getLobby } from '@/app/lib/game-state-async';

export async function POST(request: NextRequest) {
  try {
    const { lobbyId, playerId } = await request.json();
    
    if (!lobbyId || !playerId) {
      return NextResponse.json({ error: 'Lobby ID and player ID are required' }, { status: 400 });
    }
    
    const lobby = await getLobby(lobbyId.toUpperCase());
    
    if (!lobby) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }
    
    // Check if player exists in lobby
    const player = lobby.players.find(p => p.id === playerId);
    if (!player) {
      return NextResponse.json({ error: 'Player not found in lobby' }, { status: 404 });
    }
    
    return NextResponse.json({
      lobby,
      playerId,
      player,
    });
  } catch (error) {
    console.error('Error rejoining lobby:', error);
    return NextResponse.json({ error: 'Failed to rejoin lobby' }, { status: 500 });
  }
}