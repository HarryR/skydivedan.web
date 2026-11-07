// Bounded cloud pool with analytic drift, and the randomized coin spawner.
// No tile grid yet: the pool capacity bounds the work (SIMULATION_DESIGN.md).
import { CONFIG, lerp, altFrac } from './config.js';

/** Uniform random number generator returning values in [0, 1). @typedef {() => number} Rng */

/**
 * Axis-aligned rectangle in world units (y down).
 * @typedef {object} Rect
 * @property {number} x0 left
 * @property {number} y0 top
 * @property {number} x1 right
 * @property {number} y1 bottom
 */

/**
 * Camera: centre and visible size, all in world units. The size comes from
 * the screen layout (config.js layoutFor) and can change on resize.
 * @typedef {object} Camera
 * @property {number} x centre
 * @property {number} y centre
 * @property {number} w visible width
 * @property {number} h visible height
 */

/**
 * A pooled cloud. Position is analytic: the top-left of its visual box at game
 * time t is (x0 + vx·(t − t0), y0 + vy·(t − t0)). The art fills that w × h box.
 * The bounce band spans the full width and the middle of the height
 * (CLOUD_BAND_TOP..CLOUD_BAND_BOTTOM); see bandTop/bandBottom.
 * @typedef {object} Cloud
 * @property {boolean} active
 * @property {number} x0 left edge of the visual box at spawn time
 * @property {number} y0 top edge of the visual box at spawn time
 * @property {number} vx horizontal drift, units/s
 * @property {number} vy vertical drift, units/s
 * @property {number} t0 game time of spawn, s
 * @property {number} w box width (= bounce band width)
 * @property {number} h box height
 * @property {number} seed 32-bit seed for the procedural art (cloudart.js)
 */

/**
 * A pooled coin. Coins don't move.
 * @typedef {object} Coin
 * @property {boolean} active
 * @property {number} x centre
 * @property {number} y centre
 * @property {number} t0 game time of spawn, s (drives the sparkle)
 */

/**
 * A recent coin pickup, for the sparkle burst (render-only; ring buffer).
 * @typedef {object} Pickup
 * @property {number} x coin centre
 * @property {number} y coin centre
 * @property {number} t game time of pickup, s (-Infinity = unused)
 */

/**
 * @typedef {object} World
 * @property {Cloud[]} clouds fixed-capacity pool (CONFIG.CLOUD_POOL)
 * @property {Coin[]} coins fixed-capacity pool (CONFIG.COIN_POOL)
 * @property {number} cloudCount active clouds
 * @property {number} coinCount active coins
 * @property {Rng} rng run-seeded generator for clouds and coins
 * @property {number} coinHazard accumulated rho·dt since the last coin spawn
 * @property {number} coinThreshold Exp(1)-distributed hazard needed for the next spawn
 * @property {number} coinDebt collected coins not yet allowed to respawn (paid back by the hazard timer)
 * @property {Pickup[]} pickups fixed ring buffer of recent pickups (CONFIG.PICKUP_FX_POOL)
 * @property {number} pickupNext next ring-buffer slot to overwrite
 * @property {Rect} view scratch: camera viewport, refreshed each step
 * @property {Rect} win scratch: simulation window, refreshed each step
 */

/**
 * Small deterministic PRNG (mulberry32).
 * @param {number} seed 32-bit seed
 * @returns {Rng}
 */
export function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {Rng} rng
 * @param {number} a
 * @param {number} b
 * @returns {number} uniform in [a, b)
 */
const range = (rng, a, b) => a + (b - a) * rng();

// --- Rectangles for viewport / simulation window -------------------------

/**
 * Camera viewport in world units, written into `out`.
 * @param {Camera} cam
 * @param {Rect} out
 * @returns {Rect} `out`
 */
export function viewRect(cam, out) {
  out.x0 = cam.x - cam.w / 2;
  out.x1 = cam.x + cam.w / 2;
  out.y0 = cam.y - cam.h / 2;
  out.y1 = cam.y + cam.h / 2;
  return out;
}

/**
 * Simulation window (viewport plus margins), written into `out`.
 * @param {Camera} cam
 * @param {Rect} out
 * @returns {Rect} `out`
 */
export function windowRect(cam, out) {
  viewRect(cam, out);
  out.x0 -= CONFIG.WINDOW_MARGIN_X;
  out.x1 += CONFIG.WINDOW_MARGIN_X;
  out.y0 -= CONFIG.WINDOW_MARGIN_Y;
  out.y1 += CONFIG.WINDOW_MARGIN_Y;
  return out;
}

