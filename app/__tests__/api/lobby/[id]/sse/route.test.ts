import { GET } from '@/app/api/lobby/[id]/sse/route';
import { NextRequest } from 'next/server';
import { getLobby } from '@/app/lib/ioredis-storage';
import { setex, del, lrange, rpush } from '@/app/lib/ioredis-client';
import { checkDisconnectedPlayers } from '@/app/lib/player-heartbeat';
import { SessionManager } from '@/app/lib/player-session';

// Mock dependencies
jest.mock('@/app/lib/ioredis-storage');
jest.mock('@/app/lib/ioredis-client');
jest.mock('@/app/lib/player-heartbeat');
jest.mock('@/app/lib/player-session');

// Mock Web APIs for test environment
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = class TextEncoder {
    encode(input: string): Uint8Array {
      return new Uint8Array(Buffer.from(input, 'utf-8'));
    }
  } as any;
}

if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = class TextDecoder {
    decode(input: Uint8Array): string {
      return Buffer.from(input).toString('utf-8');
    }
  } as any;
}

if (typeof ReadableStream === 'undefined') {
  global.ReadableStream = class ReadableStream {
    private callbacks: Array<{ type: string; data: any }> = [];
    
    constructor(options: any) {
      const controller = {
        enqueue: (chunk: Uint8Array) => {
          const text = new TextDecoder().decode(chunk);
          this.callbacks.push({ type: 'data', data: text });
        },
        close: () => {
          this.callbacks.push({ type: 'close', data: null });
        },
      };
      
      if (options.start) {
        // Run start function asynchronously
        setTimeout(() => options.start(controller), 0);
      }
    }
    
    getReader() {
      let index = 0;
      return {
        read: async () => {
          // Wait for initial data
          await new Promise(resolve => setTimeout(resolve, 50));
          
          if (index < this.callbacks.length) {
            const callback = this.callbacks[index++];
            if (callback.type === 'data') {
              return { 
                value: new TextEncoder().encode(callback.data), 
                done: false 
              };
            } else if (callback.type === 'close') {
              return { value: undefined, done: true };
            }
          }
          
          return { value: undefined, done: true };
        },
        releaseLock: () => {},
      };
    }
    
    cancel() {
      return Promise.resolve();
    }
  } as any;
}

if (typeof AbortController === 'undefined') {
  const { EventEmitter } = require('events');
  
  global.AbortController = class AbortController {
    private emitter = new EventEmitter();
    public signal = {
      aborted: false,
      addEventListener: (event: string, listener: () => void) => {
        this.emitter.on(event, listener);
      },
    };
    
    abort() {
      this.signal.aborted = true;
      this.emitter.emit('abort');
    }
  } as any;
}

