/**
 * Lobby Page Component
 * 
 * @description The main game page that handles:
 * - Game state management (waiting, countdown, playing, scores)
 * - Real-time updates via Server-Sent Events (SSE)
 * - Player interactions (emoji clicking, starting games)
 * - Host controls and permissions
 * - Responsive layout for mobile and desktop
 * 
 * This is the most complex component in the application, managing
 * the entire game lifecycle and real-time multiplayer interactions.
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import GameCanvas from '@/app/components/GameCanvas';
import Countdown from '@/app/components/Countdown';
import Scoreboard from '@/app/components/Scoreboard';
import EmojiBackground from '@/app/components/EmojiBackground';
import { Button } from '@/app/components/Button';
import { Lobby } from '@/app/types/game';
import { SSEClient } from '@/app/lib/sse-client';
import { logger } from '@/app/lib/logger/client';
import { audioManager, SoundType } from '@/app/lib/audio-manager';
// Session management is now handled server-side

/**
 * Main lobby/game page component
 * 
 * @description Manages the entire game experience from lobby waiting
 * to gameplay and final scores. Handles real-time synchronization
 * across all connected players.
 */
export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const lobbyId = params.id as string;

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const playerIdRef = useRef<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showRoundScore, setShowRoundScore] = useState(false);
  const [showFinalScore, setShowFinalScore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foundCount, setFoundCount] = useState<number>(0);
  const [roundTime, setRoundTime] = useState<number>(30);
  const [showSuccess, setShowSuccess] = useState(false);
  const [clickPosition, setClickPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [showWrongEmoji, setShowWrongEmoji] = useState(false);
  const [wrongEmojiClicked, setWrongEmojiClicked] = useState<string | null>(null);
  const [playerFoundEmojiId, setPlayerFoundEmojiId] = useState<string | null>(
    null
  );
  const [startingGame, setStartingGame] = useState(false);
  const [scoreAnimation, setScoreAnimation] = useState<{ points: number; id: number } | null>(null);
  const [displayScore, setDisplayScore] = useState<number | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [hasRejoined, setHasRejoined] = useState(false);
  
  const sseClientRef = useRef<SSEClient | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const roundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startCountdownTimerRef = useRef<((startTime: number) => void) | null>(null);
  const stateTransitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lobbyRef = useRef<Lobby | null>(null);

  // Check and start round
  const checkAndStartRound = useCallback(async () => {
    
    // Get the latest lobby state
    try {
      const lobbyRes = await fetch(`/api/lobby/${lobbyId}`, {
        credentials: 'include'
      });
      const currentLobby = await lobbyRes.json();
      
      if (!currentLobby || currentLobby.error) {
        logger.error('Failed to get lobby state');
        return;
      }
      
      
      const res = await fetch('/api/game/check-round-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lobbyId, 
          roundNum: currentLobby.currentRound 
        }),
        credentials: 'include'
      });
      
      const data = await res.json();
    } catch (err) {
      logger.error('Failed to check round start', err);
    }
  }, [lobbyId]);

  // Preload round data
  const preloadRoundData = useCallback(async () => {
    
    try {
      const lobbyRes = await fetch(`/api/lobby/${lobbyId}`, {
        credentials: 'include'
      });
      const currentLobby = await lobbyRes.json();
      
      if (!currentLobby || currentLobby.error) {
        logger.error('Failed to get lobby state for preload');
        return;
      }
      
      const res = await fetch('/api/game/preload-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lobbyId, 
          roundNum: currentLobby.currentRound 
        }),
        credentials: 'include'
      });
      
      const data = await res.json();
    } catch (err) {
      logger.error('Failed to preload round', err);
    }
  }, [lobbyId]);

  // Check and end round
  const checkAndEndRound = useCallback(async (roundNum: number) => {
    try {
      const res = await fetch('/api/game/check-round-end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lobbyId, 
          roundNum 
        }),
        credentials: 'include'
      });
      
      const data = await res.json();
    } catch (err) {
      logger.error('Failed to check round end', err);
    }
  }, [lobbyId]);

  // Start countdown timer
  const startCountdownTimer = useCallback((startTime: number) => {
    logger.info('startCountdownTimer called', { startTime });
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    
    let hasPreloaded = false;

    const updateCountdown = () => {
      const elapsed = Date.now() - startTime;
      const totalMs = 3500; // Total countdown duration (3, 2, 1, GO! but Go is only 500ms)
      
      if (elapsed < totalMs) {
        // Calculate which number should be showing
        // 0-1000ms = 3, 1000-2000ms = 2, 2000-3000ms = 1, 3000-3500ms = 0 (GO!)
        const secondsElapsed = Math.floor(elapsed / 1000);
        const count = Math.max(0, 3 - secondsElapsed);
        setCountdown(count);
        
        // Preload round data when we hit "1" (2 seconds elapsed)
        if (secondsElapsed === 2 && !hasPreloaded) {
          hasPreloaded = true;
          preloadRoundData();
        }
      } else {
        setCountdown(null);
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        // Try to start the round
        checkAndStartRound();
      }
    };
    
    // Call immediately to set initial state
    updateCountdown();
    
    // Update more frequently for smoother synchronization
    countdownIntervalRef.current = setInterval(updateCountdown, 50);
  }, [checkAndStartRound, preloadRoundData]);

  // Start round timer
  const startRoundTimer = useCallback((startTime: number, currentRoundNum: number) => {
    if (roundTimerRef.current) {
      clearInterval(roundTimerRef.current);
    }

    const updateTimer = async () => {
      const remaining = Math.max(
        0,
        Math.ceil((startTime + 30000 - Date.now()) / 1000)
      );
      setRoundTime(remaining);

      if (remaining === 0 && roundTimerRef.current) {
        clearInterval(roundTimerRef.current);
        // Try to end the round
        try {
          const res = await fetch('/api/game/check-round-end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              lobbyId, 
              roundNum: currentRoundNum 
            }),
            credentials: 'include'
          });
          
          const data = await res.json();
        } catch (err) {
          console.error('[Game] Failed to check round end:', err);
        }
      }
    };

    updateTimer();
    roundTimerRef.current = setInterval(updateTimer, 100);
  }, [lobbyId]);

  // Check and progress after round end
  const checkAndProgress = useCallback(async (roundNum: number) => {
    try {
      const res = await fetch('/api/game/check-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lobbyId, 
          roundNum 
        }),
        credentials: 'include'
      });
      
      const data = await res.json();
    } catch (err) {
      console.error('[Game] Failed to check progress:', err);
    }
  }, [lobbyId]);

  // Schedule state transition
  const scheduleStateTransition = useCallback((type: string, roundNum: number, delay: number) => {
    if (stateTransitionTimeoutRef.current) {
      clearTimeout(stateTransitionTimeoutRef.current);
    }

    stateTransitionTimeoutRef.current = setTimeout(() => {
      if (type === 'progress') {
        checkAndProgress(roundNum);
      }
    }, delay);
  }, [checkAndProgress]);

  // Check if player is host
  useEffect(() => {
    const hostToken = sessionStorage.getItem(`host-${lobbyId}`);
    if (hostToken) {
      setIsHost(true);
    }
  }, [lobbyId]);

  // Keep refs in sync
  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);
  
  useEffect(() => {
    lobbyRef.current = lobby;
  }, [lobby]);

  // Keep ref updated
  useEffect(() => {
    startCountdownTimerRef.current = startCountdownTimer;
  }, [startCountdownTimer]);

  // Initial lobby fetch and rejoin
  useEffect(() => {
    if (!lobbyId) return;

    logger.info('Starting rejoin process', { lobbyId });

    // First check if lobby exists
    fetch(`/api/lobby/${lobbyId}`, {
      credentials: 'include'
    })
      .then((res) => res.json())
      .then((lobbyData) => {
        logger.debug('Lobby fetch response', { lobbyData, hasError: !!lobbyData?.error });
        
        if (!lobbyData || lobbyData.error) {
          // Lobby doesn't exist - show error
          setError('This lobby doesn\'t exist');
          return null;
        }
        
        // Lobby exists, now check if player is in it
        return fetch('/api/lobby/rejoin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lobbyId }),
          credentials: 'include'
        })
          .then((res) => res.json())
          .then((rejoinData) => {
            logger.debug('Rejoin response', { rejoinData, hasError: !!rejoinData?.error });
            
            if (rejoinData.error) {
              // Check if it's a 'Lobby not found' error
              if (rejoinData.error === 'Lobby not found') {
                logger.warn('Lobby not found, redirecting to home', { lobbyId });
                router.push('/');
                return null;
              }
              
              // Player not in lobby but lobby exists - redirect to join
              logger.warn('Player not in lobby, redirecting to join', { 
                lobbyId, 
                error: rejoinData.error,
                playerId: rejoinData.playerId 
              });
              router.push(`/?join=${lobbyId}`);
              return null;
            }
            // Player is in lobby - mark as rejoined
            setHasRejoined(true);
            // Set the player ID from rejoin response
            if (rejoinData.playerId) {
              setPlayerId(rejoinData.playerId);
            }
            return rejoinData;
          });
      })
      .then((rejoinData) => {
        if (rejoinData === null) return; // Already redirected or errored
        
        const lobbyData = rejoinData.lobby;
        setLobby(lobbyData);
        
        // Check if player is actually the host based on lobby data
        if (lobbyData.hostId === rejoinData.playerId) {
          setIsHost(true);
        }

        // Restore UI state based on server timestamps
        const now = Date.now();
        
        logger.info('Restoring game state on rejoin', {
          gameState: lobbyData.gameState,
          currentRound: lobbyData.currentRound,
          countdownStartTime: lobbyData.countdownStartTime,
          roundEndTime: lobbyData.roundEndTime,
          now
        });
        
        if (lobbyData.gameState === 'finished') {
          setShowFinalScore(true);
        } else if (lobbyData.gameState === 'countdown' && lobbyData.countdownStartTime) {
          // Calculate where we are in the countdown (0-3.5 seconds)
          const countdownElapsed = now - lobbyData.countdownStartTime;
          
          if (countdownElapsed >= 3500) {
            // Countdown has expired - server still thinks we're in countdown
            // This player needs to trigger the round start
            logger.info('Countdown expired on rejoin, triggering round start', {
              elapsed: countdownElapsed,
              currentRound: lobbyData.currentRound
            });
            checkAndStartRound();
          } else {
            // Still in countdown - restore UI and timer
            const step = Math.floor(countdownElapsed / 1000);
            const count = Math.max(0, 3 - step);
            setCountdown(count);
            startCountdownTimer(lobbyData.countdownStartTime);
          }
        } else if (lobbyData.gameState === 'playing' && lobbyData.rounds?.length > 0) {
          // Calculate remaining round time
          const currentRound = lobbyData.rounds[lobbyData.currentRound - 1];
          if (currentRound?.startTime) {
            const roundElapsed = now - currentRound.startTime;
            
            if (roundElapsed >= 30000) {
              // Round time has expired - server still thinks we're playing
              // This player needs to trigger the round end
              logger.info('Round time expired on rejoin, triggering round end', {
                elapsed: roundElapsed,
                roundNum: lobbyData.currentRound
              });
              checkAndEndRound(lobbyData.currentRound);
            } else {
              // Still playing - restore timer
              const remaining = Math.ceil((30000 - roundElapsed) / 1000);
              setRoundTime(remaining);
              startRoundTimer(currentRound.startTime, lobbyData.currentRound);
            }
          }
        } else if (lobbyData.gameState === 'roundEnd' && lobbyData.roundEndTime) {
          // Calculate where we are in the round end sequence
          const roundEndElapsed = now - lobbyData.roundEndTime;
          const totalDisplayTime = lobbyData.currentRound === 5 ? 3000 : 6000; // Final round: 3s, others: 6s
          
          if (roundEndElapsed >= totalDisplayTime) {
            // Display time has expired - server still in roundEnd
            // This player needs to trigger progression
            logger.info('Round end display expired on rejoin, triggering progression', {
              elapsed: roundEndElapsed,
              roundNum: lobbyData.currentRound,
              totalDisplayTime
            });
            checkAndProgress(lobbyData.currentRound);
          } else if (roundEndElapsed < 3000) {
            // Show answer phase (0-3 seconds)
            setShowCorrectAnswer(true);
            const remainingAnswerTime = 3000 - roundEndElapsed;
            
            if (lobbyData.currentRound === 5) {
              // Final round - schedule progression after answer
              scheduleStateTransition('progress', lobbyData.currentRound, remainingAnswerTime);
            } else {
              // Rounds 1-4 - will show scoreboard after answer
              scheduleStateTransition('progress', lobbyData.currentRound, 6000 - roundEndElapsed);
            }
          } else if (lobbyData.currentRound < 5) {
            // Show scoreboard phase (3-6 seconds) - only for rounds 1-4
            setShowRoundScore(true);
            scheduleStateTransition('progress', lobbyData.currentRound, 6000 - roundEndElapsed);
          }
        }
      })
      .catch(() => {
        // On any error, show error message
        setError('Failed to load lobby');
      });
  }, [lobbyId, router, startCountdownTimer, startRoundTimer, scheduleStateTransition, checkAndProgress, checkAndStartRound, checkAndEndRound]);

  // Connect to SSE only after successful rejoin
  useEffect(() => {
    if (!lobbyId || error || !hasRejoined) return;

    logger.info('Lobby: Setting up SSE connection', { lobbyId });
    const sseClient = new SSEClient(lobbyId, 'session'); // Use 'session' as placeholder
    sseClientRef.current = sseClient;

    sseClient.connect({
      onConnected: async (data) => {
          setIsHost(data.isHost);
        setPlayerId(data.playerId); // Set the actual player ID from SSE
        setError(null); // Clear any connection errors
        
        // Fetch current lobby state after reconnection
        try {
          const response = await fetch(`/api/lobby/${lobbyId}`, {
            credentials: 'include'
          });
          if (response.ok) {
            const lobbyData = await response.json();
            setLobby(lobbyData);
            // Set basic state based on lobby data
            if (lobbyData.gameState === 'finished') {
              setShowFinalScore(true);
            }
          }
        } catch (err) {
          logger.error('Failed to fetch lobby after SSE reconnection', err as Error);
        }
      },
      
      onPlayerJoined: (data) => {
        setLobby(data.lobby);
      },
      
      onPlayerLeft: (data) => {
        setLobby(data.lobby);
      },
      
      onGameStarted: (data) => {
        logger.info('Lobby: Game started event received', data);
        
        // Check if this is a stale event by comparing with current lobby state
        setLobby((prev) => {
          if (!prev) return null;
          
          // If we're already past this round, ignore this stale game-started event
          if (prev.currentRound > data.currentRound) {
            logger.debug('Ignoring stale game-started event', {
              currentRound: prev.currentRound,
              eventRound: data.currentRound,
              currentState: prev.gameState
            });
            return prev;
          }
          
          // If we're already in this round and not waiting for it to start, ignore the event
          // This handles cases where we refresh during an active round
          if (prev.currentRound === data.currentRound && 
              prev.gameState !== 'waiting') {
            logger.debug('Ignoring game-started event for round already started', {
              currentRound: prev.currentRound,
              eventRound: data.currentRound,
              currentState: prev.gameState
            });
            return prev;
          }
          
          // This is a valid game-started event, process it
          setShowRoundScore(false);
          setShowCorrectAnswer(false);
          setCountdown(3); // Set initial countdown
          setStartingGame(false); // Reset starting state when game actually starts
          
          const newState = {
            ...prev,
            gameState: 'countdown' as const,
            currentRound: data.currentRound || 1,
            rounds: data.currentRound > 1 ? prev.rounds : [],
            countdownStartTime: data.countdownStartTime,
          };
          
          logger.debug('Lobby: Updated game state to countdown', { prevState: prev?.gameState, newState: newState?.gameState });
          
          // Use the ref to call the latest version of the function
          if (startCountdownTimerRef.current) {
            logger.debug('Lobby: Starting countdown timer');
            startCountdownTimerRef.current(data.countdownStartTime);
          } else {
            logger.warn('Lobby: startCountdownTimerRef.current is null');
          }
          
          return newState;
        });
      },
      
      onRoundPreloaded: (data) => {
        // Update round data but keep game state as countdown
        setLobby((prev) => {
          if (!prev) return null;
          const newRounds = [...prev.rounds];
          while (newRounds.length < data.currentRound) {
            newRounds.push(null as any);
          }
          newRounds[data.currentRound - 1] = data.round;
          return {
            ...prev,
            rounds: newRounds,
          };
        });
      },
      
      onRoundStarted: (data) => {
        setCountdown(null);
        setShowRoundScore(false);
        setShowCorrectAnswer(false);
        setFoundCount(0);
        setShowSuccess(false);
        setRoundTime(30);
        setPlayerFoundEmojiId(null);
        
        // Show scroll hint on mobile
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
          setShowScrollHint(true);
          setTimeout(() => setShowScrollHint(false), 3000);
        }

        setLobby((prev) => {
          if (!prev) return null;
          const newRounds = [...prev.rounds];
          while (newRounds.length < data.currentRound) {
            newRounds.push(null as any);
          }
          newRounds[data.currentRound - 1] = data.round;
          const updatedLobby = {
            ...prev,
            gameState: 'playing' as const,
            currentRound: data.currentRound,
            rounds: newRounds,
          };
          return updatedLobby;
        });
        
        startRoundTimer(data.round.startTime, data.currentRound);
      },
      
      onRoundEnded: (data) => {
        logger.info('Round-ended event received', {
          eventRound: data.round,
          targetEmoji: data.targetEmoji
        });
        
        // Clear the round timer if it's still running
        if (roundTimerRef.current) {
          clearInterval(roundTimerRef.current);
          roundTimerRef.current = null;
        }
        
        // First check if we should process this event at all using the ref
        const currentLobby = lobbyRef.current;
        if (currentLobby) {
          // If this is an old round event, ignore it completely
          if (data.round < currentLobby.currentRound) {
            logger.debug('Ignoring stale round-ended event (checking lobby ref)', { 
              currentRound: currentLobby.currentRound, 
              eventRound: data.round, 
              currentState: currentLobby.gameState,
              reason: 'event for past round'
            });
            return;
          }
        }
        
        setLobby((prev) => {
          if (!prev) return null;
          
          // Only process this event if it's the current round ending
          // Block if:
          // - Event is for a previous round (stale)
          // - We're already past this round
          // - Game state shows we're still playing a different round
          if (data.round < prev.currentRound) {
            logger.debug('Ignoring stale round-ended event (in setState)', { 
              currentRound: prev.currentRound, 
              eventRound: data.round, 
              currentState: prev.gameState,
              reason: 'event for past round'
            });
            return prev;
          }
          
          // Also ignore if already processed this round end
          if (data.round === prev.currentRound && prev.gameState === 'roundEnd') {
            logger.debug('Ignoring duplicate round-ended event', { 
              currentRound: prev.currentRound, 
              eventRound: data.round, 
              currentState: prev.gameState
            });
            return prev;
          }

          const updatedPlayers = prev.players.map((player) => {
            const scoreData = data.scores.find(
              (s: any) => s.playerId === player.id
            );
            if (scoreData && scoreData.roundScore) {
              const existingRoundScoreIndex = player.roundScores.findIndex(
                (rs) => rs.round === data.round
              );
              if (existingRoundScoreIndex === -1) {
                return {
                  ...player,
                  score: scoreData.totalScore,
                  roundScores: [
                    ...player.roundScores,
                    scoreData.roundScore,
                  ],
                };
              }
            }
            return player;
          });

          return {
            ...prev,
            gameState: 'roundEnd',
            roundEndTime: Date.now(),
            players: updatedPlayers,
          };
        });

        // Only trigger UI transitions if this event was just processed
        // Skip if the event is for a past round when we're already in a new round
        if (!lobby || data.round < lobby.currentRound) {
          logger.debug('Skipping UI transitions for stale round-ended event', {
            currentRound: lobby?.currentRound,
            eventRound: data.round,
            currentState: lobby?.gameState,
            reason: !lobby ? 'no lobby state' : 'event for past round'
          });
          return;
        }

        // Check if the current player found the emoji this round
        const currentPlayerScore = data.scores.find((s: any) => 
          s.playerId === playerIdRef.current
        );
        // Player found the emoji if they have a roundScore with non-null timeToFind
        const currentPlayerFound = currentPlayerScore?.roundScore?.timeToFind !== null && 
                                  currentPlayerScore?.roundScore?.timeToFind !== undefined;
        
        // Play time up sound only for this player if they didn't find the emoji
        if (!currentPlayerFound) {
          audioManager.play(SoundType.TIME_UP);
        }

        // Check if this is the final round
        const isFinalRound = data.round === 5;
        
        if (isFinalRound) {
          // For final round, skip round scoreboard and go directly to final scores
          setShowCorrectAnswer(true);
          setTimeout(() => {
            setShowCorrectAnswer(false);
          }, 3000);
          
          // Schedule progress check after 3 seconds (immediately after correct answer)
          scheduleStateTransition('progress', data.round, 3000);
        } else {
          // For other rounds, show round scoreboard as usual
          setShowCorrectAnswer(true);
          setTimeout(() => {
            setShowCorrectAnswer(false);
            setShowRoundScore(true);
          }, 3000);
          
          // Schedule progress check after 6 seconds
          scheduleStateTransition('progress', data.round, 6000);
        }
      },
      
      onEmojiFound: (data) => {
        setFoundCount(data.foundCount);
        
        // Update player scores first to get the correct starting score
        setLobby((prev) => {
          if (!prev) return null;
          
          // Find the current player's score before update
          const currentPlayerBefore = prev.players.find(p => p.id === data.playerId);
          const oldScore = currentPlayerBefore?.score || 0;
          
          const updatedPlayers = prev.players.map((player) => {
            if (player.id === data.playerId) {
              return {
                ...player,
                score: (data as any).totalScore, // Always use server's authoritative total score
              };
            }
            return player;
          });
          
          // If this is the current player, trigger animations
          // Use ref to get current playerId value
          const currentPlayerId = playerIdRef.current;
          
          // Return the updated lobby state
          const updatedLobby = { ...prev, players: updatedPlayers };
          
          // Schedule animations after state update if this is the current player
          if (currentPlayerId && data.playerId === currentPlayerId) {
            const newScore = (data as any).totalScore || (oldScore + data.points);
            
            // Only show animations if score actually increased
            // This prevents animations when replaying old events
            if (newScore > oldScore) {
              // Don't play sound here - it's already played immediately on click
              
              setShowSuccess(true);
              setTimeout(() => {
                setShowSuccess(false);
              }, 2000);
              if (data.emojiId) {
                setPlayerFoundEmojiId(data.emojiId);
              }
              
              // Trigger score animation
              const animationId = Date.now();
              setScoreAnimation({ points: newScore - oldScore, id: animationId });
              
              // Animate score counting up from old score to new score
              const startScore = oldScore;
              const endScore = newScore;
              const duration = 1000; // 1 second animation
              const steps = 20;
              const increment = (endScore - startScore) / steps;
              let currentStep = 0;
              
              const countInterval = setInterval(() => {
                currentStep++;
                if (currentStep >= steps) {
                  setDisplayScore(endScore);
                  clearInterval(countInterval);
                } else {
                  setDisplayScore(Math.floor(startScore + increment * currentStep));
                }
              }, duration / steps);
              
              // Remove animation after 2 seconds
              setTimeout(() => {
                setScoreAnimation((prev) => prev?.id === animationId ? null : prev);
              }, 2000);
            }
          }
          
          return { ...prev, players: updatedPlayers };
        });
      },
      
      onWrongEmoji: (data) => {
        const currentPlayerId = playerIdRef.current;
        
        if (currentPlayerId && data.playerId === currentPlayerId) {
          setShowWrongEmoji(true);
          setWrongEmojiClicked(data.clickedEmoji || null);
          setTimeout(() => {
            setShowWrongEmoji(false);
            setWrongEmojiClicked(null);
          }, 2000);
        }
      },
      
      onGameEnded: (data) => {
        // Play game over sound
        audioManager.play(SoundType.GAME_OVER);
        
        setShowRoundScore(false);
        setShowFinalScore(true);
        setLobby((prev) =>
          prev
            ? {
                ...prev,
                gameState: 'finished',
                players: data.finalScores,
              }
            : null
        );
      },
      
      onGameReset: (data) => {
        setLobby(data.lobby);
        setShowFinalScore(false);
        setShowRoundScore(false);
        setCountdown(null);
        setFoundCount(0);
        setShowSuccess(false);
        setShowCorrectAnswer(false);
      },
      
      onNotEnoughPlayers: (data) => {
        setError(data.message || 'Not enough players to continue.');
        setTimeout(() => {
          router.push('/');
        }, 3000);
      },
      
      onError: (error) => {
        console.error('[SSE] Error:', error);
        if (error.message?.includes('Failed to fetch')) {
          setError('Connection lost - trying to reconnect...');
        } else if (error.message?.includes('429')) {
          setError('Too many requests - please wait a moment');
        } else {
          setError('Connection lost - trying to reconnect...');
        }
      },
    });

    return () => {
      sseClient.disconnect();
      sseClientRef.current = null;
      
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (roundTimerRef.current) {
        clearInterval(roundTimerRef.current);
      }
      if (stateTransitionTimeoutRef.current) {
        clearTimeout(stateTransitionTimeoutRef.current);
      }
    };
  }, [lobbyId, router, hasRejoined]);

  // Handle cleanup on page unload and navigation
  useEffect(() => {
    if (!playerId || !lobbyId) return;
    
    let isUnmounting = false;
    
    // Simple approach: on any unload, check if we're still in the lobby URL
    const handleBeforeUnload = () => {
      // If we're leaving the lobby page, remove player immediately
      const stillInLobby = window.location.pathname.includes(`/lobby/${lobbyId}`);
      
      if (navigator.sendBeacon) {
        const data = JSON.stringify({ 
          explicit: !stillInLobby,  // Explicit leave if not in lobby anymore
          gracePeriod: stillInLobby  // Grace period only if still in lobby (refresh)
        });
        const blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon(`/api/lobby/${lobbyId}/leave`, blob);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // When component unmounts, check why
    return () => {
      isUnmounting = true;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Synchronously check if we're navigating away
      const currentPath = window.location.pathname;
      const leavingLobby = !currentPath.includes(`/lobby/${lobbyId}`);
      
      // Log for debugging
      logger.debug('[Lobby] Component unmounting:', {
        currentPath,
        lobbyId,
        leavingLobby,
        playerId
      });
      
      if (leavingLobby || isUnmounting) {
        // Force immediate removal when navigating away
        const leaveData = JSON.stringify({ 
          explicit: true, 
          gracePeriod: false,
          reason: 'navigation' 
        });
        
        // Use sendBeacon for reliability
        if (navigator.sendBeacon) {
          const blob = new Blob([leaveData], { type: 'application/json' });
          const sent = navigator.sendBeacon(`/api/lobby/${lobbyId}/leave`, blob);
          logger.debug('[Lobby] Beacon sent:', sent);
        }
        
        // Also try synchronous XMLHttpRequest as last resort
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `/api/lobby/${lobbyId}/leave`, false); // Synchronous
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.send(leaveData);
        } catch (e) {
          console.error('[Lobby] Sync leave failed:', e);
        }
      }
    };
  }, [playerId, lobbyId]);

  const handleStartGame = useCallback(async () => {
    if (!playerId || !lobby || startingGame) return;

    setStartingGame(true);
    setError(null);

    try {
      const res = await fetch('/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lobbyId }),
        credentials: 'include',
      });

      if (!res.ok) {
        const errorText = await res.text();
        try {
          const errorData = JSON.parse(errorText);
          setError(errorData.error || `Failed to start game: ${res.status}`);
        } catch {
          setError(`Failed to start game: ${res.status} ${res.statusText}`);
        }
        setStartingGame(false); // Reset state on error
      }
    } catch (err) {
      console.error('Error starting game:', err);
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        setError('Network error - please check your connection');
      } else {
        setError('Failed to start game. Please try again.');
      }
      setStartingGame(false); // Reset state on error
    }
  }, [lobbyId, playerId, lobby]);

  const handleEmojiClick = useCallback(
    async (
      emojiId: string,
      _x: number,
      _y: number,
      pageX: number,
      pageY: number
    ) => {
      if (!playerId || !lobby || lobby.gameState !== 'playing') return;

      setClickPosition({ x: pageX, y: pageY });

      if (!emojiId) {
        return;
      }

      try {
        const res = await fetch('/api/game/click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lobbyId, emojiId }),
          credentials: 'include'
        });

        if (!res.ok) {
          console.error('Failed to submit click:', res.status);
          return;
        }

        // Get immediate feedback from the API response
        const result = await res.json();
        
        if (result.found) {
          // Play success sound immediately
          audioManager.play(SoundType.SUCCESS);
          
          // Immediately update local state for instant feedback
          setPlayerFoundEmojiId(emojiId);
          
          // Show confetti animation
          setShowSuccess(true);
          setTimeout(() => {
            setShowSuccess(false);
          }, 2000);
          
          // Trigger score animation
          const animationId = Date.now();
          setScoreAnimation({ points: result.points, id: animationId });
          setTimeout(() => {
            setScoreAnimation((prev) => prev?.id === animationId ? null : prev);
          }, 2000);
          
          // Don't update score locally - wait for SSE event with authoritative score
          // Just update the round's foundBy to prevent duplicate clicks
          setLobby(prev => {
            if (!prev) return prev;
            
            const updatedLobby = { ...prev };
            const currentRound = updatedLobby.rounds[updatedLobby.currentRound - 1];
            
            if (currentRound && !currentRound.foundBy.find(f => f.playerId === playerId)) {
              currentRound.foundBy.push({ playerId, timestamp: Date.now() });
            }
            
            return updatedLobby;
          });
        } else {
          // Play error sound for wrong emoji
          audioManager.play(SoundType.ERROR);
        }
      } catch (err) {
        console.error('Error submitting click:', err);
        // Don't show error to user for click failures
      }
    },
    [lobbyId, playerId, lobby]
  );

  const handlePlayAgain = useCallback(async () => {
    if (!playerId || !lobby) return;

    setError(null);
    setStartingGame(false); // Reset the starting state when playing again

    try {
      const res = await fetch('/api/game/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lobbyId }),
        credentials: 'include'
      });

      if (!res.ok) {
        const errorText = await res.text();
        try {
          const errorData = JSON.parse(errorText);
          setError(errorData.error || `Failed to reset game: ${res.status}`);
        } catch {
          setError(`Failed to reset game: ${res.status} ${res.statusText}`);
        }
      }
    } catch (err) {
      console.error('Error resetting game:', err);
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        setError('Network error - please check your connection');
      } else {
        setError('Failed to reset game. Please try again.');
      }
    }
  }, [lobbyId, playerId, lobby]);

  const handleMainMenu = useCallback(async () => {
    // Reset rejoin state when explicitly leaving
    setHasRejoined(false);
    // Navigate to main menu - the cleanup effect will handle leave
    router.push('/');
  }, [router]);

  const [copied, setCopied] = useState(false);
  const handleCopyLobbyCode = useCallback(async () => {
    try {
      // Copy the full URL instead of just the code
      const fullUrl = `${window.location.origin}/lobby/${lobby?.id || ''}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback for older browsers or permission denied
      const textArea = document.createElement('textarea');
      textArea.value = `${window.location.origin}/lobby/${lobby?.id || ''}`;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
      document.body.removeChild(textArea);
    }
  }, [lobby?.id]);

  const currentPlayer = lobby?.players.find((p) => p.id === playerId);
  const currentRound =
    lobby && lobby.currentRound > 0 && lobby.currentRound <= lobby.rounds.length
      ? lobby.rounds[lobby.currentRound - 1]
      : null;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  // Initialize audio manager on mount
  useEffect(() => {
    audioManager.initialize();
  }, []);

  // Initialize and sync display score with actual score
  useEffect(() => {
    if (currentPlayer) {
      // Initialize if null
      if (displayScore === null) {
        setDisplayScore(currentPlayer.score);
      }
      // Sync if not animating and scores don't match
      else if (!scoreAnimation && displayScore !== currentPlayer.score) {
        setDisplayScore(currentPlayer.score);
      }
    }
  }, [currentPlayer?.score, scoreAnimation, displayScore]);

  // Handle ticking sound when time is running out
  useEffect(() => {
    if (lobby?.gameState === 'playing' && roundTime <= 5 && roundTime > 0) {
      // Start ticking when 5 seconds or less remain
      audioManager.play(SoundType.TICK);
    } else {
      // Stop ticking when not in danger zone
      audioManager.stop(SoundType.TICK);
    }
    
    return () => {
      // Cleanup: stop ticking when component unmounts
      audioManager.stop(SoundType.TICK);
    };
  }, [lobby?.gameState, roundTime]);

  // Handle black background during countdown
  useEffect(() => {
    if (countdown !== null) {
      // Add black background class when countdown is active
      document.body.classList.add('bg-black');
    } else {
      // Remove black background class when countdown is done
      document.body.classList.remove('bg-black');
    }
    
    return () => {
      // Cleanup on unmount
      document.body.classList.remove('bg-black');
    };
  }, [countdown]);

  if (error) {
    return (
      <div className="h-full bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Error</h1>
          <p className="text-gray-300 mb-6">{error}</p>
          <Button
            onClick={() => router.push('/')}
            variant="primary"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  if (!lobby || !playerId) {
    return (
      <div className="h-full bg-gray-900 flex items-center justify-center">
        <p className="text-2xl text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-900 relative overflow-hidden md:overflow-hidden">
      {/* Header for active game */}
      {(lobby.gameState === 'countdown' || lobby.gameState === 'playing' ||
        (lobby.gameState === 'roundEnd' && showCorrectAnswer)) &&
        currentRound && (
          <div className="fixed top-0 left-0 right-0 bg-gradient-to-b from-gray-900 to-gray-800 backdrop-blur-md z-20 py-2 px-3 md:py-3 md:px-4 shadow-xl border-b border-gray-700/50" style={{ paddingTop: `calc(0.5rem + env(safe-area-inset-top))` }}>
            <div className="max-w-6xl mx-auto grid grid-cols-3 items-stretch gap-2 md:gap-4 h-full">
              {/* Round Progress */}
              <div className="flex items-center justify-center md:justify-start">
                <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-lg px-3 py-1.5 md:px-4 md:py-2 border border-purple-500/30 h-full w-full md:w-auto flex items-center justify-center">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl md:text-3xl">🎯</span>
                    <div className="flex flex-col justify-center">
                      <span className="text-xs text-gray-400 leading-tight">Round</span>
                      <span className="text-base md:text-lg font-bold text-white leading-tight">
                        {lobby.currentRound}/5
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Target Emoji */}
              <div className="text-center flex flex-col items-center justify-center">
                <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl px-4 py-2 md:px-6 md:py-3 border border-yellow-500/30 transform hover:scale-105 transition-transform w-full md:w-auto">
                  <p className="text-yellow-400 text-xs md:text-sm font-medium mb-1">Find this emoji</p>
                  <div className="text-4xl md:text-5xl emoji-font animate-bounce-subtle">
                    {currentRound.targetEmoji}
                  </div>
                </div>
              </div>
              
              {/* Timer */}
              <div className="flex items-center justify-center md:justify-end h-full">
                {lobby.gameState === 'roundEnd' ||
                foundCount === lobby.players.length ? (
                  <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 rounded-lg px-3 py-2 md:px-4 md:py-2.5 border border-green-500/30 h-full w-full md:w-auto flex items-center justify-center">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">✅</span>
                      <span className="text-base md:text-lg font-bold text-green-400">
                        Complete!
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={`relative h-full w-full md:w-auto ${roundTime <= 10 ? 'animate-pulse' : ''}`}>
                    <div className={`bg-gradient-to-r ${
                      roundTime <= 10 
                        ? 'from-red-600/20 to-pink-600/20 border-red-500/30' 
                        : 'from-blue-600/20 to-cyan-600/20 border-blue-500/30'
                    } rounded-lg px-3 py-1.5 md:px-4 md:py-2 border transition-all duration-300 h-full flex items-center justify-center`}>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl md:text-3xl">
                          {roundTime <= 10 ? '⏰' : '⏱️'}
                        </span>
                        <div className="flex flex-col justify-center">
                          <span className="text-xs text-gray-400 leading-tight">Time</span>
                          <span className={`text-base md:text-lg font-bold leading-tight ${
                            roundTime <= 10 ? 'text-red-400' : 'text-white'
                          }`}>
                            {roundTime}s
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Hurry indicator */}
            {roundTime <= 10 && lobby.gameState === 'playing' && (
              <div className="absolute left-0 right-0 top-full mt-2 flex justify-end px-3 md:px-4 max-w-6xl mx-auto">
                <div className="text-red-400 text-xs font-bold animate-bounce">
                  Hurry! ⚡
                </div>
              </div>
            )}
          </div>
        )}

      {/* Game Canvas */}
      {(lobby.gameState === 'countdown' || lobby.gameState === 'playing' ||
        (lobby.gameState === 'roundEnd' && showCorrectAnswer)) &&
        currentRound && (
          <div 
            className="fixed md:absolute md:mt-24 md:mb-20"
            style={{ 
              top: isMobile ? 'calc(env(safe-area-inset-top) + 4.5rem)' : 0,
              bottom: isMobile ? 'calc(env(safe-area-inset-bottom) + 4rem)' : 0,
              left: 0,
              right: 0
            }}>
            <GameCanvas
              round={currentRound}
              lobbyId={lobbyId}
              playerId={playerId}
              onEmojiClick={handleEmojiClick}
              disabled={lobby.gameState !== 'playing'}
              onTimeUpdate={setRoundTime}
              highlightTargetEmoji={showCorrectAnswer}
              foundEmojiId={playerFoundEmojiId}
              opacity={lobby.gameState === 'countdown' ? 0 : 1}
            />

            {/* Success Overlay */}
            {showSuccess && clickPosition && (
              <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
                {/* Confetti effect at click position */}
                <div
                  className="absolute"
                  style={{
                    left: `${clickPosition.x}px`,
                    top: `${clickPosition.y}px`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {/* Generate confetti emojis - optimized for performance */}
                  <style dangerouslySetInnerHTML={{
                    __html: `
                      @keyframes confetti-explode {
                        0% {
                          transform: translate(-50%, -50%) translateX(var(--start-x, 0)) translateY(var(--start-y, 0)) scale(0) rotate(0deg);
                          opacity: 0;
                        }
                        20% {
                          transform: translate(-50%, -50%) translateX(calc(var(--end-x, 0) * 0.3)) translateY(calc(var(--end-y, 0) * 0.3)) scale(1.2) rotate(180deg);
                          opacity: 1;
                        }
                        100% {
                          transform: translate(-50%, -50%) translateX(var(--end-x, 0)) translateY(var(--end-y, 0)) scale(0.3) rotate(720deg);
                          opacity: 0;
                        }
                      }
                    `
                  }} />
                  {[...Array(8)].map((_, i) => {
                    const emojis = ['✨', '🎉', '⭐', '🎊'];
                    const emoji = emojis[i % emojis.length];
                    const angle = (i * 45); // 8 directions
                    const distance = 100 + (i % 2) * 20; // Vary distance
                    
                    // Calculate end position
                    const radian = (angle * Math.PI) / 180;
                    const endX = Math.cos(radian) * distance;
                    const endY = Math.sin(radian) * distance;
                    
                    // Diagonal particles (corners) move slower to create circular effect
                    const isDiagonal = i % 2 === 1;
                    const duration = isDiagonal ? 0.85 : 0.6;
                    
                    return (
                      <div
                        key={i}
                        className="absolute text-2xl pointer-events-none"
                        style={{
                          left: '0',
                          top: '0',
                          opacity: 0,
                          '--end-x': `${endX}px`,
                          '--end-y': `${endY}px`,
                          '--start-x': '0px',
                          '--start-y': '0px',
                          animation: `confetti-explode ${duration}s ease-out forwards`,
                          animationDelay: `0s`,
                        } as React.CSSProperties}
                      >
                        {emoji}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Scroll Hint Indicator */}
            {showScrollHint && isMobile && (
              <div className="fixed pointer-events-none z-40"
                style={{
                  left: '50%',
                  bottom: `calc(4.5rem + env(safe-area-inset-bottom))`,
                  transform: 'translateX(-50%)',
                }}
              >
                <div 
                  className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-2"
                  style={{
                    animation: 'fadeInOut 3s ease-out forwards',
                  }}
                >
                  <div className="flex items-center gap-3">
                    {/* Left arrow with dots */}
                    <div className="flex items-center gap-1">
                      <span className="text-white/40 text-lg">←</span>
                      <div className="flex gap-0.5">
                        {[2, 1, 0].map((i) => (
                          <div
                            key={i}
                            className="w-1 h-1 bg-white/30 rounded-full"
                            style={{
                              animation: `dotLeft ${1.5}s ease-in-out infinite`,
                              animationDelay: `${i * 0.15}s`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    
                    {/* Swiping finger emoji */}
                    <div className="relative">
                      <div 
                        className="text-2xl"
                        style={{
                          animation: 'swipeEmoji 1.5s ease-in-out infinite',
                          transformOrigin: 'center',
                        }}
                      >
                        👆
                      </div>
                    </div>
                    
                    {/* Right arrow with dots */}
                    <div className="flex items-center gap-1">
                      <div className="flex gap-0.5">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="w-1 h-1 bg-white/30 rounded-full"
                            style={{
                              animation: `dotRight ${1.5}s ease-in-out infinite`,
                              animationDelay: `${i * 0.15}s`,
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-white/40 text-lg">→</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      {/* Waiting Room */}
      {lobby.gameState === 'waiting' && (
        <div className="h-full flex items-center justify-center p-4 relative overflow-y-auto">
          <EmojiBackground />

          <div className="bg-gray-800/95 backdrop-blur-sm rounded-2xl p-4 md:p-8 max-w-2xl w-full shadow-2xl relative z-10 border border-gray-700 my-auto">
            <div className="text-center mb-6 md:mb-8">
              <h1 className="text-2xl md:text-4xl font-bold text-white mb-3">
                Lobby Code:{' '}
                <span className="inline-flex items-center gap-2">
                  <span className="text-blue-400 font-mono tracking-wider text-3xl md:text-5xl">
                    {lobby.id}
                  </span>
                  <Button
                    onClick={handleCopyLobbyCode}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white"
                  >
                    {copied ? '✓' : '📋'}
                  </Button>
                </span>
              </h1>
            </div>

            <div className="mb-6 md:mb-8">
              <h2 className="text-lg md:text-xl font-semibold text-white mb-3 md:mb-4">
                👥 Players ({lobby.players.length})
              </h2>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {lobby.players.map((player) => (
                  <div
                    key={player.id}
                    className="bg-gray-700/50 rounded-lg p-3 md:p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 md:gap-3">
                      <span className="text-xl md:text-2xl">{player.avatar || '😊'}</span>
                      <span className="text-white font-medium text-sm md:text-base truncate max-w-[150px] md:max-w-none">
                        {player.nickname}
                      </span>
                    </div>
                    {player.isHost && (
                      <span className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-semibold flex-shrink-0">
                        👑 Host
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {isHost && (
              <div className={lobby.players.length === 1 ? "flex flex-col md:flex-row gap-3" : ""}>
                <Button
                  onClick={handleStartGame}
                  className={`${lobby.players.length === 1 ? 'flex-1' : 'w-full'} bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800`}
                  disabled={lobby.players.length < 2 || startingGame}
                  size="lg"
                >
                  {startingGame ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⚙️</span> Starting...
                    </span>
                  ) : lobby.players.length < 2 ? (
                    <span className="whitespace-nowrap">⏳ Waiting for players...</span>
                  ) : (
                    '🚀 Start Game'
                  )}
                </Button>
                
                {lobby.players.length === 1 && (
                  <Button
                    onClick={handleStartGame}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                    disabled={startingGame}
                    size="lg"
                  >
                    {startingGame ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin">⚙️</span> Starting Solo Game...
                      </span>
                    ) : (
                      '🎮 Play Solo'
                    )}
                  </Button>
                )}
              </div>
            )}

            {!isHost && (
              <div className="text-center">
                <p className="text-gray-400 text-lg">
                  Waiting for host to start the game...
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Countdown - As an overlay on top of everything */}
      {(lobby.gameState === 'countdown' || countdown !== null) && (
        <Countdown count={countdown !== null ? countdown : 0} />
      )}

      {/* Round Score */}
      {showRoundScore && (
        <Scoreboard
          players={lobby.players}
          currentRound={lobby.currentRound}
          isFinal={false}
        />
      )}

      {/* Final Score */}
      {showFinalScore && (
        <Scoreboard
          players={lobby.players}
          isFinal={true}
          onPlayAgain={isHost ? handlePlayAgain : undefined}
          onMainMenu={handleMainMenu}
        />
      )}

      {/* Game Info Bar */}
      {(lobby.gameState === 'playing' || (lobby.gameState === 'roundEnd' && showCorrectAnswer)) && (
        <div className="fixed md:absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 to-gray-800 backdrop-blur-md py-2 px-3 md:py-3 md:px-4 shadow-2xl border-t border-gray-700/50" style={{ paddingBottom: `calc(0.5rem + env(safe-area-inset-bottom))` }}>
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between gap-3">
              {/* Found Status */}
              <div className="max-w-xs">
                <div className={`h-full bg-gradient-to-r ${
                  showWrongEmoji 
                    ? 'from-red-600/20 to-pink-600/20 border-red-500/30' 
                    : foundCount === lobby.players.length 
                      ? 'from-green-600/20 to-emerald-600/20 border-green-500/30'
                      : 'from-indigo-600/20 to-purple-600/20 border-indigo-500/30'
                } rounded-lg px-3 py-1.5 md:px-4 md:py-2 border transition-all duration-300`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl md:text-2xl">
                      {showWrongEmoji ? '❌' : foundCount === lobby.players.length ? '🎉' : '👥'}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400 leading-tight">
                        {showWrongEmoji ? 'Oops!' : 'Progress'}
                      </span>
                      <span className={`text-sm md:text-base font-bold leading-tight ${
                        showWrongEmoji 
                          ? 'text-red-400' 
                          : foundCount === lobby.players.length 
                            ? 'text-green-400'
                            : 'text-white'
                      }`}>
                        {showWrongEmoji ? (
                          <span className="flex items-center gap-1">
                            <span>Wrong emoji!</span>
                            {wrongEmojiClicked && <span className="text-lg">{wrongEmojiClicked}</span>}
                          </span>
                        ) : foundCount === lobby.players.length ? (
                          'All found it!'
                        ) : (
                          <>
                            <span className="text-yellow-400">{foundCount}</span>
                            <span className="text-gray-400">/</span>
                            <span>{lobby.players.length}</span>
                            <span className="text-gray-400 ml-1">found</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Score */}
              <div className="flex-shrink-0 relative">
                <div className="bg-gradient-to-r from-amber-600/20 to-yellow-600/20 rounded-lg px-3 py-1.5 md:px-4 md:py-2 border border-amber-500/30">
                  <div className="flex items-center gap-2">
                    <span className="text-xl md:text-2xl">🏆</span>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400 leading-tight">Score</span>
                      <span className="text-base md:text-lg font-bold text-yellow-400 leading-tight">
                        {displayScore ?? currentPlayer?.score ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Floating Score Animation */}
                {scoreAnimation && (
                  <div
                    className="absolute pointer-events-none z-50"
                    style={{
                      left: '50%',
                      bottom: '100%',
                      transform: 'translateX(-50%)',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <div
                      className="text-yellow-400 font-bold text-lg md:text-xl whitespace-nowrap"
                      style={{
                        animation: 'floatUp 2s ease-out forwards',
                      }}
                    >
                      +{scoreAnimation.points}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}