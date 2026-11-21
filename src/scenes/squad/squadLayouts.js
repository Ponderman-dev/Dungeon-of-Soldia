// SQUAD SCREEN LAYOUTS (session 47 trial, user: 'full new layout', then 'let's do all three'). SquadScene keeps the
// rules (slots, walking, descend, the details card); each layout only draws its part of the screen. A tiny
// 'LAYOUT' button flips between them (registry 'squadLayout') until the user picks one; the others then go.
//   A ROSTER: the squad in front of the gate, an info panel for the tapped hero, all heroes as a 5x2 tile grid.
//   B SHOWCASE: one hero big in front of the gate (swipe or arrows), its info under it, the squad in 3 boxes below.
//   C SCENE + GRID: the squad big in front of the gate (names under them) with Send back buttons, a 5x2 tile grid;
//   a tap opens the card.
// Mixed into SquadScene.prototype (like roomMethods.js into BattleScene).
import { GAME_WIDTH, UI } from '../../config.js';
import { drawWindow, drawFlatButton, buttonTextColor, pressable } from '../../entities/uiKit.js';
import Character from '../../entities/Character.js';
import { skillIconKey } from '../../entities/skillIconTexture.js';
import heroDefs from '../../data/heroes.json';
import skillDefs from '../../data/skills.json';
import unlocks from '../../data/unlocks.json';
import { perkMods } from '../../systems/party.js';
import { describeRequirement, describeProgress } from '../../systems/progress.js';
import { isFull } from '../../systems/squadSlots.js';
import * as sfx from '../../audio/sfx.js';

const FONT = UI.font, INK = UI.text, MUTE = '#a8a8b8';
const STAT_SHORT = { attack: 'ATK', health: 'HP', defense: 'DEF', resist: 'RES', evasion: 'EVA', crit: 'CRIT', attackEfficiency: 'SPD' };
export const SQUAD_DEPTH = { floor: 0, slot: 1, bench: 2, hero: 5, doorFront: 8, ui: 20, panel: 40 };
const D = SQUAD_DEPTH;

// Where things go in each layout. slots = the squad's feet (slot order = battle order); heroScale = their size;
// home = where a hero comes from / goes back to ('tile' = its grid tile, 'stage' = B's big spot); backFade = going
// back just fades out where it stands.
export const LAYOUTS = {
  A: { slots: [{ x: 92, y: 292 }, { x: GAME_WIDTH / 2, y: 268 }, { x: GAME_WIDTH - 92, y: 292 }], heroScale: 3, tileScale: 2, home: 'tile' },
  B: { slots: [{ x: 87, y: 656 }, { x: GAME_WIDTH / 2, y: 656 }, { x: GAME_WIDTH - 87, y: 656 }], heroScale: 3, home: 'stage', backFade: true },
  C: { slots: [{ x: 92, y: 372 }, { x: GAME_WIDTH / 2, y: 340 }, { x: GAME_WIDTH - 92, y: 372 }], heroScale: 4, tileScale: 2, home: 'tile', names: true, sendBack: true },
};
export const LAYOUT_KEYS = Object.keys(LAYOUTS);

const text = (scene, x, y, str, px, color, wrap = 0) => scene.add.text(x, y, str, { fontFamily: FONT, fontSize: `${px}px`, color,
  wordWrap: wrap ? { width: wrap, useAdvancedWrap: true } : undefined, lineSpacing: 4 });
const resize = (ch, s) => ch.setScale(Math.sign(ch.scaleX || 1) * s, s); // keeps the facing

