import { NextRequest } from 'next/server';
import { POST } from '@/app/api/game/check-progress/route';

// Mock the game state transitions module
jest.mock('@/app/lib/game-state-transitions');

import { checkAndProgressAfterRoundEnd } from '@/app/lib/game-state-transitions';

const mockCheckAndProgressAfterRoundEnd = checkAndProgressAfterRoundEnd as jest.Mock;

describe('/api/game/check-progress POST endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createRequest = (body: any) => {
    return new NextRequest('http://localhost:3000/api/game/check-progress', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  };

  describe('successful progress checks', () => {
    it('should check progress and return progressed status when game progresses', async () => {
      mockCheckAndProgressAfterRoundEnd.mockResolvedValue(true);
      
      const mockRequest = createRequest({
        lobbyId: 'TEST123',
        roundNum: 1
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ progressed: true });
      expect(mockCheckAndProgressAfterRoundEnd).toHaveBeenCalledWith('TEST123', 1);
    });

    it('should check progress and return progressed status when game does not progress', async () => {
      mockCheckAndProgressAfterRoundEnd.mockResolvedValue(false);
      
      const mockRequest = createRequest({
        lobbyId: 'ABC456',
        roundNum: 3
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ progressed: false });
      expect(mockCheckAndProgressAfterRoundEnd).toHaveBeenCalledWith('ABC456', 3);
    });

    it('should handle different lobby IDs and round numbers', async () => {
      mockCheckAndProgressAfterRoundEnd.mockResolvedValue(true);
      
      const testCases = [
        { lobbyId: 'LOBBY1', roundNum: 1 },
        { lobbyId: 'test-lobby-2', roundNum: 5 },
        { lobbyId: 'MixedCase123', roundNum: 10 }
      ];

      for (const { lobbyId, roundNum } of testCases) {
        jest.clearAllMocks();
        
        const mockRequest = createRequest({ lobbyId, roundNum });
        const response = await POST(mockRequest);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData).toEqual({ progressed: true });
        expect(mockCheckAndProgressAfterRoundEnd).toHaveBeenCalledWith(lobbyId, roundNum);
      }
    });
  });

  describe('validation errors', () => {
    it('should return 400 when lobbyId is missing', async () => {
      const mockRequest = createRequest({
        roundNum: 1
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData).toEqual({ error: 'Lobby ID and round number are required' });
      expect(mockCheckAndProgressAfterRoundEnd).not.toHaveBeenCalled();
    });

    it('should return 400 when roundNum is missing', async () => {
      const mockRequest = createRequest({
        lobbyId: 'TEST123'
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData).toEqual({ error: 'Lobby ID and round number are required' });
      expect(mockCheckAndProgressAfterRoundEnd).not.toHaveBeenCalled();
    });

    it('should return 400 when both are missing', async () => {
      const mockRequest = createRequest({});

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData).toEqual({ error: 'Lobby ID and round number are required' });
      expect(mockCheckAndProgressAfterRoundEnd).not.toHaveBeenCalled();
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
      expect(mockCheckAndProgressAfterRoundEnd).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should return 500 when checkAndProgressAfterRoundEnd throws an error', async () => {
      mockCheckAndProgressAfterRoundEnd.mockRejectedValue(new Error('Game state error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const mockRequest = createRequest({
        lobbyId: 'TEST123',
        roundNum: 1
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({ error: 'Failed to check progress' });
      expect(consoleSpy).toHaveBeenCalledWith('[CHECK PROGRESS] Error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle JSON parsing errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Create request with invalid JSON
      const mockRequest = new NextRequest('http://localhost:3000/api/game/check-progress', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({ error: 'Failed to check progress' });
      
      consoleSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle negative round numbers', async () => {
      mockCheckAndProgressAfterRoundEnd.mockResolvedValue(false);
      
      const mockRequest = createRequest({
        lobbyId: 'TEST123',
        roundNum: -1
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ progressed: false });
      expect(mockCheckAndProgressAfterRoundEnd).toHaveBeenCalledWith('TEST123', -1);
    });

    it('should handle very large round numbers', async () => {
      mockCheckAndProgressAfterRoundEnd.mockResolvedValue(true);
      
      const mockRequest = createRequest({
        lobbyId: 'TEST123',
        roundNum: 999999
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual({ progressed: true });
      expect(mockCheckAndProgressAfterRoundEnd).toHaveBeenCalledWith('TEST123', 999999);
    });
  });

  describe('concurrent requests', () => {
    it('should handle multiple concurrent progress checks', async () => {
      mockCheckAndProgressAfterRoundEnd.mockResolvedValue(true);
      
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
        expect(data).toEqual({ progressed: true });
      });

      expect(mockCheckAndProgressAfterRoundEnd).toHaveBeenCalledTimes(3);
    });
  });
});