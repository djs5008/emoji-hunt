import { Lobby } from '@/app/types/game';
import { getLobby } from './game-state-async';
import { setLobby } from './upstash-storage';
import { broadcastToLobby, SSE_EVENTS } from './sse-broadcast';
import { checkAndEndRound } from './game-state-transitions';

/**
 * Game engine module - Core game logic and mechanics
 * 
 * @description This module handles the main game mechanics including:
 * - Starting and resetting games
 * - Processing emoji clicks and scoring
 * - Managing game state transitions
 * - Broadcasting game events to players
 */

/**
 * Starts a game session
 * 
 * @description Initiates gameplay for a lobby that's in 'waiting' state.
 * Note: Actual game start logic is handled by the game-state-transitions module.
 * 
 * @param {string} lobbyId - The ID of the lobby to start
 * @returns {Promise<boolean>} True if game can be started, false otherwise
 */
export async function startGame(lobbyId: string): Promise<boolean> {
  const lobby = await getLobby(lobbyId);
  if (!lobby || lobby.gameState !== 'waiting') {
    return false;
  }

  // Game start is delegated to state transition system
  return true;
}

/**
 * Resets a finished game to allow replay
 * 
 * @description Clears all game data and returns lobby to 'waiting' state,
 * allowing the same group to play another round without recreating the lobby.
 * 
 * @param {string} lobbyId - The ID of the lobby to reset
 * @returns {Promise<boolean>} True if reset successful, false otherwise
 */
export async function resetGame(lobbyId: string): Promise<boolean> {
  const lobby = await getLobby(lobbyId);
  if (!lobby || lobby.gameState !== 'finished') {
    return false;
  }

  // Clear all game-specific state
  lobby.gameState = 'waiting';
  lobby.currentRound = 0;
  lobby.rounds = [];
  delete lobby.countdownStartTime;
  delete lobby.roundEndTime;

  await setLobby(lobby);

  // Notify all players of reset
  await broadcastToLobby(lobbyId, SSE_EVENTS.LOBBY_UPDATED, { lobby });

  return true;
}

/**
 * Processes emoji click events during gameplay
 * 
 * @description Handles when a player clicks an emoji, checking if it's the target
 * and awarding points accordingly. Manages scoring, broadcasts events, and triggers
 * round end if all players have found the target.
 * 
 * @param {string} lobbyId - The ID of the game lobby
 * @param {string} playerId - The ID of the player who clicked
 * @param {string} emojiId - The ID of the clicked emoji
 * 
 * @returns {Promise<{found: boolean, points: number}>} Result of the click:
 *   - found: Whether the clicked emoji was the target
 *   - points: Points awarded (0 if wrong or already found)
 * 
 * Game rules:
 * - Players can only find the target once per round
 * - Wrong clicks broadcast a "wrong emoji" event
 * - Correct clicks award points based on speed and order
 * - Round ends immediately when all players find the target
 */
export async function handleEmojiClick(
  lobbyId: string,
  playerId: string,
  emojiId: string
): Promise<{ found: boolean; points: number }> {
  // Validate game state
  const lobby = await getLobby(lobbyId);
  if (!lobby || lobby.gameState !== 'playing') {
    return { found: false, points: 0 };
  }

  // Get current round data
  const currentRound = lobby.rounds[lobby.currentRound - 1];
  if (!currentRound) {
    return { found: false, points: 0 };
  }

  // Prevent duplicate finds
  if (currentRound.foundBy.find((f) => f.playerId === playerId)) {
    return { found: false, points: 0 };
  }

  // Validate emoji exists
  const clickedEmoji = currentRound.emojiPositions.find(
    (e) => e.id === emojiId
  );
  if (!clickedEmoji) {
    return { found: false, points: 0 };
  }

  // Compare emojis with Unicode normalization
  // This handles emoji variations (e.g., skin tones, composite emojis)
  const normalizedClicked = clickedEmoji.emoji.normalize('NFC');
  const normalizedTarget = currentRound.targetEmoji.normalize('NFC');

  if (normalizedClicked !== normalizedTarget) {
    // Wrong emoji clicked - notify all players
    await broadcastToLobby(lobbyId, SSE_EVENTS.WRONG_EMOJI, { 
      playerId,
      clickedEmoji: clickedEmoji.emoji 
    });
    return { found: false, points: 0 };
  }

  // Correct emoji found!
  const timeToFind = (Date.now() - currentRound.startTime) / 1000;
  const playersFoundBefore = currentRound.foundBy.length;
  
  // Record the find
  currentRound.foundBy.push({ playerId, timestamp: Date.now() });

  // Calculate points based on performance
  const points = calculatePoints(timeToFind, playersFoundBefore);

  // Update player statistics
  const player = lobby.players.find((p) => p.id === playerId);
  if (player) {
    player.roundScores.push({
      round: currentRound.number,
      timeToFind,
      points,
    });
    player.score += points;
  }

  // Persist changes
  await setLobby(lobby);

  // Notify all players of the find
  await broadcastToLobby(lobbyId, SSE_EVENTS.EMOJI_FOUND, {
    playerId,
    points,
    foundCount: currentRound.foundBy.length,
    totalPlayers: lobby.players.length,
    emojiId: clickedEmoji.id,
  });

  // End round early if everyone found it
  if (currentRound.foundBy.length === lobby.players.length) {
    await checkAndEndRound(lobbyId, currentRound.number);
  }

  return { found: true, points };
}

/**
 * Calculates points awarded for finding the target emoji
 * 
 * @description Points are calculated based on three factors:
 * 1. Base points (100) - Awarded just for finding the target
 * 2. Time bonus (0-100) - Faster finds get more points
 * 3. Order bonus (0-50) - Earlier finders get more points
 * 
 * @param {number} timeToFind - Time taken to find the emoji (in seconds)
 * @param {number} playersFoundBefore - Number of players who found it first
 * 
 * @returns {number} Total points awarded (100-250 possible)
 * 
 * Scoring breakdown:
 * - Base: 100 points (guaranteed for correct find)
 * - Time bonus: 100 * (1 - time/30), linearly decreasing over 30 seconds
 * - Order bonus: 50 points for first, -10 for each subsequent player
 * 
 * @example
 * calculatePoints(5, 0)   // 233 points (fast, first finder)
 * calculatePoints(15, 2)  // 180 points (medium speed, third finder)
 * calculatePoints(25, 4)  // 116 points (slow, fifth finder)
 */
function calculatePoints(
  timeToFind: number,
  playersFoundBefore: number
): number {
  // Base reward for finding the target
  let points = 100;

  // Time bonus: Maximum 100 points, decreases linearly
  // Full bonus at 0 seconds, no bonus at 30+ seconds
  const timeBonus = Math.max(0, Math.floor(100 * (1 - timeToFind / 30)));
  points += timeBonus;

  // Order bonus: Rewards early finders
  // First: +50, Second: +40, Third: +30, etc.
  const orderBonus = Math.max(0, 50 - playersFoundBefore * 10);
  points += orderBonus;

  return points;
}