// BEGIN DESCENT, the squad screen's main button (session 47, user: 'higher, a tad bigger, tweak how it looks'; picked
// the GOLD look's design 'but crimson', no arrows, no outline on the words): a crimson body (light top edge, darker
// foot) between two gold bands along its top and bottom, no frame on the sides; cream words. A dim body + grey words
// until the squad is full ('PICK n MORE'). Pressed = pushed in (darker body, a shadow under the top band, the words
// sink).
import { UI } from '../../config.js';

const ROLL = { gold: 0xd8a640, light: 0xffe39a, dark: 0x8a6420 }; // the gold bands

// The words' colour.
export function beginTextColor(enabled) {
  return enabled ? UI.goldTheme.buttonText : '#9a96a6';
}

// Draws the button body into g (top left x, y; w x h).
export function drawBeginButton(g, x, y, w, h, { pressed = false, enabled = true } = {}) {
  const T = UI.goldTheme, B = UI.flat.band, s = UI.press.sinkPx;
  const [body, dark, light] = enabled ? [T.button, T.buttonDark, T.buttonLight] : [T.dim, T.dim, T.dim];
  g.fillStyle(T.outline, 1).fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle(pressed ? dark : body, 1).fillRect(x, y, w, h);
  if (pressed) g.fillStyle(T.outline, 1).fillRect(x, y + B, w, s);
  else g.fillStyle(light, 1).fillRect(x, y + B, w, 2).fillStyle(dark, 1).fillRect(x, y + h - B - 6, w, 6);
  const R = enabled ? ROLL : { gold: T.frameDark, light: T.dim, dark: T.outline };
  for (const by of [y, y + h - B]) g.fillStyle(R.gold, 1).fillRect(x, by, w, B).fillStyle(R.light, 1).fillRect(x + 2, by + 2, w - 4, 2).fillStyle(R.dark, 1).fillRect(x + 2, by + B - 2, w - 4, 2);
  return g;
}