/**
 * Whether box (ax0, ay0)-(ax1, ay1) overlaps rect `r`.
 * @param {number} ax0
 * @param {number} ay0
 * @param {number} ax1
 * @param {number} ay1
 * @param {Rect} r
 * @returns {boolean}
 */
const overlaps = (ax0, ay0, ax1, ay1, r) => ax1 > r.x0 && ax0 < r.x1 && ay1 > r.y0 && ay0 < r.y1;

// --- World state -----------------------------------------------------------

/** @returns {World} empty pools; call resetWorld before use */
export function createWorld() {
  /** @type {Cloud[]} */
  const clouds = [];
  for (let i = 0; i < CONFIG.CLOUD_POOL; i++) {
    clouds.push({ active: false, x0: 0, y0: 0, vx: 0, vy: 0, t0: 0, w: 0, h: 0, seed: 0 });
  }
  /** @type {Coin[]} */
  const coins = [];
  for (let i = 0; i < CONFIG.COIN_POOL; i++) {
    coins.push({ active: false, x: 0, y: 0, t0: 0 });
  }
  return {
    clouds,
    coins,
    cloudCount: 0,
    coinCount: 0,
    rng: makeRng(1),
    coinHazard: 0,
    coinThreshold: 1,
    coinDebt: 0,
    pickups: Array.from({ length: CONFIG.PICKUP_FX_POOL }, () => ({ x: 0, y: 0, t: -Infinity })),
    pickupNext: 0,
    view: { x0: 0, y0: 0, x1: 0, y1: 0 },
    win: { x0: 0, y0: 0, x1: 0, y1: 0 },
  };
}

/**
 * @param {Cloud} c
 * @param {number} t game time, s
 * @returns {number} left edge at time t
 */
export function cloudX(c, t) {
  return c.x0 + c.vx * (t - c.t0);
}

/**
 * @param {Cloud} c
 * @param {number} t game time, s
 * @returns {number} top edge of the visual box at time t
 */
export function cloudY(c, t) {
  return c.y0 + c.vy * (t - c.t0);
}

/**
 * @param {Cloud} c
 * @param {number} t game time, s
 * @returns {number} top of the bounce band at time t
 */
export function bandTop(c, t) {
  return cloudY(c, t) + c.h * CONFIG.CLOUD_BAND_TOP;
}

/**
 * @param {Cloud} c
 * @param {number} t game time, s
 * @returns {number} bottom of the bounce band at time t
 */
export function bandBottom(c, t) {
  return cloudY(c, t) + c.h * CONFIG.CLOUD_BAND_BOTTOM;
}

const REF_WINDOW_AREA =
  (CONFIG.REF_VIEW_W + 2 * CONFIG.WINDOW_MARGIN_X) * (CONFIG.REF_VIEW_H + 2 * CONFIG.WINDOW_MARGIN_Y);

/**
 * How many reference windows fit in this one; targets scale by it.
 * @param {Camera} cam
 * @returns {number}
 */
export const areaScale = (cam) =>
  ((cam.w + 2 * CONFIG.WINDOW_MARGIN_X) * (cam.h + 2 * CONFIG.WINDOW_MARGIN_Y)) / REF_WINDOW_AREA;

/**
 * @param {number} alt
 * @param {number} scale from areaScale
 * @returns {number} desired active clouds, capped at the pool size
 */
export const cloudTarget = (alt, scale) =>
  Math.min(CONFIG.CLOUD_POOL, Math.round(scale * lerp(CONFIG.CLOUD_TARGET_LOW, CONFIG.CLOUD_TARGET_HIGH, altFrac(alt))));

/**
 * @param {number} alt
 * @param {number} scale from areaScale
 * @returns {number} desired active coins, capped at the pool size
 */
export const coinTarget = (alt, scale) =>
  Math.min(CONFIG.COIN_POOL, Math.round(scale * lerp(CONFIG.COIN_TARGET_LOW, CONFIG.COIN_TARGET_HIGH, altFrac(alt))));
/**
 * @param {number} alt
 * @param {number} scale from areaScale (a bigger window refills proportionally faster)
 * @returns {number} coin spawn events per second while below target
 */
export const coinRho = (alt, scale) => scale * lerp(CONFIG.COIN_RHO_LOW, CONFIG.COIN_RHO_HIGH, altFrac(alt));

const cloudBandTop = CONFIG.GROUND_Y - CONFIG.CLOUD_MAX_ALT;
const cloudBandBottom = CONFIG.GROUND_Y - CONFIG.CLOUD_MIN_ALT;

