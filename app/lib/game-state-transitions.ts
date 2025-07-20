import { generateRound } from './game-state-async';
import { setLobby, getLobby } from './ioredis-storage';
import { getIoRedis } from './ioredis-client';
import { broadcastToLobby, SSE_EVENTS } from './sse-broadcast';
import { logger } from './logger';

/**
 * Game state transition management
 * 
 * @description This module handles all game state transitions with distributed
 * locking to ensure consistency across multiple concurrent players. Each transition
 * is atomic and uses Redis locks to prevent race conditions.
 * 
 * State flow:
 * waiting -> countdown -> playing -> roundEnd -> (countdown or finished)
 * 
 * Key features:
 * - Distributed locking prevents duplicate state transitions
 * - Automatic progression through game phases
 * - Preloading of round data for smooth transitions
 * - Host-only controls for game start/reset
 */

/**
 * Acquires a distributed lock for state transitions
 * 
 * @description Uses Redis SET NX (set if not exists) to ensure only one
 * player can perform a specific state transition at a time. This prevents
 * race conditions when multiple players trigger the same transition.
 * 
 * @param {string} lobbyId - The lobby to lock
 * @param {string} transition - The transition type (e.g., "round-1-start")
 * @returns {Promise<boolean>} True if lock acquired, false if already locked
 */
async function acquireStateLock(lobbyId: string, transition: string): Promise<boolean> {
  const redis = getIoRedis();
  const lockKey = `lobby:${lobbyId}:lock:${transition}`;
  
  // SET NX with 5 second expiry prevents deadlocks
  const result = await redis.set(lockKey, Date.now().toString(), 'EX', 5, 'NX');
  return result === 'OK';
}

/**
 * Releases a distributed lock
 * 
 * @param {string} lobbyId - The lobby to unlock
 * @param {string} transition - The transition type
 */
async function releaseStateLock(lobbyId: string, transition: string): Promise<void> {
  const redis = getIoRedis();
  const lockKey = `lobby:${lobbyId}:lock:${transition}`;
  await redis.del(lockKey);
}

/**
 * Starts a new game session
 * 
 * @description Transitions from 'waiting' to 'countdown' state. Only the host
 * can start the game. Resets all player scores and begins the countdown for
 * the first round.
 * 
 * @param {string} lobbyId - The lobby to start
 * @param {string} playerId - The player attempting to start (must be host)
 * @returns {Promise<boolean>} True if game started successfully
 */
export async function startGame(lobbyId: string, playerId: string): Promise<boolean> {
  const lobby = await getLobby(lobbyId);
  
  // Debug logging
  logger.debug('Attempting to start game', {
    lobbyId,
    playerId,
    lobbyExists: !!lobby,
    gameState: lobby?.gameState,
    hostId: lobby?.hostId,
    isHost: lobby?.hostId === playerId,
    players: lobby?.players?.map(p => ({ id: p.id, nickname: p.nickname }))
  });
  
  // Validate: lobby exists, is waiting, and player is host
  if (!lobby) {
    logger.warn('Cannot start game: Lobby not found', { lobbyId });
    return false;
  }
  
  if (lobby.gameState !== 'waiting') {
    logger.warn('Cannot start game: Invalid game state', { lobbyId, currentState: lobby.gameState });
    return false;
  }
  
  if (lobby.hostId !== playerId) {
    logger.warn('Cannot start game: Player is not host', { 
      lobbyId, 
      playerId, 
      hostId: lobby.hostId,
      playerInLobby: lobby.players.some(p => p.id === playerId)
    });
    return false;
  }

  // Reset all player statistics
  lobby.players.forEach((player) => {
    player.score = 0;
    player.roundScores = [];
  });
  lobby.rounds = [];

  // Transition to countdown state
  lobby.gameState = 'countdown';
  lobby.currentRound = 1;
  lobby.countdownStartTime = Date.now();

  await setLobby(lobby);

  // Notify all players
  await broadcastToLobby(lobbyId, SSE_EVENTS.GAME_STARTED, {
    countdownStartTime: lobby.countdownStartTime,
    currentRound: 1,
  });

  return true;
}

