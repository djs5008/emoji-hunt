'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Round } from '@/app/types/game';

/**
 * GameCanvas Component - Main game rendering and interaction surface
 * 
 * @description This component renders the emoji grid using HTML5 Canvas and handles
 * all player interactions. It features responsive scaling, touch support, and
 * visual feedback for found emojis.
 * 
 * Key features:
 * - Canvas-based rendering for performance with many emojis
 * - Responsive scaling for different screen sizes
 * - Touch and click support with tap detection
 * - Security measures (disabled dev tools shortcuts)
 * - Visual highlighting for found/target emojis
 * - Mobile-optimized with horizontal scrolling
 * - Real-time timer updates
 */
interface GameCanvasProps {
  round: Round | null;                    // Current round data with emoji positions
  lobbyId: string;                       // Lobby identifier
  playerId: string;                      // Current player ID
  onEmojiClick: (                        // Callback for emoji interactions
    emojiId: string,                     // ID of clicked emoji (empty if missed)
    x: number,                           // Canvas X coordinate
    y: number,                           // Canvas Y coordinate
    pageX: number,                       // Page X coordinate (for effects)
    pageY: number                        // Page Y coordinate (for effects)
  ) => void;
  disabled?: boolean;                    // Disable interactions
  onTimeUpdate?: (time: number) => void; // Timer update callback
  highlightTargetEmoji?: boolean;        // Show target emoji (answer reveal)
  foundEmojiId?: string | null;          // ID of found emoji to highlight
  opacity?: number;                      // Canvas opacity for transitions
}

// Canvas dimensions - larger to support more emojis
const CANVAS_WIDTH = 2400;
const CANVAS_HEIGHT = 1200;

