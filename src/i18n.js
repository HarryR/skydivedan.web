// English/Vietnamese strings and language selection.
// Elements use data-i18n="key" (text) and data-i18n-aria="key" (aria-label).
import { CONFIG } from './config.js';

/** @typedef {'en' | 'vi'} Lang */

/** @satisfies {Record<Lang, Record<string, string>>} */
const STRINGS = {
  en: {
    begin: 'Begin Game',
    controlsKeys: 'Steer: ← → or A / D · Fart boost: hold W, ↑ or Space',
    controlsTouch: 'Steer: drag left or right · Fart boost: hold 💨',
    coins: 'Coins',
    best: 'Best',
    alt: 'Alt',
    pause: 'Pause',
    paused: 'Paused',
    resume: 'Resume',
    restart: 'Restart',
    gameOver: 'GAME OVER',
    newBest: 'New best!',
    playAgain: 'Play again',
    fart: 'Fart boost',
    share: 'Show QR code to share this game',
  },
  vi: {
    begin: 'Bắt đầu',
    controlsKeys: 'Lái: ← → hoặc A / D · Xì hơi bay lên: giữ W, ↑ hoặc Space',
    controlsTouch: 'Lái: kéo sang trái hoặc phải · Xì hơi bay lên: giữ 💨',
    coins: 'Xu',
    best: 'Kỷ lục',
    alt: 'Độ cao',
    pause: 'Tạm dừng',
    paused: 'Tạm dừng',
    resume: 'Tiếp tục',
    restart: 'Chơi lại',
    gameOver: 'GAME OVER',
    newBest: 'Kỷ lục mới!',
    playAgain: 'Chơi lại',
    fart: 'Xì hơi',
    share: 'Hiện mã QR để chia sẻ trò chơi',
  },
};

/** @type {Lang} */
let lang = detect();

/**
 * @param {string | null} v
 * @returns {v is Lang}
 */
function isLang(v) {
  return v === 'en' || v === 'vi';
}

/** @returns {Lang} saved choice, else browser preference, else English */
function detect() {
  try {
    const saved = localStorage.getItem(CONFIG.LANG_KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  const prefs = navigator.languages || [navigator.language || 'en'];
  return prefs.some((l) => l.toLowerCase().startsWith('vi')) ? 'vi' : 'en';
}

/** @returns {Lang} */
export const getLang = () => lang;

/**
 * @param {string} key
 * @returns {string} translation, falling back to English, then the key itself
 */
export const t = (key) => {
  const table = /** @type {Record<string, string>} */ (STRINGS[lang]);
  const en = /** @type {Record<string, string>} */ (STRINGS.en);
  return table[key] ?? en[key] ?? key;
};

/**
 * Switch language, persist the choice, and re-apply strings under `root`.
 * @param {Lang} next
 * @param {ParentNode} root
 */
export function setLang(next, root) {
  lang = next;
  try {
    localStorage.setItem(CONFIG.LANG_KEY, next);
  } catch {
    /* storage unavailable */
  }
  apply(root);
}

/**
 * Fill [data-i18n] text and [data-i18n-aria] labels under `root`.
 * @param {ParentNode} root
 */
export function apply(root) {
  document.documentElement.lang = lang;
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(/** @type {HTMLElement} */ (el).dataset.i18n ?? '');
  }
  for (const el of root.querySelectorAll('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(/** @type {HTMLElement} */ (el).dataset.i18nAria ?? ''));
  }
}
