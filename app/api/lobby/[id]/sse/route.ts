import { NextRequest } from 'next/server';
import { getLobby } from '@/app/lib/game-state-async';
import { setex, del, lrange, rpush } from '@/app/lib/upstash-redis';
import { checkDisconnectedPlayers } from '@/app/lib/player-heartbeat';

// Edge runtime for unlimited SSE duration
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// SSE headers
const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const lobbyId = params.id;
  const playerId = request.nextUrl.searchParams.get('playerId');
  
  if (!playerId) {
    return new Response('Player ID required', { status: 400 });
  }

  // Verify lobby exists
  const lobby = await getLobby(lobbyId);
  if (!lobby) {
    return new Response('Lobby not found', { status: 404 });
  }

  // Verify player is in lobby
  const player = lobby.players.find(p => p.id === playerId);
  if (!player) {
    return new Response('Player not in lobby', { status: 403 });
  }

  const encoder = new TextEncoder();


  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      let isConnectionClosed = false;
      
      // Send initial connection event
      const connectionEvent = `event: connected\ndata: ${JSON.stringify({ 
        playerId, 
        lobbyId,
        isHost: lobby.hostId === playerId 
      })}\n\n`;
      controller.enqueue(encoder.encode(connectionEvent));
      
      // Send initial keepalive comment to establish connection
      controller.enqueue(encoder.encode(': keepalive\n\n'));

      // Track last successful write
      let lastSuccessfulWrite = Date.now();
      
      // Set up heartbeat (every 2 seconds)
      const heartbeatInterval = setInterval(async () => {
        if (isConnectionClosed) {
          clearInterval(heartbeatInterval);
          return;
        }
        
        try {
          // Send keepalive comment first to keep connection alive
          controller.enqueue(encoder.encode(': keepalive\n\n'));
          
          // Try to send heartbeat - this will fail if connection is closed
          controller.enqueue(encoder.encode(`event: heartbeat\ndata: ${Date.now()}\n\n`));
          
          // Update last successful write time
          lastSuccessfulWrite = Date.now();
          
          // Only update Redis heartbeat if we successfully sent the heartbeat
          // Reduced TTL to 8 seconds (cleanup runs every 3 seconds, checks for 5+ second old heartbeats)
          await setex(`player:${lobbyId}:${playerId}:heartbeat`, 8, Date.now().toString());
        } catch (error) {
          // Connection closed, stop everything immediately
          isConnectionClosed = true;
          clearInterval(heartbeatInterval);
          clearInterval(pollInterval);
          return;
        }
        
        // If we haven't had a successful write in 10 seconds, assume connection is dead
        if (Date.now() - lastSuccessfulWrite > 10000) {
          isConnectionClosed = true;
          clearInterval(heartbeatInterval);
          clearInterval(pollInterval);
        }
      }, 2000);

      // Poll Redis for lobby events
      let lastEventTimestamp = 0;
      let lastCleanupCheck = Date.now();
      const pollInterval = setInterval(async () => {
        if (isConnectionClosed) {
          clearInterval(pollInterval);
          return;
        }
        
        try {
          // Get events for this lobby
          const events = await lrange(`lobby:${lobbyId}:events`, 0, -1) as any[];
          
          // Send any new events
          for (const event of events) {
            // Upstash automatically parses JSON, no need for JSON.parse
            
            // Only send events newer than what we've already sent
            if (event.timestamp > lastEventTimestamp) {
              try {
                // This will throw if connection is closed
                controller.enqueue(
                  encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`)
                );
                lastEventTimestamp = event.timestamp;
              } catch (error) {
                // Connection closed, stop polling
                isConnectionClosed = true;
                clearInterval(heartbeatInterval);
                clearInterval(pollInterval);
                return;
              }
            }
          }
          
          // Run heartbeat cleanup every 3 seconds
          if (Date.now() - lastCleanupCheck > 3000) {
            lastCleanupCheck = Date.now();
            await checkDisconnectedPlayers(lobbyId);
          }
          
          // Clean up old events (older than 5 seconds)
          const cutoffTime = Date.now() - 5000;
          const validEvents = events
            .filter(e => e.timestamp > cutoffTime);
          
          if (validEvents.length !== events.length) {
            await del(`lobby:${lobbyId}:events`);
            if (validEvents.length > 0) {
              await rpush(
                `lobby:${lobbyId}:events`,
                ...validEvents
              );
            }
          }
        } catch (error) {
          // Connection closed or error
          // Connection closed, stop everything immediately
          isConnectionClosed = true;
          clearInterval(heartbeatInterval);
          clearInterval(pollInterval);
          return;
        }
      }, 200); // Poll every 200ms

      // Handle connection close
      request.signal.addEventListener('abort', async () => {
        isConnectionClosed = true;
        clearInterval(heartbeatInterval);
        clearInterval(pollInterval);
        
        // Delete heartbeat immediately when connection aborts
        await del(`player:${lobbyId}:${playerId}:heartbeat`);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: SSE_HEADERS,
  });
}