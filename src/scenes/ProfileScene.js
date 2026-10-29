import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config.js';
import { drawWindow, uiText, comingSoonWindow } from '../entities/uiKit.js';
import Character from '../entities/Character.js';
import { floorCrop } from '../entities/floorTexture.js';
import { bareIconKey } from '../entities/itemIconTexture.js';
import { layerTexture } from '../entities/pixelLayer.js';
import D from '../data/profile.json';
import title from '../data/title.json';
import heroes from '../data/heroes.json';
import items from '../data/items.json';
import unlocks from '../data/unlocks.json';
import dungeons from '../data/dungeons.json';
import { loadProgress, saveProgress, isUnlocked, topHero } from '../systems/progress.js';
import { openBanners } from '../systems/achievements.js';
import { bannerLayer } from '../systems/banners.js';
import * as sfx from '../audio/sfx.js';

// The Profile (docs/systems/title-base.md section 5, user's pick D), opened from the camp's profile box (the camp waits,
// paused). Top card: the banner with the profile hero standing on the name strip (tap the name = rename; EDIT = banner
// page, CHANGE = profile hero page). Tabs STATS (lifetime numbers) / ACHIEVE. (medals, profile.json achievements).
// Data: profile.json; saved in progress.profile / progress.achievements / progress.stats.
const L = D.layout;
const GOLD = Phaser.Display.Color.HexStringToColor(UI.gold).color;
const DIM = Number(L.dim);
const SHADOW = 0x1c1c26; // locked heroes / medals: a dark shadow
const W = GAME_WIDTH - L.side * 2;
const heroDef = (id) => heroes.find((h) => h.id === id);
const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const hours = (ms) => { const m = Math.floor(ms / 60000); return `${Math.floor(m / 60)}H ${m % 60}M`; };
let lastTab = 'stats';

export default class ProfileScene extends Phaser.Scene {
  constructor() {
    super('Profile');
  }

  init(data) {
    this.from = (data && data.from) || 'Base';
    this.modal = null;
  }

