import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config.js';
import { drawWindow, uiText } from '../entities/uiKit.js';
import Character from '../entities/Character.js';
import { bareIconKey } from '../entities/itemIconTexture.js';
import G from '../data/glossary.json';
import heroes from '../data/heroes.json';
import enemies from '../data/enemies.json';
import items from '../data/items.json';
import rarities from '../data/rarities.json';
import statusDefs from '../data/statuses.json';
import damageTypes from '../data/damageTypes.json';
import unlocks from '../data/unlocks.json';
import dungeons from '../data/dungeons.json';
import { loadProgress, unlockedIds } from '../systems/progress.js';
import { emptySeen } from '../systems/glossary.js';
import * as sfx from '../audio/sfx.js';

// The Glossary (docs/systems/title-base.md section 5): a book of chapters. BASICS (always open), STATUSES (BAD / GOOD
// / CONTROL), ENEMIES (sprite grid + a card), BOSSES, ITEMS (icon grid + a card) and HEROES (opens the Heroes screen).
// Entries fill in as they are met (progress.seen, systems/glossary.js); the rest stay dark '???'. Opened over the
// camp (the camp waits, paused). Data: glossary.json.
const L = G.layout;
const GOLD = Phaser.Display.Color.HexStringToColor(UI.gold).color;
const DIM = Number(L.dim);
const SHADOW = 0x1c1c26;
const W = GAME_WIDTH - L.side * 2;
const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const isBoss = (id) => enemies[id] && enemies[id].boss;
const ENEMY_IDS = Object.keys(enemies).filter((id) => !id.startsWith('_') && !isBoss(id) && !G.hiddenEnemies.includes(id));
const BOSS_FLOOR = {};
for (const [f, ids] of Object.entries(dungeons.A.bosses || {})) for (const id of ids) if (isBoss(id)) BOSS_FLOOR[id] = Number(f);
const BOSS_IDS = Object.keys(BOSS_FLOOR).sort((a, b) => BOSS_FLOOR[a] - BOSS_FLOOR[b]);
const ITEM_IDS = Object.keys(items).filter((id) => !id.startsWith('_'));
const STATUS_IDS = Object.keys(G.statuses);
const shortName = (name) => name.replace(/^The /, '').split(' the ')[0];
const tileName = (id) => { const n = enemies[id].name.toUpperCase(); return G.shortNames[id] || (n.length <= 9 ? n : n.split(' ').pop()); };
const css = (c) => (typeof c === 'string' && c.startsWith('#') ? c : '#' + Number(c).toString(16).padStart(6, '0'));

export default class GlossaryScene extends Phaser.Scene {
  constructor() {
    super('Glossary');
  }

  init(data) {
    this.from = (data && data.from) || 'Base';
  }

