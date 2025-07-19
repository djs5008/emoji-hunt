import { POST } from '@/app/api/game/start/route';
import { NextRequest } from 'next/server';

// Mock the game-state-transitions module
jest.mock('@/app/lib/game-state-transitions', () => ({
  startGame: jest.fn(),
}));

// Mock player session
jest.mock('@/app/lib/player-session', () => ({
  SessionManager: {
    getSessionFromCookies: jest.fn(),
  },
}));

// Mock rate limit middleware
jest.mock('@/app/lib/rate-limit-middleware', () => ({
  rateLimit: () => (handler: any) => handler,
}));

const { startGame } = require('@/app/lib/game-state-transitions');
const { SessionManager } = require('@/app/lib/player-session');

describe('POST /api/game/start', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should start game successfully when player is host', async () => {
    SessionManager.getSessionFromCookies.mockResolvedValueOnce({
      session: { playerId: 'host-player', id: 'session-123' },
    });
    startGame.mockResolvedValueOnce(true);

    const request = new NextRequest('http://localhost:3000/api/game/start', {
      method: 'POST',
      body: JSON.stringify({
        lobbyId: 'test-lobby',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(startGame).toHaveBeenCalledWith('test-lobby', 'host-player');
  });

  it('should return 403 when player is not host', async () => {
    SessionManager.getSessionFromCookies.mockResolvedValueOnce({
      session: { playerId: 'non-host-player', id: 'session-123' },
    });
    startGame.mockResolvedValueOnce(false);

    const request = new NextRequest('http://localhost:3000/api/game/start', {
      method: 'POST',
      body: JSON.stringify({
        lobbyId: 'test-lobby',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data).toEqual({ error: 'Failed to start game. Are you the host?' });
  });

  it('should return 400 when lobbyId is missing', async () => {
    SessionManager.getSessionFromCookies.mockResolvedValueOnce({
      session: { playerId: 'host-player', id: 'session-123' },
    });

    const request = new NextRequest('http://localhost:3000/api/game/start', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Lobby ID is required' });
    expect(startGame).not.toHaveBeenCalled();
  });

  it('should return 401 when session is missing', async () => {
    SessionManager.getSessionFromCookies.mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/game/start', {
      method: 'POST',
      body: JSON.stringify({
        lobbyId: 'test-lobby',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'No valid session' });
    expect(startGame).not.toHaveBeenCalled();
  });

  it('should handle server errors gracefully', async () => {
    SessionManager.getSessionFromCookies.mockResolvedValueOnce({
      session: { playerId: 'host-player', id: 'session-123' },
    });
    startGame.mockRejectedValueOnce(new Error('Database connection failed'));

    const request = new NextRequest('http://localhost:3000/api/game/start', {
      method: 'POST',
      body: JSON.stringify({
        lobbyId: 'test-lobby',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to start game' });
  });

  it('should handle invalid JSON in request body', async () => {
    SessionManager.getSessionFromCookies.mockResolvedValueOnce({
      session: { playerId: 'host-player', id: 'session-123' },
    });

    const request = new NextRequest('http://localhost:3000/api/game/start', {
      method: 'POST',
      body: 'invalid json',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to start game' });
  });
});