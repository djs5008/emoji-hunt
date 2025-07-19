import { NextRequest, NextResponse } from 'next/server';
import { preloadRound } from '@/app/lib/game-state-transitions';

/**
 * Preloads data for the next round
 * 
 * @description This endpoint prepares the next round's data (emojis, target, etc.)
 * during the between-rounds pause. Preloading ensures smooth transitions and prevents
 * delays when the round starts. This is called automatically before round transitions.
 * 
 * @param {NextRequest} request - The incoming request containing:
 *   - lobbyId: The ID of the lobby to preload for
 *   - roundNum: The round number to preload
 * 
 * @returns {NextResponse} JSON response containing:
 *   - success: Boolean indicating if preloading was successful
 *   - error: Error message if preloading failed
 * 
 * @example
 * POST /api/game/preload-round
 * Body: { lobbyId: "abc123", roundNum: 2 }
 * Response: { success: true }
 * 
 * @throws {400} If lobbyId or roundNum is missing
 * @throws {500} If there's a server error preloading the round
 */
export async function POST(request: NextRequest) {
  try {
    // Extract lobby and round information
    const { lobbyId, roundNum } = await request.json();
    
    // Validate required fields
    if (!lobbyId || !roundNum) {
      return NextResponse.json({ error: 'Lobby ID and round number are required' }, { status: 400 });
    }
    
    // Preload the round data for smooth transitions
    const success = await preloadRound(lobbyId, roundNum);
    
    return NextResponse.json({ success });
  } catch (error) {
    console.error('[PRELOAD ROUND] Error:', error);
    return NextResponse.json({ error: 'Failed to preload round' }, { status: 500 });
  }
}