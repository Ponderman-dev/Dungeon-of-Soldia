import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import Character from '../entities/Character.js';
import itemTypes from '../data/itemTypes.json';
import rarities from '../data/rarities.json';
import { canReceive, countOf } from '../systems/items.js';
import { itemIconKey } from '../entities/itemIconTexture.js';

const COLORS = { bg: 0x14101f, panel: 0x221b33, line: 0x3a2f57, purple: 0x8b55d6, gold: 0xf2b632, disabled: 0x4a3f66 };
const INK = '#f3eefc';
const MUTE = '#9a8fb8';
const FONT = 'system-ui, Arial, sans-serif';
const CARD_W = 358;
const CARD_H = 112;
const SPECIAL_LABEL = { block: 'BLOCK', regen: 'REGEN/s', thorns: 'THORNS', lifesteal: 'LIFESTEAL', skillDamage: 'SKILL DMG', critDamage: 'CRIT DMG', skillSplash: 'SPLASH', lifestealShare: 'SHARE', critDebuff: 'CRIT DEBUFF', clearHeal: 'CLEAR HEAL' };
const STAT_LABEL = { attack: 'ATK', health: 'HP', defense: 'DEF', resist: 'RES', evasion: 'EVA', crit: 'CRIT', attackEfficiency: 'SPD' };

// The reward screen: pick 1 of 3 items, then choose which hero gets it.
// It only shows choices and reports the result through payload.onDone(itemId, heroUid).
export default class RewardScene extends Phaser.Scene {
  constructor() {
    super('Reward');
  }

  init(payload) {
    this.payload = payload; // { state, choices, floor, onDone }
  }

  create() {
    this.step = 'pick';
    this.chosen = null;
    this.selected = null;
    this.stepObjects = [];

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);
    this.add.text(16, 26, `Floor ${this.payload.floor} cleared`, { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: INK }).setOrigin(0, 0.5);
    this.add.rectangle(GAME_WIDTH / 2, 52, GAME_WIDTH, 2, COLORS.line);

