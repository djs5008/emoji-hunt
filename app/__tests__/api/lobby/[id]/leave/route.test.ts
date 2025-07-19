import { POST } from '@/app/api/lobby/[id]/leave/route';
import { NextRequest } from 'next/server';
import { del } from '@/app/lib/upstash-redis';
import { checkDisconnectedPlayers } from '@/app/lib/player-heartbeat';
import { SessionManager } from '@/app/lib/player-session';

// Mock dependencies
jest.mock('@/app/lib/upstash-redis');
jest.mock('@/app/lib/player-heartbeat');
jest.mock('@/app/lib/player-session');
jest.mock('@/app/lib/rate-limit-middleware', () => ({
  rateLimit: () => (handler: any) => handler,
}));

describe('Lobby Leave Route', () => {
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
    (del as jest.Mock).mockResolvedValue(1);
    (checkDisconnectedPlayers as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Successful Leave', () => {
    it('should leave lobby successfully with no body', async () => {
      const request = new NextRequest('http://localhost/api/lobby/TEST123/leave', {
        method: 'POST',
      });

      const response = await POST(request, { params: { id: 'TEST123' } });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should leave lobby successfully with explicit flag', async () => {
      const request = new NextRequest('http://localhost/api/lobby/TEST123/leave', {
        method: 'POST',
        body: JSON.stringify({ explicit: true }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, { params: { id: 'TEST123' } });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should remove player heartbeat and join time', async () => {
      const request = new NextRequest('http://localhost/api/lobby/TEST123/leave', {
        method: 'POST',
      });

      await POST(request, { params: { id: 'TEST123' } });
      
      expect(del).toHaveBeenCalledWith([
        'player:TEST123:player1:heartbeat',
        'player:TEST123:player1:joinTime'
      ]);
    });

    it('should trigger disconnected player cleanup', async () => {
      const request = new NextRequest('http://localhost/api/lobby/TEST123/leave', {
        method: 'POST',
      });

      await POST(request, { params: { id: 'TEST123' } });
      
      expect(checkDisconnectedPlayers).toHaveBeenCalledWith('TEST123', 'player1');
    });

    it('should handle different lobby IDs', async () => {
      const request = new NextRequest('http://localhost/api/lobby/ANOTHER/leave', {
        method: 'POST',
      });

      await POST(request, { params: { id: 'ANOTHER' } });
      
      expect(del).toHaveBeenCalledWith([
        'player:ANOTHER:player1:heartbeat',
        'player:ANOTHER:player1:joinTime'
      ]);
      expect(checkDisconnectedPlayers).toHaveBeenCalledWith('ANOTHER', 'player1');
    });
  });

  describe('Request Body Handling', () => {
    it('should handle explicit leave request', async () => {
      const request = new NextRequest('http://localhost/api/lobby/TEST123/leave', {
        method: 'POST',
        body: JSON.stringify({ explicit: true }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, { params: { id: 'TEST123' } });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should handle non-explicit leave request', async () => {
      const request = new NextRequest('http://localhost/api/lobby/TEST123/leave', {
        method: 'POST',
        body: JSON.stringify({ explicit: false }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, { params: { id: 'TEST123' } });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should handle malformed JSON body gracefully', async () => {
      const request = new NextRequest('http://localhost/api/lobby/TEST123/leave', {
        method: 'POST',
        body: '{ invalid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, { params: { id: 'TEST123' } });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should handle non-JSON content type', async () => {
      const request = new NextRequest('http://localhost/api/lobby/TEST123/leave', {
        method: 'POST',
        body: 'plain text',
        headers: { 'Content-Type': 'text/plain' },
      });

      const response = await POST(request, { params: { id: 'TEST123' } });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should handle missing content type', async () => {
      const request = new NextRequest('http://localhost/api/lobby/TEST123/leave', {
        method: 'POST',
        body: JSON.stringify({ explicit: true }),
      });

      const response = await POST(request, { params: { id: 'TEST123' } });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should return 401 if no session exists', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(null);
      
      const request = new NextRequest('http://localhost/api/lobby/TEST123/leave', {
        method: 'POST',
      });

      const response = await POST(request, { params: { id: 'TEST123' } });
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('No valid session');
    });

    it('should not call cleanup if no session', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(null);
      
      const request = new NextRequest('http://localhost/api/lobby/TEST123/leave', {
        method: 'POST',
      });

      await POST(request, { params: { id: 'TEST123' } });
      
      expect(del).not.toHaveBeenCalled();
      expect(checkDisconnectedPlayers).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on session retrieval error', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockRejectedValue(new Error('Session error'));
      
      const request = new NextRequest('http://localhost/api/lobby/TEST123/leave', {
        method: 'POST',
      });

      const response = await POST(request, { params: { id: 'TEST123' } });
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to leave');
    });

    it('should return 500 on Redis delete error', async () => {
      (del as jest.Mock).mockRejectedValue(new Error('Redis error'));
      
      const request = new NextRequest('http://localhost/api/lobby/TEST123/leave', {
        method: 'POST',
      });

      const response = await POST(request, { params: { id: 'TEST123' } });
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to leave');
    });

    it('should return 500 on cleanup error', async () => {
      (checkDisconnectedPlayers as jest.Mock).mockRejectedValue(new Error('Cleanup error'));
      
      const request = new NextRequest('http://localhost/api/lobby/TEST123/leave', {
        method: 'POST',
      });

      const response = await POST(request, { params: { id: 'TEST123' } });
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to leave');
    });

    it('should handle partial Redis delete failure', async () => {
      (del as jest.Mock).mockResolvedValue(0); // No keys deleted
      
      const request = new NextRequest('http://localhost/api/lobby/TEST123/leave', {
        method: 'POST',
      });

      const response = await POST(request, { params: { id: 'TEST123' } });
      
      // Should still succeed even if Redis keys didn't exist
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in lobby ID', async () => {
      const request = new NextRequest('http://localhost/api/lobby/TEST-123_SPECIAL/leave', {
        method: 'POST',
      });

      await POST(request, { params: { id: 'TEST-123_SPECIAL' } });
      
      expect(del).toHaveBeenCalledWith([
        'player:TEST-123_SPECIAL:player1:heartbeat',
        'player:TEST-123_SPECIAL:player1:joinTime'
      ]);
    });

    it('should handle empty lobby ID', async () => {
      const request = new NextRequest('http://localhost/api/lobby//leave', {
        method: 'POST',
      });

      await POST(request, { params: { id: '' } });
      
      expect(del).toHaveBeenCalledWith([
        'player::player1:heartbeat',
        'player::player1:joinTime'
      ]);
    });

    it('should handle concurrent leave requests', async () => {
      const request1 = new NextRequest('http://localhost/api/lobby/TEST123/leave', {
        method: 'POST',
      });
      const request2 = new NextRequest('http://localhost/api/lobby/TEST123/leave', {
        method: 'POST',
      });

      const [response1, response2] = await Promise.all([
        POST(request1, { params: { id: 'TEST123' } }),
        POST(request2, { params: { id: 'TEST123' } }),
      ]);
      
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      // Both should succeed, even if only one actually removes the keys
      const data1 = await response1.json();
      const data2 = await response2.json();
      expect(data1.success).toBe(true);
      expect(data2.success).toBe(true);
    });
  });
});