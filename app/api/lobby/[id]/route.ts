import { NextRequest, NextResponse } from 'next/server';
import { getLobby } from '@/app/lib/game-state-async';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const lobby = await getLobby(params.id.toUpperCase());
    
    if (!lobby) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }
    
    // Return lobby data as-is (obfuscated positions are already sent via SSE)
    return NextResponse.json(lobby);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch lobby' }, { status: 500 });
  }
}