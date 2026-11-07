// Boot and animation scheduling: rAF-paced rendering with a fixed-step
// simulation accumulator (SIMULATION_DESIGN.md "Timing loop").
import { CONFIG, clamp, layoutFor } from './config.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { createUI } from './ui.js';
import { createGame } from './game.js';
import { unlockAudio } from './audio.js';

/** @typedef {import('./game.js').Game} Game */

const stage = /** @type {HTMLElement} */ (document.getElementById('stage'));
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('view'));

// Logo images (title, game over) fall back to their text heading if the asset
// is unavailable: hide the <img> and show the sibling .title text. Also covers
// an image that already failed before this module ran.
for (const img of stage.querySelectorAll('img.title-logo')) {
  const logo = /** @type {HTMLImageElement} */ (img);
  const useText = () => {
    logo.hidden = true;
    const text = /** @type {HTMLElement | null} */ (logo.parentElement?.querySelector('.title') ?? null);
    if (text) text.hidden = false;
  };
  if (logo.complete && logo.naturalWidth === 0) useText();
  else logo.addEventListener('error', useText, { once: true });
}

// UI and input are created first; their handlers forward to the game.
/** @type {Game} */
let game;
const ui = createUI(stage, {
  onBegin: () => game.onBegin(),
  onRestart: () => game.onRestart(),
  onPause: () => game.onPause(),
  onResume: () => game.onResume(),
});
const input = createInput(stage, ui.stick, {
  onPauseKey: () => game.togglePause(),
  onDebugKey: () => game.toggleDebug(),
});
const renderer = createRenderer(canvas);
game = createGame({ input, ui, renderer });
if (new URLSearchParams(location.search).has('debug')) game.toggleDebug();

// No text selection or long-press menus anywhere in the game (mobile).
for (const type of ['selectstart', 'contextmenu', 'dragstart']) {
  document.addEventListener(type, (e) => e.preventDefault());
}

// Browsers only allow audio after a user gesture; unlock on the first one.
window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('keydown', unlockAudio);

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

// ?prof: live per-section draw timings (ms per frame, averaged over ~2 s) in
// a small overlay, for profiling on real devices.
/** @type {HTMLPreElement | null} */
let profOut = null;
/** @type {Record<string, number>} */
const prof = {};
let profFrames = 0;
let profDraw = 0;
let profStart = performance.now();
if (new URLSearchParams(location.search).has('prof')) {
  profOut = document.createElement('pre');
  profOut.style.cssText =
    'position:absolute;left:0.4em;top:2.2em;z-index:20;margin:0;padding:0.3em 0.5em;background:#000b;color:#9f9;font:11px/1.3 monospace;pointer-events:none';
  stage.appendChild(profOut);
  game.setProf(prof);
}

/**
 * Accumulate one frame's timings and refresh the overlay every ~2 s.
 * @param {number} steps simulation steps run this frame
 * @param {number} drawMs time spent in game.render this frame
 */
function reportProf(steps, drawMs) {
  profFrames++;
  profDraw += drawMs;
  prof.steps = (prof.steps || 0) + steps;
  const now = performance.now();
  if (now - profStart < 2000 || !profOut) return;
  const fps = (profFrames * 1000) / (now - profStart);
  const lines = [`${fps.toFixed(0)} fps  sim ${simHz} Hz  draw ${(profDraw / profFrames).toFixed(2)} ms/frame`];
  for (const [k, v] of Object.entries(prof).sort((a, b) => b[1] - a[1])) {
    if (k !== 'steps') lines.push(`${k.padEnd(9)} ${(v / profFrames).toFixed(2)} ms`);
    prof[k] = 0;
  }
  profOut.textContent = lines.join('\n');
  profFrames = 0;
  profDraw = 0;
  profStart = now;
}

/** Current simulation rate and step (adaptive, see adaptRate). */
let simHz = CONFIG.SIM_HZ;
let DT = 1 / simHz;
/** @type {number | null} */
let lastFrameMs = null;
let accumulator = 0;

// Graceful degradation: smoothed frame interval decides the simulation rate.
let frameEma = 1 / 60; // seconds
let slowFor = 0; // seconds spent below SIM_DEGRADE_FPS
let fastFor = 0; // seconds spent at/above SIM_RECOVER_FPS

/**
 * Track the frame rate and switch between SIM_HZ and SIM_HZ_LOW with
 * hysteresis. Only called for real frame intervals while simulating.
 * @param {number} elapsed seconds since the previous frame
 */
function adaptRate(elapsed) {
  if (elapsed <= 0 || elapsed > 0.25) return; // skip resets and long stalls
  frameEma += (elapsed - frameEma) * 0.1;
  const fps = 1 / frameEma;
  slowFor = fps < CONFIG.SIM_DEGRADE_FPS ? slowFor + elapsed : 0;
  fastFor = fps >= CONFIG.SIM_RECOVER_FPS ? fastFor + elapsed : 0;
  if (simHz !== CONFIG.SIM_HZ_LOW && slowFor >= CONFIG.SIM_DEGRADE_S) {
    simHz = CONFIG.SIM_HZ_LOW;
    fastFor = 0;
  } else if (simHz !== CONFIG.SIM_HZ && fastFor >= CONFIG.SIM_RECOVER_S) {
    simHz = CONFIG.SIM_HZ;
    slowFor = 0;
  }
  DT = 1 / simHz;
}

/** @param {DOMHighResTimeStamp} nowMs */
function frame(nowMs) {
  if (game.consumeClockReset()) {
    lastFrameMs = null;
    accumulator = 0;
  }
  if (lastFrameMs === null) lastFrameMs = nowMs;
  const elapsed = (nowMs - lastFrameMs) / 1000;
  lastFrameMs = nowMs;

  let steps = 0;
  if (game.simulating()) {
    adaptRate(elapsed);
    accumulator += elapsed;
    while (accumulator >= DT && steps < CONFIG.MAX_CATCHUP_STEPS) {
      game.step(DT);
      accumulator -= DT;
      steps++;
    }
    if (accumulator >= DT) accumulator %= DT; // drop excess backlog after a hitch
  } else {
    accumulator = 0;
  }

  const d0 = profOut ? performance.now() : 0;
  game.render(accumulator);
  if (profOut) reportProf(steps, performance.now() - d0);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