export default function GameCanvas({
  round,
  onEmojiClick,
  disabled,
  onTimeUpdate,
  highlightTargetEmoji,
  foundEmojiId,
  opacity = 1,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const animationFrameRef = useRef<number>();
  const timerRef = useRef<NodeJS.Timeout>();
  const hasScrolledToCenter = useRef(false);

  /**
   * Security measures - Prevent easy cheating
   * Disables right-click and common dev tools shortcuts
   */
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block common developer tools shortcuts
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) ||
        (e.ctrlKey && e.key === 'f')
      ) {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  /**
   * Responsive scaling system
   * Calculates optimal canvas scale based on container size
   * Mobile: Prioritizes vertical space usage
   * Desktop: Maintains aspect ratio within container
   */
  useEffect(() => {
    const updateScale = () => {
      if (!canvasRef.current) return;

      const container = canvasRef.current.parentElement?.parentElement;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const isMobile = window.innerWidth < 768;

      if (isMobile) {
        // Mobile: Maximize vertical space usage
        const scaleY = containerHeight / CANVAS_HEIGHT;
        setScale(scaleY * 0.98); // Small margin for safety
      } else {
        // Desktop: Fit within container maintaining aspect ratio
        const scaleX = containerWidth / CANVAS_WIDTH;
        const scaleY = containerHeight / CANVAS_HEIGHT;
        const newScale = Math.min(scaleX, scaleY);
        setScale(newScale);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    // Also update on orientation change
    window.addEventListener('orientationchange', () => {
      setTimeout(updateScale, 100); // Delay to ensure dimensions are updated
    });
    return () => {
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('orientationchange', updateScale);
    };
  }, []);

  /**
   * Core interaction handler
   * Converts screen coordinates to canvas coordinates and detects emoji hits
   * Includes tolerance for touch accuracy and position obfuscation
   */
  const handleCanvasInteraction = useCallback(
    (clientX: number, clientY: number, pageX: number, pageY: number) => {
      // Early exit conditions
      if (disabled || !round || !canvasRef.current) {
        return;
      }

      if (!round.emojiPositions || round.emojiPositions.length === 0) {
        return;
      }

      if (!round.targetEmoji) {
        return;
      }

      // Convert screen coordinates to canvas coordinates
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (clientX - rect.left) / scale;
      const y = (clientY - rect.top) / scale;

      // Hit detection with tolerance
      let foundEmoji = null;
      for (const emoji of round.emojiPositions) {
        // Expanded hit box for better touch accuracy
        const tolerance = 20;
        const emojiLeft = emoji.x - tolerance;
        const emojiRight = emoji.x + emoji.fontSize + tolerance;
        const emojiTop = emoji.y - emoji.fontSize * 0.8 - tolerance;
        const emojiBottom = emoji.y + emoji.fontSize * 0.2 + tolerance;

        if (
          x >= emojiLeft &&
          x <= emojiRight &&
          y >= emojiTop &&
          y <= emojiBottom
        ) {
          foundEmoji = emoji;
          break;
        }
      }

      // Report click with emoji ID or empty string for miss
      if (foundEmoji) {
        onEmojiClick(foundEmoji.id, x, y, pageX, pageY);
      } else {
        onEmojiClick('', x, y, pageX, pageY);
      }
    },
    [round, scale, disabled, onEmojiClick]
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      handleCanvasInteraction(e.clientX, e.clientY, e.pageX, e.pageY);
    },
    [handleCanvasInteraction]
  );

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  
  const handleCanvasTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        touchStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: Date.now()
        };
      }
    },
    []
  );

  const handleCanvasTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!touchStartRef.current || e.changedTouches.length === 0) return;
      
      const touch = e.changedTouches[0];
      const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
      const deltaTime = Date.now() - touchStartRef.current.time;
      
      // Only trigger click if it's a tap (minimal movement and quick)
      if (deltaX < 10 && deltaY < 10 && deltaTime < 300) {
        e.preventDefault(); // Only prevent default for actual taps
        handleCanvasInteraction(
          touch.clientX,
          touch.clientY,
          touch.pageX,
          touch.pageY
        );
      }
      
      touchStartRef.current = null;
    },
    [handleCanvasInteraction]
  );

  // Timer effect
  useEffect(() => {
    if (!round) return;

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((round.endTime - now) / 1000));

      if (onTimeUpdate) {
        onTimeUpdate(remaining);
      }

      if (remaining <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [onTimeUpdate, round]);

  /**
   * Canvas rendering system
   * Draws all emojis with visual effects for highlighting and dimming
   * Uses requestAnimationFrame for smooth rendering
   */
  useEffect(() => {
    if (!canvasRef.current || !round) return;

    // Validate round data
    if (
      !round.emojiPositions ||
      round.emojiPositions.length === 0 ||
      !round.targetEmoji
    ) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Clear for transparency
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (
        round.emojiPositions &&
        round.emojiPositions.length > 0 &&
        round.targetEmoji
      ) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        
        // Render each emoji with effects
        round.emojiPositions.forEach((emoji) => {
          // Determine visual state
          const isTargetEmoji = emoji.emoji === round.targetEmoji;
          const shouldHighlight =
            (highlightTargetEmoji && isTargetEmoji) ||
            (foundEmojiId && emoji.id === foundEmojiId);
          const shouldDim =
            (highlightTargetEmoji || foundEmojiId) && !shouldHighlight;

          ctx.save();

          // Dim non-target emojis
          if (shouldDim) {
            ctx.globalAlpha = 0.2;
          }

          // Draw emoji with cross-platform font stack
          ctx.font = `${emoji.fontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", "EmojiSymbols", "EmojiOne Mozilla", "Twemoji Mozilla", "Segoe UI Symbol", Arial`;
          ctx.fillStyle = '#000';
          ctx.fillText(emoji.emoji, emoji.x, emoji.y);

          // Highlight effect for found/target emoji
          if (shouldHighlight) {
            const centerX = emoji.x + emoji.fontSize / 2;
            const centerY = emoji.y - emoji.fontSize * 0.3;
            const radius = emoji.fontSize * 0.8;

            // Green glowing circle
            ctx.strokeStyle = '#4ADE80';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#4ADE80';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.restore();
        });
      }
    };

    render();
    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [round, highlightTargetEmoji, foundEmojiId]);

  // Center scroll on mobile when round starts
  useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    
    if (isMobile && round && containerRef.current && !hasScrolledToCenter.current) {
      // Wait a bit for the canvas to fully render
      const timer = setTimeout(() => {
        if (containerRef.current) {
          const scrollWidth = containerRef.current.scrollWidth;
          const clientWidth = containerRef.current.clientWidth;
          if (scrollWidth > clientWidth) {
            const centerPosition = (scrollWidth - clientWidth) / 2;
            containerRef.current.scrollLeft = centerPosition;
            hasScrolledToCenter.current = true;
          }
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
    
    // Reset the flag when round changes
    if (!round) {
      hasScrolledToCenter.current = false;
    }
  }, [round]);

  if (!round) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-2xl text-gray-400">Waiting for round to start...</p>
      </div>
    );
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full bg-gray-900 ${isMobile ? 'overflow-x-auto overflow-y-hidden flex items-center' : 'flex items-center justify-center'}`}
      style={{ opacity }}
    >
      <div className={isMobile ? 'flex items-center h-full' : ''}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={handleCanvasClick}
          onTouchStart={handleCanvasTouchStart}
          onTouchEnd={handleCanvasTouchEnd}
          className="cursor-pointer no-select"
          style={{
            width: CANVAS_WIDTH * scale,
            height: CANVAS_HEIGHT * scale,
            maxHeight: isMobile ? '100%' : 'none',
            imageRendering: 'crisp-edges',
            cursor: disabled ? 'not-allowed' : 'pointer',
            touchAction: isMobile ? 'pan-x' : 'none', // Allow horizontal scrolling on mobile
          }}
        />
      </div>
    </div>
  );
}
