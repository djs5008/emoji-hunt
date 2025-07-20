import { 
  createLobby, 
  joinLobby, 
  generateRound
} from '@/app/lib/game-state-async';
import { getLobby, setLobby } from '@/app/lib/ioredis-storage';
import { getRandomFaceEmoji } from '@/app/lib/face-emojis';
import { getRandomEmojis } from '@/app/lib/emojis';
import { Lobby } from '@/app/types/game';

// Mock dependencies
jest.mock('@/app/lib/ioredis-storage');
jest.mock('@/app/lib/face-emojis');
jest.mock('@/app/lib/emojis');
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'test-id'),
  customAlphabet: jest.fn(() => () => 'ABCD'),
}));

const mockGetLobby = getLobby as jest.MockedFunction<typeof getLobby>;
const mockSetLobby = setLobby as jest.MockedFunction<typeof setLobby>;
const mockGetRandomFaceEmoji = getRandomFaceEmoji as jest.MockedFunction<typeof getRandomFaceEmoji>;
const mockGetRandomEmojis = getRandomEmojis as jest.MockedFunction<typeof getRandomEmojis>;

describe('Game State Async', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRandomFaceEmoji.mockReturnValue('😀');
    mockGetRandomEmojis.mockImplementation((count) => 
      Array(count).fill('🎯').map((e, i) => i === 0 ? '🎯' : '🎮')
    );
  });

  describe('createLobby', () => {
    it('should create a new lobby with host player', async () => {
      const hostId = 'host-123';
      const hostNickname = 'Host Player';

      const lobby = await createLobby(hostId, hostNickname);

      expect(lobby).toMatchObject({
        id: 'ABCD',
        hostId,
        players: [{
          id: hostId,
          nickname: hostNickname,
          avatar: '😀',
          score: 0,
          roundScores: [],
          isHost: true,
        }],
        gameState: 'waiting',
        currentRound: 0,
        rounds: [],
      });

      expect(mockSetLobby).toHaveBeenCalledWith(lobby);
    });

    it('should generate unique lobby codes', async () => {
      // Mock different codes for each call
      const mockCustomAlphabet = require('nanoid').customAlphabet;
      let callCount = 0;
      mockCustomAlphabet.mockImplementation(() => () => `LOB${callCount++}`);

      const lobby1 = await createLobby('host1', 'Host 1');
      const lobby2 = await createLobby('host2', 'Host 2');

      expect(lobby1.id).toBe('LOB0');
      expect(lobby2.id).toBe('LOB1');
    });
  });

  describe('joinLobby', () => {
    const createMockLobby = (overrides?: Partial<Lobby>): Lobby => ({
      id: 'ABCD',
      hostId: 'host-123',
      players: [{
        id: 'host-123',
        nickname: 'Host',
        avatar: '😀',
        score: 0,
        roundScores: [],
        isHost: true,
      }],
      gameState: 'waiting',
      currentRound: 0,
      rounds: [],
      ...overrides,
    });

    it('should add a player to an existing lobby', async () => {
      const mockLobby = createMockLobby();
      mockGetLobby.mockResolvedValueOnce(mockLobby);

      const result = await joinLobby('ABCD', 'player-123', 'New Player');

      expect(result).toBeTruthy();
      expect(mockSetLobby).toHaveBeenCalledWith(expect.objectContaining({
        players: expect.arrayContaining([
          expect.objectContaining({ id: 'host-123' }),
          expect.objectContaining({
            id: 'player-123',
            nickname: 'New Player',
            score: 0,
            roundScores: [],
            isHost: false,
          })
        ])
      }));
    });

    it('should not add duplicate players', async () => {
      const mockLobby = createMockLobby({
        players: [
          {
            id: 'host-123',
            nickname: 'Host',
            avatar: '😀',
            score: 0,
            roundScores: [],
            isHost: true,
          },
          {
            id: 'player-123',
            nickname: 'Existing Player',
            avatar: '😎',
            score: 50,
            roundScores: [],
            isHost: false,
          }
        ]
      });
      mockGetLobby.mockResolvedValueOnce(mockLobby);

      const result = await joinLobby('ABCD', 'player-123', 'Existing Player');

      expect(result).toBe(mockLobby);
      expect(mockSetLobby).not.toHaveBeenCalled();
    });

    it('should not allow joining when game has started', async () => {
      const mockLobby = createMockLobby({ gameState: 'playing' });
      mockGetLobby.mockResolvedValueOnce(mockLobby);

      const result = await joinLobby('ABCD', 'player-123', 'Late Player');

      expect(result).toBeNull();
      expect(mockSetLobby).not.toHaveBeenCalled();
    });

    it('should return null for non-existent lobby', async () => {
      mockGetLobby.mockResolvedValueOnce(null);

      const result = await joinLobby('XXXX', 'player-123', 'Player');

      expect(result).toBeNull();
      expect(mockSetLobby).not.toHaveBeenCalled();
    });
  });

  describe('generateRound', () => {
    it('should generate a round with correct structure', () => {
      const round = generateRound(1);

      expect(round).toMatchObject({
        number: 1,
        targetEmoji: '🎯',
        emojiPositions: expect.any(Array),
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        foundBy: [],
      });

      expect(round.endTime - round.startTime).toBe(30000); // 30 seconds
    });

    it('should create proper grid layout', () => {
      const round = generateRound(1);

      // Check that positions are within canvas bounds
      const CANVAS_WIDTH = 2400;
      const CANVAS_HEIGHT = 1200;
      const TOP_MARGIN = 120;
      const BOTTOM_MARGIN = 80;

      round.emojiPositions.forEach(pos => {
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.x).toBeLessThan(CANVAS_WIDTH);
        expect(pos.y).toBeGreaterThanOrEqual(TOP_MARGIN);
        expect(pos.y).toBeLessThan(CANVAS_HEIGHT - BOTTOM_MARGIN);
        expect(pos.fontSize).toBe(48);
      });
    });

    it('should assign unique IDs to each emoji position', () => {
      // Mock nanoid to return different IDs
      const mockNanoid = require('nanoid').nanoid;
      let idCounter = 0;
      mockNanoid.mockImplementation(() => `emoji-${idCounter++}`);

      const round = generateRound(1);

      const ids = round.emojiPositions.map(pos => pos.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should use first emoji as target', () => {
      mockGetRandomEmojis.mockReturnValueOnce(['🎯', '🎮', '🎨', '🎪']);

      const round = generateRound(1);

      expect(round.targetEmoji).toBe('🎯');
      expect(round.emojiPositions.some(pos => pos.emoji === '🎯')).toBe(true);
    });

    it('should fill the grid completely', () => {
      const round = generateRound(1);

      // Calculate expected grid size
      const CANVAS_WIDTH = 2400;
      const CANVAS_HEIGHT = 1200;
      const EMOJI_SIZE = 48;
      const TOP_MARGIN = 120;
      const BOTTOM_MARGIN = 80;
      const PADDING = 15;
      const SPACING = 8;

      const availableWidth = CANVAS_WIDTH - (2 * PADDING);
      const availableHeight = CANVAS_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN - PADDING;
      const horizontalSpacing = EMOJI_SIZE + SPACING;
      const verticalSpacing = EMOJI_SIZE + SPACING;
      const expectedCols = Math.floor(availableWidth / horizontalSpacing);
      const expectedRows = Math.floor(availableHeight / verticalSpacing);
      const expectedCount = expectedCols * expectedRows;

      expect(round.emojiPositions).toHaveLength(expectedCount);
    });
  });

});