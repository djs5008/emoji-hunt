'use client';

import { useEffect, useRef } from 'react';

/**
 * EmojiBackground Component - Animated decorative background
 * 
 * @description Creates a falling emoji particle effect for visual ambiance.
 * Emojis fall from top to bottom with slight horizontal drift, creating a
 * playful atmosphere. Performance-optimized with Canvas API and GPU acceleration.
 * 
 * Features:
 * - 100+ different emoji types
 * - Responsive particle density based on screen size
 * - Smooth 60fps animation with delta time
 * - Gradual fade-out at bottom
 * - GPU acceleration for performance
 */

// Diverse collection of emojis for variety
const BACKGROUND_EMOJIS = [
  '😀', '😎', '🤩', '🥳', '😍', '🤔', '😴', '🤯', '🥺', '😈',
  '👻', '👽', '🤖', '💩', '🐶', '🐱', '🐭', '🐹', '🐰', '🦊',
  '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
  '🐧', '🐦', '🦆', '🦉', '🦋', '🐌', '🐞', '🐢', '🐙', '🦑',
  '🦀', '🐡', '🐠', '🐬', '🦈', '🦖', '🌵', '🌲', '🌳', '🌴',
  '🌱', '🌿', '🍄', '🌷', '🌹', '🌺', '🌸', '🌼', '🌻', '🌞',
  '🌝', '🌛', '🌜', '⭐', '🌟', '✨', '⚡', '🔥', '🌈', '☀️',
  '☁️', '❄️', '⛄', '💧', '🌊', '🍏', '🍎', '🍐', '🍊', '🍋',
  '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🍍', '🥥', '🥝', '🍅',
  '🍆', '🥑', '🌶️', '🌽', '🥕', '🍔', '🍟', '🍕', '🌭', '🥪',
  '🌮', '🌯', '🍜', '🍝', '🍛', '🍣', '🍱', '🍦', '🍨', '🍰',
  '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '☕', '🍵',
  '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🎱', '🎯', '🎮', '🎰',
  '🎲', '🎸', '🎺', '🎷', '🥁', '🎹', '🎨', '🎭', '🎪', '🎬'
];

// Particle properties for physics simulation
interface EmojiParticle {
  id: number;      // Unique identifier
  emoji: string;   // The emoji character
  x: number;       // Horizontal position
  y: number;       // Vertical position
  vx: number;      // Horizontal velocity
  vy: number;      // Vertical velocity (fall speed)
  size: number;    // Font size in pixels
  opacity: number; // Transparency (0-1)
}

export default function EmojiBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<EmojiParticle[]>([]);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const nextIdRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize particles
    const initParticles = () => {
      const particleCount = Math.floor((canvas.width * canvas.height) / 50000); // Much less dense
      particlesRef.current = [];
      
      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push(createParticle(canvas.width, canvas.height, true));
      }
    };

    const createParticle = (canvasWidth: number, canvasHeight: number, randomY = false): EmojiParticle => {
      const size = 25 + Math.random() * 20; // Slightly more consistent size
      return {
        id: nextIdRef.current++,
        emoji: BACKGROUND_EMOJIS[Math.floor(Math.random() * BACKGROUND_EMOJIS.length)],
        x: Math.random() * canvasWidth,
        y: randomY ? Math.random() * canvasHeight : -size,
        vx: (Math.random() - 0.5) * 0.3, // Less horizontal movement
        vy: 0.8 + Math.random() * 0.8, // Slightly faster, more consistent fall
        size,
        opacity: 0.2 + Math.random() * 0.2, // More visible, less variation
      };
    };

    /**
     * Main animation loop using requestAnimationFrame
     * Implements delta-time based movement for consistent speed regardless of framerate
     */
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTimeRef.current;
      
      // Cap delta to prevent huge jumps when tab is backgrounded
      const cappedDeltaTime = Math.min(deltaTime, 50);
      
      // Skip frames to maintain 60fps target
      if (cappedDeltaTime < 16) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      
      lastTimeRef.current = currentTime;
      const deltaSeconds = cappedDeltaTime / 1000;

      // Clear for next frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Set text rendering properties once per frame
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Update and render each particle
      particlesRef.current = particlesRef.current.filter(particle => {
        // Physics update (60 multiplier normalizes to pixels/second)
        particle.x += particle.vx * deltaSeconds * 60;
        particle.y += particle.vy * deltaSeconds * 60;

        // Fade out near bottom for smooth disappearance
        if (particle.y > canvas.height - 150) {
          particle.opacity = Math.max(0.1, (canvas.height - particle.y) / 150 * 0.3);
        }

        // Render emoji
        ctx.globalAlpha = particle.opacity;
        ctx.font = `${particle.size}px sans-serif`;
        ctx.fillText(particle.emoji, particle.x, particle.y);

        // Keep particle if still visible
        return particle.y < canvas.height + particle.size;
      });

      // Maintain particle density
      const targetParticleCount = Math.floor((canvas.width * canvas.height) / 50000);
      const currentParticleCount = particlesRef.current.length;
      
      // Spawn new particles occasionally
      if (currentParticleCount < targetParticleCount && Math.random() < 0.03) {
        particlesRef.current.push(createParticle(canvas.width, canvas.height));
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    initParticles();
    animate(0);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ 
        zIndex: 0,
        willChange: 'transform',
        transform: 'translateZ(0)' // Force GPU acceleration
      }}
    />
  );
}