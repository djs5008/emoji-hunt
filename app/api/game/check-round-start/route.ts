import { NextRequest, NextResponse } from 'next/server';
import { checkAndStartRound } from '@/app/lib/game-state-transitions';

/**
 * Checks if a new round should start and transitions the game state
 * 
 * @description This endpoint checks if it's time to start a new round (after the
 * between-rounds pause) and transitions from 'between-rounds' to 'playing' state.
 * It ensures rounds start at the correct time based on the game's timing settings.
 * 
 * @param {NextRequest} request - The incoming request containing:
 *   - lobbyId: The ID of the lobby to check
 *   - roundNum: The expected next round number
 * 
 * @returns {NextResponse} JSON response containing:
 *   - started: Boolean indicating if a new round was started
 *   - error: Error message if the check failed
 * 
 * @example
 * POST /api/game/check-round-start
 * Body: { lobbyId: "abc123", roundNum: 2 }
 * Response: { started: true }
 * 
 * @throws {400} If lobbyId or roundNum is missing
 * @throws {500} If there's a server error checking round start
 */
export async function POST(request: NextRequest) {
  try {
    // Extract lobby and round information
    const { lobbyId, roundNum } = await request.json();
    
    // Validate required fields
    if (!lobbyId || !roundNum) {
      return NextResponse.json({ error: 'Lobby ID and round number are required' }, { status: 400 });
    }
    
    // Check if it's time to start the next round
    const started = await checkAndStartRound(lobbyId, roundNum);
    
    return NextResponse.json({ started });
  } catch (error) {
    console.error('[CHECK ROUND START] Error:', error);
    return NextResponse.json({ error: 'Failed to check round start' }, { status: 500 });
  }
}