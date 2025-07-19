import { getLobby, generateRound } from './game-state-async';
import { setLobby } from './upstash-storage';
import { getUpstashRedis } from './upstash-redis';
import { broadcastToLobby, SSE_EVENTS } from './sse-broadcast';
import { Lobby } from '@/app/types/game';

// Atomic state transition using Redis SET NX
async function acquireStateLock(lobbyId: string, transition: string): Promise<boolean> {
  const redis = getUpstashRedis();
  const lockKey = `lobby:${lobbyId}:lock:${transition}`;
  
  // Try to acquire lock with 5 second expiry
  const result = await redis.set(lockKey, Date.now().toString(), { ex: 5, nx: true });
  return result === 'OK';
}

// Release state lock
async function releaseStateLock(lobbyId: string, transition: string): Promise<void> {
  const redis = getUpstashRedis();
  const lockKey = `lobby:${lobbyId}:lock:${transition}`;
  await redis.del(lockKey);
}

// Start game (called by host)
export async function startGame(lobbyId: string, playerId: string): Promise<boolean> {
  const lobby = await getLobby(lobbyId);
  if (!lobby || lobby.gameState !== 'waiting' || lobby.hostId !== playerId) {
    return false;
  }

  // Reset scores
  lobby.players.forEach((player) => {
    player.score = 0;
    player.roundScores = [];
  });
  lobby.rounds = [];

  // Start countdown
  lobby.gameState = 'countdown';
  lobby.currentRound = 1;
  lobby.countdownStartTime = Date.now();

  await setLobby(lobby);

  // Broadcast game started
  await broadcastToLobby(lobbyId, SSE_EVENTS.GAME_STARTED, {
    countdownStartTime: lobby.countdownStartTime,
    currentRound: 1,
  });

  return true;
}

// Preload round data (called during countdown)
export async function preloadRound(lobbyId: string, roundNum: number): Promise<boolean> {
  // Try to acquire lock
  if (!await acquireStateLock(lobbyId, `round-${roundNum}-preload`)) {
    return false; // Another player already preloading
  }

  try {
    const lobby = await getLobby(lobbyId);
    if (!lobby || lobby.gameState !== 'countdown' || lobby.currentRound !== roundNum) {
      return false;
    }

    // Only preload after 2 seconds (when "1" is shown)
    const countdownElapsed = Date.now() - (lobby.countdownStartTime || 0);
    if (countdownElapsed < 2000) {
      return false;
    }

    // Generate round data but don't change game state
    const round = generateRound(roundNum);
    lobby.rounds[roundNum - 1] = round;
    // Keep gameState as 'countdown'!

    await setLobby(lobby);

    // Broadcast round data for preloading
    await broadcastToLobby(lobbyId, 'roundPreloaded', {
      round,
      currentRound: roundNum,
    });

    return true;
  } finally {
    await releaseStateLock(lobbyId, `round-${roundNum}-preload`);
  }
}

// Check and start round (called by any player after countdown)
export async function checkAndStartRound(lobbyId: string, roundNum: number): Promise<boolean> {
  // Try to acquire lock
  if (!await acquireStateLock(lobbyId, `round-${roundNum}-start`)) {
    return false; // Another player already started this round
  }

  try {
    const lobby = await getLobby(lobbyId);
    if (!lobby || lobby.gameState !== 'countdown' || lobby.currentRound !== roundNum) {
      return false;
    }

    // Verify countdown has finished (full 4 seconds)
    const countdownElapsed = Date.now() - (lobby.countdownStartTime || 0);
    if (countdownElapsed < 4000) { // Wait for full countdown
      return false;
    }

    // Round should already be preloaded, but generate if not
    if (!lobby.rounds[roundNum - 1]) {
      const round = generateRound(roundNum);
      lobby.rounds[roundNum - 1] = round;
    }
    
    lobby.gameState = 'playing';
    delete lobby.countdownStartTime;

    await setLobby(lobby);

    // Broadcast round started
    await broadcastToLobby(lobbyId, SSE_EVENTS.ROUND_STARTED, {
      round: lobby.rounds[roundNum - 1],
      currentRound: roundNum,
    });

    return true;
  } finally {
    await releaseStateLock(lobbyId, `round-${roundNum}-start`);
  }
}

