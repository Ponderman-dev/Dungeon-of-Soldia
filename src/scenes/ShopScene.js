import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config.js';
import { drawWindow, uiText, comingSoonWindow } from '../entities/uiKit.js';
import Character from '../entities/Character.js';
import { floorCrop } from '../entities/floorTexture.js';
import { bareIconKey } from '../entities/itemIconTexture.js';
import S from '../data/shop.json';
import camp from '../data/camp.json';
import heroes from '../data/heroes.json';
import dungeons from '../data/dungeons.json';
import { loadProgress, saveProgress } from '../systems/progress.js';
import { lookDef, dailyDeals, localDay } from '../systems/looks.js';
import * as sfx from '../audio/sfx.js';

// The Shop (docs/systems/title-base.md section 5, user's pick A), opened over the camp (the camp waits, paused).
// Sells LOOKS only, paid in gems. Tabs DEALS (the camp merchant, a daily timer, 3 discounted looks) / LOOKS (every
// look) / GEMS (packs: Coming soon, payments later). Tap a look = try-on page with BUY. The gem balance + '+' sit top
// right on every page. Looks are stand-in recolours for now (systems/looks.js). Data: shop.json.
const L = S.layout;
const GOLD = Phaser.Display.Color.HexStringToColor(UI.gold).color;
const GEM = Number(L.gem), GEM_DARK = Number(L.gemDark), RED = Number(L.red), DIM = Number(L.dim);
const GEM_CSS = '#' + GEM.toString(16).padStart(6, '0');
const W = GAME_WIDTH - L.side * 2;
const heroDef = (id) => heroes.find((h) => h.id === id);
const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
let lastTab = 'deals';

// Time left until midnight (local), as '08:14:33'.
function dayLeft(now = new Date()) {
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  const t = Math.max(0, Math.floor((end - now) / 1000)), two = (n) => String(n).padStart(2, '0');
  return `${two(Math.floor(t / 3600))}:${two(Math.floor((t % 3600) / 60))}:${two(t % 60)}`;
}

