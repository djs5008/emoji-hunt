export interface Player {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  roundScores: RoundScore[];
  isHost: boolean;
}

export interface RoundScore {
  round: number;
  timeToFind: number | null;
  points: number;
}

export interface Lobby {
  id: string;
  hostId: string;
  players: Player[];
  gameState: 'waiting' | 'countdown' | 'playing' | 'roundEnd' | 'finished';
  currentRound: number;
  rounds: Round[];
  countdownStartTime?: number; // When countdown started (for resuming after refresh)
  roundEndTime?: number; // When round ended (for timing transitions)
  nextPhaseTime?: number; // When the next game phase should execute
}

export interface Round {
  number: number;
  targetEmoji: string;
  emojiPositions: EmojiPosition[];
  startTime: number;
  endTime: number;
  foundBy: { playerId: string; timestamp: number }[];
  canvasBase64?: string; // Server-rendered canvas for client display
}

export interface EmojiPosition {
  emoji: string;
  x: number;
  y: number;
  fontSize: number;
  id: string;
}

export interface GameMessage {
  type:
    | 'playerJoined'
    | 'playerLeft'
    | 'gameStarted'
    | 'roundStarted'
    | 'roundEnded'
    | 'emojiFound'
    | 'gameEnded'
    | 'lobbyUpdate'
    | 'connected'
    | 'gameReset'
    | 'allPlayersFound'
    | 'notEnoughPlayers'
    | 'wrongEmoji';
  data: any;
}
