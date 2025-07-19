import { POST } from '@/app/api/lobby/rejoin/route';
import { NextRequest } from 'next/server';
import { getLobby } from '@/app/lib/game-state-async';
import { SessionManager } from '@/app/lib/player-session';
import { setex } from '@/app/lib/upstash-redis';

// Mock dependencies
jest.mock('@/app/lib/game-state-async');
jest.mock('@/app/lib/player-session');
jest.mock('@/app/lib/upstash-redis');

describe('Lobby Rejoin Route', () => {
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
        { id: 'player1', name: 'Host', avatar: '🎮', score: 100, isHost: true },
        { id: 'player2', name: 'Player 2', avatar: '🎯', score: 50, isHost: false },
        { id: 'player3', name: 'Player 3', avatar: '🚀', score: 75, isHost: false },
      ],
      gameState: 'playing',
      currentRound: 2,
      maxPlayers: 6,
      createdAt: Date.now(),
    };
    
    // Mock session data
    mockSession = {
      session: {
        id: 'session-123',
        playerId: 'player2',
        createdAt: Date.now(),
        lastActivity: Date.now(),
      },
      token: 'session-123',
    };
    
    // Default mocks
    (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(mockSession);
    (getLobby as jest.Mock).mockResolvedValue(mockLobby);
    (setex as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Successful Rejoin', () => {
    it('should rejoin lobby successfully', async () => {
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.lobby).toEqual(mockLobby);
      expect(data.playerId).toBe('player2');
      expect(data.player).toEqual({
        id: 'player2',
        name: 'Player 2',
        avatar: '🎯',
        score: 50,
        isHost: false,
      });
    });

    it('should handle case-insensitive lobby IDs', async () => {
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'test123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(getLobby).toHaveBeenCalledWith('TEST123');
    });

    it('should rejoin with host player', async () => {
      mockSession.session.playerId = 'player1';
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(mockSession);
      
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.playerId).toBe('player1');
      expect(data.player.isHost).toBe(true);
    });

    it('should return full player data including score', async () => {
      mockLobby.players[1].score = 150;
      mockLobby.players[1].roundScores = [50, 100];
      
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      const data = await response.json();
      expect(data.player.score).toBe(150);
      expect(data.player.roundScores).toEqual([50, 100]);
    });
  });

  describe('Input Validation', () => {
    it('should return 400 if lobbyId is missing', async () => {
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Lobby ID is required');
    });

    it('should return 400 if lobbyId is null', async () => {
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
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
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
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
      
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('No valid session');
    });

    it('should not call getLobby if no session', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(null);
      
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(getLobby).not.toHaveBeenCalled();
    });
  });

  describe('Error Cases', () => {
    it('should return 404 if lobby not found', async () => {
      (getLobby as jest.Mock).mockResolvedValue(null);
      
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'NONEXISTENT' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Lobby not found');
    });

    it('should return 404 if player not found in lobby', async () => {
      mockSession.session.playerId = 'player999';
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(mockSession);
      
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Player not found in lobby');
    });

    it('should return 500 on session retrieval error', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockRejectedValue(new Error('Session error'));
      
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to rejoin lobby');
    });

    it('should return 500 on lobby retrieval error', async () => {
      (getLobby as jest.Mock).mockRejectedValue(new Error('Lobby error'));
      
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to rejoin lobby');
    });

    it('should handle malformed JSON gracefully', async () => {
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
        method: 'POST',
        body: '{ invalid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to rejoin lobby');
    });
  });

  describe('Edge Cases', () => {
    it('should handle lobby with only one player', async () => {
      mockLobby.players = [{ id: 'player2', name: 'Solo Player', avatar: '🎯', score: 0, isHost: true }];
      
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.player.isHost).toBe(true);
    });

    it('should handle player with special characters in name', async () => {
      mockLobby.players[1].name = 'Player 🎮 (Rejoined)';
      
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      const data = await response.json();
      expect(data.player.name).toBe('Player 🎮 (Rejoined)');
    });

    it('should handle lobby in different game states', async () => {
      mockLobby.gameState = 'finished';
      
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.lobby.gameState).toBe('finished');
    });

    it('should handle player with zero score', async () => {
      mockLobby.players[1].score = 0;
      
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      const data = await response.json();
      expect(data.player.score).toBe(0);
    });

    it('should handle very long lobby ID', async () => {
      const longLobbyId = 'A'.repeat(100);
      
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: longLobbyId }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(getLobby).toHaveBeenCalledWith(longLobbyId.toUpperCase());
    });

    it('should handle special characters in lobby ID', async () => {
      const specialLobbyId = 'TEST-123_SPECIAL';
      
      const request = new NextRequest('http://localhost/api/lobby/rejoin', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: specialLobbyId }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(getLobby).toHaveBeenCalledWith('TEST-123_SPECIAL');
    });
  });
});