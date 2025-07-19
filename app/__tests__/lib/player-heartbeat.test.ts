import { checkDisconnectedPlayers } from '@/app/lib/player-heartbeat';
import { getLobby } from '@/app/lib/game-state-async';
import { setLobby } from '@/app/lib/upstash-storage';
import { get, del, keys } from '@/app/lib/upstash-redis';
import { broadcastToLobby, SSE_EVENTS } from '@/app/lib/sse-broadcast';

// Mock dependencies
jest.mock('@/app/lib/game-state-async');
jest.mock('@/app/lib/upstash-storage');
jest.mock('@/app/lib/upstash-redis');
jest.mock('@/app/lib/sse-broadcast');

describe('Player Heartbeat', () => {
  let mockLobby: any;
  let currentTime: number;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock current time
    currentTime = 1000000000000; // Fixed timestamp for consistent testing
    jest.spyOn(Date, 'now').mockReturnValue(currentTime);
    
    // Mock lobby data
    mockLobby = {
      id: 'TEST123',
      code: 'TEST123',
      hostId: 'player1',
      players: [
        { id: 'player1', name: 'Host', avatar: '🎮', score: 0, isHost: true },
        { id: 'player2', name: 'Player 2', avatar: '🎯', score: 0, isHost: false },
        { id: 'player3', name: 'Player 3', avatar: '🚀', score: 0, isHost: false },
      ],
      gameState: 'waiting',
      maxPlayers: 6,
      createdAt: currentTime,
    };
    
    // Default mocks
    (getLobby as jest.Mock).mockResolvedValue(mockLobby);
    (setLobby as jest.Mock).mockResolvedValue(undefined);
    (del as jest.Mock).mockResolvedValue(1);
    (keys as jest.Mock).mockResolvedValue([]);
    (broadcastToLobby as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should do nothing if lobby does not exist', async () => {
      (getLobby as jest.Mock).mockResolvedValue(null);
      
      await checkDisconnectedPlayers('NONEXISTENT');
      
      expect(setLobby).not.toHaveBeenCalled();
      expect(del).not.toHaveBeenCalled();
      expect(broadcastToLobby).not.toHaveBeenCalled();
    });

    it('should do nothing if all players have recent heartbeats', async () => {
      // Mock recent heartbeats for all players
      (get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('heartbeat')) {
          return Promise.resolve((currentTime - 1000).toString()); // 1 second ago
        }
        return Promise.resolve(null);
      });
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(setLobby).not.toHaveBeenCalled();
      expect(del).not.toHaveBeenCalled();
      expect(broadcastToLobby).not.toHaveBeenCalled();
    });

    it('should check heartbeat for each player', async () => {
      (get as jest.Mock).mockResolvedValue((currentTime - 1000).toString());
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(get).toHaveBeenCalledWith('player:TEST123:player1:heartbeat');
      expect(get).toHaveBeenCalledWith('player:TEST123:player2:heartbeat');
      expect(get).toHaveBeenCalledWith('player:TEST123:player3:heartbeat');
    });
  });

  describe('Forced Removal', () => {
    it('should force remove specified player', async () => {
      (get as jest.Mock).mockResolvedValue((currentTime - 1000).toString()); // Recent heartbeats
      
      await checkDisconnectedPlayers('TEST123', 'player2');
      
      expect(setLobby).toHaveBeenCalledWith(expect.objectContaining({
        players: expect.arrayContaining([
          expect.objectContaining({ id: 'player1' }),
          expect.objectContaining({ id: 'player3' }),
        ])
      }));
      
      expect(broadcastToLobby).toHaveBeenCalledWith(
        'TEST123',
        SSE_EVENTS.PLAYER_LEFT,
        expect.objectContaining({ playerId: 'player2' })
      );
    });

    it('should not force remove player not in lobby', async () => {
      (get as jest.Mock).mockResolvedValue((currentTime - 1000).toString());
      
      await checkDisconnectedPlayers('TEST123', 'nonexistent');
      
      expect(setLobby).not.toHaveBeenCalled();
    });

    it('should force remove host and reassign', async () => {
      (get as jest.Mock).mockResolvedValue((currentTime - 1000).toString());
      
      await checkDisconnectedPlayers('TEST123', 'player1');
      
      expect(setLobby).toHaveBeenCalledWith(expect.objectContaining({
        hostId: 'player2',
        players: expect.arrayContaining([
          expect.objectContaining({ id: 'player2', isHost: true }),
          expect.objectContaining({ id: 'player3' }),
        ])
      }));
    });
  });

  describe('Heartbeat Timeout Detection', () => {
    it('should remove players with old heartbeats', async () => {
      (get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('player1:heartbeat')) {
          return Promise.resolve((currentTime - 1000).toString()); // Recent
        }
        if (key.includes('player2:heartbeat')) {
          return Promise.resolve((currentTime - 6000).toString()); // Old (6 seconds)
        }
        if (key.includes('player3:heartbeat')) {
          return Promise.resolve((currentTime - 2000).toString()); // Recent
        }
        return Promise.resolve(null);
      });
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(setLobby).toHaveBeenCalledWith(expect.objectContaining({
        players: expect.arrayContaining([
          expect.objectContaining({ id: 'player1' }),
          expect.objectContaining({ id: 'player3' }),
        ])
      }));
      
      expect(del).toHaveBeenCalledWith('player:TEST123:player2:heartbeat');
    });

    it('should use 5 second threshold for heartbeat timeout', async () => {
      (get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('player2:heartbeat')) {
          return Promise.resolve((currentTime - 5001).toString()); // Just over 5 seconds
        }
        return Promise.resolve((currentTime - 1000).toString());
      });
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(setLobby).toHaveBeenCalled();
      expect(broadcastToLobby).toHaveBeenCalledWith(
        'TEST123',
        SSE_EVENTS.PLAYER_LEFT,
        expect.objectContaining({ playerId: 'player2' })
      );
    });

    it('should not remove players at exactly 5 second threshold', async () => {
      (get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('player2:heartbeat')) {
          return Promise.resolve((currentTime - 5000).toString()); // Exactly 5 seconds
        }
        return Promise.resolve((currentTime - 1000).toString());
      });
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(setLobby).not.toHaveBeenCalled();
    });
  });

  describe('New Player Grace Period', () => {
    it('should allow grace period for new players without heartbeat', async () => {
      (get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('player2:heartbeat')) {
          return Promise.resolve(null); // No heartbeat
        }
        if (key.includes('player2:joinTime')) {
          return Promise.resolve((currentTime - 5000).toString()); // Joined 5 seconds ago
        }
        return Promise.resolve((currentTime - 1000).toString());
      });
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(setLobby).not.toHaveBeenCalled();
    });

    it('should remove new players after grace period expires', async () => {
      (get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('player2:heartbeat')) {
          return Promise.resolve(null); // No heartbeat
        }
        if (key.includes('player2:joinTime')) {
          return Promise.resolve((currentTime - 11000).toString()); // Joined 11 seconds ago
        }
        return Promise.resolve((currentTime - 1000).toString());
      });
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(setLobby).toHaveBeenCalled();
      expect(broadcastToLobby).toHaveBeenCalledWith(
        'TEST123',
        SSE_EVENTS.PLAYER_LEFT,
        expect.objectContaining({ playerId: 'player2' })
      );
    });

    it('should remove players with no heartbeat and no join time', async () => {
      (get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('player2:heartbeat') || key.includes('player2:joinTime')) {
          return Promise.resolve(null); // No heartbeat or join time
        }
        return Promise.resolve((currentTime - 1000).toString());
      });
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(setLobby).toHaveBeenCalled();
      expect(broadcastToLobby).toHaveBeenCalledWith(
        'TEST123',
        SSE_EVENTS.PLAYER_LEFT,
        expect.objectContaining({ playerId: 'player2' })
      );
    });
  });

  describe('Host Reassignment', () => {
    it('should reassign host when current host disconnects', async () => {
      (get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('player1:heartbeat')) {
          return Promise.resolve((currentTime - 6000).toString()); // Host disconnected
        }
        return Promise.resolve((currentTime - 1000).toString());
      });
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(setLobby).toHaveBeenCalledWith(expect.objectContaining({
        hostId: 'player2',
        players: expect.arrayContaining([
          expect.objectContaining({ id: 'player2', isHost: true }),
          expect.objectContaining({ id: 'player3' }),
        ])
      }));
    });

    it('should assign first remaining player as new host', async () => {
      // Remove all players except player3
      mockLobby.players = [
        { id: 'player1', name: 'Host', avatar: '🎮', score: 0, isHost: true },
        { id: 'player3', name: 'Player 3', avatar: '🚀', score: 0, isHost: false },
      ];
      
      (get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('player1:heartbeat')) {
          return Promise.resolve((currentTime - 6000).toString()); // Host disconnected
        }
        return Promise.resolve((currentTime - 1000).toString());
      });
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(setLobby).toHaveBeenCalledWith(expect.objectContaining({
        hostId: 'player3',
        players: [expect.objectContaining({ id: 'player3', isHost: true })]
      }));
    });

    it('should not reassign host if non-host disconnects', async () => {
      (get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('player2:heartbeat')) {
          return Promise.resolve((currentTime - 6000).toString()); // Non-host disconnected
        }
        return Promise.resolve((currentTime - 1000).toString());
      });
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(setLobby).toHaveBeenCalledWith(expect.objectContaining({
        hostId: 'player1', // Host unchanged
      }));
    });
  });

  describe('Cleanup Operations', () => {
    it('should clean up player Redis keys on disconnect', async () => {
      (get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('player2:heartbeat')) {
          return Promise.resolve((currentTime - 6000).toString());
        }
        return Promise.resolve((currentTime - 1000).toString());
      });
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(del).toHaveBeenCalledWith([
        'player:TEST123:player2:heartbeat',
        'player:TEST123:player2:joinTime'
      ]);
    });

    it('should broadcast player left event', async () => {
      (get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('player2:heartbeat')) {
          return Promise.resolve((currentTime - 6000).toString());
        }
        return Promise.resolve((currentTime - 1000).toString());
      });
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(broadcastToLobby).toHaveBeenCalledWith(
        'TEST123',
        SSE_EVENTS.PLAYER_LEFT,
        {
          playerId: 'player2',
          lobby: expect.objectContaining({
            players: expect.not.arrayContaining([
              expect.objectContaining({ id: 'player2' })
            ])
          }),
        }
      );
    });

    it('should handle multiple disconnected players', async () => {
      (get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('player2:heartbeat') || key.includes('player3:heartbeat')) {
          return Promise.resolve((currentTime - 6000).toString());
        }
        return Promise.resolve((currentTime - 1000).toString());
      });
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(setLobby).toHaveBeenCalledWith(expect.objectContaining({
        players: [expect.objectContaining({ id: 'player1' })]
      }));
      
      expect(broadcastToLobby).toHaveBeenCalledTimes(2);
      expect(del).toHaveBeenCalledWith([
        'player:TEST123:player2:heartbeat',
        'player:TEST123:player2:joinTime'
      ]);
      expect(del).toHaveBeenCalledWith([
        'player:TEST123:player3:heartbeat',
        'player:TEST123:player3:joinTime'
      ]);
    });
  });

  describe('Empty Lobby Cleanup', () => {
    it('should delete lobby when all players disconnect', async () => {
      (get as jest.Mock).mockResolvedValue((currentTime - 6000).toString()); // All old heartbeats
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(del).toHaveBeenCalledWith(['lobby:TEST123', 'events:TEST123']);
    });

    it('should clean up orphaned player keys when lobby is empty', async () => {
      (get as jest.Mock).mockResolvedValue((currentTime - 6000).toString());
      (keys as jest.Mock).mockImplementation((pattern: string) => {
        if (pattern.includes('player:TEST123:')) {
          return Promise.resolve(['player:TEST123:old:heartbeat', 'player:TEST123:old:joinTime']);
        }
        return Promise.resolve([]);
      });
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(keys).toHaveBeenCalledWith('player:TEST123:*');
      expect(del).toHaveBeenCalledWith(['player:TEST123:old:heartbeat', 'player:TEST123:old:joinTime']);
    });

    it('should clean up distributed locks when lobby is empty', async () => {
      (get as jest.Mock).mockResolvedValue((currentTime - 6000).toString());
      (keys as jest.Mock).mockImplementation((pattern: string) => {
        if (pattern.includes('lock:')) {
          return Promise.resolve(['lobby:TEST123:lock:start', 'lobby:TEST123:lock:end']);
        }
        return Promise.resolve([]);
      });
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(keys).toHaveBeenCalledWith('lobby:TEST123:lock:*');
      expect(del).toHaveBeenCalledWith(['lobby:TEST123:lock:start', 'lobby:TEST123:lock:end']);
    });

    it('should not clean up keys if lobby is not empty', async () => {
      (get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('player2:heartbeat')) {
          return Promise.resolve((currentTime - 6000).toString()); // Only player2 disconnects
        }
        return Promise.resolve((currentTime - 1000).toString());
      });
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(del).not.toHaveBeenCalledWith(['lobby:TEST123', 'events:TEST123']);
      expect(keys).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should propagate Redis errors', async () => {
      (get as jest.Mock).mockRejectedValue(new Error('Redis error'));
      
      await expect(checkDisconnectedPlayers('TEST123')).rejects.toThrow('Redis error');
    });

    it('should propagate setLobby errors', async () => {
      (get as jest.Mock).mockResolvedValue((currentTime - 6000).toString());
      (setLobby as jest.Mock).mockRejectedValue(new Error('Storage error'));
      
      await expect(checkDisconnectedPlayers('TEST123')).rejects.toThrow('Storage error');
    });

    it('should propagate broadcast errors', async () => {
      (get as jest.Mock).mockResolvedValue((currentTime - 6000).toString());
      (broadcastToLobby as jest.Mock).mockRejectedValue(new Error('Broadcast error'));
      
      await expect(checkDisconnectedPlayers('TEST123')).rejects.toThrow('Broadcast error');
    });

    it('should handle malformed heartbeat timestamps', async () => {
      (get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('player2:heartbeat')) {
          return Promise.resolve('invalid-timestamp');
        }
        return Promise.resolve((currentTime - 1000).toString());
      });
      
      await checkDisconnectedPlayers('TEST123');
      
      // parseInt('invalid-timestamp') returns NaN
      // NaN - currentTime results in NaN, and NaN > 5000 is false
      // So player won't be disconnected due to heartbeat timeout
      expect(setLobby).not.toHaveBeenCalled();
    });

    it('should handle malformed join timestamps', async () => {
      (get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('player2:heartbeat')) {
          return Promise.resolve(null);
        }
        if (key.includes('player2:joinTime')) {
          return Promise.resolve('invalid-timestamp');
        }
        return Promise.resolve((currentTime - 1000).toString());
      });
      
      await checkDisconnectedPlayers('TEST123');
      
      // parseInt('invalid-timestamp') returns NaN
      // NaN - currentTime results in NaN, and NaN > 10000 is false
      // So player won't be disconnected due to grace period timeout
      expect(setLobby).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty player list', async () => {
      mockLobby.players = [];
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(get).not.toHaveBeenCalled();
      expect(setLobby).not.toHaveBeenCalled();
    });

    it('should handle lobby with single player', async () => {
      mockLobby.players = [mockLobby.players[0]];
      (get as jest.Mock).mockResolvedValue((currentTime - 6000).toString());
      
      await checkDisconnectedPlayers('TEST123');
      
      expect(del).toHaveBeenCalledWith(['lobby:TEST123', 'events:TEST123']);
    });

    it('should handle concurrent cleanup calls', async () => {
      (get as jest.Mock).mockResolvedValue((currentTime - 6000).toString());
      
      const [result1, result2] = await Promise.all([
        checkDisconnectedPlayers('TEST123'),
        checkDisconnectedPlayers('TEST123'),
      ]);
      
      // Both should complete without errors
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });

    it('should skip already marked players in force remove + timeout scenario', async () => {
      (get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('player2:heartbeat')) {
          return Promise.resolve((currentTime - 6000).toString()); // Also timed out
        }
        return Promise.resolve((currentTime - 1000).toString());
      });
      
      await checkDisconnectedPlayers('TEST123', 'player2'); // Force remove player2
      
      // Should only process player2 once
      expect(broadcastToLobby).toHaveBeenCalledTimes(1);
      expect(del).toHaveBeenCalledWith([
        'player:TEST123:player2:heartbeat',
        'player:TEST123:player2:joinTime'
      ]);
    });
  });
});