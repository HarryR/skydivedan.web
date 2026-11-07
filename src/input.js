// Keyboard and pointer state -> shared actions: steer in [-1, 1] and a fart
// throttle in [0, 1].
//
// Touch: a visible joystick at the bottom centre. Its knob follows the thumb
// relative to the stick's centre: sideways steers; pushing up past
// STICK_FART_THRESHOLD farts, proportionally up to full throttle at the top.
// Swiping anywhere else still steers (floating, horizontal only) but never
// farts. Keyboard: arrows / A D steer, W ↑ Space fart at full throttle.
import { CONFIG, clamp } from './config.js';

/**
 * Held actions, read once per simulation step.
 * @typedef {object} InputState
 * @property {number} steer -1 (full left) .. 1 (full right)
 * @property {number} boost fart throttle 0..1 (simulation also checks balance)
 */

/**
 * @typedef {object} Input
 * @property {InputState} state live action state (mutated in place)
 * @property {() => void} reset clear all held keys and pointers
 */

/**
 * @typedef {object} InputHooks
 * @property {() => void} onPauseKey Escape or P
 * @property {() => void} onDebugKey backquote
 */

/**
 * A held pointer.
 * @typedef {object} PointerHold
 * @property {boolean} stick started on the joystick (2D, can fart)
 * @property {number} startX swipe origin, CSS px: clientX at pointerdown, then dragged along to stay within full steer of the finger (swipes only)
 * @property {number} x latest clientX, CSS px
 * @property {number} y latest clientY, CSS px
 * @property {number} cx joystick centre x at pointerdown, CSS px (stick only)
 * @property {number} cy joystick centre y at pointerdown, CSS px (stick only)
 * @property {number} r joystick full-deflection radius, CSS px (stick only)
 */

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const BOOST = new Set(['KeyW', 'ArrowUp', 'Space']);

/**
 * @param {HTMLElement} surface element receiving game pointer input
 * @param {HTMLElement} stick the joystick; contains an element with class "stick-knob"
 * @param {InputHooks} hooks
 * @returns {Input}
 */
export function createInput(surface, stick, { onPauseKey, onDebugKey }) {
  const knob = /** @type {HTMLElement} */ (stick.querySelector('.stick-knob'));
  /** @type {Set<string>} held KeyboardEvent.code values */
  const keys = new Set();
  /** @type {Map<number, PointerHold>} */
  const pointers = new Map();
  /** @type {number | null} most recent pointer controls steering */
  let steerPointer = null;

  /** @type {InputState} */
  const state = { steer: 0, boost: 0 };

  /**
   * Joystick deflection for a stick pointer, each axis -1..1 (up positive),
   * clamped to the unit circle.
   * @param {PointerHold} p
   * @returns {{ sx: number, sy: number }}
   */
  function deflection(p) {
    let sx = (p.x - p.cx) / p.r;
    let sy = (p.cy - p.y) / p.r;
    const len = Math.hypot(sx, sy);
    if (len > 1) {
      sx /= len;
      sy /= len;
    }
    return { sx, sy };
  }

  function recompute() {
    let keySteer = 0;
    for (const k of keys) {
      if (LEFT.has(k)) keySteer -= 1;
      else if (RIGHT.has(k)) keySteer += 1;
    }
    keySteer = clamp(keySteer, -1, 1);

    let touchSteer = 0;
    let stickBoost = 0;
    let knobX = 0;
    let knobY = 0;
    const p = steerPointer !== null ? pointers.get(steerPointer) : undefined;
    if (p && !p.stick) {
      const off = p.x - p.startX;
      const dz = CONFIG.TOUCH_DEADZONE_PX;
      const live = Math.abs(off) <= dz ? 0 : off - Math.sign(off) * dz;
      touchSteer = clamp(live / (CONFIG.TOUCH_FULL_STEER_PX - dz), -1, 1);
    }
    for (const q of pointers.values()) {
      if (!q.stick) continue;
      const { sx, sy } = deflection(q);
      const dz = CONFIG.STICK_DEADZONE;
      if (q === p || touchSteer === 0) touchSteer = Math.abs(sx) <= dz ? 0 : (sx - Math.sign(sx) * dz) / (1 - dz);
      const th = CONFIG.STICK_FART_THRESHOLD;
      stickBoost = Math.max(stickBoost, clamp((sy - th) / (1 - th), 0, 1));
      knobX = sx * q.r;
      knobY = -sy * q.r;
    }

    let keyBoost = 0;
    for (const k of keys) if (BOOST.has(k)) keyBoost = 1;

    state.steer = clamp(keySteer + touchSteer, -1, 1);
    state.boost = Math.max(keyBoost, stickBoost);

    knob.style.transform = `translate(${knobX}px, ${knobY}px)`;
    stick.classList.toggle('boosting', stickBoost > 0);
    stick.style.setProperty('--throttle', String(stickBoost));
  }

  window.addEventListener('keydown', (e) => {
    // Toggles act on the initial press only; key-repeat would flip them back.
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (!e.repeat) onPauseKey();
      e.preventDefault();
      return;
    }
    if (e.code === 'Backquote') {
      if (!e.repeat) onDebugKey();
      return;
    }
    if (LEFT.has(e.code) || RIGHT.has(e.code) || BOOST.has(e.code)) {
      keys.add(e.code);
      recompute();
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (keys.delete(e.code)) recompute();
  });
  window.addEventListener('blur', () => reset());

  surface.addEventListener('pointerdown', (e) => {
    const target = /** @type {Element} */ (e.target);
    // Let DOM buttons handle their own clicks.
    if (target.closest('button')) return;
    const onStick = stick.contains(target);
    try {
      surface.setPointerCapture(e.pointerId);
    } catch {
      /* not an active pointer (synthetic event); moves still arrive via the surface */
    }
    /** @type {PointerHold} */
    const hold = { stick: onStick, startX: e.clientX, x: e.clientX, y: e.clientY, cx: 0, cy: 0, r: 1 };
    if (onStick) {
      const rect = stick.getBoundingClientRect();
      hold.cx = rect.left + rect.width / 2;
      hold.cy = rect.top + rect.height / 2;
      hold.r = (rect.width / 2) * CONFIG.STICK_RANGE;
      stick.classList.add('held');
    }
    pointers.set(e.pointerId, hold);
    steerPointer = e.pointerId;
    recompute();
    e.preventDefault();
  });
  surface.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (!p.stick) {
      // Swipe: drag the origin along behind the finger: it never trails more
      // than full steer, so turning back the other way responds at once.
      const maxOff = CONFIG.TOUCH_FULL_STEER_PX * CONFIG.TOUCH_ORIGIN_TRAIL;
      if (p.x - p.startX > maxOff) p.startX = p.x - maxOff;
      else if (p.startX - p.x > maxOff) p.startX = p.x + maxOff;
    }
    recompute();
  });

  /** @param {PointerEvent} e */
  const end = (e) => {
    if (!pointers.delete(e.pointerId)) return;
    if (steerPointer === e.pointerId) {
      steerPointer = null;
      for (const id of pointers.keys()) steerPointer = id; // fall back to another held pointer
    }
    let anyStick = false;
    for (const q of pointers.values()) if (q.stick) anyStick = true;
    if (!anyStick) stick.classList.remove('held');
    recompute();
  };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);

  /** Clear held inputs (used on pause, blur, and run start). */
  function reset() {
    keys.clear();
    pointers.clear();
    steerPointer = null;
    stick.classList.remove('held');
    recompute();
  }

  return { state, reset };
}
