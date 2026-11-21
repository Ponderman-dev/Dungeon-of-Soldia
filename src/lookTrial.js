// LOOK TRIAL switch row (session 49, TEMPORARY): only in the trial build (VITE_LOOK_TRIAL=1). Two small buttons above
// the game, LOOK and FONT; a tap saves the next choice in localStorage and reloads the page (config.js applies the
// pick before any scene loads). Plain HTML, outside the game canvas. Delete with the losing looks after the pick.
import { LOOK_TRIAL, LOOK_NAMES, LOOK_PICK, FONT_NAMES, FONT_PICK } from './config.js';

export function mountLookTrial() {
  if (!LOOK_TRIAL) return;
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:10;display:flex;justify-content:center;gap:6px;'
    + 'padding:3px;pointer-events:none;font:bold 11px monospace;';
  const btn = (label, key, list, pick) => {
    const b = document.createElement('button');
    b.textContent = `${label} ${list.indexOf(pick) + 1}/${list.length} ${pick.toUpperCase()}`;
    b.style.cssText = 'pointer-events:auto;background:#000;color:#fff;border:2px solid #fff;padding:4px 8px;'
      + 'font:inherit;opacity:0.85;';
    b.onclick = () => {
      try { localStorage.setItem(key, list[(list.indexOf(pick) + 1) % list.length]); } catch { /* no storage: stays */ }
      location.reload();
    };
    bar.appendChild(b);
  };
  btn('LOOK', 'soldia.lookTrial.look', LOOK_NAMES, LOOK_PICK);
  btn('FONT', 'soldia.lookTrial.font', FONT_NAMES, FONT_PICK);
  document.body.appendChild(bar);
}
