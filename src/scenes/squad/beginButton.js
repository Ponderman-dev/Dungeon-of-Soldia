// BEGIN DESCENT, the squad screen's main button (session 47, user: 'higher, a tad bigger, tweak how it looks'). Three
// looks ON TRIAL (registry 'beginLook', the 'BUTTON: ...' button in the dock), all with pulsing down-chevrons beside
// the words (= going down):
//   crimson = the camp's red banded button (like EXPEDITION);
//   iron    = an iron frame with rivets (like the gate's bands) around a crimson body, gold words;
//   gold    = a gold body with crimson bands, dark words.
// A dim body + grey words until the squad is full ('PICK n MORE'). Pressed = pushed in (darker, words sink).
import { UI } from '../../config.js';
import { drawFlatButton } from '../../entities/uiKit.js';

export const BEGIN_LOOKS = ['crimson', 'iron', 'gold'];
const IRON = { frame: 0x5d5862, light: 0x9a95a2, dark: 0x2e2b33, rivet: 0xc8c4d0 };
const GOLD = { body: 0xd8a640, light: 0xffe39a, dark: 0x8a6420, pressed: 0xa47a2c };

// The words' colour and outline for a look.
export function beginTextStyle(look, enabled) {
  const T = UI.goldTheme;
  if (!enabled) return { color: '#9a96a6', stroke: '#1a1612' };
  if (look === 'iron') return { color: '#ffd84a', stroke: '#3a0d0b' };
  if (look === 'gold') return { color: '#3a0d0b', stroke: '#ffe39a' };
  return { color: T.buttonText, stroke: '#5a1512' };
}

// Draws the button body into g (top left x, y; w x h).
export function drawBeginButton(g, x, y, w, h, { look = 'crimson', pressed = false, enabled = true } = {}) {
  const T = UI.goldTheme, s = UI.press.sinkPx;
  if (look === 'crimson' || !enabled) return drawFlatButton(g, x, y, w, h, { primary: true, bands: true, pressed, enabled });
  g.fillStyle(T.outline, 1).fillRect(x - 2, y - 2, w + 4, h + 4);
  if (look === 'iron') {
    g.fillStyle(IRON.frame, 1).fillRect(x, y, w, h).fillStyle(IRON.light, 1).fillRect(x, y, w, 2).fillStyle(IRON.dark, 1).fillRect(x, y + h - 2, w, 2);
    const F = 8; // the iron frame's width
    g.fillStyle(T.outline, 1).fillRect(x + F - 2, y + F - 2, w - 2 * F + 4, h - 2 * F + 4);
    if (pressed) g.fillStyle(T.buttonDark, 1).fillRect(x + F, y + F, w - 2 * F, h - 2 * F).fillStyle(T.outline, 1).fillRect(x + F, y + F, w - 2 * F, s);
    else {
      g.fillStyle(T.button, 1).fillRect(x + F, y + F, w - 2 * F, h - 2 * F);
      g.fillStyle(T.buttonLight, 1).fillRect(x + F, y + F, w - 2 * F, 2).fillStyle(T.buttonDark, 1).fillRect(x + F, y + h - F - 6, w - 2 * F, 6);
    }
    for (const rx of [x + 2, x + w / 2 - 2, x + w - 6]) for (const ry of [y + 2, y + h - 6]) g.fillStyle(IRON.rivet, 1).fillRect(Math.round(rx), ry, 4, 4).fillStyle(IRON.dark, 1).fillRect(Math.round(rx) + 2, ry + 2, 2, 2);
    return g;
  }
  // gold
  const B = UI.flat.band;
  g.fillStyle(pressed ? GOLD.pressed : GOLD.body, 1).fillRect(x, y, w, h);
  if (pressed) g.fillStyle(GOLD.dark, 1).fillRect(x, y + B, w, s);
  else g.fillStyle(GOLD.light, 1).fillRect(x, y + B, w, 2).fillStyle(GOLD.dark, 1).fillRect(x, y + h - B - 6, w, 6);
  for (const by of [y, y + h - B]) g.fillStyle(T.button, 1).fillRect(x, by, w, B).fillStyle(T.buttonLight, 1).fillRect(x + 2, by + 2, w - 4, 2).fillStyle(T.buttonDark, 1).fillRect(x + 2, by + B - 2, w - 4, 2);
  return g;
}

// Two stacked down-chevrons (2px pixels), centred on (cx, cy), into g.
export function drawChevrons(g, cx, cy, color) {
  g.fillStyle(color, 1);
  for (const dy of [-6, 2]) for (let i = 0; i < 4; i++) g.fillRect(cx - 7 + i * 2, cy + dy + i * 2, 2, 2).fillRect(cx + 5 - i * 2, cy + dy + i * 2, 2, 2);
}
