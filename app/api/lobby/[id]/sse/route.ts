import { NextRequest } from 'next/server';
import { getLobby } from '@/app/lib/ioredis-storage';
import { setex, del, lrange, rpush, quit } from '@/app/lib/ioredis-client';
import { checkDisconnectedPlayers } from '@/app/lib/player-heartbeat';
import { SessionManager } from '@/app/lib/player-session';
import { logger } from '@/app/lib/logger';
import {
  getPollingInterval,
  getPriorityPollingInterval,
  HEARTBEAT,
  CONNECTION_LIMITS,
  EVENT_QUEUE,
} from '@/app/lib/redis-optimization';
/**
 * Server-Sent Events (SSE) endpoint for real-time lobby updates
 *
 * @description This endpoint establishes a persistent connection to stream real-time
 * game events to connected players. It handles heartbeats, player disconnections,
 * and event broadcasting. Uses Node.js runtime with ioredis for efficient Redis
 * operations and implements graceful reconnection every 4 minutes.
 *
 * Key features:
 * - Real-time event streaming for game state updates
 * - Automatic heartbeat monitoring (every 2 seconds)
 * - Player disconnection detection and cleanup
 * - Event queue management with automatic cleanup
 * - Connection resilience with keepalive messages
 */

// Use Node.js runtime for ioredis support
// Implement graceful reconnection every 4 minutes to avoid 5-minute timeout
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

// Standard SSE headers for proper streaming
const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no', // Disable Nginx buffering
};