  create() {
    this.scene.bringToTop();
    this.progress = loadProgress();
    this.profile = { ...D.defaults, ...this.progress.profile };
    if (!this.isOpen(this.profile.hero)) this.profile.hero = D.defaults.hero;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Number(L.bg)).setOrigin(0).setInteractive();
    this.page = null;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.closeInput());
    this.showMain();
    this.cameras.main.fadeIn(120, 0, 0, 0);
  }

  isOpen(heroId) {
    return isUnlocked(heroId, this.progress, unlocks);
  }

  save() {
    this.progress.profile = { ...this.profile };
    saveProgress(this.progress);
  }

  // ---- drawing helpers -------------------------------------------------------------------------

  newPage() {
    if (this.page) this.page.destroy();
    this.page = this.add.container(0, 0);
    return this.page;
  }

  // A window button. look: 'plain', 'gold' (gold line + text), 'filled' (gold, black text), 'dim'. Returns the zone.
  button(page, x, y, w, h, label, onTap, look = 'plain', size = 'normal') {
    const line = { plain: UI.line, gold: GOLD, filled: GOLD, dim: DIM }[look];
    page.add(drawWindow(this.add.graphics(), x, y, w, h, { line, fill: look === 'filled' ? GOLD : UI.window }));
    page.add(uiText(this, x + w / 2, y + h / 2, label, size, { plain: UI.text, gold: UI.gold, filled: '#000000', dim: UI.dim }[look]).setOrigin(0.5));
    const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', () => { if (!this.modal) onTap(); });
    page.add(z);
    return z;
  }

  text(page, x, y, str, size = 'normal', color = UI.text, extra = {}) {
    const t = uiText(this, x, y, str, size, color, extra);
    page.add(t);
    return t;
  }

  top(page, back, name, onBack) {
    const B = L.back;
    this.button(page, B.x, B.y, B.w, B.h, back, () => { sfx.play('tap'); onBack(); });
    this.text(page, GAME_WIDTH / 2, L.titleY, name, 'big').setOrigin(0.5, 0);
  }

  // A hero standing at (x, feet); `shadow` = a dark shape (locked).
  hero(page, id, x, feet, scale, shadow = false) {
    const ch = new Character(this, x, feet, heroDef(id)).setScale(scale);
    if (shadow) for (const p of Object.values(ch.parts)) p.image.setTint(SHADOW).setTintMode(Phaser.TintModes.FILL);
    page.add(ch);
    return ch;
  }

  // A banner's picture (title forest crop, profile.json banners) as an image of w x h screen px.
  banner(page, id, x, y, w, h) {
    const b = D.banners.find((v) => v.id === id) || D.banners[0], P = title.pixel, C = L.card;
    const lay = bannerLayer(title, b, { w: C.artW, h: C.artH, width: Math.ceil(GAME_WIDTH / P), height: Math.ceil(GAME_HEIGHT / P) });
    const img = this.add.image(x + w / 2, y + h / 2, layerTexture(this, `banner-${b.id}`, lay)).setScale(Math.min(w / lay.w, h / lay.h));
    page.add(img);
    return img;
  }

  // ---- main page -------------------------------------------------------------------------------

  showMain() {
    const page = this.newPage(), x = L.side, C = L.card, y = C.y, hero = heroDef(this.profile.hero);
    this.top(page, '< CAMP', 'PROFILE', () => this.close());
    // The card: banner on top, black name strip under it, the profile hero standing on the strip (head over the art).
    page.add(drawWindow(this.add.graphics(), x, y, W, C.h));
    this.banner(page, this.profile.banner, x + 2, y + 2, W - 4, C.bannerH);
    this.hero(page, hero.id, x + C.heroX, y + C.h - 18, C.heroScale);
    const E = C.edit;
    this.button(page, x + W - E.w - 10, y + 10, E.w, E.h, 'EDIT', () => { sfx.play('tap'); this.showBanners(); }, 'plain', 'small');
    const Ch = C.change;
    this.button(page, x + C.heroX - Ch.w / 2, y + C.h - Ch.h / 2, Ch.w, Ch.h, 'CHANGE', () => { sfx.play('tap'); this.showHeroPicker(); }, 'plain', 'small');
    const name = this.text(page, x + C.nameX, y + C.bannerH + 14, this.profile.name.toUpperCase(), 'normal');
    this.text(page, x + C.nameX, y + C.bannerH + 38, `${hero.name} main`, 'small', UI.gold);
    page.add(this.add.zone(x + C.nameX - 6, y + C.bannerH + 4, W - C.nameX, C.h - C.bannerH - 8).setOrigin(0)
      .setInteractive({ useHandCursor: true }).on('pointerup', () => { if (!this.modal) this.rename(name); }));
    // Tabs.
    const T = L.tabs, tw = (W - T.gap) / 2;
    [['stats', 'STATS'], ['achieve', 'ACHIEVE.']].forEach(([id, label], i) => {
      this.button(page, x + i * (tw + T.gap), T.y, tw, T.h, label, () => { if (id !== lastTab) { sfx.play('tap'); lastTab = id; this.showMain(); } }, id === lastTab ? 'gold' : 'dim');
    });
    if (lastTab === 'stats') this.drawStats(page);
    else this.drawMedals(page);
  }

  // Lifetime numbers in 2 columns of boxes.
  drawStats(page) {
    const s = this.progress.stats, S = L.stats, x = L.side, w = (W - S.gap) / 2, top = topHero(this.progress);
    const boxes = [
      ['RUNS', num(s.runs)], ['BEST FLOOR', num(s.bestFloor)],
      ['BOSSES', num(s.bossesBeaten || 0)], ['KILLS', num(s.totalKills)],
      ['PLAY TIME', hours(s.playMs || 0)], ['ITEMS FOUND', num(s.itemsFound || 0)],
      ['TOP HERO', top ? heroDef(top).name.toUpperCase() : '-'], ['DEATHS', num(s.deaths || 0)],
    ];
    boxes.forEach(([label, v], i) => {
      const bx = x + (i % 2) * (w + S.gap), by = S.y + Math.floor(i / 2) * (S.h + S.gap);
      page.add(drawWindow(this.add.graphics(), bx, by, w, S.h));
      this.text(page, bx + L.pad, by + 14, label, 'small', UI.dim);
      this.text(page, bx + L.pad, by + 30, v, 'normal');
    });
  }

  // 'N / M EARNED' with a gold bar, then the medal grid (earned = gold line + icon, else a dark shadow + '???').
  drawMedals(page) {
    const M = L.medals, x = L.side, list = D.achievements, got = this.progress.achievements || [];
    const n = list.filter((a) => got.includes(a.id)).length;
    const label = this.text(page, x, M.y, `${n} / ${list.length} EARNED`, 'small');
    const bx = x + label.width + 12, bw = W - label.width - 12;
    page.add(this.add.graphics().fillStyle(0x26262f, 1).fillRect(bx, M.y - 1, bw, M.barH).fillStyle(GOLD, 1).fillRect(bx, M.y - 1, Math.round((bw * n) / list.length), M.barH));
    const gap = (W - M.cols * M.cell) / (M.cols - 1);
    list.forEach((a, i) => {
      const cx = x + (i % M.cols) * (M.cell + gap), cy = M.gridY + Math.floor(i / M.cols) * (M.h + M.gap), on = got.includes(a.id);
      page.add(drawWindow(this.add.graphics(), cx, cy, M.cell, M.h, { line: on ? GOLD : UI.line }));
      if (items[a.icon]) {
        const icon = this.add.image(cx + M.cell / 2, cy + M.iconY, bareIconKey(this, a.icon)).setScale(M.iconScale);
        if (!on) icon.setTint(SHADOW).setTintMode(Phaser.TintModes.FILL);
        page.add(icon);
      }
      this.text(page, cx + M.cell / 2, cy + M.h - 12, on ? a.label : '???', 'small', on ? UI.text : UI.dim).setOrigin(0.5);
      page.add(this.add.zone(cx, cy, M.cell, M.h).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', () => this.medalInfo(a, on)));
    });
  }

  // A medal tapped: its name, what it asks, earned or not. Tap to close.
  medalInfo(a, on) {
    if (this.modal) return;
    this.modal = comingSoonWindow(this, on ? a.label : '???', a.text, { onClose: () => this.time.delayedCall(0, () => { this.modal = null; }) });
    const soon = this.modal.list.find((o) => o.text === 'Coming soon');
    if (soon) soon.setText(on ? 'EARNED' : 'NOT YET').setColor(on ? UI.gold : UI.dim);
  }

  // ---- rename ------------------------------------------------------------------------------------

  // Tap the name: a window shows the name being typed; a see-through text box over it opens the phone keyboard.
  // Enter / OK saves (letters, numbers and spaces, at most D.nameMax), CANCEL or tapping outside keeps the old one.
  rename(nameText) {
    sfx.play('cardOpen');
    const w = W, h = 168, x = L.side, y = 260;
    const box = (this.modal = this.add.container(0, 0).setDepth(100));
    box.add(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setOrigin(0).setInteractive());
    box.add(drawWindow(this.add.graphics(), x, y, w, h));
    box.add(uiText(this, GAME_WIDTH / 2, y + 16, 'YOUR NAME', 'normal', UI.gold).setOrigin(0.5, 0));
    box.add(drawWindow(this.add.graphics(), x + L.pad, y + 48, w - L.pad * 2, 44, { line: GOLD }));
    const shown = uiText(this, GAME_WIDTH / 2, y + 70, '', 'normal').setOrigin(0.5);
    box.add(shown);
    let value = this.profile.name;
    const clean = (s) => s.replace(/[^A-Za-z0-9 ]/g, '').slice(0, D.nameMax);
    const draw = () => shown.setText(`${value.toUpperCase()}_`);
    draw();
    const done = (keep) => {
      if (!this.modal) return;
      const v = clean(value).trim();
      this.closeInput();
      box.destroy();
      this.time.delayedCall(0, () => { this.modal = null; });
      if (keep && v) { this.profile.name = v; this.save(); nameText.setText(v.toUpperCase()); sfx.play('tap'); }
      else sfx.play('cardClose');
    };
    const bw = (w - L.pad * 2 - 12) / 2, by = y + h - L.pad - 44;
    [[0, 'CANCEL', false], [1, 'OK', true]].forEach(([i, label, keep]) => {
      const bx = x + L.pad + i * (bw + 12);
      box.add(drawWindow(this.add.graphics(), bx, by, bw, 44, keep ? { line: GOLD, fill: GOLD } : {}));
      box.add(uiText(this, bx + bw / 2, by + 22, label, 'normal', keep ? '#000000' : UI.text).setOrigin(0.5));
      box.add(this.add.zone(bx, by, bw, 44).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', () => done(keep)));
    });
    // The real text box (see-through), laid over the name field on the page so a tap on it opens the keyboard.
    const canvas = this.game.canvas, r = canvas.getBoundingClientRect(), k = r.width / GAME_WIDTH;
    const input = document.createElement('input');
    Object.assign(input, { type: 'text', value, maxLength: D.nameMax, autocomplete: 'off', spellcheck: false });
    Object.assign(input.style, {
      position: 'fixed', left: `${r.left + (x + L.pad) * k}px`, top: `${r.top + (y + 48) * k}px`, width: `${(w - L.pad * 2) * k}px`,
      height: `${44 * k}px`, opacity: '0.01', fontSize: '16px', border: '0', zIndex: 10,
    });
    input.addEventListener('input', () => { value = clean(input.value); input.value = value; draw(); });
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); });
    document.body.appendChild(input);
    this.nameInput = input;
    input.focus();
    input.select(); // typing replaces the old name
  }

  closeInput() {
    if (this.nameInput) { this.nameInput.remove(); this.nameInput = null; }
  }

  // ---- profile hero page -------------------------------------------------------------------------

  showHeroPicker(chosen = this.profile.hero) {
    const page = this.newPage(), x = L.side, P = L.pick;
    this.top(page, '< BACK', 'PROFILE HERO', () => this.showMain());
    page.add(drawWindow(this.add.graphics(), x, P.y, W, P.h, { line: GOLD }));
    page.add(floorCrop(this, dungeons.A.tileColors[0], 200, x + 2, P.y + 2, W - 4, P.h - 4));
    this.text(page, GAME_WIDTH / 2, P.y + 12, heroDef(chosen).name.toUpperCase(), 'normal').setOrigin(0.5, 0);
    this.hero(page, chosen, GAME_WIDTH / 2, P.y + P.h - 16, P.scale);
    const gap = (W - P.cols * P.cell) / (P.cols - 1), ch = P.cell + 12;
    heroes.forEach((h, i) => {
      const cx = x + (i % P.cols) * (P.cell + gap), cy = P.gridY + Math.floor(i / P.cols) * (ch + P.gap), open = this.isOpen(h.id);
      page.add(drawWindow(this.add.graphics(), cx, cy, P.cell, ch, { line: h.id === chosen ? GOLD : open ? UI.line : DIM }));
      this.hero(page, h.id, cx + P.cell / 2, cy + ch - 24, 2, !open);
      this.text(page, cx + P.cell / 2, cy + ch - 12, open ? D.shortNames[h.id] || h.name.toUpperCase() : '???', 'small', h.id === chosen ? UI.gold : open ? UI.text : UI.dim).setOrigin(0.5);
      if (open) page.add(this.add.zone(cx, cy, P.cell, ch).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', () => { if (h.id !== chosen) { sfx.play('tap'); this.showHeroPicker(h.id); } }));
    });
    const rows = Math.ceil(heroes.length / P.cols), hy = P.gridY + rows * (ch + P.gap);
    this.text(page, GAME_WIDTH / 2, hy + 4, 'Only heroes you have unlocked.', 'small', UI.dim).setOrigin(0.5, 0);
    this.button(page, x, hy + 28, W, 48, 'SET AS PROFILE', () => { this.profile.hero = chosen; this.save(); sfx.play('tap'); this.showMain(); }, 'filled');
  }

  // ---- banner page -------------------------------------------------------------------------------

  showBanners(chosen = this.profile.banner) {
    const page = this.newPage(), x = L.side, B = L.banner, C = L.card, open = openBanners(this.progress, D.banners);
    this.top(page, '< BACK', 'BANNER', () => this.showMain());
    page.add(drawWindow(this.add.graphics(), x, B.y, W, C.bannerH + 4, { line: GOLD }));
    this.banner(page, chosen, x + 2, B.y + 2, W - 4, C.bannerH);
    const tileGap = (W - 3 * B.tileW) / 2;
    let y = B.y + C.bannerH + 20;
    // YOUR ART (from the Studio): later. One '+' tile for now.
    this.text(page, x, y, 'YOUR ART', 'normal', UI.gold);
    this.text(page, x, y + 26, 'Drawn in the Studio.', 'small', UI.dim);
    y += 44;
    this.button(page, x, y, B.tileW, B.tileH, '+', () => this.soon('Your art', 'Banners drawn in the Character Studio'), 'plain', 'big');
    y += B.tileH + 20;
    this.text(page, x, y, 'UNLOCKED', 'normal', UI.gold);
    this.text(page, x, y + 26, 'From bosses and achievements.', 'small', UI.dim);
    y += 44;
    D.banners.forEach((b, i) => {
      const tx = x + (i % 3) * (B.tileW + tileGap), ty = y + Math.floor(i / 3) * (B.tileH + 12), on = open.includes(b.id);
      page.add(drawWindow(this.add.graphics(), tx, ty, B.tileW, B.tileH, { line: b.id === chosen ? GOLD : on ? UI.line : DIM }));
      if (on) this.banner(page, b.id, tx + 2, ty + 2, B.tileW - 4, B.tileH - 4);
      else this.text(page, tx + B.tileW / 2, ty + B.tileH / 2, 'LOCKED', 'small', UI.dim).setOrigin(0.5);
      page.add(this.add.zone(tx, ty, B.tileW, B.tileH).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', () => {
        if (this.modal) return;
        if (!on) { const a = D.achievements.find((v) => v.id === b.unlock); this.soon(b.name, `Unlock: ${a ? a.text : '???'}`, 'LOCKED'); return; }
        if (b.id !== chosen) { sfx.play('tap'); this.showBanners(b.id); }
      }));
    });
    y += Math.ceil(D.banners.length / 3) * (B.tileH + 12) + 12;
    this.button(page, x, y, W, 44, 'DRAW NEW IN STUDIO', () => this.soon('Draw a banner', 'Draw your own banner in the Character Studio'));
    this.button(page, x, y + 56, W, 48, 'SET AS BANNER', () => { this.profile.banner = chosen; this.save(); sfx.play('tap'); this.showMain(); }, 'filled');
  }

  // A small window (uiKit 'Coming soon'); `tag` replaces its gold line.
  soon(name, who, tag = null) {
    if (this.modal) return;
    this.modal = comingSoonWindow(this, name, who, { onClose: () => this.time.delayedCall(0, () => { this.modal = null; }) });
    const t = tag && this.modal.list.find((o) => o.text === 'Coming soon');
    if (t) t.setText(tag).setColor(UI.dim);
  }

  close() {
    this.closeInput();
    this.scene.resume(this.from);
    this.scene.stop();
  }
}
