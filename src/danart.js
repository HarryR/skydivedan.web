// Sprite-rigged Dan: body (head + torso + backpack), one arm and one leg image,
// each reused for front and back limbs. The rig is composed every frame into
// one small reused offscreen canvas at ART_PX pixels per world unit, with
// smoothing off, so rotated limbs and the body share one crunchy pixel grid.
// That canvas is then drawn into the world, mirrored for facing.
//
// Pivots are fractions of each part's tight-cropped image (tools/crunch.py
// crops to alpha >= 128), measured from the v01 sources. Sizes are in world
// units. Dan's collider and feet anchor are unchanged: shoe soles sit on y.

/** Art pixels per world unit for the rig canvas (matches the crunched parts). */
const ART_PX = 3;

/** Rig canvas extent in world units, and where the feet point sits in it. */
const BOX_W = 48;
const BOX_H = 50;
const FEET_X = BOX_W / 2;
const FEET_Y = BOX_H - 1;

/**
 * One rig part.
 * @typedef {object} Part
 * @property {string} src shipped crunched image (relative URL)
 * @property {number} h drawn height, world units (width follows the image aspect)
 * @property {HTMLImageElement | null} img set once loaded
 */

/** @type {{ body: Part, arm: Part, leg: Part }} */
const PARTS = {
  body: { src: './assets/dan-body-v01-49.png', h: 23.8, img: null },
  arm: { src: './assets/dan-arm-v01-52.png', h: 8.4, img: null },
  leg: { src: './assets/dan-leg-v01-24.png', h: 14.4, img: null },
};

/** Joint positions as fractions (x, y) of each part's image. */
const BODY_HIP = [0.52, 0.93];
const BODY_SHOULDER_FRONT = [0.47, 0.64];
const BODY_SHOULDER_BACK = [0.62, 0.6];
const ARM_SHOULDER = [0.13, 0.6];
const LEG_HIP = [0.35, 0.12];
/** The arm image's own shoulder→hand direction, radians (y down). */
const ARM_NATIVE = Math.atan2(-0.35 * 534, 0.75 * 1112);

/** Back limbs are drawn darker so front and back read apart. */
const BACK_SHADE = 'rgba(20, 24, 60, 0.35)';

/**
 * Pose for one frame. Angles are radians in canvas space (0 = right, y down),
 * for Dan facing right.
 * @typedef {object} DanPose
 * @property {number} armFront direction the front arm points
 * @property {number} armBack direction the back arm points
 * @property {number} legFront rotation of the front leg from hanging straight
 * @property {number} legBack rotation of the back leg
 */

let loaded = 0;
const total = Object.keys(PARTS).length;
let failed = false;

/** @type {HTMLCanvasElement | null} */
let rig = null;
/** @type {CanvasRenderingContext2D | null} */
let rctx = null;

/** Start loading the part images (call once at boot). */
export function loadDanArt() {
  for (const part of Object.values(PARTS)) {
    const img = new Image();
    img.onload = () => {
      part.img = img;
      loaded++;
    };
    img.onerror = () => {
      failed = true;
    };
    img.src = part.src;
  }
  rig = document.createElement('canvas');
  rig.width = BOX_W * ART_PX;
  rig.height = BOX_H * ART_PX;
  rctx = /** @type {CanvasRenderingContext2D} */ (rig.getContext('2d'));
}

/** @returns {boolean} all parts loaded; otherwise the caller draws the procedural fallback */
export const danArtReady = () => !failed && loaded === total && rctx !== null;

/**
 * Pose from gameplay state, matching the procedural Dan: arms flail up while
 * falling and sweep down/back while rising; legs spread a little when falling.
 * @param {number} vy vertical velocity, + = falling
 * @param {number} t display game time, s
 * @param {DanPose} out
 * @returns {DanPose}
 */
