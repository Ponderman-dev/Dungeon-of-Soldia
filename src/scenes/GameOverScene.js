import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config.js';
import { drawWindow, uiText } from '../entities/uiKit.js';
import Character from '../entities/Character.js';
import { floorCrop } from '../entities/floorTexture.js';
import { itemIconKey } from '../entities/itemIconTexture.js';
import G from '../data/gameOver.json';
import heroes from '../data/heroes.json';
import enemies from '../data/enemies.json';
import items from '../data/items.json';
import dungeons from '../data/dungeons.json';
import { clockText } from '../systems/runStats.js';
import * as sfx from '../audio/sfx.js';

// The game-over summary (docs/systems/title-base.md section 5, user's pick B), after the defeat screen's CONTINUE.
// Page 1: the run (floor, time, kills, NEW BEST!), the 3 heroes on the dungeon floor (tap one = gold outline + bigger)
// and that hero's card (fell on, damage, healing, kills, taken, items, who felled them). BOSSES / ITEMS open their
// pages. CAMP = back to the camp, TRY AGAIN = the squad screen. Data: `summary` from systems/runStats.js finishRun.
const GOLD = Phaser.Display.Color.HexStringToColor(UI.gold).color;
const RED = Phaser.Display.Color.HexStringToColor(UI.red).color;
const DIM = Number(G.dim);
const W = GAME_WIDTH - G.side * 2;
const heroDef = (id) => heroes.find((h) => h.id === id);
const enemyDef = (id) => (enemies[id] ? { id, ...enemies[id] } : null);
const shortName = (name) => name.replace(/^The /, '').split(' the ')[0]; // 'Grukk the War Drum' -> 'Grukk'
const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); // 48 210

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  init(data) {
    this.summary = data.summary;
    this.lastRun = data.lastRun;
    this.picked = 0;
    this.leaving = false;
  }

  create() {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Number(G.bg)).setOrigin(0);
    this.page = null;
    this.showSummary();
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  // A new page: the old one (and its characters) is thrown away.
  newPage() {
    if (this.page) this.page.destroy();
    this.page = this.add.container(0, 0);
    return this.page;
  }

  // A window button. look: 'plain', 'filled' (gold, black text), 'dim'. Returns the tap zone.
  button(page, x, y, w, h, label, onTap, look = 'plain') {
    page.add(drawWindow(this.add.graphics(), x, y, w, h, { line: look === 'dim' ? DIM : look === 'filled' ? GOLD : UI.line, fill: look === 'filled' ? GOLD : UI.window }));
    page.add(uiText(this, x + w / 2, y + h / 2, label, 'normal', look === 'filled' ? '#000000' : look === 'dim' ? UI.dim : UI.text).setOrigin(0.5));
    const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', () => { if (!this.leaving) onTap(); });
    page.add(z);
    return z;
  }

  text(page, x, y, str, size = 'normal', color = UI.text, extra = {}) {
    const t = uiText(this, x, y, str, size, color, extra);
    page.add(t);
    return t;
  }

  // ---- page 1: the run ---------------------------------------------------------------------------

  showSummary() {
    const S = this.summary, page = this.newPage(), x = G.side, cx = GAME_WIDTH / 2;
    this.text(page, cx, G.title.y, G.title.text, 'big', UI.red).setOrigin(0.5, 0);
    // The run card: FLOOR / TIME / KILLS, then NEW BEST! (gold tag) or the best floor so far.
    const R = G.run;
    page.add(drawWindow(this.add.graphics(), x, R.y, W, R.h));
    [['FLOOR', S.floor], ['TIME', clockText(S.ms)], ['KILLS', num(S.kills)]].forEach(([label, v], i) => {
      const mx = x + (W * (i * 2 + 1)) / 6;
      this.text(page, mx, R.y + R.labelY, label, 'small', UI.dim).setOrigin(0.5, 0);
      this.text(page, mx, R.y + R.valueY, String(v), 'big').setOrigin(0.5, 0);
    });
    if (S.newBest) {
      const tag = this.text(page, 0, R.y + R.bestY, 'NEW BEST!', 'small', '#000000').setOrigin(0, 0);
      const tw = tag.width + 12, tx = x + G.pad;
      tag.setX(tx + 6);
      const g = this.add.graphics().fillStyle(GOLD, 1).fillRect(tx, R.y + R.bestY - 4, tw, tag.height + 8);
      page.addAt(g, page.list.indexOf(tag));
      if (S.oldBest > 0) this.text(page, tx + tw + 12, R.y + R.bestY, `Old best: ${S.oldBest}`, 'small', UI.dim);
    } else {
      this.text(page, cx, R.y + R.bestY, `Best: ${S.oldBest}`, 'small', UI.dim).setOrigin(0.5, 0);
    }
    this.drawStrip(page);
    this.text(page, x, G.tapHint.y, G.tapHint.text, 'small', UI.dim);
    this.cardBox = this.add.container(0, 0);
    page.add(this.cardBox);
    this.drawHeroCard();
    // BOSSES n / ITEMS n, then CAMP / TRY AGAIN.
    const P = G.pages, half = (W - P.gap) / 2;
    this.button(page, x, P.y, half, P.h, `BOSSES ${S.bosses.length}`, () => { sfx.play('tap'); this.showBosses(); });
    this.button(page, x + half + P.gap, P.y, half, P.h, `ITEMS ${S.items.filter((it) => items[it.id]).length}`, () => { sfx.play('tap'); this.showItems(); });
    const B = G.bottom, bw = (W - B.gap) / 2;
    this.button(page, x, B.y, bw, B.h, 'CAMP', () => this.leave('Base', { fromTitle: true }));
    this.button(page, x + bw + B.gap, B.y, bw, B.h, 'TRY AGAIN', () => this.leave('Squad', { lastRun: this.lastRun }), 'filled');
  }

  // The 3 heroes standing on the dungeon floor; the picked one is bigger with a gold 1-art-pixel outline.
  drawStrip(page) {
    const T = G.strip, x = G.side, n = this.summary.heroes.length;
    page.add(drawWindow(this.add.graphics(), x, T.y, W, T.h));
    // A crop of the battle floor (below the wall) inside the window's line.
    const floor = floorCrop(this, dungeons.A.tileColors[0], T.wallH, x + 2, T.y + 2, W - 4, T.h - 4);
    page.add(floor);
    this.stripHeroes = this.summary.heroes.map((h, i) => {
      const def = heroDef(h.id), hx = Math.round(x + (W * (i * 2 + 1)) / (n * 2)), feet = T.y + T.feetY;
      const picked = i === this.picked, scale = picked ? T.pickedScale : T.heroScale;
      const made = [];
      if (picked) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { // the outline: 4 gold copies, 1 art pixel out
        const o = new Character(this, hx + dx * scale, feet + dy * scale, def).setScale(scale);
        for (const part of Object.values(o.parts)) part.image.setTint(Number(T.outline)).setTintMode(Phaser.TintModes.FILL);
        made.push(o);
      }
      made.push(new Character(this, hx, feet, def).setScale(scale));
      page.add(made);
      const hit = this.add.zone(hx, T.y + T.h / 2, W / n, T.h).setInteractive({ useHandCursor: true }).on('pointerup', () => this.pick(i));
      page.add(hit);
      return made;
    });
  }

  pick(i) {
    if (i === this.picked || this.leaving) return;
    sfx.play('tap');
    this.picked = i;
    this.showSummary();
  }

  // The picked hero's card: name, fell on floor N, damage / healing / kills / taken, items, and the enemy that felled them.
  drawHeroCard() {
    const h = this.summary.heroes[this.picked], C = G.card, x = G.side, y = C.y, P = G.pad, box = this.cardBox;
    box.add(drawWindow(this.add.graphics(), x, y, W, C.h));
    box.add(uiText(this, x + P, y + C.nameY, h.name.toUpperCase(), 'normal', UI.gold));
    box.add(uiText(this, x + P, y + C.fellY, `Fell on floor ${h.fellFloor}.`, 'small', UI.dim));
    const stat = (cx, cy, label, v) => {
      box.add(uiText(this, cx, cy, label, 'small', UI.dim));
      box.add(uiText(this, cx, cy + C.valueDy, num(v), 'normal'));
    };
    stat(x + P, y + C.row1Y, 'DAMAGE', h.damage);
    stat(x + C.colX, y + C.row1Y, 'HEALING', h.healing);
    stat(x + P, y + C.row2Y, 'KILLS', h.kills);
    stat(x + C.colX, y + C.row2Y, 'TAKEN', h.taken);
    box.add(uiText(this, x + P, y + C.itemsY, 'ITEMS', 'small', UI.dim));
    if (!h.items.length) box.add(uiText(this, x + P, y + C.iconsY + 6, 'None.', 'small', UI.dim));
    // Big icons (x2) while they fit on one row, else small ones in rows.
    const held = h.items.filter((id) => items[id]), room = W - P * 2;
    const sc = held.length * (20 * C.iconBig + C.iconGap) - C.iconGap <= room ? C.iconBig : 1, size = 20 * sc;
    let ix = x + P, iy = y + C.iconsY;
    for (const id of held) {
      if (ix + size > x + W - P) { ix = x + P; iy += size + C.iconGap; }
      box.add(this.add.image(ix, iy, itemIconKey(this, id, items[id].rarity)).setOrigin(0).setScale(sc));
      ix += size + C.iconGap;
    }
    // Who felled them: the enemy's sprite with its name in red.
    const k = h.killer && enemyDef(h.killer.id);
    if (k) {
      const kx = x + W - C.killerX, scale = Math.min(C.killerScale, 52 / (k.height || 24));
      const ch = new Character(this, kx, y + C.killerFeetY, k);
      ch.setScale(scale);
      ch.face(-1);
      box.add(ch);
      box.add(uiText(this, kx, y + C.killerNameY, h.killer.name.toUpperCase(), 'small', UI.red, { align: 'center', wordWrap: { width: 120 } }).setOrigin(0.5, 0));
    }
  }

  // ---- BOSSES and ITEMS pages ----------------------------------------------------------------------

  pageTop(title) {
    const page = this.newPage(), B = G.back;
    this.button(page, B.x, B.y, B.w, B.h, '< BACK', () => { sfx.play('tap'); this.showSummary(); });
    this.text(page, GAME_WIDTH / 2, G.pageTitleY, title, 'big').setOrigin(0.5, 0);
    return page;
  }

  // Every boss beaten (big, floor, time to beat), then the next boss's floor.
  showBosses() {
    const page = this.pageTop('BOSSES'), L = G.bossList, list = this.summary.bosses, x = G.side;
    const h = Math.min(L.h, Math.floor((GAME_HEIGHT - L.y - G.side) / (list.length + 1)) - L.gap);
    list.forEach((b, i) => {
      const y = L.y + i * (h + L.gap), def = enemyDef(b.id);
      page.add(drawWindow(this.add.graphics(), x, y, W, h));
      if (def) {
        const scale = Math.min(L.maxScale, (h - 16) / (def.height || 32));
        const ch = new Character(this, x + L.spriteX, y + h - 10, def);
        ch.setScale(scale);
        page.add(ch);
      }
      const tx = x + L.textX;
      this.text(page, tx, y + 14, shortName(b.name).toUpperCase(), 'normal');
      this.text(page, tx, y + h - 54, `Floor ${b.floor}`, 'small', UI.dim);
      this.text(page, tx, y + h - 38, 'BEATEN IN', 'small', UI.dim);
      this.text(page, tx + 90, y + h - 44, clockText(b.ms), 'normal', UI.gold);
    });
    const y = L.y + list.length * (h + L.gap);
    page.add(drawWindow(this.add.graphics(), x, y, W, Math.min(h, 80), { line: DIM }));
    this.text(page, GAME_WIDTH / 2, y + Math.min(h, 80) / 2, this.summary.nextBoss ? `NEXT BOSS: FLOOR ${this.summary.nextBoss}` : 'NO BOSS LEFT', 'small', UI.dim).setOrigin(0.5);
  }

  // Every item the squad held at the end: a grid of icons; tap one = its name, who held it, what it does.
  showItems(pickedId = null) {
    const page = this.pageTop('ITEMS'), I = G.itemGrid, list = this.summary.items.filter((it) => items[it.id]), x = G.side;
    const many = list.length > I.manyAfter;
    const cols = many ? I.manyCols : I.cols, cell = many ? I.manyCell : I.cell, sc = many ? I.manyIconScale : I.iconScale;
    const gap = (W - cols * cell) / (cols - 1);
    const pick = pickedId || (list[0] && list[0].id);
    this.text(page, x, I.y - 22, `${list.length} ITEMS`, 'small', UI.text);
    this.text(page, x + W, I.y - 22, 'Tap one to read it.', 'small', UI.dim).setOrigin(1, 0);
    list.forEach((it, i) => {
      const cx = x + (i % cols) * (cell + gap), cy = I.y + Math.floor(i / cols) * (cell + gap);
      page.add(drawWindow(this.add.graphics(), cx, cy, cell, cell, { line: it.id === pick ? GOLD : UI.line }));
      if (items[it.id]) page.add(this.add.image(cx + cell / 2, cy + cell / 2, itemIconKey(this, it.id, items[it.id].rarity)).setScale(sc));
      page.add(this.add.zone(cx, cy, cell, cell).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', () => {
        if (it.id !== pick) { sfx.play('tap'); this.showItems(it.id); }
      }));
    });
    const rows = Math.ceil(list.length / cols), iy = I.y + rows * (cell + gap) + 4;
    const def = pick && items[pick];
    if (!def) { this.text(page, GAME_WIDTH / 2, I.y + 40, 'No items this run.', 'small', UI.dim).setOrigin(0.5, 0); return; }
    const held = list.find((x2) => x2.id === pick).heldBy;
    page.add(drawWindow(this.add.graphics(), x, iy, W, I.infoH));
    this.text(page, x + G.pad, iy + 14, def.name.toUpperCase(), 'normal', UI.gold, { wordWrap: { width: W - G.pad * 2 } });
    this.text(page, x + G.pad, iy + 40, `Held by ${held.join(', ')}.`, 'small', UI.dim, { wordWrap: { width: W - G.pad * 2 } });
    this.text(page, x + G.pad, iy + 62, def.description || '', 'small', UI.text, { wordWrap: { width: W - G.pad * 2 }, lineSpacing: 6 });
  }

  // CAMP / TRY AGAIN: fade out, then the next screen.
  leave(key, data) {
    if (this.leaving) return;
    this.leaving = true;
    sfx.play('tap');
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key, data));
  }
}
