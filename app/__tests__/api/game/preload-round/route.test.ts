import { NextRequest } from 'next/server';
import { POST } from '@/app/api/game/preload-round/route';

// Mock the game state transitions module
jest.mock('@/app/lib/game-state-transitions');

import { preloadRound } from '@/app/lib/game-state-transitions';

const mockPreloadRound = preloadRound as jest.Mock;

describe('/api/game/preload-round POST endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createRequest = (body: any) => {
    return new NextRequest('http://localhost:3000/api/game/preload-round', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  };

  describe('successful round preloading', () => {
    it('should preload round and return success when preloading succeeds', async () => {
      mockPreloadRound.mockResolvedValue(true);
      
      const mockRequest = createRequest({
        lobbyId: 'TEST123',
        roundNum: 2
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ success: true });
      expect(mockPreloadRound).toHaveBeenCalledWith('TEST123', 2);
    });

    it('should preload round and return success when preloading fails', async () => {
      mockPreloadRound.mockResolvedValue(false);
      
      const mockRequest = createRequest({
        lobbyId: 'ABC456',
        roundNum: 1
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ success: false });
      expect(mockPreloadRound).toHaveBeenCalledWith('ABC456', 1);
    });

    it('should handle different lobby IDs and round numbers', async () => {
      mockPreloadRound.mockResolvedValue(true);
      
      const testCases = [
        { lobbyId: 'PRELOAD_1', roundNum: 1 },
        { lobbyId: 'test-preload-2', roundNum: 3 },
        { lobbyId: 'FinalPreload789', roundNum: 5 }
      ];

      for (const { lobbyId, roundNum } of testCases) {
        jest.clearAllMocks();
        
        const mockRequest = createRequest({ lobbyId, roundNum });
        const response = await POST(mockRequest);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData).toEqual({ success: true });
        expect(mockPreloadRound).toHaveBeenCalledWith(lobbyId, roundNum);
      }
    });

    it('should handle preloading for all round numbers in a game', async () => {
      mockPreloadRound.mockResolvedValue(true);
      
      const lobbyId = 'FULL_GAME_TEST';
      const maxRounds = 5;

      for (let roundNum = 1; roundNum <= maxRounds; roundNum++) {
        jest.clearAllMocks();
        
        const mockRequest = createRequest({ lobbyId, roundNum });
        const response = await POST(mockRequest);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData).toEqual({ success: true });
        expect(mockPreloadRound).toHaveBeenCalledWith(lobbyId, roundNum);
      }
    });
  });

  describe('validation errors', () => {
    it('should return 400 when lobbyId is missing', async () => {
      const mockRequest = createRequest({
        roundNum: 2
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData).toEqual({ error: 'Lobby ID and round number are required' });
      expect(mockPreloadRound).not.toHaveBeenCalled();
    });

    it('should return 400 when roundNum is missing', async () => {
      const mockRequest = createRequest({
        lobbyId: 'TEST123'
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData).toEqual({ error: 'Lobby ID and round number are required' });
      expect(mockPreloadRound).not.toHaveBeenCalled();
    });

    it('should return 400 when both are missing', async () => {
      const mockRequest = createRequest({});

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData).toEqual({ error: 'Lobby ID and round number are required' });
      expect(mockPreloadRound).not.toHaveBeenCalled();
    });

    it('should return 400 when roundNum is 0', async () => {
      const mockRequest = createRequest({
        lobbyId: 'TEST123',
        roundNum: 0
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData).toEqual({ error: 'Lobby ID and round number are required' });
      expect(mockPreloadRound).not.toHaveBeenCalled();
    });

    it('should return 400 when lobbyId is empty string', async () => {
      const mockRequest = createRequest({
        lobbyId: '',
        roundNum: 1
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData).toEqual({ error: 'Lobby ID and round number are required' });
      expect(mockPreloadRound).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should return 500 when preloadRound throws an error', async () => {
      mockPreloadRound.mockRejectedValue(new Error('Preload failed'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const mockRequest = createRequest({
        lobbyId: 'ERROR_TEST',
        roundNum: 1
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({ error: 'Failed to preload round' });
      expect(consoleSpy).toHaveBeenCalledWith('[PRELOAD ROUND] Error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle network timeout errors', async () => {
      mockPreloadRound.mockRejectedValue(new Error('Network timeout'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const mockRequest = createRequest({
        lobbyId: 'TIMEOUT_TEST',
        roundNum: 3
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({ error: 'Failed to preload round' });
      
      consoleSpy.mockRestore();
    });

    it('should handle JSON parsing errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Create request with invalid JSON
      const mockRequest = new NextRequest('http://localhost:3000/api/game/preload-round', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({ error: 'Failed to preload round' });
      
      consoleSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle preloading for very large round numbers', async () => {
      mockPreloadRound.mockResolvedValue(true);
      
      const mockRequest = createRequest({
        lobbyId: 'LARGE_ROUND',
        roundNum: 999999
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ success: true });
      expect(mockPreloadRound).toHaveBeenCalledWith('LARGE_ROUND', 999999);
    });

    it('should handle preloading for negative round numbers', async () => {
      mockPreloadRound.mockResolvedValue(false);
      
      const mockRequest = createRequest({
        lobbyId: 'NEGATIVE_ROUND',
        roundNum: -1
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ success: false });
      expect(mockPreloadRound).toHaveBeenCalledWith('NEGATIVE_ROUND', -1);
    });

    it('should handle special characters in lobby ID', async () => {
      mockPreloadRound.mockResolvedValue(true);
      
      const specialLobbyId = 'test@lobby#123';
      
      const mockRequest = createRequest({
        lobbyId: specialLobbyId,
        roundNum: 1
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ success: true });
      expect(mockPreloadRound).toHaveBeenCalledWith(specialLobbyId, 1);
    });
  });

  describe('concurrent requests', () => {
    it('should handle multiple concurrent preload requests', async () => {
      mockPreloadRound.mockResolvedValue(true);
      
      const requests = [
        createRequest({ lobbyId: 'CONCURRENT1', roundNum: 1 }),
        createRequest({ lobbyId: 'CONCURRENT2', roundNum: 2 }),
        createRequest({ lobbyId: 'CONCURRENT3', roundNum: 3 }),
      ];

      const responses = await Promise.all(requests.map(req => POST(req)));
      const responseDatas = await Promise.all(responses.map(res => res.json()));

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      responseDatas.forEach(data => {
        expect(data).toEqual({ success: true });
      });

      expect(mockPreloadRound).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure scenarios', async () => {
      mockPreloadRound
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockRejectedValueOnce(new Error('Preload error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const requests = [
        createRequest({ lobbyId: 'SUCCESS', roundNum: 1 }),
        createRequest({ lobbyId: 'FAILURE', roundNum: 2 }),
        createRequest({ lobbyId: 'ERROR', roundNum: 3 }),
      ];

      const responses = await Promise.all(requests.map(req => POST(req)));
      const responseDatas = await Promise.all(responses.map(res => res.json()));

      expect(responses[0].status).toBe(200);
      expect(responseDatas[0]).toEqual({ success: true });

      expect(responses[1].status).toBe(200);
      expect(responseDatas[1]).toEqual({ success: false });

      expect(responses[2].status).toBe(500);
      expect(responseDatas[2]).toEqual({ error: 'Failed to preload round' });

      consoleSpy.mockRestore();
    });
  });

  describe('performance considerations', () => {
    it('should handle rapid preload requests for sequential rounds', async () => {
      mockPreloadRound.mockResolvedValue(true);
      
      const lobbyId = 'PERFORMANCE_TEST';
      const promises = [];
      
      // Simulate preloading multiple rounds rapidly
      for (let roundNum = 1; roundNum <= 10; roundNum++) {
        promises.push(
          POST(createRequest({ lobbyId, roundNum }))
        );
      }
      
      const responses = await Promise.all(promises);
      const responseDatas = await Promise.all(responses.map(res => res.json()));
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      responseDatas.forEach(data => {
        expect(data).toEqual({ success: true });
      });
      
      expect(mockPreloadRound).toHaveBeenCalledTimes(10);
    });
  });
});