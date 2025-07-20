import { cookies } from 'next/headers';
import { SessionManager, PlayerSession } from '@/app/lib/player-session';
import { getIoRedis } from '@/app/lib/ioredis-client';

// Mock dependencies
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

jest.mock('@/app/lib/ioredis-client');

describe('SessionManager', () => {
  let mockCookies: any;
  let mockRedis: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock cookies
    mockCookies = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    };
    (cookies as jest.Mock).mockReturnValue(mockCookies);
    
    // Mock Redis
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    };
    (getIoRedis as jest.Mock).mockReturnValue(mockRedis);
  });

  describe('generateSessionToken', () => {
    it('should generate a unique session token', () => {
      const token1 = SessionManager.generateSessionToken();
      const token2 = SessionManager.generateSessionToken();
      
      expect(token1).toBeTruthy();
      expect(token2).toBeTruthy();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThan(20);
    });
  });

  describe('generatePlayerId', () => {
    it('should generate a unique player ID with prefix', () => {
      const id1 = SessionManager.generatePlayerId();
      const id2 = SessionManager.generatePlayerId();
      
      expect(id1).toMatch(/^player_[a-f0-9]{32}$/);
      expect(id2).toMatch(/^player_[a-f0-9]{32}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('createSession', () => {
    it('should create a new session and save to Redis', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      
      const result = await SessionManager.createSession();
      
      expect(result.token).toBeTruthy();
      expect(result.session.playerId).toMatch(/^player_/);
      expect(result.session.id).toBe(result.token);
      expect(result.session.createdAt).toBeLessThanOrEqual(Date.now());
      expect(result.session.lastActivity).toBe(result.session.createdAt);
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `session:${result.token}`,
        86400, // 24 hours
        JSON.stringify(result.session)
      );
    });
  });

  describe('getSession', () => {
    it('should retrieve session from Redis', async () => {
      const mockSession: PlayerSession = {
        id: 'test-token',
        playerId: 'player_123',
        createdAt: Date.now() - 1000,
        lastActivity: Date.now() - 500,
      };
      
      mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));
      
      const result = await SessionManager.getSession('test-token');
      
      expect(result).toEqual(mockSession);
      expect(mockRedis.get).toHaveBeenCalledWith('session:test-token');
    });

    it('should return null for non-existent session', async () => {
      mockRedis.get.mockResolvedValue(null);
      
      const result = await SessionManager.getSession('invalid-token');
      
      expect(result).toBeNull();
    });
  });

  describe('validateSession', () => {
    it('should validate and update session last activity', async () => {
      const mockSession: PlayerSession = {
        id: 'test-token',
        playerId: 'player_123',
        createdAt: Date.now() - 1000,
        lastActivity: Date.now() - 500,
      };
      
      mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedis.setex.mockResolvedValue('OK');
      
      const result = await SessionManager.validateSession('test-token');
      
      expect(result).toBeTruthy();
      expect(result?.lastActivity).toBeGreaterThan(mockSession.lastActivity);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should return null for non-existent session', async () => {
      mockRedis.get.mockResolvedValue(null);
      
      const result = await SessionManager.validateSession('invalid-token');
      
      expect(result).toBeNull();
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });

  describe('deleteSession', () => {
    it('should delete session from Redis', async () => {
      mockRedis.del.mockResolvedValue(1);
      
      await SessionManager.deleteSession('test-token');
      
      expect(mockRedis.del).toHaveBeenCalledWith('session:test-token');
    });
  });

  describe('getSessionFromCookies', () => {
    it('should retrieve session using token from cookies', async () => {
      const mockSession: PlayerSession = {
        id: 'test-token',
        playerId: 'player_123',
        createdAt: Date.now() - 1000,
        lastActivity: Date.now() - 500,
      };
      
      mockCookies.get.mockReturnValue({ value: 'test-token' });
      mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedis.setex.mockResolvedValue('OK');
      
      const result = await SessionManager.getSessionFromCookies();
      
      expect(result).toBeTruthy();
      expect(result?.token).toBe('test-token');
      expect(result?.session.playerId).toBe('player_123');
      // The lastActivity will be updated by validateSession
      expect(result?.session.lastActivity).toBeGreaterThanOrEqual(mockSession.lastActivity);
      expect(mockCookies.get).toHaveBeenCalledWith('emoji-hunt-session');
    });

    it('should return null when no cookie exists', async () => {
      mockCookies.get.mockReturnValue(null);
      
      const result = await SessionManager.getSessionFromCookies();
      
      expect(result).toBeNull();
    });

    it('should return null when session not found in Redis', async () => {
      mockCookies.get.mockReturnValue({ value: 'test-token' });
      mockRedis.get.mockResolvedValue(null);
      
      const result = await SessionManager.getSessionFromCookies();
      
      expect(result).toBeNull();
    });
  });

  describe('getOrCreateSession', () => {
    it('should return existing session if valid', async () => {
      const mockSession: PlayerSession = {
        id: 'test-token',
        playerId: 'player_123',
        createdAt: Date.now() - 1000,
        lastActivity: Date.now() - 500,
      };
      
      mockCookies.get.mockReturnValue({ value: 'test-token' });
      mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedis.setex.mockResolvedValue('OK');
      
      const result = await SessionManager.getOrCreateSession();
      
      expect(result.session.playerId).toBe('player_123');
      expect(result.isNew).toBe(false);
      expect(result.token).toBe('test-token');
    });

    it('should create new session if none exists', async () => {
      mockCookies.get.mockReturnValue(null);
      mockRedis.setex.mockResolvedValue('OK');
      
      const result = await SessionManager.getOrCreateSession();
      
      expect(result.session.playerId).toMatch(/^player_/);
      expect(result.isNew).toBe(true);
      expect(result.token).toBeTruthy();
      
      expect(mockCookies.set).toHaveBeenCalledWith(
        'emoji-hunt-session',
        result.token,
        {
          httpOnly: true,
          secure: false, // NODE_ENV is not production in tests
          sameSite: 'lax',
          maxAge: 86400, // 24 hours
          path: '/',
        }
      );
    });
  });

  describe('setSessionCookie', () => {
    it('should set session cookie with correct options', async () => {
      await SessionManager.setSessionCookie('test-token');
      
      expect(mockCookies.set).toHaveBeenCalledWith(
        'emoji-hunt-session',
        'test-token',
        {
          httpOnly: true,
          secure: false, // NODE_ENV is not production in tests
          sameSite: 'lax',
          maxAge: 86400, // 24 hours
          path: '/',
        }
      );
    });
  });

  describe('clearSessionCookie', () => {
    it('should delete session cookie', async () => {
      await SessionManager.clearSessionCookie();
      
      expect(mockCookies.delete).toHaveBeenCalledWith('emoji-hunt-session');
    });
  });
});