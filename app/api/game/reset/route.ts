import { NextRequest, NextResponse } from 'next/server';
import { resetGame } from '@/app/lib/game-state-transitions';

export async function POST(request: NextRequest) {
  try {
    const { lobbyId, playerId } = await request.json();
    
    if (!lobbyId || !playerId) {
      return NextResponse.json({ error: 'Lobby ID and player ID are required' }, { status: 400 });
    }
    
    const success = await resetGame(lobbyId, playerId);
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to reset game. Are you the host?' }, { status: 403 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to reset game' }, { status: 500 });
  }
}