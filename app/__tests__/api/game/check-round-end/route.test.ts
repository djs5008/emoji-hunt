import { NextRequest } from 'next/server';
import { POST } from '@/app/api/game/check-round-end/route';

// Mock the game state transitions module
jest.mock('@/app/lib/game-state-transitions');

import { checkAndEndRound } from '@/app/lib/game-state-transitions';

const mockCheckAndEndRound = checkAndEndRound as jest.Mock;

describe('/api/game/check-round-end POST endpoint', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createRequest = (body: any) => {
    return new NextRequest('http://localhost:3000/api/game/check-round-end', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  };

  describe('successful round end checks', () => {
    it('should check round end and return ended status when round ends', async () => {
      mockCheckAndEndRound.mockResolvedValue(true);
      
      mockRequest = createRequest({
        lobbyId: 'TEST123',
        roundNum: 1
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ ended: true });
      expect(mockCheckAndEndRound).toHaveBeenCalledWith('TEST123', 1);
    });

    it('should check round end and return ended status when round continues', async () => {
      mockCheckAndEndRound.mockResolvedValue(false);
      
      mockRequest = createRequest({
        lobbyId: 'ABC456',
        roundNum: 3
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ ended: false });
      expect(mockCheckAndEndRound).toHaveBeenCalledWith('ABC456', 3);
    });

    it('should handle different lobby ID formats', async () => {
      mockCheckAndEndRound.mockResolvedValue(false);
      
      const testCases = [
        'LOBBY123',
        'test-lobby-456',
        'MixedCase789',
        '123456',
        'lobby_with_underscores'
      ];

      for (const lobbyId of testCases) {
        jest.clearAllMocks();
        
        mockRequest = createRequest({
          lobbyId: lobbyId,
          roundNum: 2
        });

        const response = await POST(mockRequest);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData).toEqual({ ended: false });
        expect(mockCheckAndEndRound).toHaveBeenCalledWith(lobbyId, 2);
      }
    });

    it('should handle different round numbers', async () => {
      mockCheckAndEndRound.mockResolvedValue(true);
      
      const testCases = [1, 2, 3, 4, 5, 10];

      for (const roundNum of testCases) {
        jest.clearAllMocks();
        
        mockRequest = createRequest({
          lobbyId: 'TEST123',
          roundNum: roundNum
        });

        const response = await POST(mockRequest);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData).toEqual({ ended: true });
        expect(mockCheckAndEndRound).toHaveBeenCalledWith('TEST123', roundNum);
      }
    });
  });

  describe('validation errors', () => {
    it('should return 400 when lobbyId is missing', async () => {
      mockRequest = createRequest({
        roundNum: 1
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData).toEqual({ error: 'Lobby ID and round number are required' });
      expect(mockCheckAndEndRound).not.toHaveBeenCalled();
    });

    it('should return 400 when roundNum is missing', async () => {
      mockRequest = createRequest({
        lobbyId: 'TEST123'
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData).toEqual({ error: 'Lobby ID and round number are required' });
      expect(mockCheckAndEndRound).not.toHaveBeenCalled();
    });

    it('should return 400 when both lobbyId and roundNum are missing', async () => {
      mockRequest = createRequest({});

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData).toEqual({ error: 'Lobby ID and round number are required' });
      expect(mockCheckAndEndRound).not.toHaveBeenCalled();
    });

    it('should return 400 when lobbyId is empty string', async () => {
      mockRequest = createRequest({
        lobbyId: '',
        roundNum: 1
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData).toEqual({ error: 'Lobby ID and round number are required' });
      expect(mockCheckAndEndRound).not.toHaveBeenCalled();
    });

    it('should return 400 when roundNum is 0', async () => {
      mockRequest = createRequest({
        lobbyId: 'TEST123',
        roundNum: 0
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData).toEqual({ error: 'Lobby ID and round number are required' });
      expect(mockCheckAndEndRound).not.toHaveBeenCalled();
    });

    it('should return 400 when lobbyId is null', async () => {
      mockRequest = createRequest({
        lobbyId: null,
        roundNum: 1
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData).toEqual({ error: 'Lobby ID and round number are required' });
      expect(mockCheckAndEndRound).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should return 500 when checkAndEndRound throws an error', async () => {
      mockCheckAndEndRound.mockRejectedValue(new Error('Game state error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockRequest = createRequest({
        lobbyId: 'TEST123',
        roundNum: 1
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({ error: 'Failed to check round end' });
      expect(consoleSpy).toHaveBeenCalledWith('[CHECK ROUND END] Error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle network errors gracefully', async () => {
      mockCheckAndEndRound.mockRejectedValue(new Error('Network timeout'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockRequest = createRequest({
        lobbyId: 'NETWORK_TEST',
        roundNum: 2
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({ error: 'Failed to check round end' });
      
      consoleSpy.mockRestore();
    });

    it('should handle JSON parsing errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Create request with invalid JSON
      mockRequest = new NextRequest('http://localhost:3000/api/game/check-round-end', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({ error: 'Failed to check round end' });
      
      consoleSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle large round numbers', async () => {
      mockCheckAndEndRound.mockResolvedValue(false);
      
      mockRequest = createRequest({
        lobbyId: 'TEST123',
        roundNum: 999999
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ ended: false });
      expect(mockCheckAndEndRound).toHaveBeenCalledWith('TEST123', 999999);
    });

    it('should handle negative round numbers (API accepts them)', async () => {
      mockCheckAndEndRound.mockResolvedValue(false);
      
      mockRequest = createRequest({
        lobbyId: 'TEST123',
        roundNum: -1
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ ended: false });
      expect(mockCheckAndEndRound).toHaveBeenCalledWith('TEST123', -1);
    });

    it('should handle very long lobby IDs', async () => {
      mockCheckAndEndRound.mockResolvedValue(true);
      
      const longLobbyId = 'A'.repeat(1000);
      
      mockRequest = createRequest({
        lobbyId: longLobbyId,
        roundNum: 1
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ ended: true });
      expect(mockCheckAndEndRound).toHaveBeenCalledWith(longLobbyId, 1);
    });

    it('should handle special characters in lobby ID', async () => {
      mockCheckAndEndRound.mockResolvedValue(false);
      
      const specialLobbyId = 'test!@#$%^&*()_+-=[]{}|;:,.<>?';
      
      mockRequest = createRequest({
        lobbyId: specialLobbyId,
        roundNum: 2
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ ended: false });
      expect(mockCheckAndEndRound).toHaveBeenCalledWith(specialLobbyId, 2);
    });
  });

  describe('concurrent requests', () => {
    it('should handle multiple concurrent round end checks', async () => {
      mockCheckAndEndRound.mockResolvedValue(true);
      
      const requests = [
        createRequest({ lobbyId: 'LOBBY1', roundNum: 1 }),
        createRequest({ lobbyId: 'LOBBY2', roundNum: 2 }),
        createRequest({ lobbyId: 'LOBBY3', roundNum: 3 }),
      ];

      const responses = await Promise.all(requests.map(req => POST(req)));
      const responseDatas = await Promise.all(responses.map(res => res.json()));

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      responseDatas.forEach(data => {
        expect(data).toEqual({ ended: true });
      });

      expect(mockCheckAndEndRound).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and error scenarios', async () => {
      mockCheckAndEndRound
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Game error'))
        .mockResolvedValueOnce(false);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const requests = [
        createRequest({ lobbyId: 'SUCCESS1', roundNum: 1 }),
        createRequest({ lobbyId: 'ERROR1', roundNum: 2 }),
        createRequest({ lobbyId: 'SUCCESS2', roundNum: 3 }),
      ];

      const responses = await Promise.all(requests.map(req => POST(req)));
      const responseDatas = await Promise.all(responses.map(res => res.json()));

      expect(responses[0].status).toBe(200);
      expect(responseDatas[0]).toEqual({ ended: true });

      expect(responses[1].status).toBe(500);
      expect(responseDatas[1]).toEqual({ error: 'Failed to check round end' });

      expect(responses[2].status).toBe(200);
      expect(responseDatas[2]).toEqual({ ended: false });

      consoleSpy.mockRestore();
    });
  });
});