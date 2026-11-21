// SQUAD SCREEN: THE HERO GRID (session 47: the user picked layout C of the A/B/C trial, then 'make it neater').
// Under the squad (standing in front of the gate) every hero is a framed TILE with the hero standing in it.
// Picked = gold frame + a check mark; locked = a dark shape in a grey frame; NEW = a green tag. A tap opens the details
// card. HOW LOCKED HEROES SHOW is on trial (user: 'show all types in the demo'), registry 'lockedStyle':
//   goals  = all 10 tiles; a locked one shows a lock and its goal in two tiny lines ('FLOOR / 5').
//   teaser = only the open heroes + ONE '?' tile: the hero closest to unlocking, with its goal; 'n more to find'.
//   folded = the open heroes in big tiles; every locked hero in a thin row of small dark tiles under them.
// Mixed into SquadScene.prototype (like roomMethods.js into BattleScene).
import { GAME_WIDTH, UI } from '../../config.js';
import { drawWindow, drawFlatButton, buttonTextColor, pressable } from '../../entities/uiKit.js';
import Character from '../../entities/Character.js';
import heroDefs from '../../data/heroes.json';
import unlocks from '../../data/unlocks.json';
import { perkMods } from '../../systems/party.js';
import { shortGoal, nextUnlock } from '../../systems/progress.js';

const FONT = UI.font, INK = UI.text, MUTE = '#a8a8b8';
const STAT_SHORT = { attack: 'ATK', health: 'HP', defense: 'DEF', resist: 'RES', evasion: 'EVA', crit: 'CRIT', attackEfficiency: 'SPD' };
export const SQUAD_DEPTH = { floor: 0, slot: 1, bench: 2, hero: 5, doorFront: 8, ui: 20, panel: 40 };
const D = SQUAD_DEPTH;

// The squad's feet (slot order = battle order), their size, the name plates and Send back buttons under them (two even
// rows, all the same width: 'neater', user session 47), how far off the screen edge a hero walks in from, the grid.
// lockedWash = the grey a locked hero's shape is painted in (black was lost on the dark tiles).
export const SQUAD_VIEW = {
  slots: [{ x: 92, y: 368 }, { x: GAME_WIDTH / 2, y: 352 }, { x: GAME_WIDTH - 92, y: 368 }],
  heroScale: 4, plateY: 378, plateW: 96, plateH: 20, backY: 418, backW: 96, backH: 28, sideOffPx: 48, lockedWash: 0x4a4458,
  grid: { top: 452, w: 68, h: 86, gap: 6, foot: 76, cols: 5, tileScale: 2, miniW: 34, miniH: 40, miniGap: 4 },
};
export const LOCKED_STYLES = ['goals', 'teaser', 'folded'];
const G = SQUAD_VIEW.grid;
const GRID_LEFT = Math.round((GAME_WIDTH - (G.cols * G.w + (G.cols - 1) * G.gap)) / 2);

const text = (scene, x, y, str, color = INK) => scene.add.text(x, y, str, { fontFamily: FONT, fontSize: '8px', color });

