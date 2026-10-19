import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config.js';
import { drawWindow, drawCursor } from '../entities/uiKit.js';
import Character from '../entities/Character.js';
import itemTypes from '../data/itemTypes.json';
import rarities from '../data/rarities.json';
import { canReceive } from '../systems/items.js';
import { itemIconKey } from '../entities/itemIconTexture.js';
import { bookPageIconKey } from '../entities/skillIconTexture.js';
import { FRAMED_SIZE } from '../systems/itemIcons.js';
import * as sfx from '../audio/sfx.js';
import bookData from '../data/skillBooks.json';
import { rollBookPages, pageFit } from '../systems/books.js';
import { SKILL_COLORS } from '../config.js';

// The interface look (config.js UI, entities/uiKit.js): black windows, white lines, gold = chosen, pixel font.
const COLORS = { gold: 0xffd84a, dim: 0x4a4a5a };
const INK = UI.text;
const MUTE = '#c8c8d4'; // descriptions: a light grey so the white names stand out
const FONT = UI.font;
// Press Start 2P stays crisp on its 8px grid: every old size becomes 8 (small text) or 16 (titles, names, buttons).
const px = (size) => (size >= 16 ? 16 : 8);
const SHEET_TOP = 44; // the highest the sheet ever goes; it is only as tall as each step needs and sits in the MIDDLE of the screen (screen review)
const HEAD = 52; // the sheet's top row (FLOOR N CLEARED, the Back pill); a step's content starts this far down
const SHEET_MAX_BOTTOM = GAME_HEIGHT - 8; // the lowest its bottom edge ever goes
const PAD = 16;
const CARD_W = GAME_WIDTH - PAD * 2;
const ROW_ITEM_LINES = 3; // a hero row on 'Who gets it?' grows for up to this many lines of item icons
const TEXT_X = 112; // where a card's text starts (right of the icon)
const ICON_W = 98; // the icon column
const DESC_PX = 8; // description text size
const BACK_W = 84; // the Back pill's width (top right of the sheet)
const TITLE_H = 54; // the step title above the cards
const BTN_H = 76; // the big confirm button at the bottom (Give / Write it in); user: "needs to be bigger"
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
    this.sheetBg = this.add.graphics();
    this.sheet.add(this.sheetBg);
    this.banner = this.add.text(GAME_WIDTH / 2, 0, this.payload.banner || `FLOOR ${this.payload.floor} CLEARED`, { fontFamily: FONT, fontSize: '8px', color: UI.gold }).setOrigin(0.5, 0);
    // A long banner ('BOSS DEFEATED: A GOLDEN BOOK') ran under the Back pill: it wraps to two lines between the pills.
    const room = 2 * (GAME_WIDTH - PAD - BACK_W - 8 - GAME_WIDTH / 2);
    this.bannerDy = 20;
    if (this.banner.width > room) {
      if (this.banner.text.includes(': ')) this.banner.setText(this.banner.text.replace(': ', ':\n')); // break after the colon
      this.banner.setWordWrapWidth(room).setAlign('center').setLineSpacing(4);
      this.bannerDy = 14;
    }
    this.sheet.add(this.banner);
    this.top = null; // the sheet's top edge now (each step sets it with fitSheet)
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

  // The sheet is only as tall as a step needs (`contentH` = the step's content under the top row) and sits in the
  // middle of the screen (user). Returns the sheet's new top edge (the step draws from there); this.btnY = where a
  // step's big bottom button goes. The window grows or shrinks to it in a short slide.
  fitSheet(contentH) {
    const h = Math.min(SHEET_MAX_BOTTOM - SHEET_TOP, HEAD + contentH);
    const top = Math.round(Math.max(SHEET_TOP, (GAME_HEIGHT - h) / 2));
    const bottom = top + h;
    this.btnY = bottom - 14 - BTN_H;
    const draw = (t, b) => {
      this.sheetBg.clear();
      drawWindow(this.sheetBg, 4, t, GAME_WIDTH - 8, b - t);
      this.banner.setY(t + this.bannerDy);
    };
    if (this.sheetTween) this.sheetTween.stop();
    if (this.top === null) draw(top, bottom);
    else {
      const from = { t: this.top, b: this.bottom };
      this.sheetTween = this.tweens.add({ targets: from, t: top, b: bottom, duration: 160, ease: 'Quad.easeOut', onUpdate: () => draw(Math.round(from.t), Math.round(from.b)) });
    }
    this.top = top;
    this.bottom = bottom;
    return top;
  }

  // How tall a text would be (nothing is drawn).
  measure(str, size, wrap = 0) {
    const style = { fontFamily: FONT, fontSize: `${px(size)}px`, lineSpacing: px(size) / 2 };
    if (wrap) style.wordWrap = { width: wrap, useAdvancedWrap: true };
    const t = this.add.text(0, 0, str, style);
    const h = t.height;
    t.destroy();
    return h;
  }

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
    const style = { fontFamily: FONT, fontSize: `${px(size)}px`, color, lineSpacing: px(size) / 2 };
    if (wrap) style.wordWrap = { width: wrap, useAdvancedWrap: true };
    return this.track(this.add.text(x, y, str, style));
  }

  // Text that must fit a box: wraps to `w` and shrinks a size at a time until it is at most `maxH` tall.
  fitText(x, y, str, size, color, w, maxH, bold = false) {
    const t = this.text(x, y, str, size, color, bold, w);
    if (t.height > maxH) t.setFontSize(8).setLineSpacing(4); // too tall: drop to the small size (sizes stay on the pixel grid)
    return t;
  }

  rarityColor(item) {
    return Number(rarities[item.rarity].color);
  }

  // How tall a card must be for its description (the card grows instead of the text spilling out).
  cardHeight(item) {
    const probe = this.add.text(0, 0, item.description, { fontFamily: FONT, fontSize: `${DESC_PX}px`, lineSpacing: 4, wordWrap: { width: CARD_W - TEXT_X - 16, useAdvancedWrap: true } });
    let h = probe.height;
    probe.destroy();
    const name = this.add.text(0, 0, item.name, { fontFamily: FONT, fontSize: '16px', lineSpacing: 6, wordWrap: { width: CARD_W - TEXT_X - 12, useAdvancedWrap: true } });
    h += name.height;
    name.destroy();
    if (item.perStack) h += this.perStackHeight(item) + 8;
    return Math.max(136, 32 + h + 10 + 18);
  }

  // The small "Per stack: ..." line under an item's text (items.json `perStack`: what one more copy adds).
  perStackStyle() {
    return { fontFamily: FONT, fontSize: '8px', color: UI.gold, lineSpacing: 4, wordWrap: { width: CARD_W - TEXT_X - 16, useAdvancedWrap: true } };
  }

  perStackHeight(item) {
    const probe = this.add.text(0, 0, `Per stack: ${item.perStack}`, this.perStackStyle());
    const h = probe.height;
    probe.destroy();
    return h;
  }

  // One reward card: icon in its rarity frame + type, rarity, name, description.
  drawCard(item, x, y, h, highlighted = false) {
    const rc = this.rarityColor(item);
    const card = this.add.container(x, y);
    this.track(card);
    const g = this.add.graphics();
    const paint = (lit) => {
      g.clear();
      drawWindow(g, 0, 0, CARD_W, h, { line: lit ? COLORS.gold : UI.line }); // the chosen card gets a gold line
    };
    paint(highlighted);
    card.add(g);
    card.add(this.add.image(ICON_W / 2, h / 2 - 9, itemIconKey(this, item.id, item.rarity)).setScale(4));
    card.add(this.add.text(ICON_W / 2, h / 2 + 42, itemTypes[item.type].label.toUpperCase(), { fontFamily: FONT, fontSize: '8px', color: MUTE }).setOrigin(0.5));
    card.add(this.add.text(TEXT_X, 16, `${rarities[item.rarity].label} ${item.kind === 'potion' ? 'POTION' : item.kind === 'book' ? 'BOOK' : 'ITEM'}`.toUpperCase(), { fontFamily: FONT, fontSize: '8px', color: hex(rc) }));
    // The name: 16px, or two 16px lines when it is long (never an in-between size: they blur).
    const name = this.add.text(TEXT_X, 32, item.name, { fontFamily: FONT, fontSize: '16px', color: INK, lineSpacing: 6, wordWrap: { width: CARD_W - TEXT_X - 12, useAdvancedWrap: true } });
    card.add(name);
    const desc = this.add.text(TEXT_X, 32 + name.height + 10, item.description, { fontFamily: FONT, fontSize: `${DESC_PX}px`, color: MUTE, lineSpacing: 4, wordWrap: { width: CARD_W - TEXT_X - 16, useAdvancedWrap: true } });
    card.add(desc);
    if (item.perStack) card.add(this.add.text(TEXT_X, desc.y + desc.height + 8, `Per stack: ${item.perStack}`, this.perStackStyle()));
    card.paint = paint;
    return card;
  }

  // ---- step 1: pick a reward ---------------------------------------------------------

  showPick(first = false) {
    this.step = 'pick';
    this.clearStep();
    // The sheet fits the title and the cards (screen review: smaller, the dungeon shows above it).
    const heights = this.payload.choices.map((item) => this.cardHeight(item));
    const total = TITLE_H + heights.reduce((a, b) => a + b, 0) + 14 * (heights.length - 1);
    const top = this.fitSheet(total + 16) + HEAD - 8;
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

  // A small "Back" pill at the top right of the sheet (call it after fitSheet).
  backButton(onTap) {
    const bw = BACK_W;
    const bx = GAME_WIDTH - PAD - bw;
    const bb = this.track(this.add.graphics());
    const by = this.top + 10; // in the top row, beside FLOOR N CLEARED
    drawWindow(bb, bx, by, bw, 28);
    this.text(bx + bw / 2, by + 14, 'Back', 8, INK).setOrigin(0.5);
    this.track(this.add.zone(bx + bw / 2, by + 14, bw + 10, 40).setInteractive()).on('pointerdown', () => { sfx.play('tap'); onTap(); });
  }

  // Page card sizes: normal, or COMPACT when a book shows more than 3 pages (the Skill Dealer's 5) so all fit.
  pageLook() {
    return this.compactPages
      ? { iconW: 84, textX: 88, desc: 8, name: 16, label: 8, nameY: 24, descY: 48, minH: 84, iconScale: 3, gap: 10 }
      : { iconW: 104, textX: 108, desc: DESC_PX, name: 16, label: 8, nameY: 32, descY: 60, minH: 112, iconScale: 4, gap: 14 }; // big icons (user): each page gets its own icon later
  }

  pageHeight(page) {
    const L = this.pageLook();
    const probe = this.add.text(0, 0, page.text, { fontFamily: FONT, fontSize: `${L.desc}px`, lineSpacing: 4, wordWrap: { width: CARD_W - L.textX - 16, useAdvancedWrap: true } });
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
      drawWindow(g, 0, 0, CARD_W, h, { line: on ? COLORS.gold : UI.line });
    };
    paint(lit);
    card.add(g);
    card.add(this.add.image(L.iconW / 2, h / 2 - (this.compactPages ? 0 : 8), bookPageIconKey(this, page, golden)).setScale(L.iconScale)); // the book's colour = the page type
    card.add(this.add.text(L.textX, this.compactPages ? 9 : 14, page.kind === 'stat' ? 'STAT PAGE' : `MODIFIER - ${(page.tag || '').toUpperCase()}`, { fontFamily: FONT, fontSize: `${L.label}px`, color: hex(rc) }));
    card.add(this.add.text(L.textX, L.nameY, page.name, { fontFamily: FONT, fontSize: `${L.name}px`, color: INK }));
    card.add(this.add.text(L.textX, L.descY, page.text, { fontFamily: FONT, fontSize: `${L.desc}px`, color: MUTE, lineSpacing: 4, wordWrap: { width: CARD_W - L.textX - 16, useAdvancedWrap: true } }));
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
    const top = this.fitSheet(total + 16) + HEAD - 8;
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
    const heroes = this.payload.state.heroes;
    const sumText = `${page.name}: ${page.text}`;
    const rowH = 132; // one hero row (its two skill buttons)
    const T = this.fitSheet(42 + this.measure(sumText, 13, CARD_W) + 12 + rowH * heroes.length + 4 + BTN_H + 14) + HEAD - 6;
    this.backButton(() => this.showPages());
    this.text(PAD, T, 'Which skill?', 26, INK, true);
    const sum = this.text(PAD, T + 32, sumText, 13, MUTE, false, CARD_W);
    const limits = this.payload.state.rules.books || {};
    const skillDefs = this.payload.state.skillDefs;
    let y = T + 42 + sum.height;
    const bh = rowH - 10 - 40; // a skill button's height
    this.skillButtons = [];
    for (const hero of heroes) {
      const g = this.track(this.add.graphics());
      drawWindow(g, PAD, y, CARD_W, rowH - 10);
      const ch = new Character(this, PAD + 36, y + rowH - 26, hero.def);
      ch.setScale(2.5).setAlpha(hero.alive ? 1 : 0.35);
      this.track(ch);
      this.text(PAD + 76, y + 10, hero.name, 17, INK, true).setAlpha(hero.alive ? 1 : 0.5);
      const bw = (CARD_W - 76 - 16) / 2;
      hero.skills.forEach((slot, idx) => {
        const bx = PAD + 76 + idx * (bw + 6);
        const by = y + 34;
        const fit = pageFit(hero, idx, page, limits);
        const usable = fit === 'ok' || fit === 'replace';
        const pages = slot.pages || [];
        const stats = pages.filter((p) => p.kind === 'stat').length;
        const mods = pages.filter((p) => p.kind === 'modifier').length;
        const col = SKILL_COLORS[slot.kind] || SKILL_COLORS.attack;
        const bg = this.track(this.add.graphics());
        const btn = { bg, bx, by, bw, bh, hero, idx, fit, col };
        btn.paint = (on) => {
          bg.clear();
          drawWindow(bg, bx, by, bw, bh, { line: on ? COLORS.gold : usable ? col.ready : COLORS.dim });
        };
        btn.paint(false);
        this.fitText(bx + 8, by + 6, skillDefs[slot.id].name, 13, usable ? INK : MUTE, bw - 16, 34, true);
        const note = fit === 'dead' ? 'Fallen' : fit === 'full' ? 'Stat pages full' : fit === 'duplicate' ? 'Already has it' : fit === 'replace' ? 'Full: replaces one' : `${stats}/${limits.maxStatPages ?? 3} stats\n${mods}/${limits.modifierSlots ?? 2} mods`;
        this.text(bx + 8, by + bh - 30, note, 11, fit === 'replace' ? '#ffd9a0' : MUTE);
        if (usable) this.track(this.add.zone(bx + bw / 2, by + bh / 2, bw, bh).setInteractive()).on('pointerdown', () => this.selectSkill(btn));
        this.skillButtons.push(btn);
      });
      y += rowH;
    }
    this.buttonGraphics = this.track(this.add.graphics());
    this.buttonText = this.text(GAME_WIDTH / 2, this.btnY + BTN_H / 2, 'Pick a skill', 18, '#ffffff', true).setOrigin(0.5);
    this.drawBookButton();
    this.track(this.add.zone(GAME_WIDTH / 2, this.btnY + BTN_H / 2, CARD_W, BTN_H).setInteractive()).on('pointerdown', () => this.confirmPage());
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
    const y = this.btnY;
    drawWindow(g, PAD, y, CARD_W, BTN_H, { line: t ? UI.line : COLORS.dim });
    const name = t && this.payload.state.skillDefs[t.hero.skills[t.idx].id].name;
    this.buttonText.setText(t ? (t.fit === 'replace' ? 'Choose what it replaces' : `Write it into ${name}`) : 'Pick a skill').setColor(t ? UI.text : UI.dim);
    this.buttonText.setFontSize(this.buttonText.setFontSize(16).width > CARD_W - 48 ? 8 : 16); // long labels drop to the small size
    if (t) drawCursor(g, Math.round(GAME_WIDTH / 2 - this.buttonText.width / 2 - 18), y + BTN_H / 2); // the ▶ cursor: ready to confirm
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
    const skill = this.payload.state.skillDefs[t.hero.skills[t.idx].id];
    const subText = `${skill.name} can hold 2 modifiers. ${this.pickedPage.name} takes the place of the one you tap.`;
    const mods = (t.hero.skills[t.idx].pages || []).filter((p) => p.kind === 'modifier');
    const cardsH = mods.reduce((a, p) => a + this.pageHeight(p) + 14, 0);
    const T = this.fitSheet(42 + this.measure(subText, 13, CARD_W) + 12 + cardsH + 2) + HEAD - 6;
    this.backButton(() => this.showSkillPick(this.pickedPage));
    this.text(PAD, T, 'Replace which page?', 26, INK, true);
    const sub = this.text(PAD, T + 32, subText, 13, MUTE, false, CARD_W);
    let y = T + 44 + sub.height;
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

  // The line on a hero's row: what a STAT item changes for this hero, with real numbers ("DEF 12 → 24", up to
  // two stats). Other items show nothing there (user: no copies line).
  changeLine(hero, item) {
    const stats = [...new Set(item.effects.filter((e) => e.stat).map((e) => e.stat))].slice(0, 2);
    if (!stats.length) return '';
    const after = this.payload.state.previewStats(hero.uid, item.id);
    return stats.map((st) => `${STAT_LABEL[st]} ${Math.round(hero.stats[st])}>${Math.round(after.stats[st])}`).join('  ');
  }

  // "Who gets it?": the item card on top, then ONE ROW PER HERO (user's choice): picture, name + level, the items
  // the hero already has, and one clear line of what changes. Tap a row, then Give.
  showAssign() {
    this.step = 'assign';
    this.clearStep();
    this.selected = null;
    const item = this.chosen;
    const heroes = this.payload.state.heroes;
    const itemH = this.cardHeight(item);
    // Each hero row is as tall as its item icons need (1 to ROW_ITEM_LINES lines; then they shrink to fit).
    const rowGap = 8;
    const iconW = CARD_W - 74 - 10;
    const perLine = Math.max(1, Math.floor((iconW + 3) / (FRAMED_SIZE + 3)));
    const lines = Math.max(1, ...heroes.map((h) => Math.min(ROW_ITEM_LINES, Math.ceil(new Set(h.items).size / perLine))));
    const rowH = Math.max(96, 58 + lines * (FRAMED_SIZE + 3));
    const T = this.fitSheet(44 + itemH + 14 + (rowH + rowGap) * heroes.length + 4 + BTN_H + 14) + HEAD - 6;
    this.text(PAD, T, 'Who gets it?', 26, INK, true);
    this.backButton(() => this.showPick()); // back to the 3 rewards (changed your mind)
    this.drawCard(item, PAD, T + 44, itemH, true);

    this.heroGraphics = [];
    let y = T + 44 + itemH + 14;
    for (const [i, hero] of heroes.entries()) {
      const ok = canReceive(hero, item);
      const g = this.track(this.add.graphics());
      this.heroGraphics.push({ g, x: PAD, y, w: CARD_W, h: rowH, hero });
      this.drawHeroCard(i, false);
      const alpha = ok ? 1 : 0.45;

      // A small copy of the hero (same parts as in battle).
      const ch = new Character(this, PAD + 36, y + Math.min(rowH - 16, 84), hero.def);
      ch.setScale(2.5).setAlpha(alpha);
      this.track(ch);

      const name = this.text(PAD + 74, y + 12, hero.name, 17, INK, true).setAlpha(alpha);
      this.text(PAD + 74 + name.width + 8, y + 16, `Lv ${hero.level}`, 13, MUTE).setAlpha(alpha);
      const line = ok ? this.changeLine(hero, item) : hero.alive ? 'Can\'t take more' : 'Fallen';
      if (line) this.text(PAD + 74, y + 34, line, 8, ok ? '#6dff8f' : MUTE).setAlpha(alpha);

      // Items this hero already has: every icon shown, up to 3 lines, smaller when they do not fit.
      const top = y + 50;
      this.drawIconGrid(hero, PAD + 74, top, CARD_W - 74 - 10, y + rowH - 8 - top, alpha);

      if (ok) this.track(this.add.zone(PAD + CARD_W / 2, y + rowH / 2, CARD_W, rowH).setInteractive()).on('pointerdown', () => this.selectHero(i));
      y += rowH + rowGap;
    }

    // The Give button at the bottom.
    this.buttonGraphics = this.track(this.add.graphics());
    this.buttonText = this.text(GAME_WIDTH / 2, this.btnY + BTN_H / 2, 'Pick a hero', 18, '#ffffff', true).setOrigin(0.5);
    this.drawButton();
    this.track(this.add.zone(GAME_WIDTH / 2, this.btnY + BTN_H / 2, CARD_W, BTN_H).setInteractive()).on('pointerdown', () => this.confirm());
  }

  // All the hero's items (framed icons, a white number = copies) in a box from (x, top), w wide and h tall: up to
  // 3 lines at full size; when even 3 lines are too few the icons shrink until every one fits (user: no "+N").
  drawIconGrid(hero, x, top, w, h, alpha) {
    const counts = new Map();
    for (const id of hero.items) counts.set(id, (counts.get(id) || 0) + 1);
    const kinds = [...counts.entries()];
    if (!kinds.length) return this.text(x, top + 4, 'No items yet', 12, MUTE).setAlpha(alpha);
    const perLine = (sc) => Math.floor((w + 3 * sc) / ((FRAMED_SIZE + 3) * sc));
    const lines = Math.max(1, Math.min(ROW_ITEM_LINES, Math.ceil(kinds.length / perLine(1)))); // only as many lines as it needs
    let scale = Math.min(1, h / lines / (FRAMED_SIZE + 3));
    while (perLine(scale) * lines < kinds.length) scale *= 0.9;
    const step = (FRAMED_SIZE + 3) * scale;
    const n = perLine(scale);
    const style = { fontFamily: FONT, fontSize: '8px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 };
    kinds.forEach(([id, count], i) => {
      const def = this.payload.state.itemDefs[id];
      const ix = Math.round(x + (i % n) * step);
      const iy = Math.round(top + Math.floor(i / n) * step);
      this.track(this.add.image(ix, iy, itemIconKey(this, id, def.rarity)).setOrigin(0).setScale(scale).setAlpha(alpha));
      if (count > 1) this.track(this.add.text(ix + FRAMED_SIZE * scale + 1, iy + FRAMED_SIZE * scale + 1, String(count), style).setOrigin(1, 1).setAlpha(alpha));
    });
  }

  drawHeroCard(i, selected) {
    const { g, x, y, w, h, hero } = this.heroGraphics[i];
    g.clear();
    drawWindow(g, x, y, w, h, { line: selected ? COLORS.gold : hero.alive ? UI.line : COLORS.dim });
  }

  drawButton() {
    const g = this.buttonGraphics;
    g.clear();
    const y = this.btnY;
    drawWindow(g, PAD, y, CARD_W, BTN_H, { line: this.selected ? UI.line : COLORS.dim });
    this.buttonText.setText(this.selected ? `Give to ${this.selected.name}` : 'Pick a hero').setColor(this.selected ? UI.text : UI.dim);
    if (this.selected) drawCursor(g, Math.round(GAME_WIDTH / 2 - this.buttonText.width / 2 - 18), y + BTN_H / 2); // the ▶ cursor: ready to confirm
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
