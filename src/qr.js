// Share QR code: a small QR of the public game URL in the bottom-right of the
// start, pause and game-over screens. Tapping it toggles a large centred view
// for easy scanning; tapping again shrinks it back.
// The QR is a fixed image (assets/share-qr-v01-296.png, in index.html, also
// used by README.md); CSS scales it with image-rendering: pixelated.

/**
 * @typedef {object} ShareQr
 * @property {(visible: boolean) => void} setVisible show/hide; hiding also shrinks it back
 */

/**
 * Wire up the share QR button.
 * @param {HTMLButtonElement} button contains the QR <img>; toggles .full on click
 * @returns {ShareQr}
 */
export function createShareQr(button) {
  // If the image is unavailable, don't show a blank white square.
  let broken = false;
  const img = button.querySelector('img');
  const hide = () => {
    broken = true;
    button.hidden = true;
  };
  if (!img || (img.complete && img.naturalWidth === 0)) hide();
  else img.addEventListener('error', hide, { once: true });

  button.addEventListener('click', () => {
    const full = button.classList.toggle('full');
    button.setAttribute('aria-expanded', String(full));
  });
  return {
    setVisible(visible) {
      button.hidden = broken || !visible;
      if (!visible) {
        button.classList.remove('full');
        button.setAttribute('aria-expanded', 'false');
      }
    },
  };
}
