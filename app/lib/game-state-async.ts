import { Lobby, Player, Round, EmojiPosition } from '@/app/types/game';
import { nanoid, customAlphabet } from 'nanoid';
import { getRandomEmojis } from './emojis';
import { getRandomFaceEmoji } from './face-emojis';
import { 
  getLobby, 
  setLobby 
} from './upstash-storage';
import { Filter } from 'bad-words';

/**
 * Game state management module
 * 
 * @description Handles lobby creation, player management, and round generation.
 * All operations are async and use Redis for persistence to support distributed
 * gameplay across multiple server instances.
 */

/**
 * Creates a new game lobby
 * 
 * @description Generates a new lobby with a unique 4-character code and adds
 * the creator as the host. The lobby starts in 'waiting' state until the host
 * starts the game.
 * 
 * @param {string} hostId - Unique ID for the host player
 * @param {string} hostNickname - Display name for the host
 * @returns {Promise<Lobby>} The created lobby with the host as first player
 * 
 * Lobby codes:
 * - 4 characters long
 * - Uppercase letters and numbers only
 * - Case-insensitive when joining
 */
export async function createLobby(hostId: string, hostNickname: string): Promise<Lobby> {
  // Initialize bad words filter
  const filter = new Filter();
  
  // Generate human-friendly lobby code
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const generateId = customAlphabet(alphabet, 4);
  
  // Generate lobby ID and ensure it doesn't contain bad words
  let lobbyId: string;
  let attempts = 0;
  const maxAttempts = 100;
  
  do {
    lobbyId = generateId();
    attempts++;
    
    // Check if the generated code contains bad words
    if (!filter.isProfane(lobbyId)) {
      break;
    }
    
    // Prevent infinite loop
    if (attempts >= maxAttempts) {
      throw new Error('Unable to generate clean lobby code');
    }
  } while (true);
  
  const lobby: Lobby = {
    id: lobbyId,
    hostId,
    players: [{
      id: hostId,
      nickname: hostNickname,
      avatar: getRandomFaceEmoji(), // Random emoji for player identification
      score: 0,
      roundScores: [],
      isHost: true,
    }],
    gameState: 'waiting',
    currentRound: 0,
    rounds: [],
  };
  
  await setLobby(lobby);
  return lobby;
}

/**
 * Adds a player to an existing lobby
 * 
 * @description Players can only join lobbies in 'waiting' state. If the player
 * already exists (e.g., reconnecting), returns the lobby without adding duplicate.
 * Each player gets a random face emoji avatar for visual identification.
 * 
 * @param {string} lobbyId - The lobby code to join
 * @param {string} playerId - Unique ID for the joining player
 * @param {string} nickname - Display name for the player
 * @returns {Promise<Lobby | null>} The updated lobby, or null if join failed
 * 
 * Join restrictions:
 * - Lobby must exist
 * - Game must not have started (waiting state only)
 * - No duplicate players
 */
export async function joinLobby(lobbyId: string, playerId: string, nickname: string): Promise<Lobby | null> {
  const lobby = await getLobby(lobbyId);
  
  // Validate lobby state
  if (!lobby || lobby.gameState !== 'waiting') {
    return null;
  }
  
  // Handle reconnection - don't add duplicate
  if (lobby.players.find(p => p.id === playerId)) {
    return lobby;
  }
  
  // Add new player
  lobby.players.push({
    id: playerId,
    nickname,
    avatar: getRandomFaceEmoji(),
    score: 0,
    roundScores: [],
    isHost: false,
  });
  
  await setLobby(lobby);
  return lobby;
}

// Re-export for convenience
export { getLobby } from './upstash-storage';

/**
 * Generates a new game round with random emoji placement
 * 
 * @description Creates a grid-based layout of emojis with one designated as the
 * target. The grid is dynamically sized to fill the canvas while maintaining
 * consistent spacing. All positions are shuffled for randomness.
 * 
 * Layout parameters:
 * - Canvas: 2400x1200 pixels
 * - Emoji size: 48px
 * - Grid spacing: 8px between emojis
 * - Margins: 120px top (header), 80px bottom (footer)
 * 
 * @param {number} roundNumber - The round number (1-5)
 * @returns {Round} Complete round data with emoji positions
 * 
 * Algorithm:
 * 1. Calculate maximum grid dimensions based on canvas size
 * 2. Generate random emojis (first one becomes target)
 * 3. Create grid positions centered on canvas
 * 4. Shuffle positions for random placement
 * 5. Assign emojis to positions
 */
export function generateRound(roundNumber: number): Round {
  // Canvas dimensions
  const CANVAS_WIDTH = 2400;
  const CANVAS_HEIGHT = 1200;
  const EMOJI_SIZE = 48;
  const TOP_MARGIN = 120;    // Space for header UI
  const BOTTOM_MARGIN = 80;  // Space for footer UI
  const PADDING = 15;
  
  // Calculate grid layout
  const availableWidth = CANVAS_WIDTH - (2 * PADDING);
  const availableHeight = CANVAS_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN - PADDING;
  const horizontalSpacing = EMOJI_SIZE + 8;
  const verticalSpacing = EMOJI_SIZE + 8;
  const cols = Math.floor(availableWidth / horizontalSpacing);
  const rows = Math.floor(availableHeight / verticalSpacing);
  
  // Fill entire grid with emojis
  const EMOJI_COUNT = cols * rows;
  
  // Get random emojis (first is always the target)
  const emojis = getRandomEmojis(EMOJI_COUNT);
  const targetEmoji = emojis[0];
  const positions: EmojiPosition[] = [];
  
  // Generate grid positions
  const gridPositions: Array<{x: number, y: number}> = [];
  
  // Calculate centered grid placement
  const actualGridWidth = cols * horizontalSpacing - 8;
  const actualGridHeight = rows * verticalSpacing - 8;
  const startX = (CANVAS_WIDTH - actualGridWidth) / 2;
  const startY = TOP_MARGIN + (availableHeight - actualGridHeight) / 2;
  
  // Create grid positions
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (gridPositions.length < EMOJI_COUNT) {
        gridPositions.push({
          x: startX + col * horizontalSpacing,
          y: startY + row * verticalSpacing + EMOJI_SIZE
        });
      }
    }
  }
  
  // Randomize positions
  const shuffledPositions = gridPositions.sort(() => Math.random() - 0.5).slice(0, EMOJI_COUNT);
  
  // Assign emojis to positions
  for (let i = 0; i < emojis.length && i < shuffledPositions.length; i++) {
    positions.push({
      id: nanoid(),
      emoji: emojis[i],
      x: shuffledPositions[i].x,
      y: shuffledPositions[i].y,
      fontSize: EMOJI_SIZE,
    });
  }
  
  return {
    number: roundNumber,
    targetEmoji,
    emojiPositions: positions,
    startTime: Date.now(),
    endTime: Date.now() + 30000, // 30 second rounds
    foundBy: [],
  };
}


