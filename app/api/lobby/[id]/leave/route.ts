import { NextRequest, NextResponse } from 'next/server';
import { del } from '@/app/lib/upstash-redis';
import { checkDisconnectedPlayers } from '@/app/lib/player-heartbeat';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Handle both JSON and text/plain (beacon sends as text)
    const contentType = request.headers.get('content-type');
    let playerId: string;
    let isExplicitLeave = false;
    
    if (contentType?.includes('application/json')) {
      const data = await request.json();
      playerId = data.playerId;
      isExplicitLeave = data.explicit === true;
    } else {
      // Beacon sends as text/plain
      const text = await request.text();
      try {
        const data = JSON.parse(text);
        playerId = data.playerId;
        isExplicitLeave = data.explicit === true;
      } catch {
        playerId = text; // If it's just the player ID as plain text
      }
    }
    
    const lobbyId = params.id;
    
    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 });
    }
    
    // Delete heartbeat and join time immediately
    await del([`player:${lobbyId}:${playerId}:heartbeat`, `player:${lobbyId}:${playerId}:joinTime`]);
    
    // Run cleanup with force remove
    await checkDisconnectedPlayers(lobbyId, playerId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[LEAVE] Error:', error);
    return NextResponse.json({ error: 'Failed to leave' }, { status: 500 });
  }
}