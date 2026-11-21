// SQUAD SCREEN: THE HERO GRID (session 47: the user picked layout C of the A/B/C trial, 'make it neater', then the
// TEASER way of showing locked heroes). Under the squad (standing in front of the gate) every OPEN hero is a framed
// TILE with the hero standing in it, plus ONE '?' tile: the locked hero closest to unlocking (nextUnlock), with its
// goal in two tiny lines. Picked = gold frame + a check mark; NEW = a green tag. A tap opens the details card.
// The grid ADAPTS to how many tiles there are (user: 'adaptable for every hero we unlocked'): up to 4 in one row,
// more in two balanced rows (5 = 3 + 2 ... 10 = 5 + 5), tiles as wide as fits (max grid.maxW), the whole block
// centred in the space between the Send back row and BEGIN DESCENT.
// Mixed into SquadScene.prototype (like roomMethods.js into BattleScene).
import { GAME_WIDTH, UI } from '../../config.js';
import { drawWindow, pressable } from '../../entities/uiKit.js';
import Character from '../../entities/Character.js';
import heroDefs from '../../data/heroes.json';
import unlocks from '../../data/unlocks.json';
import { perkMods } from '../../systems/party.js';
import { shortGoal, nextUnlock } from '../../systems/progress.js';

const FONT = UI.font, INK = UI.text, MUTE = '#a8a8b8';
const STAT_SHORT = { attack: 'ATK', health: 'HP', defense: 'DEF', resist: 'RES', evasion: 'EVA', crit: 'CRIT', attackEfficiency: 'SPD' };
export const SQUAD_DEPTH = { floor: 0, slot: 1, bench: 2, hero: 5, doorFront: 8, ui: 20, panel: 40 };
const D = SQUAD_DEPTH;

// The squad's feet (slot order = battle order) and size; under them the NAMES (no box, big cream text with a dark
// outline: user 'bigger and nicer') and the Send back buttons, in two even rows; how far off the screen edge a hero
// walks in from; lockedWash = the grey of the '?' hero's shape. grid: the area it is centred in (top / bottom), the
// tile size (max width, height, feet, hero scale), the gap, the most tiles in a row.
export const SQUAD_VIEW = {
  slots: [{ x: 92, y: 352 }, { x: GAME_WIDTH / 2, y: 338 }, { x: GAME_WIDTH - 92, y: 352 }],
  heroScale: 4, nameY: 372, backY: 392, backW: 96, backH: 28, sideOffPx: 48, lockedWash: 0x4a4458,
  grid: { top: 440, bottom: 662, maxW: 80, h: 100, foot: 90, tileScale: 3, gap: 10, maxCols: 5, side: 12 },
};
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
    const top = G.top + Math.max(0, Math.round((G.bottom - G.top - blockH) / 2));
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
    const ch = new Character(this, x + w / 2, y + G.foot, def).setDepth(D.ui);
    ch.setScale(G.tileScale);
    ch.setWash(SQUAD_VIEW.lockedWash, open ? 0 : 1);
    const mark = this.add.graphics().setDepth(D.ui + 1); // the check mark of a picked hero
    const out = [g, ch, mark];
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
      drawWindow(g.clear(), x, y, w, h, { line: picked ? 0xffd84a : open ? UI.line : 0x8a8a9a, ...(tile.pressed ? { fill: UI.pressed } : {}) });
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

  // The NAME under each squad hero (no box: big cream text with a dark outline), hidden while the hero walks.
  drawNames() {
    this.slots.forEach((id, i) => {
      const t = this.names[i];
      const show = !!id && !this.walkers.has(id) && !this.descending;
      t.setVisible(show);
      if (show) t.setText(heroDefs.find((h) => h.id === id).name);
    });
  },
};
