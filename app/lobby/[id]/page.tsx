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
import { Lobby } from '@/app/types/game';
import { SSEClient } from '@/app/lib/sse-client';
import { getPlayerId } from '@/app/lib/player-storage';

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
  
  const sseClientRef = useRef<SSEClient | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const roundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stateTransitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get player ID from storage
  useEffect(() => {
    const storedPlayerId = getPlayerId();
    if (!storedPlayerId) {
      // Redirect to home with lobby code prefilled
      router.push(`/?join=${lobbyId}`);
      return;
    }
    setPlayerId(storedPlayerId);
    
    // Check if player is host
    const hostToken = sessionStorage.getItem(`host-${lobbyId}`);
    if (hostToken) {
      setIsHost(true);
    }
  }, [router, lobbyId]);

  // Initial lobby fetch and rejoin
  useEffect(() => {
    if (!playerId) return;

    // First check if lobby exists
    fetch(`/api/lobby/${lobbyId}`)
      .then((res) => res.json())
      .then((lobbyData) => {
        console.log('[Lobby] Initial fetch result:', lobbyData);
        if (!lobbyData || lobbyData.error) {
          // Lobby doesn't exist - show error
          setError('This lobby doesn\'t exist');
          return null;
        }
        
        // Lobby exists, now check if player is in it
        return fetch('/api/lobby/rejoin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lobbyId, playerId }),
        })
          .then((res) => res.json())
          .then((rejoinData) => {
            if (rejoinData.error) {
              // Player not in lobby but lobby exists - redirect to join
              router.push(`/?join=${lobbyId}`);
              return null;
            }
            // Player is in lobby - return the lobby data
            return rejoinData.lobby || lobbyData;
          });
      })
      .then((lobbyData) => {
        if (lobbyData === null) return; // Already redirected or errored
        
        setLobby(lobbyData);
        
        // Check if player is actually the host based on lobby data
        if (lobbyData.hostId === playerId) {
          setIsHost(true);
        }

        // If game is in progress, restore the countdown/round state
        if (lobbyData.gameState === 'countdown' && lobbyData.countdownStartTime) {
          startCountdownTimer(lobbyData.countdownStartTime);
        } else if (lobbyData.gameState === 'playing' && lobbyData.currentRound > 0) {
          const currentRound = lobbyData.rounds?.[lobbyData.currentRound - 1];
          if (currentRound) {
            startRoundTimer(currentRound.startTime, lobbyData.currentRound);
          }
        } else if (lobbyData.gameState === 'roundEnd' && lobbyData.roundEndTime) {
          // Show appropriate view based on time elapsed
          const elapsed = Date.now() - lobbyData.roundEndTime;
          const isFinalRound = lobbyData.currentRound === 5;
          
          if (elapsed < 3000) {
            setShowCorrectAnswer(true);
            setTimeout(() => {
              setShowCorrectAnswer(false);
              if (!isFinalRound) {
                setShowRoundScore(true);
              }
            }, 3000 - elapsed);
          } else if (elapsed < 6000 && !isFinalRound) {
            setShowRoundScore(true);
          }
          
          // Schedule progress check
          const progressDelay = isFinalRound ? Math.max(0, 3000 - elapsed) : Math.max(0, 6000 - elapsed);
          scheduleStateTransition('progress', lobbyData.currentRound, progressDelay);
        }
      })
      .catch(() => {
        // On any error, show error message
        setError('Failed to load lobby');
      });
  }, [lobbyId, playerId, router]);

  // Connect to SSE
  useEffect(() => {
    if (!playerId || !lobbyId || error) return;

    const sseClient = new SSEClient(lobbyId, playerId);
    sseClientRef.current = sseClient;

    sseClient.connect({
      onConnected: async (data) => {
        console.log('[SSE] Connected:', data);
        setIsHost(data.isHost);
        setError(null); // Clear any connection errors
        
        // Fetch current lobby state after reconnection
        try {
          const response = await fetch(`/api/lobby/${lobbyId}`);
          if (response.ok) {
            const lobbyData = await response.json();
            setLobby(lobbyData);
          }
        } catch (err) {
          console.error('[SSE] Failed to fetch lobby state after reconnection:', err);
        }
      },
      
      onPlayerJoined: (data) => {
        console.log('[SSE] Player joined:', data);
        setLobby(data.lobby);
      },
      
      onPlayerLeft: (data) => {
        console.log('[SSE] Player left:', data);
        setLobby(data.lobby);
      },
      
      onGameStarted: (data) => {
        console.log('[SSE] Game started:', data);
        setStartingGame(false);
        setShowRoundScore(false);
        setShowCorrectAnswer(false);
        setLobby((prev) =>
          prev
            ? {
                ...prev,
                gameState: 'countdown',
                currentRound: data.currentRound || 1,
                rounds: data.currentRound > 1 ? prev.rounds : [],
                countdownStartTime: data.countdownStartTime,
              }
            : null
        );
        startCountdownTimer(data.countdownStartTime);
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
        console.log('[SSE] Round started:', data);
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
        console.log('[SSE] Round ended:', data);
        
        // Clear the round timer if it's still running
        if (roundTimerRef.current) {
          clearInterval(roundTimerRef.current);
          roundTimerRef.current = null;
        }
        
        setLobby((prev) => {
          if (!prev) return null;

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
        console.log('[SSE] Emoji found:', data);
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
                score: player.score + data.points,
              };
            }
            return player;
          });
          
          // If this is the current player, trigger animations
          if (data.playerId === playerId) {
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
            if (data.emojiId) {
              setPlayerFoundEmojiId(data.emojiId);
            }
            
            // Trigger score animation
            const animationId = Date.now();
            setScoreAnimation({ points: data.points, id: animationId });
            
            // Animate score counting up from old score to new score
            const startScore = oldScore;
            const endScore = oldScore + data.points;
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
          
          return { ...prev, players: updatedPlayers };
        });
      },
      
      onWrongEmoji: (data) => {
        if (data.playerId === playerId) {
          setShowWrongEmoji(true);
          setWrongEmojiClicked(data.clickedEmoji || null);
          setTimeout(() => {
            setShowWrongEmoji(false);
            setWrongEmojiClicked(null);
          }, 2000);
        }
      },
      
      onGameEnded: (data) => {
        console.log('[SSE] Game ended:', data);
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
        console.log('[SSE] Game reset:', data);
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
        setError('Connection lost. Trying to reconnect...');
      },
    });

    return () => {
      console.log('[SSE] Main cleanup - disconnecting...');
      sseClient.disconnect();
      sseClientRef.current = null;
      
      // Don't send leave request here - let the visibility/unload handlers deal with it
      // This prevents leaving the lobby on every refresh
      
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
  }, [playerId, lobbyId, router]); // eslint-disable-line react-hooks/exhaustive-deps

  // Send leave on any unmount (navigation, refresh, close)
  useEffect(() => {
    return () => {
      // Always send leave when component unmounts
      console.log('[Lobby] Component unmounting - sending leave request');
      
      // Disconnect SSE
      if (sseClientRef.current) {
        sseClientRef.current.disconnect();
        sseClientRef.current = null;
      }
      
      // Send leave request
      if (playerId && navigator.sendBeacon) {
        const data = JSON.stringify({ playerId });
        const sent = navigator.sendBeacon(`/api/lobby/${lobbyId}/leave`, data);
        console.log(`[Lobby] Leave request ${sent ? 'sent' : 'failed'}`);
      }
    };
  }, [playerId, lobbyId]);

  // Check and start round
  const checkAndStartRound = useCallback(async () => {
    console.log('[Game] Attempting to start round...');
    
    // Get the latest lobby state
    try {
      const lobbyRes = await fetch(`/api/lobby/${lobbyId}`);
      const currentLobby = await lobbyRes.json();
      
      if (!currentLobby || currentLobby.error) {
        console.error('[Game] Failed to get lobby state');
        return;
      }
      
      console.log('[Game] Current lobby state:', currentLobby.gameState, 'Round:', currentLobby.currentRound);
      
      const res = await fetch('/api/game/check-round-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lobbyId, 
          roundNum: currentLobby.currentRound 
        }),
      });
      
      const data = await res.json();
      console.log('[Game] Check round start result:', data);
    } catch (err) {
      console.error('[Game] Failed to check round start:', err);
    }
  }, [lobbyId]);

  // Preload round data
  const preloadRoundData = useCallback(async () => {
    console.log('[Game] Preloading round data...');
    
    try {
      const lobbyRes = await fetch(`/api/lobby/${lobbyId}`);
      const currentLobby = await lobbyRes.json();
      
      if (!currentLobby || currentLobby.error) {
        console.error('[Game] Failed to get lobby state for preload');
        return;
      }
      
      const res = await fetch('/api/game/preload-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lobbyId, 
          roundNum: currentLobby.currentRound 
        }),
      });
      
      const data = await res.json();
      console.log('[Game] Preload result:', data);
    } catch (err) {
      console.error('[Game] Failed to preload round:', err);
    }
  }, [lobbyId]);

  // Start countdown timer
  const startCountdownTimer = useCallback((startTime: number) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    
    let hasPreloaded = false;

    const updateCountdown = () => {
      const elapsed = Date.now() - startTime;
      const step = Math.floor(elapsed / 1000);

      if (step < 4) {
        const count = step === 0 ? 3 : step === 1 ? 2 : step === 2 ? 1 : 0;
        setCountdown(count);
        
        // Preload round data when we hit "1" (step 2)
        if (step === 2 && !hasPreloaded) {
          hasPreloaded = true;
          preloadRoundData();
        }
      } else {
        setCountdown(null);
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
        // Try to start the round
        checkAndStartRound();
      }
    };

    updateCountdown();
    countdownIntervalRef.current = setInterval(updateCountdown, 100);
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
          });
          
          const data = await res.json();
          console.log('[Game] Check round end result:', data);
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
      });
      
      const data = await res.json();
      console.log('[Game] Check progress result:', data);
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

  const handleStartGame = useCallback(async () => {
    if (!playerId || !lobby || startingGame) return;

    setStartingGame(true);

    try {
      const res = await fetch('/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lobbyId, playerId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to start game');
        setStartingGame(false);
      }
    } catch (err) {
      setError('Failed to start game');
      setStartingGame(false);
    }
  }, [lobbyId, playerId, lobby, startingGame]);

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
          body: JSON.stringify({ lobbyId, playerId, emojiId }),
        });

        if (!res.ok) {
          console.error('Failed to submit click');
        }
      } catch (err) {
        console.error('Error submitting click:', err);
      }
    },
    [lobbyId, playerId, lobby]
  );

  const handlePlayAgain = useCallback(async () => {
    if (!playerId || !lobby) return;

    try {
      const res = await fetch('/api/game/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lobbyId, playerId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to reset game');
      }
    } catch (err) {
      setError('Failed to reset game');
    }
  }, [lobbyId, playerId, lobby]);

  const handleMainMenu = useCallback(async () => {
    // Navigate to main menu - the cleanup effect will handle leave
    console.log('[Lobby] Returning to main menu');
    router.push('/');
  }, [router]);

  const [copied, setCopied] = useState(false);
  const handleCopyLobbyCode = useCallback(() => {
    // Copy the full URL instead of just the code
    const fullUrl = `${window.location.origin}/lobby/${lobby?.id || ''}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [lobby?.id]);


  const currentPlayer = lobby?.players.find((p) => p.id === playerId);
  const currentRound =
    lobby && lobby.currentRound > 0 && lobby.currentRound <= lobby.rounds.length
      ? lobby.rounds[lobby.currentRound - 1]
      : null;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
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

  if (error) {
    return (
      <div className="h-full bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Error</h1>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
          >
            Back to Home
          </button>
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
                  {/* Generate confetti emojis */}
                  {[...Array(20)].map((_, i) => {
                    const angle = (i * 360) / 20;
                    const distance = 80 + Math.random() * 120;
                    const duration = 0.8 + Math.random() * 0.4;
                    return (
                      <div
                        key={i}
                        className="absolute text-3xl"
                        style={{
                          left: '0',
                          top: '0',
                          animation: `confetti-${i} ${duration}s ease-out forwards`,
                          animationDelay: `${Math.random() * 0.1}s`,
                        }}
                      >
                        <style
                          dangerouslySetInnerHTML={{
                            __html: `
                          @keyframes confetti-${i} {
                            0% {
                              opacity: 1;
                              transform: rotate(${angle}deg) translateY(0) scale(1) rotate(0deg);
                            }
                            100% {
                              opacity: 0;
                              transform: rotate(${angle}deg) translateY(-${distance}px) scale(0.3) rotate(720deg);
                            }
                          }
                        `,
                          }}
                        />
                        ✅
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
                  <button
                    onClick={handleCopyLobbyCode}
                    className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700/50 rounded-lg"
                  >
                    {copied ? '✓' : '📋'}
                  </button>
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
                <button
                  onClick={handleStartGame}
                  className={`${lobby.players.length === 1 ? 'flex-1' : 'w-full'} bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-3 md:py-4 px-4 md:px-6 rounded-xl transition-all disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-sm md:text-base`}
                  disabled={lobby.players.length < 2 || startingGame}
                >
                  {startingGame ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⚙️</span> Starting Game...
                    </span>
                  ) : lobby.players.length < 2 ? (
                    '⏳ Waiting for more players...'
                  ) : (
                    '🚀 Start Game'
                  )}
                </button>
                
                {lobby.players.length === 1 && (
                  <button
                    onClick={handleStartGame}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 md:py-4 px-4 md:px-6 rounded-xl transition-all disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-sm md:text-base"
                    disabled={startingGame}
                  >
                    {startingGame ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin">⚙️</span> Starting Solo Game...
                      </span>
                    ) : (
                      '🎮 Play Solo'
                    )}
                  </button>
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