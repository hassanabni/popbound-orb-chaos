import type { AudioBus, Settings, SoundId } from './types';
import { DEFAULT_SETTINGS } from './constants';

type AudioContextConstructor = typeof AudioContext;

/**
 * Original, fully procedural audio. No samples, no external assets.
 *
 * The graph is intentionally small:
 *   voices -> sfx/music bus -> master gain -> compressor -> destination
 * A compressor keeps a cascade of pop sounds from clipping. Every public
 * method swallows errors: audio must never be able to crash gameplay.
 */
export class AudioEngine implements AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private musicStarted = false;
  private noiseBuffer: AudioBuffer | null = null;
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private paused = false;
  private musicIntensity = 0.7;
  private unlocked = false;
  private lastSplitAt = 0;
  private disposed = false;

  constructor(settings: Settings) {
    this.settings = { ...settings };
  }

  setSettings(settings: Settings): void {
    this.settings = { ...settings };
    this.applyVolumes();
  }

  unlock(): void {
    if (this.disposed) return;
    try {
      if (!this.ctx) {
        const win = window as Window & { webkitAudioContext?: AudioContextConstructor };
        const Ctor = window.AudioContext ?? win.webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor({ latencyHint: 'interactive' });
        this.ctx = ctx;

        const master = ctx.createGain();
        master.gain.value = 0.8;
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 20;
        compressor.ratio.value = 8;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.22;
        const sfx = ctx.createGain();
        sfx.gain.value = 0.75;
        const music = ctx.createGain();
        music.gain.value = 0.1;

        sfx.connect(master);
        music.connect(master);
        master.connect(compressor);
        compressor.connect(ctx.destination);

        this.master = master;
        this.sfxBus = sfx;
        this.musicBus = music;
        this.compressor = compressor;
        this.noiseBuffer = this.createNoiseBuffer(ctx);
        this.startMusic();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => undefined);
      }
      this.unlocked = true;
      this.settings = { ...this.settings };
      this.applyVolumes();
    } catch {
      // Audio is a progressive enhancement; gameplay continues silently.
    }
  }

  play(sound: SoundId, variant = 0): void {
    if (!this.settings.soundOn || !this.ctx || !this.sfxBus || this.paused) return;
    try {
      const now = this.ctx.currentTime;
      switch (sound) {
        case 'click':
          this.tone(620, 0.055, 'square', 0.045, { slideTo: 780, attack: 0.004 });
          break;
        case 'hover':
          this.tone(880, 0.035, 'sine', 0.022, { slideTo: 1040 });
          break;
        case 'fire-pulse':
          this.tone(920, 0.13, 'sawtooth', 0.06, {
            slideTo: 280,
            attack: 0.002,
            release: 0.09,
          });
          this.noise(0.06, 0.035, 2400, 'highpass');
          break;
        case 'fire-web':
          this.tone(260, 0.22, 'triangle', 0.065, { slideTo: 170, release: 0.15 });
          this.tone(1180, 0.13, 'sine', 0.03, { slideTo: 890, delay: 0.02 });
          this.noise(0.11, 0.03, 1400, 'bandpass');
          break;
        case 'fire-prism':
          this.tone(1540, 0.12, 'square', 0.035, { slideTo: 690, release: 0.08 });
          this.tone(2260, 0.09, 'sine', 0.03, { slideTo: 1420, delay: 0.015 });
          break;
        case 'fire-mine':
          this.tone(190, 0.14, 'sine', 0.07, { slideTo: 74, release: 0.1 });
          this.noise(0.04, 0.025, 900, 'lowpass');
          break;
        case 'split': {
          // Rate-limit only the very dense simultaneous pops; the compressor
          // handles the rest, so cascades still feel crunchy.
          if (now - this.lastSplitAt < 0.018) return;
          this.lastSplitAt = now;
          const base = [232, 330, 460, 620][Math.max(0, Math.min(3, variant))];
          const detune = 1 + (variant % 3) * 0.015;
          this.tone(base * detune, 0.185, 'sine', 0.075, {
            slideTo: base * 1.75,
            attack: 0.003,
            release: 0.14,
          });
          this.tone(base * 0.5, 0.13, 'triangle', 0.03, { slideTo: base * 0.9 });
          this.noise(0.08, 0.035 + variant * 0.004, 1800 + variant * 600, 'highpass');
          break;
        }
        case 'pop-small':
          this.tone(980, 0.1, 'sine', 0.06, { slideTo: 1720, release: 0.08 });
          this.noise(0.06, 0.04, 3000, 'highpass');
          break;
        case 'pickup': {
          const notes = [523.25, 659.25, 783.99, 880, 1046.5, 1318.5];
          const n = notes[Math.abs(variant) % notes.length];
          this.tone(n, 0.11, 'triangle', 0.055, { attack: 0.004 });
          this.tone(n * 1.5, 0.15, 'sine', 0.03, { delay: 0.055 });
          break;
        }
        case 'pickup-life':
          [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
            this.tone(f, 0.18, 'triangle', 0.055, { delay: i * 0.065 }),
          );
          break;
        case 'hurt':
          this.tone(210, 0.3, 'sawtooth', 0.09, { slideTo: 62, release: 0.22 });
          this.noise(0.2, 0.065, 700, 'lowpass');
          break;
        case 'shield':
          this.tone(320, 0.28, 'sine', 0.05, { slideTo: 980, release: 0.2 });
          this.tone(640, 0.24, 'triangle', 0.03, { slideTo: 1600, delay: 0.02 });
          break;
        case 'countdown':
          this.tone(1180, 0.07, 'square', 0.025, { slideTo: 1180 });
          break;
        case 'level-complete':
          [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
            this.tone(f, 0.28, 'triangle', 0.055, { delay: i * 0.1, release: 0.2 }),
          );
          this.tone(196, 0.7, 'sine', 0.035, { release: 0.6 });
          break;
        case 'wave-complete':
          [440, 554.37, 659.25, 880].forEach((f, i) =>
            this.tone(f, 0.22, 'triangle', 0.05, { delay: i * 0.085 }),
          );
          break;
        case 'game-over':
          [392, 349.23, 293.66, 220].forEach((f, i) =>
            this.tone(f, 0.45, 'sine', 0.06, { delay: i * 0.16, release: 0.35 }),
          );
          break;
        case 'freeze':
          [1568, 1318.5, 1046.5, 783.99].forEach((f, i) =>
            this.tone(f, 0.25, 'sine', 0.035, { delay: i * 0.045, release: 0.2 }),
          );
          this.noise(0.35, 0.025, 4200, 'highpass');
          break;
        case 'time':
          this.tone(1046.5, 0.12, 'sine', 0.04);
          this.tone(1318.5, 0.24, 'sine', 0.035, { delay: 0.09 });
          break;
        case 'unlock':
          this.tone(392, 0.12, 'triangle', 0.045);
          this.tone(587.33, 0.2, 'triangle', 0.045, { delay: 0.08 });
          break;
        default:
          break;
      }
    } catch {
      // Keep simulating even if a node fails to schedule.
    }
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.applyVolumes();
  }

  setMusicIntensity(intensity: number): void {
    const clamped = Math.max(0, Math.min(1, intensity));
    if (Math.abs(clamped - this.musicIntensity) < 0.01) return;
    this.musicIntensity = clamped;
    this.applyVolumes();
  }

  dispose(): void {
    this.disposed = true;
    try {
      if (this.ctx) void this.ctx.close();
    } catch {
      // no-op
    }
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
  }

  /* ---------------------------------------------------------------- */

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.sfxBus || !this.musicBus) return;
    try {
      const now = this.ctx.currentTime;
      const audible = this.settings.soundOn ? 1 : 0;
      const master = this.settings.masterVolume * audible;
      const targetMusic =
        this.settings.musicVolume * audible * this.musicIntensity * (this.paused ? 0.25 : 1);
      const set = (param: AudioParam, value: number) => {
        param.setTargetAtTime(Math.max(0, value), now, 0.08);
      };
      set(this.master.gain, master);
      set(this.sfxBus.gain, this.settings.sfxVolume);
      set(this.musicBus.gain, targetMusic * 0.32);
    } catch {
      // no-op
    }
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.max(1, Math.floor(ctx.sampleRate * 0.4));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Deterministic pseudo-noise, so the character of the sound is stable.
    let seed = 1337;
    for (let i = 0; i < length; i += 1) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }
    return buffer;
  }

  private startMusic(): void {
    if (!this.ctx || !this.musicBus || this.musicStarted) return;
    const ctx = this.ctx;
    try {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      filter.Q.value = 0.8;

      const pad = ctx.createGain();
      pad.gain.value = 0.11;

      const frequencies = [110, 164.81, 220, 261.63, 329.63];
      frequencies.forEach((frequency, i) => {
        const osc = ctx.createOscillator();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.value = frequency;
        osc.detune.value = (i - 2) * 4;
        const voice = ctx.createGain();
        voice.gain.value = i === 4 ? 0.16 : 0.34 / (i + 1);
        osc.connect(voice);
        voice.connect(filter);
        osc.start();
      });

      filter.connect(pad);
      pad.connect(this.musicBus);

      // Slow filter drift keeps the pad alive without scheduling overhead.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.045;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 135;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      this.musicStarted = true;
    } catch {
      // Ambient music is optional.
    }
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    opts: {
      slideTo?: number;
      delay?: number;
      attack?: number;
      release?: number;
    } = {},
  ): void {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const start = ctx.currentTime + (opts.delay ?? 0);
    const attack = Math.max(0.002, opts.attack ?? 0.006);
    const release = Math.max(0.02, opts.release ?? 0.06);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, frequency), start);
    if (opts.slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + attack);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + Math.max(attack + 0.01, duration + release),
    );
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(start);
    osc.stop(start + duration + release + 0.05);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // no-op
      }
    };
  }

  private noise(
    duration: number,
    volume: number,
    cutoff: number,
    type: BiquadFilterType,
  ): void {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    try {
      const ctx = this.ctx;
      const source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = cutoff;
      filter.Q.value = type === 'bandpass' ? 1.4 : 0.7;
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxBus);
      source.start(now);
      source.stop(now + duration + 0.02);
      source.onended = () => {
        try {
          source.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch {
          // no-op
        }
      };
    } catch {
      // no-op
    }
  }
}
