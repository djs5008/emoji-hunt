import { startGame, resetGame, handleEmojiClick } from '@/app/lib/game-engine';
import { getLobby } from '@/app/lib/game-state-async';
import { setLobby } from '@/app/lib/upstash-storage';
import { broadcastToLobby, SSE_EVENTS } from '@/app/lib/sse-broadcast';
import { checkAndEndRound } from '@/app/lib/game-state-transitions';
import { Lobby } from '@/app/types/game';

// Mock dependencies
jest.mock('@/app/lib/upstash-storage');
jest.mock('@/app/lib/sse-broadcast');
jest.mock('@/app/lib/game-state-transitions');

// We need to mock game-state-async after upstash-storage is mocked
jest.mock('@/app/lib/game-state-async', () => ({
  ...jest.requireActual('@/app/lib/game-state-async'),
  getLobby: jest.fn(),
}));

const mockGetLobby = getLobby as jest.MockedFunction<typeof getLobby>;
const mockSetLobby = setLobby as jest.MockedFunction<typeof setLobby>;
const mockBroadcastToLobby = broadcastToLobby as jest.MockedFunction<typeof broadcastToLobby>;
const mockCheckAndEndRound = checkAndEndRound as jest.MockedFunction<typeof checkAndEndRound>;

// Helper function to create mock lobby
const createMockLobby = (overrides?: Partial<Lobby>): Lobby => ({
  id: 'test-lobby',
  code: 'TEST',
  players: [
    {
      id: 'player1',
      name: 'Player 1',
      avatar: '🎮',
      score: 0,
      roundScores: [],
      isReady: true,
      isHost: true,
      lastHeartbeat: Date.now(),
    },
    {
      id: 'player2',
      name: 'Player 2',
      avatar: '🎯',
      score: 0,
      roundScores: [],
      isReady: true,
      isHost: false,
      lastHeartbeat: Date.now(),
    },
  ],
  gameState: 'playing',
  maxPlayers: 6,
  createdAt: Date.now(),
  currentRound: 1,
  rounds: [
    {
      number: 1,
      targetEmoji: '🎯',
      emojiPositions: [
        { id: 'emoji1', emoji: '🎯', x: 100, y: 100, scale: 1 },
        { id: 'emoji2', emoji: '🎮', x: 200, y: 200, scale: 1 },
        { id: 'emoji3', emoji: '🎨', x: 300, y: 300, scale: 1 },
      ],
      startTime: Date.now() - 5000, // 5 seconds ago
      endTime: Date.now() + 25000, // 25 seconds from now
      foundBy: [],
    },
  ],
  maxRounds: 5,
  ...overrides,
});

