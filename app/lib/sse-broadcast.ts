import { rpush, expire, keys, exists } from './upstash-redis';

// Event types
export const SSE_EVENTS = {
  PLAYER_JOINED: 'player-joined',
  PLAYER_LEFT: 'player-left',
  GAME_STARTED: 'game-started',
  ROUND_STARTED: 'round-started',
  ROUND_ENDED: 'round-ended',
  EMOJI_FOUND: 'emoji-found',
  WRONG_EMOJI: 'wrong-emoji',
  GAME_ENDED: 'game-ended',
  GAME_RESET: 'game-reset',
  LOBBY_UPDATED: 'lobby-updated',
} as const;

// Broadcast an event to all players in a lobby
export async function broadcastToLobby(
  lobbyId: string,
  eventType: string,
  data: any
): Promise<void> {
  // Store event in Redis for SSE connections to pick up
  const event = {
    type: eventType,
    data,
    timestamp: Date.now(),
  };
  
  await rpush(`lobby:${lobbyId}:events`, event);
  
  // Set expiry on events list (5 seconds)
  await expire(`lobby:${lobbyId}:events`, 5);
}

// Get active players in a lobby (based on heartbeat)
export async function getActivePlayers(lobbyId: string): Promise<string[]> {
  const pattern = `player:${lobbyId}:*:heartbeat`;
  const heartbeatKeys = await keys(pattern);
  
  const activePlayers: string[] = [];
  for (const key of heartbeatKeys) {
    const playerId = key.split(':')[2];
    activePlayers.push(playerId);
  }
  
  return activePlayers;
}

// Check if a player is active
export async function isPlayerActive(lobbyId: string, playerId: string): Promise<boolean> {
  const result = await exists(`player:${lobbyId}:${playerId}:heartbeat`);
  return result === 1;
}