export const squadGrid = {
  // The team perk as a short line ('+10% ATK').
  perkLine(def) {
    return perkMods({ def, level: 1 }).map((m) => `${m.percent !== undefined ? `+${m.percent}%` : `+${m.flat}`} ${STAT_SHORT[m.stat] || ({ skillDamage: 'skill dmg', regen: 'HP/s', dotDamage: 'DoT dmg' })[m.special] || m.special}`).join(', ');
  },

  // A small flat button with a centred label that pushes in (uiKit pressable). Returns its parts.
  smallButton(x, y, w, h, label, onTap) {
    const g = this.add.graphics().setDepth(D.ui);
    const redraw = (pressed) => drawFlatButton(g.clear(), x, y, w, h, { pressed });
    redraw(false);
    const t = text(this, x + w / 2, y + h / 2 + 1, label, buttonTextColor()).setOrigin(0.5).setDepth(D.ui);
    const hit = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive().setDepth(D.ui);
    pressable(this, hit, { redraw, sink: [t], onTap, enabled: () => !this.panel && !this.leaving });
    return [g, t, hit];
  },

  // Which heroes get a big tile and which (folded) a small one, for the locked style; hidden = locked heroes not shown.
  tileLists() {
    const open = heroDefs.filter((h) => this.unlocked(h.id)).map((h) => h.id);
    const locked = heroDefs.filter((h) => !this.unlocked(h.id)).map((h) => h.id);
    if (this.lockedStyle === 'teaser') {
      const next = nextUnlock(heroDefs, this.progress, unlocks);
      return { big: next ? [...open, next] : open, small: [], hidden: locked.length - (next ? 1 : 0) };
    }
    if (this.lockedStyle === 'folded') return { big: open, small: locked, hidden: 0 };
    return { big: heroDefs.map((h) => h.id), small: [], hidden: 0 };
  },

  // (Re)builds the grid: big tiles in rows of 5 (each row centred), then (folded) the small locked row or (teaser) the
  // 'n more to find' line. Returns its parts (also kept in this.gridParts).
  buildGrid() {
    (this.gridParts || []).forEach((o) => o.destroy());
    const parts = (this.gridParts = []);
    this.tiles = new Map();
    const { big, small, hidden } = this.tileLists();
    big.forEach((id, i) => {
      const row = Math.floor(i / G.cols), inRow = Math.min(G.cols, big.length - row * G.cols);
      const x0 = Math.round((GAME_WIDTH - (inRow * G.w + (inRow - 1) * G.gap)) / 2);
      parts.push(...this.makeTile(id, x0 + (i % G.cols) * (G.w + G.gap), G.top + row * (G.h + G.gap), G.w, G.h, false));
    });
    let y = G.top + Math.ceil(big.length / G.cols) * (G.h + G.gap) + 2;
    if (small.length) {
      parts.push(text(this, GRID_LEFT, y, `LOCKED: ${small.length}`, MUTE).setDepth(D.ui));
      y += 14;
      const x0 = Math.round((GAME_WIDTH - (small.length * G.miniW + (small.length - 1) * G.miniGap)) / 2);
      small.forEach((id, i) => parts.push(...this.makeTile(id, x0 + i * (G.miniW + G.miniGap), y, G.miniW, G.miniH, true)));
    }
    if (hidden > 0) parts.push(text(this, GAME_WIDTH / 2, y + 4, `${hidden} more heroes to find`, MUTE).setOrigin(0.5, 0).setDepth(D.ui));
    return parts;
  },

  // One tile (mini = the small locked ones of 'folded'). Returns its parts; the tile goes in this.tiles.
  makeTile(id, x, y, w, h, mini) {
    const def = heroDefs.find((d) => d.id === id);
    const open = this.unlocked(id);
    const g = this.add.graphics().setDepth(D.ui);
    const ch = new Character(this, x + w / 2, y + (mini ? h - 6 : G.foot), def).setDepth(D.ui);
    ch.setScale(mini ? 1 : G.tileScale);
    ch.setWash(SQUAD_VIEW.lockedWash, open ? 0 : 1);
    const mark = this.add.graphics().setDepth(D.ui + 1); // the check (picked) or the lock (locked)
    const out = [g, ch, mark];
    if (!open && !mini) {
      if (this.lockedStyle === 'teaser') out.push(this.add.text(x + w / 2, y + 22, '?', { fontFamily: FONT, fontSize: '16px', color: UI.gold }).setOrigin(0.5).setDepth(D.ui + 1));
      const req = unlocks.requirements[id];
      if (req) shortGoal(req, unlocks).forEach((line, k) => out.push(text(this, x + w / 2, y + h - 26 + k * 12, line, UI.gold).setOrigin(0.5, 0).setStroke('#000000', 3).setDepth(D.ui + 1)));
    }
    // NEW: a green tag drawn behind black text (a text backgroundColor is lost to the small font's pixel snapping).
    const tag = this.add.container(x + w / 2, y + 4).setDepth(D.ui + 1);
    tag.add([this.add.graphics().fillStyle(0x6ee07a, 1).fillRect(-16, 0, 32, 14), text(this, 1, 8, 'NEW', '#000000').setOrigin(0.5)]);
    out.push(tag);
    const tile = { id, g, ch, mark, tag, x, y, w, h, mini, pressed: false };
    tile.draw = () => {
      const picked = this.slots.includes(id);
      drawWindow(g.clear(), x, y, w, h, { line: picked ? 0xffd84a : open ? UI.line : 0x8a8a9a, ...(tile.pressed ? { fill: UI.pressed } : {}) });
      mark.clear();
      if (picked) { // a gold check mark in the top right corner (2px pixels) on a dark square
        mark.fillStyle(0x000000, 1).fillRect(x + w - 22, y + 8, 16, 14);
        mark.fillStyle(0xffd84a, 1);
        [[0, 4], [2, 6], [4, 4], [6, 2], [8, 0]].forEach(([dx, dy]) => mark.fillRect(x + w - 19 + dx, y + 10 + dy, 2, 4));
      } else if (!open && !mini && this.lockedStyle !== 'teaser') { // a small grey padlock at the top
        const lx = x + w / 2 - 6, ly = y + 10;
        mark.fillStyle(0x8a8a9a, 1).fillRect(lx + 2, ly, 8, 2).fillRect(lx + 2, ly, 2, 6).fillRect(lx + 8, ly, 2, 6).fillRect(lx, ly + 6, 12, 10);
        mark.fillStyle(0x2a2a34, 1).fillRect(lx + 5, ly + 9, 2, 4);
      }
      tag.setVisible(open && !picked && this.isNew(id));
    };
    const hit = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive().setDepth(D.ui);
    pressable(this, hit, { redraw: (p) => { tile.pressed = p; tile.draw(); }, sink: [ch], onTap: () => this.openPanel(id), enabled: () => !this.panel && !this.leaving });
    this.tiles.set(id, tile);
    tile.draw();
    return [...out, hit];
  },

  // The name plate under each squad hero: a small framed plate with its name (hidden while the hero walks).
  drawPlates() {
    this.slots.forEach((id, i) => {
      const P = this.plates[i], s = SQUAD_VIEW.slots[i], V = SQUAD_VIEW;
      const show = !!id && !this.walkers.has(id) && !this.descending;
      P.g.clear();
      P.t.setVisible(show);
      if (!show) return;
      P.t.setText(heroDefs.find((h) => h.id === id).name);
      drawWindow(P.g, Math.round(s.x - V.plateW / 2), V.plateY, V.plateW, V.plateH);
    });
  },
};
