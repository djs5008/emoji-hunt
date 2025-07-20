'use client';

import { useEffect } from 'react';
import { audioManager, SoundType } from '@/app/lib/audio-manager';

/**
 * Countdown Component - Pre-round countdown display with traffic light
 * 
 * @description Shows a fullscreen countdown before each round starts.
 * Displays traffic light style circles (red, yellow, green) with numbers.
 * Plays countdown beeps and go sound.
 */
interface CountdownProps {
  count: number;  // Current countdown value (3, 2, 1, 0)
}

export default function Countdown({ count }: CountdownProps) {
  // Play countdown sounds
  useEffect(() => {
    if (count > 0) {
      audioManager.play(SoundType.COUNTDOWN);
    } else if (count === 0) {
      audioManager.play(SoundType.GO);
    }
  }, [count]);

  const getTrafficLightState = () => {
    switch (count) {
      case 3:
        return { red: true, yellow: false, green: false };
      case 2:
        return { red: false, yellow: true, green: false };
      case 1:
        return { red: false, yellow: false, green: true };
      default:
        return { red: false, yellow: false, green: true };
    }
  };

  const lights = getTrafficLightState();

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50">
      <div className="flex flex-col items-center">
        {/* Traffic Light Container - Horizontal */}
        <div className="bg-gray-900 rounded-full px-3 py-2 shadow-xl mb-6">
          <div className="flex flex-row space-x-2">
            {/* Red Light */}
            <div 
              className={`
                w-8 h-8 rounded-full transition-all duration-300
                ${lights.red 
                  ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' 
                  : 'bg-gray-800'
                }
              `}
            />
            
            {/* Yellow Light */}
            <div 
              className={`
                w-8 h-8 rounded-full transition-all duration-300
                ${lights.yellow 
                  ? 'bg-yellow-400 shadow-[0_0_20px_rgba(251,191,36,0.5)]' 
                  : 'bg-gray-800'
                }
              `}
            />
            
            {/* Green Light */}
            <div 
              className={`
                w-8 h-8 rounded-full transition-all duration-300
                ${lights.green 
                  ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]' 
                  : 'bg-gray-800'
                }
              `}
            />
          </div>
        </div>

        {/* Countdown Number or GO */}
        <div className="text-white">
          {count > 0 ? (
            <div className="text-9xl font-bold animate-pulse">{count}</div>
          ) : (
            <div className="text-6xl font-bold animate-pulse text-green-400">GO!</div>
          )}
        </div>
      </div>
    </div>
  );
}