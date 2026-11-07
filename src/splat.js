// Cartoon splat for when Dan hits the ground: a red splat that pops out on
// the ground (dark rim, highlights), a splash crown of spikes that shoots up
// and settles, and droplets that fly out in arcs and land as small splats.
// Everything is a pure function of (seed, time since impact), so there is no
// state and nothing is allocated per frame.
import { CONFIG } from './config.js';
import { rand } from './cloudart.js';

const RED = '#d4161b';
const RIM = '#6e0709';
const SHINE = '#ff7a6b';

const POOL_LOBES = 7;
const SPIKES = 7;
const DROPS = 20;
const DROP_GRAVITY = 900; // world units / s²
const POP_S = 0.14; // splat grows to full size over this long

/** @param {number} p 0..1 @returns {number} ease-out cubic */
const easeOut = (p) => 1 - (1 - Math.min(1, Math.max(0, p))) ** 3;

/**
 * Draw the ground splat (lobed pool plus crown spikes), filled in one colour.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x impact x
 * @param {number} y ground level
 * @param {number} seed
 * @param {number} s growth 0..1
 * @param {number} crown spike height factor 0..1
 * @param {number} grow world units added to every shape (for the rim pass)
 */
function pool(ctx, x, y, seed, s, crown, grow) {
  ctx.beginPath();
  // Main flat pool, sitting on the ground line.
  const rx = 27 * s + grow;
  const ry = 2.6 * s + grow;
  ctx.moveTo(x + rx, y - 1);
  ctx.ellipse(x, y - 1, rx, ry, 0, 0, Math.PI * 2);
  // Lobes along the ground for an irregular outline.
  for (let i = 0; i < POOL_LOBES; i++) {
    const t = (i + 0.5) / POOL_LOBES - 0.5;
    const lx = x + t * 58 * s + (rand(seed, i) - 0.5) * 6 * s;
    const lr = (2.5 + rand(seed, 20 + i) * 4) * s + grow;
    ctx.moveTo(lx + lr * 1.8, y - 0.8);
    ctx.ellipse(lx, y - 0.8, lr * 1.8, lr * 0.5, 0, 0, Math.PI * 2);
  }
  // Crown spikes: thin teardrops pointing up and out from the impact.
  for (let i = 0; i < SPIKES; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / SPIKES - 0.5) * 2.2 + (rand(seed, 40 + i) - 0.5) * 0.25;
    const len = (10 + rand(seed, 50 + i) * 14) * crown * s;
    if (len < 0.5) continue;
    // Spikes rise from along the pool, leaning outwards, not from one point.
    const ox = x + ((i + 0.5) / SPIKES - 0.5) * 40 * s;
    const w = 1.8 * s + grow;
    const tx = ox + Math.cos(a) * len;
    const ty = y - 1 + Math.sin(a) * len;
    const nx = -Math.sin(a) * w;
    const ny = Math.cos(a) * w;
    ctx.moveTo(ox + nx, y - 1 + ny);
    ctx.lineTo(tx, ty);
    ctx.lineTo(ox - nx, y - 1 - ny);
    ctx.closePath();
    // Round blob at the spike tip.
    ctx.moveTo(tx + w * 0.9, ty);
    ctx.arc(tx, ty, w * 0.9, 0, Math.PI * 2);
  }
  ctx.fill();
}

/**
 * Splat behind Dan: the pool and crown, drawn before the squashed sprite.
 * @param {CanvasRenderingContext2D} ctx world transform applied
 * @param {number} x impact x (Dan's feet)
 * @param {number} y ground level
 * @param {number} tt seconds since impact
 * @param {number} seed per-impact seed
 */
export function drawSplatPool(ctx, x, y, tt, seed) {
  const s = easeOut(tt / POP_S);
  // Crown shoots up fast, then settles to a low ragged edge.
  const crown = tt < POP_S ? easeOut(tt / POP_S) : 0.35 + 0.65 * Math.exp(-(tt - POP_S) * 6);
  ctx.fillStyle = RIM;
  pool(ctx, x, y, seed, s, crown, 1.4);
  ctx.fillStyle = RED;
  pool(ctx, x, y, seed, s, crown, 0);
  // A few shine dots on the pool.
  ctx.fillStyle = SHINE;
  for (let i = 0; i < 3; i++) {
    const dx = (rand(seed, 70 + i) - 0.5) * 30 * s;
    ctx.beginPath();
    ctx.ellipse(x + dx, y - 3 * s, 2.2 * s, 0.9 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Droplets in front of Dan: fly out in arcs, then lie as small splats.
 * @param {CanvasRenderingContext2D} ctx world transform applied
 * @param {number} x impact x
 * @param {number} y ground level
 * @param {number} tt seconds since impact
 * @param {number} seed per-impact seed
 */
export function drawSplatDrops(ctx, x, y, tt, seed) {
  for (let i = 0; i < DROPS; i++) {
    const a = -Math.PI / 2 + (rand(seed, 100 + i) - 0.5) * 2.8; // mostly upward fan
    const sp = 110 + rand(seed, 120 + i) * 200;
    const vx = Math.cos(a) * sp;
    const vy = Math.sin(a) * sp; // negative = up
    const r = 0.8 + rand(seed, 140 + i) * 1.3;
    const tLand = (-2 * vy) / DROP_GRAVITY; // back at ground height
    if (tt < tLand) {
      const px = x + vx * tt;
      const py = y - 2 + vy * tt + 0.5 * DROP_GRAVITY * tt * tt;
      ctx.fillStyle = RIM;
      ctx.beginPath();
      ctx.arc(px, py, r + 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = RED;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const px = x + vx * tLand;
      const land = easeOut((tt - tLand) / 0.08);
      if (Math.abs(px - x) > 26) {
        // Rim only off the pool; inside it would draw stray outlines.
        ctx.fillStyle = RIM;
        ctx.beginPath();
        ctx.ellipse(px, y - 0.6, (r * 1.7 + 0.8) * land, r * 0.55 + 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = RED;
      ctx.beginPath();
      ctx.ellipse(px, y - 0.6, r * 1.7 * land, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Seed for one impact, from where it happened (varies run to run).
 * @param {number} x
 * @returns {number}
 */
export const splatSeed = (x) => (Math.floor(x * 7.31) ^ 0x5b1a7) >>> 0;

/**
 * Seconds since impact, from the 0..1 splat progress the game passes in.
 * @param {number} p
 * @returns {number}
 */
export const splatTime = (p) => p * CONFIG.SPLAT_S;
