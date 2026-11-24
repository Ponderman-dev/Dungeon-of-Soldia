// The CREDITS and HELP windows (Settings > MORE). Data: src/data/info.json. A tall window over the screen: the title,
// then sections (a gold head + lines) that scroll with a finger drag (or the mouse wheel) when they are taller than
// the window, a thin bar on the right showing where you are, and CLOSE at the bottom.
import { UI } from '../config.js';
import info from '../data/info.json';
import glossary from '../data/glossary.json';
import { drawWindow, uiText, popIn, popOut } from './uiKit.js';
import * as sfx from '../audio/sfx.js';

// The sections of a window: help adds the glossary's basics it names (their text lives in glossary.json).
export function infoSections(kind) {
  const d = info[kind];
  const basics = (d.fromGlossary || []).map((t) => glossary.basics.find((b) => b.title === t)).filter(Boolean)
    .map((b) => ({ head: b.title, lines: [b.text] }));
  return [...basics, ...d.sections];
}

export function infoWindow(scene, kind, { depth = 3000, onClose = null } = {}) {
  const L = info.layout, d = info[kind];
  const W = scene.scale.width, H = scene.scale.height;
  const x = L.side, y = L.top, w = W - 2 * L.side, h = H - L.top - L.bottom;
  const shade = scene.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0).setInteractive();
  const frame = drawWindow(scene.add.graphics(), x, y, w, h);
  const title = uiText(scene, W / 2, y + L.titleY, d.title, 'normal').setOrigin(0.5, 0);
  // the text, in a container that scrolls inside the view (masked)
  const viewTop = y + L.bodyTop, viewBot = y + h - L.closeH - 12, viewH = viewBot - viewTop;
  const body = scene.add.container(0, 0);
  let ty = viewTop;
  const tw = w - 2 * L.pad - 8;
  infoSections(kind).forEach((s, i) => {
    if (i) ty += L.sectionGap;
    const head = uiText(scene, x + L.pad, ty, s.head, 'small', UI.gold);
    body.add(head); ty += L.headGap;
    for (const line of s.lines) {
      const t = uiText(scene, x + L.pad, ty, line, 'small', UI.text, { wordWrap: { width: tw }, lineSpacing: 6 });
      body.add(t); ty += t.height + L.lineGap;
    }
  });
  const contentH = ty - viewTop, maxScroll = Math.max(0, contentH - viewH);
  const maskG = scene.make.graphics({ add: false }).fillStyle(0xffffff, 1).fillRect(x + 4, viewTop - 4, w - 8, viewH + 8);
  body.enableFilters().filters.external.addMask(maskG);
  const bar = scene.add.graphics();
  let scroll = 0;
  const setScroll = (v) => {
    scroll = Math.max(0, Math.min(maxScroll, v)); body.y = -scroll;
    bar.clear(); if (!maxScroll) return;
    const bh = Math.max(24, viewH * viewH / contentH), by = viewTop + (viewH - bh) * (scroll / maxScroll);
    bar.fillStyle(0x55556a, 1).fillRect(x + w - L.pad / 2 - L.bar, viewTop, L.bar, viewH);
    bar.fillStyle(Number('0x' + UI.gold.slice(1)), 1).fillRect(x + w - L.pad / 2 - L.bar, Math.round(by), L.bar, Math.round(bh));
  };
  setScroll(0);
  // drag to scroll (anywhere on the window)
  let drag = null;
  const down = (p) => { if (p.y >= viewTop && p.y <= viewBot) drag = { y: p.y, s: scroll }; };
  const move = (p) => { if (drag && p.isDown) setScroll(drag.s - (p.y - drag.y)); };
  const up = () => { drag = null; };
  const wheel = (p, o, dx, dy) => setScroll(scroll + dy);
  scene.input.on('pointerdown', down); scene.input.on('pointermove', move); scene.input.on('pointerup', up); scene.input.on('wheel', wheel);
  // CLOSE
  const cy = y + h - L.closeH - 8;
  const closeG = drawWindow(scene.add.graphics(), x + L.pad, cy, w - 2 * L.pad, L.closeH);
  const closeT = uiText(scene, W / 2, cy + L.closeH / 2, 'CLOSE', 'normal').setOrigin(0.5);
  const closeZ = scene.add.zone(W / 2, cy + L.closeH / 2, w - 2 * L.pad, L.closeH).setInteractive({ useHandCursor: true });
  const parts = [frame, title, body, bar, closeG, closeT]; // (the tap zone has no alpha: it stays out of the pop motion)
  const box = scene.add.container(0, 0, [shade, ...parts, closeZ]).setDepth(depth);
  sfx.play('cardOpen');
  popIn(scene, parts, [shade]);
  let closing = false;
  closeZ.on('pointerup', () => {
    if (closing) return; closing = true;
    sfx.play('cardClose');
    scene.input.off('pointerdown', down); scene.input.off('pointermove', move); scene.input.off('pointerup', up); scene.input.off('wheel', wheel);
    popOut(scene, parts, [shade], () => { box.destroy(); maskG.destroy(); if (onClose) onClose(); });
  });
  return box;
}
