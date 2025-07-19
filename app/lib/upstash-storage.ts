import { Lobby } from '@/app/types/game';
import { getUpstashRedis } from './upstash-redis';

const LOBBY_TTL = 3600; // 1 hour TTL for lobbies

export async function getLobby(id: string): Promise<Lobby | null> {
  const client = getUpstashRedis();
  
  try {
    const data = await client.get(`lobby:${id}`);
    // Upstash Redis automatically parses JSON, no need for JSON.parse
    return data as Lobby | null;
  } catch (error) {
    console.error('Error getting lobby from Redis:', error);
    return null;
  }
}

export async function setLobby(lobby: Lobby): Promise<void> {
  const client = getUpstashRedis();
  
  try {
    await client.setex(`lobby:${lobby.id}`, LOBBY_TTL, JSON.stringify(lobby));
  } catch (error) {
    console.error('Error setting lobby in Redis:', error);
    throw error;
  }
}

export async function deleteLobby(id: string): Promise<void> {
  const client = getUpstashRedis();
  
  try {
    await client.del(`lobby:${id}`);
  } catch (error) {
    console.error('Error deleting lobby from Redis:', error);
  }
}

export async function publishToLobby(
  lobbyId: string,
  message: any
): Promise<void> {
  const client = getUpstashRedis();
  
  try {
    // Store event in a list for SSE to pick up
    const eventData = {
      ...message,
      timestamp: Date.now(),
      id: Math.random().toString(36).substring(7),
    };

    // Use lpush to add to the left of the list
    await client.lpush(`lobby:${lobbyId}:events`, eventData);
    // Keep only the last 100 events
    await client.ltrim(`lobby:${lobbyId}:events`, 0, 99);
    // Set expiry
    await client.expire(`lobby:${lobbyId}:events`, 3600);
  } catch (error) {
    console.error('Error publishing to lobby:', error);
  }
}

// Export publishToLobby with an alias for backward compatibility
export { publishToLobby as publishEvent };

export async function getLatestEvents(
  lobbyId: string,
  lastEventId?: string
): Promise<any[]> {
  const client = getUpstashRedis();
  
  try {
    // Get last 50 events
    const events = await client.lrange(`lobby:${lobbyId}:events`, 0, 49);
    // Upstash Redis automatically parses JSON
    const parsedEvents = events as any[];

    // If we have a lastEventId, filter to only return newer events
    if (lastEventId) {
      const lastIndex = parsedEvents.findIndex((e) => e.id === lastEventId);
      if (lastIndex >= 0) {
        return parsedEvents.slice(0, lastIndex);
      }
    }

    return parsedEvents;
  } catch (error) {
    console.error('Error getting events from Redis:', error);
    return [];
  }
}

export function isRedisAvailable(): boolean {
  return !!process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
}

// Health check function
export async function pingRedis(): Promise<boolean> {
  const client = getUpstashRedis();
  
  try {
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Redis ping failed:', error);
    return false;
  }
}