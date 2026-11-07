// All tuning values live here. World units: x right, y down, ground at y = 0,
// so altitude = GROUND_Y - y. Physics never sees CSS pixels.

/** Gameplay tuning; types are inferred from the literal values. */
export const CONFIG = {
  // Timing (see SIMULATION_DESIGN.md "Timing loop and pause behavior")
  SIM_HZ: 30,
  MAX_CATCHUP_STEPS: 5,

  // Screen layout (see layoutFor below). The stage takes the window's aspect
  // ratio clamped between tall portrait and square, letterboxed beyond that.
  ASPECT_MIN: 9 / 20, // width / height: tall phone portrait
  ASPECT_MAX: 1, // square on landscape desktop
  // Visible world height grows sublinearly with stage height (CSS px), then
  // caps; past the cap, a larger stage just draws the same world bigger.
  VIEW_REF_H: 640, // world units visible...
  VIEW_REF_CSS_H: 640, // ...when the stage is this many CSS px tall
  VIEW_GROWTH: 0.5, // exponent: 0 = fixed zoom, 1 = 1 world unit per CSS px
  VIEW_H_MIN: 560,
  VIEW_H_MAX: 900,
  // Game zoom: everything in the world draws this much bigger (the camera
  // shows 1/VIEW_ZOOM as much world). Physics and UI are unaffected.
  VIEW_ZOOM: 1.0,
  // Canvas backing-store caps (performance): devicePixelRatio and the long
  // side in device pixels.
  MAX_DPR: 2,
  MAX_BACKING_PX: 2560,

  // Simulation window = viewport expanded by these margins on each side.
  WINDOW_MARGIN_X: 320,
  WINDOW_MARGIN_Y: 480,

  // Vertical world layout (altitudes, world units above ground).
  GROUND_Y: 0,
  CLOUD_MIN_ALT: 300,
  CLOUD_MAX_ALT: 6000,
  START_ALT: 3200,

  // Dan's collider: AABB above the feet point (x = centre, y = feet).
  DAN_W: 22,
  DAN_H: 34,

  // Horizontal steering (units/s and units/s^2).
  STEER_ACCEL: 1600,
  STEER_FRICTION: 1100,
  STEER_REVERSE_BOOST: 2.2, // accel multiplier when steering against current motion
  MAX_SPEED_X: 260,

  // Vertical motion as a function of altitude fraction a in [0, 1]
  // (0 = bottom of cloud field, 1 = top). Higher up: lower gravity, stronger
  // bounce, so jumps are higher and longer.
  GRAVITY_LOW: 1400,
  GRAVITY_HIGH: 700,
  BOUNCE_LOW: 640,
  BOUNCE_HIGH: 760,
  MAX_FALL_SPEED: 720,

  // Fart boost. Lift scales with balance up to FART_FULL_LIFT_BALANCE coins,
  // flat above that, so only a nearly empty balance gives weak lift.
  FART_ACCEL: 2300,
  FART_DRAIN_PER_S: 4,
  FART_FULL_LIFT_BALANCE: 3,
  FART_MAX_RISE_SPEED: 480,

  // Cloud and coin targets below are counts for a reference simulation window
  // (the 360 × 640 view plus margins); they scale with the actual window area
  // so a larger view has the same density.
  REF_VIEW_W: 360,
  REF_VIEW_H: 640,

  // Clouds.
  CLOUD_POOL: 48,
  CLOUD_TARGET_LOW: 16,
  CLOUD_TARGET_HIGH: 7,
  CLOUD_W_MIN: 70,
  CLOUD_W_MAX: 150,
  CLOUD_SPEED_MIN: 15,
  CLOUD_SPEED_MAX: 55,
  CLOUD_VY_MAX: 6,
  CLOUD_SPAWN_TRIES: 8,
  CLOUD_MIN_OFFSCREEN: 24, // keep spawns at least this far outside the viewport
  CLOUD_H_RATIO: 0.45, // visual box height / width
  // Procedural cloud art (cloudart.js): random ovals/circles in the box.
  CLOUD_BASE3_W: 105, // clouds wider than this get 3 base ovals instead of 2
  CLOUD_BASE_RY: 0.26, // base oval vertical radius, fraction of h (+0..0.06)
  CLOUD_PUFFS_MIN: 2,
  CLOUD_PUFFS_MAX: 4,
  CLOUD_PUFF_R_MIN: 0.24, // puff radius range, fraction of h
  CLOUD_PUFF_R_MAX: 0.44,
  CLOUD_PUFF_OVAL: 0.35, // puffs up to this much wider than tall
  CLOUD_OUTLINE: 1.6, // outline thickness, world units
  CLOUD_SHADE_LIFT: 0.3, // underside shade depth, fraction of each shape's ry
  CLOUD_TOP_LIFT: 0.75, // white cap: shapes keep only their top (1 - this) of ry
  CLOUD_COLOR_OUTLINE: '#1d3c8f',
  CLOUD_COLOR_SHADE: '#a8c7f0',
  CLOUD_COLOR_BODY: '#e8f1fe',
  CLOUD_COLOR_TOP: '#ffffff',
  // Bounce band, as fractions of the cloud's visual box height from its top:
  // the middle 3/5 vertically, full width horizontally.
  CLOUD_BAND_TOP: 0.2,
  CLOUD_BAND_BOTTOM: 0.8,

  // Coins.
  COIN_POOL: 72,
  COIN_RADIUS: 11,
  COIN_TARGET_LOW: 36, // per reference window (density), not near Dan
  COIN_TARGET_HIGH: 14,
  COIN_RHO_LOW: 3, // collected coins paid back per second (randomized respawn)
  COIN_RHO_HIGH: 1,
  COIN_MIN_DIST: 90, // never spawn on top of Dan
  COIN_SPARKLE_S: 0.35,
  // Coin variety: each spawn is a big coin or a mine with these chances.
  COIN_BIG_CHANCE: 0.06,
  COIN_BIG_VALUE: 10,
  COIN_BIG_RADIUS: 17,
  MINE_CHANCE: 0.06,
  MINE_RADIUS: 13, // drawn size (body + spikes)
  MINE_HIT_RADIUS: 9, // a bit forgiving: spike tips don't count
  PICKUP_FX_S: 0.55, // coin pickup sparkle burst duration
  PICKUP_FX_POOL: 8, // concurrent pickup bursts (ring buffer)

  // Camera.
  CAMERA_FOLLOW: 8, // 1/s, exponential smoothing rate
  CAMERA_LEAD_Y: 60, // look a little below Dan

  // Game over.
  SPLAT_S: 1.2,
  BEST_KEY: 'skydivedan.best.v1',
  LANG_KEY: 'skydivedan.lang.v1',

  // Touch steering: full steer at this horizontal offset in CSS px.
  TOUCH_FULL_STEER_PX: 56,
  // Floating-joystick origin trails the finger at most this far (as a
  // fraction of full steer), so reversing direction responds immediately.
  TOUCH_ORIGIN_TRAIL: 1,
  TOUCH_DEADZONE_PX: 4,
};

