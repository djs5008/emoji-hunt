import { NextRequest } from 'next/server';
import { GET } from '@/app/api/lobby/[id]/route';

// Mock dependencies
jest.mock('@/app/lib/game-state-async');
jest.mock('@/app/lib/player-session');

import { getLobby } from '@/app/lib/game-state-async';
import { SessionManager } from '@/app/lib/player-session';

const mockGetLobby = getLobby as jest.Mock;
const mockSessionManager = SessionManager as jest.Mocked<typeof SessionManager>;

describe('/api/lobby/[id] GET endpoint', () => {
  let mockRequest: NextRequest;
  let mockLobby: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRequest = new NextRequest('http://localhost:3000/api/lobby/TEST123');
    
    // Mock lobby data
    mockLobby = {
      id: 'TEST123',
      code: 'TEST123',
      hostId: 'player1',
      players: [
        {
          id: 'player1',
          name: 'Host Player',
          avatar: '🎮',
          score: 100,
          isHost: true,
          roundScores: [50, 50],
          isReady: true,
          lastHeartbeat: Date.now()
        },
        {
          id: 'player2', 
          name: 'Second Player',
          avatar: '🎯',
          score: 80,
          isHost: false,
          roundScores: [40, 40],
          isReady: true,
          lastHeartbeat: Date.now()
        }
      ],
      gameState: 'playing',
      currentRound: 2,
      maxRounds: 5,
      maxPlayers: 6,
      createdAt: Date.now(),
      rounds: [
        {
          number: 1,
          targetEmoji: { id: 'emoji1', emoji: '🎮', name: 'Game Controller' },
          emojis: [],
          startTime: Date.now(),
          foundBy: ['player1']
        }
      ]
    };
  });

  describe('successful responses', () => {
    it('should return lobby data with current player marked when session exists', async () => {
      // Mock successful lobby fetch
      mockGetLobby.mockResolvedValue(mockLobby);
      
      // Mock session with player1 as current
      mockSessionManager.getSessionFromCookies.mockResolvedValue({
        token: 'session-token',
        session: {
          playerId: 'player1',
          createdAt: Date.now(),
          lastActivity: Date.now()
        }
      });

      const response = await GET(mockRequest, { params: { id: 'TEST123' } });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toHaveProperty('id', 'TEST123');
      expect(responseData).toHaveProperty('players');
      expect(responseData.players).toHaveLength(2);
      
      // Check that current player is marked correctly
      expect(responseData.players[0]).toHaveProperty('isCurrent', true);  // player1
      expect(responseData.players[1]).toHaveProperty('isCurrent', false); // player2
      
      // Verify other properties are preserved
      expect(responseData).toHaveProperty('gameState', 'playing');
      expect(responseData).toHaveProperty('currentRound', 2);
      expect(responseData).toHaveProperty('hostId', 'player1');
    });

    it('should return lobby data with no current player when session does not exist', async () => {
      mockGetLobby.mockResolvedValue(mockLobby);
      mockSessionManager.getSessionFromCookies.mockResolvedValue(null);

      const response = await GET(mockRequest, { params: { id: 'TEST123' } });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.players[0]).toHaveProperty('isCurrent', false);
      expect(responseData.players[1]).toHaveProperty('isCurrent', false);
    });

    it('should return lobby data with no current player when session player not in lobby', async () => {
      mockGetLobby.mockResolvedValue(mockLobby);
      
      // Mock session with player not in this lobby
      mockSessionManager.getSessionFromCookies.mockResolvedValue({
        token: 'session-token',
        session: {
          playerId: 'player999',
          createdAt: Date.now(),
          lastActivity: Date.now()
        }
      });

      const response = await GET(mockRequest, { params: { id: 'TEST123' } });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.players[0]).toHaveProperty('isCurrent', false);
      expect(responseData.players[1]).toHaveProperty('isCurrent', false);
    });

    it('should handle case-insensitive lobby IDs', async () => {
      mockGetLobby.mockResolvedValue(mockLobby);
      mockSessionManager.getSessionFromCookies.mockResolvedValue(null);

      const response = await GET(mockRequest, { params: { id: 'test123' } });

      expect(mockGetLobby).toHaveBeenCalledWith('TEST123'); // Should be uppercase
      expect(response.status).toBe(200);
    });

    it('should handle lobby with empty players array', async () => {
      const emptyLobby = { ...mockLobby, players: [] };
      mockGetLobby.mockResolvedValue(emptyLobby);
      mockSessionManager.getSessionFromCookies.mockResolvedValue(null);

      const response = await GET(mockRequest, { params: { id: 'TEST123' } });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.players).toEqual([]);
    });

    it('should preserve all lobby properties', async () => {
      mockGetLobby.mockResolvedValue(mockLobby);
      mockSessionManager.getSessionFromCookies.mockResolvedValue(null);

      const response = await GET(mockRequest, { params: { id: 'TEST123' } });
      const responseData = await response.json();

      expect(responseData).toHaveProperty('id');
      expect(responseData).toHaveProperty('code');
      expect(responseData).toHaveProperty('hostId');
      expect(responseData).toHaveProperty('gameState');
      expect(responseData).toHaveProperty('currentRound');
      expect(responseData).toHaveProperty('maxRounds');
      expect(responseData).toHaveProperty('maxPlayers');
      expect(responseData).toHaveProperty('createdAt');
      expect(responseData).toHaveProperty('rounds');
    });
  });

  describe('error responses', () => {
    it('should return 404 when lobby is not found', async () => {
      mockGetLobby.mockResolvedValue(null);
      mockSessionManager.getSessionFromCookies.mockResolvedValue(null);

      const response = await GET(mockRequest, { params: { id: 'NONEXISTENT' } });
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData).toHaveProperty('error', 'Lobby not found');
    });

    it('should return 500 when getLobby throws an error', async () => {
      mockGetLobby.mockRejectedValue(new Error('Database connection failed'));
      mockSessionManager.getSessionFromCookies.mockResolvedValue(null);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const response = await GET(mockRequest, { params: { id: 'TEST123' } });
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toHaveProperty('error', 'Failed to fetch lobby');
      expect(consoleSpy).toHaveBeenCalledWith('[ERROR] Error fetching lobby', expect.objectContaining({
        error: expect.objectContaining({
          message: expect.any(String)
        })
      }));

      consoleSpy.mockRestore();
    });

    it('should return 500 when session manager throws an error', async () => {
      mockGetLobby.mockResolvedValue(mockLobby);
      mockSessionManager.getSessionFromCookies.mockRejectedValue(new Error('Session error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const response = await GET(mockRequest, { params: { id: 'TEST123' } });
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toHaveProperty('error', 'Failed to fetch lobby');
      expect(consoleSpy).toHaveBeenCalledWith('[ERROR] Error fetching lobby', expect.objectContaining({
        error: expect.objectContaining({
          message: expect.any(String)
        })
      }));

      consoleSpy.mockRestore();
    });

    it('should handle null session data gracefully', async () => {
      mockGetLobby.mockResolvedValue(mockLobby);
      mockSessionManager.getSessionFromCookies.mockResolvedValue(null);

      const response = await GET(mockRequest, { params: { id: 'TEST123' } });

      expect(response.status).toBe(200);
      // Should not throw error when session is null
    });

    it('should handle session data without playerId', async () => {
      mockGetLobby.mockResolvedValue(mockLobby);
      mockSessionManager.getSessionFromCookies.mockResolvedValue({
        token: 'session-token',
        session: {
          playerId: undefined,
          createdAt: Date.now(),
          lastActivity: Date.now()
        }
      } as any);

      const response = await GET(mockRequest, { params: { id: 'TEST123' } });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.players[0]).toHaveProperty('isCurrent', false);
      expect(responseData.players[1]).toHaveProperty('isCurrent', false);
    });
  });

  describe('edge cases', () => {
    it('should handle very long lobby IDs', async () => {
      const longId = 'A'.repeat(100);
      mockGetLobby.mockResolvedValue(null);
      mockSessionManager.getSessionFromCookies.mockResolvedValue(null);

      const response = await GET(mockRequest, { params: { id: longId } });

      expect(mockGetLobby).toHaveBeenCalledWith(longId.toUpperCase());
      expect(response.status).toBe(404); // Lobby not found is expected
    });

    it('should handle special characters in lobby ID', async () => {
      const specialId = 'TEST-123_SPECIAL!';
      mockGetLobby.mockResolvedValue(null);
      mockSessionManager.getSessionFromCookies.mockResolvedValue(null);

      const response = await GET(mockRequest, { params: { id: specialId } });

      expect(mockGetLobby).toHaveBeenCalledWith(specialId.toUpperCase());
    });

    it('should handle empty lobby ID', async () => {
      mockGetLobby.mockResolvedValue(null);
      mockSessionManager.getSessionFromCookies.mockResolvedValue(null);

      const response = await GET(mockRequest, { params: { id: '' } });

      expect(mockGetLobby).toHaveBeenCalledWith('');
      expect(response.status).toBe(404);
    });

    it('should handle lobby with many players', async () => {
      const manyPlayersLobby = {
        ...mockLobby,
        players: Array.from({ length: 50 }, (_, i) => ({
          id: `player${i}`,
          name: `Player ${i}`,
          avatar: '🎮',
          score: i * 10,
          isHost: i === 0,
          roundScores: [i],
          isReady: true,
          lastHeartbeat: Date.now()
        }))
      };

      mockGetLobby.mockResolvedValue(manyPlayersLobby);
      mockSessionManager.getSessionFromCookies.mockResolvedValue({
        token: 'session-token',
        session: {
          playerId: 'player25',
          createdAt: Date.now(),
          lastActivity: Date.now()
        }
      });

      const response = await GET(mockRequest, { params: { id: 'TEST123' } });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.players).toHaveLength(50);
      
      // Check that only player25 is marked as current
      const currentPlayers = responseData.players.filter((p: any) => p.isCurrent);
      expect(currentPlayers).toHaveLength(1);
      expect(currentPlayers[0].id).toBe('player25');
    });

    it('should handle lobby with complex game state', async () => {
      const complexLobby = {
        ...mockLobby,
        gameState: 'finished',
        currentRound: 5,
        rounds: Array.from({ length: 5 }, (_, i) => ({
          number: i + 1,
          targetEmoji: { id: `emoji${i}`, emoji: '🎮', name: `Emoji ${i}` },
          emojis: [],
          startTime: Date.now() - (i * 60000),
          foundBy: i % 2 === 0 ? ['player1'] : ['player2']
        }))
      };

      mockGetLobby.mockResolvedValue(complexLobby);
      mockSessionManager.getSessionFromCookies.mockResolvedValue(null);

      const response = await GET(mockRequest, { params: { id: 'TEST123' } });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.gameState).toBe('finished');
      expect(responseData.rounds).toHaveLength(5);
    });
  });

  describe('security considerations', () => {
    it('should not expose sensitive player session data', async () => {
      mockGetLobby.mockResolvedValue(mockLobby);
      mockSessionManager.getSessionFromCookies.mockResolvedValue({
        token: 'secret-session-token',
        session: {
          playerId: 'player1',
          createdAt: Date.now(),
          lastActivity: Date.now()
        }
      });

      const response = await GET(mockRequest, { params: { id: 'TEST123' } });
      const responseData = await response.json();

      // Should not include session token or other sensitive data
      expect(JSON.stringify(responseData)).not.toContain('secret-session-token');
      expect(responseData).not.toHaveProperty('sessionToken');
      expect(responseData).not.toHaveProperty('token');
    });

    it('should only add isCurrent field without modifying original lobby data structure', async () => {
      mockGetLobby.mockResolvedValue(mockLobby);
      mockSessionManager.getSessionFromCookies.mockResolvedValue(null);

      const response = await GET(mockRequest, { params: { id: 'TEST123' } });
      const responseData = await response.json();

      // Should have all original properties plus isCurrent
      responseData.players.forEach((player: any) => {
        expect(player).toHaveProperty('id');
        expect(player).toHaveProperty('name');
        expect(player).toHaveProperty('avatar');
        expect(player).toHaveProperty('score');
        expect(player).toHaveProperty('isHost');
        expect(player).toHaveProperty('roundScores');
        expect(player).toHaveProperty('isReady');
        expect(player).toHaveProperty('lastHeartbeat');
        expect(player).toHaveProperty('isCurrent'); // Added field
      });
    });
  });
});