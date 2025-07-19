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
    getOrCreateSession: jest.fn(() => ({
      session: { playerId: 'generated-id-0', id: 'session-123' },
      isNew: false,
    })),
  },
}));

jest.mock('@/app/lib/rate-limit-middleware', () => ({
  withRateLimitedRoute: (handler: any) => handler,
}));

const { createLobby } = require('@/app/lib/game-state-async');
const { setex } = require('@/app/lib/upstash-redis');
const { nanoid } = require('nanoid');
const { SessionManager } = require('@/app/lib/player-session');

describe('POST /api/lobby/create', () => {
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

  it('should create a lobby successfully', async () => {
    const mockLobby = {
      id: 'ABCD',
      hostId: 'generated-id-0',
      players: [{
        id: 'generated-id-0',
        nickname: 'Alice',
        avatar: '😀',
        score: 0,
        roundScores: [],
        isHost: true,
      }],
      gameState: 'waiting',
      currentRound: 0,
      rounds: [],
    };

    createLobby.mockResolvedValueOnce(mockLobby);
    setex.mockResolvedValue('OK');

    const request = new NextRequest('http://localhost:3000/api/lobby/create', {
      method: 'POST',
      body: JSON.stringify({
        nickname: 'Alice',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('lobby', mockLobby);
    expect(data).toHaveProperty('playerId', 'generated-id-0');
    expect(data).toHaveProperty('hostToken', 'generated-id-0');

    expect(createLobby).toHaveBeenCalledWith('generated-id-0', 'Alice');
    expect(setex).toHaveBeenCalledTimes(2);
    expect(setex).toHaveBeenCalledWith(
      'player:ABCD:generated-id-0:heartbeat',
      10,
      expect.any(String)
    );
    expect(setex).toHaveBeenCalledWith(
      'player:ABCD:generated-id-0:joinTime',
      60,
      expect.any(String)
    );
  });

  it('should reuse existing player ID if provided', async () => {
    const mockLobby = {
      id: 'EFGH',
      hostId: 'existing-player-id',
      players: [{
        id: 'existing-player-id',
        nickname: 'Bob',
        avatar: '😎',
        score: 0,
        roundScores: [],
        isHost: true,
      }],
      gameState: 'waiting',
      currentRound: 0,
      rounds: [],
    };

    // Mock SessionManager to return existing player ID
    SessionManager.getOrCreateSession.mockResolvedValueOnce({
      session: { playerId: 'existing-player-id', id: 'session-456' },
      isNew: false,
    });

    createLobby.mockResolvedValueOnce(mockLobby);

    const request = new NextRequest('http://localhost:3000/api/lobby/create', {
      method: 'POST',
      body: JSON.stringify({
        nickname: 'Bob',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.playerId).toBe('existing-player-id');
    expect(createLobby).toHaveBeenCalledWith('existing-player-id', 'Bob');
  });

  it('should trim whitespace from nickname', async () => {
    const mockLobby = {
      id: 'IJKL',
      hostId: 'generated-id-0',
      players: [{
        id: 'generated-id-0',
        nickname: 'Charlie',
        avatar: '🤗',
        score: 0,
        roundScores: [],
        isHost: true,
      }],
      gameState: 'waiting',
      currentRound: 0,
      rounds: [],
    };

    createLobby.mockResolvedValueOnce(mockLobby);

    const request = new NextRequest('http://localhost:3000/api/lobby/create', {
      method: 'POST',
      body: JSON.stringify({
        nickname: '  Charlie  ',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(createLobby).toHaveBeenCalledWith('generated-id-0', 'Charlie');
  });

  it('should return 400 when nickname is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/lobby/create', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Nickname is required' });
    expect(createLobby).not.toHaveBeenCalled();
  });

  it('should return 400 when nickname is empty', async () => {
    const request = new NextRequest('http://localhost:3000/api/lobby/create', {
      method: 'POST',
      body: JSON.stringify({
        nickname: '',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Nickname is required' });
    expect(createLobby).not.toHaveBeenCalled();
  });

  it('should return 400 when nickname is only whitespace', async () => {
    const request = new NextRequest('http://localhost:3000/api/lobby/create', {
      method: 'POST',
      body: JSON.stringify({
        nickname: '   ',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Nickname is required' });
    expect(createLobby).not.toHaveBeenCalled();
  });

  it('should handle server errors gracefully', async () => {
    createLobby.mockRejectedValueOnce(new Error('Database unavailable'));

    const request = new NextRequest('http://localhost:3000/api/lobby/create', {
      method: 'POST',
      body: JSON.stringify({
        nickname: 'Dave',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to create lobby' });
  });

  it('should handle Redis errors gracefully', async () => {
    const mockLobby = {
      id: 'MNOP',
      hostId: 'generated-id-0',
      players: [{
        id: 'generated-id-0',
        nickname: 'Eve',
        avatar: '🙂',
        score: 0,
        roundScores: [],
        isHost: true,
      }],
      gameState: 'waiting',
      currentRound: 0,
      rounds: [],
    };

    createLobby.mockResolvedValueOnce(mockLobby);
    setex.mockRejectedValueOnce(new Error('Redis connection failed'));

    const request = new NextRequest('http://localhost:3000/api/lobby/create', {
      method: 'POST',
      body: JSON.stringify({
        nickname: 'Eve',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to create lobby' });
  });

  it('should handle invalid JSON in request body', async () => {
    const request = new NextRequest('http://localhost:3000/api/lobby/create', {
      method: 'POST',
      body: '{invalid json',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to create lobby' });
  });
});