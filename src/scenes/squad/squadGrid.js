// SQUAD SCREEN: THE HERO GRID (session 47: the user picked layout C of the A/B/C trial, 'make it neater', then the
// TEASER way of showing locked heroes). Under the squad (standing in front of the gate) every OPEN hero is a framed
// TILE with the hero standing in it, plus ONE '?' tile: the locked hero closest to unlocking (nextUnlock), with its
// goal in two tiny lines. QUIET TILES (user: the grid 'looks busy and crowded'): a plain dark tile with a thin dark
// edge and a soft shadow under the hero (no gold frame, no studs); only a picked hero's tile gets the gold edge + a
// check mark. NEW = a green tag. A tap opens the details card.
// ONE ROW THAT SCROLLS (user: 'just make the hero grid scrollable', after two rows of 10 felt crowded): big tiles
// in a single row; when they fit (a new player: 3 + '?') the row is centred and still; when they do not, swipe it
// left / right (a swipe never taps a tile: cancelPress), a small gold scroll bar under it shows where you are. The
// row is centred in the space between the names and BEGIN DESCENT.
// Mixed into SquadScene.prototype (like roomMethods.js into BattleScene).
import { GAME_WIDTH, UI } from '../../config.js';
import { drawFlatButton, buttonTextColor, uiText, pressable } from '../../entities/uiKit.js';
import Character from '../../entities/Character.js';
import heroDefs from '../../data/heroes.json';
import unlocks from '../../data/unlocks.json';
import { perkMods } from '../../systems/party.js';
import { shortGoal, nextUnlock } from '../../systems/progress.js';

const FONT = UI.font, INK = UI.text, MUTE = '#a8a8b8';
const STAT_SHORT = { attack: 'ATK', health: 'HP', defense: 'DEF', resist: 'RES', evasion: 'EVA', crit: 'CRIT', attackEfficiency: 'SPD' };
export const SQUAD_DEPTH = { floor: 0, slot: 1, bench: 2, hero: 5, doorFront: 8, ui: 20, panel: 40 };
const D = SQUAD_DEPTH;

// The squad's feet (slot order = battle order) and size; how far off the screen edge a hero walks in from;
// lockedWash = the grey of the '?' hero's shape; edge = how close a name may come to the screen side. grid: the area
// it is centred in (from the name style's gridTop to bottom), the tile size (max width, height, feet, hero scale), the
// gap, the most tiles in a row.
export const SQUAD_VIEW = {
  slots: [{ x: 90, y: 350 }, { x: GAME_WIDTH / 2, y: 336 }, { x: GAME_WIDTH - 90, y: 350 }], // outer ones nearer the middle (user)
  heroScale: 4, sideOffPx: 48, lockedWash: 0x4a4458, edge: 8,
  lockedCard: { h: 350, goalY: 250, barY: 296, barH: 8 }, // a locked hero's small card (SquadScene.lockedCardBody)
  grid: { bottom: 606, w: 84, h: 124, foot: 112, tileScale: 4, gap: 12, side: 8, shadowW: 52, dragPx: 8,
    bar: { w: 120, h: 4, gap: 12 }, // bar = the scroll bar under the row (gap = from the row)
    // SCROLL HINTS (user: 'not clear how people will know to scroll'): arrow tabs on the row's ends (only where more is
    // hidden; tap = one tile along), darker edges there, and a nudge when the screen opens (the row slides nudgePx
    // left and back after nudgeDelayMs).
    hint: { tabW: 16, tabH: 36, shade: [0.55, 0.35, 0.18], shadeW: 6, nudgePx: 44, nudgeDelayMs: 700, nudgeMs: 380, stepMs: 220 } },
  // The quiet tile's colours: fill, edge, a picked tile's edge, the '?' tile's edge, a pushed tile's fill.
  tile: { fill: 0x16110f, edge: 0x3a2a22, picked: 0xd8a640, locked: 0x2e2a30, pressed: 0x2a201c, shadow: 0.35 },
};
// THE NAMES UNDER THE SQUAD ('slope', the user's pick of 3, session 47): big names, the middle one a row higher
// (following the V of the heroes), the outer ones kept on the screen, a small X button beside each = send back.
export const NAMES = { middleY: 354, outerY: 382, xSize: 22, xGap: 6, gridTop: 404 };
const G = SQUAD_VIEW.grid;

