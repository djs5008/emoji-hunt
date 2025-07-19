import { getLobby } from './game-state-async';
import { setLobby } from './upstash-storage';
import { get, del, keys } from './upstash-redis';
import { broadcastToLobby, SSE_EVENTS } from './sse-broadcast';
import { logger } from './logger';

/**
 * Player Heartbeat Management
 * 
 * @description Monitors player connections via heartbeats and removes
 * disconnected players from lobbies. Handles host reassignment and
 * lobby cleanup when empty.
 * 
 * Heartbeat system:
 * - Players send heartbeats every 2 seconds via SSE
 * - Players considered disconnected after 3 seconds
 * - Grace period for new players to establish connection
 * - Automatic host reassignment if host disconnects
 */

/**
 * Checks for and removes disconnected players from a lobby
 * 
 * @description Scans all players in a lobby and removes those without
 * recent heartbeats. Handles host reassignment and lobby deletion.
 * 
 * @param {string} lobbyId - The lobby to check
 * @param {string} forceRemove - Optional player ID to force remove
 * 
 * Cleanup process:
 * 1. Check each player's last heartbeat
 * 2. Remove players inactive for 5+ seconds
 * 3. Reassign host if needed
 * 4. Delete empty lobbies
 */
export async function checkDisconnectedPlayers(lobbyId: string, forceRemove?: string): Promise<void> {
  const lobby = await getLobby(lobbyId);
  
  if (!lobby) {
    logger.debug('checkDisconnectedPlayers: Lobby not found', { lobbyId });
    return;
  }
  
  const now = Date.now();
  const disconnectedPlayers: string[] = [];
  
  // Handle forced removal (explicit leave)
  if (forceRemove && lobby.players.find(p => p.id === forceRemove)) {
    disconnectedPlayers.push(forceRemove);
  }
  
  // Check each player's heartbeat status
  for (const player of lobby.players) {
    // Skip if already marked for removal
    if (disconnectedPlayers.includes(player.id)) continue;
    
    const heartbeatKey = `player:${lobbyId}:${player.id}:heartbeat`;
    const lastHeartbeat = await get(heartbeatKey);
    
    if (!lastHeartbeat) {
      // No heartbeat found - check if player is new
      const joinTimeKey = `player:${lobbyId}:${player.id}:joinTime`;
      const joinTime = await get(joinTimeKey);
      
      if (!joinTime) {
        // No join time = old player who lost connection
        disconnectedPlayers.push(player.id);
        continue;
      }
      
      const timeSinceJoin = now - parseInt(joinTime);
      
      // Grace period for new players (10 seconds to establish connection)
      if (timeSinceJoin > 10000) {
        disconnectedPlayers.push(player.id);
      }
      continue;
    }
    
    // Check heartbeat freshness
    const timeSinceHeartbeat = now - parseInt(lastHeartbeat);
    
    // Disconnect threshold: 3 seconds (allows 1.5 missed heartbeats)
    // This provides faster disconnection detection while still allowing for network hiccups
    if (timeSinceHeartbeat > 3000) {
      disconnectedPlayers.push(player.id);
      await del(heartbeatKey);
    }
  }
  
  // Process disconnections if any found
  if (disconnectedPlayers.length > 0) {
    logger.debug('Processing player disconnections', {
      lobbyId,
      disconnectedPlayers,
      forceRemove,
      remainingPlayers: lobby.players.length - disconnectedPlayers.length
    });
    
    // Remove from lobby
    lobby.players = lobby.players.filter(p => !disconnectedPlayers.includes(p.id));
    
    // Host reassignment logic
    if (disconnectedPlayers.includes(lobby.hostId) && lobby.players.length > 0) {
      // Assign first remaining player as new host
      lobby.hostId = lobby.players[0].id;
      lobby.players[0].isHost = true;
    }
    
    await setLobby(lobby);
    
    // Notify and cleanup for each disconnected player
    for (const playerId of disconnectedPlayers) {
      // Remove all player-specific Redis keys
      await del([
        `player:${lobbyId}:${playerId}:heartbeat`,
        `player:${lobbyId}:${playerId}:joinTime`
      ]);
      
      // Broadcast departure to remaining players
      await broadcastToLobby(lobbyId, SSE_EVENTS.PLAYER_LEFT, {
        playerId,
        lobby,
      });
    }
    
    // Empty lobby cleanup
    if (lobby.players.length === 0) {
      logger.info('Deleting empty lobby', { lobbyId });
      
      // Delete main lobby data
      await del([`lobby:${lobbyId}`, `events:${lobbyId}`]);
      
      // Clean up any orphaned player keys
      const playerKeys = await keys(`player:${lobbyId}:*`);
      if (playerKeys.length > 0) {
        await del(playerKeys);
      }
      
      // Clean up distributed locks
      const lockKeys = await keys(`lobby:${lobbyId}:lock:*`);
      if (lockKeys.length > 0) {
        await del(lockKeys);
      }
    }
  }
}

