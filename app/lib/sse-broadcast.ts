import { rpush, expire } from './upstash-redis';

/**
 * Server-Sent Events (SSE) Broadcasting System
 * 
 * @description Manages real-time event broadcasting to connected clients using
 * Redis as a message queue. Events are stored temporarily and picked up by
 * SSE connections for distribution to players.
 * 
 * Architecture:
 * - Events stored in Redis lists per lobby
 * - SSE endpoints poll these lists for new events
 * - Auto-expiry prevents memory buildup
 * - Heartbeat system tracks active connections
 */

// Comprehensive event type constants for type safety
export const SSE_EVENTS = {
  PLAYER_JOINED: 'player-joined',    // New player joined lobby
  PLAYER_LEFT: 'player-left',        // Player disconnected/left
  GAME_STARTED: 'game-started',      // Game transitioned to countdown
  ROUND_STARTED: 'round-started',    // Round began (playing state)
  ROUND_ENDED: 'round-ended',        // Round finished, showing results
  EMOJI_FOUND: 'emoji-found',        // Player found target emoji
  WRONG_EMOJI: 'wrong-emoji',        // Player clicked wrong emoji
  GAME_ENDED: 'game-ended',          // All rounds complete
  GAME_RESET: 'game-reset',          // Game reset to waiting
  LOBBY_UPDATED: 'lobby-updated',    // General lobby state change
} as const;

/**
 * Broadcasts an event to all connected players in a lobby
 * 
 * @description Stores event in Redis for SSE connections to retrieve.
 * Events are automatically expired after 5 seconds to prevent buildup.
 * 
 * @param {string} lobbyId - Target lobby for broadcast
 * @param {string} eventType - Type of event (use SSE_EVENTS constants)
 * @param {any} data - Event payload data
 * 
 * Event structure:
 * - type: Event identifier
 * - data: Payload specific to event type
 * - timestamp: Unix timestamp for ordering
 */
export async function broadcastToLobby(
  lobbyId: string,
  eventType: string,
  data: any
): Promise<void> {
  // Package event with metadata
  const event = {
    type: eventType,
    data,
    timestamp: Date.now(),
  };
  
  // Push to Redis event queue
  await rpush(`lobby:${lobbyId}:events`, event);
  
  // Auto-expire after 5 seconds (events should be consumed quickly)
  await expire(`lobby:${lobbyId}:events`, 5);
}

