// The shared interface look ("Classic RPG Window"): black windows with a white 2px line and stepped corners, a blinking
// ▶ cursor and Ironslab text (the game's own pixel font). Every screen draws its windows, buttons and text through these helpers.
import Phaser from 'phaser';
import fontUrl from '../assets/fonts/ironslab.ttf?inline';
import { UI } from '../config.js';

// Loads the packed font before the first screen draws. The font comes from its data: URL with atob, never fetch():
// the claude.ai preview frame blocks fetch (the same trick as the sounds). If it fails the game uses monospace.
export function loadUiFont() {
  installFontGrid();
  try {
    const bin = atob(fontUrl.split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const face = new FontFace('Ironslab', bytes.buffer);
    document.fonts.add(face);
    return face.load().catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

// Ironslab is drawn on a 10px grid (capitals 8px tall), so it is only crisp at 10 / 20 / 30px. The scenes keep asking
// for the old Press Start 2P sizes (8 / 16 / 24px); every size is scaled by UI.fontGrid.scale and rounded to the grid
// (8 -> 10, 16 -> 20, 24 -> 30: the letters stay the same height). Done once, in Phaser's text style.
export function gridPx(size) {
  const G = UI.fontGrid;
  return Math.max(1, Math.round((parseFloat(size) * G.scale) / G.px)) * G.px;
}
let gridInstalled = false;
function installFontGrid() {
  if (gridInstalled) return;
  gridInstalled = true;
  const TS = Phaser.GameObjects.TextStyle.prototype;
  const setStyle = TS.setStyle;
  TS.setStyle = function (style, updateText, setDefaults) {
    if (style && style.fontFamily === UI.font && style.fontSize != null) style = { ...style, fontSize: `${gridPx(style.fontSize)}px` };
    return setStyle.call(this, style, updateText, setDefaults);
  };
  const setFontSize = TS.setFontSize;
  TS.setFontSize = function (size) {
    return setFontSize.call(this, this.fontFamily === UI.font ? gridPx(size) : size);
  };
}

// A text style in the interface font. `size` is a UI.size key or a number of pixels (keep it a multiple of 8).
export function uiStyle(size = 'normal', color = UI.text, extra = {}) {
  const px = typeof size === 'number' ? size : UI.size[size];
  return { fontFamily: UI.font, fontSize: `${px}px`, color, lineSpacing: Math.round(px / 2), ...extra };
}

export function uiText(scene, x, y, str, size = 'normal', color = UI.text, extra = {}) {
  return scene.add.text(x, y, str, uiStyle(size, color, extra));
}

// A window: the stepped outline in `line`, filled with `fill`. Drawn into Graphics `g` (call g.clear() yourself).
export function drawWindow(g, x, y, w, h, { fill = UI.window, line = UI.line, alpha = 1 } = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  g.fillStyle(line, alpha);
  g.fillRect(x + 4, y, w - 8, h).fillRect(x + 2, y + 2, w - 4, h - 4).fillRect(x, y + 4, w, h - 8);
  g.fillStyle(fill, alpha);
  g.fillRect(x + 4, y + 2, w - 8, h - 4).fillRect(x + 2, y + 4, w - 4, h - 8);
  return g;
}

// The ▶ cursor (4 wide, 7 tall, in 2px steps when `px` is 2), with its left edge at x and centred on y.
export function drawCursor(g, x, y, color = UI.line, px = 2) {
  g.fillStyle(color, 1);
  for (let i = 0; i < 4; i++) g.fillRect(x + i * px, y - (3 - i) * px, px, (7 - i * 2) * px);
  return g;
}

// A button: a window with a centred label. `selected` adds the blinking ▶ cursor; pressing flips it to white.
// Returns { container, hit, setLabel, setSelected, setEnabled }.
export function uiButton(scene, x, y, w, h, label, { size = 'normal', selected = false, enabled = true, onTap = null, depth = 0 } = {}) {
  const container = scene.add.container(x, y).setDepth(depth);
  const g = scene.add.graphics();
  const text = uiText(scene, w / 2, h / 2, label, size).setOrigin(0.5);
  const cur = scene.add.graphics();
  container.add([g, text, cur]);
  let pressed = false;
  const draw = () => {
    g.clear();
    drawWindow(g, 0, 0, w, h, pressed ? { fill: UI.pressed } : {});
    text.setColor(!enabled ? UI.dim : pressed ? '#000000' : UI.text);
    cur.clear();
    if (selected) drawCursor(cur, Math.round(w / 2 - text.width / 2 - 16), Math.round(h / 2), pressed ? 0x000000 : UI.line);
  };
  draw();
  const blink = scene.time.addEvent({ delay: 500, loop: true, callback: () => cur.setVisible(!cur.visible) });
  container.once('destroy', () => blink.remove());
  const hit = scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true }); // the tap area
  container.add(hit);
  hit.on('pointerdown', () => { if (!enabled) return; pressed = true; draw(); });
  hit.on('pointerout', () => { if (pressed) { pressed = false; draw(); } });
  hit.on('pointerup', () => { if (!pressed) return; pressed = false; draw(); if (onTap) onTap(); });
  return {
    container,
    hit,
    setLabel: (s) => { text.setText(s); draw(); },
    setSelected: (v) => { selected = v; draw(); },
    setEnabled: (v) => { enabled = v; draw(); },
  };
}
