import { POST } from '@/app/api/lobby/join/route';
import { NextRequest } from 'next/server';
import { joinLobby } from '@/app/lib/game-state-async';
import { broadcastToLobby, SSE_EVENTS } from '@/app/lib/sse-broadcast';
import { setex } from '@/app/lib/ioredis-client';
import { SessionManager } from '@/app/lib/player-session';

// Mock dependencies
jest.mock('@/app/lib/game-state-async');
jest.mock('@/app/lib/sse-broadcast');
jest.mock('@/app/lib/ioredis-client');
jest.mock('@/app/lib/player-session');
jest.mock('@/app/lib/rate-limit-middleware', () => ({
  withRateLimitedRoute: (handler: any) => handler,
}));

describe('Lobby Join Route', () => {
  let mockLobby: any;
  let mockSession: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock lobby data
    mockLobby = {
      id: 'TEST123',
      code: 'TEST123',
      hostId: 'player1',
      players: [
        { id: 'player1', name: 'Host', avatar: '🎮', score: 0, isHost: true },
        { id: 'player2', name: 'Player 2', avatar: '🎯', score: 0, isHost: false },
      ],
      gameState: 'waiting',
      maxPlayers: 6,
      createdAt: Date.now(),
    };
    
    // Mock session data
    mockSession = {
      session: {
        id: 'session-123',
        playerId: 'player3',
        createdAt: Date.now(),
        lastActivity: Date.now(),
      },
      token: 'session-123',
      isNew: false,
    };
    
    // Default mocks
    (SessionManager.getOrCreateSession as jest.Mock).mockResolvedValue(mockSession);
    (joinLobby as jest.Mock).mockResolvedValue(mockLobby);
    (setex as jest.Mock).mockResolvedValue('OK');
    (broadcastToLobby as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Input Validation', () => {
    it('should return 400 if lobbyId is missing', async () => {
      const request = new NextRequest('http://localhost/api/lobby/join', {
        method: 'POST',
        body: JSON.stringify({ nickname: 'Bob' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Lobby ID and nickname are required');
    });

    it('should return 400 if nickname is missing', async () => {
      const request = new NextRequest('http://localhost/api/lobby/join', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Lobby ID and nickname are required');
    });

    it('should return 400 if nickname is empty string', async () => {
      const request = new NextRequest('http://localhost/api/lobby/join', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', nickname: '   ' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Lobby ID and nickname are required');
    });

    it('should trim whitespace from nickname', async () => {
      const request = new NextRequest('http://localhost/api/lobby/join', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'test123', nickname: '  Bob  ' }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(joinLobby).toHaveBeenCalledWith('TEST123', 'player3', 'Bob');
    });
  });

  describe('Successful Join', () => {
    it('should join lobby successfully with existing session', async () => {
      const request = new NextRequest('http://localhost/api/lobby/join', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'test123', nickname: 'Bob' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.lobby).toEqual(mockLobby);
      expect(data.playerId).toBe('player3');
      expect(data.sessionToken).toBeUndefined(); // Not included for existing session
    });

    it('should join lobby successfully with new session', async () => {
      mockSession.isNew = true;
      (SessionManager.getOrCreateSession as jest.Mock).mockResolvedValue(mockSession);
      
      const request = new NextRequest('http://localhost/api/lobby/join', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'test123', nickname: 'Bob' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.sessionToken).toBe('session-123'); // Included for new session
    });

    it('should handle case-insensitive lobby IDs', async () => {
      const request = new NextRequest('http://localhost/api/lobby/join', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'test123', nickname: 'Bob' }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(joinLobby).toHaveBeenCalledWith('TEST123', 'player3', 'Bob');
    });

    it('should set up player heartbeat and join time', async () => {
      const request = new NextRequest('http://localhost/api/lobby/join', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', nickname: 'Bob' }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(setex).toHaveBeenCalledWith(
        'player:TEST123:player3:heartbeat',
        10,
        expect.any(String)
      );
      expect(setex).toHaveBeenCalledWith(
        'player:TEST123:player3:joinTime',
        60,
        expect.any(String)
      );
    });

    it('should broadcast player joined event', async () => {
      const request = new NextRequest('http://localhost/api/lobby/join', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', nickname: 'Bob' }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(broadcastToLobby).toHaveBeenCalledWith(
        'TEST123',
        SSE_EVENTS.PLAYER_JOINED,
        {
          lobby: mockLobby,
          playerId: 'player3',
        }
      );
    });
  });

  describe('Error Handling', () => {
    it('should return 404 if lobby not found', async () => {
      (joinLobby as jest.Mock).mockResolvedValue(null);
      
      const request = new NextRequest('http://localhost/api/lobby/join', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'NONEXISTENT', nickname: 'Bob' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Lobby not found or game already started');
    });

    it('should return 500 on session creation error', async () => {
      (SessionManager.getOrCreateSession as jest.Mock).mockRejectedValue(new Error('Session error'));
      
      const request = new NextRequest('http://localhost/api/lobby/join', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', nickname: 'Bob' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to join lobby');
    });

    it('should return 500 on join lobby error', async () => {
      (joinLobby as jest.Mock).mockRejectedValue(new Error('Join error'));
      
      const request = new NextRequest('http://localhost/api/lobby/join', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', nickname: 'Bob' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to join lobby');
    });

    it('should handle Redis errors gracefully', async () => {
      (setex as jest.Mock).mockRejectedValue(new Error('Redis error'));
      
      const request = new NextRequest('http://localhost/api/lobby/join', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', nickname: 'Bob' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to join lobby');
    });

    it('should handle malformed JSON gracefully', async () => {
      const request = new NextRequest('http://localhost/api/lobby/join', {
        method: 'POST',
        body: '{ invalid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to join lobby');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty lobby ID after trimming', async () => {
      const request = new NextRequest('http://localhost/api/lobby/join', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: '', nickname: 'Bob' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Lobby ID and nickname are required');
    });

    it('should handle very long nickname', async () => {
      const longNickname = 'A'.repeat(1000);
      const request = new NextRequest('http://localhost/api/lobby/join', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', nickname: longNickname }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(joinLobby).toHaveBeenCalledWith('TEST123', 'player3', longNickname);
    });

    it('should handle special characters in lobby ID', async () => {
      const request = new NextRequest('http://localhost/api/lobby/join', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'test-123_special', nickname: 'Bob' }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(joinLobby).toHaveBeenCalledWith('TEST-123_SPECIAL', 'player3', 'Bob');
    });

    it('should handle special characters in nickname', async () => {
      const specialNickname = 'Bob 🎮 (Player)';
      const request = new NextRequest('http://localhost/api/lobby/join', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', nickname: specialNickname }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(joinLobby).toHaveBeenCalledWith('TEST123', 'player3', specialNickname);
    });
  });
});