// The shared interface look: dark panels with a gold frame and stepped corners (colours: config.js UI.goldTheme), a blinking
// ▶ cursor and Ironslab text (the game's own pixel font; small text in Press Start 2P). Every screen draws its windows, buttons and text through these helpers.
import Phaser from 'phaser';
import fontUrl from '../assets/fonts/ironslab.ttf?inline';
import smallFontUrl from '../assets/fonts/press-start-2p.woff2?inline';
import { UI } from '../config.js';
import * as sfx from '../audio/sfx.js';
import { popPlan, slidePlan, fadePlan, pagePlan, pageSide } from '../systems/motion.js';

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
  return Promise.all([load('Ironslab', fontUrl), load('PressStart2P', smallFontUrl)]);
}

// Ironslab is drawn on a 10px grid (capitals 8px tall), so it is only crisp at 10 / 20 / 30px. The scenes keep asking
// for the old Press Start 2P sizes (8 / 16 / 24px); every size is scaled by UI.fontGrid.scale and rounded to the grid
// (8 -> 10, 16 -> 20, 24 -> 30: the letters stay the same height). Done once, in Phaser's text style.
export function gridPx(size) {
  const G = UI.fontGrid;
  return Math.max(1, Math.round((parseFloat(size) * G.scale) / G.px)) * G.px;
}
// Small sizes (UI.smallFont.maxPx or less) switch to the small font (Press Start 2P) at its own size.
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
// plain = ignore the theme (exactly `fill` + `line`; the speech bubble).
export function drawWindow(g, x, y, w, h, { fill = UI.window, line = UI.line, alpha = 1, plain = false } = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  // A stepped (pixel-cornered) block `i` px inside the window, in colour c.
  const block = (i, c) => {
    const X = x + i, Y = y + i, W = w - 2 * i, H = h - 2 * i;
    if (W < 10 || H < 10) return;
    g.fillStyle(c, alpha);
    g.fillRect(X + 4, Y, W - 8, H).fillRect(X + 2, Y + 2, W - 4, H - 4).fillRect(X, Y + 4, W, H - 8);
  };
  if (plain) { block(0, line); block(2, fill); return g; }
  return themedWindow(g, x, y, w, h, block, { fill, line, alpha });
}

// THE THEMED window: a dark outline, a gold frame with a darker inner edge, a slate fill, pale gold studs on the corners.
// A window asked for with another line colour keeps that meaning: gold = chosen (pale gold frame), dim = grey frame.
function themedWindow(g, x, y, w, h, block, { fill, line, alpha }) {
  const T = UI.goldTheme;
  const frame = line === UI.line ? T.frame : line === 0x8a8a9a || line === 0x55556a ? T.dim : T.chosen;
  const body = fill === UI.window ? T.fill : fill === UI.pressed ? T.pressedFill : fill;
  block(0, T.outline); block(2, frame); block(4, T.frameDark); block(6, body);
  if (w >= 30 && h >= 26) {
    g.fillStyle(T.stud, alpha);
    for (const [cx, cy] of [[x + 4, y + 4], [x + w - 8, y + 4], [x + 4, y + h - 8], [x + w - 8, y + h - 8]]) g.fillRect(cx, cy, 4, 4);
  }
  return g;
}

// RARITY CARD FRAME (user, session 41: 'item boxes in their own rarity colour, a better border, legendary a bit
// shiny'): a dark outline, a 2px frame in the rarity's edge colour, a 1px light inner line (hi), a dark rarity-tinted
// body (rarities.json `frame`), and 4px corner studs (`stud` for epic / legendary, else hi). lit = the tapped card:
// the frame turns to the light colour. `R` = one rarities.json entry. Stepped pixel corners like every window.
export function drawRarityFrame(g, x, y, w, h, R, { lit = false } = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const F = R.frame, num = (c) => Number(c);
  const block = (i, c, t = 0) => {
    const X = x + i, Y = y + i, W = w - 2 * i, H = h - 2 * i;
    if (W < 10 || H < 10) return;
    g.fillStyle(c, 1).fillRect(X + 4, Y, W - 8, H).fillRect(X + 2, Y + 2, W - 4, H - 4).fillRect(X, Y + 4, W, H - 8);
  };
  block(0, UI.cardOutline);
  block(2, num(lit ? F.hi : F.edge));
  block(4, num(lit ? 0xffffff : F.hi));
  block(5, num(F.edge));
  block(6, num(F.fill));
  const stud = num(F.stud || F.hi);
  g.fillStyle(stud, 1);
  for (const [cx, cy] of [[x + 2, y + 2], [x + w - 6, y + 2], [x + 2, y + h - 6], [x + w - 6, y + h - 6]]) g.fillRect(cx, cy, 4, 4);
  return g;
}

