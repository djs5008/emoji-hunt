import { NextRequest, NextResponse } from 'next/server';
import { handleEmojiClick } from '@/app/lib/game-engine';
import { SessionManager } from '@/app/lib/player-session';
import { withRateLimitedRoute } from '@/app/lib/rate-limit-middleware';

/**
 * Handles emoji click events in the game
 * 
 * @description This endpoint processes when a player clicks on an emoji during gameplay.
 * It validates the click and awards points if the emoji matches the target.
 * Rate limited to 50 requests per 2 seconds to allow rapid clicking while preventing abuse.
 * 
 * @param {NextRequest} request - The incoming request containing:
 *   - lobbyId: The ID of the game lobby
 *   - emojiId: The ID of the clicked emoji (optional)
 * 
 * @returns {NextResponse} JSON response containing:
 *   - found: Whether the clicked emoji was the target
 *   - points: Points awarded for the click (0 if incorrect)
 *   - error: Error message if something went wrong
 * 
 * @example
 * POST /api/game/click
 * Body: { lobbyId: "abc123", emojiId: "emoji_42" }
 * Response: { found: true, points: 100 }
 */
async function handleClick(request: NextRequest) {
  try {
    // Get player session from cookies
    const sessionData = await SessionManager.getSessionFromCookies();
    if (!sessionData) {
      return NextResponse.json({ error: 'No valid session' }, { status: 401 });
    }
    
    const { session } = sessionData;
    const playerId = session.playerId;
    
    // Extract click data from request body
    const { lobbyId, emojiId } = await request.json();
    
    // Validate required fields
    if (!lobbyId) {
      return NextResponse.json({ error: 'Lobby ID is required' }, { status: 400 });
    }
    
    // Handle empty clicks (player clicked but missed all emojis)
    if (!emojiId) {
      return NextResponse.json({ found: false, points: 0 });
    }
    
    // Process the emoji click through the game engine
    const result = await handleEmojiClick(lobbyId, playerId, emojiId);
    
    return NextResponse.json(result);
  } catch (error) {
    // Log error for debugging (in production, use proper logging service)
    console.error('Error processing emoji click:', error);
    return NextResponse.json({ error: 'Failed to process click' }, { status: 500 });
  }
}

// Export the rate-limited POST handler
export const POST = withRateLimitedRoute(handleClick, {
  config: 'GAME_CLICK',
  errorMessage: 'Too many clicks! Please slow down.',
});