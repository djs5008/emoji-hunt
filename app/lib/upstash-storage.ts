import { Lobby } from '@/app/types/game';
import { getUpstashRedis } from './upstash-redis';

/**
 * Upstash Storage Layer
 * 
 * @description High-level storage operations for game data using Upstash Redis.
 * Handles lobby persistence, event streaming, and health checks. All data is
 * automatically expired to prevent storage bloat.
 * 
 * Key features:
 * - Automatic JSON serialization/deserialization
 * - TTL-based expiration for all data
 * - Event queue management for real-time updates
 * - Health check capabilities
 */

const LOBBY_TTL = 3600; // 1 hour TTL for lobbies

/**
 * Retrieves a lobby from Redis
 * 
 * @description Fetches lobby data by ID. Upstash automatically deserializes
 * JSON, so the returned object is ready to use.
 * 
 * @param {string} id - Lobby ID to retrieve
 * @returns {Promise<Lobby | null>} Lobby object or null if not found
 */
export async function getLobby(id: string): Promise<Lobby | null> {
  const client = getUpstashRedis();
  
  try {
    const data = await client.get(`lobby:${id}`);
    // Upstash handles JSON parsing automatically
    return data as Lobby | null;
  } catch (error) {
    console.error('Error getting lobby from Redis:', error);
    return null;
  }
}

/**
 * Saves or updates a lobby in Redis
 * 
 * @description Persists lobby data with automatic expiration. The lobby will
 * be automatically deleted after 1 hour of inactivity.
 * 
 * @param {Lobby} lobby - Lobby object to save
 * @throws {Error} If save operation fails
 */
export async function setLobby(lobby: Lobby): Promise<void> {
  const client = getUpstashRedis();
  
  try {
    // Serialize and save with TTL
    await client.setex(`lobby:${lobby.id}`, LOBBY_TTL, JSON.stringify(lobby));
  } catch (error) {
    console.error('Error setting lobby in Redis:', error);
    throw error;
  }
}

/**
 * Deletes a lobby from Redis
 * 
 * @description Removes lobby data immediately. Used when a lobby becomes empty.
 * 
 * @param {string} id - Lobby ID to delete
 */
export async function deleteLobby(id: string): Promise<void> {
  const client = getUpstashRedis();
  
  try {
    await client.del(`lobby:${id}`);
  } catch (error) {
    console.error('Error deleting lobby from Redis:', error);
  }
}

/**
 * Publishes an event to a lobby's event queue
 * 
 * @description Adds an event to the lobby's event list for SSE connections
 * to pick up. Events are stored in a capped list (max 100) with automatic
 * expiration. Newer events are added to the front of the list.
 * 
 * @param {string} lobbyId - Target lobby for the event
 * @param {any} message - Event data to publish
 * 
 * Event structure:
 * - Adds timestamp and unique ID
 * - Stored at front of list (LIFO)
 * - Capped at 100 events
 * - Expires after 1 hour
 */
export async function publishToLobby(
  lobbyId: string,
  message: any
): Promise<void> {
  const client = getUpstashRedis();
  
  try {
    // Enrich event with metadata
    const eventData = {
      ...message,
      timestamp: Date.now(),
      id: Math.random().toString(36).substring(7),
    };

    // Add to front of list for newest-first ordering
    await client.lpush(`lobby:${lobbyId}:events`, eventData);
    // Cap list size to prevent memory growth
    await client.ltrim(`lobby:${lobbyId}:events`, 0, 99);
    // Refresh TTL on event list
    await client.expire(`lobby:${lobbyId}:events`, 3600);
  } catch (error) {
    console.error('Error publishing to lobby:', error);
  }
}

// Export publishToLobby with an alias for backward compatibility
export { publishToLobby as publishEvent };

/**
 * Retrieves recent events for a lobby
 * 
 * @description Fetches the latest events from a lobby's event queue.
 * Can optionally filter to only return events newer than a specified ID.
 * 
 * @param {string} lobbyId - Lobby to get events for
 * @param {string} lastEventId - Optional ID to get only newer events
 * @returns {Promise<any[]>} Array of events, newest first
 * 
 * Usage:
 * - Without lastEventId: Returns last 50 events
 * - With lastEventId: Returns only events newer than specified
 */
export async function getLatestEvents(
  lobbyId: string,
  lastEventId?: string
): Promise<any[]> {
  const client = getUpstashRedis();
  
  try {
    // Fetch recent events (newest first)
    const events = await client.lrange(`lobby:${lobbyId}:events`, 0, 49);
    const parsedEvents = events as any[];

    // Filter by last seen event if provided
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

/**
 * Health check for Redis connection
 * 
 * @description Verifies Redis is accessible and responding. Useful for
 * monitoring and debugging connection issues.
 * 
 * @returns {Promise<boolean>} True if Redis responds with PONG
 */
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