// Mixes two 0xRRGGBB colours (t = 0 -> a, 1 -> b).
function mixColor(a, b, t) {
  let out = 0;
  for (const sh of [16, 8, 0]) out |= Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t) << sh;
  return out;
}
// A card frame set (like rarities.json `frame`) made from one colour: edge = it, hi = it mixed with white, fill = a dark
// tint of it (a hero's own colour on the reward 'Which skill?' boxes, heroes.json `color`).
export function tintFrame(color) {
  const c = Number(color);
  return { frame: { edge: c, hi: mixColor(c, 0xffffff, 0.55), fill: mixColor(c, 0x140c12, 0.84) } };
}

// LEGENDARY SHINE: a bright glint runs round the card's frame now and then, and two corner sparkles twinkle. Added to
// `parent` (a container at the card's top left); the tweens die with the parent. Returns the graphics.
export function rarityShine(scene, parent, w, h, R) {
  const S = UI.cardShine, hi = Number(R.frame.hi);
  const g = scene.add.graphics();
  parent.add(g);
  const per = 2 * (w + h), inset = 3;
  // a point `d` px along the frame (clockwise from the top left)
  const at = (d) => {
    d = ((d % per) + per) % per;
    if (d < w) return [d, inset];
    if (d < w + h) return [w - inset - 2, d - w];
    if (d < 2 * w + h) return [w - (d - w - h), h - inset - 2];
    return [inset, h - (d - 2 * w - h)];
  };
  const state = { t: 0, tw: 0 };
  const draw = () => {
    g.clear();
    if (state.t > 0 && state.t < 1) {
      const head = state.t * per;
      for (let k = 0; k < S.glintPx; k += 2) {
        const [px, py] = at(head - k);
        g.fillStyle(k < S.glintPx / 3 ? 0xffffff : hi, 1 - k / S.glintPx).fillRect(Math.round(px), Math.round(py), 2, 2);
      }
    }
    const a = Math.sin(state.tw * Math.PI); // the corner sparkles: a little + of light
    if (a > 0.05) for (const [cx, cy] of [[w - 4, 4], [4, h - 4]]) {
      g.fillStyle(0xffffff, a).fillRect(cx - 1, cy - 4, 2, 8).fillRect(cx - 4, cy - 1, 8, 2);
    }
  };
  scene.tweens.add({ targets: state, t: 1, duration: S.loopMs, repeat: -1, repeatDelay: S.pauseMs, onUpdate: draw });
  scene.tweens.add({ targets: state, tw: 1, duration: S.twinkleMs, repeat: -1, repeatDelay: S.twinkleGapMs, onUpdate: draw });
  return g;
}

// A solid BUTTON: a raised body with a light top edge and a darker bottom half. primary = THE main action of the screen (bright: BEGIN DESCENT); others are the calm secondary colour.
// pressed = pushed down. Returns g. Use buttonTextColor(enabled, pressed, primary) for its label.
export function drawButton(g, x, y, w, h, { pressed = false, enabled = true, primary = false } = {}) {
  const T = UI.goldTheme;
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const block = (i, c, top = 0, bottom = 0) => {
    const X = x + i, Y = y + i + top, W = w - 2 * i, H = h - 2 * i - top - bottom;
    if (W < 6 || H < 4) return;
    g.fillStyle(c, 1);
    g.fillRect(X + 4, Y, W - 8, H).fillRect(X + 2, Y + 2, W - 4, Math.max(0, H - 4)).fillRect(X, Y + 4, W, Math.max(0, H - 8));
  };
  block(0, T.outline);
  if (!enabled) { block(2, T.dim); return g; }
  const [body, dark, light] = primary ? [T.button, T.buttonDark, T.buttonLight] : [T.second, T.secondDark, T.secondLight];
  block(2, pressed ? dark : body);
  if (!pressed) { g.fillStyle(light, 1).fillRect(x + 6, y + 4, w - 12, 2); g.fillStyle(dark, 1).fillRect(x + 4, y + Math.round(h / 2) + 2, w - 8, Math.round(h / 2) - 6); }
  return g;
}
export const buttonTextColor = (enabled = true, pressed = false, primary = false) => (!enabled ? '#9a96a6' : primary ? UI.goldTheme.buttonText : UI.goldTheme.secondText);
// A title strip across the top of a panel h px tall, `i` px inside the panel's left/top edge.
export function drawStrip(g, x, y, w, h) {
  const T = UI.goldTheme;
  g.fillStyle(T.strip, 1).fillRect(x, y, w, h);
  g.fillStyle(T.stripLine, 1).fillRect(x, y + h, w, 2);
  return g;
}
// A gear (white, 28px across) centred on (m, n), for a Settings button. Returns g.
export function drawGear(g, m, n) {
  g.fillStyle(0xffffff, 1).fillRect(m - 9, n - 9, 18, 18).fillRect(m - 3, n - 14, 6, 28).fillRect(m - 14, n - 3, 28, 6);
  g.fillStyle(0x000000, 1).fillRect(m - 3, n - 3, 6, 6);
  return g;
}

