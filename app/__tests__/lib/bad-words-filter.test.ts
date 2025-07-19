import { createLobby } from '@/app/lib/game-state-async';
import { Filter } from 'bad-words';

// Mock the upstash-storage module
jest.mock('@/app/lib/upstash-storage', () => ({
  setLobby: jest.fn(),
  getLobby: jest.fn(),
}));

// Mock the emoji modules
jest.mock('@/app/lib/face-emojis', () => ({
  getRandomFaceEmoji: jest.fn(() => '😀'),
}));

describe('Bad Words Filter in Lobby Creation', () => {
  it('should create lobby with clean code', async () => {
    const lobby = await createLobby('host123', 'TestHost');
    
    // Verify lobby was created
    expect(lobby).toBeDefined();
    expect(lobby.id).toBeDefined();
    expect(lobby.id.length).toBe(4);
    
    // Verify the generated code doesn't contain bad words
    const filter = new Filter();
    expect(filter.isProfane(lobby.id)).toBe(false);
  });

  it('should only use allowed characters in lobby code', async () => {
    const lobby = await createLobby('host456', 'TestHost2');
    
    // Verify lobby code only contains uppercase letters and numbers
    expect(lobby.id).toMatch(/^[A-Z0-9]{4}$/);
  });

  it('should handle multiple lobby creations', async () => {
    const filter = new Filter();
    const lobbies = [];
    
    // Create multiple lobbies to test filtering
    for (let i = 0; i < 10; i++) {
      const lobby = await createLobby(`host${i}`, `TestHost${i}`);
      lobbies.push(lobby);
    }
    
    // Verify all generated codes are clean
    for (const lobby of lobbies) {
      expect(filter.isProfane(lobby.id)).toBe(false);
    }
  });
});