  create() {
    this.scene.bringToTop();
    this.progress = loadProgress();
    this.seen = { ...emptySeen(), ...(this.progress.seen || {}) };
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Number(L.bg)).setOrigin(0).setInteractive();
    this.page = null;
    this.showChapters();
    this.cameras.main.fadeIn(120, 0, 0, 0);
  }

  // ---- helpers -----------------------------------------------------------------------------------

  newPage() {
    if (this.page) this.page.destroy();
    this.page = this.add.container(0, 0);
    return this.page;
  }

  button(page, x, y, w, h, label, onTap, look = 'plain', size = 'normal') {
    const line = { plain: UI.line, gold: GOLD, dim: DIM }[look];
    page.add(drawWindow(this.add.graphics(), x, y, w, h, { line }));
    if (label) page.add(uiText(this, x + w / 2, y + h / 2, label, size, { plain: UI.text, gold: UI.gold, dim: UI.dim }[look]).setOrigin(0.5));
    if (onTap) page.add(this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', onTap));
  }

  text(page, x, y, str, size = 'normal', color = UI.text, extra = {}) {
    const t = uiText(this, x, y, str, size, color, extra);
    page.add(t);
    return t;
  }

  top(page, back, title, onBack) {
    const B = L.back;
    this.button(page, B.x, B.y, B.w, B.h, back, () => { sfx.play('tap'); onBack(); });
    this.text(page, GAME_WIDTH / 2, L.titleY, title, 'big').setOrigin(0.5, 0);
  }

  // A sprite (enemy or hero def) standing at (x, feet), scaled to fit `maxH` px; `shadow` = dark shape.
  sprite(page, def, x, feet, maxH, shadow = false, maxScale = 3) {
    const ch = new Character(this, x, feet, def);
    ch.setScale(Math.max(1, Math.min(maxScale, Math.floor(maxH / ((def.height || 24) + 2)) || 1)));
    if (shadow) for (const p of Object.values(ch.parts)) p.image.setTint(SHADOW).setTintMode(Phaser.TintModes.FILL);
    page.add(ch);
    return ch;
  }

  // '< 1/4 >' page buttons.
  pager(page, y, at, pages, go) {
    if (pages <= 1) return;
    const x = L.side;
    this.button(page, x, y, 64, 40, '<', at > 0 ? () => { sfx.play('tap'); go(at - 1); } : null, at > 0 ? 'plain' : 'dim');
    this.button(page, x + W - 64, y, 64, 40, '>', at < pages - 1 ? () => { sfx.play('tap'); go(at + 1); } : null, at < pages - 1 ? 'plain' : 'dim');
    this.text(page, GAME_WIDTH / 2, y + 20, `${at + 1} / ${pages}`, 'small', UI.dim).setOrigin(0.5);
  }

  // ---- chapters ----------------------------------------------------------------------------------

  counts() {
    const s = this.seen, bossIds = this.progress.stats.bossIds || [];
    return {
      basics: [G.basics.length, G.basics.length],
      statuses: [STATUS_IDS.filter((id) => s.statuses.includes(id)).length, STATUS_IDS.length],
      enemies: [ENEMY_IDS.filter((id) => s.met.includes(id)).length, ENEMY_IDS.length],
      bosses: [BOSS_IDS.filter((id) => bossIds.includes(id) || s.beaten[id]).length, BOSS_IDS.length],
      items: [ITEM_IDS.filter((id) => s.items.includes(id)).length, ITEM_IDS.length],
      heroes: [unlockedIds(heroes, this.progress, unlocks).length, heroes.length],
    };
  }

  showChapters() {
    const page = this.newPage(), C = L.chapters, x = L.side, n = this.counts();
    this.top(page, this.from === 'Base' ? '< CAMP' : '< BACK', 'GLOSSARY', () => this.close());
    const open = { basics: () => this.showBasics(), statuses: () => this.showStatuses('bad'), enemies: () => this.showEnemies(0), bosses: () => this.showBosses(), items: () => this.showItems(0), heroes: () => this.openHeroes() };
    Object.keys(open).forEach((id, i) => {
      const y = C.y + i * (C.h + C.gap);
      this.button(page, x, y, W, C.h, null, () => { sfx.play('tap'); open[id](); });
      this.text(page, x + 20, y + C.h / 2, id.toUpperCase(), 'big').setOrigin(0, 0.5);
      this.text(page, x + W - 20, y + C.h / 2, `${n[id][0]}/${n[id][1]}`, 'small', UI.gold).setOrigin(1, 0.5);
    });
  }

  // BASICS: every help page as a card (title + text).
  showBasics() {
    const page = this.newPage(), x = L.side, P = L.pad;
    this.top(page, '< BACK', 'BASICS', () => this.showChapters());
    // Two columns of short cards would be cramped: one column, small text, as many as fit; the rest on page 2.
    let y = L.basics.y;
    const all = G.basics;
    this.basicsAt = this.basicsAt || 0;
    const per = 6, pages = Math.ceil(all.length / per), at = this.basicsAt;
    for (const b of all.slice(at * per, at * per + per)) {
      const t = this.text(page, x + P, 0, b.text, 'small', UI.text, { wordWrap: { width: W - P * 2 }, lineSpacing: 6 });
      t.setY(y + 40);
      const h = 40 + t.height + P - 4;
      page.addAt(drawWindow(this.add.graphics(), x, y, W, h), page.list.indexOf(t));
      this.text(page, x + P, y + 12, b.title, 'normal', UI.gold);
      y += h + L.basics.gap;
    }
    this.pager(page, Math.max(y + 4, 760), at, pages, (i) => { this.basicsAt = i; this.showBasics(); });
  }

  // STATUSES: tabs BAD / GOOD / CONTROL; a coloured tag + one line, or '???' until met.
  showStatuses(tab) {
    const page = this.newPage(), x = L.side, T = L.tabs, R = L.statusRows;
    this.top(page, '< BACK', 'STATUSES', () => this.showChapters());
    // Tab widths follow their words (CONTROL is the long one).
    const ids = ['bad', 'good', 'control'], room = W - T.gap * 2, letters = ids.reduce((n, id) => n + id.length + 3, 0);
    let tx = x;
    ids.forEach((id) => {
      const tw = Math.round((room * (id.length + 3)) / letters);
      this.button(page, tx, T.y, tw, T.h, id.toUpperCase(), () => { if (id !== tab) { sfx.play('tap'); this.showStatuses(id); } }, id === tab ? 'gold' : 'plain');
      tx += tw + T.gap;
    });
    STATUS_IDS.filter((id) => G.statuses[id].tab === tab).forEach((id, i) => {
      const y = R.y + i * (R.h + R.gap), def = statusDefs[id] || {}, met = this.seen.statuses.includes(id);
      page.add(drawWindow(this.add.graphics(), x, y, W, R.h, { line: met ? UI.line : DIM }));
      const chipC = met ? Phaser.Display.Color.HexStringToColor(css(def.color || '#555555')).color : 0x2a2a34;
      page.add(this.add.graphics().fillStyle(chipC, 1).fillRect(x + 12, y + R.h / 2 - 9, R.chipW, 18));
      this.text(page, x + 12 + R.chipW / 2, y + R.h / 2, met ? def.label || id.toUpperCase() : '???', 'small', met ? def.textColor || '#ffffff' : UI.dim).setOrigin(0.5);
      this.text(page, x + R.chipW + 24, y + R.h / 2, met ? G.statuses[id].text : 'Not met yet.', 'small', met ? UI.text : UI.dim, { wordWrap: { width: W - R.chipW - 36 }, lineSpacing: 6 }).setOrigin(0, 0.5);
    });
  }

  // ENEMIES: a page of sprites (dark shadow + '???' until met) and the picked one's card.
  showEnemies(at, pick = null) {
    const page = this.newPage(), x = L.side, E = L.enemyGrid, per = E.cols * E.rows, met = this.seen.met;
    this.top(page, '< BACK', 'ENEMIES', () => this.showChapters());
    this.text(page, GAME_WIDTH / 2, E.countY, `${ENEMY_IDS.filter((id) => met.includes(id)).length} / ${ENEMY_IDS.length} met`, 'small', UI.dim).setOrigin(0.5, 0);
    const list = ENEMY_IDS.slice(at * per, at * per + per);
    const cw = (W - E.gap * (E.cols - 1)) / E.cols;
    pick = pick || list.find((id) => met.includes(id)) || null;
    list.forEach((id, i) => {
      const cx = x + (i % E.cols) * (cw + E.gap), cy = E.y + Math.floor(i / E.cols) * (E.h + E.gap), on = met.includes(id);
      page.add(drawWindow(this.add.graphics(), cx, cy, cw, E.h, { line: id === pick ? GOLD : UI.line }));
      this.sprite(page, { id, ...enemies[id] }, cx + cw / 2, cy + E.h - 22, E.h - 30, !on);
      this.text(page, cx + cw / 2, cy + E.h - 11, on ? tileName(id) : '???', 'small', on ? UI.text : UI.dim).setOrigin(0.5);
      if (on) page.add(this.add.zone(cx, cy, cw, E.h).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', () => { if (id !== pick) { sfx.play('tap'); this.showEnemies(at, id); } }));
    });
    this.pager(page, E.pagerY, at, Math.ceil(ENEMY_IDS.length / per), (i) => this.showEnemies(i));
    this.enemyCard(page, pick, E.cardY, E.cardH);
  }

  // An enemy's card: sprite, name, base stats, how it hits, weak / resists, times beaten.
  enemyCard(page, id, y, h) {
    const x = L.side, P = L.pad;
    page.add(drawWindow(this.add.graphics(), x, y, W, h, { line: id ? GOLD : DIM }));
    if (!id) { this.text(page, GAME_WIDTH / 2, y + h / 2, 'Meet enemies in the dungeon to fill this book.', 'small', UI.dim, { align: 'center', wordWrap: { width: W - P * 2 } }).setOrigin(0.5); return; }
    const def = { id, ...enemies[id] }, st = def.stats || {};
    this.sprite(page, def, x + 56, y + 92, 76);
    this.text(page, x + 112, y + 24, def.name.toUpperCase(), 'normal', UI.text, { wordWrap: { width: W - 128 } });
    this.text(page, x + 112, y + 56, def.flying ? 'Flies' : 'Walks', 'small', UI.dim);
    const dt = (t) => (damageTypes[t] && damageTypes[t].name) || t;
    const list = (a) => (a && a.length ? a.map((t) => dt(t.type || t)).join(', ') : 'nothing');
    const rows = [
      ['Health', num(st.health || 0)], ['Attack', num(st.attack || 0)], ['Defense', num(st.defense || 0)],
      ['Hits with', String(dt(def.damageType)).toUpperCase()], ['Weak to', list(def.weak)], ['Resists', list(def.resists)],
      ['Times beaten', num(this.seen.beaten[id] || 0)],
    ];
    let ry = y + 120;
    page.add(this.add.graphics().fillStyle(0x33333f, 1).fillRect(x + P, ry - 10, W - P * 2, 2));
    for (const [k, v] of rows) {
      this.text(page, x + P, ry, k, 'small');
      this.text(page, x + W - P, ry, v, 'small', UI.gold, { align: 'right', wordWrap: { width: W - 140 } }).setOrigin(1, 0);
      ry += 26;
    }
    this.text(page, x + P, y + h - 22, 'Stats on floor 1; they grow deeper down.', 'small', UI.dim);
  }

  // BOSSES: every boss with its floor; beaten = sprite + name + times beaten, else a shadow.
  showBosses() {
    const page = this.newPage(), x = L.side, B = L.bossList, bossIds = this.progress.stats.bossIds || [];
    this.top(page, '< BACK', 'BOSSES', () => this.showChapters());
    BOSS_IDS.forEach((id, i) => {
      const y = B.y + i * (B.h + B.gap), def = { id, ...enemies[id] }, on = bossIds.includes(id) || !!this.seen.beaten[id];
      page.add(drawWindow(this.add.graphics(), x, y, W, B.h, { line: on ? UI.line : DIM }));
      const ch = new Character(this, x + 44, y + B.h - 6, def);
      ch.setScale(Math.min(def.drawScale || 3, (B.h - 10) / (def.height || 32)) * 0.75);
      if (!on) for (const p of Object.values(ch.parts)) p.image.setTint(SHADOW).setTintMode(Phaser.TintModes.FILL);
      page.add(ch);
      this.text(page, x + 92, y + 16, on ? shortName(def.name).toUpperCase() : '???', 'normal', on ? UI.text : UI.dim);
      this.text(page, x + 92, y + 42, `Floor ${BOSS_FLOOR[id]}`, 'small', UI.dim);
      if (on) this.text(page, x + W - L.pad, y + 42, `Beaten ${this.seen.beaten[id] || 1}x`, 'small', UI.gold).setOrigin(1, 0);
    });
  }

  // ITEMS: a page of icons (found = the icon, else its dark shape) and the picked one's card.
  showItems(at, pick = null) {
    const page = this.newPage(), x = L.side, I = L.itemGrid, per = I.cols * I.rows, found = this.seen.items;
    this.top(page, '< BACK', 'ITEMS', () => this.showChapters());
    this.text(page, GAME_WIDTH / 2, I.countY, `${ITEM_IDS.filter((id) => found.includes(id)).length} / ${ITEM_IDS.length} found`, 'small', UI.dim).setOrigin(0.5, 0);
    const list = ITEM_IDS.slice(at * per, at * per + per), gap = (W - I.cols * I.cell) / (I.cols - 1);
    pick = pick || list.find((id) => found.includes(id)) || null;
    list.forEach((id, i) => {
      const cx = x + (i % I.cols) * (I.cell + gap), cy = I.y + Math.floor(i / I.cols) * (I.cell + gap), on = found.includes(id);
      page.add(drawWindow(this.add.graphics(), cx, cy, I.cell, I.cell, { line: id === pick ? GOLD : on ? UI.line : DIM }));
      const icon = this.add.image(cx + I.cell / 2, cy + I.cell / 2, bareIconKey(this, id)).setScale(2);
      if (!on) icon.setTint(SHADOW).setTintMode(Phaser.TintModes.FILL);
      page.add(icon);
      if (on) page.add(this.add.zone(cx, cy, I.cell, I.cell).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', () => { if (id !== pick) { sfx.play('tap'); this.showItems(at, id); } }));
    });
    this.pager(page, I.pagerY, at, Math.ceil(ITEM_IDS.length / per), (i) => this.showItems(i));
    const y = I.cardY, P = L.pad;
    page.add(drawWindow(this.add.graphics(), x, y, W, I.cardH, { line: pick ? GOLD : DIM }));
    if (!pick) { this.text(page, GAME_WIDTH / 2, y + I.cardH / 2, 'Find items in the dungeon to fill this page.', 'small', UI.dim, { align: 'center', wordWrap: { width: W - P * 2 } }).setOrigin(0.5); return; }
    const def = items[pick], rar = rarities[def.rarity] || {};
    this.text(page, x + P, y + 14, def.name.toUpperCase(), 'normal', UI.gold, { wordWrap: { width: W - P * 2 } });
    this.text(page, x + P, y + 40, rar.label || def.rarity.toUpperCase(), 'small', rar.color ? '#' + rar.color.slice(2) : UI.dim);
    this.text(page, x + P, y + 62, def.description || '', 'small', UI.text, { wordWrap: { width: W - P * 2 }, lineSpacing: 6 });
  }

  // HEROES: the Heroes screen (list, hero page, kit) over the Glossary.
  openHeroes() {
    this.scene.launch('Heroes', { from: 'Glossary' });
    this.scene.pause();
  }

  close() {
    sfx.play('tap');
    this.scene.resume(this.from);
    this.scene.stop();
  }
}