const text = (scene, x, y, str, color = INK) => scene.add.text(x, y, str, { fontFamily: FONT, fontSize: '8px', color });

export const squadGrid = {
  // The team perk as a short line ('+10% ATK').
  perkLine(def) {
    return perkMods({ def, level: 1 }).map((m) => `${m.percent !== undefined ? `+${m.percent}%` : `+${m.flat}`} ${STAT_SHORT[m.stat] || ({ skillDamage: 'skill dmg', regen: 'HP/s', dotDamage: 'DoT dmg' })[m.special] || m.special}`).join(', ');
  },

  // The tiles: every open hero, then the '?' (the locked hero closest to unlocking). hidden = locked heroes not shown.
  tileList() {
    // The starting heroes first (Knight, Rogue, Archer: unlocks.json start), then the others in heroes.json order
    // (user: Berserker next to Archer, not next to Knight).
    const order = [...unlocks.start, ...heroDefs.map((h) => h.id).filter((id) => !unlocks.start.includes(id))];
    const open = order.filter((id) => this.unlocked(id));
    const locked = heroDefs.length - open.length;
    const next = nextUnlock(heroDefs, this.progress, unlocks);
    return { ids: next ? [...open, next] : open, hidden: locked - (next ? 1 : 0) };
  },

  // (Re)builds the row: every tile in a container (masked to the screen between the side gaps) that scrolls sideways;
  // the scroll bar and the 'n more heroes to find' line under it. Returns its parts (also kept in this.gridParts).
  buildGrid() {
    (this.gridParts || []).forEach((o) => o.destroy());
    const parts = (this.gridParts = []);
    this.tiles = new Map();
    const { ids, hidden } = this.tileList();
    const B = G.bar, viewW = GAME_WIDTH - 2 * G.side;
    const rowW = ids.length * G.w + (ids.length - 1) * G.gap;
    this.gridMax = Math.max(0, rowW - viewW); // how far the row can scroll
    const blockH = G.h + B.gap + B.h + (hidden > 0 ? 20 : 0);
    const top = NAMES.gridTop + Math.max(0, Math.round((G.bottom - NAMES.gridTop - blockH) / 2));
    this.gridTopY = top;
    const x0 = this.gridMax ? G.side : Math.round((GAME_WIDTH - rowW) / 2);
    const box = (this.gridBox = this.add.container(0, 0).setDepth(D.ui));
    ids.forEach((id, i) => box.add(this.makeTile(id, x0 + i * (G.w + G.gap), top, G.w, G.h)));
    const maskG = this.make.graphics({ add: false }).fillStyle(0xffffff, 1).fillRect(G.side - 2, top - 4, viewW + 4, G.h + 8);
    box.setMask(maskG.createGeometryMask());
    this.gridScroll = 0;
    this.gridBar = this.add.graphics().setDepth(D.ui);
    this.gridShade = this.add.graphics().setDepth(D.ui + 1); // the darker edges where more is hidden
    parts.push(box, this.gridBar, this.gridShade);
    this.gridTabs = [-1, 1].map((dir) => { // the arrow tabs: push in, scroll one tile along
      const H = G.hint, tx = dir < 0 ? G.side - 2 : GAME_WIDTH - G.side + 2 - H.tabW, ty = top + Math.round((G.h - H.tabH) / 2);
      const tg = this.add.graphics().setDepth(D.ui + 2);
      const tab = { dir, g: tg, x: tx, y: ty, pressed: false };
      tab.draw = () => {
        tg.clear();
        const more = dir < 0 ? this.gridScroll > 0 : this.gridScroll < this.gridMax;
        tab.hit.setVisible(more);
        if (!more) return;
        drawFlatButton(tg, tx, ty, H.tabW, H.tabH, { pressed: tab.pressed });
        const cx = tx + H.tabW / 2, cy = ty + H.tabH / 2 + (tab.pressed ? UI.press.sinkPx : 0); // a pixel arrow < or >
        tg.fillStyle(Number('0x' + buttonTextColor().slice(1)), 1);
        for (let i = 0; i < 3; i++) tg.fillRect(cx - dir * (2 - i) * 2 - 1, cy - 5 + i * 2, 2, 2).fillRect(cx - dir * (2 - i) * 2 - 1, cy + 3 - i * 2, 2, 2); // a small pixel < or >
      };
      tab.hit = this.add.zone(tx + H.tabW / 2, ty + H.tabH / 2, H.tabW + 12, H.tabH).setInteractive().setDepth(D.ui + 2);
      pressable(this, tab.hit, { redraw: (p) => { tab.pressed = p; tab.draw(); }, enabled: () => tab.hit.visible && !this.panel && !this.leaving,
        onTap: () => this.glideGrid(this.gridScroll + dir * (G.w + G.gap), G.hint.stepMs) });
      parts.push(tg, tab.hit);
      return tab;
    });
    if (hidden > 0) parts.push(text(this, GAME_WIDTH / 2, top + G.h + B.gap + B.h + 8, `${hidden} more heroes to find`, MUTE).setOrigin(0.5, 0).setDepth(D.ui));
    this.scrollGrid(0);
    if (this.gridMax && !this.gridNudged) { // once per visit: the row slides a little left and back (it can move)
      this.gridNudged = true;
      this.time.delayedCall(G.hint.nudgeDelayMs, () => {
        if (this.gridDrag || this.gridScroll) return;
        this.glideGrid(G.hint.nudgePx, G.hint.nudgeMs / 2, () => this.glideGrid(0, G.hint.nudgeMs / 2));
      });
    }
    return parts;
  },

  // Slides the row to x over ms (eased), then calls done.
  glideGrid(x, ms, done = null) {
    if (this.gridGlide) this.gridGlide.stop();
    const from = this.gridScroll, to = clamp(x, 0, this.gridMax);
    this.gridGlide = this.tweens.addCounter({ from: 0, to: 1, duration: ms, ease: 'Sine.easeInOut',
      onUpdate: (tw) => this.scrollGrid(from + (to - from) * tw.getValue()),
      onComplete: () => { this.gridGlide = null; if (done) done(); } });
  },

  // Scrolls the row to x (clamped, whole pixels) and redraws the scroll bar (hidden when nothing scrolls).
  scrollGrid(x) {
    this.gridScroll = clamp(Math.round(x), 0, this.gridMax);
    this.gridBox.x = -this.gridScroll;
    const B = G.bar, g = this.gridBar.clear(), sh = this.gridShade.clear(), H = G.hint;
    if (this.gridTabs) this.gridTabs.forEach((t) => t.draw());
    if (!this.gridMax) return;
    const y0 = this.gridTopY - 2, hh = G.h + 4; // darker steps at an edge with more hidden behind it
    H.shade.forEach((a, k) => {
      if (this.gridScroll > 0) sh.fillStyle(0x000000, a).fillRect(G.side - 2 + k * H.shadeW, y0, H.shadeW, hh);
      if (this.gridScroll < this.gridMax) sh.fillStyle(0x000000, a).fillRect(GAME_WIDTH - G.side + 2 - (k + 1) * H.shadeW, y0, H.shadeW, hh);
    });
    const viewW = GAME_WIDTH - 2 * G.side, rowW = this.gridMax + viewW;
    const bx = Math.round((GAME_WIDTH - B.w) / 2), by = this.gridTopY + G.h + B.gap;
    const tw = Math.max(16, Math.round((B.w * viewW) / rowW)), tx = bx + Math.round(((B.w - tw) * this.gridScroll) / this.gridMax);
    g.fillStyle(0x000000, 0.6).fillRect(bx - 1, by - 1, B.w + 2, B.h + 2).fillStyle(SQUAD_VIEW.tile.edge, 1).fillRect(bx, by, B.w, B.h);
    g.fillStyle(SQUAD_VIEW.tile.picked, 1).fillRect(tx, by, tw, B.h);
  },

  // Swiping the row (SquadScene.setupInput calls these): a drag past dragPx cancels the tile press under the finger.
  gridDown(p) {
    if (this.gridTabs && this.gridTabs.some((t) => t.hit.visible && Math.abs(p.x - t.hit.x) <= t.hit.width / 2)) return; // on an arrow tab
    if (this.gridGlide) { this.gridGlide.stop(); this.gridGlide = null; }
    if (!this.gridMax || this.panel || this.leaving || p.y < this.gridTopY || p.y > this.gridTopY + G.h) return;
    this.gridDrag = { x: p.x, from: this.gridScroll, moved: false };
  },
  gridMove(p) {
    const d = this.gridDrag;
    if (!d || !p.isDown) return;
    if (!d.moved && Math.abs(p.x - d.x) > G.dragPx) { d.moved = true; for (const t of this.tiles.values()) t.hit.cancelPress(); }
    if (d.moved) this.scrollGrid(d.from - (p.x - d.x));
  },
  gridUp() { this.gridDrag = null; },

  // One tile. Returns its parts; the tile goes in this.tiles.
  makeTile(id, x, y, w, h) {
    const def = heroDefs.find((d) => d.id === id);
    const open = this.unlocked(id);
    const g = this.add.graphics().setDepth(D.ui);
    const shadow = this.add.ellipse(x + w / 2, y + G.foot, G.shadowW, 10, 0x000000, SQUAD_VIEW.tile.shadow).setDepth(D.ui);
    const ch = new Character(this, x + w / 2, y + G.foot, def).setDepth(D.ui);
    ch.setScale(G.tileScale);
    ch.setWash(SQUAD_VIEW.lockedWash, open ? 0 : 1);
    const mark = this.add.graphics().setDepth(D.ui + 1); // the check mark of a picked hero
    const out = [g, shadow, ch, mark];
    if (!open) { // the '?' tile: a big gold '?' and the goal in two tiny lines
      out.push(this.add.text(x + w / 2, y + 18, '?', { fontFamily: FONT, fontSize: '16px', color: UI.gold, stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setDepth(D.ui + 1));
      const req = unlocks.requirements[id];
      if (req) shortGoal(req, unlocks).forEach((line, k) => out.push(text(this, x + w / 2, y + h - 28 + k * 12, line, UI.gold).setOrigin(0.5, 0).setStroke('#000000', 3).setDepth(D.ui + 1)));
    }
    // NEW: a green tag drawn behind black text (a text backgroundColor is lost to the small font's pixel snapping).
    const tag = this.add.container(x + w / 2, y + 4).setDepth(D.ui + 1);
    tag.add([this.add.graphics().fillStyle(0x6ee07a, 1).fillRect(-16, 0, 32, 14), text(this, 1, 8, 'NEW', '#000000').setOrigin(0.5)]);
    out.push(tag);
    const tile = { id, g, ch, mark, tag, x, y, w, h, pressed: false, hit: null };
    tile.draw = () => {
      const picked = this.slots.includes(id);
      const C = SQUAD_VIEW.tile, T = UI.goldTheme;
      g.clear().fillStyle(T.outline, 1).fillRect(x - 2, y - 2, w + 4, h + 4); // the quiet tile: outline, edge, fill
      g.fillStyle(picked ? C.picked : open ? C.edge : C.locked, 1).fillRect(x, y, w, h);
      g.fillStyle(tile.pressed ? C.pressed : C.fill, 1).fillRect(x + 2, y + 2, w - 4, h - 4);
      mark.clear();
      if (picked) { // a gold check mark in the top right corner (2px pixels) on a dark square
        mark.fillStyle(0x000000, 1).fillRect(x + w - 22, y + 8, 16, 14);
        mark.fillStyle(0xffd84a, 1);
        [[0, 4], [2, 6], [4, 4], [6, 2], [8, 0]].forEach(([dx, dy]) => mark.fillRect(x + w - 19 + dx, y + 10 + dy, 2, 4));
      }
      tag.setVisible(open && !picked && this.isNew(id));
    };
    const hit = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive().setDepth(D.ui);
    pressable(this, hit, { redraw: (p) => { tile.pressed = p; tile.draw(); }, sink: [ch], onTap: () => this.openPanel(id), enabled: () => !this.panel && !this.leaving });
    tile.hit = hit;
    this.tiles.set(id, tile);
    tile.draw();
    return [...out, hit];
  },

  // The labels under the squad (NAMES): per slot a big name, the X button's graphics and a tap zone on it that sends
  // the hero back (it pushes in: pressable). Returns their parts.
  buildLabels() {
    const out = [];
    this.labels = SQUAD_VIEW.slots.map((s, i) => {
      const big = uiText(this, 0, 0, '', 'normal', UI.goldTheme.title, { stroke: '#120c0a', strokeThickness: 5 }).setOrigin(0.5).setDepth(D.ui + 1);
      const g = this.add.graphics().setDepth(D.ui);
      const hit = this.add.zone(0, 0, 10, 10).setInteractive().setDepth(D.ui + 1);
      const L = { big, g, hit, pressed: false };
      pressable(this, hit, {
        redraw: (p) => { L.pressed = p; this.drawLabel(i); },
        enabled: () => { const id = this.slots[i]; return !!id && !this.walkers.has(id) && !this.panel && !this.leaving; },
        onTap: () => { const id = this.slots[i]; if (id && !this.walkers.has(id)) this.sendBack(id); },
      });
      out.push(big, g);
      return L;
    });
    return out;
  },

  // A small pixel X (2px squares) centred on (cx, cy).
  drawX(g, cx, cy, color) {
    g.fillStyle(color, 1);
    for (let k = -2; k <= 2; k++) g.fillRect(cx + 2 * k - 1, cy + 2 * k - 1, 2, 2).fillRect(cx + 2 * k - 1, cy - 2 * k - 1, 2, 2);
  },

  // One slot's label (hidden while its hero walks, or with nobody there).
  drawLabel(i) {
    const L = this.labels[i], s = SQUAD_VIEW.slots[i], id = this.slots[i], N = NAMES;
    const show = !!id && !this.walkers.has(id) && !this.descending;
    L.g.clear();
    L.big.setVisible(show);
    if (!show) { L.hit.setPosition(-50, -50); return; }
    const ink = Number('0x' + buttonTextColor().slice(1)), sink = L.pressed ? UI.press.sinkPx : 0, edge = SQUAD_VIEW.edge;
    const y = i === 1 ? N.middleY : N.outerY;
    L.big.setText(heroDefs.find((h) => h.id === id).name);
    const total = Math.ceil(L.big.width) + N.xGap + N.xSize;
    const left = clamp(s.x - total / 2, edge, GAME_WIDTH - edge - total);
    L.big.setPosition(Math.round(left + L.big.width / 2), y);
    const bx = Math.round(left + total - N.xSize), by = Math.round(y - N.xSize / 2);
    drawFlatButton(L.g, bx, by, N.xSize, N.xSize, { pressed: L.pressed });
    this.drawX(L.g, bx + N.xSize / 2, by + N.xSize / 2 + sink, ink);
    L.hit.setPosition(bx + N.xSize / 2, by + N.xSize / 2).setSize(N.xSize + 12, N.xSize + 12);
  },

  drawNames() {
    this.slots.forEach((id, i) => this.drawLabel(i));
  },
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
