// Procedural clouds: random splats of ovals and circles inside each cloud's
// w × h box, drawn directly every frame (no sprites or assets). The shapes are
// a pure function of the cloud's seed, so a cloud looks the same every frame
// and nothing is stored or allocated per cloud.
//
// Style (from the cloud-components-v01 reference): navy outline, soft-blue
// underside, pale body, white caps. Drawn as four layered passes over the same
// shapes, each pass a single path + fill.
//
// Shape rules keep the art matched to the bounce band (middle 3/5, full width):
// a row of base ovals spans the full width across the band, and puffs sit on top.
import { CONFIG } from './config.js';

/** Shape buffer: [cx, cy, rx, ry] per shape, world units relative to the box top-left. */
const MAX_SHAPES = 3 + CONFIG.CLOUD_PUFFS_MAX;
const shapes = new Float64Array(MAX_SHAPES * 4);

/**
 * Stateless hash -> [0, 1): the k-th random number for this seed.
 * @param {number} seed 32-bit cloud seed
 * @param {number} k draw index
 * @returns {number}
 */
export function rand(seed, k) {
  let t = (seed ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0;
  t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
  t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
  return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
}

/**
 * Write one shape into the buffer.
 * @param {number} i shape index
 * @param {number} cx
 * @param {number} cy
 * @param {number} rx
 * @param {number} ry
 */
function put(i, cx, cy, rx, ry) {
  shapes[i * 4] = cx;
  shapes[i * 4 + 1] = cy;
  shapes[i * 4 + 2] = rx;
  shapes[i * 4 + 3] = ry;
}

/**
 * Fill `shapes` for one cloud.
 * @param {number} seed
 * @param {number} w box width, world units
 * @param {number} h box height, world units
 * @returns {number} number of shapes written
 */
function generate(seed, w, h) {
  let k = 0;
  let n = 0;

  // Base row: 2–3 overlapping ovals, the end ones touching the box sides, so
  // the body spans the full width across the bounce band.
  const nb = w > CONFIG.CLOUD_BASE3_W ? 3 : 2;
  const brx = (w / nb) * 0.75;
  for (let i = 0; i < nb; i++) {
    const t = i / (nb - 1);
    const ry = h * (CONFIG.CLOUD_BASE_RY + rand(seed, k++) * 0.06);
    const cy = h - ry - h * (0.06 + rand(seed, k++) * 0.04); // a little above the box bottom
    put(n++, brx + t * (w - 2 * brx), cy, brx, ry);
  }

  // Puffs: circles along the top, bigger towards the middle. One is pushed up
  // to touch the box top so the cloud fills its box.
  const span = CONFIG.CLOUD_PUFFS_MAX - CONFIG.CLOUD_PUFFS_MIN + 1;
  const np = CONFIG.CLOUD_PUFFS_MIN + Math.floor(rand(seed, k++) * span);
  const tallest = Math.floor(rand(seed, k++) * np);
  const rRange = CONFIG.CLOUD_PUFF_R_MAX - CONFIG.CLOUD_PUFF_R_MIN;
  for (let i = 0; i < np; i++) {
    const t = (i + 0.5) / np;
    const middle = 1 - Math.abs(t - 0.5) * 1.4;
    const r = h * (CONFIG.CLOUD_PUFF_R_MIN + rRange * (0.5 * middle + 0.5 * rand(seed, k++)));
    const rx = r * (1 + rand(seed, k++) * CONFIG.CLOUD_PUFF_OVAL); // slightly wide ovals
    let cx = w * (0.14 + 0.72 * t + (rand(seed, k++) - 0.5) * 0.1);
    cx = Math.min(w - rx, Math.max(rx, cx));
    const top = i === tallest ? 0 : h * (0.04 + rand(seed, k++) * 0.2);
    put(n++, cx, top + r, rx, r);
  }
  return n;
}

/**
 * Add every shape to one path, grown by `grow` and with the bottom `lift`
 * fraction of each shape's ry removed (top edge unchanged), then fill.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} n shapes
 * @param {number} x box left
 * @param {number} y box top
 * @param {number} grow world units added to both radii
 * @param {number} lift fraction of each shape's ry removed from its bottom
 */
function pass(ctx, n, x, y, grow, lift) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const rx = shapes[i * 4 + 2];
    const ry = shapes[i * 4 + 3];
    const l = ry * lift;
    const cx = x + shapes[i * 4];
    const cy = y + shapes[i * 4 + 1] - l / 2;
    const ex = Math.max(0.5, rx + grow - l / 2);
    const ey = Math.max(0.5, ry + grow - l / 2);
    ctx.moveTo(cx + ex, cy);
    ctx.ellipse(cx, cy, ex, ey, 0, 0, Math.PI * 2);
  }
  ctx.fill();
}

/**
 * Draw one cloud into its box. Call with the world transform applied.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x box left, world units
 * @param {number} y box top, world units
 * @param {number} w box width
 * @param {number} h box height
 * @param {number} seed the cloud's 32-bit seed
 */
export function drawCloud(ctx, x, y, w, h, seed) {
  const n = generate(seed, w, h);
  ctx.fillStyle = CONFIG.CLOUD_COLOR_OUTLINE;
  pass(ctx, n, x, y, CONFIG.CLOUD_OUTLINE, 0);
  ctx.fillStyle = CONFIG.CLOUD_COLOR_SHADE;
  pass(ctx, n, x, y, 0, 0);
  ctx.fillStyle = CONFIG.CLOUD_COLOR_BODY;
  pass(ctx, n, x, y, 0, CONFIG.CLOUD_SHADE_LIFT);
  ctx.fillStyle = CONFIG.CLOUD_COLOR_TOP;
  pass(ctx, n, x, y, 0, CONFIG.CLOUD_TOP_LIFT);
}
