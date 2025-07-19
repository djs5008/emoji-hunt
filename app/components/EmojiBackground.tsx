'use client';

import { useEffect, useRef } from 'react';

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

interface EmojiParticle {
  id: number;
  emoji: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
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

    // Animation loop
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTimeRef.current;
      
      // Cap delta time to prevent large jumps (e.g., when tab is backgrounded)
      const cappedDeltaTime = Math.min(deltaTime, 50);
      
      // Only update if enough time has passed (targeting ~60fps)
      if (cappedDeltaTime < 16) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      
      lastTimeRef.current = currentTime;
      
      // Convert to seconds for easier calculation
      const deltaSeconds = cappedDeltaTime / 1000;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Set text properties once for better performance
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter(particle => {
        // Update position based on time elapsed
        particle.x += particle.vx * deltaSeconds * 60;
        particle.y += particle.vy * deltaSeconds * 60;

        // Simple fade at bottom
        if (particle.y > canvas.height - 150) {
          particle.opacity = Math.max(0.1, (canvas.height - particle.y) / 150 * 0.3);
        }

        // Draw particle (no rotation)
        ctx.globalAlpha = particle.opacity;
        ctx.font = `${particle.size}px sans-serif`;
        ctx.fillText(particle.emoji, particle.x, particle.y);

        // Remove if out of bounds
        return particle.y < canvas.height + particle.size;
      });

      // Add new particles occasionally to maintain some density
      const targetParticleCount = Math.floor((canvas.width * canvas.height) / 50000);
      const currentParticleCount = particlesRef.current.length;
      
      // Add particles more gradually
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