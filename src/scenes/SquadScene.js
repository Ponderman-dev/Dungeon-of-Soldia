import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import Character from '../entities/Character.js';
import heroDefs from '../data/heroes.json';
import skillDefs from '../data/skills.json';
import unlocks from '../data/unlocks.json';
import defaultSquad from '../data/squad.json';
import { perkMods } from '../systems/party.js';
import { loadProgress, saveProgress, isUnlocked, unlockedIds, newHeroes, describeRequirement, describeProgress, randomSquad } from '../systems/progress.js';

const COLORS = { bg: 0x14101f, panel: 0x221b33, line: 0x3a2f57, gold: 0xf2b632, green: 0x6dff8f, locked: 0x1a1526 };
const INK = '#f3eefc';
const MUTE = '#9a8fb8';
const FONT = 'system-ui, Arial, sans-serif';
const CARD_W = 176;
const CARD_H = 108;
const GAP_X = 14;
const GAP_Y = 8;
const TOP = 118;
const STAT_SHORT = { attack: 'ATK', health: 'HP', defense: 'DEF', resist: 'RES', evasion: 'EVA', crit: 'CRIT', attackEfficiency: 'SPD' };

// The squad select screen: pick 3 of the unlocked heroes (tap a card; the order you tap is the order on
// the battlefield, left to right), or press RANDOM. Locked heroes show how to unlock them. A toggle unlocks
// everyone (for testing). Shown first, and again after every defeat (with the last run's result).
export default class SquadScene extends Phaser.Scene {
  constructor() {
    super('Squad');
  }

  init(data) {
    this.lastRun = (data && data.lastRun) || null; // { floor, kills, newly: [hero ids unlocked by that run] }
  }

