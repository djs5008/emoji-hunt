import { Lobby } from '@/app/types/game';

// In-memory storage for testing
const storage = new Map<string, any>();

export const getLobby = jest.fn(async (id: string): Promise<Lobby | null> => {
  return storage.get(`lobby:${id}`) || null;
});

export const setLobby = jest.fn(async (lobby: Lobby): Promise<void> => {
  storage.set(`lobby:${lobby.id}`, lobby);
});

export const deleteLobby = jest.fn(async (id: string): Promise<void> => {
  storage.delete(`lobby:${id}`);
});

export const getActivePlayers = jest.fn(async (lobbyId: string): Promise<string[]> => {
  return storage.get(`lobby:${lobbyId}:active_players`) || [];
});

export const setActivePlayer = jest.fn(async (lobbyId: string, playerId: string): Promise<void> => {
  const players = await getActivePlayers(lobbyId);
  if (!players.includes(playerId)) {
    players.push(playerId);
    storage.set(`lobby:${lobbyId}:active_players`, players);
  }
});

export const removeActivePlayer = jest.fn(async (lobbyId: string, playerId: string): Promise<void> => {
  const players = await getActivePlayers(lobbyId);
  const filtered = players.filter(p => p !== playerId);
  storage.set(`lobby:${lobbyId}:active_players`, filtered);
});

// Helper to clear storage between tests
export const clearStorage = () => {
  storage.clear();
};

// Export the storage for direct access in tests if needed
export const __testStorage = storage;