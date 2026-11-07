// Camera transform, Canvas 2D drawing with placeholder shapes, debug overlay.
import { CONFIG, lerp, clamp } from './config.js';
import { cloudX, cloudY, bandTop, bandBottom, viewRect, windowRect } from './world.js';
import { drawCloud } from './cloudart.js';

/** @typedef {import('./world.js').Rect} Rect */
/** @typedef {import('./simulation.js').Run} Run */

/**
 * @typedef {object} DrawOptions
 * @property {boolean} debug draw colliders, window and counters
 * @property {number} splat squash progress 0..1 while splatting, or -1
 */

/**
 * @typedef {object} Renderer
 * @property {(run: Run, t: number, opts: DrawOptions) => void} draw
 *   draw one frame; t is the display game time used for analytic clouds and coin sparkles
 */

const SKY_LOW = [140, 205, 245];
const SKY_HIGH = [18, 24, 70];
/** @type {Rect} */
const scratchView = { x0: 0, y0: 0, x1: 0, y1: 0 };
/** @type {Rect} */
const scratchWin = { x0: 0, y0: 0, x1: 0, y1: 0 };

/**
 * @param {HTMLCanvasElement} canvas sized by CSS; backing store follows devicePixelRatio
 * @returns {Renderer}
 */
export function createRenderer(canvas) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  /** device pixels per world unit, set each frame from the camera width */
  let scale = 1;

  // Backing store follows devicePixelRatio, capped so large or high-DPR
  // screens don't allocate (and clear every frame) a huge bitmap. Past the
  // cap the browser upscales the canvas slightly.
  function resize() {
    const rect = canvas.getBoundingClientRect();
    let dpr = Math.min(window.devicePixelRatio || 1, CONFIG.MAX_DPR);
    const longSide = Math.max(rect.width, rect.height) * dpr;
    if (longSide > CONFIG.MAX_BACKING_PX) dpr *= CONFIG.MAX_BACKING_PX / longSide;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  /** 1 = facing right, -1 = left; kept from the last clear horizontal motion */
  let facing = 1;

  /**
   * Dan in the air. Arms flail up while falling and sweep down while rising;
   * the backpack sits on his back (opposite the facing direction).
   * @param {number} x feet centre
   * @param {number} y feet (bottom of collider)
   * @param {number} vy vertical velocity, + = falling
   * @param {boolean} boosting draw fart puffs
   * @param {number} t display game time, s
   */
  function drawDan(x, y, vy, boosting, t) {
    const h = CONFIG.DAN_H;
    const hipY = y - h * 0.38;
    const shoulderY = y - h * 0.68;
    const headY = y - h * 0.84;
    const falling = vy > 0;
    const flail = Math.sin(t * (falling ? 18 : 8)) * 0.35;

    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(facing, 1); // draw facing right; mirror when facing left

    if (boosting) {
      ctx.fillStyle = 'rgba(160, 200, 90, 0.75)';
      for (let i = 0; i < 3; i++) {
        const j = (t * 9 + i * 1.7) % 1;
        ctx.beginPath();
        ctx.arc(-4 - j * 6 + Math.sin(t * 20 + i) * 2, hipY + 4 + j * 20, 4 + j * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Backpack (behind him), with the lunch-launch flap on top.
    ctx.fillStyle = '#6d4c41';
    ctx.fillRect(-10, shoulderY - 1, 6, h * 0.3);
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(-11, shoulderY - 3, 8, 3);

    // Legs: two strokes from the hips to the shoes; shoes end exactly at y.
    const spread = falling ? 4 : 2.5;
    ctx.strokeStyle = '#1e3a8a'; // trousers
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-2, hipY);
    ctx.lineTo(-spread, y - 2.5);
    ctx.moveTo(2, hipY);
    ctx.lineTo(spread, y - 2.5);
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.fillRect(-spread - 3, y - 3, 5, 3); // left shoe
    ctx.fillRect(spread - 1, y - 3, 5, 3); // right shoe (toes forward)

    // Torso
    ctx.fillStyle = '#e53935';
    ctx.fillRect(-5, shoulderY, 10, hipY - shoulderY + 1);

    // Arms: angle from straight down (0) to straight up (PI).
    const armBase = falling ? 2.4 : 0.9;
    const armLen = h * 0.3;
    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      const ang = armBase + flail * side;
      ctx.moveTo(side * 4, shoulderY + 1);
      ctx.lineTo(side * (4 + Math.sin(ang) * armLen), shoulderY + 1 + Math.cos(ang) * armLen);
    }
    ctx.stroke();

    // Head with a hint of goggles so the facing direction reads.
    ctx.fillStyle = '#ffcc99';
    ctx.beginPath();
    ctx.arc(0, headY, h * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#263238';
    ctx.fillRect(0, headY - 2, 5.5, 2.5);

    ctx.restore();
  }

  /**
   * Squash Dan flat on the ground.
   * @param {number} x feet centre
   * @param {number} y ground level
   * @param {number} p 0..1 splat progress
   */
  function drawSplat(x, y, p) {
    const sq = Math.min(1, p * 4);
    const w = CONFIG.DAN_W;
    const h = CONFIG.DAN_H;
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.ellipse(x, y - lerp(h / 2, 3, sq), lerp(w / 2, w * 1.4, sq), lerp(h / 2, 4, sq), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(x - w * 1.3 * sq - 3, y - 3, 5, 3);
    ctx.fillRect(x + w * 1.3 * sq - 2, y - 3, 5, 3);
  }

  /**
   * @param {Run} run
   * @param {number} t display game time, s
   * @param {DrawOptions} opts
   */
  function draw(run, t, { debug, splat }) {
    const { dan, cam, world } = run;
    scale = canvas.width / cam.w;

    // Sky by camera altitude
    const a = clamp((CONFIG.GROUND_Y - cam.y) / CONFIG.CLOUD_MAX_ALT, 0, 1);
    const sky = SKY_LOW.map((v, i) => Math.round(lerp(v, SKY_HIGH[i], a)));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgb(${sky[0]},${sky[1]},${sky[2]})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // World transform
    const ox = cam.x - cam.w / 2;
    const oy = cam.y - cam.h / 2;
    ctx.setTransform(scale, 0, 0, scale, -ox * scale, -oy * scale);
    const view = viewRect(cam, scratchView);

    // Ground
    if (view.y1 > CONFIG.GROUND_Y) {
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(view.x0, CONFIG.GROUND_Y, cam.w, view.y1 - CONFIG.GROUND_Y);
      ctx.fillStyle = '#388e3c';
      ctx.fillRect(view.x0, CONFIG.GROUND_Y, cam.w, 6);
    }

    // Clouds: procedural ovals/circles (cloudart.js) inside each w × h box;
    // the art fills the box across the bounce band.
    for (const c of world.clouds) {
      if (!c.active) continue;
      const x = cloudX(c, t);
      const y = cloudY(c, t);
      if (x > view.x1 || x + c.w < view.x0 || y > view.y1 || y + c.h < view.y0) continue;
      drawCloud(ctx, x, y, c.w, c.h, c.seed);
    }

    // Coins
    const r = CONFIG.COIN_RADIUS;
    for (const k of world.coins) {
      if (!k.active) continue;
      if (k.x < view.x0 - r || k.x > view.x1 + r || k.y < view.y0 - r || k.y > view.y1 + r) continue;
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath();
      ctx.arc(k.x, k.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c79100';
      ctx.lineWidth = 2;
      ctx.stroke();
      const age = t - k.t0;
      if (age < CONFIG.COIN_SPARKLE_S) {
        const p = age / CONFIG.COIN_SPARKLE_S;
        ctx.strokeStyle = `rgba(255,255,255,${1 - p})`;
        ctx.beginPath();
        ctx.arc(k.x, k.y, r + 4 + p * 16, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Dan, feet at (x, y). Placeholder stick-figure-ish art sized to his
    // DAN_W × DAN_H collider: the soles of both shoes sit exactly on y.
    if (dan.vx > 5) facing = 1;
    else if (dan.vx < -5) facing = -1;
    if (splat >= 0) drawSplat(dan.x, dan.y, splat);
    else drawDan(dan.x, dan.y, dan.vy, dan.boosting, t);

    if (debug) drawDebug(run, t);
  }

  /**
   * @param {Run} run
   * @param {number} t display game time, s
   */
  function drawDebug(run, t) {
    const { dan, cam, world } = run;
    const lw = 1 / scale;
    ctx.lineWidth = lw * 1.5;

    const win = windowRect(cam, scratchWin);
    ctx.strokeStyle = 'magenta';
    ctx.strokeRect(win.x0, win.y0, win.x1 - win.x0, win.y1 - win.y0);

    for (const c of world.clouds) {
      if (!c.active) continue;
      const x = cloudX(c, t);
      const y = cloudY(c, t);
      ctx.strokeStyle = 'rgba(255,0,0,0.35)'; // visual box
      ctx.strokeRect(x, y, c.w, c.h);
      ctx.strokeStyle = 'red'; // bounce band
      const b0 = bandTop(c, t);
      ctx.strokeRect(x, b0, c.w, bandBottom(c, t) - b0);
    }
    ctx.strokeStyle = 'lime';
    ctx.strokeRect(dan.x - CONFIG.DAN_W / 2, dan.y - CONFIG.DAN_H, CONFIG.DAN_W, CONFIG.DAN_H);
    ctx.fillStyle = 'lime'; // feet point: what the bounce bands test
    ctx.beginPath();
    ctx.arc(dan.x, dan.y, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, canvas.height - 22 * scale, canvas.width, 22 * scale);
    ctx.fillStyle = '#fff';
    ctx.font = `${11 * scale}px monospace`;
    ctx.fillText(
      `clouds ${world.cloudCount}/${CONFIG.CLOUD_POOL}  coins ${world.coinCount}  cand ${run.candidates}  vy ${dan.vy.toFixed(0)}`,
      6 * scale,
      canvas.height - 7 * scale,
    );
  }

  return { draw };
}
