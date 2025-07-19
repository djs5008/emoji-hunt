import { Lobby } from '@/app/types/game';
import { getLobby } from './game-state-async';
import { setLobby } from './upstash-storage';
import { broadcastToLobby, SSE_EVENTS } from './sse-broadcast';
import { checkAndEndRound } from './game-state-transitions';

// Start the game
export async function startGame(lobbyId: string): Promise<boolean> {
  const lobby = await getLobby(lobbyId);
  if (!lobby || lobby.gameState !== 'waiting') {
    return false;
  }

  // Game start will be handled by the new system
  return true;
}

// Reset game (for play again)
export async function resetGame(lobbyId: string): Promise<boolean> {
  const lobby = await getLobby(lobbyId);
  if (!lobby || lobby.gameState !== 'finished') {
    return false;
  }

  // Reset to waiting state
  lobby.gameState = 'waiting';
  lobby.currentRound = 0;
  lobby.rounds = [];
  delete lobby.countdownStartTime;
  delete lobby.roundEndTime;

  await setLobby(lobby);

  // Broadcast lobby update
  await broadcastToLobby(lobbyId, SSE_EVENTS.LOBBY_UPDATED, { lobby });

  return true;
}

// Handle emoji click
export async function handleEmojiClick(
  lobbyId: string,
  playerId: string,
  emojiId: string
): Promise<{ found: boolean; points: number }> {
  const lobby = await getLobby(lobbyId);
  if (!lobby || lobby.gameState !== 'playing') {
    return { found: false, points: 0 };
  }

  const currentRound = lobby.rounds[lobby.currentRound - 1];
  if (!currentRound) {
    return { found: false, points: 0 };
  }

  // Check if player already found it
  if (currentRound.foundBy.find((f) => f.playerId === playerId)) {
    return { found: false, points: 0 };
  }

  // Find clicked emoji
  const clickedEmoji = currentRound.emojiPositions.find(
    (e) => e.id === emojiId
  );
  if (!clickedEmoji) {
    return { found: false, points: 0 };
  }

  // Normalize emojis for comparison (handle Unicode variations)
  const normalizedClicked = clickedEmoji.emoji.normalize('NFC');
  const normalizedTarget = currentRound.targetEmoji.normalize('NFC');

  if (normalizedClicked !== normalizedTarget) {
    // Wrong emoji
    await broadcastToLobby(lobbyId, SSE_EVENTS.WRONG_EMOJI, { 
      playerId,
      clickedEmoji: clickedEmoji.emoji 
    });
    return { found: false, points: 0 };
  }

  // Correct emoji!
  const timeToFind = (Date.now() - currentRound.startTime) / 1000;
  const playersFoundBefore = currentRound.foundBy.length;
  currentRound.foundBy.push({ playerId, timestamp: Date.now() });

  // Calculate points
  const points = calculatePoints(timeToFind, playersFoundBefore);

  // Update player score
  const player = lobby.players.find((p) => p.id === playerId);
  if (player) {
    player.roundScores.push({
      round: currentRound.number,
      timeToFind,
      points,
    });
    player.score += points;
  }

  await setLobby(lobby);

  // Broadcast emoji found
  await broadcastToLobby(lobbyId, SSE_EVENTS.EMOJI_FOUND, {
    playerId,
    points,
    foundCount: currentRound.foundBy.length,
    totalPlayers: lobby.players.length,
    emojiId: clickedEmoji.id,
  });

  // Check if all players found it
  if (currentRound.foundBy.length === lobby.players.length) {
    console.log(`All players found the emoji in round ${currentRound.number}`);
    // Trigger round end immediately
    await checkAndEndRound(lobbyId, currentRound.number);
  }

  return { found: true, points };
}

// Calculate points based on time and order
function calculatePoints(
  timeToFind: number,
  playersFoundBefore: number
): number {
  // Base points for finding
  let points = 100;

  // Time bonus (max 100 points, decreases linearly over 30 seconds)
  const timeBonus = Math.max(0, Math.floor(100 * (1 - timeToFind / 30)));
  points += timeBonus;

  // Order bonus
  const orderBonus = Math.max(0, 50 - playersFoundBefore * 10);
  points += orderBonus;

  return points;
}