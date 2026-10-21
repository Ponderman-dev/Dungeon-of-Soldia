// The shared interface look ("Classic RPG Window"): black windows with a white 2px line and stepped corners, a blinking
// ▶ cursor and Ironslab text (the game's own pixel font; small text in Tiny5). Every screen draws its windows, buttons and text through these helpers.
import Phaser from 'phaser';
import fontUrl from '../assets/fonts/ironslab.ttf?inline';
import smallFontUrl from '../assets/fonts/tiny5.woff2?inline';
import { UI } from '../config.js';
import * as sfx from '../audio/sfx.js';

// Loads the packed font before the first screen draws. The font comes from its data: URL with atob, never fetch():
// the claude.ai preview frame blocks fetch (the same trick as the sounds). If it fails the game uses monospace.
export function loadUiFont() {
  installFontGrid();
  const load = (name, url) => {
    try {
      const bin = atob(url.split(',')[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const face = new FontFace(name, bytes.buffer);
      document.fonts.add(face);
      return face.load().catch(() => null);
    } catch {
      return Promise.resolve(null);
    }
  };
  return Promise.all([load('Ironslab', fontUrl), load('Tiny5', smallFontUrl)]);
}

// Ironslab is drawn on a 10px grid (capitals 8px tall), so it is only crisp at 10 / 20 / 30px. The scenes keep asking
// for the old Press Start 2P sizes (8 / 16 / 24px); every size is scaled by UI.fontGrid.scale and rounded to the grid
// (8 -> 10, 16 -> 20, 24 -> 30: the letters stay the same height). Done once, in Phaser's text style.
export function gridPx(size) {
  const G = UI.fontGrid;
  return Math.max(1, Math.round((parseFloat(size) * G.scale) / G.px)) * G.px;
}
// Small sizes (UI.smallFont.maxPx or less) switch to the small font (Tiny5) at its own size.
const SMALL = UI.smallFont;
const isSmall = (size) => parseFloat(size) <= SMALL.maxPx;
let gridInstalled = false;
function installFontGrid() {
  if (gridInstalled) return;
  gridInstalled = true;
  const TS = Phaser.GameObjects.TextStyle.prototype;
  const setStyle = TS.setStyle;
  TS.setStyle = function (style, updateText, setDefaults) {
    if (style && style.fontFamily === UI.font && style.fontSize != null) {
      style = isSmall(style.fontSize)
        ? { ...style, fontFamily: SMALL.family, fontSize: `${SMALL.px}px` }
        : { ...style, fontSize: `${gridPx(style.fontSize)}px` };
    }
    return setStyle.call(this, style, updateText, setDefaults);
  };
  const setFontSize = TS.setFontSize;
  TS.setFontSize = function (size) {
    if (this.fontFamily !== UI.font && this.fontFamily !== SMALL.family) return setFontSize.call(this, size);
    this.fontFamily = isSmall(size) ? SMALL.family : UI.font;
    return setFontSize.call(this, isSmall(size) ? SMALL.px : gridPx(size));
  };
  // After a small text is drawn, every pixel is snapped to full or empty (and to its fill or stroke colour), so a
  // letter that lands between pixels stays as sharp as the pixel art.
  const TX = Phaser.GameObjects.Text.prototype;
  const updateText = TX.updateText;
  TX.updateText = function () {
    if (this.style.fontFamily !== SMALL.family) return updateText.call(this);
    if (!this.letterSpacing) this.letterSpacing = SMALL.letterSpacing; // letter by letter: 'fl' never joins
    // Each letter on a whole pixel (widths rounded, drawn letter by letter), so no letter is blurred.
    const ctx = this.context, measure = ctx.measureText, fill = ctx.fillText, stroke = ctx.strokeText;
    ctx.measureText = function (str) {
      let w = 0;
      for (const ch of str) w += Math.ceil(measure.call(this, ch).width - 0.05);
      const m = measure.call(this, str);
      return { width: w, actualBoundingBoxAscent: m.actualBoundingBoxAscent, actualBoundingBoxDescent: m.actualBoundingBoxDescent, fontBoundingBoxAscent: m.fontBoundingBoxAscent, fontBoundingBoxDescent: m.fontBoundingBoxDescent };
    };
    ctx.fillText = function (str, x, y) { return fill.call(this, str, Math.round(x), Math.round(y)); };
    ctx.strokeText = function (str, x, y) { return stroke.call(this, str, Math.round(x), Math.round(y)); };
    let out;
    try { out = updateText.call(this); } finally { delete ctx.measureText; delete ctx.fillText; delete ctx.strokeText; }
    if (this.style.fontFamily === SMALL.family && this.canvas && this.canvas.width > 0 && this.canvas.height > 0) {
      snapCanvas(this.context, this.canvas, this.style);
      if (this.renderer && this.renderer.gl) this.frame.source.glTexture = this.renderer.canvasToTexture(this.canvas, this.frame.source.glTexture, true);
    }
    return out;
  };
}

const rgbOf = (css) => {
  const c = Phaser.Display.Color.ValueToColor(css || '#ffffff');
  return [c.red, c.green, c.blue];
};
function snapCanvas(ctx, canvas, style) {
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height), d = img.data;
  const fill = rgbOf(style.color), stroke = style.strokeThickness ? rgbOf(style.stroke) : null;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < SMALL.snap) { d[i + 3] = 0; continue; }
    d[i + 3] = 255;
    if (!stroke) { d[i] = fill[0]; d[i + 1] = fill[1]; d[i + 2] = fill[2]; continue; }
    const df = (d[i] - fill[0]) ** 2 + (d[i + 1] - fill[1]) ** 2 + (d[i + 2] - fill[2]) ** 2;
    const ds = (d[i] - stroke[0]) ** 2 + (d[i + 1] - stroke[1]) ** 2 + (d[i + 2] - stroke[2]) ** 2;
    const c = df <= ds ? fill : stroke;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
  }
  ctx.putImageData(img, 0, 0);
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

// A 'Coming soon' window in the middle of the screen (black, over a dark shade): a title, a dim line saying what it
// will be, 'Coming soon' in gold. Tap anywhere to close; onClose runs then. Returns the container.
export function comingSoonWindow(scene, title, who, { w = 280, h = 160, depth = 3000, onClose = null } = {}) {
  const W = scene.scale.width, H = scene.scale.height, x = (W - w) / 2, y = (H - h) / 2, cx = W / 2;
  const shadeRect = scene.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0).setInteractive();
  const box = scene.add.container(0, 0, [
    shadeRect,
    drawWindow(scene.add.graphics(), x, y, w, h),
    uiText(scene, cx, y + 26, title, 'normal').setOrigin(0.5, 0),
    uiText(scene, cx, y + 56, who, 'small', UI.dim, { align: 'center', wordWrap: { width: w - 40 } }).setOrigin(0.5, 0),
    uiText(scene, cx, y + 92, 'Coming soon', 'normal', UI.gold).setOrigin(0.5, 0),
    uiText(scene, cx, y + h - 22, 'Tap to close', 'small', UI.dim).setOrigin(0.5, 0),
  ]).setDepth(depth);
  sfx.play('cardOpen');
  // A short wait, so the tap that opened it does not close it at once.
  scene.time.delayedCall(150, () => shadeRect.once('pointerup', () => { sfx.play('cardClose'); box.destroy(); if (onClose) onClose(); }));
  return box;
}
