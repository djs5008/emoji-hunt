import { Lobby } from '@/app/types/game';
import { getIoRedis } from './ioredis-client';
import { logger } from './logger';

/**
 * IoRedis Storage Layer
 * 
 * @description High-level storage operations for game data using ioredis.
 * Handles lobby persistence with automatic expiration to prevent storage bloat.
 * This replaces the upstash-storage.ts module with ioredis-based implementation.
 * 
 * Key features:
 * - JSON serialization/deserialization (unlike Upstash, ioredis requires manual JSON handling)
 * - TTL-based expiration for all data
 * - Consistent API with the previous upstash-storage module
 */

const LOBBY_TTL = 3600; // 1 hour TTL for lobbies

/**
 * Retrieves a lobby from Redis
 * 
 * @description Fetches lobby data by ID and parses the JSON string.
 * Unlike Upstash, ioredis returns raw strings that need parsing.
 * 
 * @param {string} id - Lobby ID to retrieve
 * @returns {Promise<Lobby | null>} Lobby object or null if not found
 */
export async function getLobby(id: string): Promise<Lobby | null> {
  try {
    const client = getIoRedis();
    const data = await client.get(`lobby:${id}`);
    // Parse JSON string returned by ioredis
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Error getting lobby from Redis', error as Error, { lobbyId: id });
    // Check if it's a connection/credentials error
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      logger.error('Redis connection error - check REDIS_URL environment variable');
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
    const client = getIoRedis();
    
    // Serialize and save with TTL
    await client.setex(`lobby:${lobby.id}`, LOBBY_TTL, JSON.stringify(lobby));
  } catch (error) {
    logger.error('Error setting lobby in Redis', error as Error, { lobbyId: lobby.id });
    // Check if it's a connection/credentials error
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      logger.error('Redis connection error - check REDIS_URL environment variable');
    }
    throw error;
  }
}