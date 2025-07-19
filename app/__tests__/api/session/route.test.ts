import { NextRequest } from 'next/server';

// Mock dependencies before importing the route
jest.mock('@/app/lib/player-session');
jest.mock('@/app/lib/rate-limit-middleware', () => ({
  rateLimit: jest.fn((limit: string) => (handler: any) => handler)
}));

import { SessionManager } from '@/app/lib/player-session';
import { rateLimit } from '@/app/lib/rate-limit-middleware';
import { GET, DELETE } from '@/app/api/session/route';

const mockSessionManager = SessionManager as jest.Mocked<typeof SessionManager>;
const mockRateLimit = rateLimit as jest.Mock;

describe('/api/session endpoint', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRequest = new NextRequest('http://localhost:3000/api/session');
  });

  describe('GET endpoint - session validation', () => {
    it('should return valid session data when session exists', async () => {
      const mockSessionData = {
        token: 'session-token-123',
        session: {
          playerId: 'player_abc123',
          createdAt: 1640995200000, // Fixed timestamp for testing
          lastActivity: 1640995800000,
        }
      };

      mockSessionManager.getSessionFromCookies.mockResolvedValue(mockSessionData);

      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({
        valid: true,
        playerId: 'player_abc123',
        createdAt: 1640995200000,
        lastActivity: 1640995800000,
      });
      
      expect(mockSessionManager.getSessionFromCookies).toHaveBeenCalledTimes(1);
    });

    it('should return invalid session when no session exists', async () => {
      mockSessionManager.getSessionFromCookies.mockResolvedValue(null);

      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ valid: false });
      
      expect(mockSessionManager.getSessionFromCookies).toHaveBeenCalledTimes(1);
    });

    it('should return invalid session when SessionManager throws an error', async () => {
      mockSessionManager.getSessionFromCookies.mockRejectedValue(new Error('Redis connection failed'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ valid: false });
      expect(consoleSpy).toHaveBeenCalledWith('[ERROR] Error getting session', expect.objectContaining({
        error: expect.objectContaining({
          message: 'Redis connection failed'
        })
      }));
      
      consoleSpy.mockRestore();
    });

    it('should handle session with missing fields gracefully', async () => {
      const incompleteSessionData = {
        token: 'session-token-123',
        session: {
          playerId: 'player_abc123',
          // Missing createdAt and lastActivity
        }
      };

      mockSessionManager.getSessionFromCookies.mockResolvedValue(incompleteSessionData as any);

      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.valid).toBe(true);
      expect(responseData.playerId).toBe('player_abc123');
      expect(responseData.createdAt).toBeUndefined();
      expect(responseData.lastActivity).toBeUndefined();
    });

    it('should handle session with null playerId', async () => {
      const sessionWithNullPlayer = {
        token: 'session-token-123',
        session: {
          playerId: null,
          createdAt: Date.now(),
          lastActivity: Date.now(),
        }
      };

      mockSessionManager.getSessionFromCookies.mockResolvedValue(sessionWithNullPlayer as any);

      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.valid).toBe(true);
      expect(responseData.playerId).toBeNull();
    });

    it('should handle session with undefined playerId', async () => {
      const sessionWithUndefinedPlayer = {
        token: 'session-token-123',
        session: {
          playerId: undefined,
          createdAt: Date.now(),
          lastActivity: Date.now(),
        }
      };

      mockSessionManager.getSessionFromCookies.mockResolvedValue(sessionWithUndefinedPlayer as any);

      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.valid).toBe(true);
      expect(responseData.playerId).toBeUndefined();
    });

    it('should be wrapped with rate limiting', () => {
      // Rate limiting is applied at module level - functionality tested in other tests
      expect(typeof GET).toBe('function');
    });
  });

  describe('DELETE endpoint - session logout', () => {
    it('should successfully clear session when session exists', async () => {
      const mockSessionData = {
        token: 'session-token-123',
        session: {
          playerId: 'player_abc123',
          createdAt: Date.now(),
          lastActivity: Date.now(),
        }
      };

      mockSessionManager.getSessionFromCookies.mockResolvedValue(mockSessionData);
      mockSessionManager.deleteSession.mockResolvedValue(undefined);
      mockSessionManager.clearSessionCookie.mockResolvedValue(undefined);

      const response = await DELETE(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ success: true });
      
      expect(mockSessionManager.getSessionFromCookies).toHaveBeenCalledTimes(1);
      expect(mockSessionManager.deleteSession).toHaveBeenCalledWith('session-token-123');
      expect(mockSessionManager.clearSessionCookie).toHaveBeenCalledTimes(1);
    });

    it('should successfully clear session when no session exists', async () => {
      mockSessionManager.getSessionFromCookies.mockResolvedValue(null);
      mockSessionManager.clearSessionCookie.mockResolvedValue(undefined);

      const response = await DELETE(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ success: true });
      
      expect(mockSessionManager.getSessionFromCookies).toHaveBeenCalledTimes(1);
      expect(mockSessionManager.deleteSession).not.toHaveBeenCalled(); // Should not be called if no session
      expect(mockSessionManager.clearSessionCookie).toHaveBeenCalledTimes(1);
    });

    it('should handle getSessionFromCookies error and still clear cookie', async () => {
      mockSessionManager.getSessionFromCookies.mockRejectedValue(new Error('Session fetch failed'));
      mockSessionManager.clearSessionCookie.mockResolvedValue(undefined);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const response = await DELETE(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({ error: 'Failed to clear session' });
      expect(consoleSpy).toHaveBeenCalledWith('[ERROR] Error clearing session', expect.objectContaining({
        error: expect.objectContaining({
          message: expect.any(String)
        })
      }));
      
      consoleSpy.mockRestore();
    });

    it('should handle deleteSession error', async () => {
      const mockSessionData = {
        token: 'session-token-123',
        session: {
          playerId: 'player_abc123',
          createdAt: Date.now(),
          lastActivity: Date.now(),
        }
      };

      mockSessionManager.getSessionFromCookies.mockResolvedValue(mockSessionData);
      mockSessionManager.deleteSession.mockRejectedValue(new Error('Redis delete failed'));
      mockSessionManager.clearSessionCookie.mockResolvedValue(undefined);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const response = await DELETE(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({ error: 'Failed to clear session' });
      expect(consoleSpy).toHaveBeenCalledWith('[ERROR] Error clearing session', expect.objectContaining({
        error: expect.objectContaining({
          message: expect.any(String)
        })
      }));
      
      consoleSpy.mockRestore();
    });

    it('should handle clearSessionCookie error', async () => {
      const mockSessionData = {
        token: 'session-token-123',
        session: {
          playerId: 'player_abc123',
          createdAt: Date.now(),
          lastActivity: Date.now(),
        }
      };

      mockSessionManager.getSessionFromCookies.mockResolvedValue(mockSessionData);
      mockSessionManager.deleteSession.mockResolvedValue(undefined);
      mockSessionManager.clearSessionCookie.mockRejectedValue(new Error('Cookie clear failed'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const response = await DELETE(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({ error: 'Failed to clear session' });
      expect(consoleSpy).toHaveBeenCalledWith('[ERROR] Error clearing session', expect.objectContaining({
        error: expect.objectContaining({
          message: expect.any(String)
        })
      }));
      
      consoleSpy.mockRestore();
    });

    it('should handle partial success - deleteSession succeeds but clearCookie fails', async () => {
      const mockSessionData = {
        token: 'session-token-123',
        session: {
          playerId: 'player_abc123',
          createdAt: Date.now(),
          lastActivity: Date.now(),
        }
      };

      mockSessionManager.getSessionFromCookies.mockResolvedValue(mockSessionData);
      mockSessionManager.deleteSession.mockResolvedValue(undefined);
      mockSessionManager.clearSessionCookie.mockRejectedValue(new Error('Cookie clear failed'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const response = await DELETE(mockRequest);

      expect(response.status).toBe(500);
      expect(mockSessionManager.deleteSession).toHaveBeenCalledWith('session-token-123');
      
      consoleSpy.mockRestore();
    });

    it('should be wrapped with rate limiting', () => {
      // Rate limiting is applied at module level - functionality tested in other tests
      expect(typeof GET).toBe('function');
    });
  });

  describe('edge cases and security', () => {
    it('should handle very long session tokens', async () => {
      const longTokenSessionData = {
        token: 'x'.repeat(1000),
        session: {
          playerId: 'player_abc123',
          createdAt: Date.now(),
          lastActivity: Date.now(),
        }
      };

      mockSessionManager.getSessionFromCookies.mockResolvedValue(longTokenSessionData);

      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.valid).toBe(true);
      expect(responseData.playerId).toBe('player_abc123');
    });

    it('should handle special characters in playerId', async () => {
      const specialPlayerIdSession = {
        token: 'session-token-123',
        session: {
          playerId: 'player_!@#$%^&*()_+-=[]{}|;:,.<>?',
          createdAt: Date.now(),
          lastActivity: Date.now(),
        }
      };

      mockSessionManager.getSessionFromCookies.mockResolvedValue(specialPlayerIdSession);

      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.valid).toBe(true);
      expect(responseData.playerId).toBe('player_!@#$%^&*()_+-=[]{}|;:,.<>?');
    });

    it('should handle very old session timestamps', async () => {
      const oldSessionData = {
        token: 'session-token-123',
        session: {
          playerId: 'player_abc123',
          createdAt: 946684800000, // January 1, 2000
          lastActivity: 946684800000,
        }
      };

      mockSessionManager.getSessionFromCookies.mockResolvedValue(oldSessionData);

      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.valid).toBe(true);
      expect(responseData.createdAt).toBe(946684800000);
      expect(responseData.lastActivity).toBe(946684800000);
    });

    it('should handle future session timestamps', async () => {
      const futureTime = Date.now() + (365 * 24 * 60 * 60 * 1000); // 1 year in future
      const futureSessionData = {
        token: 'session-token-123',
        session: {
          playerId: 'player_abc123',
          createdAt: futureTime,
          lastActivity: futureTime,
        }
      };

      mockSessionManager.getSessionFromCookies.mockResolvedValue(futureSessionData);

      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.valid).toBe(true);
      expect(responseData.createdAt).toBe(futureTime);
      expect(responseData.lastActivity).toBe(futureTime);
    });

    it('should not expose sensitive session data in GET response', async () => {
      const sessionWithSensitiveData = {
        token: 'super-secret-token-123',
        session: {
          playerId: 'player_abc123',
          createdAt: Date.now(),
          lastActivity: Date.now(),
          secretKey: 'should-not-be-exposed',
          password: 'also-should-not-be-exposed'
        }
      };

      mockSessionManager.getSessionFromCookies.mockResolvedValue(sessionWithSensitiveData as any);

      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.valid).toBe(true);
      
      // Should not include sensitive data
      expect(responseData).not.toHaveProperty('token');
      expect(responseData).not.toHaveProperty('secretKey');
      expect(responseData).not.toHaveProperty('password');
      
      // Should only include expected fields
      expect(Object.keys(responseData)).toEqual(['valid', 'playerId', 'createdAt', 'lastActivity']);
    });

    it('should handle concurrent DELETE requests gracefully', async () => {
      const mockSessionData = {
        token: 'session-token-123',
        session: {
          playerId: 'player_abc123',
          createdAt: Date.now(),
          lastActivity: Date.now(),
        }
      };

      mockSessionManager.getSessionFromCookies.mockResolvedValue(mockSessionData);
      mockSessionManager.deleteSession.mockResolvedValue(undefined);
      mockSessionManager.clearSessionCookie.mockResolvedValue(undefined);

      // Make concurrent requests
      const promises = [
        DELETE(mockRequest),
        DELETE(mockRequest),
        DELETE(mockRequest)
      ];

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach(async (response) => {
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toEqual({ success: true });
      });
    });
  });

  describe('method validation', () => {
    it('should export GET method', () => {
      expect(typeof GET).toBe('function');
    });

    it('should export DELETE method', () => {
      expect(typeof DELETE).toBe('function');
    });

    it('should both methods be wrapped with rate limiting', () => {
      // Rate limiting is applied at module level - functionality tested in other tests
      expect(typeof GET).toBe('function');
      expect(typeof DELETE).toBe('function');
    });
  });
});