/**
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 */
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Stage size in CSS px and visible world size in world units.
 * @typedef {object} Layout
 * @property {number} cssW stage width, CSS px
 * @property {number} cssH stage height, CSS px
 * @property {number} viewW visible world width
 * @property {number} viewH visible world height
 */

/**
 * Fit the stage into the window and choose how much world it shows.
 * @param {number} winW window width, CSS px
 * @param {number} winH window height, CSS px
 * @returns {Layout}
 */
export function layoutFor(winW, winH) {
  const aspect = clamp(winW / winH, CONFIG.ASPECT_MIN, CONFIG.ASPECT_MAX);
  let cssH = winH;
  let cssW = cssH * aspect;
  if (cssW > winW) {
    cssW = winW;
    cssH = cssW / aspect;
  }
  const grown = CONFIG.VIEW_REF_H * Math.pow(cssH / CONFIG.VIEW_REF_CSS_H, CONFIG.VIEW_GROWTH);
  const viewH = clamp(grown, CONFIG.VIEW_H_MIN, CONFIG.VIEW_H_MAX) / CONFIG.VIEW_ZOOM;
  return { cssW, cssH, viewW: viewH * aspect, viewH };
}

/**
 * Altitude fraction within the cloud field: 0 at CLOUD_MIN_ALT, 1 at CLOUD_MAX_ALT.
 * @param {number} alt world units above ground
 * @returns {number} in [0, 1]
 */
export function altFrac(alt) {
  return clamp((alt - CONFIG.CLOUD_MIN_ALT) / (CONFIG.CLOUD_MAX_ALT - CONFIG.CLOUD_MIN_ALT), 0, 1);
}
