import { useCallback } from 'react';
import { audioManager, SoundType } from '@/app/lib/audio-manager';

/**
 * Hook that plays a click sound and executes a callback
 * Use this for all button interactions to provide consistent audio feedback
 */
export function useButtonClick<T extends (...args: any[]) => any>(
  callback?: T
): T {
  return useCallback((...args: Parameters<T>) => {
    // Play click sound
    audioManager.play(SoundType.CLICK);
    
    // Execute the original callback if provided
    if (callback) {
      return callback(...args);
    }
  }, [callback]) as T;
}