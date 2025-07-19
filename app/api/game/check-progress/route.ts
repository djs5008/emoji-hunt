import { NextRequest, NextResponse } from 'next/server';
import { checkAndProgressAfterRoundEnd } from '@/app/lib/game-state-transitions';

export async function POST(request: NextRequest) {
  try {
    const { lobbyId, roundNum } = await request.json();
    
    if (!lobbyId || !roundNum) {
      return NextResponse.json({ error: 'Lobby ID and round number are required' }, { status: 400 });
    }
    
    const progressed = await checkAndProgressAfterRoundEnd(lobbyId, roundNum);
    
    return NextResponse.json({ progressed });
  } catch (error) {
    console.error('[CHECK PROGRESS] Error:', error);
    return NextResponse.json({ error: 'Failed to check progress' }, { status: 500 });
  }
}