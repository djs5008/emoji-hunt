import { NextRequest, NextResponse } from 'next/server';
import { handleEmojiClick } from '@/app/lib/game-engine';

/**
 * Handles emoji click events in the game
 * 
 * @description This endpoint processes when a player clicks on an emoji during gameplay.
 * It validates the click and awards points if the emoji matches the target.
 * 
 * @param {NextRequest} request - The incoming request containing:
 *   - lobbyId: The ID of the game lobby
 *   - playerId: The ID of the player making the click
 *   - emojiId: The ID of the clicked emoji (optional)
 * 
 * @returns {NextResponse} JSON response containing:
 *   - found: Whether the clicked emoji was the target
 *   - points: Points awarded for the click (0 if incorrect)
 *   - error: Error message if something went wrong
 * 
 * @example
 * POST /api/game/click
 * Body: { lobbyId: "abc123", playerId: "player1", emojiId: "emoji_42" }
 * Response: { found: true, points: 100 }
 */
export async function POST(request: NextRequest) {
  try {
    // Extract click data from request body
    const { lobbyId, playerId, emojiId } = await request.json();
    
    // Validate required fields
    if (!lobbyId || !playerId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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