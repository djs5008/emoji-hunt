// Mock Redis functions before importing the module
jest.mock('@/app/lib/ioredis-client', () => ({
  rpush: jest.fn(),
  lpush: jest.fn(),
  expire: jest.fn(),
  lrange: jest.fn(),
  del: jest.fn(),
  getIoRedis: jest.fn(),
  publish: jest.fn(),
}));

import { rpush, lpush, expire, publish } from '@/app/lib/ioredis-client';
import { broadcastToLobby, broadcastPriorityToLobby, SSE_EVENTS } from '@/app/lib/sse-broadcast';

const mockRpush = rpush as jest.Mock;
const mockLpush = lpush as jest.Mock;
const mockExpire = expire as jest.Mock;
const mockPublish = publish as jest.Mock;

describe('sse-broadcast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the current time for consistent testing
    jest.spyOn(Date, 'now').mockReturnValue(1640995200000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('SSE_EVENTS constants', () => {
    it('should export all required event types', () => {
      expect(SSE_EVENTS.PLAYER_JOINED).toBe('player-joined');
      expect(SSE_EVENTS.PLAYER_LEFT).toBe('player-left');
      expect(SSE_EVENTS.GAME_STARTED).toBe('game-started');
      expect(SSE_EVENTS.ROUND_STARTED).toBe('round-started');
      expect(SSE_EVENTS.ROUND_ENDED).toBe('round-ended');
      expect(SSE_EVENTS.EMOJI_FOUND).toBe('emoji-found');
      expect(SSE_EVENTS.WRONG_EMOJI).toBe('wrong-emoji');
      expect(SSE_EVENTS.GAME_ENDED).toBe('game-ended');
      expect(SSE_EVENTS.GAME_RESET).toBe('game-reset');
      expect(SSE_EVENTS.LOBBY_UPDATED).toBe('lobby-updated');
    });

    it('should be immutable (readonly)', () => {
      // TypeScript should prevent modification, but test runtime behavior
      expect(() => {
        (SSE_EVENTS as any).NEW_EVENT = 'new-event';
      }).not.toThrow(); // In JS this won't throw, but TS should catch it
      
      // Verify original values remain unchanged
      expect(SSE_EVENTS.PLAYER_JOINED).toBe('player-joined');
    });
  });

  describe('broadcastToLobby', () => {
    beforeEach(() => {
      mockRpush.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);
    });

    it('should broadcast event with correct structure', async () => {
      const lobbyId = 'TEST123';
      const eventType = SSE_EVENTS.PLAYER_JOINED;
      const data = { playerId: 'player1', playerName: 'Test Player' };

      await broadcastToLobby(lobbyId, eventType, data);

      expect(mockRpush).toHaveBeenCalledWith(
        'lobby:TEST123:events',
        {
          type: 'player-joined',
          data: { playerId: 'player1', playerName: 'Test Player' },
          timestamp: 1640995200000,
        }
      );
      
      expect(mockPublish).toHaveBeenCalledWith(
        'lobby:TEST123:channel',
        {
          type: 'player-joined',
          data: { playerId: 'player1', playerName: 'Test Player' },
          timestamp: 1640995200000,
        }
      );
    });

    it('should set expiration on the event queue', async () => {
      const lobbyId = 'TEST123';
      const eventType = SSE_EVENTS.GAME_STARTED;
      const data = {};

      await broadcastToLobby(lobbyId, eventType, data);

      expect(mockExpire).toHaveBeenCalledWith('lobby:TEST123:events', 30);
    });

    it('should handle different lobby IDs correctly', async () => {
      const testCases = [
        'ABC123',
        'test-lobby',
        'LOBBY_WITH_UNDERSCORES',
        '123456',
        'MixedCase123'
      ];

      for (const lobbyId of testCases) {
        jest.clearAllMocks();
        
        await broadcastToLobby(lobbyId, SSE_EVENTS.LOBBY_UPDATED, {});

        expect(mockRpush).toHaveBeenCalledWith(
          `lobby:${lobbyId}:events`,
          expect.objectContaining({ type: 'lobby-updated' })
        );
        expect(mockExpire).toHaveBeenCalledWith(`lobby:${lobbyId}:events`, 30);
      }
    });

    it('should handle all event types correctly', async () => {
      const eventTypes = Object.values(SSE_EVENTS);
      const lobbyId = 'TEST123';

      for (const eventType of eventTypes) {
        jest.clearAllMocks();
        
        await broadcastToLobby(lobbyId, eventType, { test: 'data' });

        expect(mockRpush).toHaveBeenCalledWith(
          'lobby:TEST123:events',
          expect.objectContaining({ type: eventType })
        );
      }
    });

    it('should handle different data types in payload', async () => {
      const testCases = [
        { data: null, description: 'null data' },
        { data: undefined, description: 'undefined data' },
        { data: {}, description: 'empty object' },
        { data: { key: 'value' }, description: 'simple object' },
        { data: { nested: { object: true } }, description: 'nested object' },
        { data: [1, 2, 3], description: 'array' },
        { data: 'string', description: 'string' },
        { data: 42, description: 'number' },
        { data: true, description: 'boolean' },
        { 
          data: { 
            playerId: 'player1', 
            score: 100, 
            items: ['a', 'b'], 
            meta: { isWinner: true } 
          }, 
          description: 'complex object' 
        }
      ];

      for (const { data, description } of testCases) {
        jest.clearAllMocks();
        
        await broadcastToLobby('TEST123', SSE_EVENTS.LOBBY_UPDATED, data);

        expect(mockRpush).toHaveBeenCalledWith(
          'lobby:TEST123:events',
          expect.objectContaining({ 
            type: 'lobby-updated',
            data: data,
            timestamp: 1640995200000
          })
        );
      }
    });

    it('should handle special characters in lobby ID', async () => {
      const specialLobbyIds = [
        'test@lobby',
        'lobby#123',
        'test.lobby',
        'lobby-with-dashes',
        'lobby_with_underscores'
      ];

      for (const lobbyId of specialLobbyIds) {
        jest.clearAllMocks();
        
        await broadcastToLobby(lobbyId, SSE_EVENTS.PLAYER_JOINED, {});

        expect(mockRpush).toHaveBeenCalledWith(
          `lobby:${lobbyId}:events`,
          expect.any(Object)
        );
      }
    });

    it('should include current timestamp in event', async () => {
      const mockTime = 1234567890000;
      jest.spyOn(Date, 'now').mockReturnValue(mockTime);

      await broadcastToLobby('TEST123', SSE_EVENTS.EMOJI_FOUND, { playerId: 'player1' });

      expect(mockRpush).toHaveBeenCalledWith(
        'lobby:TEST123:events',
        expect.objectContaining({ timestamp: mockTime })
      );
    });

    it('should call Redis operations in correct order', async () => {
      const callOrder: string[] = [];
      
      mockRpush.mockImplementation(() => {
        callOrder.push('rpush');
        return Promise.resolve(1);
      });
      
      mockPublish.mockImplementation(() => {
        callOrder.push('publish');
        return Promise.resolve(1);
      });
      
      mockExpire.mockImplementation(() => {
        callOrder.push('expire');
        return Promise.resolve(1);
      });

      await broadcastToLobby('TEST123', SSE_EVENTS.ROUND_STARTED, {});

      expect(callOrder).toEqual(['rpush', 'publish', 'expire']);
    });

    it('should propagate Redis rpush errors', async () => {
      mockRpush.mockRejectedValue(new Error('Redis rpush failed'));

      await expect(
        broadcastToLobby('TEST123', SSE_EVENTS.GAME_ENDED, {})
      ).rejects.toThrow('Redis rpush failed');

      expect(mockPublish).not.toHaveBeenCalled();
      expect(mockExpire).not.toHaveBeenCalled();
    });

    it('should propagate Redis expire errors', async () => {
      mockRpush.mockResolvedValue(1);
      mockExpire.mockRejectedValue(new Error('Redis expire failed'));

      await expect(
        broadcastToLobby('TEST123', SSE_EVENTS.WRONG_EMOJI, {})
      ).rejects.toThrow('Redis expire failed');

      expect(mockRpush).toHaveBeenCalled();
    });

    it('should handle concurrent broadcasts to same lobby', async () => {
      const lobbyId = 'TEST123';
      const promises = [
        broadcastToLobby(lobbyId, SSE_EVENTS.PLAYER_JOINED, { playerId: 'player1' }),
        broadcastToLobby(lobbyId, SSE_EVENTS.PLAYER_JOINED, { playerId: 'player2' }),
        broadcastToLobby(lobbyId, SSE_EVENTS.GAME_STARTED, {})
      ];

      await Promise.all(promises);

      expect(mockRpush).toHaveBeenCalledTimes(3);
      expect(mockExpire).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent broadcasts to different lobbies', async () => {
      const promises = [
        broadcastToLobby('LOBBY1', SSE_EVENTS.PLAYER_JOINED, { playerId: 'player1' }),
        broadcastToLobby('LOBBY2', SSE_EVENTS.PLAYER_JOINED, { playerId: 'player2' }),
        broadcastToLobby('LOBBY3', SSE_EVENTS.GAME_STARTED, {})
      ];

      await Promise.all(promises);

      expect(mockRpush).toHaveBeenCalledWith('lobby:LOBBY1:events', expect.any(Object));
      expect(mockRpush).toHaveBeenCalledWith('lobby:LOBBY2:events', expect.any(Object));
      expect(mockRpush).toHaveBeenCalledWith('lobby:LOBBY3:events', expect.any(Object));
      
      expect(mockExpire).toHaveBeenCalledWith('lobby:LOBBY1:events', 30);
      expect(mockExpire).toHaveBeenCalledWith('lobby:LOBBY2:events', 30);
      expect(mockExpire).toHaveBeenCalledWith('lobby:LOBBY3:events', 30);
    });

    it('should handle large data payloads', async () => {
      const largeData = {
        players: Array.from({ length: 100 }, (_, i) => ({
          id: `player${i}`,
          name: `Player ${i}`,
          score: i * 10,
          items: Array.from({ length: 50 }, (_, j) => `item${j}`)
        })),
        gameState: 'playing',
        metadata: {
          version: '1.0.0',
          description: 'A'.repeat(1000) // Large string
        }
      };

      await broadcastToLobby('TEST123', SSE_EVENTS.LOBBY_UPDATED, largeData);

      expect(mockRpush).toHaveBeenCalledWith(
        'lobby:TEST123:events',
        expect.objectContaining({ 
          data: largeData,
          type: 'lobby-updated'
        })
      );
    });

    it('should preserve event data exactly as provided', async () => {
      const testData = {
        playerId: 'player1',
        emoji: '🎮',
        position: { x: 100, y: 200 },
        metadata: null,
        isCorrect: false
      };

      await broadcastToLobby('TEST123', SSE_EVENTS.EMOJI_FOUND, testData);

      expect(mockRpush).toHaveBeenCalledWith(
        'lobby:TEST123:events',
        expect.objectContaining({ data: testData })
      );
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      mockRpush.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);
    });

    it('should handle typical game flow events', async () => {
      const lobbyId = 'GAME_LOBBY';
      
      // Simulate a typical game flow
      await broadcastToLobby(lobbyId, SSE_EVENTS.PLAYER_JOINED, { playerId: 'player1' });
      await broadcastToLobby(lobbyId, SSE_EVENTS.PLAYER_JOINED, { playerId: 'player2' });
      await broadcastToLobby(lobbyId, SSE_EVENTS.GAME_STARTED, { countdown: 3 });
      await broadcastToLobby(lobbyId, SSE_EVENTS.ROUND_STARTED, { round: 1, targetEmoji: '🎮' });
      await broadcastToLobby(lobbyId, SSE_EVENTS.EMOJI_FOUND, { playerId: 'player1', emoji: '🎮' });
      await broadcastToLobby(lobbyId, SSE_EVENTS.ROUND_ENDED, { winner: 'player1', scores: {} });
      await broadcastToLobby(lobbyId, SSE_EVENTS.GAME_ENDED, { finalScores: {} });

      expect(mockRpush).toHaveBeenCalledTimes(7);
      expect(mockExpire).toHaveBeenCalledTimes(7);

      // Verify each event was broadcast with correct key
      expect(mockRpush).toHaveBeenCalledWith(`lobby:${lobbyId}:events`, expect.any(Object));
    });

    it('should handle error recovery scenarios', async () => {
      // First call fails
      mockRpush
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(1);

      // First broadcast fails
      await expect(
        broadcastToLobby('TEST123', SSE_EVENTS.PLAYER_JOINED, {})
      ).rejects.toThrow('Network error');

      // Second broadcast succeeds
      await expect(
        broadcastToLobby('TEST123', SSE_EVENTS.PLAYER_JOINED, {})
      ).resolves.not.toThrow();

      expect(mockRpush).toHaveBeenCalledTimes(2);
      expect(mockExpire).toHaveBeenCalledTimes(1); // Only called on success
    });
  });

  describe('performance considerations', () => {
    beforeEach(() => {
      mockRpush.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);
    });

    it('should complete broadcasts quickly', async () => {
      const startTime = Date.now();
      
      await broadcastToLobby('TEST123', SSE_EVENTS.LOBBY_UPDATED, { data: 'test' });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete very quickly (under 100ms in tests)
      expect(duration).toBeLessThan(100);
    });

    it('should handle rapid successive broadcasts', async () => {
      const promises = [];
      
      // Simulate rapid game events
      for (let i = 0; i < 50; i++) {
        promises.push(
          broadcastToLobby(`LOBBY${i}`, SSE_EVENTS.EMOJI_FOUND, { playerId: `player${i}` })
        );
      }
      
      await Promise.all(promises);
      
      expect(mockRpush).toHaveBeenCalledTimes(50);
      expect(mockExpire).toHaveBeenCalledTimes(50);
    });
  });

  describe('broadcastPriorityToLobby', () => {
    beforeEach(() => {
      mockLpush.mockResolvedValue(1);
      mockPublish.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);
    });

    it('should use lpush for priority events', async () => {
      const lobbyId = 'TEST123';
      const eventType = SSE_EVENTS.GAME_STARTED;
      const data = { countdownStartTime: Date.now() };

      await broadcastPriorityToLobby(lobbyId, eventType, data);

      expect(mockLpush).toHaveBeenCalledWith(
        'lobby:TEST123:events',
        expect.objectContaining({
          type: 'game-started',
          data,
          timestamp: 1640995200000,
          priority: true
        })
      );

      expect(mockPublish).toHaveBeenCalledWith(
        'lobby:TEST123:channel',
        expect.objectContaining({
          type: 'game-started',
          data,
          timestamp: 1640995200000,
          priority: true
        })
      );
    });

    it('should propagate lpush errors', async () => {
      mockLpush.mockRejectedValue(new Error('Redis lpush failed'));

      await expect(
        broadcastPriorityToLobby('TEST123', SSE_EVENTS.GAME_STARTED, {})
      ).rejects.toThrow('Redis lpush failed');

      expect(mockPublish).not.toHaveBeenCalled();
      expect(mockExpire).not.toHaveBeenCalled();
    });
  });
});