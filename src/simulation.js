// Fixed-step player physics, cloud landing, coin pickup, fart boost, ground.
// Step order follows SIMULATION_DESIGN.md "One simulation step".
import { CONFIG, lerp, clamp, altFrac } from './config.js';
import { createWorld, resetWorld, updateClouds, updateCoins, cloudX, bandTop, bandBottom, recordPickup } from './world.js';

/** @typedef {import('./world.js').World} World */
/** @typedef {import('./world.js').Camera} Camera */
/** @typedef {import('./world.js').Cloud} Cloud */
/** @typedef {import('./input.js').InputState} InputState */

/**
 * Dan's physics state. (x, y) is the feet point: x is the horizontal centre,
 * y the bottom of his collider. The collider spans DAN_W × DAN_H above it.
 * @typedef {object} Dan
 * @property {number} x
 * @property {number} y
 * @property {number} vx units/s
 * @property {number} vy units/s, positive = falling
 * @property {number} prevX x at the start of the last step
 * @property {number} prevY y at the start of the last step
 * @property {boolean} boosting fart active during the last step
 * @property {number} landedAt game time of the last cloud bounce (either direction), or -1
 */

/**
 * Everything that belongs to one run.
 * @typedef {object} Run
 * @property {Dan} dan
 * @property {Camera} cam
 * @property {World} world
 * @property {number} balance coins = score = fart fuel (fractional while draining; display floors it)
 * @property {boolean} landed hit the ground during the last step
 * @property {number} candidates debug: clouds that passed the cheap reject last step
 */

/** @returns {Run} */
export function createRun() {
  return {
    dan: { x: 0, y: 0, vx: 0, vy: 0, prevX: 0, prevY: 0, boosting: false, landedAt: -1 },
    cam: { x: 0, y: 0, w: CONFIG.REF_VIEW_W, h: CONFIG.REF_VIEW_H },
    world: createWorld(),
    balance: 0,
    landed: false,
    candidates: 0,
  };
}

/**
 * Put Dan at the start altitude and repopulate the world.
 * @param {Run} run
 * @param {number} seed 32-bit run seed
 */
export function resetRun(run, seed) {
  const d = run.dan;
  d.x = 0;
  d.y = CONFIG.GROUND_Y - CONFIG.START_ALT;
  d.vx = 0;
  d.vy = 0;
  d.prevX = d.x;
  d.prevY = d.y;
  d.boosting = false;
  d.landedAt = -1;
  run.cam.x = d.x;
  run.cam.y = d.y + CONFIG.CAMERA_LEAD_Y;
  run.balance = 0;
  run.landed = false;
  resetWorld(run.world, seed, run.cam, d);
}

/**
 * Set the visible world size (from the screen layout). Takes effect on the
 * next step and frame; the camera centre is unchanged.
 * @param {Run} run
 * @param {number} w
 * @param {number} h
 */
export function setView(run, w, h) {
  run.cam.w = w;
  run.cam.h = h;
}

/** @param {Run} run @returns {number} Dan's altitude above ground */
export const altitudeOf = (run) => CONFIG.GROUND_Y - run.dan.y;

/**
 * One fixed step from game time t to t + dt.
 * @param {Run} run
 * @param {InputState} input
 * @param {number} dt step length, s
 * @param {number} t game time at the start of the step, s
 */
