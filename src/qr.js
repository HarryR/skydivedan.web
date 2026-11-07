// Share QR code: a small QR of the current page URL in the bottom-right of the
// start, pause and game-over screens. Tapping it toggles a large centred view
// for easy scanning; tapping again shrinks it back.
// Encoder: vendored qrcode-generator (MIT, Kazuhiko Arase), src/vendor/qrcode.mjs.
import qrcode from './vendor/qrcode.mjs';

/** QR quiet zone in modules (the spec asks for 4). */
const QUIET = 4;

/**
 * URL to share: the page itself, without query (e.g. ?debug) or hash.
 * @returns {string}
 */
export function shareUrl() {
  return window.location.origin + window.location.pathname;
}

/**
 * Draw the QR for `text` into `canvas` at one canvas pixel per module; CSS
 * scales it up with image-rendering: pixelated.
 * @param {HTMLCanvasElement} canvas
 * @param {string} text
 */
function renderQr(canvas, text) {
  const qr = qrcode(0, 'M'); // 0 = smallest version that fits
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const size = n + QUIET * 2;
  canvas.width = size;
  canvas.height = size;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(c + QUIET, r + QUIET, 1, 1);
}

/**
 * @typedef {object} ShareQr
 * @property {(visible: boolean) => void} setVisible show/hide; hiding also shrinks it back
 */

/**
 * Wire up the share QR button.
 * @param {HTMLButtonElement} button contains the canvas; toggles .full on click
 * @returns {ShareQr}
 */
export function createShareQr(button) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  button.appendChild(canvas);
  try {
    renderQr(canvas, shareUrl());
  } catch {
    button.hidden = true; // URL too long or encoder failure: just don't show it
    return { setVisible() {} };
  }
  button.title = shareUrl();
  button.addEventListener('click', () => {
    const full = button.classList.toggle('full');
    button.setAttribute('aria-expanded', String(full));
  });
  return {
    setVisible(visible) {
      button.hidden = !visible;
      if (!visible) {
        button.classList.remove('full');
        button.setAttribute('aria-expanded', 'false');
      }
    },
  };
}
