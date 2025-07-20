import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GameCanvas from '@/app/components/GameCanvas';
import { Round } from '@/app/types/game';

// Mock canvas context
const mockCanvasContext = {
  clearRect: jest.fn(),
  fillText: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  arc: jest.fn(),
  stroke: jest.fn(),
  globalAlpha: 1,
  font: '',
  fillStyle: '',
  textAlign: 'left' as CanvasTextAlign,
  textBaseline: 'alphabetic' as CanvasTextBaseline,
  strokeStyle: '',
  lineWidth: 0,
  shadowColor: '',
  shadowBlur: 0,
};

// Mock HTMLCanvasElement.getContext
HTMLCanvasElement.prototype.getContext = jest.fn(() => mockCanvasContext);

// Mock getBoundingClientRect with proper canvas dimensions
HTMLCanvasElement.prototype.getBoundingClientRect = jest.fn(() => ({
  left: 0,
  top: 0,
  right: 2400,
  bottom: 1200,
  width: 2400,
  height: 1200,
  x: 0,
  y: 0,
  toJSON: () => {},
}));

// Add helper to access canvas
const getCanvas = (container: HTMLElement) => {
  return container.querySelector('canvas') as HTMLCanvasElement;
};

describe('GameCanvas', () => {
  const mockOnEmojiClick = jest.fn();
  const mockOnTimeUpdate = jest.fn();
  
  // Mock window dimensions
  beforeAll(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  const createMockRound = (overrides?: Partial<Round>): Round => ({
    number: 1,
    targetEmoji: '🎯',
    emojiPositions: [
      { id: 'emoji-1', emoji: '🎯', x: 50, y: 50, fontSize: 48 },
      { id: 'emoji-2', emoji: '🎮', x: 150, y: 150, fontSize: 48 },
      { id: 'emoji-3', emoji: '🎨', x: 250, y: 250, fontSize: 48 },
    ],
    startTime: Date.now(),
    endTime: Date.now() + 30000,
    foundBy: [],
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock parent element for scale calculation
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 2400;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        return 1200;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'parentElement', {
      configurable: true,
      get() {
        return {
          parentElement: {
            clientWidth: 2400,
            clientHeight: 1200,
          },
        };
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render waiting message when no round is provided', () => {
    render(
      <GameCanvas
        round={null}
        lobbyId="test-lobby"
        playerId="player-1"
        onEmojiClick={mockOnEmojiClick}
      />
    );

    expect(screen.getByText('Waiting for round to start...')).toBeInTheDocument();
  });

  it('should render canvas with emojis when round is provided', () => {
    const round = createMockRound();

    const { container } = render(
      <GameCanvas
        round={round}
        lobbyId="test-lobby"
        playerId="player-1"
        onEmojiClick={mockOnEmojiClick}
      />
    );

    const canvas = getCanvas(container);
    expect(canvas).toBeInTheDocument();
    expect(canvas.width).toBe(2400);
    expect(canvas.height).toBe(1200);

    // Verify emojis are drawn
    expect(mockCanvasContext.fillText).toHaveBeenCalledWith('🎯', 50, 50);
    expect(mockCanvasContext.fillText).toHaveBeenCalledWith('🎮', 150, 150);
    expect(mockCanvasContext.fillText).toHaveBeenCalledWith('🎨', 250, 250);
  });

  it('should handle emoji clicks correctly', async () => {
    const user = userEvent.setup({ delay: null });
    const round = createMockRound();

    const { container } = render(
      <GameCanvas
        round={round}
        lobbyId="test-lobby"
        playerId="player-1"
        onEmojiClick={mockOnEmojiClick}
      />
    );

    const canvas = getCanvas(container);
    
    // Simulate clicking on the first emoji (at position 50, 50)
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 50,
      clientY: 50,
    });
    Object.defineProperty(clickEvent, 'pageX', { value: 50, configurable: true });
    Object.defineProperty(clickEvent, 'pageY', { value: 50, configurable: true });
    
    canvas.dispatchEvent(clickEvent);

    expect(mockOnEmojiClick).toHaveBeenCalledWith(
      'emoji-1',
      50,
      50,
      74,  // emoji center X position
      35.6 // emoji center Y position
    );
  });

  it('should handle clicks on empty space', () => {
    const round = createMockRound();

    const { container } = render(
      <GameCanvas
        round={round}
        lobbyId="test-lobby"
        playerId="player-1"
        onEmojiClick={mockOnEmojiClick}
      />
    );

    const canvas = getCanvas(container);
    
    // Click on empty space
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 500,
      clientY: 500,
    });
    Object.defineProperty(clickEvent, 'pageX', { value: 500, configurable: true });
    Object.defineProperty(clickEvent, 'pageY', { value: 500, configurable: true });
    
    canvas.dispatchEvent(clickEvent);

    expect(mockOnEmojiClick).toHaveBeenCalledWith(
      '', // Empty string for missed clicks
      500,
      500,
      500,
      500
    );
  });

  it('should highlight found emoji', () => {
    const round = createMockRound();

    const { container } = render(
      <GameCanvas
        round={round}
        lobbyId="test-lobby"
        playerId="player-1"
        onEmojiClick={mockOnEmojiClick}
        foundEmojiId="emoji-1"
      />
    );

    // Check that highlight effect is applied
    expect(mockCanvasContext.strokeStyle).toBe('#4ADE80');
    expect(mockCanvasContext.arc).toHaveBeenCalled();
    expect(mockCanvasContext.stroke).toHaveBeenCalled();
  });

  it('should highlight target emoji when highlightTargetEmoji is true', () => {
    const round = createMockRound();

    const { container } = render(
      <GameCanvas
        round={round}
        lobbyId="test-lobby"
        playerId="player-1"
        onEmojiClick={mockOnEmojiClick}
        highlightTargetEmoji={true}
      />
    );

    // Check that target emoji is highlighted
    expect(mockCanvasContext.strokeStyle).toBe('#4ADE80');
    expect(mockCanvasContext.arc).toHaveBeenCalled();
    expect(mockCanvasContext.stroke).toHaveBeenCalled();
  });

  it('should dim non-target emojis when highlighting', () => {
    const round = createMockRound();

    const { container } = render(
      <GameCanvas
        round={round}
        lobbyId="test-lobby"
        playerId="player-1"
        onEmojiClick={mockOnEmojiClick}
        highlightTargetEmoji={true}
      />
    );

    // Check that globalAlpha was set for dimming
    expect(mockCanvasContext.globalAlpha).toBe(0.2);
  });

  it('should handle touch events', () => {
    const round = createMockRound();

    const { container } = render(
      <GameCanvas
        round={round}
        lobbyId="test-lobby"
        playerId="player-1"
        onEmojiClick={mockOnEmojiClick}
      />
    );

    const canvas = getCanvas(container);
    
    // Simulate touch tap
    fireEvent.touchStart(canvas, {
      touches: [{ clientX: 50, clientY: 50 }],
    });

    fireEvent.touchEnd(canvas, {
      changedTouches: [{ clientX: 50, clientY: 50, pageX: 50, pageY: 50 }],
    });

    expect(mockOnEmojiClick).toHaveBeenCalledWith(
      'emoji-1',
      50,
      50,
      74,  // emoji center X position
      35.6 // emoji center Y position
    );
  });

  it('should ignore touch if movement detected (swipe)', () => {
    const round = createMockRound();

    const { container } = render(
      <GameCanvas
        round={round}
        lobbyId="test-lobby"
        playerId="player-1"
        onEmojiClick={mockOnEmojiClick}
      />
    );

    const canvas = getCanvas(container);
    
    // Simulate swipe
    fireEvent.touchStart(canvas, {
      touches: [{ clientX: 50, clientY: 50 }],
    });

    fireEvent.touchEnd(canvas, {
      changedTouches: [{ clientX: 150, clientY: 150, pageX: 150, pageY: 150 }],
    });

    expect(mockOnEmojiClick).not.toHaveBeenCalled();
  });

  it('should update timer', () => {
    const round = createMockRound({
      endTime: Date.now() + 10000, // 10 seconds remaining
    });

    const { container } = render(
      <GameCanvas
        round={round}
        lobbyId="test-lobby"
        playerId="player-1"
        onEmojiClick={mockOnEmojiClick}
        onTimeUpdate={mockOnTimeUpdate}
      />
    );

    // Timer should update immediately
    expect(mockOnTimeUpdate).toHaveBeenCalledWith(10);

    // Advance time and check timer updates
    jest.advanceTimersByTime(1000);
    expect(mockOnTimeUpdate).toHaveBeenLastCalledWith(9);
  });

  it('should disable interactions when disabled prop is true', () => {
    const round = createMockRound();

    const { container } = render(
      <GameCanvas
        round={round}
        lobbyId="test-lobby"
        playerId="player-1"
        onEmojiClick={mockOnEmojiClick}
        disabled={true}
      />
    );

    const canvas = getCanvas(container);
    
    fireEvent.click(canvas, {
      clientX: 50,
      clientY: 50,
    });

    expect(mockOnEmojiClick).not.toHaveBeenCalled();
  });

  it('should apply opacity style', () => {
    const round = createMockRound();

    const { container } = render(
      <GameCanvas
        round={round}
        lobbyId="test-lobby"
        playerId="player-1"
        onEmojiClick={mockOnEmojiClick}
        opacity={0.5}
      />
    );

    const wrapper = container.querySelector('[style*="opacity"]');
    expect(wrapper).toHaveStyle({ opacity: '0.5' });
  });

  it('should handle window resize', () => {
    const round = createMockRound();

    const { container } = render(
      <GameCanvas
        round={round}
        lobbyId="test-lobby"
        playerId="player-1"
        onEmojiClick={mockOnEmojiClick}
      />
    );

    // Simulate window resize
    global.innerWidth = 500;
    global.innerHeight = 800;
    fireEvent(window, new Event('resize'));

    // Canvas should still be rendered
    const canvas = getCanvas(container);
    expect(canvas).toBeInTheDocument();
  });

  it('should prevent context menu on right click', () => {
    const round = createMockRound();

    const { container } = render(
      <GameCanvas
        round={round}
        lobbyId="test-lobby"
        playerId="player-1"
        onEmojiClick={mockOnEmojiClick}
      />
    );

    const contextMenuEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    });

    const preventDefaultSpy = jest.spyOn(contextMenuEvent, 'preventDefault');
    document.dispatchEvent(contextMenuEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should block developer tools shortcuts', () => {
    const round = createMockRound();

    const { container } = render(
      <GameCanvas
        round={round}
        lobbyId="test-lobby"
        playerId="player-1"
        onEmojiClick={mockOnEmojiClick}
      />
    );

    // Test F12
    const f12Event = new KeyboardEvent('keydown', {
      key: 'F12',
      bubbles: true,
    });
    const f12PreventDefault = jest.spyOn(f12Event, 'preventDefault');
    document.dispatchEvent(f12Event);
    expect(f12PreventDefault).toHaveBeenCalled();

    // Test Ctrl+Shift+I
    const devToolsEvent = new KeyboardEvent('keydown', {
      key: 'I',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    });
    const devToolsPreventDefault = jest.spyOn(devToolsEvent, 'preventDefault');
    document.dispatchEvent(devToolsEvent);
    expect(devToolsPreventDefault).toHaveBeenCalled();
  });
});