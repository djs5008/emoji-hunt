/**
 * Game Type Definitions
 * 
 * @description Core TypeScript interfaces defining the structure of game data.
 * These types ensure type safety across the application and provide clear
 * documentation of data structures.
 */

/**
 * Player representation in the game
 */
export interface Player {
  id: string;              // Unique player identifier (nanoid)
  nickname: string;        // Display name chosen by player
  avatar: string;          // Face emoji for visual identification
  score: number;           // Total accumulated score
  roundScores: RoundScore[]; // Performance history per round
  isHost: boolean;         // Whether player can control game
}

/**
 * Individual round performance record
 */
export interface RoundScore {
  round: number;           // Round number (1-5)
  timeToFind: number | null; // Seconds to find target (null if not found)
  points: number;          // Points earned this round
}

/**
 * Game lobby containing all game state
 */
export interface Lobby {
  id: string;              // 4-character lobby code
  hostId: string;          // Player ID of current host
  players: Player[];       // All connected players
  gameState: 'waiting' | 'countdown' | 'playing' | 'roundEnd' | 'finished';
  currentRound: number;    // Current round number (0 = not started)
  rounds: Round[];         // Data for each round
  
  // Timing fields for state transitions
  countdownStartTime?: number; // Unix timestamp when countdown began
  roundEndTime?: number;       // Unix timestamp when round ended
}

/**
 * Single round of gameplay
 */
export interface Round {
  number: number;          // Round number (1-5)
  targetEmoji: string;     // The emoji players must find
  emojiPositions: EmojiPosition[]; // All emojis on the canvas
  startTime: number;       // Unix timestamp when round started
  endTime: number;         // Unix timestamp when round should end
  foundBy: { playerId: string; timestamp: number }[]; // Who found it and when
}

/**
 * Position data for a single emoji on the canvas
 */
export interface EmojiPosition {
  emoji: string;           // The emoji character
  x: number;               // Canvas X coordinate
  y: number;               // Canvas Y coordinate
  fontSize: number;        // Size in pixels
  id: string;              // Unique identifier for click detection
}

