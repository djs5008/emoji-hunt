import { NextRequest, NextResponse } from 'next/server';
import { startGame } from '@/app/lib/game-state-transitions';

export async function POST(request: NextRequest) {
  try {
    const { lobbyId, playerId } = await request.json();
    
    if (!lobbyId || !playerId) {
      return NextResponse.json({ error: 'Lobby ID and player ID are required' }, { status: 400 });
    }
    
    const success = await startGame(lobbyId, playerId);
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to start game. Are you the host?' }, { status: 403 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[START GAME] Error:', error);
    return NextResponse.json({ error: 'Failed to start game' }, { status: 500 });
  }
}