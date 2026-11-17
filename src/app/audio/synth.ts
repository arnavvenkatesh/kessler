/**
 * Pure WebAudio synthesizer for Kessler.
 * Zero external audio files or dependencies.
 *
 * Spec:
 * - Each detonation plays a note from an A-minor pentatonic scale.
 * - Index = min(depth, 14).
 * - Square plus triangle blend with a short noise burst.
 * - Chains climb in pitch, so a long cascade sounds like a rising run.
 * - Audio starts on first user gesture, mute state persists.
 */

// A-minor pentatonic frequencies across 3 octaves (15 notes, indices 0..14)
// Notes: A3, C4, D4, E4, G4, A4, C5, D5, E5, G5, A5, C6, D6, E6, G6
export const A_MINOR_PENTATONIC: readonly number[] = [
  220.0,   // A3 (idx 0)
  261.63,  // C4 (idx 1)
  293.66,  // D4 (idx 2)
  329.63,  // E4 (idx 3)
  392.0,   // G4 (idx 4)
  440.0,   // A4 (idx 5)
  523.25,  // C5 (idx 6)
  587.33,  // D5 (idx 7)
  659.25,  // E5 (idx 8)
  783.99,  // G5 (idx 9)
  880.0,   // A5 (idx 10)
  1046.5,  // C6 (idx 11)
  1174.66, // D6 (idx 12)
  1318.51, // E6 (idx 13)
  1567.98, // G6 (idx 14)
];

const STORAGE_MUTE_KEY = 'kessler:muted';

export class SoundSystem {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private isMuted: boolean = false;

  constructor() {
    try {
      this.isMuted = localStorage.getItem(STORAGE_MUTE_KEY) === 'true';
    } catch {
      this.isMuted = false;
    }
  }

  public get muted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem(STORAGE_MUTE_KEY, String(this.isMuted));
    } catch {
      // Storage unavailable fallback
    }
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    try {
      localStorage.setItem(STORAGE_MUTE_KEY, String(this.isMuted));
    } catch {
      // Storage unavailable fallback
    }
  }

  /**
   * Initializes or resumes AudioContext on user interaction.
   */
  public initOnGesture(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.createNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private createNoiseBuffer(): void {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * 0.05); // 50ms of noise
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    // Deterministic pseudo-white noise
    let seed = 0x12345678;
    for (let i = 0; i < length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = (seed / 4294967295) * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  /**
   * Detonation sound: square + triangle blend with short noise burst.
   * Pitch is determined by depth in A-minor pentatonic scale.
   */
  public playDetonate(depth: number): void {
    if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;

    const idx = Math.max(0, Math.min(depth, 14));
    const freq = A_MINOR_PENTATONIC[idx] ?? 440.0;
    const now = this.ctx.currentTime;

    // 1. Square wave (crisp harmonic grit)
    const oscSquare = this.ctx.createOscillator();
    oscSquare.type = 'square';
    oscSquare.frequency.setValueAtTime(freq, now);

    const gainSquare = this.ctx.createGain();
    gainSquare.gain.setValueAtTime(0.08, now);
    gainSquare.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    oscSquare.connect(gainSquare);
    gainSquare.connect(this.ctx.destination);
    oscSquare.start(now);
    oscSquare.stop(now + 0.18);

    // 2. Triangle wave (warm acoustic fundamental body)
    const oscTri = this.ctx.createOscillator();
    oscTri.type = 'triangle';
    oscTri.frequency.setValueAtTime(freq, now);

    const gainTri = this.ctx.createGain();
    gainTri.gain.setValueAtTime(0.2, now);
    gainTri.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    oscTri.connect(gainTri);
    gainTri.connect(this.ctx.destination);
    oscTri.start(now);
    oscTri.stop(now + 0.22);

    // 3. Short noise burst (impact transient)
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      // Bandpass filter to sit nicely behind the tone
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq * 1.5, now);
      filter.Q.setValueAtTime(2.0, now);

      const gainNoise = this.ctx.createGain();
      gainNoise.gain.setValueAtTime(0.12, now);
      gainNoise.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      noise.connect(filter);
      filter.connect(gainNoise);
      gainNoise.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.04);
    }
  }

  /**
   * Subtle placement / click sound when setting the initial spark.
   */
  public playSparkSet(): void {
    if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.06);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Solid mechanical deflection/shield hit thump.
   */
  public playHit(): void {
    if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Singularity absorb sound: falling sub-frequency sweep.
   */
  public playAbsorb(): void {
    if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }
}

export const sound = new SoundSystem();