// Check and end round (called by any player after round time or all found)
export async function checkAndEndRound(lobbyId: string, roundNum: number): Promise<boolean> {
  // Try to acquire lock
  if (!await acquireStateLock(lobbyId, `round-${roundNum}-end`)) {
    return false; // Another player already ended this round
  }

  try {
    const lobby = await getLobby(lobbyId);
    if (!lobby || lobby.gameState !== 'playing' || lobby.currentRound !== roundNum) {
      return false;
    }

    const currentRound = lobby.rounds[roundNum - 1];
    if (!currentRound) {
      return false;
    }

    // Check if round should end (30 seconds elapsed or all players found)
    const roundElapsed = Date.now() - currentRound.startTime;
    const allFound = currentRound.foundBy.length === lobby.players.length;
    
    if (roundElapsed < 30000 && !allFound) {
      return false; // Round not ready to end
    }

    // End round
    lobby.gameState = 'roundEnd';
    lobby.roundEndTime = Date.now();
    currentRound.endTime = Date.now();

    await setLobby(lobby);

    // Broadcast round ended
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

// Check and progress after round end (show scoreboard, then next round or game end)
export async function checkAndProgressAfterRoundEnd(lobbyId: string, roundNum: number): Promise<boolean> {
  // Try to acquire lock
  if (!await acquireStateLock(lobbyId, `round-${roundNum}-progress`)) {
    return false;
  }

  try {
    const lobby = await getLobby(lobbyId);
    if (!lobby || lobby.gameState !== 'roundEnd') {
      return false;
    }

    // Verify enough time has passed
    const roundEndElapsed = Date.now() - (lobby.roundEndTime || 0);
    const requiredDelay = roundNum === 5 ? 3000 : 6000; // Final round: 3s (answer only), Other rounds: 6s (3 for answer, 3 for scoreboard)
    if (roundEndElapsed < requiredDelay) {
      return false;
    }

    if (roundNum < 5) {
      // Start next round countdown
      lobby.gameState = 'countdown';
      lobby.currentRound = roundNum + 1;
      lobby.countdownStartTime = Date.now();
      delete lobby.roundEndTime;

      await setLobby(lobby);

      await broadcastToLobby(lobbyId, SSE_EVENTS.GAME_STARTED, {
        countdownStartTime: lobby.countdownStartTime,
        currentRound: roundNum + 1,
      });
    } else {
      // Game over
      lobby.gameState = 'finished';
      await setLobby(lobby);

      await broadcastToLobby(lobbyId, SSE_EVENTS.GAME_ENDED, {
        finalScores: lobby.players.sort((a, b) => b.score - a.score),
        winners: lobby.players
          .sort((a, b) => b.score - a.score)
          .slice(0, 3),
      });
    }

    return true;
  } finally {
    await releaseStateLock(lobbyId, `round-${roundNum}-progress`);
  }
}

// Reset game (called by host)
export async function resetGame(lobbyId: string, playerId: string): Promise<boolean> {
  const lobby = await getLobby(lobbyId);
  if (!lobby || lobby.gameState !== 'finished' || lobby.hostId !== playerId) {
    return false;
  }

  // Reset to waiting state
  lobby.gameState = 'waiting';
  lobby.currentRound = 0;
  lobby.rounds = [];
  delete lobby.countdownStartTime;
  delete lobby.roundEndTime;

  // Reset scores
  lobby.players.forEach((player) => {
    player.score = 0;
    player.roundScores = [];
  });

  await setLobby(lobby);

  await broadcastToLobby(lobbyId, SSE_EVENTS.GAME_RESET, { lobby });

  return true;
}