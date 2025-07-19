import { POST } from '@/app/api/game/click/route';
import { NextRequest } from 'next/server';
import { handleEmojiClick } from '@/app/lib/game-engine';
import { SessionManager } from '@/app/lib/player-session';

// Mock dependencies
jest.mock('@/app/lib/game-engine');
jest.mock('@/app/lib/player-session');
jest.mock('@/app/lib/rate-limit-middleware', () => ({
  withRateLimitedRoute: (handler: any) => handler,
}));

describe('Game Click Route', () => {
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
    (handleEmojiClick as jest.Mock).mockResolvedValue({ found: true, points: 100 });
  });

  describe('Successful Emoji Click', () => {
    it('should handle correct emoji click', async () => {
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', emojiId: 'emoji_42' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.found).toBe(true);
      expect(data.points).toBe(100);
      expect(handleEmojiClick).toHaveBeenCalledWith('TEST123', 'player1', 'emoji_42');
    });

    it('should handle incorrect emoji click', async () => {
      (handleEmojiClick as jest.Mock).mockResolvedValue({ found: false, points: 0 });
      
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', emojiId: 'emoji_wrong' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.found).toBe(false);
      expect(data.points).toBe(0);
    });

    it('should handle empty click (no emoji clicked)', async () => {
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.found).toBe(false);
      expect(data.points).toBe(0);
      expect(handleEmojiClick).not.toHaveBeenCalled();
    });

    it('should handle null emojiId', async () => {
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', emojiId: null }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.found).toBe(false);
      expect(data.points).toBe(0);
      expect(handleEmojiClick).not.toHaveBeenCalled();
    });

    it('should handle empty string emojiId', async () => {
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', emojiId: '' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.found).toBe(false);
      expect(data.points).toBe(0);
      expect(handleEmojiClick).not.toHaveBeenCalled();
    });
  });

  describe('Different Game Results', () => {
    it('should handle partial points', async () => {
      (handleEmojiClick as jest.Mock).mockResolvedValue({ found: true, points: 50 });
      
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', emojiId: 'emoji_42' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      const data = await response.json();
      expect(data.points).toBe(50);
    });

    it('should handle additional result data', async () => {
      (handleEmojiClick as jest.Mock).mockResolvedValue({ 
        found: true, 
        points: 100,
        bonus: 25,
        streak: 3,
        totalScore: 275
      });
      
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', emojiId: 'emoji_42' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      const data = await response.json();
      expect(data.bonus).toBe(25);
      expect(data.streak).toBe(3);
      expect(data.totalScore).toBe(275);
    });

    it('should handle zero points correctly', async () => {
      (handleEmojiClick as jest.Mock).mockResolvedValue({ found: false, points: 0 });
      
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', emojiId: 'emoji_wrong' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      const data = await response.json();
      expect(data.found).toBe(false);
      expect(data.points).toBe(0);
    });
  });

  describe('Input Validation', () => {
    it('should return 400 if lobbyId is missing', async () => {
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ emojiId: 'emoji_42' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Lobby ID is required');
      expect(handleEmojiClick).not.toHaveBeenCalled();
    });

    it('should return 400 if lobbyId is null', async () => {
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: null, emojiId: 'emoji_42' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Lobby ID is required');
    });

    it('should return 400 if lobbyId is empty string', async () => {
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: '', emojiId: 'emoji_42' }),
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
      
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', emojiId: 'emoji_42' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('No valid session');
      expect(handleEmojiClick).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on session retrieval error', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockRejectedValue(new Error('Session error'));
      
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', emojiId: 'emoji_42' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to process click');
    });

    it('should return 500 on game engine error', async () => {
      (handleEmojiClick as jest.Mock).mockRejectedValue(new Error('Game engine error'));
      
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', emojiId: 'emoji_42' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to process click');
    });

    it('should handle malformed JSON gracefully', async () => {
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: '{ invalid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to process click');
    });

    it('should handle missing request body', async () => {
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to process click');
    });
  });

  describe('Edge Cases', () => {
    it('should handle different player IDs', async () => {
      mockSession.session.playerId = 'different-player';
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(mockSession);
      
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', emojiId: 'emoji_42' }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(handleEmojiClick).toHaveBeenCalledWith('TEST123', 'different-player', 'emoji_42');
    });

    it('should handle special characters in emoji ID', async () => {
      const specialEmojiId = 'emoji_special-123!@#';
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', emojiId: specialEmojiId }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(handleEmojiClick).toHaveBeenCalledWith('TEST123', 'player1', specialEmojiId);
    });

    it('should handle very long emoji ID', async () => {
      const longEmojiId = 'emoji_' + 'A'.repeat(1000);
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', emojiId: longEmojiId }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(handleEmojiClick).toHaveBeenCalledWith('TEST123', 'player1', longEmojiId);
    });

    it('should handle rapid consecutive clicks', async () => {
      const request1 = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', emojiId: 'emoji_1' }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const request2 = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'TEST123', emojiId: 'emoji_2' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const [response1, response2] = await Promise.all([
        POST(request1),
        POST(request2),
      ]);
      
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(handleEmojiClick).toHaveBeenCalledTimes(2);
    });

    it('should handle additional fields in request body', async () => {
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ 
          lobbyId: 'TEST123',
          emojiId: 'emoji_42',
          extraField: 'ignored',
          timestamp: Date.now()
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      expect(handleEmojiClick).toHaveBeenCalledWith('TEST123', 'player1', 'emoji_42');
    });

    it('should handle different lobby IDs', async () => {
      const request = new NextRequest('http://localhost/api/game/click', {
        method: 'POST',
        body: JSON.stringify({ lobbyId: 'ANOTHER-LOBBY', emojiId: 'emoji_42' }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);
      
      expect(handleEmojiClick).toHaveBeenCalledWith('ANOTHER-LOBBY', 'player1', 'emoji_42');
    });
  });
});