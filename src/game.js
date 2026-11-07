// Run state machine: INTRO -> RUNNING <-> PAUSED, RUNNING -> SPLAT -> GAME_OVER.
// The opening plane/lunch gag (OPENING) is deferred; runs start mid-fall.
import { CONFIG } from './config.js';
import { createRun, resetRun, simulateStep, idleStep, altitudeOf, setView } from './simulation.js';
import { loadBest, saveBest } from './ui.js';
import { sfx, setFart, buzz, unlockAudio } from './audio.js';

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

  // Rainbow trail: on when the balance first beats the previous best (with
  // more than one coin) for TRAIL_BEST_S, and while picking up more than one
  // coin per second on average (the last RATE_COUNT pickups within RATE_WINDOW_S).
  const TRAIL_BEST_S = 4;
  const RATE_COUNT = 6;
  const RATE_WINDOW_S = 5;
  const pickupTimes = new Float64Array(RATE_COUNT).fill(-Infinity);
  let pickupNext = 0;
  let trailUntil = -Infinity;
  let bestCelebrated = false;
  let hintShown = false;

  resetRun(run, 1);
  ui.show('intro');

  function startRun() {
    unlockAudio();
    resetRun(run, (Math.random() * 2 ** 32) >>> 0);
    gameTime = 0;
    pickupTimes.fill(-Infinity);
    pickupNext = 0;
    trailUntil = -Infinity;
    bestCelebrated = false;
    hintShown = true;
    ui.stickHint(true);
    input.reset();
    clockReset = true;
    state = State.RUNNING;
    ui.show(null);
  }

  function pause() {
    if (state !== State.RUNNING) return;
    state = State.PAUSED;
    input.reset();
    setFart(false);
    ui.show('paused');
  }

  function resume() {
    if (state !== State.PAUSED) return;
    unlockAudio();
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
    trailUntil = -Infinity;
    setFart(false);
    if (run.exploded) {
      sfx.boom();
      buzz(350);
    } else {
      sfx.splat();
      buzz([70, 40, 140]);
    }
    input.reset();
    ui.hideRunControls();
  }

  // Hidden tab: a run pauses (and stays paused until Resume). Other states
  // aren't pausable, but on return we reset the clock so the hidden time is
  // never simulated as a catch-up burst.
  /** Sounds, haptics and the rainbow trail, from the last step's events. */
  function react() {
    const ev = run.events;
    if (ev.bounces) sfx.bounce();
    if (ev.coins) {
      if (ev.bigCoins) {
        sfx.bigCoin();
        buzz([20, 30, 25]);
      } else {
        sfx.coin();
        buzz(12);
      }
      for (let i = 0; i < ev.coins; i++) {
        pickupTimes[pickupNext] = gameTime;
        pickupNext = (pickupNext + 1) % RATE_COUNT;
      }
      // pickupTimes[pickupNext] is now the oldest of the last RATE_COUNT pickups.
      if (pickupTimes[pickupNext] >= gameTime - RATE_WINDOW_S) trailUntil = Math.max(trailUntil, gameTime + 0.6);
    }
    if (!bestCelebrated && run.balance > best && run.balance > 1) {
      bestCelebrated = true;
      trailUntil = Math.max(trailUntil, gameTime + TRAIL_BEST_S);
    }
    setFart(run.dan.boosting);
    // Fade the joystick hint after a few seconds or once the player farts.
    if (hintShown && (run.dan.boosting || gameTime > CONFIG.STICK_HINT_S)) {
      hintShown = false;
      ui.stickHint(false);
    }
  }

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
    // Everything but PAUSED advances time: the start and game-over screens
    // keep the world (clouds, pickups) moving behind them.
    simulating: () => state !== State.PAUSED,

    /** @param {number} dt */
    step(dt) {
      if (state === State.RUNNING) {
        simulateStep(run, input.state, dt, gameTime);
        gameTime += dt;
        react();
        if (run.landed || run.exploded) endRun();
      } else if (state === State.SPLAT) {
        // World keeps drifting under the splat; Dan stays put.
        gameTime += dt;
        splatTime += dt;
        if (splatTime >= CONFIG.SPLAT_S) {
          state = State.GAME_OVER;
          ui.show('gameover');
        }
      } else if (state === State.INTRO || state === State.GAME_OVER) {
        idleStep(run, dt, gameTime);
        gameTime += dt;
      }
    },

    /** @param {number} accumulator */
    render(accumulator) {
      const splat =
        state === State.SPLAT ? splatTime / CONFIG.SPLAT_S : state === State.GAME_OVER ? 1 : -1;
      const trail = state === State.RUNNING && gameTime < trailUntil;
      renderer.draw(run, gameTime + accumulator, { debug, splat, hideDan: state === State.INTRO, trail });
      ui.hud(run.balance, best, altitudeOf(run));
    },
  };
}