/**
 * Try to place one cloud in the window. If `offscreenOnly`, it must start
 * fully outside the viewport (plus a margin). It drifts horizontally toward Dan.
 * Uses `world.win` / `world.view`, which the caller must have refreshed.
 * @param {World} world
 * @param {Cloud} c inactive slot to fill
 * @param {number} t game time, s (becomes the cloud's t0)
 * @param {number} danX
 * @param {boolean} offscreenOnly
 * @param {Rect | null} avoid optional area the cloud must not overlap
 * @returns {boolean} whether a cloud was placed
 */
function spawnCloud(world, c, t, danX, offscreenOnly, avoid) {
  const { rng, win, view } = world;
  const m = CONFIG.CLOUD_MIN_OFFSCREEN;
  const yLo = Math.max(win.y0, cloudBandTop);
  const yHi = Math.min(win.y1, cloudBandBottom);
  if (yHi <= yLo) return false;

  for (let tries = 0; tries < CONFIG.CLOUD_SPAWN_TRIES; tries++) {
    const w = range(rng, CONFIG.CLOUD_W_MIN, CONFIG.CLOUD_W_MAX);
    const h = w * CONFIG.CLOUD_H_RATIO;
    const x = range(rng, win.x0, win.x1 - w);
    const y = range(rng, yLo, yHi);
    if (offscreenOnly && overlaps(x - m, y - m, x + w + m, y + h + m, view)) continue;
    if (avoid && overlaps(x, y, x + w, y + h, avoid)) continue;

    const speed = range(rng, CONFIG.CLOUD_SPEED_MIN, CONFIG.CLOUD_SPEED_MAX);
    c.active = true;
    c.x0 = x;
    c.y0 = y;
    c.vx = x + w / 2 < danX ? speed : -speed;
    c.vy = range(rng, -CONFIG.CLOUD_VY_MAX, CONFIG.CLOUD_VY_MAX);
    c.t0 = t;
    c.w = w;
    c.h = h;
    c.seed = (rng() * 4294967296) >>> 0;
    world.cloudCount++;
    return true;
  }
  return false;
}

/**
 * Fresh run: clear pools and fill the window to the cloud target. This runs
 * before anything is drawn, so clouds may start inside the viewport, except
 * right around Dan.
 * @param {World} world
 * @param {number} seed
 * @param {Camera} cam
 * @param {{ x: number, y: number }} dan Dan's feet position
 */
export function resetWorld(world, seed, cam, dan) {
  world.rng = makeRng(seed);
  for (const c of world.clouds) c.active = false;
  for (const k of world.coins) k.active = false;
  world.cloudCount = 0;
  world.coinCount = 0;
  for (const p of world.pickups) p.t = -Infinity;
  world.coinHazard = 0;
  world.coinThreshold = -Math.log(1 - world.rng());
  world.coinDebt = 0;

  windowRect(cam, world.win);
  viewRect(cam, world.view);
  /** @type {Rect} */
  const avoid = { x0: dan.x - 80, x1: dan.x + 80, y0: dan.y - 120, y1: dan.y + 40 };
  const target = cloudTarget(CONFIG.GROUND_Y - dan.y, areaScale(cam));
  for (const c of world.clouds) {
    if (world.cloudCount >= target) break;
    spawnCloud(world, c, 0, dan.x, false, avoid);
  }
  // Coins at their target density across the whole window (not near Dan).
  const coins = coinTarget(CONFIG.GROUND_Y - dan.y, areaScale(cam));
  for (let n = 0; n < CONFIG.COIN_POOL && world.coinCount < coins; n++) {
    if (!spawnCoin(world, -1, dan, false)) break;
  }
}

/**
 * Per simulation step: retire clouds that left the window, refill off-screen
 * toward the altitude target, and trim excess off-screen when the target drops.
 * Also refreshes `world.win` / `world.view` for the coin spawner.
 * @param {World} world
 * @param {number} t game time at the end of this step, s
 * @param {Camera} cam
 * @param {number} danX
 * @param {number} alt Dan's altitude
 */
export function updateClouds(world, t, cam, danX, alt) {
  const win = windowRect(cam, world.win);
  const view = viewRect(cam, world.view);
  const target = cloudTarget(alt, areaScale(cam));
  let trimmed = false;

  for (const c of world.clouds) {
    if (!c.active) continue;
    const x = cloudX(c, t);
    const y = cloudY(c, t);
    if (!overlaps(x, y, x + c.w, y + c.h, win)) {
      c.active = false;
      world.cloudCount--;
    } else if (!trimmed && world.cloudCount > target && !overlaps(x, y, x + c.w, y + c.h, view)) {
      c.active = false; // retire at most one hidden cloud per step
      world.cloudCount--;
      trimmed = true;
    }
  }

  // Refill at most a couple per step to spread the work.
  let spawned = 0;
  for (const c of world.clouds) {
    if (world.cloudCount >= target || spawned >= 2) break;
    if (!c.active && spawnCloud(world, c, t, danX, true, null)) spawned++;
  }
}

