// DOM screens, HUD, and the locally saved best score.
import { CONFIG } from './config.js';
import { apply, getLang, setLang } from './i18n.js';
import { createShareQr } from './qr.js';
import { isMuted, setMuted, unlockAudio } from './audio.js';

/** @typedef {'intro' | 'paused' | 'gameover'} ScreenName */

/**
 * @typedef {object} UIHandlers
 * @property {() => void} onBegin
 * @property {() => void} onRestart
 * @property {() => void} onPause
 * @property {() => void} onResume
 */

/**
 * @typedef {object} UI
 * @property {HTMLElement} stick the touch joystick
 * @property {(visible: boolean) => void} stickHint show/fade the joystick hint
 * @property {(name: ScreenName | null) => void} show
 *   show one overlay screen, or null for the in-run view (HUD, pause and fart buttons)
 * @property {(coins: number, best: number, alt: number) => void} hud update HUD values
 * @property {(score: number, best: number, isNewBest: boolean) => void} gameOver fill the game-over screen
 * @property {() => void} hideRunControls hide the pause button and joystick (e.g. during the splat)
 */

/** @returns {number} saved best score, or 0 if none/unavailable */
export function loadBest() {
  try {
    const v = parseInt(localStorage.getItem(CONFIG.BEST_KEY) ?? '0', 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

/** @param {number} v */
export function saveBest(v) {
  try {
    localStorage.setItem(CONFIG.BEST_KEY, String(v));
  } catch {
    /* storage unavailable: keep playing without persistence */
  }
}

/**
 * @param {HTMLElement} root element containing the game's DOM
 * @param {UIHandlers} handlers
 * @returns {UI}
 */
export function createUI(root, handlers) {
  /**
   * Required element by id; throws early if the HTML and code disagree.
   * @template {HTMLElement} [E=HTMLElement]
   * @param {string} id
   * @returns {E}
   */
  const $ = (id) => {
    const el = root.querySelector(`#${id}`);
    if (!el) throw new Error(`missing #${id}`);
    return /** @type {E} */ (el);
  };
  /** @type {Record<ScreenName, HTMLElement>} */
  const screens = { intro: $('intro'), paused: $('paused'), gameover: $('gameover') };
  const hud = $('hud');
  const coinsEl = $('hud-coins');
  const bestEl = $('hud-best');
  const altEl = $('hud-alt');
  const pauseBtn = $('pause-btn');
  const stick = $('stick');
  const hint = $('stick-hint');
  const shareQr = createShareQr(/** @type {HTMLButtonElement} */ ($('qr-btn')));

  $('begin-btn').addEventListener('click', handlers.onBegin);
  $('resume-btn').addEventListener('click', handlers.onResume);
  $('restart-btn').addEventListener('click', handlers.onRestart);
  $('again-btn').addEventListener('click', handlers.onRestart);
  pauseBtn.addEventListener('click', handlers.onPause);
  // VN / EN toggles (start screen and pause overlay); all stay in sync.
  const langBtns = root.querySelectorAll('.lang-btn');
  for (const btn of langBtns) {
    btn.addEventListener('click', () => {
      setLang(getLang() === 'vi' ? 'en' : 'vi', root);
      showLang();
    });
  }

  // Sound toggles (one per screen), kept in sync.
  const soundBtns = root.querySelectorAll('.sound-btn');
  const showSound = () => {
    for (const b of soundBtns) {
      b.textContent = isMuted() ? '🔇' : '🔊';
      b.setAttribute('aria-pressed', String(!isMuted()));
    }
  };
  for (const b of soundBtns) {
    b.addEventListener('click', () => {
      unlockAudio();
      setMuted(!isMuted());
      showSound();
    });
  }
  showSound();

  function showLang() {
    const l = getLang();
    for (const btn of langBtns) {
      btn.querySelector('.lang-vn')?.classList.toggle('active', l === 'vi');
      btn.querySelector('.lang-en')?.classList.toggle('active', l === 'en');
    }
  }

  apply(root);
  showLang();

  let lastCoins = -1;
  let lastAlt = -1;

  return {
    stick,
    stickHint(visible) {
      hint.classList.toggle('gone', !visible);
    },
    // Show exactly one screen (or none) and the in-run controls when running.
    /** @param {ScreenName | null} name */
    show(name) {
      for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
      const inRun = name === null;
      hud.hidden = name === 'intro';
      pauseBtn.hidden = !inRun;
      stick.hidden = !inRun;
      shareQr.setVisible(!inRun); // start, pause and game-over screens
    },
    hideRunControls() {
      pauseBtn.hidden = true;
      stick.hidden = true;
    },
    /**
     * @param {number} coins current balance (floored for display)
     * @param {number} best
     * @param {number} alt
     */
    hud(coins, best, alt) {
      const c = Math.floor(coins);
      if (c !== lastCoins) {
        coinsEl.textContent = String(c);
        lastCoins = c;
      }
      bestEl.textContent = String(best);
      const a = Math.max(0, Math.round(alt / 10) * 10);
      if (a !== lastAlt) {
        altEl.textContent = String(a);
        lastAlt = a;
      }
    },
    /**
     * @param {number} score
     * @param {number} best
     * @param {boolean} isNewBest
     */
    gameOver(score, best, isNewBest) {
      $('final-score').textContent = String(score);
      $('final-best').textContent = String(best);
      $('new-best').hidden = !isNewBest;
    },
  };
}
