/**
 * Isolated test for ioredis-storage module
 * This test file properly unmocks the module to test the actual implementation
 */

// First, unmock the modules we want to test
jest.unmock('@/app/lib/ioredis-storage');
jest.unmock('@/app/lib/logger');

// Mock only the dependencies
jest.mock('@/app/lib/ioredis-client', () => ({
  getIoRedis: jest.fn(),
  get: jest.fn(),
  setex: jest.fn(),
}));

import { getLobby, setLobby } from '@/app/lib/ioredis-storage';
import * as ioredisClient from '@/app/lib/ioredis-client';
import { Lobby } from '@/app/types/game';

describe('ioredis-storage (isolated)', () => {
  const mockGet = ioredisClient.get as jest.MockedFunction<typeof ioredisClient.get>;
  const mockSetex = ioredisClient.setex as jest.MockedFunction<typeof ioredisClient.setex>;
  const mockGetIoRedis = ioredisClient.getIoRedis as jest.MockedFunction<typeof ioredisClient.getIoRedis>;

  const mockLobby: Lobby = {
    id: 'TEST123',
    hostId: 'player1',
    players: [
      {
        id: 'player1',
        name: 'Player 1',
        score: 0,
        isHost: true,
        roundScores: [],
      },
    ],
    gameState: 'waiting',
    currentRound: 0,
    rounds: [],
    settings: {
      maxPlayers: 8,
      roundDuration: 30,
      totalRounds: 5,
    },
    createdAt: Date.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock return values
    const mockRedisInstance = {
      get: mockGet,
      setex: mockSetex,
    };
    mockGetIoRedis.mockReturnValue(mockRedisInstance as any);
  });

  describe('getLobby', () => {
    it('should retrieve and parse a lobby from Redis', async () => {
      mockGet.mockResolvedValue(JSON.stringify(mockLobby));

      const result = await getLobby('TEST123');

      expect(mockGet).toHaveBeenCalledWith('lobby:TEST123');
      expect(result).toEqual(mockLobby);
    });

    it('should return null if lobby does not exist', async () => {
      mockGet.mockResolvedValue(null);

      const result = await getLobby('NONEXISTENT');

      expect(mockGet).toHaveBeenCalledWith('lobby:NONEXISTENT');
      expect(result).toBeNull();
    });

    it('should handle invalid JSON gracefully', async () => {
      mockGet.mockResolvedValue('invalid-json');
      
      const result = await getLobby('TEST123');
      
      expect(result).toBeNull();
    });

    it('should handle Redis errors gracefully', async () => {
      mockGet.mockRejectedValue(new Error('Redis connection error'));
      
      const result = await getLobby('TEST123');
      
      expect(result).toBeNull();
    });
  });

  describe('setLobby', () => {
    it('should store a lobby in Redis with correct TTL', async () => {
      mockSetex.mockResolvedValue('OK');

      await setLobby(mockLobby);

      expect(mockSetex).toHaveBeenCalledWith(
        'lobby:TEST123',
        3600, // 1 hour TTL
        JSON.stringify(mockLobby)
      );
    });

    it('should throw if Redis operation fails', async () => {
      mockSetex.mockRejectedValue(new Error('Redis error'));

      await expect(setLobby(mockLobby)).rejects.toThrow('Redis error');
    });
  });
});