/**
 * Preloads round data during countdown
 * 
 * @description Generates emoji positions and target during the countdown phase
 * to ensure smooth transition when the round starts. Uses distributed locking
 * to prevent duplicate generation.
 * 
 * Timing: Preloads after 2 seconds of countdown (when showing "1")
 * 
 * @param {string} lobbyId - The lobby to preload for
 * @param {number} roundNum - The round number to preload
 * @returns {Promise<boolean>} True if preload successful
 */
export async function preloadRound(lobbyId: string, roundNum: number): Promise<boolean> {
  // Ensure only one player preloads
  if (!await acquireStateLock(lobbyId, `round-${roundNum}-preload`)) {
    return false;
  }

  try {
    const lobby = await getLobby(lobbyId);
    
    // Validate state
    if (!lobby || lobby.gameState !== 'countdown' || lobby.currentRound !== roundNum) {
      return false;
    }

    // Wait until late in countdown (showing "1")
    const countdownElapsed = Date.now() - (lobby.countdownStartTime || 0);
    if (countdownElapsed < 2000) {
      return false;
    }

    // Generate round data without changing state
    const round = generateRound(roundNum);
    lobby.rounds[roundNum - 1] = round;

    await setLobby(lobby);

    // Broadcast for client preloading
    await broadcastToLobby(lobbyId, 'roundPreloaded', {
      round,
      currentRound: roundNum,
    });

    return true;
  } finally {
    await releaseStateLock(lobbyId, `round-${roundNum}-preload`);
  }
}

/**
 * Starts a round after countdown completes
 * 
 * @description Transitions from 'countdown' to 'playing' state. Any player can
 * trigger this transition after the 4-second countdown. Uses locking to ensure
 * only one transition occurs.
 * 
 * @param {string} lobbyId - The lobby to start round for
 * @param {number} roundNum - The round number to start
 * @returns {Promise<boolean>} True if round started successfully
 */
export async function checkAndStartRound(lobbyId: string, roundNum: number): Promise<boolean> {
  // Prevent concurrent round starts
  if (!await acquireStateLock(lobbyId, `round-${roundNum}-start`)) {
    return false;
  }

  try {
    const lobby = await getLobby(lobbyId);
    
    // Validate state and round number
    if (!lobby || lobby.gameState !== 'countdown' || lobby.currentRound !== roundNum) {
      return false;
    }

    // Ensure full countdown completed (4 seconds)
    const countdownElapsed = Date.now() - (lobby.countdownStartTime || 0);
    if (countdownElapsed < 4000) {
      return false;
    }

    // Use preloaded round data or generate now
    if (!lobby.rounds[roundNum - 1]) {
      const round = generateRound(roundNum);
      lobby.rounds[roundNum - 1] = round;
    }
    
    // Transition to playing state
    lobby.gameState = 'playing';
    delete lobby.countdownStartTime;

    await setLobby(lobby);

    // Notify all players with round data
    await broadcastToLobby(lobbyId, SSE_EVENTS.ROUND_STARTED, {
      round: lobby.rounds[roundNum - 1],
      currentRound: roundNum,
    });

    return true;
  } finally {
    await releaseStateLock(lobbyId, `round-${roundNum}-start`);
  }
}

/**
 * Ends a round when time expires or all players find the target
 * 
 * @description Transitions from 'playing' to 'roundEnd' state. Triggered either
 * by the 30-second timer or when all players find the target emoji. Shows the
 * answer and scores before progressing.
 * 
 * End conditions:
 * - 30 seconds elapsed since round start
 * - All players found the target emoji
 * 
 * @param {string} lobbyId - The lobby to end round for
 * @param {number} roundNum - The round number to end
 * @returns {Promise<boolean>} True if round ended successfully
 */
