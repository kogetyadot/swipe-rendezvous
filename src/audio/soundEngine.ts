import { CharacterCategory } from '../types';

const STORAGE_KEY_BGM = 'sr_bgm';
const STORAGE_KEY_SE = 'sr_se';

function loadStoredBool(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw !== 'false' && raw !== '0';
  } catch {
    return fallback;
  }
}

function saveStoredBool(key: string, val: boolean): void {
  try {
    window.localStorage.setItem(key, val ? 'true' : 'false');
  } catch {
    // Ignore storage errors in restricted environments
  }
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class SoundEngine {
  private _bgmEnabled: boolean;
  private _seEnabled: boolean;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private seGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // BGM sequencer state
  private bgmPlaying = false;
  private bgmWanted = false;
  private bgmMode: 'normal' | 'hard' = 'normal';
  private rushMode = false;
  private schedulerTimer: number | null = null;
  private currentStep = 0;
  private nextStepTime = 0;

  constructor() {
    this._bgmEnabled = loadStoredBool(STORAGE_KEY_BGM, true);
    this._seEnabled = loadStoredBool(STORAGE_KEY_SE, true);
  }

  public get bgmEnabled(): boolean {
    return this._bgmEnabled;
  }

  public set bgmEnabled(val: boolean) {
    this.setBgmEnabled(val);
  }

  public get seEnabled(): boolean {
    return this._seEnabled;
  }

  public set seEnabled(val: boolean) {
    this.setSeEnabled(val);
  }

  public setBgmEnabled(val: boolean): void {
    this._bgmEnabled = Boolean(val);
    saveStoredBool(STORAGE_KEY_BGM, this._bgmEnabled);

    if (this.bgmGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.setTargetAtTime(this._bgmEnabled ? 0.28 : 0.0, now, 0.04);
    }

    if (this._bgmEnabled && this.bgmWanted && !this.bgmPlaying) {
      this.startBgm(this.bgmMode);
    } else if (!this._bgmEnabled && this.bgmPlaying) {
      this.stopSchedulerOnly();
    }
  }

  public setSeEnabled(val: boolean): void {
    this._seEnabled = Boolean(val);
    saveStoredBool(STORAGE_KEY_SE, this._seEnabled);

    if (this.seGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.seGain.gain.cancelScheduledValues(now);
      this.seGain.gain.setTargetAtTime(this._seEnabled ? 0.55 : 0.0, now, 0.02);
    }
  }

  public toggleBgm(): boolean {
    this.setBgmEnabled(!this._bgmEnabled);
    return this._bgmEnabled;
  }

  public toggleSe(): boolean {
    this.setSeEnabled(!this._seEnabled);
    return this._seEnabled;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx();

      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.15;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.9;

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = this._bgmEnabled ? 0.28 : 0.0;

      this.seGain = this.ctx.createGain();
      this.seGain.gain.value = this._seEnabled ? 0.55 : 0.0;

      this.bgmGain.connect(compressor);
      this.seGain.connect(compressor);
      compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Ignore resume errors prior to user gesture
      });
    }

    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 1.0;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  public unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  // ============================================================================
  // PROCEDURAL BGM: Shibuya City-Pop / Slapstick Funk Loop
  // ============================================================================
  public startBgm(mode: 'normal' | 'hard' = 'normal'): void {
    this.bgmMode = mode;
    this.bgmWanted = true;
    this.rushMode = false;

    if (!this._bgmEnabled) return;

    const ctx = this.ensureContext();
    if (!ctx || !this.bgmGain) return;

    this.stopSchedulerOnly();
    this.bgmPlaying = true;
    this.currentStep = 0;
    this.nextStepTime = ctx.currentTime + 0.04;

    const now = ctx.currentTime;
    this.bgmGain.gain.cancelScheduledValues(now);
    this.bgmGain.gain.setTargetAtTime(0.28, now, 0.05);

    this.schedulerTimer = window.setInterval(() => {
      this.scheduleBgmSteps();
    }, 35);
  }

  public setRushMode(isRush: boolean): void {
    this.rushMode = isRush;
  }

  public stopBgm(): void {
    this.bgmWanted = false;
    this.rushMode = false;
    this.stopSchedulerOnly();
  }

  private stopSchedulerOnly(): void {
    this.bgmPlaying = false;
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private getCurrentBpm(): number {
    const base = this.bgmMode === 'hard' ? 132 : 122;
    return this.rushMode ? base + 16 : base;
  }

  private scheduleBgmSteps(): void {
    if (!this.bgmPlaying || !this.ctx || !this.bgmGain || !this._bgmEnabled) return;

    const lookaheadSec = 0.12;
    const stepDuration = 60 / this.getCurrentBpm() / 4; // 16th note

    if (this.nextStepTime < this.ctx.currentTime - 0.06) {
      this.nextStepTime = this.ctx.currentTime;
    }

    while (this.nextStepTime < this.ctx.currentTime + lookaheadSec) {
      this.triggerBgmStep(this.currentStep, this.nextStepTime, stepDuration);
      this.nextStepTime += stepDuration;
      this.currentStep = (this.currentStep + 1) % 64;
    }
  }

  private triggerBgmStep(step: number, time: number, stepDur: number): void {
    if (!this.ctx || !this.bgmGain) return;

    const bar = Math.floor(step / 16); // 0..3: Fmaj7 | E7 | Am7 | Gm7 -> C7
    const stepInBar = step % 16;

    // 1. Drums
    // Kick on 0, 6, 8, 11 (funky city-pop groove)
    if (
      stepInBar === 0 ||
      stepInBar === 6 ||
      stepInBar === 8 ||
      (this.rushMode && stepInBar === 14)
    ) {
      this.scheduleBgmKick(time);
    }
    // Snare on 4 and 12, plus ghost snare on 15
    if (stepInBar === 4 || stepInBar === 12) {
      this.scheduleBgmSnare(time, 0.22);
    } else if (stepInBar === 15 && bar % 2 === 1) {
      this.scheduleBgmSnare(time, 0.09);
    }
    // Hi-hats on every even 16th, or every 16th in rush/hard mode
    if (stepInBar % 2 === 0 || this.rushMode || this.bgmMode === 'hard') {
      const open = stepInBar === 2 || stepInBar === 10;
      const vel = stepInBar % 2 === 0 ? 0.1 : 0.05;
      this.scheduleBgmHat(time, open ? 0.11 : 0.035, vel);
    }

    // 2. Funky Slap Synth Bass (MIDI notes per bar)
    const bassPatterns: (number | null)[][] = [
      // Bar 0: Fmaj7
      [41, null, 41, 53, null, 41, 48, null, 41, null, 53, null, 43, null, 45, null],
      // Bar 1: E7
      [40, null, 40, 52, null, 40, 47, null, 40, null, 52, null, 44, null, 47, null],
      // Bar 2: Am7
      [45, null, 45, 57, null, 45, 52, null, 45, null, 57, null, 48, null, 47, null],
      // Bar 3: Gm7 -> C7
      [43, null, 43, 55, null, 43, 50, null, 48, null, 60, null, 52, null, 55, null],
    ];
    const bassMidi = bassPatterns[bar][stepInBar];
    if (bassMidi !== null) {
      const transpose = this.rushMode ? 2 : 0;
      this.scheduleBgmBass(time, midiToFreq(bassMidi + transpose), stepDur * 1.4);
    }

    // 3. Electric Piano Chords (stabs on steps 0, 3, 6, 10, 12)
    const chordStabSteps = [0, 3, 6, 10, 12];
    if (chordStabSteps.includes(stepInBar)) {
      const chords: number[][][] = [
        [[65, 69, 72, 76]], // Fmaj7
        [[64, 68, 71, 74]], // E7
        [[64, 67, 69, 72]], // Am7
        [
          [62, 65, 69, 72], // Gm9
          [64, 67, 70, 74], // C9
        ],
      ];
      const barChords = chords[bar];
      const chord = bar === 3 && stepInBar >= 8 ? barChords[1] : barChords[0];
      const transpose = this.rushMode ? 2 : 0;
      const dur = stepInBar === 6 || stepInBar === 12 ? stepDur * 2.2 : stepDur * 1.1;
      this.scheduleBgmChord(
        time,
        chord.map((n) => midiToFreq(n + transpose)),
        dur
      );
    }

    // 4. City-Pop Bell/Synth Hook Melody
    const leadMelody: (number | null)[][] = [
      // Bar 0 (Fmaj7)
      [76, null, 77, null, 79, null, 76, 72, null, 69, null, 72, 76, null, null, null],
      // Bar 1 (E7)
      [76, null, 74, null, 71, null, 68, null, 71, null, 74, null, 76, null, 79, null],
      // Bar 2 (Am7)
      [81, null, 79, null, 76, null, 72, null, 74, 76, null, 72, null, 69, null, null],
      // Bar 3 (Gm7 -> C7)
      [74, null, 77, null, 76, null, 74, null, 72, null, 76, null, 79, null, 81, null],
    ];
    const leadMidi = leadMelody[bar][stepInBar];
    if (leadMidi !== null) {
      const transpose = this.rushMode ? 2 : 0;
      this.scheduleBgmLead(time, midiToFreq(leadMidi + transpose), stepDur * 1.7);
    }
  }

  private scheduleBgmKick(time: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.09);

    gain.gain.setValueAtTime(0.55, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);

    osc.connect(gain);
    gain.connect(this.bgmGain);
    osc.start(time);
    osc.stop(time + 0.14);
  }

  private scheduleBgmSnare(time: number, level: number): void {
    if (!this.ctx || !this.bgmGain || !this.noiseBuffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(950, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);
    noise.start(time);
    noise.stop(time + 0.12);

    // Snare body
    const osc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, time);
    osc.frequency.exponentialRampToValueAtTime(110, time + 0.06);
    bodyGain.gain.setValueAtTime(level * 0.7, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);

    osc.connect(bodyGain);
    bodyGain.connect(this.bgmGain);
    osc.start(time);
    osc.stop(time + 0.08);
  }

  private scheduleBgmHat(time: number, duration: number, level: number): void {
    if (!this.ctx || !this.bgmGain || !this.noiseBuffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6500, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);
    noise.start(time);
    noise.stop(time + duration + 0.01);
  }

  private scheduleBgmBass(time: number, freq: number, duration: number): void {
    if (!this.ctx || !this.bgmGain) return;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.Q.value = 3.5;
    filter.frequency.setValueAtTime(freq * 6.5, time);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.8, time + duration * 0.8);

    gain.gain.setValueAtTime(0.26, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);
    osc.start(time);
    osc.stop(time + duration + 0.01);
  }

  private scheduleBgmChord(time: number, freqs: number[], duration: number): void {
    if (!this.ctx || !this.bgmGain) return;

    for (const freq of freqs) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.06, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(this.bgmGain);
      osc.start(time);
      osc.stop(time + duration + 0.01);
    }
  }

  private scheduleBgmLead(time: number, freq: number, duration: number): void {
    if (!this.ctx || !this.bgmGain) return;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, time);

    gain.gain.setValueAtTime(0.085, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);
    osc.start(time);
    osc.stop(time + duration + 0.01);
  }

  // ============================================================================
  // SOUND EFFECTS (SE)
  // ============================================================================

  /**
   * Sparkly dating app match chime + crisp card whoosh
   */
  public playSwipeRight(): void {
    if (!this._seEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.seGain) return;

    const now = ctx.currentTime;

    // 1. Soft upward card whoosh
    this.playNoiseBurst(now, 0.09, 900, 3200, 0.16);

    // 2. Sparkly dating app chime (A5 -> C#6 -> E6 -> A6)
    const notes = [880, 1108.73, 1318.51, 1760];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.038;
      this.playTone(t, freq, 'triangle', 0.15, 0.2);
    });
  }

  /**
   * Snappy card pass flick
   */
  public playSwipeLeft(): void {
    if (!this._seEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.seGain) return;

    const now = ctx.currentTime;
    this.playNoiseBurst(now, 0.075, 1800, 420, 0.22);
    this.playSlideTone(now, 340, 155, 'sine', 0.08, 0.22);
  }

  /**
   * Soft distant pop on sidewalk appearance
   */
  public playMatchSpawn(): void {
    if (!this._seEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.seGain) return;

    const now = ctx.currentTime;
    this.playSlideTone(now, 420, 660, 'sine', 0.07, 0.14);
  }

  /**
   * Subtle neutral attention cue on 3D behavior reveal ("!" comic pop).
   * Intentionally keeps the cue neutral so it doesn't spoil the category with an obvious buzzer.
   */
  public playBehaviorReveal(_category: CharacterCategory): void {
    if (!this._seEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.seGain) return;

    const now = ctx.currentTime;
    // Light comic "!" double pop
    this.playSlideTone(now, 520, 780, 'triangle', 0.055, 0.18);
    this.playSlideTone(now + 0.055, 680, 1020, 'sine', 0.07, 0.16);
  }

  /**
   * Joyful major chord arpeggio that pitches up with combo count!
   */
  public playContactGood(combo: number): void {
    if (!this._seEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.seGain) return;

    const now = ctx.currentTime;
    const semitoneShift = Math.min(Math.max(combo - 1, 0), 10);
    const baseMidi = 65 + semitoneShift; // F4 upwards with combo
    const intervals = [0, 4, 7, 12, 16];

    intervals.forEach((interval, idx) => {
      const freq = midiToFreq(baseMidi + interval);
      const t = now + idx * 0.045;
      const dur = idx === intervals.length - 1 ? 0.28 : 0.14;
      this.playTone(t, freq, 'triangle', dur, 0.28);
      // Shimmer harmonic
      this.playTone(t, freq * 2, 'sine', dur * 0.8, 0.1);
    });
  }

  /**
   * Comical slapstick trombone/buzzer drop
   */
  public playContactBad(): void {
    if (!this._seEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.seGain) return;

    const now = ctx.currentTime;
    // Two-step comical trombone drop ("wah-waaah")
    this.playSlideTone(now, 310, 260, 'sawtooth', 0.14, 0.25, 950);
    this.playSlideTone(now + 0.15, 250, 130, 'sawtooth', 0.34, 0.28, 750);
  }

  /**
   * Warning siren blip + comical cash-register/paper scatter sound
   */
  public playContactScam(): void {
    if (!this._seEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.seGain) return;

    const now = ctx.currentTime;

    // 1. Urgent comic siren blip (two rapid alternating warbles)
    this.playSlideTone(now, 880, 440, 'sawtooth', 0.11, 0.26, 2200);
    this.playSlideTone(now + 0.11, 880, 360, 'sawtooth', 0.16, 0.26, 2200);

    // 2. Comical cash-register "ka-ching" + paper scatter flutter
    this.playTone(now + 0.22, 1864.66, 'square', 0.06, 0.18);
    this.playTone(now + 0.28, 2489.02, 'triangle', 0.18, 0.22);
    this.playNoiseBurst(now + 0.26, 0.16, 2400, 800, 0.2);
  }

  /**
   * Soft cushioned thump "おっと" when bumping an ambient pedestrian (0 pts)
   */
  public playPedestrianBump(): void {
    if (!this._seEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.seGain) return;

    const now = ctx.currentTime;
    this.playSlideTone(now, 175, 72, 'sine', 0.11, 0.32);
    this.playSlideTone(now + 0.05, 240, 195, 'triangle', 0.08, 0.16);
  }

  /**
   * Countdown tick (and high-pitched accent when final=true)
   */
  public playCountdownTick(final = false): void {
    if (!this._seEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.seGain) return;

    const now = ctx.currentTime;
    if (final) {
      this.playTone(now, 1046.5, 'triangle', 0.24, 0.32);
      this.playTone(now, 1567.98, 'sine', 0.24, 0.18);
    } else {
      this.playTone(now, 659.25, 'triangle', 0.08, 0.22);
    }
  }

  /**
   * Celebratory finish fanfare at the end of the 75-second round
   */
  public playFinishFanfare(): void {
    if (!this._seEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.seGain) return;

    const now = ctx.currentTime;
    const fanfareNotes = [
      { midi: 65, delay: 0.0, dur: 0.12 }, // F4
      { midi: 69, delay: 0.11, dur: 0.12 }, // A4
      { midi: 72, delay: 0.22, dur: 0.12 }, // C5
      { midi: 77, delay: 0.34, dur: 0.45 }, // F5
    ];

    for (const n of fanfareNotes) {
      const freq = midiToFreq(n.midi);
      this.playTone(now + n.delay, freq, 'triangle', n.dur, 0.28);
      this.playTone(now + n.delay, freq * 1.5, 'sine', n.dur, 0.12);
    }
  }

  // ============================================================================
  // SYNTHESIS HELPERS
  // ============================================================================
  private playTone(
    startTime: number,
    freq: number,
    type: OscillatorType,
    duration: number,
    peakGain: number
  ): void {
    if (!this.ctx || !this.seGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.seGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private playSlideTone(
    startTime: number,
    startFreq: number,
    endFreq: number,
    type: OscillatorType,
    duration: number,
    peakGain: number,
    lowpassHz?: number
  ): void {
    if (!this.ctx || !this.seGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    if (lowpassHz) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(lowpassHz, startTime);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(this.seGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private playNoiseBurst(
    startTime: number,
    duration: number,
    startFilterHz: number,
    endFilterHz: number,
    peakGain: number
  ): void {
    if (!this.ctx || !this.seGain || !this.noiseBuffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.8;
    filter.frequency.setValueAtTime(startFilterHz, startTime);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(80, endFilterHz),
      startTime + duration
    );

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.seGain);

    source.start(startTime);
    source.stop(startTime + duration + 0.02);
  }
}

export const soundEngine = new SoundEngine();