// A filled disc made of 2px rows (crisp pixel edges, no smoothing), centred on (cx, cy). Returns g.
export function pixelDisc(g, cx, cy, r, color) {
  g.fillStyle(color, 1);
  for (let y = -r; y < r; y += 2) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r - (y + 1) * (y + 1))) / 2) * 2;
    g.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2, 2);
  }
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
    drawButton(g, 0, 0, w, h, { pressed, enabled });
    text.setColor(buttonTextColor(enabled, pressed));
    cur.clear();
    if (selected) drawCursor(cur, Math.round(w / 2 - text.width / 2 - 16), Math.round(h / 2), 0x000000);
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
  popIn(scene, box.list.slice(1), [shadeRect]);
  // A short wait, so the tap that opened it does not close it at once.
  scene.time.delayedCall(150, () => shadeRect.once('pointerup', () => {
    sfx.play('cardClose');
    popOut(scene, box.list.slice(1), [shadeRect], () => { box.destroy(); if (onClose) onClose(); });
  }));
  return box;
}

// Menu UI in and out (user: when a screen slides to the next, its buttons leave first, the new screen's buttons come in
// after; fast). `parts` = { up: [...], down: [...], fade: [...] }: `up` slide up and fade, `down` slide down and fade,
// `fade` only fade. show = false: out from where they are; show = true: in from off-set and invisible. `instant` puts
// them at the hidden spot at once (a screen that waits for its slide). onDone runs once when all are done.
export function uiShift(scene, parts, show, { ms = UI.motion.fast, dy = 28, instant = false, onDone = null } = {}) {
  const all = [];
  for (const [kind, list] of Object.entries(parts)) for (const o of list) if (o && o.active) all.push([o, kind === 'up' ? -dy : kind === 'down' ? dy : 0]);
  for (const [o] of all) if (!o.uiHome) o.uiHome = { y: o.y, alpha: o.alpha };
  if (instant) { for (const [o, off] of all) o.setAlpha(0).setY(o.uiHome.y + off); if (onDone) onDone(); return; }
  if (!all.length) { if (onDone) onDone(); return; }
  let left = all.length;
  const done = () => { if (--left === 0 && onDone) onDone(); };
  for (const [o, off] of all) {
    scene.tweens.add({ targets: o, y: o.uiHome.y + (show ? 0 : off), alpha: show ? o.uiHome.alpha : 0, duration: ms,
      ease: show ? UI.motion.easeOut : UI.motion.easeIn, onComplete: done });
  }
}

// MENU PAGE TRANSITIONS (user, session 41: like camp -> squad, in three beats). Opening: the camp's buttons leave
// (BaseScene.openOver), then the page slides in from its own side (UI.page.from; pageEnter, in its create(); its top bar is
// hidden meanwhile), then its top bar ('< CAMP', the Shop's gems) slides down into place. Closing (pageLeave(scene,
// done)): the top bar slides up and away, then the page slides back out the same side, then `done` resumes the camp,
// whose buttons come back in. Timing: systems/motion.js. A second close while leaving is ignored.
// The top bar = objects marked with markBar (each page marks its back button row when it draws it); tap zones stay put.
export const markBar = (list) => { for (const o of list) o.pageBar = true; return list; };
export function pageBar(scene) {
  const out = [];
  const walk = (list) => { for (const o of list) { if (o.pageBar) { if (o.type !== 'Zone') out.push(o); } else if (o.list) walk(o.list); } };
  walk(scene.children.list);
  return out;
}
export function pageEnter(scene) {
  scene.pageSide = pageSide(scene.scene.key, scene.from); // each page has its own side (UI.page.from)
  const P = pagePlan(true, scene.pageSide), cam = scene.cameras.main;
  scene.pageLeaving = false; // Phaser reuses a scene between visits: a fresh page can close again
  scene.input.enabled = true;
  uiShift(scene, { up: pageBar(scene) }, false, { instant: true }); // the bar waits until the page is in
  cam[P.axis] = P.from; // the page waits one screen away, then slides over the screen behind
  scene.tweens.add({ targets: cam, [P.axis]: P.to, duration: P.ms, ease: P.ease });
  scene.time.delayedCall(P.ms, () => { if (!scene.pageLeaving) uiShift(scene, { up: pageBar(scene) }, true); });
}
export function pageLeave(scene, done) {
  if (scene.pageLeaving) return;
  scene.pageLeaving = true;
  const P = pagePlan(false, scene.pageSide), cam = scene.cameras.main;
  scene.input.enabled = false; // no taps while it goes
  uiShift(scene, { up: pageBar(scene) }, false, { onDone: () => { // the bar leaves first, then the page
    scene.tweens.add({ targets: cam, [P.axis]: P.to, duration: P.ms, ease: P.ease });
    scene.time.delayedCall(P.ms, done);
  } });
}

