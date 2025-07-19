import { NextRequest, NextResponse } from 'next/server';
import { handleEmojiClick } from '@/app/lib/game-engine';

export async function POST(request: NextRequest) {
  try {
    const { lobbyId, playerId, emojiId } = await request.json();
    
    if (!lobbyId || !playerId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    if (!emojiId) {
      // No emoji clicked, just return without processing
      return NextResponse.json({ found: false, points: 0 });
    }
    
    const result = await handleEmojiClick(lobbyId, playerId, emojiId);
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process click' }, { status: 500 });
  }
}