export const squadLayouts = {
  // ---- shared pieces -------------------------------------------------------------------------

  // The team perk as a short line ('+10% ATK').
  perkLine(def) {
    return perkMods({ def, level: 1 }).map((m) => `${m.percent !== undefined ? `+${m.percent}%` : `+${m.flat}`} ${STAT_SHORT[m.stat] || ({ skillDamage: 'skill dmg', regen: 'HP/s', dotDamage: 'DoT dmg' })[m.special] || m.special}`).join(', ');
  },

  // A small solid button with a centred label that pushes in (uiKit pressable). Returns its parts.
  smallButton(x, y, w, h, label, onTap, { enabled = true, primary = false, px = 8 } = {}) {
    const g = this.add.graphics().setDepth(D.ui);
    const redraw = (pressed) => drawFlatButton(g.clear(), x, y, w, h, { pressed, enabled, primary }); // the camp's flat button
    redraw(false);
    const t = text(this, x + w / 2, y + h / 2 + 1, label, px, buttonTextColor(enabled, false, primary)).setOrigin(0.5).setDepth(D.ui);
    const hit = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive().setDepth(D.ui);
    pressable(this, hit, { redraw, sink: [t], onTap, enabled: () => enabled && !this.panel && !this.leaving });
    return [g, t, hit];
  },

  // What the info panel's main button does for the shown hero: ADD (full squad: the last one goes back), REMOVE,
  // or nothing (LOCKED).
  pickAction(id) {
    if (!this.unlocked(id)) return { label: 'LOCKED', action: null };
    if (this.slots.includes(id)) return { label: 'REMOVE', action: () => this.sendBack(id) };
    if (isFull(this.slots)) {
      const out = this.slots[this.slots.length - 1];
      return { label: 'ADD', action: () => { this.sendBack(out); this.choose(id); } };
    }
    return { label: 'ADD', action: () => this.choose(id) };
  },

  // The info panel of a hero (A and B): name, role, team perk (or how to unlock it), passive / attack / support rows
  // with their icons, an ADD / REMOVE button and DETAILS (the full card). box = { x, y, w, h }; buttons 'right' (A, by
  // the name) or 'bottom' (B). Everything it draws goes in this.infoParts (redrawn when the hero or the squad changes).
  drawInfo(id, box, buttons) {
    (this.infoParts || []).forEach((o) => o.destroy());
    const parts = (this.infoParts = []);
    const put = (o) => { parts.push(o.setDepth(D.ui)); return o; };
    const def = heroDefs.find((h) => h.id === id);
    const open = this.unlocked(id);
    const { x, y, w } = box;
    const g = put(this.add.graphics());
    drawWindow(g, x, y, w, box.h);
    put(text(this, x + 16, y + 14, def.name, 16, INK));
    const element = ['fire', 'holy', 'dark', 'ice', 'electric'].includes(def.damageType) ? ` - ${def.damageType}` : '';
    put(text(this, x + 16, y + 40, `${def.role || ''} - ${def.damageType === 'melee' ? 'melee' : 'ranged'}${element}`.toUpperCase(), 8, UI.gold));
    const req = unlocks.requirements[id];
    const sub = open ? `Team: ${this.perkLine(def)}` : req ? `${describeRequirement(req, unlocks)} (${describeProgress(req, this.progress, unlocks)})` : 'Locked';
    put(text(this, x + 16, y + 58, sub, 8, open ? MUTE : UI.gold, buttons === 'right' ? w - 150 : w - 32));
    let ry = y + 80;
    const row = (iconId, line, name, extra) => {
      drawWindow(g, x + 14, ry, 36, 36, { line });
      const key = skillIconKey(this, iconId);
      if (key) put(this.add.image(x + 32, ry + 18, key).setScale(2));
      put(text(this, x + 60, ry + 6, name, 8, INK, w - 76));
      put(text(this, x + 60, ry + 22, extra, 8, MUTE));
      ry += 42;
    };
    const atk = skillDefs[def.skills.attack], sup = skillDefs[def.skills.support];
    row(`passive_${def.id}`, 0xffd84a, def.passive.name, 'Passive');
    row(def.skills.attack, UI.line, atk.name, `Attack - ${atk.cooldownMs / 1000}s`);
    row(def.skills.support, UI.line, sup.name, `Support - ${sup.cooldownMs / 1000}s`);
    const { label, action } = this.pickAction(id);
    const details = () => { sfx.play('tap'); this.openPanel(id); };
    if (buttons === 'right') {
      this.smallButton(x + w - 124, y + 12, 110, 34, label, () => action && action(), { enabled: !!action, primary: label === 'ADD' }).forEach(put);
      this.smallButton(x + w - 124, y + 52, 110, 24, 'DETAILS', details).forEach(put);
    } else {
      const by = y + box.h - 48;
      this.smallButton(x + 14, by, w - 152, 36, label, () => action && action(), { enabled: !!action, primary: label === 'ADD', px: 16 }).forEach(put);
      this.smallButton(x + w - 128, by, 114, 36, 'DETAILS', details).forEach(put);
    }
    return parts;
  },

  // The 5x2 grid of hero tiles (A and C): a framed tile per hero with the hero standing in it (scale tileScale).
  // Picked heroes: their slot number in gold and a faint figure (the hero itself stands in the squad). The shown
  // hero (A): a gold frame. Locked: a dark shape. NEW: a green tag. Tap: onTap(id). Returns the parts.
  drawTiles(top, tileH, footOff, onTap, { names = false } = {}) {
    const W = 68, GAP = 6, X0 = Math.round((GAME_WIDTH - (5 * W + 4 * GAP)) / 2);
    const parts = [];
    this.tiles = new Map();
    heroDefs.forEach((def, i) => {
      const x = X0 + (i % 5) * (W + GAP), y = top + Math.floor(i / 5) * (tileH + GAP);
      const g = this.add.graphics().setDepth(D.ui);
      const ch = new Character(this, x + W / 2, y + footOff, def).setDepth(D.ui);
      resize(ch, this.L.tileScale);
      const num = text(this, x + 8, y + 7, '', 8, UI.gold).setDepth(D.ui);
      // NEW: a green tag drawn behind black text (a text backgroundColor is lost to the small font's pixel snapping).
      const tag = this.add.container(x + W / 2, y + 4).setDepth(D.ui);
      tag.add([this.add.graphics().fillStyle(0x6ee07a, 1).fillRect(-16, 0, 32, 14), text(this, 1, 8, 'NEW', 8, '#000000').setOrigin(0.5)]);
      const name = names ? text(this, x + W / 2, y + footOff + 5, '', 8, INK).setOrigin(0.5, 0).setDepth(D.ui) : null;
      const tile = { def, g, ch, num, tag, name, x, y, w: W, h: tileH, foot: { x: x + W / 2, y: y + footOff }, pressed: false };
      tile.draw = () => {
        const id = def.id, open = this.unlocked(id), shown = this.selected === id && this.layoutKey === 'A';
        drawWindow(g.clear(), x, y, W, tileH, { line: shown ? 0xffd84a : open ? UI.line : 0x8a8a9a, ...(tile.pressed ? { fill: UI.pressed } : {}) });
        const slot = this.slots.indexOf(id);
        ch.setWash(0x05030a, open ? 0 : 0.92);
        ch.setAlpha(slot >= 0 || this.walkers.has(id) ? 0.25 : 1);
        num.setText(slot >= 0 ? String(slot + 1) : '');
        tag.setVisible(open && slot < 0 && this.isNew(id));
        if (name) name.setText(open ? def.name : '? ? ?').setColor(open ? (slot >= 0 ? UI.gold : '#d0d0dc') : '#6a6a7a');
      };
      const hit = this.add.zone(x + W / 2, y + tileH / 2, W, tileH).setInteractive().setDepth(D.ui);
      pressable(this, hit, { redraw: (p) => { tile.pressed = p; tile.draw(); }, sink: [ch], onTap: () => onTap(def.id), enabled: () => !this.panel && !this.leaving });
      this.tiles.set(def.id, tile);
      parts.push(g, ch, num, tag, hit, ...(name ? [name] : []));
    });
    return parts;
  },

  // Where a hero comes from when picked / goes back to (its tile, or B's stage spot).
  homeOf(id) {
    if (this.L.home === 'stage') return { x: GAME_WIDTH / 2, y: this.stageFeet, scale: this.stageScale };
    const t = this.tiles && this.tiles.get(id);
    return t ? { ...t.foot, scale: this.L.tileScale } : { x: GAME_WIDTH / 2, y: 600, scale: this.L.heroScale };
  },

  // ---- A: ROSTER -------------------------------------------------------------------------------

  buildA() {
    this.selected = this.slots.find(Boolean) || heroDefs[0].id;
    this.infoBox = { x: 12, y: 306, w: GAME_WIDTH - 24, h: 210 };
    const parts = this.drawTiles(524, 70, 62, (id) => this.select(id));
    return parts;
  },

  // A: show a hero in the info panel.
  select(id) {
    if (this.selected !== id) sfx.play('tap');
    this.selected = id;
    this.layoutDirty = true;
    this.refresh();
  },

  // ---- B: SHOWCASE -----------------------------------------------------------------------------

  buildB() {
    this.stageFeet = 292; this.stageScale = 5;
    this.selected = this.slots.find(Boolean) || heroDefs[0].id;
    this.infoBox = { x: 12, y: 304, w: GAME_WIDTH - 24, h: 248 };
    const parts = [];
    this.stageShadow = this.add.ellipse(GAME_WIDTH / 2, this.stageFeet, 110, 22, 0x000000, 0.35).setDepth(D.slot);
    parts.push(this.stageShadow);
    this.counter = text(this, GAME_WIDTH - 28, 318, '', 8, MUTE).setOrigin(1, 0).setDepth(D.ui + 1);
    parts.push(this.counter);
    // The arrows beside the big hero.
    [[-1, 10], [1, GAME_WIDTH - 46]].forEach(([dir, x]) => parts.push(...this.smallButton(x, 196, 36, 52, dir < 0 ? '<' : '>', () => this.flip(dir), { px: 16 })));
    // The squad: 3 boxes behind the slots, with a title over them.
    const g = this.add.graphics().setDepth(D.floor + 0.5);
    this.L.slots.forEach((s) => drawWindow(g, s.x - 50, s.y - 86, 100, 96, { fill: 0x14101f }));
    parts.push(g, text(this, GAME_WIDTH / 2, 560, 'YOUR SQUAD', 8, UI.gold).setOrigin(0.5, 0).setDepth(D.ui));
    this.showStage(this.selected, 0);
    return parts;
  },

  // B: the big hero on the stage (dir -1 / +1 = it slides in from that side, 0 = just there).
  showStage(id, dir) {
    const def = heroDefs.find((h) => h.id === id);
    const old = this.stageHero;
    if (old) {
      if (dir) this.tweens.add({ targets: old, x: old.x - dir * 60, alpha: 0, duration: UI.motion.fast, ease: UI.motion.easeIn, onComplete: () => old.destroy() });
      else old.destroy();
    }
    const ch = new Character(this, GAME_WIDTH / 2 + dir * 60, this.stageFeet, def).setDepth(D.hero);
    resize(ch, this.stageScale);
    ch.setWash(0x05030a, this.unlocked(id) ? 0 : 0.92);
    if (dir) { ch.setAlpha(0); this.tweens.add({ targets: ch, x: GAME_WIDTH / 2, alpha: 1, duration: UI.motion.fast, ease: UI.motion.easeOut }); }
    this.stageHero = ch;
    if (this.layoutParts) this.layoutParts.push(ch);
    this.selected = id;
    this.layoutDirty = true;
  },

  // B: the next / previous hero.
  flip(dir) {
    const i = heroDefs.findIndex((h) => h.id === this.selected);
    const next = heroDefs[(i + dir + heroDefs.length) % heroDefs.length].id;
    sfx.play('scroll');
    this.showStage(next, dir);
    this.refresh();
  },

  // ---- C: SCENE + GRID -------------------------------------------------------------------------

  buildC() {
    return this.drawTiles(452, 86, 76, (id) => this.openPanel(id));
  },

  // ---- every layout ----------------------------------------------------------------------------

  // Called by refresh(): tiles, the info panel (only when something it shows changed), B's counter.
  refreshLayout() {
    if (this.tiles) for (const t of this.tiles.values()) t.draw();
    if (this.layoutKey === 'C') return;
    const key = `${this.selected}|${this.slots.join(',')}|${this.progress.unlockAll ? 1 : 0}`;
    if (key !== this.infoKey || this.layoutDirty) {
      this.infoKey = key;
      this.layoutDirty = false;
      this.drawInfo(this.selected, this.infoBox, this.layoutKey === 'A' ? 'right' : 'bottom');
      if (this.leaving && !this.shifting) this.infoParts.forEach((o) => o.setAlpha(0));
    }
    if (this.counter) this.counter.setText(`${heroDefs.findIndex((h) => h.id === this.selected) + 1} / ${heroDefs.length}`);
  },

  // A tap on a hero standing in a slot.
  tapSlot(id) {
    if (this.layoutKey === 'A') this.select(id);
    else if (this.layoutKey === 'B') { if (id !== this.selected) { this.showStage(id, 1); sfx.play('tap'); this.refresh(); } }
    else this.openPanel(id);
  },
};
