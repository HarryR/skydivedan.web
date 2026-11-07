// Boot and animation scheduling: rAF-paced rendering with a fixed-step
// simulation accumulator (SIMULATION_DESIGN.md "Timing loop").
import { CONFIG, clamp, layoutFor } from './config.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { createUI } from './ui.js';
import { createGame } from './game.js';

/** @typedef {import('./game.js').Game} Game */

const stage = /** @type {HTMLElement} */ (document.getElementById('stage'));
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('view'));

// Keep the semantic title readable if the optional logo asset is unavailable.
const titleLogo = /** @type {HTMLImageElement | null} */ (document.getElementById('title-logo'));
const titleFallback = document.getElementById('title-fallback');
titleLogo?.addEventListener('error', () => {
  titleLogo.hidden = true;
  if (titleFallback) titleFallback.hidden = false;
}, { once: true });

// UI and input are created first; their handlers forward to the game.
/** @type {Game} */
let game;
const ui = createUI(stage, {
  onBegin: () => game.onBegin(),
  onRestart: () => game.onRestart(),
  onPause: () => game.onPause(),
  onResume: () => game.onResume(),
});
const input = createInput(stage, ui.fartBtn, {
  onPauseKey: () => game.togglePause(),
  onDebugKey: () => game.toggleDebug(),
});
const renderer = createRenderer(canvas);
game = createGame({ input, ui, renderer });
if (new URLSearchParams(location.search).has('debug')) game.toggleDebug();

// Size the stage to the window (square on landscape, portrait on phones) and
// tell the game how much world to show. The canvas backing store follows the
// stage via the renderer's ResizeObserver, so 4K / high-DPR stays sharp.
function layout() {
  const vv = window.visualViewport;
  const l = layoutFor(vv ? vv.width : window.innerWidth, vv ? vv.height : window.innerHeight);
  stage.style.width = `${l.cssW}px`;
  stage.style.height = `${l.cssH}px`;
  // UI is sized in em: 16px at a 640px-tall stage, scaled with the stage.
  stage.style.fontSize = `${clamp((l.cssH / 640) * 16, 13, 48)}px`;
  game.setView(l.viewW, l.viewH);
}
window.addEventListener('resize', layout);
window.visualViewport?.addEventListener('resize', layout);
layout();

const DT = 1 / CONFIG.SIM_HZ;
/** @type {number | null} */
let lastFrameMs = null;
let accumulator = 0;

/** @param {DOMHighResTimeStamp} nowMs */
function frame(nowMs) {
  if (game.consumeClockReset()) {
    lastFrameMs = null;
    accumulator = 0;
  }
  if (lastFrameMs === null) lastFrameMs = nowMs;
  const elapsed = (nowMs - lastFrameMs) / 1000;
  lastFrameMs = nowMs;

  if (game.simulating()) {
    accumulator += elapsed;
    let steps = 0;
    while (accumulator >= DT && steps < CONFIG.MAX_CATCHUP_STEPS) {
      game.step(DT);
      accumulator -= DT;
      steps++;
    }
    if (accumulator >= DT) accumulator %= DT; // drop excess backlog after a hitch
  } else {
    accumulator = 0;
  }

  game.render(accumulator);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