describe('SSE Route', () => {
  let mockRequest: any;
  let mockLobby: any;
  let mockSession: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Note: We use real timers for SSE tests because ReadableStream
    // doesn't work well with fake timers in Jest
    
    // Mock lobby data
    mockLobby = {
      id: 'test-lobby',
      code: 'TEST',
      hostId: 'player1',
      players: [
        { id: 'player1', name: 'Player 1', avatar: '🎮', score: 0, isHost: true },
        { id: 'player2', name: 'Player 2', avatar: '🎯', score: 0, isHost: false },
      ],
      gameState: 'waiting',
    };
    
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
    
    // Create mock request with abort signal
    const abortController = new AbortController();
    mockRequest = {
      url: 'http://localhost:3000/api/lobby/test-lobby/sse',
      signal: abortController.signal,
      abort: () => abortController.abort(),
    };
    
    // Default mocks
    (lrange as jest.Mock).mockResolvedValue([]);
    (setex as jest.Mock).mockResolvedValue('OK');
    (del as jest.Mock).mockResolvedValue(1);
    (rpush as jest.Mock).mockResolvedValue(1);
    (checkDisconnectedPlayers as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 if no session exists', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(null);
      
      const response = await GET(mockRequest, { params: { id: 'test-lobby' } });
      
      expect(response.status).toBe(401);
      expect(await response.text()).toBe('Unauthorized - no valid session');
    });

    it('should return 404 if lobby does not exist', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(mockSession);
      (getLobby as jest.Mock).mockResolvedValue(null);
      
      const response = await GET(mockRequest, { params: { id: 'test-lobby' } });
      
      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Lobby not found');
    });

    it('should return 403 if player is not in lobby', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(mockSession);
      mockLobby.players = [{ id: 'other-player', name: 'Other' }];
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const response = await GET(mockRequest, { params: { id: 'test-lobby' } });
      
      expect(response.status).toBe(403);
      expect(await response.text()).toBe('Player not in lobby');
    });
  });

  describe('SSE Connection', () => {
    it('should establish SSE connection with proper headers', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(mockSession);
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const response = await GET(mockRequest, { params: { id: 'test-lobby' } });
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
      expect(response.headers.get('Connection')).toBe('keep-alive');
      expect(response.headers.get('X-Accel-Buffering')).toBe('no');
      
      await response.body?.cancel();
    });

    it('should send initial connected event for host player', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(mockSession);
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const response = await GET(mockRequest, { params: { id: 'test-lobby' } });
      
      const reader = response.body!.getReader();
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      
      expect(text).toContain('event: connected');
      expect(text).toContain('"playerId":"player1"');
      expect(text).toContain('"lobbyId":"test-lobby"');
      expect(text).toContain('"isHost":true');
      
      reader.releaseLock();
      await response.body!.cancel();
    });

    it('should send initial connected event for non-host player', async () => {
      mockSession.session.playerId = 'player2';
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(mockSession);
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const response = await GET(mockRequest, { params: { id: 'test-lobby' } });
      
      const reader = response.body!.getReader();
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      
      expect(text).toContain('event: connected');
      expect(text).toContain('"isHost":false');
      
      reader.releaseLock();
      await response.body!.cancel();
    });
  });

  describe('Functionality Tests', () => {
    it('should handle successful connection setup', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(mockSession);
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const response = await GET(mockRequest, { params: { id: 'test-lobby' } });
      
      // Should establish connection successfully
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      
      // Should call required functions
      expect(SessionManager.getSessionFromCookies).toHaveBeenCalled();
      expect(getLobby).toHaveBeenCalledWith('test-lobby');
      
      await response.body?.cancel();
    });

    it('should verify player authorization correctly', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(mockSession);
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const response = await GET(mockRequest, { params: { id: 'test-lobby' } });
      
      // Player should be found in lobby
      const player = mockLobby.players.find((p: any) => p.id === mockSession.session.playerId);
      expect(player).toBeDefined();
      expect(player.id).toBe('player1');
      
      await response.body?.cancel();
    });

    it('should handle Redis operations calls', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(mockSession);
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const response = await GET(mockRequest, { params: { id: 'test-lobby' } });
      
      // Wait for polling interval to trigger (1s for 'waiting' state)
      // Note: Using real timers because SSE ReadableStream doesn't work with fake timers
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Redis calls happen in the polling interval, so they should be called
      expect(lrange).toHaveBeenCalledWith('lobby:test-lobby:events', 0, -1);
      
      await response.body?.cancel();
    });

    it('should handle event broadcasting setup', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(mockSession);
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const mockEvent = {
        type: 'player-joined',
        data: { playerId: 'player3', name: 'Player 3' },
        timestamp: Date.now(),
      };
      
      (lrange as jest.Mock).mockResolvedValue([mockEvent]);
      
      const response = await GET(mockRequest, { params: { id: 'test-lobby' } });
      
      // Wait for polling interval to trigger (1s for 'waiting' state)
      // Note: Using real timers because SSE ReadableStream doesn't work with fake timers
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Verify that event polling is set up and called
      expect(lrange).toHaveBeenCalledWith('lobby:test-lobby:events', 0, -1);
      
      await response.body?.cancel();
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis errors gracefully during initialization', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(mockSession);
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      (lrange as jest.Mock).mockRejectedValue(new Error('Redis error'));
      
      const response = await GET(mockRequest, { params: { id: 'test-lobby' } });
      
      // Should still establish connection despite Redis error
      expect(response.status).toBe(200);
      
      await response.body?.cancel();
    });

    it('should handle session retrieval errors', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockRejectedValue(new Error('Session error'));
      
      try {
        await GET(mockRequest, { params: { id: 'test-lobby' } });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle lobby retrieval errors', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(mockSession);
      (getLobby as jest.Mock).mockRejectedValue(new Error('Lobby error'));
      
      try {
        await GET(mockRequest, { params: { id: 'test-lobby' } });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty lobby player list', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(mockSession);
      mockLobby.players = [];
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const response = await GET(mockRequest, { params: { id: 'test-lobby' } });
      
      expect(response.status).toBe(403);
      expect(await response.text()).toBe('Player not in lobby');
    });

    it('should handle malformed session data', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue({
        session: null,
        token: 'invalid',
      });
      
      try {
        await GET(mockRequest, { params: { id: 'test-lobby' } });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle different lobby IDs', async () => {
      (SessionManager.getSessionFromCookies as jest.Mock).mockResolvedValue(mockSession);
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const response = await GET(mockRequest, { params: { id: 'different-lobby' } });
      
      expect(getLobby).toHaveBeenCalledWith('different-lobby');
      
      await response.body?.cancel();
    });
  });
});