// --- Coins -----------------------------------------------------------------

/**
 * Record a pickup for the sparkle burst, overwriting the oldest slot.
 * @param {World} world
 * @param {number} x
 * @param {number} y
 * @param {number} t game time, s
 */
export function recordPickup(world, x, y, t) {
  const p = world.pickups[world.pickupNext];
  p.x = x;
  p.y = y;
  p.t = t;
  world.pickupNext = (world.pickupNext + 1) % world.pickups.length;
}

/**
 * Place one coin somewhere in the simulation window within the cloud band.
 * With `offscreenOnly`, it must be outside the camera viewport (so coins never
 * pop into view; new areas are already populated as the window moves).
 * Never on top of Dan.
 * @param {World} world uses world.win / world.view (refreshed by updateClouds)
 * @param {number} t game time, s
 * @param {{ x: number, y: number }} dan Dan's feet position
 * @param {boolean} offscreenOnly
 * @returns {boolean} whether a coin was placed
 */
function spawnCoin(world, t, dan, offscreenOnly) {
  const { rng, win, view } = world;
  /** @type {Coin | null} */
  let slot = null;
  for (const k of world.coins) {
    if (!k.active) {
      slot = k;
      break;
    }
  }
  if (!slot) return false;

  const r = CONFIG.COIN_RADIUS;
  const m = CONFIG.CLOUD_MIN_OFFSCREEN;
  const yLo = Math.max(win.y0, cloudBandTop);
  const yHi = Math.min(win.y1, cloudBandBottom);
  if (yHi <= yLo) return false;
  const danCy = dan.y - CONFIG.DAN_H / 2;
  for (let tries = 0; tries < 8; tries++) {
    const x = range(rng, win.x0 + r, win.x1 - r);
    const y = range(rng, yLo, yHi);
    if (offscreenOnly && overlaps(x - r - m, y - r - m, x + r + m, y + r + m, view)) continue;
    const dx = x - dan.x;
    const dy = y - danCy;
    if (dx * dx + dy * dy < CONFIG.COIN_MIN_DIST * CONFIG.COIN_MIN_DIST) continue;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.t0 = t;
    world.coinCount++;
    return true;
  }
  return false;
}

/**
 * A coin was collected: its replacement waits for the randomized respawn
 * timer instead of appearing immediately.
 * @param {World} world
 */
export function coinCollected(world) {
  world.coinDebt++;
}

/**
 * Keep coins at a target density over the whole simulation window, like
 * clouds, so areas Dan moves into already have coins:
 * - coins that leave the window are retired and replaced at once, off-screen;
 * - collected coins are replaced only after a randomized wait: each pickup adds
 *   one "debt", and the hazard process (rate rho(alt)) pays it back one coin
 *   at a time. Replacements also spawn off-screen.
 * Call after updateClouds (uses world.win / world.view).
 * @param {World} world
 * @param {number} t game time at the end of this step, s
 * @param {number} dt step length, s
 * @param {Camera} cam
 * @param {{ x: number, y: number }} dan Dan's feet position
 * @param {number} alt Dan's altitude
 */
export function updateCoins(world, t, dt, cam, dan, alt) {
  const { win } = world;
  for (const k of world.coins) {
    if (k.active && (k.x < win.x0 || k.x > win.x1 || k.y < win.y0 || k.y > win.y1)) {
      k.active = false;
      world.coinCount--;
    }
  }
  const scale = areaScale(cam);
  const target = coinTarget(alt, scale);
  if (world.coinDebt > target) world.coinDebt = target;

  // Pay back pickup debt on the randomized timer.
  if (world.coinDebt > 0) {
    world.coinHazard += coinRho(alt, scale) * dt;
    if (world.coinHazard >= world.coinThreshold) {
      world.coinHazard = 0;
      world.coinThreshold = -Math.log(1 - world.rng());
      world.coinDebt--;
    }
  }

  // Fill up to target minus outstanding debt, off-screen, a few per step.
  const want = target - world.coinDebt;
  for (let n = 0; n < 3 && world.coinCount < want; n++) {
    if (!spawnCoin(world, t, dan, true)) break;
  }
  // Too many (target dropped, e.g. climbing): retire one off-screen coin per step.
  if (world.coinCount > target) {
    for (const k of world.coins) {
      if (k.active && !overlaps(k.x, k.y, k.x, k.y, world.view)) {
        k.active = false;
        world.coinCount--;
        break;
      }
    }
  }
}
