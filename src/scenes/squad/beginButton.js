// BEGIN DESCENT, the squad screen's main button (session 47, user: 'higher, a tad bigger, tweak how it looks'; picked
// the GOLD look's design 'but crimson', no arrows, no outline on the words): a crimson body (light top edge, darker
// foot) between two gold bands along its top and bottom, no frame on the sides; cream words. A dim body + grey words
// until the squad is full ('PICK n MORE'). PRESSED = THE WHOLE BUTTON SINKS (user: only the red part moved, the gold
// bands 'not a part of the button'): it normally stands sinkPx above a dark ledge; held, everything (bands included)
// drops onto the ledge and goes a shade darker, the words sink with it.
import { UI } from '../../config.js';

const ROLL = { gold: 0xd8a640, light: 0xffe39a, dark: 0x8a6420 }; // the gold bands
const ROLL_PRESSED = { gold: 0xb08530, light: 0xd8a640, dark: 0x6a4818 }; // the gold bands, held down

// The words' colour.
export function beginTextColor(enabled) {
  return enabled ? UI.goldTheme.buttonText : '#9a96a6';
}

// Draws the button into g (top left x, y; w x h, the ledge included).
export function drawBeginButton(g, x, y, w, h, { pressed = false, enabled = true } = {}) {
  const T = UI.goldTheme, B = UI.flat.band, s = UI.press.sinkPx;
  const [body, dark, light] = !enabled ? [T.dim, T.dim, T.dim] : pressed ? [T.buttonDark, T.buttonDark, T.button] : [T.button, T.buttonDark, T.buttonLight];
  const R = !enabled ? { gold: T.frameDark, light: T.dim, dark: T.outline } : pressed ? ROLL_PRESSED : ROLL;
  g.fillStyle(T.outline, 1).fillRect(x - 2, y - 2, w + 4, h + 4); // the outline + the dark ledge under the button
  const top = y + (pressed ? s : 0), bh = h - s; // the button itself: up on the ledge, or pushed down onto it
  g.fillStyle(body, 1).fillRect(x, top, w, bh);
  g.fillStyle(light, 1).fillRect(x, top + B, w, 2).fillStyle(dark, 1).fillRect(x, top + bh - B - 6, w, 6);
  for (const by of [top, top + bh - B]) g.fillStyle(R.gold, 1).fillRect(x, by, w, B).fillStyle(R.light, 1).fillRect(x + 2, by + 2, w - 4, 2).fillStyle(R.dark, 1).fillRect(x + 2, by + B - 2, w - 4, 2);
  return g;
}