export function simulateStep(run, input, dt, t) {
  const d = run.dan;
  const world = run.world;
  const alt = CONFIG.GROUND_Y - d.y;
  const a = altFrac(alt);
  const t1 = t + dt;

  // 1. Input -> 3. forces
  d.prevX = d.x;
  d.prevY = d.y;

  const steer = input.steer;
  if (steer !== 0) {
    d.vx += steer * CONFIG.STEER_ACCEL * dt;
  } else {
    const f = CONFIG.STEER_FRICTION * dt;
    d.vx = Math.abs(d.vx) <= f ? 0 : d.vx - Math.sign(d.vx) * f;
  }
  d.vx = clamp(d.vx, -CONFIG.MAX_SPEED_X, CONFIG.MAX_SPEED_X);

  const gravity = lerp(CONFIG.GRAVITY_LOW, CONFIG.GRAVITY_HIGH, a);
  d.vy += gravity * dt;

  d.boosting = input.boost && run.balance > 0;
  if (d.boosting) {
    const liftScale = clamp(run.balance / CONFIG.FART_FULL_LIFT_BALANCE, 0, 1);
    d.vy -= CONFIG.FART_ACCEL * liftScale * dt;
    if (d.vy < -CONFIG.FART_MAX_RISE_SPEED) d.vy = -CONFIG.FART_MAX_RISE_SPEED;
    run.balance = Math.max(0, run.balance - CONFIG.FART_DRAIN_PER_S * dt);
  }
  if (d.vy > CONFIG.MAX_FALL_SPEED) d.vy = CONFIG.MAX_FALL_SPEED;

  // 4. Proposed position
  d.x += d.vx * dt;
  d.y += d.vy * dt;

  // 5. Cloud population at this step's end time
  updateClouds(world, t1, run.cam, d.x, alt);

  // 6. Cloud bounce. Each cloud has a bounce band: its full width and the
  // middle 3/5 of its height. Dan bounces when his feet ENTER the band during
  // this step, from either side (band edges evaluated at t and t1, so a
  // drifting cloud is handled), with horizontal overlap at t1:
  //  - from above (falling in through the band top): feet are placed on the
  //    band top and Dan is launched at the bounce speed;
  //  - from below (rising in through the band bottom): Dan keeps his position
  //    and his upward speed is topped up to the bounce speed, so rising
  //    through stacked clouds chains bounces.
  // Feet already inside a band never re-trigger, so the cloud Dan just
  // bounced on can't fire again until he leaves it. Nearest entry wins.
  run.candidates = 0;
  const halfW = CONFIG.DAN_W / 2;
  const sweepLo = Math.min(d.prevY, d.y);
  const sweepHi = Math.max(d.prevY, d.y);
  /** @type {Cloud | null} */
  let best = null;
  let bestGap = Infinity;
  let bestFromAbove = false;
  for (const c of world.clouds) {
    if (!c.active) continue;
    const top1 = bandTop(c, t1);
    const bot1 = bandBottom(c, t1);
    if (bot1 < sweepLo - 16 || top1 > sweepHi + 16) continue; // cheap reject
    run.candidates++;
    const top0 = bandTop(c, t);
    const bot0 = bandBottom(c, t);
    const fromAbove = d.prevY < top0 && d.y >= top1;
    const fromBelow = d.prevY > bot0 && d.y <= bot1;
    if (!fromAbove && !fromBelow) continue;
    const x = cloudX(c, t1);
    if (d.x + halfW <= x || d.x - halfW >= x + c.w) continue;
    const gap = fromAbove ? top0 - d.prevY : d.prevY - bot0;
    if (gap < bestGap) {
      bestGap = gap;
      best = c;
      bestFromAbove = fromAbove;
    }
  }
  if (best) {
    const bounce = -lerp(CONFIG.BOUNCE_LOW, CONFIG.BOUNCE_HIGH, a);
    if (bestFromAbove) {
      d.y = bandTop(best, t1);
      d.vy = bounce;
    } else if (d.vy > bounce) {
      d.vy = bounce;
    }
    d.landedAt = t1;
  }

  // 7. Coins: Dan's swept AABB, expanded by the coin radius, vs coin centre.
  const r = CONFIG.COIN_RADIUS;
  const bx0 = Math.min(d.prevX, d.x) - halfW - r;
  const bx1 = Math.max(d.prevX, d.x) + halfW + r;
  const by0 = Math.min(d.prevY, d.y) - CONFIG.DAN_H - r;
  const by1 = Math.max(d.prevY, d.y) + r;
  for (const k of world.coins) {
    if (!k.active) continue;
    if (k.x > bx0 && k.x < bx1 && k.y > by0 && k.y < by1) {
      k.active = false;
      world.coinCount--;
      run.balance += 1;
      recordPickup(world, k.x, k.y, t1);
    }
  }
  updateCoins(world, t1, dt, run.cam, d, CONFIG.GROUND_Y - d.y);

  // 8. Ground
  run.landed = false;
  if (d.y >= CONFIG.GROUND_Y) {
    d.y = CONFIG.GROUND_Y;
    d.vx = 0;
    d.vy = 0;
    run.landed = true;
  }

  // 9. Camera follows with exponential smoothing; stops descending once the
  // ground sits about 70% of the way down the screen.
  const k = 1 - Math.exp(-CONFIG.CAMERA_FOLLOW * dt);
  run.cam.x += (d.x - run.cam.x) * k;
  run.cam.y += (d.y + CONFIG.CAMERA_LEAD_Y - run.cam.y) * k;
  const maxCamY = CONFIG.GROUND_Y - run.cam.h * 0.2;
  if (run.cam.y > maxCamY) run.cam.y = maxCamY;
}
