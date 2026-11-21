// LOOK TRIAL switch row (session 49, TEMPORARY): only in the trial build (VITE_LOOK_TRIAL=1). Two small buttons at the
// bottom, LOOK and FONT. A tap saves the next choice in localStorage and switches it LIVE (user: 'not always restart'):
// config.js applyLook() swaps the colours, uiKit swapSmallFont() the font, then every open screen is drawn again where
// it is. A FIGHT (and its reward pop-up) is not redrawn (that would start a new run): the new look shows from the next
// floor. Plain HTML, outside the game canvas. Delete with the losing looks after the pick.
import { LOOK_TRIAL, LOOK_NAMES, FONT_NAMES, LOOK_NOW, applyLook } from './config.js';
import { swapSmallFont } from './entities/uiKit.js';

const KEEP = ['Battle', 'Reward', 'Debug']; // never redrawn by the switch

// Draws every open screen again with the current look (a paused screen under a page stays paused).
function redraw(game) {
  for (const s of game.scene.getScenes(false)) {
    const key = s.scene.key, sys = s.sys;
    if (KEEP.includes(key) || !(sys.isActive() || sys.isPaused())) continue;
    if (sys.isPaused()) s.events.once('create', () => s.scene.pause());
    s.scene.restart();
  }
}

export function mountLookTrial(game) {
  if (!LOOK_TRIAL) return;
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:10;display:flex;justify-content:center;gap:6px;'
    + 'padding:3px;pointer-events:none;font:bold 11px monospace;';
  const make = (label, key, list, field) => {
    const b = document.createElement('button');
    const show = () => { b.textContent = `${label} ${list.indexOf(LOOK_NOW[field]) + 1}/${list.length} ${LOOK_NOW[field].toUpperCase()}`; };
    b.style.cssText = 'pointer-events:auto;background:#000;color:#fff;border:2px solid #fff;padding:4px 8px;'
      + 'font:inherit;opacity:0.85;';
    b.onclick = () => {
      const next = list[(list.indexOf(LOOK_NOW[field]) + 1) % list.length];
      try { localStorage.setItem(key, next); } catch { /* no storage: still switches for now */ }
      const look = field === 'look' ? next : LOOK_NOW.look, font = field === 'font' ? next : LOOK_NOW.font;
      const fontChanged = font !== LOOK_NOW.font;
      applyLook(look, font);
      show();
      (fontChanged ? swapSmallFont(font) : Promise.resolve()).then(() => redraw(game));
    };
    show();
    bar.appendChild(b);
  };
  make('LOOK', 'soldia.lookTrial.look', LOOK_NAMES, 'look');
  make('FONT', 'soldia.lookTrial.font', FONT_NAMES, 'font');
  document.body.appendChild(bar);
}