    this.showPick();
  }

  // ---- helpers -----------------------------------------------------------------------

  track(obj) {
    this.stepObjects.push(obj);
    return obj;
  }

  clearStep() {
    for (const o of this.stepObjects) o.destroy();
    this.stepObjects = [];
  }

  text(x, y, str, size, color, bold = false, wrap = 0) {
    const style = { fontFamily: FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color };
    if (wrap) style.wordWrap = { width: wrap };
    return this.track(this.add.text(x, y, str, style));
  }

  rarityColor(item) {
    return Number(rarities[item.rarity].color);
  }

  // One reward card (as in the wireframe): icon, rarity label, name, description.
  drawCard(item, x, y, highlighted = false) {
    const rc = this.rarityColor(item);
    const g = this.track(this.add.graphics());
    g.fillStyle(highlighted ? 0x2f2547 : COLORS.panel, 1).fillRoundedRect(x, y, CARD_W, CARD_H, 14);
    g.lineStyle(highlighted ? 5 : 3, highlighted ? COLORS.gold : rc, 1).strokeRoundedRect(x, y, CARD_W, CARD_H, 14);

    // The item's pixel icon in its rarity frame (itemIcons.json), its type underneath.
    const ix = x + 14 + 32;
    const iy = y + CARD_H / 2;
    this.track(this.add.image(ix, iy - 8, itemIconKey(this, item.id, item.rarity)).setScale(3));
    this.text(ix, iy + 32, itemTypes[item.type].label, 9, MUTE, true).setOrigin(0.5);

    const tx = x + 14 + 64 + 14;
    this.text(tx, y + 14, `${rarities[item.rarity].label} ${item.kind === 'potion' ? 'POTION' : 'ITEM'}`, 11, `#${rc.toString(16).padStart(6, '0')}`, true);
    this.text(tx, y + 32, item.name, 17, INK, true);
    this.text(tx, y + 56, item.description, 13, MUTE, false, CARD_W - (tx - x) - 14);
    return g;
  }

  // ---- step 1: pick a reward ---------------------------------------------------------

  showPick() {
    this.step = 'pick';
    this.clearStep();
    this.text(16, 66, 'Pick 1 reward', 26, INK, true);
    this.text(16, 104, 'Then choose which hero gets it.', 14, MUTE);

    this.cardHits = [];
    this.payload.choices.forEach((item, i) => {
      const y = 140 + i * (CARD_H + 12);
      this.drawCard(item, 16, y);
      const hit = this.track(this.add.zone(16 + CARD_W / 2, y + CARD_H / 2, CARD_W, CARD_H).setInteractive());
      hit.on('pointerdown', () => this.chooseCard(item));
    });

    const names = this.payload.state.heroes.map((h) => `${h.name} ${h.items.length}`).join(' · ');
    this.text(16, 780, `Squad items: ${names}`, 12, MUTE, true, CARD_W);
  }

  chooseCard(item) {
    this.chosen = item;
    if (item.kind === 'potion') {
      // The potion heals the whole party, so there is no hero to choose.
      this.payload.onDone(item.id, null);
      return;
    }
    this.showAssign();
  }

  // ---- step 2: choose who gets it ----------------------------------------------------

  // The lines under a hero: "ATK 18 -> 22" for each stat the item touches.
  previewLines(hero, item) {
    const after = this.payload.state.previewStats(hero.uid, item.id);
    const lines = [];
    const seen = new Set();
    for (const e of item.effects) {
      if (e.proc) {
        const copies = countOf(hero, item.id);
        const name = e.label.replace('!', '').toUpperCase();
        if (e.unique) lines.push({ text: `${name} ${copies ? e.chance : 0}>${e.chance}%`, up: true }); // more copies do not add chance
        else if (e.chance >= 100 && e.strike) lines.push({ text: `${name} ${copies * e.strike.damageMultiplier * 100}>${(copies + 1) * e.strike.damageMultiplier * 100}% ATK`, up: true });
        else lines.push({ text: `${name} ${copies * e.chance}>${(copies + 1) * e.chance}%`, up: true });
      } else if (e.special) {
        const before = hero.specials[e.special] || 0;
        const now = after.specials[e.special] || 0;
        const round = (v) => Math.round(v * 10) / 10;
        lines.push({ text: `${SPECIAL_LABEL[e.special] || e.special.replace(/([A-Z])/g, ' $1').toUpperCase()} ${round(before)}>${round(now)}%`, up: true });
      } else if (e.damageBonus) {
        const before = hero.damageBonus[e.damageBonus] || 0;
        const now = after.damageBonus[e.damageBonus] || 0;
        lines.push({ text: `${e.damageBonus.toUpperCase()} DMG ${before}>${now}%`, up: true });
      } else if (!seen.has(e.stat)) {
        seen.add(e.stat);
        const before = Math.round(hero.stats[e.stat]);
        const now = Math.round(after.stats[e.stat]);
        lines.push({ text: `${STAT_LABEL[e.stat]} ${before} > ${now}`, up: now >= before });
      }
    }
    return lines.slice(0, 3);
  }

  showAssign() {
    this.step = 'assign';
    this.clearStep();
    this.selected = null;
    const item = this.chosen;
    this.text(16, 66, 'Who gets it?', 26, INK, true);
    // Back to the 3 rewards (changed your mind).
    const back = this.text(GAME_WIDTH - 16, 80, '< Back', 16, INK, true).setOrigin(1, 0.5);
    const bw = back.width + 24;
    this.track(this.add.graphics()).lineStyle(2, COLORS.line, 1).strokeRoundedRect(GAME_WIDTH - 16 - bw + 6, 62, bw, 36, 10);
    this.track(this.add.zone(GAME_WIDTH - 16 - bw / 2 + 6, 80, bw + 8, 44).setInteractive()).on('pointerdown', () => this.showPick());
    this.drawCard(item, 16, 108);

    this.heroHits = [];
    this.heroGraphics = [];
    const colW = (CARD_W - 12) / 2;
    const cardH = 190;
    this.payload.state.heroes.forEach((hero, i) => {
      // Two cards per row; a lonely last card (3 heroes) sits in the middle.
      const total = this.payload.state.heroes.length;
      const alone = i === total - 1 && total % 2 === 1;
      const x = alone ? 16 + (colW + 12) / 2 : 16 + (i % 2) * (colW + 12);
      const y = 240 + Math.floor(i / 2) * (cardH + 12);
      const ok = canReceive(hero, item);
      const g = this.track(this.add.graphics());
      this.heroGraphics.push({ g, x, y, w: colW, h: cardH, hero });
      this.drawHeroCard(i, false);

      // A small copy of the hero (same parts as in battle).
      const ch = new Character(this, x + 38, y + 78, hero.def);
      ch.setScale(1.6);
      ch.setAlpha(ok ? 1 : 0.4);
      this.track(ch);

      this.text(x + 76, y + 14, hero.name, 16, INK, true).setAlpha(ok ? 1 : 0.5);
      this.text(x + 76, y + 36, `Lv${hero.level}`, 12, MUTE).setAlpha(ok ? 1 : 0.5);

      if (ok) {
        this.previewLines(hero, item).forEach((line, li) => {
          this.text(x + 12, y + 96 + li * 18, line.text, 12, line.up ? '#6dff8f' : '#ff8c8c', true);
        });
      } else {
        this.text(x + 12, y + 96, hero.alive ? 'Max stacks' : 'Fallen', 13, MUTE, true);
      }

      // Items this hero already has: the same small icons as under the skill squares in battle.
      this.drawOwnedIcons(hero, x, y + cardH - 34, colW, ok ? 1 : 0.5);

      if (ok) {
        const hit = this.track(this.add.zone(x + colW / 2, y + cardH / 2, colW, cardH).setInteractive());
        hit.on('pointerdown', () => this.selectHero(i));
        this.heroHits.push(hit);
      }
    });

    // The confirm button at the bottom.
    this.buttonGraphics = this.track(this.add.graphics());
    this.buttonText = this.text(GAME_WIDTH / 2, 798, 'Pick a hero', 18, '#ffffff', true).setOrigin(0.5);
    this.drawButton();
    this.buttonHit = this.track(this.add.zone(GAME_WIDTH / 2, 798, CARD_W, 52).setInteractive());
    this.buttonHit.on('pointerdown', () => this.confirm());
  }

  // One framed icon per kind of item (a white number = copies), 7 per row, 2 rows,
  // the rest as "+N". The bottom row sits at `bottomY`.
  drawOwnedIcons(hero, x, bottomY, w, alpha) {
    const counts = new Map();
    for (const id of hero.items) counts.set(id, (counts.get(id) || 0) + 1);
    let kinds = [...counts.entries()];
    const perRow = 7, gap = 22, maxShown = perRow * 2;
    let more = 0;
    if (kinds.length > maxShown) { more = kinds.length - (maxShown - 1); kinds = kinds.slice(0, maxShown - 1); }
    const rows = Math.ceil((kinds.length + (more ? 1 : 0)) / perRow);
    const left = x + (w - (perRow - 1) * gap) / 2;
    const at = (i) => [left + (i % perRow) * gap, bottomY - (rows - 1 - Math.floor(i / perRow)) * gap];
    const style = { fontFamily: 'monospace', fontSize: '10px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 3 };
    kinds.forEach(([id, count], i) => {
      const def = this.payload.state.itemDefs[id];
      const [ix, iy] = at(i);
      this.track(this.add.image(ix, iy, itemIconKey(this, id, def.rarity)).setAlpha(alpha));
      if (count > 1) this.track(this.add.text(ix + 11, iy + 11, String(count), style).setOrigin(1, 1).setAlpha(alpha));
    });
    if (more) {
      const [ix, iy] = at(kinds.length);
      this.text(ix, iy, `+${more}`, 11, INK, true).setOrigin(0.5).setAlpha(alpha);
    }
  }

  drawHeroCard(i, selected) {
    const { g, x, y, w, h, hero } = this.heroGraphics[i];
    g.clear();
    g.fillStyle(COLORS.panel, 1).fillRoundedRect(x, y, w, h, 14);
    g.lineStyle(selected ? 4 : 2, selected ? COLORS.gold : COLORS.line, 1).strokeRoundedRect(x, y, w, h, 14);
    if (!hero.alive) g.fillStyle(0x000000, 0.35).fillRoundedRect(x, y, w, h, 14);
  }

  drawButton() {
    const g = this.buttonGraphics;
    g.clear();
    g.fillStyle(this.selected ? COLORS.purple : COLORS.disabled, 1).fillRoundedRect(16, 772, CARD_W, 52, 14);
    this.buttonText.setText(this.selected ? `Give to ${this.selected.name}` : 'Pick a hero');
  }

  selectHero(i) {
    this.heroGraphics.forEach((_, idx) => this.drawHeroCard(idx, idx === i));
    this.selected = this.heroGraphics[i].hero;
    this.drawButton();
  }

  confirm() {
    if (!this.selected) return;
    this.payload.onDone(this.chosen.id, this.selected.uid);
  }
}