export default class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  init(data) {
    this.from = (data && data.from) || 'Base';
    this.modal = null;
  }

  create() {
    this.scene.bringToTop();
    this.progress = loadProgress();
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Number(L.bg)).setOrigin(0).setInteractive();
    this.page = null;
    this.clock = null;
    this.showTab(lastTab);
    this.cameras.main.fadeIn(120, 0, 0, 0);
  }

  gems() { return this.progress.gems || 0; }
  owned(id) { return (this.progress.looks || []).includes(id); }

  // ---- helpers -----------------------------------------------------------------------------------

  newPage() {
    if (this.clock) { this.clock.remove(); this.clock = null; }
    if (this.page) this.page.destroy();
    this.page = this.add.container(0, 0);
    return this.page;
  }

  text(page, x, y, str, size = 'normal', color = UI.text, extra = {}) {
    const t = uiText(this, x, y, str, size, color, extra);
    page.add(t);
    return t;
  }

  button(page, x, y, w, h, label, onTap, line = UI.line, color = UI.text) {
    page.add(drawWindow(this.add.graphics(), x, y, w, h, { line }));
    if (label) page.add(uiText(this, x + w / 2, y + h / 2, label, 'normal', color).setOrigin(0.5));
    if (onTap) page.add(this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', () => { if (!this.modal) onTap(); }));
  }

  // A pixel gem (k = size of one pixel), centred on (x, y).
  gem(page, x, y, k = 2) {
    const g = this.add.graphics(), rows = ['..0000..', '.011110.', '01111110', '.011110.', '..0110..', '...00...'];
    rows.forEach((r, j) => [...r].forEach((c, i) => { if (c !== '.') g.fillStyle(c === '1' ? GEM : GEM_DARK, 1).fillRect(Math.round(x + (i - 4) * k), Math.round(y + (j - 3) * k), k, k); }));
    page.add(g);
    return g;
  }

  // '< CAMP' (or '< BACK') and the gem balance with '+' (opens GEMS).
  header(page, back, onBack) {
    const B = L.back, Bl = L.balance, x = GAME_WIDTH - L.side - Bl.w;
    this.button(page, B.x, B.y, B.w, B.h, back, onBack);
    page.add(drawWindow(this.add.graphics(), x, B.y, Bl.w, Bl.h));
    this.gem(page, x + 22, B.y + Bl.h / 2, 2);
    this.text(page, x + 40, B.y + Bl.h / 2, num(this.gems()), 'normal', GEM_CSS).setOrigin(0, 0.5);
    this.text(page, x + Bl.w - 16, B.y + Bl.h / 2, '+', 'normal', UI.gold).setOrigin(0.5);
    page.add(this.add.zone(x, B.y, Bl.w, Bl.h).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', () => { if (!this.modal) { sfx.play('tap'); this.showTab('gems'); } }));
  }

  // A look standing on a floor tile at (x, y, w, h); `scale` = sprite size.
  lookTile(page, look, x, y, w, h, scale) {
    page.add(floorCrop(this, dungeons.A.tileColors[0], 200, x, y, w, h));
    const ch = new Character(this, x + w / 2, y + h - 10, lookDef(heroDef(look.hero), look)).setScale(scale);
    page.add(ch);
    return ch;
  }

  // A price: gem + number (+ the old price struck out).
  price(page, cx, cy, value, old = null) {
    const t = this.text(page, 0, cy, num(value), 'normal', GEM_CSS).setOrigin(0, 0.5);
    const o = old ? this.text(page, 0, cy + 2, num(old), 'small', UI.dim).setOrigin(0, 0.5) : null;
    const w = 14 + t.width + (o ? 8 + o.width : 0), x0 = cx - w / 2;
    this.gem(page, x0 + 6, cy, 1.5);
    t.setX(x0 + 16);
    if (o) {
      o.setX(x0 + 16 + t.width + 8);
      page.add(this.add.graphics().fillStyle(0x8a8a9a, 1).fillRect(o.x - 1, cy + 1, o.width + 2, 1));
    }
  }

  // ---- tabs --------------------------------------------------------------------------------------

  showTab(tab) {
    lastTab = tab;
    const page = this.newPage(), x = L.side, T = L.tabs, tw = (W - T.gap * 2) / 3;
    this.header(page, this.from === 'Base' ? '< CAMP' : '< BACK', () => this.close());
    ['deals', 'looks', 'gems'].forEach((id, i) => {
      const on = id === tab;
      this.button(page, x + i * (tw + T.gap), T.y, tw, T.h, id.toUpperCase(), () => { if (!on) { sfx.play('tap'); this.showTab(id); } }, on ? GOLD : UI.line, on ? UI.gold : UI.text);
    });
    if (tab === 'deals') this.drawDeals(page);
    else if (tab === 'looks') this.drawLooks(page);
    else this.drawGems(page);
  }

  // DEALS: the merchant with a speech bubble, the daily timer, 3 deal rows.
  drawDeals(page) {
    const x = L.side, M = L.merchant, Ti = L.timer, R = L.dealRows;
    page.add(drawWindow(this.add.graphics(), x, M.y, W, M.h, { line: GOLD }));
    page.add(floorCrop(this, dungeons.A.tileColors[0], 200, x + 2, M.y + 2, W - 4, M.h - 4));
    const merchant = camp.npcs.find((n) => n.id === 'shop');
    if (merchant) page.add(new Character(this, x + 80, M.y + M.h - 24, merchant.def).setScale(4));
    const line = uiText(this, 0, 0, S.merchantLine, 'small', '#000000', { lineSpacing: 8 });
    const bw = line.width + 24, bh = line.height + 20, bx = x + 150, by = M.y + M.h / 2 - bh / 2 - 6;
    page.add(this.add.graphics().fillStyle(0xffffff, 1).fillRect(bx, by, bw, bh).fillRect(bx - 6, by + bh / 2 - 3, 6, 6));
    line.setPosition(bx + 12, by + 10);
    page.add(line);
    // Timer bar: new deals at midnight.
    page.add(drawWindow(this.add.graphics(), x, Ti.y, W, Ti.h, { line: GOLD }));
    const icon = this.add.image(0, Ti.y + Ti.h / 2, bareIconKey(this, 'hourglass')).setScale(2);
    page.add(icon);
    const label = this.text(page, 0, Ti.y + Ti.h / 2, 'NEW DEALS IN', 'normal').setOrigin(0, 0.5);
    const time = this.text(page, 0, Ti.y + Ti.h / 2, dayLeft(), 'normal', UI.gold).setOrigin(0, 0.5);
    const place = () => { const w = 42 + label.width + 12 + time.width, x0 = GAME_WIDTH / 2 - w / 2; icon.setX(x0 + 16); label.setX(x0 + 42); time.setX(x0 + 42 + label.width + 12); };
    place();
    this.clock = this.time.addEvent({ delay: 1000, loop: true, callback: () => { time.setText(dayLeft()); place(); } });
    // Deal rows: the look on a floor tile, name, hero, red -N% tag, price box.
    dailyDeals(S.looks, S.deals, localDay()).forEach((d, i) => {
      const y = R.y + i * (R.h + R.gap), lk = d.look;
      page.add(drawWindow(this.add.graphics(), x, y, W, R.h));
      this.lookTile(page, lk, x + 2, y + 2, R.tileW, R.h - 4, 4);
      page.add(this.add.graphics().fillStyle(UI.line, 1).fillRect(x + R.tileW + 2, y + 2, 2, R.h - 4));
      const tx = x + R.tileW + 18;
      this.text(page, tx, y + 18, lk.name.toUpperCase(), 'normal');
      this.text(page, tx, y + 46, `${heroDef(lk.hero).name.toUpperCase()} look`, 'small', UI.dim);
      const tag = this.text(page, x + W - 16, y + 18, `-${d.discount}%`, 'small', '#ffffff').setOrigin(1, 0);
      page.addAt(this.add.graphics().fillStyle(RED, 1).fillRect(tag.x - tag.width - 6, y + 14, tag.width + 12, tag.height + 8), page.list.indexOf(tag));
      const pw = W - R.tileW - 34, py = y + R.h - 58;
      const owned = this.owned(lk.id);
      this.button(page, tx, py, pw, 44, owned ? 'OWNED' : null, () => { sfx.play('tap'); this.showTryOn(lk, d.price); }, owned ? DIM : GOLD, UI.dim);
      if (!owned) this.price(page, tx + pw / 2, py + 22, d.price, lk.price);
    });
  }

  // LOOKS: every look in a 3-column grid (look on the floor, name, hero, price).
  drawLooks(page) {
    const x = L.side, G2 = L.grid, cw = (W - G2.gap * (G2.cols - 1)) / G2.cols;
    S.looks.forEach((lk, i) => {
      const cx = x + (i % G2.cols) * (cw + G2.gap), cy = G2.y + Math.floor(i / G2.cols) * (G2.h + G2.gap), owned = this.owned(lk.id);
      page.add(drawWindow(this.add.graphics(), cx, cy, cw, G2.h, { line: owned ? GOLD : UI.line }));
      this.lookTile(page, lk, cx + 2, cy + 2, cw - 4, G2.tileH, 3);
      page.add(this.add.graphics().fillStyle(UI.line, 1).fillRect(cx + 2, cy + G2.tileH + 2, cw - 4, 2));
      this.text(page, cx + cw / 2, cy + G2.tileH + 24, lk.name.toUpperCase(), 'normal').setOrigin(0.5);
      this.text(page, cx + cw / 2, cy + G2.tileH + 46, heroDef(lk.hero).name.toUpperCase().slice(0, 11), 'small', UI.dim).setOrigin(0.5);
      if (owned) this.text(page, cx + cw / 2, cy + G2.h - 20, 'OWNED', 'small', UI.gold).setOrigin(0.5);
      else this.price(page, cx + cw / 2, cy + G2.h - 20, lk.price);
      page.add(this.add.zone(cx, cy, cw, G2.h).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', () => { if (!this.modal) { sfx.play('tap'); this.showTryOn(lk, lk.price); } }));
    });
  }

  // GEMS: the packs (real money / SOL later: Coming soon).
  drawGems(page) {
    const x = L.side, P = L.packs;
    S.packs.forEach((pk, i) => {
      const y = P.y + i * (P.h + P.gap);
      this.button(page, x, y, W, P.h, null, () => this.soon(`${num(pk.gems)} ${S.currency}`, 'Payments come later (card or SOL).'), pk.tag ? GOLD : UI.line);
      this.gem(page, x + 40, y + P.h / 2, 5);
      if (pk.tag) this.text(page, x + 76, y + 18, pk.tag, 'small', UI.gold);
      this.text(page, x + 76, y + P.h / 2 + 4, num(pk.gems), 'big', GEM_CSS).setOrigin(0, 0.5);
      const bw = 128, bx = x + W - bw - 16;
      page.add(drawWindow(this.add.graphics(), bx, y + P.h / 2 - 20, bw, 40));
      this.text(page, bx + bw / 2, y + P.h / 2, pk.price, 'normal').setOrigin(0.5);
    });
    this.text(page, GAME_WIDTH / 2, P.y + S.packs.length * (P.h + P.gap) + 16, S.payNote, 'small', UI.dim).setOrigin(0.5, 0);
  }

  // ---- try-on ------------------------------------------------------------------------------------

  // One look big on the floor (arrows = the other looks), 'Looks only. No stat change.', BUY + price.
  showTryOn(look, price) {
    const page = this.newPage(), x = L.side, T = L.tryOn, i = S.looks.indexOf(look), cx = GAME_WIDTH / 2;
    this.header(page, '< BACK', () => { sfx.play('tap'); this.showTab(lastTab); });
    page.add(drawWindow(this.add.graphics(), x, T.y, W, T.h, { line: GOLD }));
    page.add(floorCrop(this, dungeons.A.tileColors[0], 200, x + 2, T.y + 2, W - 4, T.h - 4));
    const name = this.text(page, cx, T.y + 46, look.name.toUpperCase(), 'big').setOrigin(0.5);
    page.addAt(drawWindow(this.add.graphics(), cx - name.width / 2 - 20, T.y + 22, name.width + 40, 48), page.list.indexOf(name));
    this.text(page, cx, T.y + 94, `${heroDef(look.hero).name.toUpperCase()} LOOK`, 'normal', UI.gold, { stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5);
    page.add(this.add.ellipse(cx, T.y + T.h - 66, 110, 16, 0x000000, 0.35));
    page.add(new Character(this, cx, T.y + T.h - 66, lookDef(heroDef(look.hero), look)).setScale(T.scale));
    // Arrows: the previous / next look (at its normal price).
    for (const [dir, ax] of [[-1, x + 30], [1, x + W - 30]]) {
      const next = S.looks[(i + dir + S.looks.length) % S.looks.length];
      // A white pixel arrow pointing `dir`: a head of 5 columns (tip outwards) and a shaft.
      const g = this.add.graphics().fillStyle(0xffffff, 1), cy = T.y + T.h / 2, tip = ax + dir * 12;
      for (let k = 0; k < 5; k++) g.fillRect(dir > 0 ? tip - (k + 1) * 3 : tip + k * 3, cy - k * 3 - 1, 3, k * 6 + 2);
      g.fillRect(dir > 0 ? ax - 12 : ax + 3, cy - 2, 12, 4);
      page.add(g);
      page.add(this.add.zone(ax, T.y + T.h / 2, 56, 80).setInteractive({ useHandCursor: true }).on('pointerup', () => { if (!this.modal) { sfx.play('tap'); this.showTryOn(next, next.price); } }));
    }
    const note = this.text(page, cx, T.y + T.h - 30, 'Looks only. No stat change.', 'small').setOrigin(0.5);
    page.addAt(this.add.graphics().fillStyle(0x000000, 1).fillRect(x + 24, T.y + T.h - 46, W - 48, 32), page.list.indexOf(note));
    const by = T.y + T.h + 16, owned = this.owned(look.id);
    if (owned) {
      this.button(page, x, by, W, 72, 'OWNED', null, DIM, UI.dim);
    } else {
      this.button(page, x, by, W, 72, null, () => this.buy(look, price), GOLD);
      const buy = this.text(page, 0, by + 36, 'BUY', 'big', UI.gold).setOrigin(0, 0.5);
      const p = this.text(page, 0, by + 36, num(price), 'normal', GEM_CSS).setOrigin(0, 0.5);
      const w = buy.width + 24 + 14 + p.width, x0 = cx - w / 2;
      buy.setX(x0);
      this.gem(page, x0 + buy.width + 28, by + 36, 2);
      p.setX(x0 + buy.width + 38);
    }
    this.text(page, cx, by + 96, `You have ${num(this.gems())}`, 'small', UI.dim).setOrigin(0.5, 0);
  }

  // BUY: enough gems = it is yours (saved); not enough = a window pointing to GEMS.
  buy(look, price) {
    if (this.gems() < price) { this.soon('Not enough gems', `${look.name} costs ${num(price)}. You have ${num(this.gems())}.`, 'GET GEMS: soon'); return; }
    this.progress.gems = this.gems() - price;
    this.progress.looks = [...(this.progress.looks || []), look.id];
    saveProgress(this.progress);
    sfx.play('unlock');
    this.showTryOn(look, price);
  }

  soon(title, who, tag = null) {
    if (this.modal) return;
    this.modal = comingSoonWindow(this, title, who, { onClose: () => this.time.delayedCall(0, () => { this.modal = null; }) });
    const t = tag && this.modal.list.find((o) => o.text === 'Coming soon');
    if (t) t.setText(tag);
  }

  close() {
    sfx.play('tap');
    if (this.clock) this.clock.remove();
    this.scene.resume(this.from);
    this.scene.stop();
  }
}
