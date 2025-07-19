import { POST } from '@/app/api/game/start/route';
import { NextRequest } from 'next/server';
import { startGame } from '@/app/lib/game-state-transitions';
import { SessionManager } from '@/app/lib/player-session';

// Mock dependencies
jest.mock('@/app/lib/game-state-transitions');
jest.mock('@/app/lib/player-session');
jest.mock('@/app/lib/rate-limit-middleware', () => ({
  rateLimit: () => (handler: any) => handler,
}));

describe('Game Start Route', () => {
  let mockSession: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock session data
    mockSession = {
      session: {
        id: 'session-123',
        playerId: 'player1',
        createdAt: Date.now(),
        lastActivity: Date.now(),
      },
      token: 'session-123',
    };
    
    // Default mocks
    (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(mockSession);
    (startGame as jest.Mock).mockResolvedValue(true);
  });

  describe('Successful Game Start', () => {
    it('should start game successfully when player is host', async () => {
      const request = new NextRequest('http://localhost/api/game/start', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(startGame).toHaveBeenCalledWith('TEST123', 'player1');
    });

    it('should handle different lobby IDs', async () => {
      const request = new NextRequest('http://localhost/api/game/start', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'ANOTHER-LOBBY' }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(startGame).toHaveBeenCalledWith('ANOTHER-LOBBY', 'player1');
    });

    it('should handle different player IDs', async () => {
      mockSession.session.playerId = 'different-player';
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(mockSession);
      
      const request = new NextRequest('http://localhost/api/game/start', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(startGame).toHaveBeenCalledWith('TEST123', 'different-player');
    });
  });

  describe('Input Validation', () => {
    it('should return 400 if lobbyId is missing', async () => {
      const request = new NextRequest('http://localhost/api/game/start', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Lobby ID is required');
      expect(startGame).not.toHaveBeenCalled();
    });

    it('should return 400 if lobbyId is null', async () => {
      const request = new NextRequest('http://localhost/api/game/start', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: null }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Lobby ID is required');
    });

    it('should return 400 if lobbyId is empty string', async () => {
      const request = new NextRequest('http://localhost/api/game/start', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: '' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Lobby ID is required');
    });
  });

  describe('Authentication', () => {
    it('should return 401 if no session exists', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(null);
      
      const request = new NextRequest('http://localhost/api/game/start', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('No valid session');
      expect(startGame).not.toHaveBeenCalled();
    });

    it('should not call startGame if no session', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(null);
      
      const request = new NextRequest('http://localhost/api/game/start', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(startGame).not.toHaveBeenCalled();
    });
  });

  describe('Authorization', () => {
    it('should return 403 if player is not host', async () => {
      (startGame as jest.Mock).mockResolvedValue(false);
      
      const request = new NextRequest('http://localhost/api/game/start', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Failed to start game. Are you the host?');
    });

    it('should still call startGame even if not host', async () => {
      (startGame as jest.Mock).mockResolvedValue(false);
      
      const request = new NextRequest('http://localhost/api/game/start', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(startGame).toHaveBeenCalledWith('TEST123', 'player1');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on session retrieval error', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockRejectedValue(new Error('Session error'));
      
      const request = new NextRequest('http://localhost/api/game/start', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to start game');
    });

    it('should return 500 on startGame error', async () => {
      (startGame as jest.Mock).mockRejectedValue(new Error('Start game error'));
      
      const request = new NextRequest('http://localhost/api/game/start', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to start game');
    });

    it('should handle malformed JSON gracefully', async () => {
      const request = new NextRequest('http://localhost/api/game/start', {
        method: 'POST',
        body: '{ invalid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to start game');
    });

    it('should handle missing request body', async () => {
      const request = new NextRequest('http://localhost/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to start game');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long lobby ID', async () => {
      const longLobbyId = 'A'.repeat(1000);
      const request = new NextRequest('http://localhost/api/game/start', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: longLobbyId }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(startGame).toHaveBeenCalledWith(longLobbyId, 'player1');
    });

    it('should handle special characters in lobby ID', async () => {
      const specialLobbyId = 'TEST-123_SPECIAL!@#';
      const request = new NextRequest('http://localhost/api/game/start', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: specialLobbyId }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(startGame).toHaveBeenCalledWith(specialLobbyId, 'player1');
    });

    it('should handle additional fields in request body', async () => {
      const request = new NextRequest('http://localhost/api/game/start', {
        method: 'POST',
        body: JSON.stringify({ 
          lobbyId: 'TEST123',
          extraField: 'ignored',
          anotherField: 42
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      expect(startGame).toHaveBeenCalledWith('TEST123', 'player1');
    });

    it('should handle concurrent start requests', async () => {
      const request1 = new NextRequest('http://localhost/api/game/start', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const request2 = new NextRequest('http://localhost/api/game/start', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const [response1, response2] = await Promise.all([
        POST(request1),
        POST(request2),
      ]);
      
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(startGame).toHaveBeenCalledTimes(2);
    });
  });
});