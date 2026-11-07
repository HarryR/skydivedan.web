// Keyboard and pointer state -> shared actions: steer in [-1, 1], boost bool.
import { CONFIG, clamp } from './config.js';

/**
 * Held actions, read once per simulation step.
 * @typedef {object} InputState
 * @property {number} steer -1 (full left) .. 1 (full right)
 * @property {boolean} boost fart requested (simulation also checks balance)
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
 * A held pointer. Steering uses the offset from where it went down.
 * @typedef {object} PointerHold
 * @property {number} startX joystick origin, CSS px: clientX at pointerdown, then dragged along to stay within full steer of the finger
 * @property {number} x latest clientX, CSS px
 * @property {boolean} boost began on the fart button
 */

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const BOOST = new Set(['KeyW', 'ArrowUp', 'Space']);

/**
 * @param {HTMLElement} surface element receiving game pointer input
 * @param {HTMLElement} fartButton drags starting here also boost
 * @param {InputHooks} hooks
 * @returns {Input}
 */
export function createInput(surface, fartButton, { onPauseKey, onDebugKey }) {
  /** @type {Set<string>} held KeyboardEvent.code values */
  const keys = new Set();
  /** @type {Map<number, PointerHold>} */
  const pointers = new Map();
  /** @type {number | null} most recent pointer controls steering */
  let steerPointer = null;

  /** @type {InputState} */
  const state = { steer: 0, boost: false };

  function recompute() {
    let keySteer = 0;
    for (const k of keys) {
      if (LEFT.has(k)) keySteer -= 1;
      else if (RIGHT.has(k)) keySteer += 1;
    }
    keySteer = clamp(keySteer, -1, 1);

    let touchSteer = 0;
    let touchBoost = false;
    const p = steerPointer !== null ? pointers.get(steerPointer) : undefined;
    if (p) {
      const off = p.x - p.startX;
      const dz = CONFIG.TOUCH_DEADZONE_PX;
      const live = Math.abs(off) <= dz ? 0 : off - Math.sign(off) * dz;
      touchSteer = clamp(live / (CONFIG.TOUCH_FULL_STEER_PX - dz), -1, 1);
    }
    for (const q of pointers.values()) if (q.boost) touchBoost = true;

    let keyBoost = false;
    for (const k of keys) if (BOOST.has(k)) keyBoost = true;

    state.steer = clamp(keySteer + touchSteer, -1, 1);
    state.boost = keyBoost || touchBoost;
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
    // Let DOM buttons other than the fart button handle their own clicks.
    const onFart = fartButton.contains(target);
    if (!onFart && target.closest('button')) return;
    surface.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { startX: e.clientX, x: e.clientX, boost: onFart });
    steerPointer = e.pointerId;
    if (onFart) fartButton.classList.add('held');
    recompute();
    e.preventDefault();
  });
  surface.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    // Drag the joystick origin along behind the finger: it never trails more
    // than full steer, so turning back the other way responds at once.
    const maxOff = CONFIG.TOUCH_FULL_STEER_PX * CONFIG.TOUCH_ORIGIN_TRAIL;
    if (p.x - p.startX > maxOff) p.startX = p.x - maxOff;
    else if (p.startX - p.x > maxOff) p.startX = p.x + maxOff;
    recompute();
  });

  /** @param {PointerEvent} e */
  const end = (e) => {
    if (!pointers.delete(e.pointerId)) return;
    if (steerPointer === e.pointerId) {
      steerPointer = null;
      for (const id of pointers.keys()) steerPointer = id; // fall back to another held pointer
    }
    let anyBoost = false;
    for (const q of pointers.values()) if (q.boost) anyBoost = true;
    if (!anyBoost) fartButton.classList.remove('held');
    recompute();
  };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);

  /** Clear held inputs (used on pause, blur, and run start). */
  function reset() {
    keys.clear();
    pointers.clear();
    steerPointer = null;
    fartButton.classList.remove('held');
    recompute();
  }

  return { state, reset };
}
