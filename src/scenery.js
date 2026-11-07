// Parallax background scenery, drawn between the sky and the clouds:
// - stars that fade in and brighten as Dan climbs (nearly fixed in screen);
// - two mountain ranges and a hill line with trees that come into view as Dan
//   descends (ground-anchored layers scrolling slower than the world);
// - grass tufts along the ground itself (world layer).
// Everything is procedural from stateless hashes: no assets, no per-frame
// allocation, and the same shapes every time a spot comes back into view.
import { CONFIG, clamp } from './config.js';
import { rand } from './cloudart.js';

/** @typedef {import('./world.js').Camera} Camera */
/** @typedef {import('./world.js').Rect} Rect */

/**
 * A ground-anchored parallax layer. Factor f: 0 = fixed to the screen,
 * 1 = moves with the world. At the lowest camera position the layer's
 * baseline sits on the ground; as the camera rises by d it sinks on screen by
 * f·d, so low layers (trees) vanish quickly and far ones (mountains) linger.
 * @typedef {object} RidgeLayer
 * @property {number} f parallax factor
 * @property {number} seed
 * @property {number} base ridge height above baseline, world units
 * @property {number} amp extra ridge height from noise
 * @property {number} scale horizontal feature size, world units
 * @property {string} color
 */

/** @type {RidgeLayer[]} far to near */
const MOUNTAINS = [
  { f: 0.2, seed: 0x6d01, base: 150, amp: 170, scale: 210, color: '#93a2d6' },
  { f: 0.3, seed: 0x6d02, base: 90, amp: 130, scale: 140, color: '#6f80bd' },
];
/** @type {RidgeLayer} */
const HILLS = { f: 0.45, seed: 0x4111, base: 26, amp: 22, scale: 90, color: '#4f9a52' };

const TREE_SPACING = 26; // world units between tree slots (in layer space)
const STAR_TILE = 420; // star field repeats every STAR_TILE world units
const STARS_PER_TILE = 34;
const STAR_F = 0.03;
/** Stars fade in from this fraction of CLOUD_MAX_ALT, fully visible at STAR_FULL. */
const STAR_START = 0.25;
const STAR_FULL = 0.9;
/** Star sizes (world units): dim, medium, bright. */
const STAR_SIZES = [1.6, 2.4, 3.4];

/** @param {number} e0 @param {number} e1 @param {number} x @returns {number} */
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Smooth 1D value noise in [0, 1].
 * @param {number} seed
 * @param {number} x
 * @returns {number}
 */
function noise(seed, x) {
  const i = Math.floor(x);
  const t = x - i;
  const s = t * t * (3 - 2 * t);
  return rand(seed, i) * (1 - s) + rand(seed, i + 1) * s;
}

/**
 * Ridge height above the layer baseline at layer-space x.
 * @param {RidgeLayer} L
 * @param {number} x
 * @returns {number}
 */
function ridge(L, x) {
  const n = noise(L.seed, x / L.scale) * 0.7 + noise(L.seed + 7, x / (L.scale * 0.37)) * 0.3;
  return L.base + L.amp * n;
}

/**
 * Lowest camera centre y (ground ~70% down the screen), as in simulation.js.
 * @param {Camera} cam
 * @returns {number}
 */
const camLow = (cam) => CONFIG.GROUND_Y - cam.h * 0.2;

/**
 * World-space offsets of a layer with factor f for this camera.
 * @param {Camera} cam
 * @param {number} f
 * @returns {{ ox: number, oy: number }} add to layer coords to get world coords
 */
function layerOffset(cam, f) {
  return { ox: cam.x * (1 - f), oy: CONFIG.GROUND_Y + (cam.y - camLow(cam)) * (1 - f) };
}

/**
 * Fill a ridge silhouette for a layer, down to the bottom of the view.
 * @param {CanvasRenderingContext2D} ctx world transform applied
 * @param {Camera} cam
 * @param {Rect} view
 * @param {RidgeLayer} L
 * @returns {boolean} whether any of it was on screen
 */
function drawRidge(ctx, cam, view, L) {
  const { ox, oy } = layerOffset(cam, L.f);
  if (oy - (L.base + L.amp) > view.y1) return false; // entirely below the view
  const step = 8;
  const x0 = Math.floor((view.x0 - ox) / step) * step;
  const x1 = view.x1 - ox + step;
  ctx.fillStyle = L.color;
  ctx.beginPath();
  ctx.moveTo(x0 + ox, view.y1 + 2);
  for (let x = x0; x <= x1; x += step) ctx.lineTo(x + ox, oy - ridge(L, x));
  ctx.lineTo(x1 + ox, view.y1 + 2);
  ctx.closePath();
  ctx.fill();
  return true;
}

/**
 * Trees standing on the hill ridge: pines and round trees, seeded per slot.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Camera} cam
 * @param {Rect} view
 */
