'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Round } from '@/app/types/game';

interface GameCanvasProps {
  round: Round | null;
  lobbyId: string;
  playerId: string;
  onEmojiClick: (
    emojiId: string,
    x: number,
    y: number,
    pageX: number,
    pageY: number
  ) => void;
  disabled?: boolean;
  onTimeUpdate?: (time: number) => void;
  highlightTargetEmoji?: boolean;
  foundEmojiId?: string | null;
  opacity?: number;
}

const CANVAS_WIDTH = 2400; // Increased width for more columns
const CANVAS_HEIGHT = 1200; // Increased height for more rows

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

  // Prevent right-click context menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Prevent keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
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

  // Calculate canvas scale
  useEffect(() => {
    const updateScale = () => {
      if (!canvasRef.current) return;

      const container = canvasRef.current.parentElement?.parentElement; // Get the outer container
      if (!container) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Check if mobile device (viewport width < 768px)
      const isMobile = window.innerWidth < 768;

      if (isMobile) {
        // On mobile, use container height directly for better space usage
        // The container already accounts for header/footer positioning
        const scaleY = containerHeight / CANVAS_HEIGHT;
        // Allow slightly larger scale on mobile to fill space better
        setScale(scaleY * 0.98); // 98% to leave tiny margin for safety
      } else {
        // On desktop, use normal scaling
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

  // Handle canvas click/touch
  const handleCanvasInteraction = useCallback(
    (clientX: number, clientY: number, pageX: number, pageY: number) => {
      if (disabled || !round || !canvasRef.current) {
        return;
      }

      if (!round.emojiPositions || round.emojiPositions.length === 0) {
        return;
      }

      if (!round.targetEmoji) {
        return;
      }

      const rect = canvasRef.current.getBoundingClientRect();
      const x = (clientX - rect.left) / scale;
      const y = (clientY - rect.top) / scale;

      // Find clicked emoji using obfuscated positions (with tolerance)
      let foundEmoji = null;
      for (const emoji of round.emojiPositions) {
        // Use larger bounds due to obfuscation
        const tolerance = 20; // Extra tolerance for obfuscated positions
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

  // Render emojis
  useEffect(() => {
    if (!canvasRef.current || !round) return;

    // Don't render if we don't have valid emoji data
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
      // Clear canvas (this makes it transparent)
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Render emojis if we have valid positions
      if (
        round.emojiPositions &&
        round.emojiPositions.length > 0 &&
        round.targetEmoji
      ) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        round.emojiPositions.forEach((emoji) => {
          // Check if we should dim or highlight this emoji
          const isTargetEmoji = emoji.emoji === round.targetEmoji;
          const shouldHighlight =
            (highlightTargetEmoji && isTargetEmoji) ||
            (foundEmojiId && emoji.id === foundEmojiId);
          const shouldDim =
            (highlightTargetEmoji || foundEmojiId) && !shouldHighlight;

          // Save context state
          ctx.save();

          // Apply dimming effect
          if (shouldDim) {
            ctx.globalAlpha = 0.2;
          }

          // Draw emoji
          ctx.font = `${emoji.fontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", "EmojiSymbols", "EmojiOne Mozilla", "Twemoji Mozilla", "Segoe UI Symbol", Arial`;
          ctx.fillStyle = '#000';
          ctx.fillText(emoji.emoji, emoji.x, emoji.y);

          // Add highlight effect
          if (shouldHighlight) {
            // Draw a glowing circle around the target emoji
            const centerX = emoji.x + emoji.fontSize / 2;
            const centerY = emoji.y - emoji.fontSize * 0.3;
            const radius = emoji.fontSize * 0.8;

            ctx.strokeStyle = '#4ADE80';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#4ADE80';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Restore context state
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
