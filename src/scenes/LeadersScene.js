import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config.js';
import { drawWindow, uiText } from '../entities/uiKit.js';
import Character from '../entities/Character.js';
import { floorCrop } from '../entities/floorTexture.js';
import { bareIconKey } from '../entities/itemIconTexture.js';
import D from '../data/leaders.json';
import profileData from '../data/profile.json';
import heroes from '../data/heroes.json';
import enemies from '../data/enemies.json';
import squad from '../data/squad.json';
import dungeons from '../data/dungeons.json';
import { loadProgress } from '../systems/progress.js';
import { clockText } from '../systems/runStats.js';
import * as sfx from '../audio/sfx.js';

// The Leaders button (docs/systems/title-base.md section 5, user's pick A = podium), opened over the camp (the camp
// waits, paused). WEEK / ALL TIME tabs; a timer bar (week: time left until Monday; all time: HALL OF FAME); the top 3
// on a stone podium on the dungeon floor, each shown by their first hero; rows 4-6; your own row pinned in gold.
// Tap a player = their run. LOOK ONLY: no server yet, the players are samples from leaders.json.
const L = D.layout;
const C = Object.fromEntries(Object.entries(L.colors).map(([k, v]) => [k, Number(v)]));
const DIM = Number(L.dim);
const W = GAME_WIDTH - L.side * 2;
const heroDef = (id) => heroes.find((h) => h.id === id);
const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const css = (c) => '#' + c.toString(16).padStart(6, '0');
let lastTab = 'week';

// Time left until next Monday 00:00 (local), as '3D 14:22:05'.
function weekLeft(now = new Date()) {
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  while (end.getDay() !== 1) end.setDate(end.getDate() + 1);
  const t = Math.max(0, Math.floor((end - now) / 1000)), two = (n) => String(n).padStart(2, '0');
  return `${Math.floor(t / 86400)}D ${two(Math.floor((t % 86400) / 3600))}:${two(Math.floor((t % 3600) / 60))}:${two(t % 60)}`;
}

export default class LeadersScene extends Phaser.Scene {
  constructor() {
    super('Leaders');
  }

  init(data) {
    this.from = (data && data.from) || 'Base';
  }

