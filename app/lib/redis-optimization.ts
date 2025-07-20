/**
 * Redis Performance Optimization Configuration
 *
 * @description Optimizes Redis usage for better performance and user experience.
 * Adjusts polling rates based on game state to reduce unnecessary load.
 */

export const POLLING_INTERVALS = {
  WAITING: 1000, // 1s when waiting in lobby (check for game start)
  COUNTDOWN: 50, // 50ms during countdown (critical timing)
  PLAYING: 50, // 50ms during active gameplay (instant feedback)
  ROUND_END: 50, // 50ms during round end display (fast transitions)
  FINISHED: 2000, // 2s when game is finished
};

// Heartbeat intervals
export const HEARTBEAT = {
  INTERVAL: 2000, // 2s heartbeat for responsiveness
  TIMEOUT: 6000, // 6s timeout (allows 3 missed heartbeats)
  TTL: 8, // 8s Redis TTL
};

// Event queue management
export const EVENT_QUEUE = {
  MAX_AGE: 30000, // Keep events for 30s
  CLEANUP_INTERVAL: 10000, // Clean up every 10s
};

// Connection settings
export const CONNECTION_LIMITS = {
  MAX_PLAYERS_PER_LOBBY: 100, // Reasonable upper limit for game balance
  RECONNECT_INTERVAL: 240000, // 4 minute reconnect cycle (before 5 min timeout)
};

// Redis operation batching
export const BATCHING = {
  ENABLED: true,
  BATCH_SIZE: 10,
  BATCH_DELAY: 50, // 50ms delay to batch operations
};

/**
 * Calculate optimal polling interval based on game state
 */
export function getPollingInterval(gameState: string): number {
  switch (gameState) {
    case 'waiting':
      return POLLING_INTERVALS.WAITING;
    case 'countdown':
      return POLLING_INTERVALS.COUNTDOWN;
    case 'playing':
      return POLLING_INTERVALS.PLAYING;
    case 'roundEnd':
      return POLLING_INTERVALS.ROUND_END;
    case 'finished':
      return POLLING_INTERVALS.FINISHED;
    default:
      return POLLING_INTERVALS.WAITING;
  }
}

/**
 * Get priority polling interval for critical game states
 * Returns faster polling during countdown and gameplay
 */
export function getPriorityPollingInterval(gameState: string): number | null {
  // During critical game moments, poll as fast as possible
  switch (gameState) {
    case 'countdown':
    case 'playing':
    case 'roundEnd': // Critical for sync when round ends
      return 50; // 50ms for ultra-responsive gameplay
    default:
      return null; // Use default from getPollingInterval
  }
}
