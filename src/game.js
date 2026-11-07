// Run state machine: INTRO -> RUNNING <-> PAUSED, RUNNING -> SPLAT -> GAME_OVER.
// The opening plane/lunch gag (OPENING) is deferred; runs start mid-fall.
import { CONFIG } from './config.js';
import { createRun, resetRun, simulateStep, altitudeOf, setView } from './simulation.js';
import { loadBest, saveBest } from './ui.js';

/** @typedef {import('./input.js').Input} Input */
/** @typedef {import('./ui.js').UI} UI */
/** @typedef {import('./render.js').Renderer} Renderer */

/** @typedef {typeof State[keyof typeof State]} GameState */

export const State = Object.freeze({
  INTRO: 'INTRO',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  SPLAT: 'SPLAT',
  GAME_OVER: 'GAME_OVER',
});

/**
 * @typedef {object} Game
 * @property {() => void} onBegin
 * @property {() => void} onRestart
 * @property {() => void} onPause
 * @property {() => void} onResume
 * @property {() => void} togglePause
 * @property {() => void} toggleDebug
 * @property {(w: number, h: number) => void} setView set the visible world size from the screen layout
 * @property {() => boolean} consumeClockReset true once after start/resume: caller must reset its frame baseline and accumulator
 * @property {() => boolean} simulating whether fixed steps should run
 * @property {(dt: number) => void} step advance one fixed step of dt seconds
 * @property {(accumulator: number) => void} render draw; accumulator is the unsimulated remainder, s
 */

/**
 * @param {{ input: Input, ui: UI, renderer: Renderer }} deps
 * @returns {Game}
 */
export function createGame({ input, ui, renderer }) {
  const run = createRun();
  /** @type {GameState} */
  let state = State.INTRO;
  let gameTime = 0;
  let splatTime = 0;
  let best = loadBest();
  let clockReset = true;
  let debug = false;

  resetRun(run, 1);
  ui.show('intro');

  function startRun() {
    resetRun(run, (Math.random() * 2 ** 32) >>> 0);
    gameTime = 0;
    input.reset();
    clockReset = true;
    state = State.RUNNING;
    ui.show(null);
  }

  function pause() {
    if (state !== State.RUNNING) return;
    state = State.PAUSED;
    input.reset();
    ui.show('paused');
  }

  function resume() {
    if (state !== State.PAUSED) return;
    clockReset = true; // do not simulate paused time
    state = State.RUNNING;
    ui.show(null);
  }

  function endRun() {
    const score = Math.floor(run.balance);
    const isNewBest = score > best;
    if (isNewBest) {
      best = score;
      saveBest(best);
    }
    ui.gameOver(score, best, isNewBest);
    state = State.SPLAT; // short, non-pausable sequence
    splatTime = 0;
    input.reset();
    ui.hideRunControls();
  }

  // Hidden tab: a run pauses (and stays paused until Resume). Other states
  // aren't pausable, but on return we reset the clock so the hidden time is
  // never simulated as a catch-up burst.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') pause();
    else clockReset = true;
  });

  return {
    onBegin: startRun,
    onRestart: startRun,
    onPause: pause,
    onResume: resume,
    togglePause() {
      if (state === State.RUNNING) pause();
      else if (state === State.PAUSED) resume();
    },
    toggleDebug() {
      debug = !debug;
    },
    /**
     * @param {number} w
     * @param {number} h
     */
    setView(w, h) {
      setView(run, w, h);
    },

    // main.js resets its frame baseline and accumulator when this returns true.
    consumeClockReset() {
      const r = clockReset;
      clockReset = false;
      return r;
    },
    simulating: () => state === State.RUNNING || state === State.SPLAT,

    /** @param {number} dt */
    step(dt) {
      if (state === State.RUNNING) {
        simulateStep(run, input.state, dt, gameTime);
        gameTime += dt;
        if (run.landed || run.exploded) endRun();
      } else if (state === State.SPLAT) {
        // World keeps drifting under the splat; Dan stays put.
        gameTime += dt;
        splatTime += dt;
        if (splatTime >= CONFIG.SPLAT_S) {
          state = State.GAME_OVER;
          ui.show('gameover');
        }
      }
    },

    /** @param {number} accumulator */
    render(accumulator) {
      const splat =
        state === State.SPLAT ? splatTime / CONFIG.SPLAT_S : state === State.GAME_OVER ? 1 : -1;
      renderer.draw(run, gameTime + accumulator, { debug, splat });
      ui.hud(run.balance, best, altitudeOf(run));
    },
  };
}
