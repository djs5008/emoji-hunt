import { POST } from '@/app/api/game/click/route';
import { createMockNextRequest, parseNextResponse } from '../../testHelpers';

// Mock the game-engine module
jest.mock('@/app/lib/game-engine', () => ({
  handleEmojiClick: jest.fn(),
}));

// Mock player session
jest.mock('@/app/lib/player-session', () => ({
  SessionManager: {
    getSessionFromCookies: jest.fn(),
  },
}));

// Mock rate limit middleware
jest.mock('@/app/lib/rate-limit-middleware', () => ({
  withRateLimitedRoute: (handler: any) => handler,
}));

const { handleEmojiClick } = require('@/app/lib/game-engine');
const { SessionManager } = require('@/app/lib/player-session');

describe('POST /api/game/click', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should process successful emoji click', async () => {
    SessionManager.getSessionFromCookies.mockResolvedValueOnce({
      session: { playerId: 'player1', id: 'session-123' },
    });
    handleEmojiClick.mockResolvedValueOnce({ found: true, points: 150 });

    const request = createMockNextRequest('http://localhost:3000/api/game/click', {
      method: 'POST',
      body: {
        lobbyId: 'test-lobby',
        emojiId: 'emoji-123',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ found: true, points: 150 });
    expect(handleEmojiClick).toHaveBeenCalledWith('test-lobby', 'player1', 'emoji-123');
  });

  it('should handle incorrect emoji click', async () => {
    SessionManager.getSessionFromCookies.mockResolvedValueOnce({
      session: { playerId: 'player1', id: 'session-123' },
    });
    handleEmojiClick.mockResolvedValueOnce({ found: false, points: 0 });

    const request = createMockNextRequest('http://localhost:3000/api/game/click', {
      method: 'POST',
      body: {
        lobbyId: 'test-lobby',
        emojiId: 'wrong-emoji',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ found: false, points: 0 });
  });

  it('should handle empty clicks (missed all emojis)', async () => {
    SessionManager.getSessionFromCookies.mockResolvedValueOnce({
      session: { playerId: 'player1', id: 'session-123' },
    });

    const request = createMockNextRequest('http://localhost:3000/api/game/click', {
      method: 'POST',
      body: {
        lobbyId: 'test-lobby',
        // No emojiId - player clicked empty space
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ found: false, points: 0 });
    expect(handleEmojiClick).not.toHaveBeenCalled();
  });

  it('should return 400 when lobbyId is missing', async () => {
    SessionManager.getSessionFromCookies.mockResolvedValueOnce({
      session: { playerId: 'player1', id: 'session-123' },
    });

    const request = createMockNextRequest('http://localhost:3000/api/game/click', {
      method: 'POST',
      body: {
        emojiId: 'emoji-123',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Lobby ID is required' });
    expect(handleEmojiClick).not.toHaveBeenCalled();
  });

  it('should return 401 when session is missing', async () => {
    SessionManager.getSessionFromCookies.mockResolvedValueOnce(null);

    const request = createMockNextRequest('http://localhost:3000/api/game/click', {
      method: 'POST',
      body: {
        lobbyId: 'test-lobby',
        emojiId: 'emoji-123',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'No valid session' });
    expect(handleEmojiClick).not.toHaveBeenCalled();
  });

  it('should handle server errors gracefully', async () => {
    SessionManager.getSessionFromCookies.mockResolvedValueOnce({
      session: { playerId: 'player1', id: 'session-123' },
    });
    handleEmojiClick.mockRejectedValueOnce(new Error('Game state corrupted'));

    const request = createMockNextRequest('http://localhost:3000/api/game/click', {
      method: 'POST',
      body: {
        lobbyId: 'test-lobby',
        emojiId: 'emoji-123',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to process click' });
  });

  it('should handle invalid JSON in request body', async () => {
    SessionManager.getSessionFromCookies.mockResolvedValueOnce({
      session: { playerId: 'player1', id: 'session-123' },
    });

    const request = createMockNextRequest('http://localhost:3000/api/game/click', {
      method: 'POST',
      body: 'not valid json',
    });
    request.json = jest.fn().mockRejectedValue(new Error('Invalid JSON'));

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to process click' });
  });

  it('should process multiple clicks from same player', async () => {
    SessionManager.getSessionFromCookies
      .mockResolvedValueOnce({ session: { playerId: 'player1', id: 'session-123' } })
      .mockResolvedValueOnce({ session: { playerId: 'player1', id: 'session-123' } });

    handleEmojiClick
      .mockResolvedValueOnce({ found: false, points: 0 })
      .mockResolvedValueOnce({ found: true, points: 200 });

    // First click - wrong emoji
    const request1 = createMockNextRequest('http://localhost:3000/api/game/click', {
      method: 'POST',
      body: {
        lobbyId: 'test-lobby',
        emojiId: 'wrong-emoji',
      },
    });

    const response1 = await POST(request1);
    const data1 = await response1.json();
    expect(data1).toEqual({ found: false, points: 0 });

    // Second click - correct emoji
    const request2 = createMockNextRequest('http://localhost:3000/api/game/click', {
      method: 'POST',
      body: {
        lobbyId: 'test-lobby',
        emojiId: 'correct-emoji',
      },
    });

    const response2 = await POST(request2);
    const data2 = await response2.json();
    expect(data2).toEqual({ found: true, points: 200 });

    expect(handleEmojiClick).toHaveBeenCalledTimes(2);
  });
});