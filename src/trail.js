// Rainbow sparkle trail behind Dan (new best score, or a hot pickup streak).
// The renderer samples Dan's position into a small ring buffer while the
// trail is on; each sample becomes a twinkling rainbow star that shrinks and
// fades over TRAIL_LIFE_S. Samples keep fading after the trail turns off.
import { CONFIG } from './config.js';
import { rand } from './cloudart.js';
import { star } from './sparkle.js';

const SAMPLES = 32;
const TRAIL_LIFE_S = 0.6;
const SAMPLE_EVERY_S = 1 / 45;

/**
 * @typedef {object} Trail
 * @property {Float64Array} x
 * @property {Float64Array} y
 * @property {Float64Array} t sample time (-Infinity = empty)
 * @property {number} next ring index
 * @property {number} last time of the last sample
 */

/** @returns {Trail} */
export function createTrail() {
  return {
    x: new Float64Array(SAMPLES),
    y: new Float64Array(SAMPLES),
    t: new Float64Array(SAMPLES).fill(-Infinity),
    next: 0,
    last: -Infinity,
  };
}

/** @param {Trail} tr */
export function clearTrail(tr) {
  tr.t.fill(-Infinity);
  tr.last = -Infinity;
}

/**
 * Record Dan's position (call each frame while the trail is on).
 * @param {Trail} tr
 * @param {number} x feet x
 * @param {number} y feet y
 * @param {number} t display game time, s
 */
export function sampleTrail(tr, x, y, t) {
  if (t < tr.last) clearTrail(tr); // time went backwards: new run
  if (t - tr.last < SAMPLE_EVERY_S) return;
  tr.last = t;
  tr.x[tr.next] = x;
  tr.y[tr.next] = y - CONFIG.DAN_H * 0.45; // from his middle
  tr.t[tr.next] = t;
  tr.next = (tr.next + 1) % SAMPLES;
}

/**
 * Draw the live trail samples. World transform applied.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Trail} tr
 * @param {number} t display game time, s
 */
export function drawTrail(ctx, tr, t) {
  for (let i = 0; i < SAMPLES; i++) {
    const age = t - tr.t[i];
    if (!(age >= 0 && age < TRAIL_LIFE_S)) continue;
    const p = age / TRAIL_LIFE_S;
    const seed = (Math.floor(tr.t[i] * 997) >>> 0) + i;
    const jx = (rand(seed, 0) - 0.5) * 14;
    const jy = (rand(seed, 1) - 0.5) * 14 + p * 6; // drift down a little
    const hue = (tr.t[i] * 360 * 1.5 + i * 18) % 360;
    const tw = 0.7 + 0.3 * Math.sin(t * 30 + i);
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = `hsl(${hue}, 100%, 65%)`;
    ctx.beginPath();
    star(ctx, tr.x[i] + jx, tr.y[i] + jy, (8 - p * 5) * tw);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
