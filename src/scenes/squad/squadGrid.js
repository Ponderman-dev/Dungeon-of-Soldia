// SQUAD SCREEN: THE HERO GRID (session 47: the user picked layout C of the A/B/C trial, 'make it neater', then the
// TEASER way of showing locked heroes). Under the squad (standing in front of the gate) every OPEN hero is a framed
// TILE with the hero standing in it, plus ONE '?' tile: the locked hero closest to unlocking (nextUnlock), with its
// goal in two tiny lines. QUIET TILES (user: the grid 'looks busy and crowded'): a plain dark tile with a thin dark
// edge and a soft shadow under the hero (no gold frame, no studs); only a picked hero's tile gets the gold edge + a
// check mark. NEW = a green tag. A tap opens the details card.
// The grid ADAPTS to how many tiles there are (user: 'adaptable for every hero we unlocked'): up to 4 in one row,
// more in two balanced rows (5 = 3 + 2 ... 10 = 5 + 5), tiles as wide as fits (max grid.maxW), the whole block
// centred in the space between the Send back row and BEGIN DESCENT.
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
  grid: { bottom: 662, maxW: 80, h: 100, foot: 88, tileScale: 3, gap: 12, maxCols: 5, side: 14 },
  // The quiet tile's colours: fill, edge, a picked tile's edge, the '?' tile's edge, a pushed tile's fill.
  tile: { fill: 0x16110f, edge: 0x3a2a22, picked: 0xd8a640, locked: 0x2e2a30, pressed: 0x2a201c, shadow: 0.35 },
};
// THE NAMES UNDER THE SQUAD ('slope', the user's pick of 3, session 47): big names, the middle one a row higher
// (following the V of the heroes), the outer ones kept on the screen, a small X button beside each = send back.
export const NAMES = { middleY: 354, outerY: 382, xSize: 22, xGap: 6, gridTop: 404 };
const G = SQUAD_VIEW.grid;

// How the grid lays out n tiles: columns (up to 4 = one row; more = two balanced rows) and the tile width.
export function gridShape(n) {
  const cols = Math.max(1, n <= 4 ? n : Math.min(G.maxCols, Math.ceil(n / 2)));
  const w = Math.min(G.maxW, Math.floor((GAME_WIDTH - 2 * G.side - (cols - 1) * G.gap) / cols));
  return { cols, rows: Math.ceil(n / cols), w };
}

const text = (scene, x, y, str, color = INK) => scene.add.text(x, y, str, { fontFamily: FONT, fontSize: '8px', color });

export const squadGrid = {
  // The team perk as a short line ('+10% ATK').
  perkLine(def) {
    return perkMods({ def, level: 1 }).map((m) => `${m.percent !== undefined ? `+${m.percent}%` : `+${m.flat}`} ${STAT_SHORT[m.stat] || ({ skillDamage: 'skill dmg', regen: 'HP/s', dotDamage: 'DoT dmg' })[m.special] || m.special}`).join(', ');
  },

  // The tiles: every open hero, then the '?' (the locked hero closest to unlocking). hidden = locked heroes not shown.
  tileList() {
    const open = heroDefs.filter((h) => this.unlocked(h.id)).map((h) => h.id);
    const locked = heroDefs.length - open.length;
    const next = nextUnlock(heroDefs, this.progress, unlocks);
    return { ids: next ? [...open, next] : open, hidden: locked - (next ? 1 : 0) };
  },

  // (Re)builds the grid (gridShape): rows centred across, the block centred in grid.top..bottom; with one row there is
  // room for an 'n more heroes to find' line under it. Returns its parts (also kept in this.gridParts).
  buildGrid() {
    (this.gridParts || []).forEach((o) => o.destroy());
    const parts = (this.gridParts = []);
    this.tiles = new Map();
    const { ids, hidden } = this.tileList();
    const { cols, rows, w } = gridShape(ids.length);
    const line = hidden > 0 && rows === 1;
    const blockH = rows * G.h + (rows - 1) * G.gap + (line ? 22 : 0);
    const gTop = NAMES.gridTop;
    const top = gTop + Math.max(0, Math.round((G.bottom - gTop - blockH) / 2));
    ids.forEach((id, i) => {
      const row = Math.floor(i / cols), inRow = Math.min(cols, ids.length - row * cols);
      const x0 = Math.round((GAME_WIDTH - (inRow * w + (inRow - 1) * G.gap)) / 2);
      parts.push(...this.makeTile(id, x0 + (i % cols) * (w + G.gap), top + row * (G.h + G.gap), w, G.h));
    });
    if (line) parts.push(text(this, GAME_WIDTH / 2, top + G.h + 12, `${hidden} more heroes to find`, MUTE).setOrigin(0.5, 0).setDepth(D.ui));
    return parts;
  },

  // One tile. Returns its parts; the tile goes in this.tiles.
  makeTile(id, x, y, w, h) {
    const def = heroDefs.find((d) => d.id === id);
    const open = this.unlocked(id);
    const g = this.add.graphics().setDepth(D.ui);
    const shadow = this.add.ellipse(x + w / 2, y + G.foot, 40, 8, 0x000000, SQUAD_VIEW.tile.shadow).setDepth(D.ui);
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
    const tile = { id, g, ch, mark, tag, x, y, w, h, pressed: false };
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
