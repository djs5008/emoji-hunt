import { NextRequest, NextResponse } from 'next/server';
import { checkAndEndRound } from '@/app/lib/game-state-transitions';

export async function POST(request: NextRequest) {
  try {
    const { lobbyId, roundNum } = await request.json();
    
    if (!lobbyId || !roundNum) {
      return NextResponse.json({ error: 'Lobby ID and round number are required' }, { status: 400 });
    }
    
    const ended = await checkAndEndRound(lobbyId, roundNum);
    
    return NextResponse.json({ ended });
  } catch (error) {
    console.error('[CHECK ROUND END] Error:', error);
    return NextResponse.json({ error: 'Failed to check round end' }, { status: 500 });
  }
}