/**
 * Establishes SSE connection for real-time updates
 *
 * @param request - The incoming request (session authentication via cookies)
 * @param params - Route parameters containing lobby ID
 *
 * @returns SSE stream for real-time events
 *
 * @example
 * GET /api/lobby/ABC123/sse
 *
 * Event types sent:
 * - connected: Initial connection confirmation
 * - heartbeat: Periodic keepalive signal
 * - player_joined: New player joined lobby
 * - player_left: Player left lobby
 * - game_started: Game has begun
 * - round_started: New round started
 * - emoji_found: Target emoji was found
 * - round_ended: Round completed
 * - game_ended: Game finished
 *
 * @throws {401} If no valid session exists
 * @throws {404} If lobby doesn't exist
 * @throws {403} If player is not in the lobby
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const lobbyId = params.id;

  // Get session from cookies
  const sessionData = await SessionManager.getSessionFromCookies();
  if (!sessionData) {
    return new Response('Unauthorized - no valid session', { status: 401 });
  }

  const { session } = sessionData;
  const playerId = session.playerId;

  // Verify lobby exists
  const lobby = await getLobby(lobbyId);
  if (!lobby) {
    return new Response('Lobby not found', { status: 404 });
  }

  // Verify player is authorized to connect
  const player = lobby.players.find((p) => p.id === playerId);
  if (!player) {
    return new Response('Player not in lobby', { status: 403 });
  }

  const encoder = new TextEncoder();

  /**
   * Creates the SSE stream with heartbeat and event polling
   *
   * The stream handles:
   * 1. Initial connection setup and authentication
   * 2. Periodic heartbeats to detect disconnections
   * 3. Polling Redis for new events to broadcast
   * 4. Automatic cleanup of old events and disconnected players
   */
  const stream = new ReadableStream({
    async start(controller) {
      let isConnectionClosed = false;

      // Set up disconnect timer to avoid timeout
      const disconnectTimer = setTimeout(async () => {
        logger.info('SSE connection closing for graceful reconnection', {
          lobbyId,
          playerId,
        });

        // Update heartbeat before disconnecting to prevent removal from lobby
        try {
          await setex(
            `player:${lobbyId}:${playerId}:heartbeat`,
            HEARTBEAT.TTL,
            Date.now().toString()
          );
        } catch (e) {
          logger.error('Failed to update heartbeat before reconnect', e);
        }

        // Send reconnect event to client
        try {
          controller.enqueue(
            encoder.encode(
              'event: reconnect\ndata: {"reason": "scheduled"}\n\n'
            )
          );
        } catch (e) {
          // Ignore if controller is already closed
        }

        // Clean up
        isConnectionClosed = true;
        controller.close();
      }, CONNECTION_LIMITS.RECONNECT_INTERVAL);

      logger.info('SSE connection established with ioredis', {
        lobbyId,
        playerId,
      });

      // Send initial connection confirmation with player status
      const connectionEvent = `event: connected\ndata: ${JSON.stringify({
        playerId,
        lobbyId,
        isHost: lobby.hostId === playerId,
      })}\n\n`;
      controller.enqueue(encoder.encode(connectionEvent));

      // SSE comment syntax - keeps connection alive
      controller.enqueue(encoder.encode(': keepalive\n\n'));

      // Track connection health
      let lastSuccessfulWrite = Date.now();

      /**
       * Heartbeat mechanism
       * - Sends keepalive every 2 seconds
       * - Updates Redis to mark player as active
       * - Detects closed connections via write failures
       */
      const heartbeatInterval = setInterval(async () => {
        if (isConnectionClosed) {
          clearInterval(heartbeatInterval);
          return;
        }

        try {
          // SSE comment keeps proxies from timing out
          controller.enqueue(encoder.encode(': keepalive\n\n'));

          // Actual heartbeat event for client
          controller.enqueue(
            encoder.encode(`event: heartbeat\ndata: ${Date.now()}\n\n`)
          );

          lastSuccessfulWrite = Date.now();

          // Update Redis heartbeat with optimized TTL
          await setex(
            `player:${lobbyId}:${playerId}:heartbeat`,
            HEARTBEAT.TTL,
            Date.now().toString()
          );
        } catch (error) {
          // Write failed = connection closed
          isConnectionClosed = true;
          clearInterval(heartbeatInterval);
          clearInterval(pollInterval);
          return;
        }

        // Failsafe: mark dead if no writes for 10s
        if (Date.now() - lastSuccessfulWrite > 10000) {
          isConnectionClosed = true;
          clearInterval(heartbeatInterval);
          clearInterval(pollInterval);
        }
      }, HEARTBEAT.INTERVAL);

      /**
       * Event polling mechanism
       * - Polls Redis every 200ms for new events
       * - Sends only new events to prevent duplicates
       * - Runs periodic cleanup tasks
       */
      // Initialize timestamp to 2 seconds ago to catch very recent events
      // This ensures we get immediate updates when reconnecting
      let lastEventTimestamp = Date.now() - 2000;
      let lastCleanupCheck = Date.now();

      logger.info('Starting SSE polling', { lobbyId, playerId });

      const pollInterval = setInterval(async () => {
        if (isConnectionClosed) {
          clearInterval(pollInterval);
          return;
        }

        try {
          // Fetch all events from Redis event queue
          const redisKey = `lobby:${lobbyId}:events`;
          const events = (await lrange(redisKey, 0, -1)) as any[];

          // Only process events newer than our last timestamp
          const newEvents = events.filter(
            (event) => event.timestamp > lastEventTimestamp
          );

          if (newEvents.length > 0) {
            logger.debug('Processing new events', {
              lobbyId,
              newEventCount: newEvents.length,
              totalEvents: events.length,
            });
          }

          // Broadcast new events to this client
          for (const event of newEvents) {
            try {
              // Send SSE formatted event
              const sseMessage = `event: ${event.type}\ndata: ${JSON.stringify(
                event.data
              )}\n\n`;
              logger.debug('Sending SSE event', { type: event.type });
              controller.enqueue(encoder.encode(sseMessage));
              lastEventTimestamp = event.timestamp;
            } catch (error) {
              // Write failed = connection closed
              isConnectionClosed = true;
              clearInterval(heartbeatInterval);
              clearInterval(pollInterval);
              return;
            }
          }

          // Periodic cleanup task (optimized interval)
          if (
            Date.now() - lastCleanupCheck >
            EVENT_QUEUE.CLEANUP_INTERVAL
          ) {
            lastCleanupCheck = Date.now();
            // Check for and remove disconnected players
            await checkDisconnectedPlayers(lobbyId);
          }

          // Event queue cleanup - remove old events
          const cutoffTime =
            Date.now() - EVENT_QUEUE.MAX_AGE;
          const validEvents = events.filter((e) => e.timestamp > cutoffTime);

          // Rewrite queue if we removed old events
          if (validEvents.length !== events.length) {
            await del(`lobby:${lobbyId}:events`);
            if (validEvents.length > 0) {
              await rpush(`lobby:${lobbyId}:events`, ...validEvents);
            }
          }
        } catch (error) {
          // Fatal error - close everything
          isConnectionClosed = true;
          clearInterval(heartbeatInterval);
          clearInterval(pollInterval);
          try {
            controller.close();
          } catch (e) {
            // Controller already closed
          }
          return;
        }
      }, getPriorityPollingInterval(lobby.gameState) || getPollingInterval(lobby.gameState)); // Priority polling for critical states

      /**
       * Connection cleanup handler
       * - Triggered when client disconnects
       * - Immediately removes player heartbeat
       * - Stops all intervals to prevent memory leaks
       */
      request.signal.addEventListener('abort', async () => {
        isConnectionClosed = true;
        clearInterval(heartbeatInterval);
        clearInterval(pollInterval);
        clearTimeout(disconnectTimer);

        // Immediately mark player as disconnected
        await del(`player:${lobbyId}:${playerId}:heartbeat`);
        try {
          controller.close();
        } catch (e) {
          // Controller already closed
        }
      });
    },
  });

  // Return the SSE stream with proper headers
  return new Response(stream, {
    headers: SSE_HEADERS,
  });
}
