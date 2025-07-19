import { getLobby } from './game-state-async';
import { setLobby } from './upstash-storage';
import { get, del, keys } from './upstash-redis';
import { broadcastToLobby, SSE_EVENTS } from './sse-broadcast';

// Check for disconnected players and clean them up
export async function checkDisconnectedPlayers(lobbyId: string, forceRemove?: string): Promise<void> {
  const lobby = await getLobby(lobbyId);
  
  if (!lobby) return;
  
  const now = Date.now();
  const disconnectedPlayers: string[] = [];
  
  // If forceRemove is specified, add it to disconnected list immediately
  if (forceRemove && lobby.players.find(p => p.id === forceRemove)) {
    disconnectedPlayers.push(forceRemove);
  }
  
  // Check each player's heartbeat
  for (const player of lobby.players) {
    // Skip if already force removed
    if (disconnectedPlayers.includes(player.id)) continue;
    
    const heartbeatKey = `player:${lobbyId}:${player.id}:heartbeat`;
    const lastHeartbeat = await get(heartbeatKey);
    
    
    if (!lastHeartbeat) {
      // For regular cleanup (not force remove), check join time
      const joinTimeKey = `player:${lobbyId}:${player.id}:joinTime`;
      const joinTime = await get(joinTimeKey);
      
      if (!joinTime) {
        // No join time recorded, player has been around for a while - remove them
        disconnectedPlayers.push(player.id);
        continue;
      }
      
      const timeSinceJoin = now - parseInt(joinTime);
      
      // Only consider disconnected if they joined more than 10 seconds ago (5 heartbeats)
      // This gives time for page refreshes and initial connection
      if (timeSinceJoin > 10000) {
        disconnectedPlayers.push(player.id);
      }
      continue;
    }
    
    const timeSinceHeartbeat = now - parseInt(lastHeartbeat);
    
    // Consider disconnected after 5 seconds (2.5 missed heartbeats)
    // Reduced grace period for faster cleanup
    if (timeSinceHeartbeat > 5000) {
      disconnectedPlayers.push(player.id);
      // Clean up the heartbeat key
      await del(heartbeatKey);
    }
  }
  
  // Remove disconnected players
  if (disconnectedPlayers.length > 0) {
    lobby.players = lobby.players.filter(p => !disconnectedPlayers.includes(p.id));
    
    // If host disconnected, assign new host
    if (disconnectedPlayers.includes(lobby.hostId) && lobby.players.length > 0) {
      lobby.hostId = lobby.players[0].id;
      lobby.players[0].isHost = true;
    }
    
    await setLobby(lobby);
    
    // Broadcast player left events and clean up Redis keys
    for (const playerId of disconnectedPlayers) {
      // Clean up all player-related keys
      await del([`player:${lobbyId}:${playerId}:heartbeat`, `player:${lobbyId}:${playerId}:joinTime`]);
      
      await broadcastToLobby(lobbyId, SSE_EVENTS.PLAYER_LEFT, {
        playerId,
        lobby,
      });
    }
    
    // Check if lobby should be deleted (no players left)
    if (lobby.players.length === 0) {
      // Clean up all lobby-related keys
      await del([`lobby:${lobbyId}`, `events:${lobbyId}`]);
      
      // Clean up any remaining player keys
      const playerKeys = await keys(`player:${lobbyId}:*`);
      if (playerKeys.length > 0) {
        await del(playerKeys);
      }
      
      // Clean up any lock keys
      const lockKeys = await keys(`lobby:${lobbyId}:lock:*`);
      if (lockKeys.length > 0) {
        await del(lockKeys);
      }
    }
  }
}

