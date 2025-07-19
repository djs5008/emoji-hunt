import { NextRequest } from 'next/server';
import { POST } from '@/app/api/game/check-round-start/route';

// Mock the game state transitions module
jest.mock('@/app/lib/game-state-transitions');

import { checkAndStartRound } from '@/app/lib/game-state-transitions';

const mockCheckAndStartRound = checkAndStartRound as jest.Mock;

describe('/api/game/check-round-start POST endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createRequest = (body: any) => {
    return new NextRequest('http://localhost:3000/api/game/check-round-start', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  };

  describe('successful round start checks', () => {
    it('should check round start and return started status when round starts', async () => {
      mockCheckAndStartRound.mockResolvedValue(true);
      
      const mockRequest = createRequest({
        lobbyId: 'TEST123',
        roundNum: 2
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ started: true });
      expect(mockCheckAndStartRound).toHaveBeenCalledWith('TEST123', 2);
    });

    it('should check round start and return started status when round does not start', async () => {
      mockCheckAndStartRound.mockResolvedValue(false);
      
      const mockRequest = createRequest({
        lobbyId: 'ABC456',
        roundNum: 1
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ started: false });
      expect(mockCheckAndStartRound).toHaveBeenCalledWith('ABC456', 1);
    });

    it('should handle different lobby IDs and round numbers', async () => {
      mockCheckAndStartRound.mockResolvedValue(true);
      
      const testCases = [
        { lobbyId: 'ROUND_START_1', roundNum: 1 },
        { lobbyId: 'test-round-2', roundNum: 3 },
        { lobbyId: 'FinalRound789', roundNum: 5 }
      ];

      for (const { lobbyId, roundNum } of testCases) {
        jest.clearAllMocks();
        
        const mockRequest = createRequest({ lobbyId, roundNum });
        const response = await POST(mockRequest);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData).toEqual({ started: true });
        expect(mockCheckAndStartRound).toHaveBeenCalledWith(lobbyId, roundNum);
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
      expect(mockCheckAndStartRound).not.toHaveBeenCalled();
    });

    it('should return 400 when roundNum is missing', async () => {
      const mockRequest = createRequest({
        lobbyId: 'TEST123'
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData).toEqual({ error: 'Lobby ID and round number are required' });
      expect(mockCheckAndStartRound).not.toHaveBeenCalled();
    });

    it('should return 400 when both are missing', async () => {
      const mockRequest = createRequest({});

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData).toEqual({ error: 'Lobby ID and round number are required' });
      expect(mockCheckAndStartRound).not.toHaveBeenCalled();
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
      expect(mockCheckAndStartRound).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should return 500 when checkAndStartRound throws an error', async () => {
      mockCheckAndStartRound.mockRejectedValue(new Error('Round start error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const mockRequest = createRequest({
        lobbyId: 'ERROR_TEST',
        roundNum: 1
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({ error: 'Failed to check round start' });
      expect(consoleSpy).toHaveBeenCalledWith('[CHECK ROUND START] Error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle JSON parsing errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Create request with invalid JSON
      const mockRequest = new NextRequest('http://localhost:3000/api/game/check-round-start', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({ error: 'Failed to check round start' });
      
      consoleSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle first round start', async () => {
      mockCheckAndStartRound.mockResolvedValue(true);
      
      const mockRequest = createRequest({
        lobbyId: 'FIRST_ROUND',
        roundNum: 1
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ started: true });
      expect(mockCheckAndStartRound).toHaveBeenCalledWith('FIRST_ROUND', 1);
    });

    it('should handle final round start', async () => {
      mockCheckAndStartRound.mockResolvedValue(true);
      
      const mockRequest = createRequest({
        lobbyId: 'FINAL_ROUND',
        roundNum: 5
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ started: true });
      expect(mockCheckAndStartRound).toHaveBeenCalledWith('FINAL_ROUND', 5);
    });

    it('should handle timing-based round start checks', async () => {
      // Simulate multiple rapid checks (typical in game timing)
      mockCheckAndStartRound
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      
      for (let i = 0; i < 3; i++) {
        const mockRequest = createRequest({
          lobbyId: 'TIMING_TEST',
          roundNum: 2
        });

        const response = await POST(mockRequest);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        
        if (i < 2) {
          expect(responseData).toEqual({ started: false });
        } else {
          expect(responseData).toEqual({ started: true });
        }
      }

      expect(mockCheckAndStartRound).toHaveBeenCalledTimes(3);
    });
  });

  describe('concurrent requests', () => {
    it('should handle multiple concurrent round start checks', async () => {
      mockCheckAndStartRound.mockResolvedValue(false);
      
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
        expect(data).toEqual({ started: false });
      });

      expect(mockCheckAndStartRound).toHaveBeenCalledTimes(3);
    });
  });
});