// The objects' resting spot (x, y, alpha), saved the first time a helper moves them.
const home = (o) => (o.motionHome ||= { x: o.x, y: o.y, alpha: o.alpha });
const live = (list) => (list || []).filter((o) => o && o.active);

// POP-UP WINDOW IN (user, session 41: drops from above): `parts` (the window, its text...) drop in from
// UI.motion.popDropPx above and settle; `shades` (the dark cover) only fade in. A tap while it drops finishes it at
// once (never trap the player). onDone runs when it has landed.
export function popIn(scene, parts, shades = [], onDone = null) {
  const P = popPlan(true), box = live(parts), sh = live(shades), tweens = [];
  for (const o of box) { const h = home(o); o.setY(h.y + P.box.fromDy).setAlpha(h.alpha * P.box.fromAlpha); }
  for (const o of sh) { const h = home(o); o.setAlpha(h.alpha * P.shade.fromAlpha); }
  let left = box.length + sh.length;
  const finish = () => { scene.input.off('pointerdown', skip); if (onDone) onDone(); };
  const skip = () => { for (const t of tweens) if (t.isPlaying()) t.complete(); };
  const one = () => { if (--left === 0) finish(); };
  if (!left) { if (onDone) onDone(); return; }
  scene.input.on('pointerdown', skip);
  for (const o of box) tweens.push(scene.tweens.add({ targets: o, y: home(o).y, alpha: home(o).alpha, duration: P.ms, ease: P.box.ease, onComplete: one }));
  for (const o of sh) tweens.push(scene.tweens.add({ targets: o, alpha: home(o).alpha, duration: P.ms, ease: P.shade.ease, onComplete: one }));
}

// POP-UP WINDOW OUT: the reverse of popIn (the window lifts back up and fades, the shade fades), then onDone (destroy
// it there). Taps on the window are off while it goes.
export function popOut(scene, parts, shades = [], onDone = null) {
  const P = popPlan(false), box = live(parts), sh = live(shades);
  let left = box.length + sh.length;
  if (!left) { if (onDone) onDone(); return; }
  const one = () => { if (--left === 0 && onDone) onDone(); };
  for (const o of [...box, ...sh]) { scene.tweens.killTweensOf(o); if (o.input) o.disableInteractive(); }
  for (const o of box) scene.tweens.add({ targets: o, y: home(o).y + P.box.toDy, alpha: 0, duration: P.ms, ease: P.box.ease, onComplete: one });
  for (const o of sh) scene.tweens.add({ targets: o, alpha: 0, duration: P.ms, ease: P.shade.ease, onComplete: one });
}

// TAB / CHAPTER CONTENT SWAP (user, session 41: slides SIDEWAYS; the frame stays still): `outParts` slide away and
// fade, `inParts` come in from the other side. dir = +1 next tab (content moves left), -1 back (moves right). The old
// parts are destroyed when gone unless keepOut. onDone runs when the new content has arrived.
export function slideSwap(scene, outParts, inParts, dir = 1, { keepOut = false, onDone = null } = {}) {
  const P = slidePlan(dir), olds = live(outParts), news = live(inParts);
  for (const o of news) { const h = home(o); o.setX(h.x + P.in.fromDx).setAlpha(h.alpha * P.in.fromAlpha); }
  for (const o of olds) {
    const h = home(o);
    scene.tweens.killTweensOf(o);
    scene.tweens.add({ targets: o, x: h.x + P.out.toDx, alpha: 0, duration: P.ms, ease: P.out.ease,
      onComplete: () => { if (keepOut) o.setX(h.x); else o.destroy(); } });
  }
  let left = news.length;
  if (!left) { if (onDone) onDone(); return; }
  for (const o of news) scene.tweens.add({ targets: o, x: home(o).x, alpha: home(o).alpha, duration: P.ms, ease: P.in.ease,
    onComplete: () => { if (--left === 0 && onDone) onDone(); } });
}

// SCENE TO SCENE: fade to black (taps off), then start `key` with `data`. sceneFadeIn: the new scene fades in from
// black (call it in create()). kind = a UI.motion token ('normal' by default).
export function sceneFade(scene, key, data, kind = 'normal') {
  const cam = scene.cameras.main;
  scene.input.enabled = false;
  cam.fadeOut(fadePlan(kind).outMs, 0, 0, 0);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data));
}
export function sceneFadeIn(scene, kind = 'normal') {
  scene.input.enabled = true;
  scene.cameras.main.fadeIn(fadePlan(kind).inMs, 0, 0, 0);
}
