import { logger } from './logger/client';

/**
 * SSE Event Handler Interface
 * 
 * @description Defines callback functions for all possible server-sent events.
 * Each handler receives event-specific data and is optional.
 */
export interface SSEEventHandler {
  /** Fired when SSE connection is established */
  onConnected?: (data: { playerId: string; lobbyId: string; isHost: boolean }) => void;
  /** New player joined the lobby */
  onPlayerJoined?: (data: { lobby: any; playerId: string }) => void;
  /** Player disconnected or left */
  onPlayerLeft?: (data: { playerId: string; lobby: any }) => void;
  /** Game transitioned to countdown state */
  onGameStarted?: (data: { countdownStartTime: number; currentRound: number }) => void;
  /** Round data preloaded during countdown */
  onRoundPreloaded?: (data: { round: any; currentRound: number }) => void;
  /** Round began (playing state) */
  onRoundStarted?: (data: { round: any; currentRound: number }) => void;
  /** Round completed */
  onRoundEnded?: (data: { round: number; targetEmoji: string; scores: any[] }) => void;
  /** Player found the target emoji */
  onEmojiFound?: (data: { playerId: string; points: number; foundCount: number; totalPlayers: number; emojiId: string }) => void;
  /** Player clicked wrong emoji */
  onWrongEmoji?: (data: { playerId: string; clickedEmoji?: string }) => void;
  /** All rounds complete */
  onGameEnded?: (data: { finalScores: any[]; winners: any[] }) => void;
  /** Game reset to waiting state */
  onGameReset?: (data: { lobby: any }) => void;
  /** General lobby state update */
  onLobbyUpdated?: (data: { lobby: any }) => void;
  /** Not enough players to continue */
  onNotEnoughPlayers?: (data: { message: string }) => void;
  /** Heartbeat pulse for connection monitoring */
  onHeartbeat?: (timestamp: number) => void;
  /** Connection or other errors */
  onError?: (error: Error) => void;
}

/**
 * Server-Sent Events Client
 * 
 * @description Manages real-time connection to the game server using SSE.
 * Handles automatic reconnection, heartbeat monitoring, and event distribution.
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Proactive reconnection before 5-minute timeout
 * - Event handler registration and management
 * - Connection state tracking
 */
export class SSEClient {
  private eventSource: EventSource | null = null;
  private handlers: SSEEventHandler = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Base delay in ms
  private lobbyId: string;
  private connectionTimer: NodeJS.Timeout | null = null;
  private isIntentionalReconnect = false;

  /**
   * Creates a new SSE client instance
   * 
   * @param {string} lobbyId - Target lobby to connect to
   */
  constructor(lobbyId: string, playerId?: string) {
    this.lobbyId = lobbyId;
    // playerId parameter kept for compatibility but ignored
  }

  /**
   * Initiates SSE connection with event handlers
   * 
   * @param {SSEEventHandler} handlers - Object containing event callbacks
   */
  connect(handlers: SSEEventHandler): void {
    this.handlers = handlers;
    this.establishConnection();
  }

  /**
   * Establishes the SSE connection and sets up event listeners
   * 
   * @description Creates EventSource connection, registers all event handlers,
   * and sets up proactive reconnection to prevent server-side timeouts.
   * 
   * Reconnection strategy:
   * - Proactive: Reconnects at 4.5 minutes (before 5-minute server timeout)
   * - Reactive: Reconnects on errors with exponential backoff
   */
  private establishConnection(): void {
    // Close existing connection if any
    if (this.eventSource) {
      this.eventSource.close();
    }

    // Clear any existing connection timer
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }

    // Session cookie will identify the player
    const url = `/api/lobby/${this.lobbyId}/sse`;
    logger.info('SSE Client: Establishing connection', { url });
    this.eventSource = new EventSource(url);
    
    // Set up proactive reconnection before 5-minute timeout (reconnect at 4.5 minutes)
    // This prevents the server from closing the connection due to inactivity
    this.connectionTimer = setTimeout(() => {
      logger.info('SSE: Proactive reconnection to prevent timeout');
      this.isIntentionalReconnect = true;
      this.eventSource?.close();
      this.establishConnection();
    }, 4.5 * 60 * 1000); // 4.5 minutes

    this.eventSource.addEventListener('connected', (event) => {
      logger.info('SSE Client: Connected to SSE', { data: event.data });
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
      logger.info('SSE Client: Received game-started event', { data: event.data });
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

    /**
     * Error handler with automatic reconnection logic
     * 
     * Implements exponential backoff:
     * - 1st attempt: 1 second
     * - 2nd attempt: 2 seconds
     * - 3rd attempt: 3 seconds
     * - etc., up to 5 attempts
     */
    this.eventSource.onerror = () => {
      // Check if the connection was closed intentionally
      if (this.eventSource?.readyState === EventSource.CLOSED || this.isIntentionalReconnect) {
        this.isIntentionalReconnect = false;
        return;
      }
      
      this.handlers.onError?.(new Error('SSE connection error'));
      
      // Attempt to reconnect with exponential backoff
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

  /**
   * Closes the SSE connection and cleans up resources
   * 
   * @description Properly closes EventSource and clears all timers.
   * Should be called when leaving a lobby or unmounting components.
   */
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

  /**
   * Checks if the SSE connection is currently open
   * 
   * @returns {boolean} True if connected, false otherwise
   */
  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}