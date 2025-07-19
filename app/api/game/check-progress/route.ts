import { NextRequest, NextResponse } from 'next/server';
import { checkAndProgressAfterRoundEnd } from '@/app/lib/game-state-transitions';

/**
 * Checks and progresses the game state after a round ends
 * 
 * @description This endpoint checks if a round has ended and progresses the game
 * to the next state. It's typically called after the round timer expires to move
 * the game to the between-rounds state or end the game if all rounds are complete.
 * 
 * @param {NextRequest} request - The incoming request containing:
 *   - lobbyId: The ID of the lobby to check
 *   - roundNum: The current round number to verify
 * 
 * @returns {NextResponse} JSON response containing:
 *   - progressed: Boolean indicating if the game state was advanced
 *   - error: Error message if the check failed
 * 
 * @example
 * POST /api/game/check-progress
 * Body: { lobbyId: "abc123", roundNum: 1 }
 * Response: { progressed: true }
 * 
 * @throws {400} If lobbyId or roundNum is missing
 * @throws {500} If there's a server error checking progress
 */
export async function POST(request: NextRequest) {
  try {
    // Extract lobby and round information
    const { lobbyId, roundNum } = await request.json();
    
    // Validate required fields
    if (!lobbyId || !roundNum) {
      return NextResponse.json({ error: 'Lobby ID and round number are required' }, { status: 400 });
    }
    
    // Check if the round has ended and progress if needed
    const progressed = await checkAndProgressAfterRoundEnd(lobbyId, roundNum);
    
    return NextResponse.json({ progressed });
  } catch (error) {
    console.error('[CHECK PROGRESS] Error:', error);
    return NextResponse.json({ error: 'Failed to check progress' }, { status: 500 });
  }
}