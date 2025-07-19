import { NextRequest, NextResponse } from 'next/server';
import { checkAndEndRound } from '@/app/lib/game-state-transitions';

/**
 * Checks if a round should end and transitions the game state
 * 
 * @description This endpoint checks if the current round should end (e.g., when the
 * target emoji is found or time expires) and transitions to the round-end state.
 * It's called periodically during gameplay to ensure timely round transitions.
 * 
 * @param {NextRequest} request - The incoming request containing:
 *   - lobbyId: The ID of the lobby to check
 *   - roundNum: The current round number to verify
 * 
 * @returns {NextResponse} JSON response containing:
 *   - ended: Boolean indicating if the round was ended
 *   - error: Error message if the check failed
 * 
 * @example
 * POST /api/game/check-round-end
 * Body: { lobbyId: "abc123", roundNum: 1 }
 * Response: { ended: true }
 * 
 * @throws {400} If lobbyId or roundNum is missing
 * @throws {500} If there's a server error checking round end
 */
export async function POST(request: NextRequest) {
  try {
    // Extract lobby and round information
    const { lobbyId, roundNum } = await request.json();
    
    // Validate required fields
    if (!lobbyId || !roundNum) {
      return NextResponse.json({ error: 'Lobby ID and round number are required' }, { status: 400 });
    }
    
    // Check if the round should end and transition if needed
    const ended = await checkAndEndRound(lobbyId, roundNum);
    
    return NextResponse.json({ ended });
  } catch (error) {
    console.error('[CHECK ROUND END] Error:', error);
    return NextResponse.json({ error: 'Failed to check round end' }, { status: 500 });
  }
}