'use client';

/**
 * Countdown Component - Pre-round countdown display
 * 
 * @description Shows a fullscreen countdown before each round starts.
 * Displays numbers 3, 2, 1, then "GO!" with pulsing animation.
 * Provides visual preparation time for players.
 */
interface CountdownProps {
  count: number;  // Current countdown value (3, 2, 1, 0)
}

export default function Countdown({ count }: CountdownProps) {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <div className="text-white">
        {count > 0 ? (
          // Numeric countdown
          <div className="text-9xl font-bold animate-pulse">{count}</div>
        ) : (
          // Start signal
          <div className="text-6xl font-bold animate-pulse">GO!</div>
        )}
      </div>
    </div>
  );
}