export function poseFor(vy, t, out) {
  const falling = vy > 0;
  const flail = Math.sin(t * (falling ? 18 : 8)) * (falling ? 0.35 : 0.15);
  if (falling) {
    out.armFront = -0.55 + flail; // forward and up, clear of the face
    out.armBack = -2.45 - flail; // up and back
    out.legFront = -0.25;
    out.legBack = 0.3;
  } else {
    out.armFront = 0.75 + flail; // down and forward
    out.armBack = 2.3 - flail; // down and back
    out.legFront = -0.08;
    out.legBack = 0.12;
  }
  return out;
}

/**
 * Draw one part rotated about its pivot, with the pivot placed at (px, py)
 * in rig pixels.
 * @param {CanvasRenderingContext2D} c
 * @param {Part} part
 * @param {number[]} pivot fraction of the image
 * @param {number} px
 * @param {number} py
 * @param {number} angle radians
 * @param {boolean} back darken (back limb)
 */
function drawPart(c, part, pivot, px, py, angle, back) {
  const img = /** @type {HTMLImageElement} */ (part.img);
  const h = part.h * ART_PX;
  const w = (img.naturalWidth / img.naturalHeight) * h;
  c.save();
  c.translate(px, py);
  c.rotate(angle);
  c.drawImage(img, -pivot[0] * w, -pivot[1] * h, w, h);
  if (back) {
    // Darken only this part's pixels.
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = BACK_SHADE;
    c.fillRect(-pivot[0] * w, -pivot[1] * h, w, h);
  }
  c.restore();
}

/**
 * Compose the rig for this pose into the offscreen canvas.
 * @param {DanPose} pose
 */
function compose(pose) {
  const c = /** @type {CanvasRenderingContext2D} */ (rctx);
  const cw = BOX_W * ART_PX;
  const ch = BOX_H * ART_PX;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cw, ch);
  c.imageSmoothingEnabled = false;

  const body = /** @type {HTMLImageElement} */ (PARTS.body.img);
  const bh = PARTS.body.h * ART_PX;
  const bw = (body.naturalWidth / body.naturalHeight) * bh;
  const lh = PARTS.leg.h * ART_PX;

  // Hip sits so that a straight-hanging leg's sole touches the feet point.
  const hipX = FEET_X * ART_PX;
  const hipY = FEET_Y * ART_PX - (1 - LEG_HIP[1]) * lh;
  const bodyX = hipX - BODY_HIP[0] * bw;
  const bodyY = hipY - BODY_HIP[1] * bh;
  /** @param {number[]} f @returns {[number, number]} body-relative joint in rig px */
  const onBody = (f) => [bodyX + f[0] * bw, bodyY + f[1] * bh];
  const sb = onBody(BODY_SHOULDER_BACK);
  const sf = onBody(BODY_SHOULDER_FRONT);

  // Back to front: back arm, back leg, front leg, body, front arm. Back
  // limbs pivot a little behind the front ones.
  drawPart(c, PARTS.arm, ARM_SHOULDER, sb[0], sb[1], pose.armBack - ARM_NATIVE, true);
  drawPart(c, PARTS.leg, LEG_HIP, hipX + 2, hipY, pose.legBack, true);
  drawPart(c, PARTS.leg, LEG_HIP, hipX - 2, hipY, pose.legFront, false);
  c.drawImage(body, bodyX, bodyY, bw, bh);
  drawPart(c, PARTS.arm, ARM_SHOULDER, sf[0], sf[1], pose.armFront - ARM_NATIVE, false);
}

/**
 * Draw sprite Dan with the world transform applied. Feet at (x, y).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x feet centre, world units
 * @param {number} y feet (bottom of collider), world units
 * @param {number} facing 1 = right, -1 = left
 * @param {DanPose} pose
 * @param {number} squash 0 = normal, 1 = fully splatted (flattened onto y)
 */
export function drawDanSprite(ctx, x, y, facing, pose, squash) {
  compose(pose);
  const sx = 1 + squash * 0.6;
  const sy = 1 - squash * 0.85;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);
  ctx.scale(facing * sx, sy);
  ctx.drawImage(/** @type {HTMLCanvasElement} */ (rig), -FEET_X, -FEET_Y, BOX_W, BOX_H);
  ctx.restore();
}
