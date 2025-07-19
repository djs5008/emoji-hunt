export interface SSEEventHandler {
  onConnected?: (data: { playerId: string; lobbyId: string; isHost: boolean }) => void;
  onPlayerJoined?: (data: { lobby: any; playerId: string }) => void;
  onPlayerLeft?: (data: { playerId: string; lobby: any }) => void;
  onGameStarted?: (data: { countdownStartTime: number; currentRound: number }) => void;
  onRoundPreloaded?: (data: { round: any; currentRound: number }) => void;
  onRoundStarted?: (data: { round: any; currentRound: number }) => void;
  onRoundEnded?: (data: { round: number; targetEmoji: string; scores: any[] }) => void;
  onEmojiFound?: (data: { playerId: string; points: number; foundCount: number; totalPlayers: number; emojiId: string }) => void;
  onWrongEmoji?: (data: { playerId: string; clickedEmoji?: string }) => void;
  onGameEnded?: (data: { finalScores: any[]; winners: any[] }) => void;
  onGameReset?: (data: { lobby: any }) => void;
  onLobbyUpdated?: (data: { lobby: any }) => void;
  onNotEnoughPlayers?: (data: { message: string }) => void;
  onHeartbeat?: (timestamp: number) => void;
  onError?: (error: Error) => void;
}

export class SSEClient {
  private eventSource: EventSource | null = null;
  private handlers: SSEEventHandler = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private lobbyId: string;
  private playerId: string;
  private connectionTimer: NodeJS.Timeout | null = null;
  private isIntentionalReconnect = false;

  constructor(lobbyId: string, playerId: string) {
    this.lobbyId = lobbyId;
    this.playerId = playerId;
  }

  connect(handlers: SSEEventHandler): void {
    this.handlers = handlers;
    this.establishConnection();
  }

  private establishConnection(): void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    // Clear any existing connection timer
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }

    const url = `/api/lobby/${this.lobbyId}/sse?playerId=${this.playerId}`;
    this.eventSource = new EventSource(url);
    
    // Set up proactive reconnection before 5-minute timeout (reconnect at 4.5 minutes)
    this.connectionTimer = setTimeout(() => {
      console.log('[SSE] Proactive reconnection to prevent timeout...');
      this.isIntentionalReconnect = true;
      this.eventSource?.close();
      this.establishConnection();
    }, 4.5 * 60 * 1000); // 4.5 minutes

    this.eventSource.addEventListener('connected', (event) => {
      this.reconnectAttempts = 0;
      const data = JSON.parse(event.data);
      this.handlers.onConnected?.(data);
    });

    this.eventSource.addEventListener('player-joined', (event) => {
      const data = JSON.parse(event.data);
      this.handlers.onPlayerJoined?.(data);
    });

    this.eventSource.addEventListener('player-left', (event) => {
      const data = JSON.parse(event.data);
      this.handlers.onPlayerLeft?.(data);
    });

    this.eventSource.addEventListener('game-started', (event) => {
      const data = JSON.parse(event.data);
      this.handlers.onGameStarted?.(data);
    });

    this.eventSource.addEventListener('round-started', (event) => {
      const data = JSON.parse(event.data);
      this.handlers.onRoundStarted?.(data);
    });

    this.eventSource.addEventListener('round-ended', (event) => {
      const data = JSON.parse(event.data);
      this.handlers.onRoundEnded?.(data);
    });

    this.eventSource.addEventListener('emoji-found', (event) => {
      const data = JSON.parse(event.data);
      this.handlers.onEmojiFound?.(data);
    });

    this.eventSource.addEventListener('wrong-emoji', (event) => {
      const data = JSON.parse(event.data);
      this.handlers.onWrongEmoji?.(data);
    });

    this.eventSource.addEventListener('game-ended', (event) => {
      const data = JSON.parse(event.data);
      this.handlers.onGameEnded?.(data);
    });

    this.eventSource.addEventListener('game-reset', (event) => {
      const data = JSON.parse(event.data);
      this.handlers.onGameReset?.(data);
    });

    this.eventSource.addEventListener('lobby-updated', (event) => {
      const data = JSON.parse(event.data);
      this.handlers.onLobbyUpdated?.(data);
    });

    this.eventSource.addEventListener('roundPreloaded', (event) => {
      const data = JSON.parse(event.data);
      this.handlers.onRoundPreloaded?.(data);
    });

    this.eventSource.addEventListener('notEnoughPlayers', (event) => {
      const data = JSON.parse(event.data);
      this.handlers.onNotEnoughPlayers?.(data);
    });

    this.eventSource.addEventListener('heartbeat', (event) => {
      const timestamp = parseInt(event.data);
      this.handlers.onHeartbeat?.(timestamp);
    });

    this.eventSource.onerror = (error) => {
      // Check if the connection was closed intentionally
      if (this.eventSource?.readyState === EventSource.CLOSED || this.isIntentionalReconnect) {
        this.isIntentionalReconnect = false;
        return;
      }
      
      this.handlers.onError?.(new Error('SSE connection error'));
      
      // Attempt to reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        
        // Close the current connection before reconnecting
        this.eventSource?.close();
        
        setTimeout(() => {
          this.establishConnection();
        }, this.reconnectDelay * this.reconnectAttempts);
      }
    };
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    // Clear the connection timer
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}