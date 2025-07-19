import { NextRequest, NextResponse } from 'next/server';
import { checkAndStartRound } from '@/app/lib/game-state-transitions';

export async function POST(request: NextRequest) {
  try {
    const { lobbyId, roundNum } = await request.json();
    
    if (!lobbyId || !roundNum) {
      return NextResponse.json({ error: 'Lobby ID and round number are required' }, { status: 400 });
    }
    
    const started = await checkAndStartRound(lobbyId, roundNum);
    
    return NextResponse.json({ started });
  } catch (error) {
    console.error('[CHECK ROUND START] Error:', error);
    return NextResponse.json({ error: 'Failed to check round start' }, { status: 500 });
  }
}