  create() {
    this.progress = loadProgress();
    const ids = unlockedIds(heroDefs, this.progress, unlocks);
    // Start from the last squad (if all of it is still unlocked), else the default squad.
    const last = this.registry.get('squadIds') || this.progress.lastSquad || defaultSquad;
    this.selected = last.every((id) => ids.includes(id)) ? [...last] : defaultSquad.filter((id) => ids.includes(id));
    this.newIds = newHeroes(heroDefs, this.progress, unlocks);

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg);
    this.add.text(16, 58, 'Choose your squad', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: INK }).setOrigin(0, 0.5);
    this.add.text(16, 84, this.lastRun ? `Last run: floor ${this.lastRun.floor}, ${this.lastRun.kills} enemies defeated` : 'Tap 3 heroes, or press RANDOM', { fontFamily: FONT, fontSize: '12px', color: this.lastRun ? '#f2b632' : MUTE }).setOrigin(0, 0.5);
    const fresh = this.lastRun ? (this.lastRun.newly || []) : this.newIds;
    if (fresh.length) this.add.text(16, 101, `NEW heroes unlocked: ${fresh.map((id) => heroDefs.find((h) => h.id === id).name).join(', ')}`, { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#6dff8f' }).setOrigin(0, 0.5);

    this.cards = heroDefs.map((def, i) => this.makeCard(def, i));

    this.squadText = this.add.text(GAME_WIDTH / 2, 716, '', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: INK }).setOrigin(0.5);
    this.randomBtn = this.makeButton(12, 740, 176, 44, 'RANDOM', () => this.pickRandom());
    this.startBtn = this.makeButton(202, 740, 176, 44, 'START', () => this.start());
    this.toggleText = this.add.text(GAME_WIDTH / 2, 806, '', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: MUTE }).setOrigin(0.5);
    this.add
      .zone(GAME_WIDTH / 2, 806, 300, 30)
      .setInteractive()
      .on('pointerdown', () => this.toggleUnlockAll());
    this.refresh();
  }

  // One hero card: preview, name, type, passive, skills, perk; or the unlock requirement if locked.
  makeCard(def, i) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 12 + col * (CARD_W + GAP_X);
    const y = TOP + row * (CARD_H + GAP_Y);
    const card = { def, x, y, objects: [] };
    card.bg = this.add.rectangle(x + CARD_W / 2, y + CARD_H / 2, CARD_W, CARD_H, COLORS.panel).setStrokeStyle(2, COLORS.line);
    card.ch = new Character(this, x + 32, y + 84, def).setScale(2);
    const text = (px, py, str, style) => this.add.text(x + px, y + py, str, { fontFamily: FONT, ...style }).setOrigin(0, 0.5);
    card.name = text(66, 14, def.name, { fontSize: '14px', fontStyle: 'bold', color: INK });
    const element = ['fire', 'holy', 'dark', 'ice', 'electric'].includes(def.damageType) ? ` · ${def.damageType.toUpperCase()}` : '';
    card.type = text(66, 30, `${def.damageType === 'melee' ? 'MELEE' : 'RANGED'}${element}`, { fontSize: '10px', color: MUTE });
    card.passive = text(66, 44, def.passive.name, { fontSize: '10px', fontStyle: 'bold', color: '#f2d66b' });
    card.attack = text(66, 60, skillDefs[def.skills.attack].name, { fontSize: '10px', color: '#ff9a7a' });
    card.support = text(66, 74, skillDefs[def.skills.support].name, { fontSize: '10px', color: '#8ee6a8' });
    const perk = perkMods({ def, level: 1 }).map((m) => `${m.percent !== undefined ? `+${m.percent}%` : `+${m.flat}`} ${STAT_SHORT[m.stat]}`).join(' ');
    card.perk = text(66, 92, `Team ${perk}`, { fontSize: '9px', color: '#7fd8a0' });
    card.badge = this.add.text(x + CARD_W - 8, y + 12, '', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#14101f', backgroundColor: '#f2b632', padding: { x: 5, y: 1 } }).setOrigin(1, 0.5);
    card.lock = this.add.rectangle(x + CARD_W / 2, y + CARD_H / 2, CARD_W, CARD_H, 0x0c0914, 0.78);
    card.lockText = this.add.text(x + CARD_W / 2, y + CARD_H / 2, '', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#ffd9a0', align: 'center', wordWrap: { width: CARD_W - 16 } }).setOrigin(0.5);
    card.newTag = this.add.text(x + CARD_W - 8, y + CARD_H - 10, 'NEW', { fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: '#14101f', backgroundColor: '#6dff8f', padding: { x: 4, y: 1 } }).setOrigin(1, 0.5);
    this.add
      .zone(x + CARD_W / 2, y + CARD_H / 2, CARD_W, CARD_H)
      .setInteractive()
      .on('pointerdown', () => this.tapCard(card));
    return card;
  }

  makeButton(x, y, w, h, label, onTap) {
    const bg = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x4a3a78).setStrokeStyle(2, COLORS.gold);
    const text = this.add.text(x + w / 2, y + h / 2, label, { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: INK }).setOrigin(0.5);
    this.add
      .zone(x + w / 2, y + h / 2, w, h)
      .setInteractive()
      .on('pointerdown', onTap);
    return { bg, text };
  }

  unlocked(id) {
    return isUnlocked(id, this.progress, unlocks);
  }

  tapCard(card) {
    if (!this.unlocked(card.def.id)) return;
    const i = this.selected.indexOf(card.def.id);
    if (i >= 0) this.selected.splice(i, 1);
    else {
      if (this.selected.length >= 3) this.selected.shift(); // a 4th tap replaces the oldest pick
      this.selected.push(card.def.id);
    }
    this.refresh();
  }

  pickRandom() {
    this.selected = randomSquad(unlockedIds(heroDefs, this.progress, unlocks));
    this.refresh();
    this.cameras.main.flash(120, 255, 255, 255, false);
  }

  toggleUnlockAll() {
    this.progress.unlockAll = !this.progress.unlockAll;
    saveProgress(this.progress);
    // Locked heroes can't stay selected after switching back.
    this.selected = this.selected.filter((id) => this.unlocked(id));
    this.refresh();
  }

  // Redraws every card, the squad line, the buttons and the toggle for the current state.
  refresh() {
    for (const c of this.cards) {
      const open = this.unlocked(c.def.id);
      const pick = this.selected.indexOf(c.def.id);
      c.bg.setStrokeStyle(pick >= 0 ? 4 : 2, pick >= 0 ? COLORS.gold : COLORS.line);
      c.bg.setFillStyle(pick >= 0 ? 0x3a2f57 : COLORS.panel);
      c.badge.setText(pick >= 0 ? ` ${pick + 1} ` : '').setVisible(pick >= 0);
      c.lock.setVisible(!open);
      c.ch.setAlpha(open ? 1 : 0.35);
      const req = unlocks.requirements[c.def.id];
      c.lockText.setText(open || !req ? '' : `LOCKED\n${describeRequirement(req, unlocks)}\n(${describeProgress(req, this.progress, unlocks)})`);
      const isNew = open && (this.lastRun ? (this.lastRun.newly || []).includes(c.def.id) : this.newIds.includes(c.def.id));
      c.newTag.setVisible(isNew);
    }
    const names = this.selected.map((id) => heroDefs.find((h) => h.id === id).name);
    const need = Math.min(3, unlockedIds(heroDefs, this.progress, unlocks).length);
    this.squadText.setText(names.length ? `Squad: ${names.join(' · ')}` : 'Squad: (pick heroes)').setColor(this.selected.length === need ? '#6dff8f' : INK);
    const ready = this.selected.length === need;
    this.startBtn.bg.setFillStyle(ready ? 0x2f9a55 : 0x3a3350).setStrokeStyle(2, ready ? COLORS.green : COLORS.line);
    this.startBtn.text.setColor(ready ? '#ffffff' : '#6f6890');
    this.toggleText.setText(`[${this.progress.unlockAll ? 'x' : ' '}] Unlock every hero (test)`).setColor(this.progress.unlockAll ? '#6dff8f' : MUTE);
  }

  start() {
    const need = Math.min(3, unlockedIds(heroDefs, this.progress, unlocks).length);
    if (this.selected.length !== need) return;
    this.progress.lastSquad = [...this.selected];
    this.progress.seenUnlocked = unlockedIds(heroDefs, this.progress, unlocks); // the NEW tags are gone next time
    saveProgress(this.progress);
    this.registry.set('squadIds', [...this.selected]);
    this.scene.start('Battle');
  }
}
