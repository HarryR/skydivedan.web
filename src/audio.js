// Sound effects synthesized with WebAudio: no audio files. A short "ding" for
// coins, a rising jingle for big coins, a "boing" for cloud bounces, a looping
// fart while boosting, a wet thwack for the ground splat and a "boom" for mines.
// The AudioContext is created on the first user gesture (browser autoplay
// rules); until then every call is a silent no-op. Mute persists locally.
import { CONFIG } from './config.js';

/** @type {AudioContext | null} */
let ac = null;
/** @type {GainNode | null} */
let master = null;
/** @type {AudioBuffer | null} */
let noiseBuf = null;
let muted = loadMuted();
const VOLUME = 0.45;

/** @returns {boolean} */
function loadMuted() {
  try {
    return localStorage.getItem(CONFIG.SOUND_KEY) === 'off';
  } catch {
    return false;
  }
}

/** @returns {boolean} */
export const isMuted = () => muted;

/**
 * @param {boolean} m
 */
export function setMuted(m) {
  muted = m;
  try {
    localStorage.setItem(CONFIG.SOUND_KEY, m ? 'off' : 'on');
  } catch {
    /* storage unavailable */
  }
  if (master && ac) master.gain.setTargetAtTime(m ? 0 : VOLUME, ac.currentTime, 0.02);
  if (m) setFart(false);
}

/** Create/resume the AudioContext. Call from a user gesture (tap, click, key). */
export function unlockAudio() {
  if (!ac) {
    const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    if (!AC) return;
    ac = /** @type {AudioContext} */ (new AC());
    master = ac.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(ac.destination);
    // One second of white noise, reused by every noisy sound.
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
}

/** @returns {boolean} ready to play (unlocked and not muted) */
const live = () => !!ac && !!master && !muted && ac.state === 'running';

/**
 * A pitched blip with a fast attack and exponential decay.
 * @param {OscillatorType} type
 * @param {number} f0 start frequency, Hz
 * @param {number} f1 end frequency, Hz
 * @param {number} dur seconds
 * @param {number} vol peak gain
 * @param {number} [delay] seconds from now
 */
function tone(type, f0, f1, dur, vol, delay = 0) {
  const a = /** @type {AudioContext} */ (ac);
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(/** @type {GainNode} */ (master));
  o.start(t);
  o.stop(t + dur + 0.02);
}

/**
 * A filtered noise burst with a sweeping cutoff.
 * @param {number} dur seconds
 * @param {number} vol peak gain
 * @param {BiquadFilterType} type
 * @param {number} f0 start cutoff, Hz
 * @param {number} f1 end cutoff, Hz
 */
function noise(dur, vol, type, f0, f1) {
  const a = /** @type {AudioContext} */ (ac);
  const t = a.currentTime;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(/** @type {GainNode} */ (master));
  src.start(t);
  src.stop(t + dur + 0.02);
}

export const sfx = {
  coin() {
    if (!live()) return;
    tone('square', 988, 988, 0.07, 0.12);
    tone('square', 1319, 1319, 0.16, 0.12, 0.065);
  },
  bigCoin() {
    if (!live()) return;
    [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.1, 0.11, i * 0.06));
    tone('triangle', 2093, 2093, 0.35, 0.12, 0.24);
  },
  bounce() {
    if (!live()) return;
    tone('sine', 170, 520, 0.16, 0.32);
    tone('triangle', 340, 1040, 0.1, 0.06);
  },
  splat() {
    if (!live()) return;
    noise(0.3, 0.7, 'lowpass', 1400, 120);
    tone('sine', 180, 45, 0.28, 0.55);
  },
  boom() {
    if (!live()) return;
    noise(1.1, 0.9, 'lowpass', 2400, 50);
    tone('sine', 120, 30, 0.8, 0.8);
    tone('square', 70, 35, 0.25, 0.15);
  },
};

/** @type {{ stop: () => void } | null} */
let fart = null;

/**
 * Start or stop the looping fart sound (a wobbling low buzz plus breathy noise).
 * @param {boolean} on
 */
export function setFart(on) {
  if (on && !fart && live()) {
    const a = /** @type {AudioContext} */ (ac);
    const t = a.currentTime;
    const out = a.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.28, t + 0.04);
    out.connect(/** @type {GainNode} */ (master));
    // Buzz: sawtooth with a fast, irregular pitch wobble, through a lowpass.
    const o = a.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 78;
    const lfo = a.createOscillator();
    lfo.frequency.value = 11;
    const lfoGain = a.createGain();
    lfoGain.gain.value = 22;
    lfo.connect(lfoGain).connect(o.frequency);
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.Q.value = 6;
    o.connect(lp).connect(out);
    // Breath: looping noise through a bandpass.
    const n = a.createBufferSource();
    n.buffer = noiseBuf;
    n.loop = true;
    const bp = a.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 260;
    bp.Q.value = 1.2;
    const ng = a.createGain();
    ng.gain.value = 0.5;
    n.connect(bp).connect(ng).connect(out);
    o.start(t);
    lfo.start(t);
    n.start(t);
    fart = {
      stop() {
        const t2 = a.currentTime;
        out.gain.cancelScheduledValues(t2);
        out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t2);
        out.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.08);
        o.stop(t2 + 0.1);
        lfo.stop(t2 + 0.1);
        n.stop(t2 + 0.1);
      },
    };
  } else if (!on && fart) {
    fart.stop();
    fart = null;
  }
}

/**
 * Vibrate if the device supports it (Android; ignored elsewhere).
 * @param {number | number[]} pattern ms
 */
export function buzz(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* not allowed */
  }
}
