// Coin pickup sparkle: a burst of twinkling four-point stars (gold and white)
// flying outward and fading, a quick expanding ring, and a "+1" floating up.
// Driven by world.pickups (ring buffer filled by the simulation); a pure
// function of (slot, age), so nothing is allocated per frame.
import { CONFIG } from './config.js';
import { rand } from './cloudart.js';

/** @typedef {import('./world.js').Pickup} Pickup */

const STARS = 9;
const GOLD = '#ffd54f';
const PALE = '#fff8d0';

/** @param {number} p 0..1 @returns {number} */
const easeOut = (p) => 1 - (1 - p) ** 3;

/**
 * Add a four-point star to the current path.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} r tip radius
 */
function star(ctx, x, y, r) {
  const w = r * 0.28;
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + w, y - w);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x + w, y + w);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - w, y + w);
  ctx.lineTo(x - r, y);
  ctx.lineTo(x - w, y - w);
  ctx.closePath();
}

/**
 * Draw all live pickup bursts. World transform applied.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Pickup[]} pickups
 * @param {number} t display game time, s
 */
export function drawPickupSparkles(ctx, pickups, t) {
  const dur = CONFIG.PICKUP_FX_S;
  for (let i = 0; i < pickups.length; i++) {
    const pk = pickups[i];
    const age = t - pk.t;
    if (!(age >= 0 && age < dur)) continue;
    const p = age / dur;
    const out = easeOut(p);
    const fade = 1 - p * p;
    // Per-burst seed so consecutive pickups don't look identical.
    const seed = (Math.floor(pk.t * 1000) * 2654435761 + i) >>> 0;

    // Quick expanding ring, gone by 40% of the burst.
    const ring = Math.min(1, p / 0.4);
    if (ring < 1) {
      ctx.globalAlpha = (1 - ring) ** 2 * 0.7;
      ctx.strokeStyle = PALE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pk.x, pk.y, CONFIG.COIN_RADIUS * (0.6 + easeOut(ring) * 1.2), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Stars flying out, twinkling (size pulses) and fading.
    for (let s = 0; s < STARS; s++) {
      const a = ((s + rand(seed, s) * 0.6) / STARS) * Math.PI * 2;
      const dist = (12 + rand(seed, 20 + s) * 22) * out;
      const twinkle = 0.65 + 0.35 * Math.sin(age * 40 + s * 2.1);
      const r = (3.2 + rand(seed, 40 + s) * 3.6) * twinkle * (1 - p * 0.55);
      ctx.globalAlpha = fade;
      ctx.fillStyle = s % 3 === 0 ? PALE : GOLD;
      ctx.beginPath();
      star(ctx, pk.x + Math.cos(a) * dist, pk.y + Math.sin(a) * dist - out * 4, r);
      ctx.fill();
    }

    // "+1" floating up.
    ctx.globalAlpha = fade;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#6b3d00';
    const ty = pk.y - 10 - out * 16;
    ctx.strokeText('+1', pk.x, ty);
    ctx.fillStyle = GOLD;
    ctx.fillText('+1', pk.x, ty);
  }
  ctx.globalAlpha = 1;
}