describe('Game Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startGame', () => {
    it('should return true when lobby is in waiting state', async () => {
      const mockLobby: Lobby = {
        id: 'test-lobby',
        code: 'TEST',
        players: [],
        gameState: 'waiting',
        maxPlayers: 6,
        createdAt: Date.now(),
        currentRound: 0,
        rounds: [],
        maxRounds: 5,
      };

      mockGetLobby.mockResolvedValueOnce(mockLobby);

      const result = await startGame('test-lobby');
      expect(result).toBe(true);
      expect(mockGetLobby).toHaveBeenCalledWith('test-lobby');
    });

    it('should return false when lobby is not in waiting state', async () => {
      const mockLobby: Lobby = {
        id: 'test-lobby',
        code: 'TEST',
        players: [],
        gameState: 'playing',
        maxPlayers: 6,
        createdAt: Date.now(),
        currentRound: 1,
        rounds: [],
        maxRounds: 5,
      };

      mockGetLobby.mockResolvedValueOnce(mockLobby);

      const result = await startGame('test-lobby');
      expect(result).toBe(false);
    });

    it('should return false when lobby does not exist', async () => {
      mockGetLobby.mockResolvedValueOnce(null);

      const result = await startGame('test-lobby');
      expect(result).toBe(false);
    });
  });

  describe('resetGame', () => {
    it('should reset game when lobby is in finished state', async () => {
      const mockLobby: Lobby = {
        id: 'test-lobby',
        code: 'TEST',
        players: [
          {
            id: 'player1',
            name: 'Player 1',
            avatar: '🎮',
            score: 100,
            roundScores: [{ round: 1, timeToFind: 5, points: 100 }],
            isReady: true,
            isHost: true,
            lastHeartbeat: Date.now(),
          },
        ],
        gameState: 'finished',
        maxPlayers: 6,
        createdAt: Date.now(),
        currentRound: 5,
        rounds: [
          {
            number: 1,
            targetEmoji: '🎯',
            emojiPositions: [],
            startTime: Date.now() - 60000,
            endTime: Date.now() - 30000,
            foundBy: [],
          },
        ],
        maxRounds: 5,
        countdownStartTime: Date.now() - 120000,
        roundEndTime: Date.now() - 30000,
      };

      mockGetLobby.mockResolvedValueOnce(mockLobby);

      const result = await resetGame('test-lobby');
      
      expect(result).toBe(true);
      expect(mockSetLobby).toHaveBeenCalled();
      const calledLobby = mockSetLobby.mock.calls[0][0];
      expect(calledLobby.gameState).toBe('waiting');
      expect(calledLobby.currentRound).toBe(0);
      expect(calledLobby.rounds).toEqual([]);
      expect(calledLobby.countdownStartTime).toBeUndefined();
      expect(calledLobby.roundEndTime).toBeUndefined();
      expect(mockBroadcastToLobby).toHaveBeenCalledWith(
        'test-lobby',
        SSE_EVENTS.LOBBY_UPDATED,
        expect.objectContaining({ lobby: expect.any(Object) })
      );
    });

    it('should return false when lobby is not in finished state', async () => {
      const mockLobby: Lobby = {
        id: 'test-lobby',
        code: 'TEST',
        players: [],
        gameState: 'playing',
        maxPlayers: 6,
        createdAt: Date.now(),
        currentRound: 3,
        rounds: [],
        maxRounds: 5,
      };

      mockGetLobby.mockResolvedValueOnce(mockLobby);

      const result = await resetGame('test-lobby');
      expect(result).toBe(false);
      expect(mockSetLobby).not.toHaveBeenCalled();
    });

    it('should return false when lobby does not exist', async () => {
      mockGetLobby.mockResolvedValueOnce(null);

      const result = await resetGame('test-lobby');
      expect(result).toBe(false);
      expect(mockSetLobby).not.toHaveBeenCalled();
    });
  });

  describe('handleEmojiClick', () => {
    it('should handle correct emoji click and award points', async () => {
      const mockLobby = createMockLobby();
      mockGetLobby.mockResolvedValueOnce(mockLobby);

      const result = await handleEmojiClick('test-lobby', 'player1', 'emoji1');

      expect(result.found).toBe(true);
      expect(result.points).toBeGreaterThan(100); // Base + bonuses
      expect(result.points).toBeLessThan(250); // Max possible

      expect(mockSetLobby).toHaveBeenCalledWith(
        expect.objectContaining({
          players: expect.arrayContaining([
            expect.objectContaining({
              id: 'player1',
              score: result.points,
              roundScores: expect.arrayContaining([
                expect.objectContaining({
                  round: 1,
                  points: result.points,
                }),
              ]),
            }),
          ]),
          rounds: expect.arrayContaining([
            expect.objectContaining({
              foundBy: expect.arrayContaining([
                expect.objectContaining({
                  playerId: 'player1',
                }),
              ]),
            }),
          ]),
        })
      );

      expect(mockBroadcastToLobby).toHaveBeenCalledWith(
        'test-lobby',
        SSE_EVENTS.EMOJI_FOUND,
        expect.objectContaining({
          playerId: 'player1',
          points: result.points,
          foundCount: 1,
          totalPlayers: 2,
          emojiId: 'emoji1',
        })
      );
    });

    it('should handle wrong emoji click', async () => {
      const mockLobby = createMockLobby();
      mockGetLobby.mockResolvedValueOnce(mockLobby);

      const result = await handleEmojiClick('test-lobby', 'player1', 'emoji2');

      expect(result.found).toBe(false);
      expect(result.points).toBe(0);

      expect(mockBroadcastToLobby).toHaveBeenCalledWith(
        'test-lobby',
        SSE_EVENTS.WRONG_EMOJI,
        expect.objectContaining({
          playerId: 'player1',
          clickedEmoji: '🎮',
        })
      );

      expect(mockSetLobby).not.toHaveBeenCalled();
    });

    it('should prevent duplicate finds by same player', async () => {
      const mockLobby = createMockLobby({
        rounds: [
          {
            number: 1,
            targetEmoji: '🎯',
            emojiPositions: [
              { id: 'emoji1', emoji: '🎯', x: 100, y: 100, scale: 1 },
            ],
            startTime: Date.now() - 5000,
            endTime: Date.now() + 25000,
            foundBy: [{ playerId: 'player1', timestamp: Date.now() - 1000 }],
          },
        ],
      });

      mockGetLobby.mockResolvedValueOnce(mockLobby);

      const result = await handleEmojiClick('test-lobby', 'player1', 'emoji1');

      expect(result.found).toBe(false);
      expect(result.points).toBe(0);
      expect(mockSetLobby).not.toHaveBeenCalled();
    });

    it('should end round early when all players find the emoji', async () => {
      const mockLobby = createMockLobby({
        rounds: [
          {
            number: 1,
            targetEmoji: '🎯',
            emojiPositions: [
              { id: 'emoji1', emoji: '🎯', x: 100, y: 100, scale: 1 },
            ],
            startTime: Date.now() - 5000,
            endTime: Date.now() + 25000,
            foundBy: [{ playerId: 'player2', timestamp: Date.now() - 1000 }],
          },
        ],
      });

      mockGetLobby.mockResolvedValueOnce(mockLobby);

      const result = await handleEmojiClick('test-lobby', 'player1', 'emoji1');

      expect(result.found).toBe(true);
      expect(mockCheckAndEndRound).toHaveBeenCalledWith('test-lobby', 1);
    });

    it('should handle emoji click when game is not playing', async () => {
      const mockLobby = createMockLobby({ gameState: 'waiting' });
      mockGetLobby.mockResolvedValueOnce(mockLobby);

      const result = await handleEmojiClick('test-lobby', 'player1', 'emoji1');

      expect(result.found).toBe(false);
      expect(result.points).toBe(0);
      expect(mockSetLobby).not.toHaveBeenCalled();
    });

    it('should handle non-existent emoji ID', async () => {
      const mockLobby = createMockLobby();
      mockGetLobby.mockResolvedValueOnce(mockLobby);

      const result = await handleEmojiClick('test-lobby', 'player1', 'invalid-emoji');

      expect(result.found).toBe(false);
      expect(result.points).toBe(0);
      expect(mockSetLobby).not.toHaveBeenCalled();
    });

    it('should handle Unicode normalization for emoji comparison', async () => {
      const mockLobby = createMockLobby({
        rounds: [
          {
            number: 1,
            targetEmoji: '👨‍👩‍👧‍👦', // Family emoji with ZWJ
            emojiPositions: [
              { id: 'emoji1', emoji: '👨‍👩‍👧‍👦', x: 100, y: 100, scale: 1 },
            ],
            startTime: Date.now() - 5000,
            endTime: Date.now() + 25000,
            foundBy: [],
          },
        ],
      });

      mockGetLobby.mockResolvedValueOnce(mockLobby);

      const result = await handleEmojiClick('test-lobby', 'player1', 'emoji1');

      expect(result.found).toBe(true);
      expect(result.points).toBeGreaterThan(100);
    });
  });

  describe('Point Calculation', () => {
    it('should award maximum points for instant find by first player', async () => {
      // Set a start time slightly in the past to ensure consistent timing
      const startTime = Date.now() - 10;
      const mockLobby = createMockLobby({
        rounds: [
          {
            number: 1,
            targetEmoji: '🎯',
            emojiPositions: [
              { id: 'emoji1', emoji: '🎯', x: 100, y: 100, scale: 1 },
            ],
            startTime: startTime, // Started 10ms ago
            endTime: startTime + 30000,
            foundBy: [],
          },
        ],
      });

      mockGetLobby.mockResolvedValueOnce(mockLobby);

      const result = await handleEmojiClick('test-lobby', 'player1', 'emoji1');

      expect(result.found).toBe(true);
      // With 10ms elapsed, points should be very close to 250 (might be 249 due to rounding)
      expect(result.points).toBeGreaterThanOrEqual(249);
      expect(result.points).toBeLessThanOrEqual(250);
    });

    it('should award less points for slower finds', async () => {
      const mockLobby = createMockLobby({
        rounds: [
          {
            number: 1,
            targetEmoji: '🎯',
            emojiPositions: [
              { id: 'emoji1', emoji: '🎯', x: 100, y: 100, scale: 1 },
            ],
            startTime: Date.now() - 15000, // 15 seconds ago
            endTime: Date.now() + 15000,
            foundBy: [],
          },
        ],
      });

      mockGetLobby.mockResolvedValueOnce(mockLobby);

      const result = await handleEmojiClick('test-lobby', 'player1', 'emoji1');

      expect(result.found).toBe(true);
      expect(result.points).toBeGreaterThanOrEqual(198);
      expect(result.points).toBeLessThanOrEqual(202); // Allow for rounding
    });

    it('should award less points for later finders', async () => {
      const mockLobby = createMockLobby({
        rounds: [
          {
            number: 1,
            targetEmoji: '🎯',
            emojiPositions: [
              { id: 'emoji1', emoji: '🎯', x: 100, y: 100, scale: 1 },
            ],
            startTime: Date.now() - 5000,
            endTime: Date.now() + 25000,
            foundBy: [
              { playerId: 'player2', timestamp: Date.now() - 4000 },
              { playerId: 'player3', timestamp: Date.now() - 3000 },
            ],
          },
        ],
      });

      mockGetLobby.mockResolvedValueOnce(mockLobby);

      const result = await handleEmojiClick('test-lobby', 'player1', 'emoji1');

      expect(result.found).toBe(true);
      // 100 base + ~83 time bonus + 30 order bonus (third finder)
      expect(result.points).toBeGreaterThan(210);
      expect(result.points).toBeLessThan(220);
    });

    it('should award minimum time bonus after 30 seconds', async () => {
      const mockLobby = createMockLobby({
        rounds: [
          {
            number: 1,
            targetEmoji: '🎯',
            emojiPositions: [
              { id: 'emoji1', emoji: '🎯', x: 100, y: 100, scale: 1 },
            ],
            startTime: Date.now() - 35000, // 35 seconds ago
            endTime: Date.now() + 25000,
            foundBy: [],
          },
        ],
      });

      mockGetLobby.mockResolvedValueOnce(mockLobby);

      const result = await handleEmojiClick('test-lobby', 'player1', 'emoji1');

      expect(result.found).toBe(true);
      expect(result.points).toBe(150); // 100 base + 0 time + 50 order
    });
  });
});