export async function checkAndEndRound(lobbyId: string, roundNum: number): Promise<boolean> {
  // Prevent concurrent round endings
  if (!await acquireStateLock(lobbyId, `round-${roundNum}-end`)) {
    return false;
  }

  try {
    const lobby = await getLobby(lobbyId);
    
    // Validate state
    if (!lobby || lobby.gameState !== 'playing' || lobby.currentRound !== roundNum) {
      return false;
    }

    const currentRound = lobby.rounds[roundNum - 1];
    if (!currentRound) {
      return false;
    }

    // Check end conditions
    const roundElapsed = Date.now() - currentRound.startTime;
    const allFound = currentRound.foundBy.length === lobby.players.length;
    
    if (roundElapsed < 30000 && !allFound) {
      return false; // Continue playing
    }

    // Transition to round end state
    lobby.gameState = 'roundEnd';
    lobby.roundEndTime = Date.now();
    currentRound.endTime = Date.now();

    await setLobby(lobby);

    // Broadcast results with answer reveal
    await broadcastToLobby(lobbyId, SSE_EVENTS.ROUND_ENDED, {
      round: roundNum,
      targetEmoji: currentRound.targetEmoji,
      scores: lobby.players.map((p) => ({
        playerId: p.id,
        nickname: p.nickname,
        roundScore: p.roundScores.find((rs) => rs.round === roundNum),
        totalScore: p.score,
      })),
    });

    return true;
  } finally {
    await releaseStateLock(lobbyId, `round-${roundNum}-end`);
  }
}

/**
 * Progresses game after showing round results
 * 
 * @description After displaying the answer and scoreboard, this function either
 * starts the next round or ends the game. The delay ensures players have time
 * to see the results.
 * 
 * Timing:
 * - Rounds 1-4: 6 seconds (3s answer + 3s scoreboard)
 * - Round 5: 3 seconds (answer only, then final results)
 * 
 * @param {string} lobbyId - The lobby to progress
 * @param {number} roundNum - The completed round number
 * @returns {Promise<boolean>} True if progression successful
 */
export async function checkAndProgressAfterRoundEnd(lobbyId: string, roundNum: number): Promise<boolean> {
  // Prevent concurrent progressions
  if (!await acquireStateLock(lobbyId, `round-${roundNum}-progress`)) {
    return false;
  }

  try {
    const lobby = await getLobby(lobbyId);
    
    // Must be in roundEnd state
    if (!lobby || lobby.gameState !== 'roundEnd') {
      return false;
    }

    // Ensure display time has elapsed
    const roundEndElapsed = Date.now() - (lobby.roundEndTime || 0);
    const requiredDelay = roundNum === 5 ? 3000 : 6000;
    
    if (roundEndElapsed < requiredDelay) {
      return false;
    }

    if (roundNum < 5) {
      // Continue to next round
      lobby.gameState = 'countdown';
      lobby.currentRound = roundNum + 1;
      lobby.countdownStartTime = Date.now();
      delete lobby.roundEndTime;

      await setLobby(lobby);

      // Reuse GAME_STARTED event for round transitions
      await broadcastToLobby(lobbyId, SSE_EVENTS.GAME_STARTED, {
        countdownStartTime: lobby.countdownStartTime,
        currentRound: roundNum + 1,
      });
    } else {
      // Game complete - show final results
      lobby.gameState = 'finished';
      await setLobby(lobby);

      // Broadcast final scores and winners
      await broadcastToLobby(lobbyId, SSE_EVENTS.GAME_ENDED, {
        finalScores: lobby.players.sort((a, b) => b.score - a.score),
        winners: lobby.players
          .sort((a, b) => b.score - a.score)
          .slice(0, 3), // Top 3 players
      });
    }

    return true;
  } finally {
    await releaseStateLock(lobbyId, `round-${roundNum}-progress`);
  }
}

/**
 * Resets a finished game for replay
 * 
 * @description Allows the host to reset a completed game back to the waiting
 * state. All scores and round data are cleared, but players remain in the lobby.
 * This enables the same group to play multiple games.
 * 
 * @param {string} lobbyId - The lobby to reset
 * @param {string} playerId - The player attempting reset (must be host)
 * @returns {Promise<boolean>} True if reset successful
 */
export async function resetGame(lobbyId: string, playerId: string): Promise<boolean> {
  const lobby = await getLobby(lobbyId);
  
  // Validate: finished state and host permission
  if (!lobby || lobby.gameState !== 'finished' || lobby.hostId !== playerId) {
    return false;
  }

  // Clear all game data
  lobby.gameState = 'waiting';
  lobby.currentRound = 0;
  lobby.rounds = [];
  delete lobby.countdownStartTime;
  delete lobby.roundEndTime;

  // Reset all player scores
  lobby.players.forEach((player) => {
    player.score = 0;
    player.roundScores = [];
  });

  await setLobby(lobby);

  // Notify all players of reset
  await broadcastToLobby(lobbyId, SSE_EVENTS.GAME_RESET, { lobby });

  return true;
}