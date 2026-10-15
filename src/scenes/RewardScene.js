import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import Character from '../entities/Character.js';
import itemTypes from '../data/itemTypes.json';
import rarities from '../data/rarities.json';
import { canReceive, countOf } from '../systems/items.js';
import { itemIconKey } from '../entities/itemIconTexture.js';
import * as sfx from '../audio/sfx.js';
import bookData from '../data/skillBooks.json';
import { rollBookPages, pageFit } from '../systems/books.js';
import { SKILL_COLORS } from '../config.js';

const COLORS = { sheet: 0x17112a, panel: 0x231b38, line: 0x3a2f57, purple: 0x8b55d6, gold: 0xf2b632, disabled: 0x3a3350 };
const INK = '#f3eefc';
const MUTE = '#a399c2';
const FONT = 'system-ui, Arial, sans-serif';
const SHEET_TOP = 44; // the sheet slides up to here; the dungeon stays visible (dimmed) above it
const PAD = 16;
const CARD_W = GAME_WIDTH - PAD * 2;
const TEXT_X = 112; // where a card's text starts (right of the icon)
const ICON_W = 98; // the icon column
const DESC_PX = 15; // description text size
const TITLE_H = 54; // the step title above the cards
const SPECIAL_LABEL = { block: 'BLOCK', regen: 'REGEN/s', thorns: 'THORNS', lifesteal: 'LIFESTEAL', skillDamage: 'SKILL DMG', critDamage: 'CRIT DMG', skillSplash: 'SPLASH', lifestealShare: 'SHARE', critDebuff: 'CRIT DEBUFF', clearHeal: 'CLEAR HEAL' };
const STAT_LABEL = { attack: 'ATK', health: 'HP', defense: 'DEF', resist: 'RES', evasion: 'EVA', crit: 'CRIT', attackEfficiency: 'SPD' };
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

// The reward screen: a sheet that slides up over the dungeon. Pick 1 of 3 items, then choose which
// hero gets it (or go back). It only shows choices and reports the result through
// payload.onDone(itemId, heroUid), after sliding back down.
export default class RewardScene extends Phaser.Scene {
  constructor() {
    super('Reward');
  }

  init(payload) {
    this.payload = payload; // { state, choices, floor, onDone }
  }

