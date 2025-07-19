import { Lobby, Player, Round, EmojiPosition } from '@/app/types/game';
import { nanoid, customAlphabet } from 'nanoid';
import { getRandomEmojis } from './emojis';
import { getRandomFaceEmoji } from './face-emojis';
import { 
  getLobby, 
  setLobby 
} from './upstash-storage';


export async function createLobby(hostId: string, hostNickname: string): Promise<Lobby> {
  // Generate 4-character alphanumeric code (uppercase letters and numbers only)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const generateId = customAlphabet(alphabet, 4);
  const lobbyId = generateId();
  
  const lobby: Lobby = {
    id: lobbyId,
    hostId,
    players: [{
      id: hostId,
      nickname: hostNickname,
      avatar: getRandomFaceEmoji(),
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

export async function joinLobby(lobbyId: string, playerId: string, nickname: string): Promise<Lobby | null> {
  const lobby = await getLobby(lobbyId);
  if (!lobby || lobby.gameState !== 'waiting') {
    return null;
  }
  
  // Check if player already exists
  if (lobby.players.find(p => p.id === playerId)) {
    return lobby;
  }
  
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

export { getLobby } from './upstash-storage';

export function generateRound(roundNumber: number): Round {
  const CANVAS_WIDTH = 2400; // Increased width for more columns
  const CANVAS_HEIGHT = 1200; // Increased height for more rows
  const EMOJI_SIZE = 48; // Slightly smaller to fit more
  const TOP_MARGIN = 120; // Account for fixed header
  const BOTTOM_MARGIN = 80; // Account for fixed footer
  const PADDING = 15;
  
  // Calculate grid dimensions first
  const availableWidth = CANVAS_WIDTH - (2 * PADDING);
  const availableHeight = CANVAS_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN - PADDING;
  const horizontalSpacing = EMOJI_SIZE + 8; // 8px horizontal gap
  const verticalSpacing = EMOJI_SIZE + 8; // 8px vertical gap
  const cols = Math.floor(availableWidth / horizontalSpacing);
  const rows = Math.floor(availableHeight / verticalSpacing);
  
  // Calculate total emojis to fill the grid completely
  const EMOJI_COUNT = cols * rows; // Fill entire grid
  
  const emojis = getRandomEmojis(EMOJI_COUNT);
  const targetEmoji = emojis[0];
  const positions: EmojiPosition[] = [];
  
  // Create positions array filling the entire grid
  const gridPositions: Array<{x: number, y: number}> = [];
  
  // Calculate the actual space used by the grid
  const actualGridWidth = cols * horizontalSpacing - 8; // Subtract last gap
  const actualGridHeight = rows * verticalSpacing - 8; // Subtract last gap
  
  // Center the grid in the available space
  const startX = (CANVAS_WIDTH - actualGridWidth) / 2;
  const startY = TOP_MARGIN + (availableHeight - actualGridHeight) / 2;
  
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
  
  // Shuffle positions
  const shuffledPositions = gridPositions.sort(() => Math.random() - 0.5).slice(0, EMOJI_COUNT);
  
  // Place all emojis including target
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
    endTime: Date.now() + 30000, // 30 seconds for testing
    foundBy: [],
  };
}




export async function updateLobbyState(lobbyId: string, state: Lobby['gameState']): Promise<void> {
  const lobby = await getLobby(lobbyId);
  if (lobby) {
    lobby.gameState = state;
    await setLobby(lobby);
  }
}

export async function nextRound(lobbyId: string): Promise<void> {
  const lobby = await getLobby(lobbyId);
  if (!lobby) return;
  
  if (lobby.currentRound >= 5) {
    lobby.gameState = 'finished';
  } else {
    lobby.currentRound++;
    lobby.gameState = 'countdown';
    lobby.countdownStartTime = Date.now();
  }
  
  await setLobby(lobby);
}