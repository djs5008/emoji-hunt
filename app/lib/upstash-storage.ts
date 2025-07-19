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
  try {
    const client = getUpstashRedis();
    const data = await client.get(`lobby:${id}`);
    // Upstash handles JSON parsing automatically
    return data as Lobby | null;
  } catch (error) {
    console.error('Error getting lobby from Redis:', error);
    // Check if it's a connection/credentials error
    if (error instanceof Error && error.message.includes('credentials')) {
      console.error('Redis connection error - check UPSTASH_REDIS_REST_KV_REST_API_URL and UPSTASH_REDIS_REST_KV_REST_API_TOKEN environment variables');
    }
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
  try {
    const client = getUpstashRedis();
    
    // Serialize and save with TTL
    await client.setex(`lobby:${lobby.id}`, LOBBY_TTL, JSON.stringify(lobby));
  } catch (error) {
    console.error('Error setting lobby in Redis:', error);
    // Check if it's a connection/credentials error
    if (error instanceof Error && error.message.includes('credentials')) {
      console.error('Redis connection error - check UPSTASH_REDIS_REST_KV_REST_API_URL and UPSTASH_REDIS_REST_KV_REST_API_TOKEN environment variables');
    }
    throw error;
  }
}

