// BEGIN DESCENT, the squad screen's main button (session 47, user: 'higher, a tad bigger, tweak how it looks'; picked
// the GOLD look's design 'but crimson', no arrows, no outline on the words; then 'the gold band left and right too'):
// a crimson body (light top edge, darker foot) inside a gold band all round; cream words. A dim body + grey words
// until the squad is full ('PICK n MORE'). PRESSED = THE WHOLE BUTTON SINKS (user: only the red part moved, the gold
// bands 'not a part of the button'): it normally stands sinkPx above a dark ledge; held, everything (bands included)
// drops onto the ledge and goes a shade darker, the words sink with it.
import { UI } from '../../config.js';

const T0 = UI.goldTheme;
const ROLL = { gold: T0.band, light: T0.bandLight, dark: T0.bandDark }; // the gold bands
const ROLL_PRESSED = { gold: T0.bandP, light: T0.bandLightP, dark: T0.bandDarkP }; // the gold bands, held down

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
  // The gold bands all round (user: 'the gold band left and right too'): top + bottom, then the two sides; each has a
  // light line on its outer edge and a dark line on its inner edge.
  for (const by of [top, top + bh - B]) g.fillStyle(R.gold, 1).fillRect(x, by, w, B);
  for (const bx of [x, x + w - B]) g.fillStyle(R.gold, 1).fillRect(bx, top, B, bh);
  g.fillStyle(R.light, 1).fillRect(x + 2, top + 2, w - 4, 2).fillRect(x + 2, top + 2, 2, bh - 4); // outer light: top, left
  g.fillStyle(R.dark, 1).fillRect(x + 2, top + bh - 4, w - 4, 2).fillRect(x + w - 4, top + 2, 2, bh - 4); // outer shade: bottom, right
  g.fillStyle(R.dark, 1).fillRect(x + B - 2, top + B - 2, w - 2 * B + 4, 2).fillRect(x + B - 2, top + B - 2, 2, bh - 2 * B + 4); // inner edge: top, left
  g.fillStyle(R.light, 1).fillRect(x + B - 2, top + bh - B, w - 2 * B + 4, 2).fillRect(x + w - B, top + B - 2, 2, bh - 2 * B + 4); // inner edge: bottom, right
  return g;
}
