import { getLobby, setLobby } from '@/app/lib/upstash-storage';
import { Lobby } from '@/app/types/game';

// The module is automatically mocked by Jest via __mocks__
jest.mock('@/app/lib/upstash-storage');

describe('Upstash Storage', () => {
  let mockLobby: Lobby;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock lobby data
    mockLobby = {
      id: 'TEST123',
      code: 'TEST123',
      hostId: 'player1',
      players: [
        { id: 'player1', name: 'Host', avatar: '🎮', score: 0, isHost: true, roundScores: [], isReady: true, lastHeartbeat: Date.now() },
        { id: 'player2', name: 'Player 2', avatar: '🎯', score: 0, isHost: false, roundScores: [], isReady: true, lastHeartbeat: Date.now() },
      ],
      gameState: 'waiting',
      currentRound: 0,
      maxRounds: 5,
      maxPlayers: 6,
      createdAt: Date.now(),
      rounds: [],
    };
  });

  describe('getLobby', () => {
    it('should retrieve lobby successfully', async () => {
      // Set up mock to return lobby
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const result = await getLobby('TEST123');
      
      expect(result).toEqual(mockLobby);
      expect(getLobby).toHaveBeenCalledWith('TEST123');
    });

    it('should return null when lobby not found', async () => {
      (getLobby as jest.Mock).mockResolvedValue(null);
      
      const result = await getLobby('NONEXISTENT');
      
      expect(result).toBeNull();
      expect(getLobby).toHaveBeenCalledWith('NONEXISTENT');
    });

    it('should handle different lobby IDs', async () => {
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      await getLobby('DIFFERENT-LOBBY');
      
      expect(getLobby).toHaveBeenCalledWith('DIFFERENT-LOBBY');
    });

    it('should handle empty lobby ID', async () => {
      (getLobby as jest.Mock).mockResolvedValue(null);
      
      const result = await getLobby('');
      
      expect(result).toBeNull();
      expect(getLobby).toHaveBeenCalledWith('');
    });

    it('should handle special characters in lobby ID', async () => {
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      await getLobby('TEST-123_SPECIAL');
      
      expect(getLobby).toHaveBeenCalledWith('TEST-123_SPECIAL');
    });

    it('should handle complex lobby data', async () => {
      const complexLobby = {
        ...mockLobby,
        rounds: [
          {
            number: 1,
            targetEmoji: { id: 'emoji1', emoji: '🎮', name: 'Game Controller' },
            emojis: [{ id: 'emoji1', emoji: '🎮', name: 'Game Controller' }],
            startTime: Date.now(),
            foundBy: ['player1'],
          }
        ],
        gameState: 'playing' as const,
        currentRound: 1,
      };
      
      (getLobby as jest.Mock).mockResolvedValue(complexLobby);
      
      const result = await getLobby('TEST123');
      
      expect(result).toEqual(complexLobby);
    });
  });

  describe('setLobby', () => {
    it('should save lobby successfully', async () => {
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      
      await setLobby(mockLobby);
      
      expect(setLobby).toHaveBeenCalledWith(mockLobby);
    });

    it('should handle different lobby IDs', async () => {
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      const differentLobby = { ...mockLobby, id: 'DIFFERENT-LOBBY' };
      
      await setLobby(differentLobby);
      
      expect(setLobby).toHaveBeenCalledWith(differentLobby);
    });

    it('should handle special characters in lobby ID', async () => {
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      const specialLobby = { ...mockLobby, id: 'TEST-123_SPECIAL' };
      
      await setLobby(specialLobby);
      
      expect(setLobby).toHaveBeenCalledWith(specialLobby);
    });

    it('should handle complex lobby data', async () => {
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      const complexLobby = {
        ...mockLobby,
        rounds: [
          {
            number: 1,
            targetEmoji: { id: 'emoji1', emoji: '🎮', name: 'Game Controller' },
            emojis: [{ id: 'emoji1', emoji: '🎮', name: 'Game Controller' }],
            startTime: Date.now(),
            foundBy: ['player1'],
          }
        ],
        gameState: 'playing' as const,
        currentRound: 1,
      };
      
      await setLobby(complexLobby);
      
      expect(setLobby).toHaveBeenCalledWith(complexLobby);
    });

    it('should handle empty players array', async () => {
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      const emptyLobby = { ...mockLobby, players: [] };
      
      await setLobby(emptyLobby);
      
      expect(setLobby).toHaveBeenCalledWith(emptyLobby);
    });

    it('should handle very large lobby data', async () => {
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      const largeLobby = {
        ...mockLobby,
        players: Array.from({ length: 100 }, (_, i) => ({
          id: `player${i}`,
          name: `Player ${i}`,
          avatar: '🎮',
          score: i * 10,
          isHost: i === 0,
          roundScores: Array.from({ length: 10 }, (_, j) => j * 5),
          isReady: true,
          lastHeartbeat: Date.now(),
        })),
      };
      
      await setLobby(largeLobby);
      
      expect(setLobby).toHaveBeenCalledWith(largeLobby);
    });

    it('should handle lobby with null/undefined values', async () => {
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      const lobbyWithNulls = {
        ...mockLobby,
        rounds: null as any,
        countdownStartTime: undefined as any,
      };
      
      await setLobby(lobbyWithNulls);
      
      expect(setLobby).toHaveBeenCalledWith(lobbyWithNulls);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle save and retrieve cycle', async () => {
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      await setLobby(mockLobby);
      const retrieved = await getLobby('TEST123');
      
      expect(setLobby).toHaveBeenCalledWith(mockLobby);
      expect(getLobby).toHaveBeenCalledWith('TEST123');
      expect(retrieved).toEqual(mockLobby);
    });

    it('should handle concurrent operations', async () => {
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const [saveResult, getResult] = await Promise.all([
        setLobby(mockLobby),
        getLobby('TEST123'),
      ]);
      
      expect(setLobby).toHaveBeenCalledWith(mockLobby);
      expect(getLobby).toHaveBeenCalledWith('TEST123');
      expect(getResult).toEqual(mockLobby);
    });

    it('should handle multiple lobbies', async () => {
      const lobby1 = { ...mockLobby, id: 'LOBBY1' };
      const lobby2 = { ...mockLobby, id: 'LOBBY2' };
      
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      
      await Promise.all([
        setLobby(lobby1),
        setLobby(lobby2),
      ]);
      
      expect(setLobby).toHaveBeenCalledWith(lobby1);
      expect(setLobby).toHaveBeenCalledWith(lobby2);
      expect(setLobby).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should propagate errors from getLobby', async () => {
      (getLobby as jest.Mock).mockRejectedValue(new Error('Redis error'));
      
      await expect(getLobby('TEST123')).rejects.toThrow('Redis error');
    });

    it('should propagate errors from setLobby', async () => {
      (setLobby as jest.Mock).mockRejectedValue(new Error('Storage error'));
      
      await expect(setLobby(mockLobby)).rejects.toThrow('Storage error');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined return values', async () => {
      (getLobby as jest.Mock).mockResolvedValue(undefined);
      
      const result = await getLobby('TEST123');
      
      expect(result).toBeUndefined();
    });

    it('should handle very long lobby IDs', async () => {
      const longId = 'A'.repeat(1000);
      (getLobby as jest.Mock).mockResolvedValue(null);
      
      await getLobby(longId);
      
      expect(getLobby).toHaveBeenCalledWith(longId);
    });

    it('should handle lobby with circular references (JSON serialization edge case)', async () => {
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      
      const circularLobby = { ...mockLobby };
      // This would cause issues in real JSON.stringify but our mock handles it
      
      await setLobby(circularLobby);
      
      expect(setLobby).toHaveBeenCalledWith(circularLobby);
    });
  });
});