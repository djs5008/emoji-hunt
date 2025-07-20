import { 
  startGame, 
  checkAndStartRound, 
  checkAndEndRound,
  checkAndProgressAfterRoundEnd,
  preloadRound,
  resetGame 
} from '@/app/lib/game-state-transitions';
import { generateRound } from '@/app/lib/game-state-async';
import { getLobby } from '@/app/lib/ioredis-storage';
import { setLobby } from '@/app/lib/ioredis-storage';
import { getIoRedis } from '@/app/lib/ioredis-client';
import { broadcastToLobby, broadcastPriorityToLobby } from '@/app/lib/sse-broadcast';
import { Lobby, GameState } from '@/app/types/game';

// Mock dependencies
jest.mock('@/app/lib/game-state-async');
jest.mock('@/app/lib/ioredis-storage');
jest.mock('@/app/lib/ioredis-client');
jest.mock('@/app/lib/sse-broadcast');

describe('Game State Transitions', () => {
  let mockRedis: any;
  let mockLobby: Lobby;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Redis
    mockRedis = {
      set: jest.fn(),
      del: jest.fn(),
      get: jest.fn(),
    };
    (getIoRedis as jest.Mock).mockReturnValue(mockRedis);
    
    // Mock default lobby
    mockLobby = {
      id: 'test-lobby',
      code: 'TEST',
      hostId: 'player1',
      players: [
        { id: 'player1', name: 'Player 1', avatar: '🎮', score: 0, roundScores: [], isHost: true, isReady: true, lastHeartbeat: Date.now() },
        { id: 'player2', name: 'Player 2', avatar: '🎯', score: 0, roundScores: [], isHost: false, isReady: true, lastHeartbeat: Date.now() },
      ],
      gameState: 'waiting' as GameState,
      currentRound: 0,
      maxRounds: 5,
      maxPlayers: 6,
      createdAt: Date.now(),
      rounds: [],
    };
  });

  describe('startGame', () => {
    it('should start game when player is host and enough players', async () => {
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      mockRedis.set.mockResolvedValue('OK'); // Lock acquired
      
      const result = await startGame('test-lobby', 'player1');
      
      expect(result).toBe(true);
      expect(setLobby).toHaveBeenCalledWith(expect.objectContaining({
        gameState: 'countdown',
        currentRound: 1,
        rounds: [],
      }));
      expect(broadcastPriorityToLobby).toHaveBeenCalledWith('test-lobby', 'game-started', expect.any(Object));
    });

    it('should not start game when player is not host', async () => {
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const result = await startGame('test-lobby', 'player2');
      
      expect(result).toBe(false);
      expect(setLobby).not.toHaveBeenCalled();
    });

    it('should start game with single player', async () => {
      mockLobby.players = [mockLobby.players[0]];
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      
      const result = await startGame('test-lobby', 'player1');
      
      expect(result).toBe(true); // No minimum player requirement in actual implementation
    });

    it('should not start game if already in progress', async () => {
      mockLobby.gameState = 'playing';
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const result = await startGame('test-lobby', 'player1');
      
      expect(result).toBe(false);
    });
  });

  describe('checkAndStartRound', () => {
    beforeEach(() => {
      mockLobby.gameState = 'countdown';
      mockLobby.currentRound = 1;
      mockLobby.countdownStartTime = Date.now() - 4000; // 4 seconds ago
    });

    it('should start round after countdown expires', async () => {
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      (generateRound as jest.Mock).mockResolvedValue({
        number: 1,
        targetEmoji: { id: 'emoji1', emoji: '🎮', name: 'Game Controller' },
        emojis: [],
        startTime: Date.now(),
        foundBy: [],
      });
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      mockRedis.set.mockResolvedValue('OK'); // Lock acquired
      
      const result = await checkAndStartRound('test-lobby', 1);
      
      expect(result).toBe(true);
      expect(setLobby).toHaveBeenCalledWith(expect.objectContaining({
        gameState: 'playing',
      }));
      expect(broadcastPriorityToLobby).toHaveBeenCalledWith('test-lobby', 'round-started', expect.any(Object));
    });

    it('should not start round before countdown expires', async () => {
      mockLobby.countdownStartTime = Date.now() - 1000; // 1 second ago
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const result = await checkAndStartRound('test-lobby', 1);
      
      expect(result).toBe(false);
      expect(setLobby).not.toHaveBeenCalled();
    });

    it('should not start round if already playing', async () => {
      mockLobby.gameState = 'playing';
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const result = await checkAndStartRound('test-lobby', 1);
      
      expect(result).toBe(false);
    });

    it('should handle lock contention', async () => {
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      mockRedis.set.mockResolvedValue(null); // Lock not acquired
      
      const result = await checkAndStartRound('test-lobby', 1);
      
      expect(result).toBe(false);
      expect(setLobby).not.toHaveBeenCalled();
    });
  });

  describe('checkAndEndRound', () => {
    beforeEach(() => {
      mockLobby.gameState = 'playing';
      mockLobby.currentRound = 1;
      mockLobby.rounds = [{
        number: 1,
        targetEmoji: { id: 'emoji1', emoji: '🎮', name: 'Game Controller' },
        emojis: [],
        startTime: Date.now() - 31000, // 31 seconds ago
        foundBy: [],
      }];
    });

    it('should end round after time expires', async () => {
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      mockRedis.set.mockResolvedValue('OK'); // Lock acquired
      
      const result = await checkAndEndRound('test-lobby', 1);
      
      expect(result).toBe(true);
      expect(setLobby).toHaveBeenCalledWith(expect.objectContaining({
        gameState: 'roundEnd',
      }));
      expect(broadcastToLobby).toHaveBeenCalledWith('test-lobby', 'round-ended', expect.any(Object));
    });

    it('should end round when all players found emoji', async () => {
      mockLobby.rounds[0].startTime = Date.now() - 10000; // 10 seconds ago
      mockLobby.rounds[0].foundBy = ['player1', 'player2'];
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      mockRedis.set.mockResolvedValue('OK'); // Lock acquired
      
      const result = await checkAndEndRound('test-lobby', 1);
      
      expect(result).toBe(true);
    });

    it('should not end round before time expires', async () => {
      mockLobby.rounds[0].startTime = Date.now() - 10000; // 10 seconds ago
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const result = await checkAndEndRound('test-lobby', 1);
      
      expect(result).toBe(false);
      expect(setLobby).not.toHaveBeenCalled();
    });
  });

  describe('checkAndProgressAfterRoundEnd', () => {
    beforeEach(() => {
      mockLobby.gameState = 'roundEnd';
      mockLobby.currentRound = 1;
      mockLobby.roundEndTime = Date.now() - 7000; // 7 seconds ago
    });

    it('should progress to next round', async () => {
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      mockRedis.set.mockResolvedValue('OK'); // Lock acquired
      
      const result = await checkAndProgressAfterRoundEnd('test-lobby', 1);
      
      expect(result).toBe(true);
      expect(setLobby).toHaveBeenCalledWith(expect.objectContaining({
        gameState: 'countdown',
        currentRound: 2,
      }));
      expect(broadcastPriorityToLobby).toHaveBeenCalledWith('test-lobby', 'game-started', expect.any(Object));
    });

    it('should end game after final round', async () => {
      mockLobby.currentRound = 5;
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      mockRedis.set.mockResolvedValue('OK'); // Lock acquired
      
      const result = await checkAndProgressAfterRoundEnd('test-lobby', 5);
      
      expect(result).toBe(true);
      expect(setLobby).toHaveBeenCalledWith(expect.objectContaining({
        gameState: 'finished',
      }));
      expect(broadcastToLobby).toHaveBeenCalledWith('test-lobby', 'game-ended', expect.any(Object));
    });

    it('should wait shorter time for final round', async () => {
      mockLobby.currentRound = 5;
      mockLobby.roundEndTime = Date.now() - 2000; // 2 seconds ago (less than 3 seconds)
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const result = await checkAndProgressAfterRoundEnd('test-lobby', 5);
      
      expect(result).toBe(false);
    });
  });

  describe('preloadRound', () => {
    beforeEach(() => {
      mockLobby.gameState = 'countdown';
      mockLobby.currentRound = 2;
    });

    it('should preload round data during countdown', async () => {
      mockLobby.countdownStartTime = Date.now() - 2500; // 2.5 seconds ago
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      (generateRound as jest.Mock).mockResolvedValue({
        number: 2,
        targetEmoji: { id: 'emoji2', emoji: '🎯', name: 'Target' },
        emojis: [],
        startTime: 0,
        foundBy: [],
      });
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      mockRedis.set.mockResolvedValue('OK'); // Lock acquired
      
      const result = await preloadRound('test-lobby', 2);
      
      expect(result).toBe(true);
      expect(broadcastPriorityToLobby).toHaveBeenCalledWith('test-lobby', 'roundPreloaded', expect.any(Object));
    });

    it('should not preload if round already exists', async () => {
      mockLobby.rounds = [{} as any, {} as any]; // Round 2 exists
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const result = await preloadRound('test-lobby', 2);
      
      expect(result).toBe(false);
      expect(generateRound).not.toHaveBeenCalled();
    });
  });

  describe('resetGame', () => {
    beforeEach(() => {
      mockLobby.gameState = 'finished';
    });

    it('should reset game when requested by host', async () => {
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      (setLobby as jest.Mock).mockResolvedValue(undefined);
      
      const result = await resetGame('test-lobby', 'player1');
      
      expect(result).toBe(true);
      expect(setLobby).toHaveBeenCalledWith(expect.objectContaining({
        gameState: 'waiting',
        currentRound: 0,
        rounds: [],
      }));
      expect(broadcastToLobby).toHaveBeenCalledWith('test-lobby', 'game-reset', expect.any(Object));
    });

    it('should not reset game when requested by non-host', async () => {
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const result = await resetGame('test-lobby', 'player2');
      
      expect(result).toBe(false);
      expect(setLobby).not.toHaveBeenCalled();
    });

    it('should not reset game in waiting state', async () => {
      mockLobby.gameState = 'waiting';
      (getLobby as jest.Mock).mockResolvedValue(mockLobby);
      
      const result = await resetGame('test-lobby', 'player1');
      
      expect(result).toBe(false); // Can only reset from finished state
    });
  });
});