  create() {
    this.step = 'pick';
    this.bookPages = null;
    this.chosen = null;
    this.selected = null;
    this.stepObjects = [];
    this.busy = false;
    this.closing = false;

    // The dungeon behind gets darker; the sheet slides up from the bottom.
    this.dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05030a, 0).setInteractive();
    this.tweens.add({ targets: this.dim, fillAlpha: 0.6, duration: 300 });
    this.sheet = this.add.container(0, GAME_HEIGHT);
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.sheet, 1).fillRoundedRect(0, SHEET_TOP, GAME_WIDTH, GAME_HEIGHT - SHEET_TOP + 40, 24);
    bg.lineStyle(2, COLORS.purple, 0.8).strokeRoundedRect(0, SHEET_TOP, GAME_WIDTH, GAME_HEIGHT - SHEET_TOP + 40, 24);
    bg.fillStyle(COLORS.line, 1).fillRoundedRect(GAME_WIDTH / 2 - 22, SHEET_TOP + 8, 44, 5, 3); // the little handle
    this.sheet.add(bg);
    this.sheet.add(this.add.text(GAME_WIDTH / 2, SHEET_TOP + 24, this.payload.banner || `FLOOR ${this.payload.floor} CLEARED`, { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#f2b632' }).setOrigin(0.5, 0));
    this.tweens.add({ targets: this.sheet, y: 0, duration: 420, ease: 'Cubic.easeOut' });
    sfx.play('rewardUp');

    // A lone golden book (boss prize) opens straight on its pages.
    if (this.payload.choices.length === 1 && this.payload.choices[0].kind === 'book') {
      this.chosen = this.payload.choices[0];
      this.bookPages = rollBookPages(bookData, this.chosen.book);
      this.showPages();
    } else this.showPick(true);
  }

  // ---- helpers -----------------------------------------------------------------------

  track(obj) {
    this.sheet.add(obj);
    this.stepObjects.push(obj);
    return obj;
  }

  clearStep() {
    for (const o of this.stepObjects) o.destroy();
    this.stepObjects = [];
  }

  text(x, y, str, size, color, bold = false, wrap = 0) {
    const style = { fontFamily: FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color, lineSpacing: 2 };
    if (wrap) style.wordWrap = { width: wrap, useAdvancedWrap: true };
    return this.track(this.add.text(x, y, str, style));
  }

  // Text that must fit a box: wraps to `w` and shrinks a size at a time until it is at most `maxH` tall.
  fitText(x, y, str, size, color, w, maxH, bold = false) {
    const t = this.text(x, y, str, size, color, bold, w);
    for (let s = size - 1; t.height > maxH && s >= 10; s--) t.setFontSize(s);
    return t;
  }

  rarityColor(item) {
    return Number(rarities[item.rarity].color);
  }

  // How tall a card must be for its description (the card grows instead of the text spilling out).
  cardHeight(item) {
    const probe = this.add.text(0, 0, item.description, { fontFamily: FONT, fontSize: `${DESC_PX}px`, lineSpacing: 3, wordWrap: { width: CARD_W - TEXT_X - 16, useAdvancedWrap: true } });
    const h = probe.height;
    probe.destroy();
    return Math.max(136, 68 + h + 18);
  }

  // One reward card: icon in its rarity frame + type, rarity, name, description.
  drawCard(item, x, y, h, highlighted = false) {
    const rc = this.rarityColor(item);
    const card = this.add.container(x, y);
    this.track(card);
    const g = this.add.graphics();
    const paint = (lit) => {
      g.clear();
      g.fillStyle(0x000000, 0.3).fillRoundedRect(2, 4, CARD_W, h, 16);
      g.fillStyle(lit ? 0x31254d : COLORS.panel, 1).fillRoundedRect(0, 0, CARD_W, h, 16);
      g.fillStyle(rc, 0.12).fillRoundedRect(0, 0, ICON_W, h, { tl: 16, bl: 16, tr: 0, br: 0 }); // a rarity tint behind the icon
      g.lineStyle(lit ? 4 : 2, lit ? COLORS.gold : rc, 1).strokeRoundedRect(0, 0, CARD_W, h, 16);
    };
    paint(highlighted);
    card.add(g);
    card.add(this.add.image(ICON_W / 2, h / 2 - 9, itemIconKey(this, item.id, item.rarity)).setScale(4));
    card.add(this.add.text(ICON_W / 2, h / 2 + 42, itemTypes[item.type].label, { fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: MUTE }).setOrigin(0.5));
    card.add(this.add.text(TEXT_X, 16, `${rarities[item.rarity].label} ${item.kind === 'potion' ? 'POTION' : item.kind === 'book' ? 'BOOK' : 'ITEM'}`, { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: hex(rc) }));
    const name = this.add.text(TEXT_X, 34, item.name, { fontFamily: FONT, fontSize: '21px', fontStyle: 'bold', color: INK });
    for (let s = 20; name.width > CARD_W - TEXT_X - 16 && s >= 13; s--) name.setFontSize(s); // long names shrink to fit
    card.add(name);
    card.add(this.add.text(TEXT_X, 66, item.description, { fontFamily: FONT, fontSize: `${DESC_PX}px`, color: MUTE, lineSpacing: 3, wordWrap: { width: CARD_W - TEXT_X - 16, useAdvancedWrap: true } }));
    card.paint = paint;
    return card;
  }

  // ---- step 1: pick a reward ---------------------------------------------------------

  showPick(first = false) {
    this.step = 'pick';
    this.clearStep();
    // The title and the cards sit in the MIDDLE of the sheet (user's choice), not at its top.
    const heights = this.payload.choices.map((item) => this.cardHeight(item));
    const total = TITLE_H + heights.reduce((a, b) => a + b, 0) + 14 * (heights.length - 1);
    const top = SHEET_TOP + Math.max(44, (GAME_HEIGHT - SHEET_TOP - total) / 2);
    this.text(GAME_WIDTH / 2, top, 'Choose a reward', 28, INK, true).setOrigin(0.5, 0);

    let y = top + TITLE_H;
    this.payload.choices.forEach((item, i) => {
      const h = heights[i];
      const card = this.drawCard(item, PAD, y, h);
      const hit = this.track(this.add.zone(PAD + CARD_W / 2, y + h / 2, CARD_W, h).setInteractive());
      hit.on('pointerdown', () => {
        if (this.busy || this.closing) return;
        card.paint(true);
        this.busy = true;
        this.time.delayedCall(140, () => { this.busy = false; this.chooseCard(item); });
      });
      // The cards rise in one after another (only the first time the sheet comes up).
      if (first) {
        card.setAlpha(0).setY(y + 40);
        this.tweens.add({ targets: card, alpha: 1, y, duration: 320, delay: 260 + i * 110, ease: 'Back.easeOut', onStart: () => sfx.play('rewardCard') });
      }
      y += h + 14;
    });
  }

  chooseCard(item) {
    sfx.play('tap');
    this.chosen = item;
    if (item.kind === 'potion') return this.finish(item.id, null); // the potion heals the whole party: no hero to choose
    if (item.kind === 'book') {
      this.bookPages = this.bookPages || rollBookPages(bookData, item.book); // the same 3 pages if you go back and forth
      return this.showPages();
    }
    this.showAssign();
  }

  // ---- skill book: pick a page, then the hero's skill (then, on a full skill, which modifier it replaces) -------

  // A small "Back" pill at the top right of the sheet.
  backButton(onTap) {
    const bw = 84;
    const bx = GAME_WIDTH - PAD - bw;
    const bb = this.track(this.add.graphics());
    bb.fillStyle(COLORS.panel, 1).fillRoundedRect(bx, SHEET_TOP + 48, bw, 32, 16).lineStyle(2, COLORS.line, 1).strokeRoundedRect(bx, SHEET_TOP + 48, bw, 32, 16);
    this.text(bx + bw / 2, SHEET_TOP + 64, '‹ Back', 14, INK, true).setOrigin(0.5);
    this.track(this.add.zone(bx + bw / 2, SHEET_TOP + 64, bw + 10, 44).setInteractive()).on('pointerdown', () => { sfx.play('tap'); onTap(); });
  }

  // Page card sizes: normal, or COMPACT when a book shows more than 3 pages (the Skill Dealer's 5) so all fit.
  pageLook() {
    return this.compactPages
      ? { iconW: 64, textX: 74, desc: 13, name: 17, label: 11, nameY: 25, descY: 49, minH: 80, iconScale: 2, gap: 10 }
      : { iconW: ICON_W, textX: TEXT_X, desc: DESC_PX, name: 20, label: 12, nameY: 32, descY: 62, minH: 112, iconScale: 3, gap: 14 };
  }

  pageHeight(page) {
    const L = this.pageLook();
    const probe = this.add.text(0, 0, page.text, { fontFamily: FONT, fontSize: `${L.desc}px`, lineSpacing: 3, wordWrap: { width: CARD_W - L.textX - 16, useAdvancedWrap: true } });
    const h = probe.height;
    probe.destroy();
    return Math.max(L.minH, L.descY + h + (this.compactPages ? 10 : 16));
  }

  // One page card: the book icon, STAT PAGE / its tag (Debuff, Heal...), its name and what it does.
  drawPageCard(page, x, y, h, lit = false) {
    const card = this.track(this.add.container(x, y));
    const golden = this.chosen && this.chosen.book === 'golden';
    const rc = page.kind === 'stat' ? 0x7f9fe8 : 0xc8a0ff;
    const L = this.pageLook();
    const g = this.add.graphics();
    const paint = (on) => {
      g.clear();
      g.fillStyle(0x000000, 0.3).fillRoundedRect(2, 4, CARD_W, h, 16);
      g.fillStyle(on ? 0x31254d : COLORS.panel, 1).fillRoundedRect(0, 0, CARD_W, h, 16);
      g.fillStyle(rc, 0.12).fillRoundedRect(0, 0, L.iconW, h, { tl: 16, bl: 16, tr: 0, br: 0 });
      g.lineStyle(on ? 4 : 2, on ? COLORS.gold : rc, 1).strokeRoundedRect(0, 0, CARD_W, h, 16);
    };
    paint(lit);
    card.add(g);
    card.add(this.add.image(L.iconW / 2, h / 2 - (this.compactPages ? 0 : 8), itemIconKey(this, golden ? 'golden_book' : 'skill_book', golden ? 'legendary' : 'rare')).setScale(L.iconScale));
    card.add(this.add.text(L.textX, this.compactPages ? 9 : 14, page.kind === 'stat' ? 'STAT PAGE' : `MODIFIER · ${(page.tag || '').toUpperCase()}`, { fontFamily: FONT, fontSize: `${L.label}px`, fontStyle: 'bold', color: hex(rc) }));
    card.add(this.add.text(L.textX, L.nameY, page.name, { fontFamily: FONT, fontSize: `${L.name}px`, fontStyle: 'bold', color: INK }));
    card.add(this.add.text(L.textX, L.descY, page.text, { fontFamily: FONT, fontSize: `${L.desc}px`, color: MUTE, lineSpacing: 3, wordWrap: { width: CARD_W - L.textX - 16, useAdvancedWrap: true } }));
    card.paint = paint;
    return card;
  }

  showPages() {
    this.step = 'pages';
    this.clearStep();
    const pages = this.bookPages;
    this.compactPages = pages.length > 3;
    const gap = this.pageLook().gap;
    const heights = pages.map((p) => this.pageHeight(p));
    const total = TITLE_H + 26 + heights.reduce((a, b) => a + b, 0) + gap * (heights.length - 1);
    const top = SHEET_TOP + Math.max(this.payload.choices.length > 1 ? 90 : 56, (GAME_HEIGHT - SHEET_TOP - total) / 2); // room for the Back pill
    if (this.payload.choices.length > 1) this.backButton(() => this.showPick());
    this.text(GAME_WIDTH / 2, top, 'Choose a page', 28, INK, true).setOrigin(0.5, 0);
    this.text(GAME_WIDTH / 2, top + 36, 'It stays on one skill for the rest of the run.', 13, MUTE).setOrigin(0.5, 0);
    let y = top + TITLE_H + 26;
    pages.forEach((page, i) => {
      const card = this.drawPageCard(page, PAD, y, heights[i]);
      this.track(this.add.zone(PAD + CARD_W / 2, y + heights[i] / 2, CARD_W, heights[i]).setInteractive()).on('pointerdown', () => {
        if (this.busy || this.closing) return;
        card.paint(true);
        sfx.play('tap');
        this.busy = true;
        this.time.delayedCall(140, () => { this.busy = false; this.showSkillPick(page); });
      });
      y += heights[i] + gap;
    });
  }

  // Which hero's skill gets the page: every hero is a row with its two skill buttons (attack red, support green).
  showSkillPick(page) {
    this.step = 'skill';
    this.clearStep();
    this.pickedPage = page;
    this.target = null;
    this.backButton(() => this.showPages());
    this.text(PAD, SHEET_TOP + 46, 'Which skill?', 26, INK, true);
    const sum = this.text(PAD, SHEET_TOP + 86, `${page.name}: ${page.text}`, 13, MUTE, false, CARD_W);
    const limits = this.payload.state.rules.books || {};
    const skillDefs = this.payload.state.skillDefs;
    const rowH = 124;
    let y = SHEET_TOP + 96 + sum.height + 8;
    this.skillButtons = [];
    for (const hero of this.payload.state.heroes) {
      const g = this.track(this.add.graphics());
      g.fillStyle(COLORS.panel, 1).fillRoundedRect(PAD, y, CARD_W, rowH - 10, 16).lineStyle(2, COLORS.line, 1).strokeRoundedRect(PAD, y, CARD_W, rowH - 10, 16);
      const ch = new Character(this, PAD + 34, y + 92, hero.def);
      ch.setScale(2).setAlpha(hero.alive ? 1 : 0.35);
      this.track(ch);
      this.text(PAD + 70, y + 8, hero.name, 15, INK, true).setAlpha(hero.alive ? 1 : 0.5);
      const bw = (CARD_W - 70 - 16) / 2;
      hero.skills.forEach((slot, idx) => {
        const bx = PAD + 70 + idx * (bw + 6);
        const by = y + 32;
        const fit = pageFit(hero, idx, page, limits);
        const usable = fit === 'ok' || fit === 'replace';
        const pages = slot.pages || [];
        const stats = pages.filter((p) => p.kind === 'stat').length;
        const mods = pages.filter((p) => p.kind === 'modifier').length;
        const col = SKILL_COLORS[slot.kind] || SKILL_COLORS.attack;
        const bg = this.track(this.add.graphics());
        const btn = { bg, bx, by, bw, bh: 70, hero, idx, fit, col };
        btn.paint = (on) => {
          bg.clear();
          bg.fillStyle(on ? 0x31254d : 0x1c1530, 1).fillRoundedRect(bx, by, bw, 70, 12);
          bg.lineStyle(on ? 3 : 2, on ? COLORS.gold : usable ? col.ready : COLORS.line, usable ? 1 : 0.5).strokeRoundedRect(bx, by, bw, 70, 12);
        };
        btn.paint(false);
        this.fitText(bx + 8, by + 6, skillDefs[slot.id].name, 13, usable ? INK : MUTE, bw - 16, 34, true);
        const note = fit === 'dead' ? 'Fallen' : fit === 'full' ? 'Stat pages full' : fit === 'duplicate' ? 'Already has it' : fit === 'replace' ? 'Full: replaces one' : `${stats}/${limits.maxStatPages ?? 3} stats · ${mods}/${limits.modifierSlots ?? 2} mods`;
        this.text(bx + 8, by + 50, note, 11, fit === 'replace' ? '#ffd9a0' : MUTE);
        if (usable) this.track(this.add.zone(bx + bw / 2, by + 35, bw, 70).setInteractive()).on('pointerdown', () => this.selectSkill(btn));
        this.skillButtons.push(btn);
      });
      y += rowH;
    }
    this.buttonGraphics = this.track(this.add.graphics());
    this.buttonText = this.text(GAME_WIDTH / 2, GAME_HEIGHT - 46, 'Pick a skill', 18, '#ffffff', true).setOrigin(0.5);
    this.drawBookButton();
    this.track(this.add.zone(GAME_WIDTH / 2, GAME_HEIGHT - 46, CARD_W, 52).setInteractive()).on('pointerdown', () => this.confirmPage());
  }

  selectSkill(btn) {
    sfx.play('tap');
    this.target = btn;
    for (const b of this.skillButtons) b.paint(b === btn);
    this.drawBookButton();
  }

  drawBookButton() {
    const g = this.buttonGraphics;
    const t = this.target;
    g.clear();
    const y = GAME_HEIGHT - 72;
    g.fillStyle(t ? 0x2f9a55 : COLORS.disabled, 1).fillRoundedRect(PAD, y, CARD_W, 52, 26);
    if (t) g.lineStyle(2, COLORS.gold, 1).strokeRoundedRect(PAD, y, CARD_W, 52, 26);
    const name = t && this.payload.state.skillDefs[t.hero.skills[t.idx].id].name;
    this.buttonText.setText(t ? (t.fit === 'replace' ? 'Choose what it replaces' : `Write it into ${name}`) : 'Pick a skill').setColor(t ? '#ffffff' : '#8a82a8');
    for (let s = 18; this.buttonText.width > CARD_W - 24 && s >= 12; s--) this.buttonText.setFontSize(s);
  }

  confirmPage() {
    const t = this.target;
    if (!t || this.closing) return;
    if (t.fit === 'replace') return this.showReplace(t);
    this.finish(this.chosen.id, t.hero.uid, { page: this.pickedPage, index: t.idx, replace: null });
  }

  // The skill already has its 2 modifiers: the new page replaces the one you tap.
  showReplace(t) {
    this.step = 'replace';
    this.clearStep();
    this.backButton(() => this.showSkillPick(this.pickedPage));
    const skill = this.payload.state.skillDefs[t.hero.skills[t.idx].id];
    this.text(PAD, SHEET_TOP + 46, 'Replace which page?', 26, INK, true);
    const sub = this.text(PAD, SHEET_TOP + 86, `${skill.name} can hold 2 modifiers. ${this.pickedPage.name} takes the place of the one you tap.`, 13, MUTE, false, CARD_W);
    let y = SHEET_TOP + 96 + sub.height + 10;
    const mods = (t.hero.skills[t.idx].pages || []).filter((p) => p.kind === 'modifier');
    mods.forEach((p, i) => {
      const h = this.pageHeight(p);
      const card = this.drawPageCard(p, PAD, y, h);
      this.track(this.add.zone(PAD + CARD_W / 2, y + h / 2, CARD_W, h).setInteractive()).on('pointerdown', () => {
        if (this.closing) return;
        card.paint(true);
        this.finish(this.chosen.id, t.hero.uid, { page: this.pickedPage, index: t.idx, replace: i });
      });
      y += h + 14;
    });
  }

  // ---- step 2: choose who gets it ----------------------------------------------------

  // The lines under a hero: "ATK 18 > 22" for each stat the item touches.
  previewLines(hero, item) {
    const after = this.payload.state.previewStats(hero.uid, item.id);
    const lines = [];
    const seen = new Set();
    for (const e of item.effects) {
      if (e.proc) {
        const copies = countOf(hero, item.id);
        const name = (e.label || item.name).replace('!', '').toUpperCase();
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
      } else if (e.stat && !seen.has(e.stat)) {
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
    this.text(PAD, SHEET_TOP + 46, 'Who gets it?', 26, INK, true);
    // Back to the 3 rewards (changed your mind).
    const bw = 84;
    const bx = GAME_WIDTH - PAD - bw;
    const bb = this.track(this.add.graphics());
    bb.fillStyle(COLORS.panel, 1).fillRoundedRect(bx, SHEET_TOP + 48, bw, 32, 16).lineStyle(2, COLORS.line, 1).strokeRoundedRect(bx, SHEET_TOP + 48, bw, 32, 16);
    this.text(bx + bw / 2, SHEET_TOP + 64, '‹ Back', 14, INK, true).setOrigin(0.5);
    this.track(this.add.zone(bx + bw / 2, SHEET_TOP + 64, bw + 10, 44).setInteractive()).on('pointerdown', () => { sfx.play('tap'); this.showPick(); });

    const itemH = this.cardHeight(item);
    this.drawCard(item, PAD, SHEET_TOP + 94, itemH, true);

    this.heroGraphics = [];
    const colW = (CARD_W - 12) / 2;
    const cardH = 184;
    const top = SHEET_TOP + 94 + itemH + 14;
    const heroes = this.payload.state.heroes;
    heroes.forEach((hero, i) => {
      // Two cards per row; a lonely last card (3 heroes) sits in the middle.
      const alone = i === heroes.length - 1 && heroes.length % 2 === 1;
      const x = alone ? PAD + (colW + 12) / 2 : PAD + (i % 2) * (colW + 12);
      const y = top + Math.floor(i / 2) * (cardH + 10);
      const ok = canReceive(hero, item);
      const g = this.track(this.add.graphics());
      this.heroGraphics.push({ g, x, y, w: colW, h: cardH, hero });
      this.drawHeroCard(i, false);

      // A small copy of the hero (same parts as in battle).
      const ch = new Character(this, x + 34, y + 70, hero.def);
      ch.setScale(2);
      ch.setAlpha(ok ? 1 : 0.4);
      this.track(ch);

      this.text(x + 66, y + 14, hero.name, 15, INK, true).setAlpha(ok ? 1 : 0.5);
      this.text(x + 66, y + 34, `Lv ${hero.level}`, 12, MUTE).setAlpha(ok ? 1 : 0.5);

      if (ok) {
        let ly = y + 88;
        for (const line of this.previewLines(hero, item)) {
          const t = this.fitText(x + 10, ly, line.text, 12, line.up ? '#6dff8f' : '#ff8c8c', colW - 20, 30, true);
          ly += t.height + 3;
        }
      } else {
        this.text(x + 10, y + 90, hero.alive ? 'Max stacks' : 'Fallen', 13, MUTE, true);
      }

      // Items this hero already has: the same small icons as under the skill squares in battle.
      this.drawOwnedIcons(hero, x, y + cardH - 18, colW, ok ? 1 : 0.5);

      if (ok) this.track(this.add.zone(x + colW / 2, y + cardH / 2, colW, cardH).setInteractive()).on('pointerdown', () => this.selectHero(i));
    });

    // The Give button at the bottom.
    this.buttonGraphics = this.track(this.add.graphics());
    this.buttonText = this.text(GAME_WIDTH / 2, GAME_HEIGHT - 46, 'Pick a hero', 18, '#ffffff', true).setOrigin(0.5);
    this.drawButton();
    this.track(this.add.zone(GAME_WIDTH / 2, GAME_HEIGHT - 46, CARD_W, 52).setInteractive()).on('pointerdown', () => this.confirm());
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
    g.fillStyle(selected ? 0x31254d : COLORS.panel, 1).fillRoundedRect(x, y, w, h, 16);
    g.lineStyle(selected ? 4 : 2, selected ? COLORS.gold : COLORS.line, 1).strokeRoundedRect(x, y, w, h, 16);
    if (!hero.alive) g.fillStyle(0x000000, 0.35).fillRoundedRect(x, y, w, h, 16);
  }

  drawButton() {
    const g = this.buttonGraphics;
    g.clear();
    const y = GAME_HEIGHT - 72;
    g.fillStyle(this.selected ? 0x2f9a55 : COLORS.disabled, 1).fillRoundedRect(PAD, y, CARD_W, 52, 26);
    if (this.selected) g.lineStyle(2, COLORS.gold, 1).strokeRoundedRect(PAD, y, CARD_W, 52, 26);
    this.buttonText.setText(this.selected ? `Give to ${this.selected.name}` : 'Pick a hero').setColor(this.selected ? '#ffffff' : '#8a82a8');
  }

  selectHero(i) {
    sfx.play('tap');
    this.heroGraphics.forEach((_, idx) => this.drawHeroCard(idx, idx === i));
    this.selected = this.heroGraphics[i].hero;
    this.drawButton();
  }

  confirm() {
    if (!this.selected) return;
    this.finish(this.chosen.id, this.selected.uid);
  }

  // The sheet slides back down, then the battle gets the result.
  // `book` = { page, index, replace } when a skill book page was written into a skill.
  finish(itemId, heroUid, book = null) {
    if (this.closing) return;
    this.closing = true;
    sfx.play(heroUid ? 'itemGiven' : 'potion');
    this.tweens.add({ targets: this.dim, fillAlpha: 0, duration: 260 });
    this.tweens.add({ targets: this.sheet, y: GAME_HEIGHT, duration: 300, ease: 'Cubic.easeIn', onComplete: () => this.payload.onDone(itemId, heroUid, book) });
  }
}
