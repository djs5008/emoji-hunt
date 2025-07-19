import { NextRequest, NextResponse } from 'next/server';
import { preloadRound } from '@/app/lib/game-state-transitions';

export async function POST(request: NextRequest) {
  try {
    const { lobbyId, roundNum } = await request.json();
    
    if (!lobbyId || !roundNum) {
      return NextResponse.json({ error: 'Lobby ID and round number are required' }, { status: 400 });
    }
    
    const success = await preloadRound(lobbyId, roundNum);
    
    return NextResponse.json({ success });
  } catch (error) {
    console.error('[PRELOAD ROUND] Error:', error);
    return NextResponse.json({ error: 'Failed to preload round' }, { status: 500 });
  }
}