// Mock for Tone.js library
const mockSynth = {
  toDestination: jest.fn().mockReturnThis(),
  connect: jest.fn().mockReturnThis(),
  triggerAttackRelease: jest.fn(),
  volume: { value: 0 },
};

const mockPolySynth = {
  toDestination: jest.fn().mockReturnThis(),
  connect: jest.fn().mockReturnThis(),
  triggerAttackRelease: jest.fn(),
  volume: { value: 0 },
};

const mockFilter = {
  toDestination: jest.fn().mockReturnThis(),
};

const mockLoop = {
  start: jest.fn().mockReturnThis(),
  stop: jest.fn(),
  dispose: jest.fn(),
};

module.exports = {
  start: jest.fn().mockResolvedValue(undefined),
  now: jest.fn().mockReturnValue(0),
  Transport: {
    start: jest.fn(),
    stop: jest.fn(),
    cancel: jest.fn(),
  },
  Synth: jest.fn().mockImplementation(() => mockSynth),
  PolySynth: jest.fn().mockImplementation(() => mockPolySynth),
  Filter: jest.fn().mockImplementation(() => mockFilter),
  Loop: jest.fn().mockImplementation(() => mockLoop),
};