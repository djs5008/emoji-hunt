import { 
  getPollingInterval, 
  getPriorityPollingInterval,
  POLLING_INTERVALS,
  HEARTBEAT,
  EVENT_QUEUE,
  CONNECTION_LIMITS,
  BATCHING
} from '@/app/lib/redis-optimization';

describe('redis-optimization', () => {
  describe('getPollingInterval', () => {
    it('should return correct interval for waiting state', () => {
      expect(getPollingInterval('waiting')).toBe(1000);
    });

    it('should return correct interval for countdown state', () => {
      expect(getPollingInterval('countdown')).toBe(50);
    });

    it('should return correct interval for playing state', () => {
      expect(getPollingInterval('playing')).toBe(50);
    });

    it('should return correct interval for roundEnd state', () => {
      expect(getPollingInterval('roundEnd')).toBe(50);
    });

    it('should return correct interval for finished state', () => {
      expect(getPollingInterval('finished')).toBe(2000);
    });

    it('should return waiting interval for unknown state', () => {
      expect(getPollingInterval('unknown')).toBe(1000);
    });
  });

  describe('getPriorityPollingInterval', () => {
    it('should return 50ms for countdown state', () => {
      expect(getPriorityPollingInterval('countdown')).toBe(50);
    });

    it('should return 50ms for playing state', () => {
      expect(getPriorityPollingInterval('playing')).toBe(50);
    });

    it('should return 50ms for roundEnd state', () => {
      expect(getPriorityPollingInterval('roundEnd')).toBe(50);
    });

    it('should return null for waiting state', () => {
      expect(getPriorityPollingInterval('waiting')).toBeNull();
    });

    it('should return null for finished state', () => {
      expect(getPriorityPollingInterval('finished')).toBeNull();
    });

    it('should return null for unknown state', () => {
      expect(getPriorityPollingInterval('unknown')).toBeNull();
    });
  });

  describe('Configuration constants', () => {
    it('should have correct polling intervals', () => {
      expect(POLLING_INTERVALS).toEqual({
        WAITING: 1000,
        COUNTDOWN: 50,
        PLAYING: 50,
        ROUND_END: 50,
        FINISHED: 2000,
      });
    });

    it('should have correct heartbeat configuration', () => {
      expect(HEARTBEAT).toEqual({
        INTERVAL: 2000,
        TIMEOUT: 6000,
        TTL: 8,
      });
    });

    it('should have correct event queue configuration', () => {
      expect(EVENT_QUEUE).toEqual({
        MAX_AGE: 30000,
        CLEANUP_INTERVAL: 10000,
      });
    });

    it('should have correct connection limits', () => {
      expect(CONNECTION_LIMITS).toEqual({
        MAX_PLAYERS_PER_LOBBY: 100,
        RECONNECT_INTERVAL: 240000,
      });
    });

    it('should have correct batching configuration', () => {
      expect(BATCHING).toEqual({
        ENABLED: true,
        BATCH_SIZE: 10,
        BATCH_DELAY: 50,
      });
    });
  });
});