function drawTrees(ctx, cam, view) {
  const L = HILLS;
  const { ox, oy } = layerOffset(cam, L.f);
  if (oy - (L.base + L.amp + 60) > view.y1) return;
  const i0 = Math.floor((view.x0 - ox) / TREE_SPACING) - 1;
  const i1 = Math.ceil((view.x1 - ox) / TREE_SPACING) + 1;
  for (let i = i0; i <= i1; i++) {
    if (rand(L.seed + 3, i) < 0.35) continue; // gaps
    const lx = i * TREE_SPACING + (rand(L.seed + 4, i) - 0.5) * TREE_SPACING * 0.6;
    const x = lx + ox;
    const y = oy - ridge(L, lx) + 3; // sink slightly into the hill
    const h = 22 + rand(L.seed + 5, i) * 26;
    // trunk
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(x - 1.5, y - h * 0.3, 3, h * 0.3);
    if (rand(L.seed + 6, i) < 0.55) {
      // pine: two stacked triangles
      ctx.fillStyle = '#2e6b3a';
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.lineTo(x + h * 0.32, y - h * 0.38);
      ctx.lineTo(x - h * 0.32, y - h * 0.38);
      ctx.closePath();
      ctx.moveTo(x, y - h * 0.72);
      ctx.lineTo(x + h * 0.4, y - h * 0.22);
      ctx.lineTo(x - h * 0.4, y - h * 0.22);
      ctx.closePath();
      ctx.fill();
    } else {
      // round tree: three blobs
      const r = h * 0.28;
      ctx.fillStyle = '#3a8a40';
      ctx.beginPath();
      ctx.arc(x, y - h * 0.62, r, 0, Math.PI * 2);
      ctx.moveTo(x - r * 0.6 + r * 0.8, y - h * 0.45);
      ctx.arc(x - r * 0.6, y - h * 0.45, r * 0.8, 0, Math.PI * 2);
      ctx.moveTo(x + r * 0.6 + r * 0.8, y - h * 0.45);
      ctx.arc(x + r * 0.6, y - h * 0.45, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Star field: nearly fixed to the screen, fading in from mid altitude and
 * brightest at the top of the cloud field, with a gentle twinkle.
 * @param {CanvasRenderingContext2D} ctx world transform applied
 * @param {Camera} cam
 * @param {Rect} view
 * @param {number} t display game time, s
 */
function drawStars(ctx, cam, view, t) {
  const alt = CONFIG.GROUND_Y - cam.y;
  const vis = smoothstep(CONFIG.CLOUD_MAX_ALT * STAR_START, CONFIG.CLOUD_MAX_ALT * STAR_FULL, alt);
  if (vis <= 0.01) return;
  const ox = cam.x * (1 - STAR_F);
  const oy = cam.y * (1 - STAR_F);
  const tx0 = Math.floor((view.x0 - ox) / STAR_TILE);
  const tx1 = Math.floor((view.x1 - ox) / STAR_TILE);
  const ty0 = Math.floor((view.y0 - oy) / STAR_TILE);
  const ty1 = Math.floor((view.y1 - oy) / STAR_TILE);
  ctx.fillStyle = '#fffbe8';
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const tseed = (Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663)) >>> 0;
      for (let k = 0; k < STARS_PER_TILE; k++) {
        const x = ox + (tx + rand(tseed, k * 4)) * STAR_TILE;
        const y = oy + (ty + rand(tseed, k * 4 + 1)) * STAR_TILE;
        const big = rand(tseed, k * 4 + 2);
        const tw = 0.6 + 0.4 * Math.sin(t * (1.5 + big * 3) + k);
        // Dim stars need more altitude to appear; bright ones show first.
        const a = vis * tw * smoothstep(0.5 - big * 0.5, 0.9, vis);
        if (a <= 0.02) continue;
        ctx.globalAlpha = a;
        const s = STAR_SIZES[big > 0.9 ? 2 : big > 0.6 ? 1 : 0];
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * Everything behind the clouds: stars, mountains, hills with trees.
 * Call after the sky fill, with the world transform applied.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Camera} cam
 * @param {Rect} view
 * @param {number} t display game time, s
 */
export function drawScenery(ctx, cam, view, t) {
  drawStars(ctx, cam, view, t);
  for (const L of MOUNTAINS) drawRidge(ctx, cam, view, L);
  if (drawRidge(ctx, cam, view, HILLS)) drawTrees(ctx, cam, view);
}

/**
 * Grass tufts along the ground line (world layer). Call after the ground fill.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Rect} view
 */
export function drawGrass(ctx, view) {
  if (view.y1 < CONFIG.GROUND_Y - 10) return;
  const step = 6;
  const g = CONFIG.GROUND_Y;
  ctx.fillStyle = '#2f7d32';
  ctx.beginPath();
  for (let i = Math.floor(view.x0 / step) - 1; i <= Math.ceil(view.x1 / step) + 1; i++) {
    if (rand(0x6a55, i) < 0.3) continue;
    const x = i * step + rand(0x6a56, i) * step;
    const h = 3 + rand(0x6a57, i) * 6;
    const lean = (rand(0x6a58, i) - 0.5) * 4;
    ctx.moveTo(x - 1.6, g + 1);
    ctx.lineTo(x + lean, g - h);
    ctx.lineTo(x + 1.6, g + 1);
    ctx.closePath();
  }
  ctx.fill();
}
