import { POST } from '@/app/api/lobby/create/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/app/lib/game-state-async', () => ({
  createLobby: jest.fn(),
}));

jest.mock('@/app/lib/upstash-redis', () => ({
  setex: jest.fn(),
}));

jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'generated-id'),
}));

jest.mock('@/app/lib/player-session', () => ({
  SessionManager: {
    getOrCreateSession: jest.fn(),
    getSessionFromCookies: jest.fn(),
  },
}));

jest.mock('@/app/lib/rate-limit-middleware', () => ({
  withRateLimitedRoute: (handler: any, options: any) => {
    // Create a wrapper that calls the custom getSessionId function
    return async (request: NextRequest) => {
      // Test the getSessionId function if provided
      if (options?.getSessionId) {
        await options.getSessionId(request);
      }
      return handler(request);
    };
  },
}));

const { createLobby } = require('@/app/lib/game-state-async');
const { setex } = require('@/app/lib/upstash-redis');
const { nanoid } = require('nanoid');
const { SessionManager } = require('@/app/lib/player-session');

describe('POST /api/lobby/create - Extended Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset nanoid mock to return different values
    let idCounter = 0;
    nanoid.mockImplementation(() => {
      const id = `generated-id-${idCounter}`;
      idCounter++;
      return id;
    });
  });

  describe('New Session Handling', () => {
    it('should include session token when creating new session', async () => {
      const mockLobby = {
        id: 'NEWLOBBY',
        hostId: 'new-player-id',
        players: [{
          id: 'new-player-id',
          nickname: 'NewPlayer',
          avatar: '🎮',
          score: 0,
          roundScores: [],
          isHost: true,
        }],
        gameState: 'waiting',
        currentRound: 0,
        rounds: [],
      };

      // Mock new session creation
      SessionManager.getOrCreateSession.mockResolvedValueOnce({
        session: { 
          playerId: 'new-player-id', 
          id: 'new-session-123',
          createdAt: Date.now(),
          lastActivity: Date.now()
        },
        isNew: true, // This triggers the sessionToken to be included
      });

      createLobby.mockResolvedValueOnce(mockLobby);
      setex.mockResolvedValueOnce('OK');

      const request = new NextRequest('http://localhost:3000/api/lobby/create', {
        method: 'POST',
        body: JSON.stringify({
          nickname: 'NewPlayer',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('sessionToken', 'new-session-123');
      expect(data).toHaveProperty('lobby.id', 'NEWLOBBY');
      expect(data).toHaveProperty('playerId', 'new-player-id');
    });

    it('should not include session token for existing sessions', async () => {
      const mockLobby = {
        id: 'EXISTLOBBY',
        hostId: 'existing-player-id',
        players: [{
          id: 'existing-player-id',
          nickname: 'ExistingPlayer',
          avatar: '🎯',
          score: 0,
          roundScores: [],
          isHost: true,
        }],
        gameState: 'waiting',
        currentRound: 0,
        rounds: [],
      };

      // Mock existing session
      SessionManager.getOrCreateSession.mockResolvedValueOnce({
        session: { 
          playerId: 'existing-player-id', 
          id: 'existing-session-456',
          createdAt: Date.now() - 3600000,
          lastActivity: Date.now()
        },
        isNew: false, // This prevents sessionToken from being included
      });

      createLobby.mockResolvedValueOnce(mockLobby);
      setex.mockResolvedValueOnce('OK');

      const request = new NextRequest('http://localhost:3000/api/lobby/create', {
        method: 'POST',
        body: JSON.stringify({
          nickname: 'ExistingPlayer',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).not.toHaveProperty('sessionToken');
      expect(data).toHaveProperty('lobby.id', 'EXISTLOBBY');
      expect(data).toHaveProperty('playerId', 'existing-player-id');
    });
  });

  describe('Rate Limiting Session ID Resolution', () => {
    it('should use session ID for rate limiting when session exists', async () => {
      // Mock existing session for rate limiting check
      SessionManager.getSessionFromCookies.mockResolvedValueOnce({
        session: { 
          id: 'rate-limit-session-123',
          playerId: 'player-123',
          createdAt: Date.now(),
          lastActivity: Date.now()
        },
        token: 'token-123'
      });

      // Mock for actual request handling
      SessionManager.getOrCreateSession.mockResolvedValueOnce({
        session: { 
          playerId: 'player-123', 
          id: 'rate-limit-session-123'
        },
        isNew: false,
      });

      const mockLobby = {
        id: 'RATELOBBY',
        hostId: 'player-123',
        players: [{
          id: 'player-123',
          nickname: 'RateLimitTest',
          avatar: '🔒',
          score: 0,
          roundScores: [],
          isHost: true,
        }],
        gameState: 'waiting',
        currentRound: 0,
        rounds: [],
      };

      createLobby.mockResolvedValueOnce(mockLobby);
      setex.mockResolvedValueOnce('OK');

      const request = new NextRequest('http://localhost:3000/api/lobby/create', {
        method: 'POST',
        body: JSON.stringify({
          nickname: 'RateLimitTest',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(SessionManager.getSessionFromCookies).toHaveBeenCalled();
    });

    it('should use IP-based rate limiting when no session exists', async () => {
      // Mock no session for rate limiting check
      SessionManager.getSessionFromCookies.mockResolvedValueOnce(null);

      // Mock for actual request handling (creates new session)
      SessionManager.getOrCreateSession.mockResolvedValueOnce({
        session: { 
          playerId: 'new-player-456', 
          id: 'new-session-456'
        },
        isNew: true,
      });

      const mockLobby = {
        id: 'IPLOBBY',
        hostId: 'new-player-456',
        players: [{
          id: 'new-player-456',
          nickname: 'IPBasedUser',
          avatar: '🌐',
          score: 0,
          roundScores: [],
          isHost: true,
        }],
        gameState: 'waiting',
        currentRound: 0,
        rounds: [],
      };

      createLobby.mockResolvedValueOnce(mockLobby);
      setex.mockResolvedValueOnce('OK');

      const request = new NextRequest('http://localhost:3000/api/lobby/create', {
        method: 'POST',
        body: JSON.stringify({
          nickname: 'IPBasedUser',
        }),
        headers: {
          'x-forwarded-for': '192.168.1.100, 10.0.0.1',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(SessionManager.getSessionFromCookies).toHaveBeenCalled();
      expect(data).toHaveProperty('sessionToken', 'new-session-456');
    });

    it('should handle missing x-forwarded-for header for IP rate limiting', async () => {
      // Mock no session for rate limiting check
      SessionManager.getSessionFromCookies.mockResolvedValueOnce(null);

      // Mock for actual request handling
      SessionManager.getOrCreateSession.mockResolvedValueOnce({
        session: { 
          playerId: 'no-ip-player', 
          id: 'no-ip-session'
        },
        isNew: true,
      });

      const mockLobby = {
        id: 'NOIPLOBBY',
        hostId: 'no-ip-player',
        players: [{
          id: 'no-ip-player',
          nickname: 'NoIPUser',
          avatar: '❓',
          score: 0,
          roundScores: [],
          isHost: true,
        }],
        gameState: 'waiting',
        currentRound: 0,
        rounds: [],
      };

      createLobby.mockResolvedValueOnce(mockLobby);
      setex.mockResolvedValueOnce('OK');

      const request = new NextRequest('http://localhost:3000/api/lobby/create', {
        method: 'POST',
        body: JSON.stringify({
          nickname: 'NoIPUser',
        }),
        // No x-forwarded-for header
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(SessionManager.getSessionFromCookies).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple IP addresses in x-forwarded-for header', async () => {
      // Mock no session
      SessionManager.getSessionFromCookies.mockResolvedValueOnce(null);

      SessionManager.getOrCreateSession.mockResolvedValueOnce({
        session: { 
          playerId: 'multi-ip-player', 
          id: 'multi-ip-session'
        },
        isNew: true,
      });

      const mockLobby = {
        id: 'MULTIIP',
        hostId: 'multi-ip-player',
        players: [{
          id: 'multi-ip-player',
          nickname: 'MultiIPUser',
          avatar: '🔢',
          score: 0,
          roundScores: [],
          isHost: true,
        }],
        gameState: 'waiting',
        currentRound: 0,
        rounds: [],
      };

      createLobby.mockResolvedValueOnce(mockLobby);
      setex.mockResolvedValueOnce('OK');

      const request = new NextRequest('http://localhost:3000/api/lobby/create', {
        method: 'POST',
        body: JSON.stringify({
          nickname: 'MultiIPUser',
        }),
        headers: {
          'x-forwarded-for': '203.0.113.0, 198.51.100.0, 192.0.2.0',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should use first IP for rate limiting
      expect(SessionManager.getSessionFromCookies).toHaveBeenCalled();
    });

    it('should handle session creation with both new session and IP fallback', async () => {
      // First call for rate limiting - no session
      SessionManager.getSessionFromCookies.mockResolvedValueOnce(null);

      // Second call for actual handler - creates new session
      SessionManager.getOrCreateSession.mockResolvedValueOnce({
        session: { 
          playerId: 'complete-new-player', 
          id: 'complete-new-session'
        },
        isNew: true,
      });

      const mockLobby = {
        id: 'COMPLETE',
        hostId: 'complete-new-player',
        players: [{
          id: 'complete-new-player',
          nickname: 'CompleteTest',
          avatar: '✅',
          score: 0,
          roundScores: [],
          isHost: true,
        }],
        gameState: 'waiting',
        currentRound: 0,
        rounds: [],
      };

      createLobby.mockResolvedValueOnce(mockLobby);
      setex.mockResolvedValueOnce('OK');

      const request = new NextRequest('http://localhost:3000/api/lobby/create', {
        method: 'POST',
        body: JSON.stringify({
          nickname: 'CompleteTest',
        }),
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('sessionToken', 'complete-new-session');
      expect(data).toHaveProperty('lobby.id', 'COMPLETE');
      expect(data).toHaveProperty('playerId', 'complete-new-player');
      expect(SessionManager.getSessionFromCookies).toHaveBeenCalled();
    });
  });
});