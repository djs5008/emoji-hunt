import * as Tone from 'tone';

export enum SoundType {
  SUCCESS = 'success',
  ERROR = 'error',
  COUNTDOWN = 'countdown',
  GAME_OVER = 'gameOver',
  TICK = 'tick',
  GO = 'go',
  CLICK = 'click',
  TIME_UP = 'timeUp'
}

class AudioManager {
  private enabled: boolean = true;
  private initialized: boolean = false;
  private tickLoop: Tone.Loop | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadFromStorage();
    }
  }

  private loadFromStorage() {
    const stored = localStorage.getItem('audioEnabled');
    if (stored !== null) {
      this.enabled = stored === 'true';
    }
  }

  private saveToStorage() {
    localStorage.setItem('audioEnabled', String(this.enabled));
  }

  async initialize() {
    if (this.initialized || typeof window === 'undefined') return;
    
    try {
      await Tone.start();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async play(soundType: SoundType) {
    if (!this.enabled) return;
    
    await this.ensureInitialized();

    switch (soundType) {
      case SoundType.SUCCESS:
        this.playSuccess();
        break;
      case SoundType.ERROR:
        this.playError();
        break;
      case SoundType.COUNTDOWN:
        this.playCountdown();
        break;
      case SoundType.GO:
        this.playGo();
        break;
      case SoundType.TICK:
        this.startTicking();
        break;
      case SoundType.GAME_OVER:
        this.playGameOver();
        break;
      case SoundType.CLICK:
        this.playClick();
        break;
      case SoundType.TIME_UP:
        this.playTimeUp();
        break;
    }
  }

  private playSuccess() {
    // Playful ascending arpeggio with a bubbly sound
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0.3,
        release: 0.8
      }
    }).toDestination();

    // Add a filter for warmth
    const filter = new Tone.Filter(2000, 'lowpass').toDestination();
    synth.connect(filter);

    const now = Tone.now();
    synth.triggerAttackRelease('C5', '16n', now);
    synth.triggerAttackRelease('E5', '16n', now + 0.05);
    synth.triggerAttackRelease('G5', '16n', now + 0.1);
    synth.triggerAttackRelease('C6', '8n', now + 0.15);
    synth.volume.value = -20;
  }

  private playError() {
    // Soft, playful "boop" sound
    const synth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.01,
        decay: 0.15,
        sustain: 0,
        release: 0.1
      }
    }).toDestination();

    // Add some warmth with a filter
    const filter = new Tone.Filter(800, 'lowpass').toDestination();
    synth.connect(filter);

    synth.volume.value = -20;
    const now = Tone.now();
    synth.triggerAttackRelease('G3', '16n', now);
    synth.triggerAttackRelease('E3', '16n', now + 0.08);
  }

  private playCountdown() {
    // Soft, rounded beep
    const synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.02,
        decay: 0.08,
        sustain: 0.4,
        release: 0.15
      }
    }).toDestination();

    synth.volume.value = -26;  // Reduced by half (6dB reduction)
    synth.triggerAttackRelease('A4', '16n');
  }

  private playGo() {
    // Subtle "go" sound - similar to countdown but slightly longer
    const synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.02,
        decay: 0.1,
        sustain: 0.4,
        release: 0.2
      }
    }).toDestination();

    synth.volume.value = -26;  // Reduced by half (6dB reduction)
    synth.triggerAttackRelease('C5', '8n');
  }

  private startTicking() {
    if (this.tickLoop) return;

    // Soft, subtle tick
    const synth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.05,
        sustain: 0,
        release: 0.05
      }
    }).toDestination();

    synth.volume.value = -20;

    this.tickLoop = new Tone.Loop((time) => {
      synth.triggerAttackRelease('G5', '64n', time);
    }, '4n').start(0);

    Tone.Transport.start();
  }

  private playGameOver() {
    // Rewarding, pleasant melody - ascending progression
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.05,
        decay: 0.2,
        sustain: 0.3,
        release: 0.8
      }
    }).toDestination();

    const filter = new Tone.Filter(2000, 'lowpass').toDestination();
    synth.connect(filter);
    synth.volume.value = -20;

    const now = Tone.now();
    // Pleasant ascending progression: C major - F major - G major - C major (higher)
    synth.triggerAttackRelease('C4', '16n', now);
    synth.triggerAttackRelease('E4', '16n', now + 0.1);
    synth.triggerAttackRelease('G4', '16n', now + 0.2);
    synth.triggerAttackRelease(['C5', 'E5', 'G5'], '8n', now + 0.3);
  }

  private playClick() {
    // Very subtle, soft click
    const synth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.02,
        sustain: 0,
        release: 0.02
      }
    }).toDestination();

    synth.volume.value = -24;
    synth.triggerAttackRelease('C6', '64n');
  }

  private playTimeUp() {
    // Dejected trumpet/tuba sound - descending with mid/high notes
    const synth = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: {
        attack: 0.03,
        decay: 0.1,
        sustain: 0.4,
        release: 0.3
      }
    }).toDestination();

    // Add a filter for brass-like quality
    const filter = new Tone.Filter({
      frequency: 1200,
      type: 'lowpass',
      rolloff: -12
    }).toDestination();
    
    synth.connect(filter);
    synth.volume.value = -26;

    const now = Tone.now();
    // "WAH-wah" - just two notes, same duration
    synth.triggerAttackRelease('F3', '16n', now);
    synth.triggerAttackRelease('C3', '16n', now + 0.1);
  }

  stop(soundType: SoundType) {
    if (soundType === SoundType.TICK && this.tickLoop) {
      this.tickLoop.stop();
      this.tickLoop.dispose();
      this.tickLoop = null;
      Tone.Transport.stop();
    }
  }

  stopAll() {
    this.stop(SoundType.TICK);
    Tone.Transport.cancel();
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.saveToStorage();
    if (!enabled) {
      this.stopAll();
    }
  }

  isEnabled() {
    return this.enabled;
  }

  toggleEnabled() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }
}

export const audioManager = new AudioManager();