  create() {
    this.scene.bringToTop();
    const p = loadProgress();
    const ids = (Array.isArray(p.lastSquad) && p.lastSquad.length ? p.lastSquad : squad.heroes || squad).filter((id) => heroDef(id));
    this.you = { name: (p.profile && p.profile.name) || profileData.defaults.name, floor: p.stats.bestFloor || 0, heroes: ids.slice(0, 3) };
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Number(L.bg)).setOrigin(0).setInteractive();
    this.page = null;
    this.clock = null;
    this.showBoard(lastTab);
    this.cameras.main.fadeIn(120, 0, 0, 0);
  }

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

  button(page, x, y, w, h, label, onTap, gold = false) {
    page.add(drawWindow(this.add.graphics(), x, y, w, h, { line: gold ? C.gold : UI.line }));
    if (label) page.add(uiText(this, x + w / 2, y + h / 2, label, 'normal', gold ? UI.gold : UI.text).setOrigin(0.5));
    if (onTap) page.add(this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', onTap));
  }

  hero(page, id, x, feet, scale) {
    const def = heroDef(id);
    if (!def) return null;
    const ch = new Character(this, x, feet, def).setScale(scale);
    page.add(ch);
    return ch;
  }

  // A small name tag window centred on x.
  tag(page, x, y, name, gold = false) {
    const t = uiText(this, x, y + 10, name.toUpperCase(), 'small', gold ? UI.gold : UI.text).setOrigin(0.5);
    const w = t.width + 16;
    page.add(drawWindow(this.add.graphics(), x - w / 2, y, w, 20, { line: gold ? C.gold : UI.line }));
    page.add(t);
  }

  // A pixel crown (HALL OF FAME), 18 x 12, top left at (x, y).
  crown(g, x, y) {
    g.fillStyle(C.gold, 1).fillRect(x, y + 4, 18, 8).fillRect(x, y, 3, 4).fillRect(x + 7, y - 2, 4, 6).fillRect(x + 15, y, 3, 4);
    g.fillStyle(0x000000, 1).fillRect(x + 4, y + 7, 2, 2).fillRect(x + 12, y + 7, 2, 2);
    return g;
  }

  // ---- the board -----------------------------------------------------------------------------------

  showBoard(tab) {
    lastTab = tab;
    const page = this.newPage(), x = L.side, list = tab === 'week' ? D.week : D.allTime;
    const B = L.back;
    this.button(page, B.x, B.y, B.w, B.h, this.from === 'Base' ? '< CAMP' : '< BACK', () => this.close());
    this.text(page, GAME_WIDTH / 2, L.titleY, 'LEADERS', 'big').setOrigin(0.5, 0);
    const T = L.tabs, tw = (W - T.gap) / 2;
    [['week', 'WEEK'], ['allTime', 'ALL TIME']].forEach(([id, label], i) => {
      this.button(page, x + i * (tw + T.gap), T.y, tw, T.h, label, () => { if (id !== tab) { sfx.play('tap'); this.showBoard(id); } }, id === tab);
    });
    // Timer bar: an hourglass + time left this week, or a crown + HALL OF FAME.
    const Ti = L.timer;
    page.add(drawWindow(this.add.graphics(), x, Ti.y, W, Ti.h, { line: C.gold }));
    if (tab === 'week') {
      const label = this.text(page, 0, Ti.y + Ti.h / 2, 'ENDS IN', 'normal').setOrigin(0, 0.5);
      const time = this.text(page, 0, Ti.y + Ti.h / 2, weekLeft(), 'normal', UI.gold).setOrigin(0, 0.5);
      const icon = this.add.image(0, Ti.y + Ti.h / 2, bareIconKey(this, 'hourglass')).setScale(2);
      page.add(icon);
      const place = () => {
        const w = 32 + 10 + label.width + 12 + time.width, x0 = GAME_WIDTH / 2 - w / 2;
        icon.setX(x0 + 16); label.setX(x0 + 42); time.setX(x0 + 42 + label.width + 12);
      };
      place();
      this.clock = this.time.addEvent({ delay: 1000, loop: true, callback: () => { time.setText(weekLeft()); place(); } });
    } else {
      const label = this.text(page, 0, Ti.y + Ti.h / 2, 'HALL OF FAME', 'normal').setOrigin(0, 0.5);
      const x0 = GAME_WIDTH / 2 - (18 + 10 + label.width) / 2;
      label.setX(x0 + 28);
      page.add(this.crown(this.add.graphics(), x0, Ti.y + Ti.h / 2 - 5));
    }
    this.drawPodium(page, list.slice(0, 3));
    const R = L.rows;
    list.slice(3, 3 + R.count).forEach((pl, i) => this.row(page, R.y + i * (R.h + R.gap), 4 + i, pl, () => this.showRun(pl, 4 + i, tab)));
    this.text(page, GAME_WIDTH / 2, L.noteY, D.sampleNote, 'small', UI.dim).setOrigin(0.5, 0);
    this.row(page, L.you.y, D.youRank[tab], { name: 'YOU', heroes: this.you.heroes, floor: this.you.floor }, null, true);
  }

  // The top 3 on a stone podium (1 in the middle and highest), each by their first hero with a name tag.
  drawPodium(page, top) {
    const P = L.podium, x = L.side;
    page.add(drawWindow(this.add.graphics(), x, P.y, W, P.h, { line: C.gold }));
    page.add(floorCrop(this, dungeons.A.tileColors[0], 200, x + 2, P.y + 2, W - 4, P.h - 4));
    const order = [1, 0, 2], base = P.y + P.h - 2, cx = GAME_WIDTH / 2, g = this.add.graphics();
    page.add(g);
    const numColors = [C.gold, C.silver, C.bronze];
    order.forEach((rank, slot) => {
      const pl = top[rank];
      if (!pl) return;
      const bx = cx + (slot - 1) * (P.blockW + 4) - P.blockW / 2, h = P.heights[rank], by = base - h;
      g.fillStyle(C.stoneDark, 1).fillRect(bx, by, P.blockW, h);
      g.fillStyle(C.stone, 1).fillRect(bx + 2, by + 4, P.blockW - 4, h - 4);
      g.fillStyle(C.stoneTop, 1).fillRect(bx, by, P.blockW, 4);
      this.text(page, bx + P.blockW / 2, by + h / 2 + 2, String(rank + 1), 'big', css(numColors[rank]), { stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5);
      const hx = bx + P.blockW / 2;
      const ch = this.hero(page, pl.heroes[0], hx, by, P.heroScale);
      const headY = by - ((ch && ch.def.height) || 24) * P.heroScale - 8;
      this.tag(page, hx, headY - 20, pl.name, rank === 0);
      page.add(this.add.zone(bx, headY - 20, P.blockW, base - headY + 20).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', () => this.showRun(pl, rank + 1, lastTab)));
    });
  }

  // One rank row: rank number, name, the 3-hero squad, best floor. `you` = gold, pinned.
  row(page, y, rank, pl, onTap, you = false) {
    const x = L.side, h = you ? L.you.h : L.rows.h;
    this.button(page, x, y, W, h, null, onTap ? () => { sfx.play('tap'); onTap(); } : null, you);
    this.text(page, x + 16, y + h / 2, String(rank), you ? 'normal' : 'normal', you ? UI.gold : UI.dim).setOrigin(0, 0.5);
    const nx = x + (you ? 96 : 60);
    if (you) this.text(page, nx, y + h / 2, 'YOU', 'small', UI.gold).setOrigin(0, 0.5);
    else this.text(page, nx, y + 8, pl.name.toUpperCase(), 'small');
    const hx = you ? nx + 48 : nx + 10;
    pl.heroes.forEach((id, i) => this.hero(page, id, hx + i * 30, y + h - 4, 2));
    this.text(page, x + W - 16, y + 14, 'FLOOR', 'small', UI.dim).setOrigin(1, 0);
    this.text(page, x + W - 16, y + h - 12, String(pl.floor), 'normal', you ? UI.gold : UI.text).setOrigin(1, 1);
  }

  // ---- a player's run --------------------------------------------------------------------------------

  showRun(pl, rank, tab) {
    sfx.play('tap');
    const page = this.newPage(), x = L.side, R = L.run, P = L.pad;
    const B = L.back;
    this.button(page, B.x, B.y, B.w, B.h, '< BACK', () => { sfx.play('tap'); this.showBoard(tab); });
    page.add(drawWindow(this.add.graphics(), x, R.y, W, R.h, { line: C.gold }));
    page.add(floorCrop(this, dungeons.A.tileColors[0], 200, x + 2, R.y + 2, W - 4, R.h - 4));
    this.tag(page, GAME_WIDTH / 2, R.y + 16, `${rank}. ${pl.name}`, true);
    this.text(page, GAME_WIDTH / 2, R.y + 66, `FLOOR ${pl.floor}`, 'big', UI.text, { stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
    pl.heroes.forEach((id, i) => this.hero(page, id, GAME_WIDTH / 2 + (i - 1) * 100, R.y + R.h - 24, 4));
    let y = R.y + R.h + 16;
    const killer = enemies[pl.endedBy];
    const rows = [['Bosses beaten', num(pl.bosses)], ['Enemies defeated', num(pl.kills)], ['Time', clockText(pl.ms)], ['Ended by', killer ? killer.name.replace(/^The /, '').split(' the ')[0] : '?']];
    page.add(drawWindow(this.add.graphics(), x, y, W, 20 + rows.length * 28));
    rows.forEach(([k, v], i) => {
      this.text(page, x + P, y + 18 + i * 28, k, 'small');
      this.text(page, x + W - P, y + 18 + i * 28, v, 'small', UI.gold).setOrigin(1, 0);
    });
    y += 20 + rows.length * 28 + 20;
    this.text(page, x, y, 'ITEMS', 'normal');
    y += 32;
    (pl.items || []).forEach((id, i) => {
      const cx = x + (i % 6) * 58, cy = y + Math.floor(i / 6) * 58;
      page.add(drawWindow(this.add.graphics(), cx, cy, 50, 50));
      page.add(this.add.image(cx + 25, cy + 25, bareIconKey(this, id)).setScale(2));
    });
  }

  close() {
    sfx.play('tap');
    if (this.clock) this.clock.remove();
    this.scene.resume(this.from);
    this.scene.stop();
  }
}
