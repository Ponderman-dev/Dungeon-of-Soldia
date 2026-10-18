import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config.js';
import { drawWindow, uiButton } from '../entities/uiKit.js';
import Character from '../entities/Character.js';
import { partArt, artSize, artPixels } from '../systems/pixelArt.js';
import * as sfx from '../audio/sfx.js';
import rooms from '../data/rooms.json';
import roomProps from '../data/roomProps.json';
import heroDefs from '../data/heroes.json';
import enemyDefs from '../data/enemies.json';
import minionDefs from '../data/minions.json';
import { pickPuzzle, puzzleSettings, mimicPlan, runePlan, traceBeam, flipMirror, makeBeamLevel, slideKey, makeIceLevel, shufflePieces, swapPieces, pictureDone } from '../systems/puzzles.js';

const R = rooms.kinds.puzzle;
const FONT = UI.font;
const SHEET_TOP = 44;
const STAGE_TOP = 214; // where the puzzle itself starts
const BUTTON_Y = GAME_HEIGHT - 92;
const hex = (c) => Number(c.replace('#', '0x'));
const GOLD = hex(UI.gold);

// The Puzzle Room sheet: one of the 5 puzzles the user kept (rooms.json `puzzles`), picked at random, harder deeper
// down (`tiers`). The rules are in systems/puzzles.js; this scene only draws and takes taps. Reports through
// payload.onDone(solved, { bite }) (bite: a Mimic bit, the room applies it).
export default class PuzzleScene extends Phaser.Scene {
  constructor() {
    super('Puzzle');
  }

  init(payload) {
    this.payload = payload; // { floor, onDone, kind? }
  }

  create() {
    this.kind = this.payload.kind || pickPuzzle(R);
    this.P = puzzleSettings(R, this.kind, this.payload.floor || 1);
    this.done = false;
    this.closing = false;
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05030a, 0.6).setInteractive();
    this.sheet = this.add.container(0, GAME_HEIGHT);
    this.sheet.add(drawWindow(this.add.graphics(), 4, SHEET_TOP, GAME_WIDTH - 8, GAME_HEIGHT - SHEET_TOP + 40));
    this.sheet.add(this.add.text(GAME_WIDTH / 2, SHEET_TOP + 20, 'PUZZLE ROOM', { fontFamily: FONT, fontSize: '8px', color: UI.gold }).setOrigin(0.5, 0));
    this.sheet.add(this.add.text(GAME_WIDTH / 2, 104, R.names[this.kind], { fontFamily: FONT, fontSize: '16px', color: UI.text }).setOrigin(0.5, 0));
    this.sheet.add(this.add.text(GAME_WIDTH / 2, 134, R.howTo[this.kind], { fontFamily: FONT, fontSize: '8px', color: '#c8c8d4', align: 'center', lineSpacing: 6 }).setOrigin(0.5, 0));
    this.status = this.add.text(GAME_WIDTH / 2, 182, '', { fontFamily: FONT, fontSize: '8px', color: UI.text, align: 'center' }).setOrigin(0.5, 0);
    this.sheet.add(this.status);
    this.giveUp = uiButton(this, GAME_WIDTH / 2 - 80, BUTTON_Y, 160, 44, 'Give up', { onTap: () => this.finish(false) });
    this.sheet.add(this.giveUp.container);
    ({ mimic: this.makeMimic, runes: this.makeRunes, beam: this.makeBeam, ice: this.makeIce, picture: this.makePicture })[this.kind].call(this);
    this.tweens.add({ targets: this.sheet, y: 0, duration: 420, ease: 'Cubic.easeOut' });
    sfx.play('rewardUp');
  }

  say(text, color = UI.text) {
    this.status.setText(text).setColor(color);
  }

  wait(ms) {
    return new Promise((res) => this.time.delayedCall(ms, res));
  }

  // Solved: gold message, the item pick comes. Failed: red message, nothing (a Mimic also bites).
  win(text) {
    this.done = true;
    this.say(text, UI.gold);
    sfx.play('puzzleSolved');
    this.time.delayedCall(1000, () => this.finish(true));
  }

  lose(text, info = {}) {
    this.done = true;
    this.say(text, UI.red);
    this.time.delayedCall(1300, () => this.finish(false, info));
  }

  finish(solved, info = {}) {
    if (this.closing) return;
    this.closing = true;
    this.done = true;
    this.tweens.add({ targets: this.sheet, y: GAME_HEIGHT, duration: 300, ease: 'Cubic.easeIn', onComplete: () => this.payload.onDone(solved, info) });
  }

  // ---- Mimic Shuffle -----------------------------------------------------------------------------------------
  makeMimic() {
    const P = this.P;
    const plan = mimicPlan(P);
    const y = 470;
    const slotX = (s) => Math.round((GAME_WIDTH / P.chests) * (s + 0.5));
    const scale = roomProps.chest.drawScale ?? 4;
    this.slotOf = [...Array(P.chests).keys()];
    this.chests = this.slotOf.map((s) => {
      const ch = new Character(this, slotX(s), y, roomProps.chest).setScale(scale);
      this.sheet.add(ch);
      return ch;
    });
    // The coin: a little gold disc drawn in pixels.
    const coin = this.add.graphics();
    coin.fillStyle(0x8a5a14, 1).fillRect(-10, -8, 20, 16).fillRect(-8, -10, 16, 20);
    coin.fillStyle(GOLD, 1).fillRect(-8, -6, 16, 12).fillRect(-6, -8, 12, 16);
    coin.fillStyle(0xfff3a0, 1).fillRect(-4, -4, 4, 4);
    coin.setVisible(false);
    this.sheet.add(coin);
    const showCoin = (ch) => coin.setPosition(ch.x, y - 74).setVisible(true);
    let open = false;
    this.say('Watch the coin...');
    (async () => {
      await this.wait(500);
      showCoin(this.chests[plan.treasure]);
      await this.wait(1000);
      coin.setVisible(false);
      await this.wait(350);
      for (const [a, b] of plan.swaps) {
        if (this.closing) return;
        [this.slotOf[a], this.slotOf[b]] = [this.slotOf[b], this.slotOf[a]];
        // One chest passes in front, the other behind.
        this.tweens.add({ targets: this.chests[a], x: slotX(this.slotOf[a]), duration: P.swapMs, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: this.chests[a], y: y + 18, duration: P.swapMs / 2, yoyo: true });
        this.tweens.add({ targets: this.chests[b], x: slotX(this.slotOf[b]), duration: P.swapMs, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: this.chests[b], y: y - 18, duration: P.swapMs / 2, yoyo: true });
        sfx.play('puzzleSlide');
        await this.wait(P.swapMs + 40);
      }
      open = !this.closing;
      if (open) this.say('Which chest has the coin?');
    })();
    const h = roomProps.chest.height || 11;
    this.chests.forEach((ch, i) => {
      ch.setInteractive(new Phaser.Geom.Rectangle(-9, -h - 4, 18, h + 8), Phaser.Geom.Rectangle.Contains);
      ch.on('pointerdown', () => {
        if (!open || this.done) return;
        open = false;
        if (i === plan.treasure) {
          showCoin(ch);
          return this.win('TREASURE!');
        }
        // A Mimic: the chest wakes up, shakes and bites; the coin shows where it really was.
        const mimic = new Character(this, ch.x, ch.y, minionDefs.mimic).setScale(scale);
        this.sheet.add(mimic);
        ch.setVisible(false);
        this.tweens.add({ targets: mimic, x: ch.x + 5, duration: 60, yoyo: true, repeat: 3 });
        sfx.play('heroFall');
        showCoin(this.chests[plan.treasure]);
        this.lose('A MIMIC! It bites!', { bite: true });
      });
    });
  }

  // ---- Rune Lock ---------------------------------------------------------------------------------------------
  makeRunes() {
    const P = this.P;
    const plan = runePlan(P, R.runeGlyphs.length);
    const cols = P.runes > 4 ? 4 : 2;
    const size = 72;
    const gap = 12;
    const left = (GAME_WIDTH - cols * size - (cols - 1) * gap) / 2;
    const top = STAGE_TOP + 60;
    const runes = plan.runes.map((glyph, i) => {
      const x = left + (i % cols) * (size + gap);
      const y = top + Math.floor(i / cols) * (size + gap);
      const g = this.add.graphics();
      this.sheet.add(g);
      const paint = (lit) => {
        g.clear();
        drawWindow(g, x, y, size, size, { line: lit ? GOLD : UI.line });
        g.fillStyle(lit ? GOLD : 0x6a6a80, 1);
        R.runeGlyphs[glyph].forEach((row, ry) => [...row].forEach((c, rx) => { if (c === '1') g.fillRect(x + 16 + rx * 8, y + 16 + ry * 8, 8, 8); }));
      };
      paint(false);
      const zone = this.add.zone(x, y, size, size).setOrigin(0).setInteractive();
      this.sheet.add(zone);
      return { paint, zone };
    });
    let round = 1;
    let input = [];
    let listening = false;
    const flash = async (i, ms) => {
      runes[i].paint(true);
      sfx.play('puzzleSlide');
      await this.wait(ms);
      runes[i].paint(false);
      await this.wait(ms * 0.4);
    };
    const show = async () => {
      listening = false;
      this.say(`Round ${round} of ${P.length}: watch...`);
      await this.wait(600);
      for (let k = 0; k < round; k++) {
        if (this.closing) return;
        await flash(plan.sequence[k], P.flashMs);
      }
      if (this.closing) return;
      input = [];
      listening = true;
      this.say(`Round ${round} of ${P.length}: your turn`);
    };
    runes.forEach((r, i) => r.zone.on('pointerdown', async () => {
      if (!listening || this.done) return;
      flash(i, 180);
      input.push(i);
      if (plan.sequence[input.length - 1] !== i) {
        listening = false;
        return this.lose('Wrong rune! The door stays shut.');
      }
      if (input.length < round) return;
      listening = false;
      if (round === P.length) {
        runes.forEach((x) => x.paint(true));
        return this.win('The door opens!');
      }
      round++;
      await this.wait(500);
      show();
    }));
    show();
  }

  // ---- Mirror Beam -------------------------------------------------------------------------------------------
  makeBeam() {
    const made = makeBeamLevel(this.P);
    if (!made) return this.finish(false); // never seen in tests; leave rather than show a broken room
    const { level } = made;
    let ori = made.ori;
    const cs = Math.floor(320 / level.n);
    const W = cs * level.n;
    const left = Math.round((GAME_WIDTH - W) / 2);
    const top = STAGE_TOP + 20;
    const frame = drawWindow(this.add.graphics(), left - 6, top - 6, W + 12, W + 12, { fill: 0x14101f });
    const g = this.add.graphics();
    this.sheet.add([frame, g]);
    const [cx, cy] = level.crystal.split(',').map(Number);
    const draw = () => {
      g.clear();
      g.fillStyle(0x221c33, 1);
      for (let i = 1; i < level.n; i++) g.fillRect(left + i * cs, top, 1, W).fillRect(left, top + i * cs, W, 1);
      g.fillStyle(GOLD, 1).fillRect(left - 6, top + level.srow * cs + cs / 2 - 5, 8, 10); // the crack the light comes from
      for (const k of level.pillars) {
        const [x, y] = k.split(',').map(Number);
        g.fillStyle(0x5a5466, 1).fillRect(left + x * cs + 4, top + y * cs + 4, cs - 8, cs - 8);
        g.fillStyle(0x8a849a, 1).fillRect(left + x * cs + 4, top + y * cs + 4, cs - 8, 4);
      }
      const r = traceBeam(level, ori);
      // The beam: a gold line from cell centre to cell centre.
      let x0 = left;
      let y0 = top + level.srow * cs + cs / 2;
      g.fillStyle(GOLD, 1);
      for (const [x, y] of r.path) {
        const x1 = left + x * cs + cs / 2;
        const y1 = top + y * cs + cs / 2;
        g.fillRect(Math.min(x0, x1) - 2, Math.min(y0, y1) - 2, Math.abs(x1 - x0) + 4, Math.abs(y1 - y0) + 4);
        x0 = x1;
        y0 = y1;
      }
      // The crystal: a purple pixel gem (gold rim once the beam reaches it).
      const gx = left + cx * cs + cs / 2;
      const gy = top + cy * cs + cs / 2;
      const u = Math.max(2, Math.floor(cs / 12));
      g.fillStyle(r.hit ? GOLD : 0x2a1450, 1).fillRect(gx - 3 * u, gy - 4 * u, 6 * u, 8 * u).fillRect(gx - 4 * u, gy - 2 * u, 8 * u, 4 * u);
      g.fillStyle(0x9a5cff, 1).fillRect(gx - 2 * u, gy - 3 * u, 4 * u, 6 * u).fillRect(gx - 3 * u, gy - u, 6 * u, 2 * u);
      g.fillStyle(0xe0c8ff, 1).fillRect(gx - u, gy - 2 * u, u, u);
      // Mirrors: a white stepped diagonal.
      g.fillStyle(0xffffff, 1);
      level.mirrors.forEach(([x, y], i) => {
        const steps = cs - 10;
        for (let k = 0; k < steps; k += 2) g.fillRect(left + x * cs + 5 + k, top + y * cs + 3 + (ori[i] === '/' ? steps - k : k), 3, 4);
      });
      return r.hit;
    };
    draw();
    this.say('Turn the mirrors.');
    const zone = this.add.zone(left, top, W, W).setOrigin(0).setInteractive();
    this.sheet.add(zone);
    zone.on('pointerdown', (p) => {
      if (this.done) return;
      const x = Math.floor((p.x - left) / cs);
      const y = Math.floor((p.y - top) / cs);
      const m = level.mirrors.findIndex(([mx, my]) => mx === x && my === y);
      if (m < 0) return;
      ori = flipMirror(ori, m);
      sfx.play('puzzleSlide');
      if (draw()) this.win('The crystal lights up!');
    });
  }

  // ---- Ice Slide ---------------------------------------------------------------------------------------------
  makeIce() {
    const made = makeIceLevel(this.P);
    if (!made) return this.finish(false);
    const { level, goal, par } = made;
    let pos = made.start;
    let moves = 0;
    let sliding = false;
    const cs = Math.floor(304 / level.n);
    const W = cs * level.n;
    const left = Math.round((GAME_WIDTH - W) / 2);
    const top = STAGE_TOP;
    const frame = drawWindow(this.add.graphics(), left - 6, top - 6, W + 12, W + 12);
    const g = this.add.graphics();
    this.sheet.add([frame, g]);
    const key = { x: pos[0] * cs, y: pos[1] * cs };
    const draw = () => {
      g.clear();
      for (let y = 0; y < level.n; y++) {
        for (let x = 0; x < level.n; x++) {
          g.fillStyle((x + y) % 2 ? 0xb6e4f6 : 0x9fd8f0, 1).fillRect(left + x * cs, top + y * cs, cs, cs);
          g.fillStyle(0xe8f8ff, 1).fillRect(left + x * cs + 3, top + y * cs + 3, 4, 2);
        }
      }
      for (const k of level.rocks) {
        const [x, y] = k.split(',').map(Number);
        g.fillStyle(0x5f5a6e, 1).fillRect(left + x * cs + 3, top + y * cs + 5, cs - 6, cs - 8);
        g.fillStyle(0x8a849a, 1).fillRect(left + x * cs + 6, top + y * cs + 3, cs - 12, 4);
      }
      const hx = left + goal[0] * cs;
      const hy = top + goal[1] * cs;
      g.fillStyle(0x3a2a1a, 1).fillRect(hx + 4, hy + 4, cs - 8, cs - 8);
      g.fillStyle(0x000000, 1).fillRect(hx + cs / 2 - 4, hy + 10, 8, 8).fillRect(hx + cs / 2 - 2, hy + 18, 4, cs - 26);
      // The key, in gold: a ring, a shaft and a tooth.
      const s = Math.max(2, Math.floor(cs / 14));
      const kx = left + key.x + cs / 2;
      const ky = top + key.y;
      g.fillStyle(GOLD, 1);
      g.fillRect(kx - 3 * s, ky + 3 * s, 6 * s, 2 * s).fillRect(kx - 3 * s, ky + 3 * s, 2 * s, 5 * s).fillRect(kx + s, ky + 3 * s, 2 * s, 5 * s).fillRect(kx - 3 * s, ky + 7 * s, 6 * s, 2 * s);
      g.fillRect(kx - s, ky + 9 * s, 2 * s, 4 * s).fillRect(kx + s, ky + 10 * s, 2 * s, s);
    };
    const move = (d) => {
      if (this.done || sliding) return;
      const to = slideKey(level, pos, d);
      if (to[0] === pos[0] && to[1] === pos[1]) return;
      sliding = true;
      moves++;
      sfx.play('puzzleSlide');
      const dist = Math.abs(to[0] - pos[0]) + Math.abs(to[1] - pos[1]);
      this.tweens.add({ targets: key, x: to[0] * cs, y: to[1] * cs, duration: 60 * dist, onUpdate: draw, onComplete: () => {
        pos = to;
        sliding = false;
        draw();
        if (pos[0] === goal[0] && pos[1] === goal[1]) this.win(`Unlocked in ${moves} moves!`);
        else this.say(`Moves: ${moves}   Par: ${par}`);
      } });
    };
    draw();
    this.say(`Moves: 0   Par: ${par}`);
    // Arrow buttons in a cross under the board, and swipes on the board.
    const by = top + W + 18;
    for (const [label, d, dx, dy] of [['^', [0, -1], 0, 0], ['<', [-1, 0], -1, 1], ['v', [0, 1], 0, 1], ['>', [1, 0], 1, 1]]) {
      const b = uiButton(this, GAME_WIDTH / 2 - 26 + dx * 60, by + dy * 46, 52, 40, label, { onTap: () => move(d) });
      this.sheet.add(b.container);
    }
    const zone = this.add.zone(left, top, W, W).setOrigin(0).setInteractive();
    this.sheet.add(zone);
    let from = null;
    zone.on('pointerdown', (p) => (from = { x: p.x, y: p.y }));
    zone.on('pointerup', (p) => {
      if (!from) return;
      const dx = p.x - from.x;
      const dy = p.y - from.y;
      from = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
      move(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
    });
  }

  // ---- Picture Puzzle ----------------------------------------------------------------------------------------
  // The picture (120x120 art pixels): the dungeon wall with the door and torches, a goblin, a slime and a chest,
  // and four heroes, drawn from the game's own pixel data into one texture cut into grid x grid pieces.
  pictureTexture(grid) {
    const key = 'puzzle-picture';
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, 120, 120);
    const c = tex.context;
    const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    px(0, 0, 120, 120, '#1f1830');
    px(0, 0, 120, 46, '#120e1d');
    for (let y = 0; y < 46; y += 8) { px(0, y, 120, 1, '#2a2240'); for (let x = (y / 8) % 2 ? 0 : 6; x < 120; x += 12) px(x, y, 1, 8, '#2a2240'); }
    for (let y = 46; y < 120; y += 14) { px(0, y, 120, 1, '#2a2240'); for (let x = ((y - 46) / 14) % 2 ? 0 : 10; x < 120; x += 20) px(x, y, 1, 14, '#2a2240'); }
    px(48, 18, 24, 28, '#5a2f8a'); px(50, 16, 20, 2, '#5a2f8a'); px(52, 14, 16, 2, '#5a2f8a'); px(52, 20, 16, 26, '#3a1a5e'); px(59, 30, 2, 2, '#ffd84a');
    for (const x of [36, 82]) { px(x, 22, 2, 6, '#6b4a2a'); px(x - 1, 18, 4, 4, '#ff9a3c'); px(x, 17, 2, 2, '#ffe066'); }
    // A character drawn from its parts with its feet at (fx, fy), like Character does in the game.
    const drawDef = (def, fx, fy) => {
      for (const p of Object.values(def.parts)) {
        const art = partArt(p);
        const { w, h } = artSize(art);
        artPixels(art).forEach((row, y) => row.forEach((col, x) => {
          if (col !== null) px(Math.round(fx + p.x - w / 2 + x), Math.round(fy + p.y - h / 2 + y), 1, 1, '#' + col.toString(16).padStart(6, '0'));
        }));
      }
    };
    const hero = (id) => heroDefs.find((h) => h.id === id);
    drawDef(enemyDefs.goblin, 34, 68); drawDef(enemyDefs.slime, 84, 70); drawDef(roomProps.chest, 60, 61);
    drawDef(hero('knight'), 21, 113); drawDef(hero('rogue'), 46, 114); drawDef(hero('archer'), 70, 114); drawDef(hero('mage'), 95, 113);
    tex.refresh();
    const piece = 120 / grid;
    for (let i = 0; i < grid * grid; i++) tex.add(`p${i}`, 0, (i % grid) * piece, Math.floor(i / grid) * piece, piece, piece);
    return key;
  }

  makePicture() {
    const P = this.P;
    const N = P.grid;
    const key = this.pictureTexture(N);
    const scale = 2;
    const piece = (120 / N) * scale;
    const gap = 2;
    const W = N * piece + (N - 1) * gap;
    const left = Math.round((GAME_WIDTH - W) / 2);
    const top = STAGE_TOP + 30;
    const frame = this.add.graphics();
    this.sheet.add(frame);
    const paintFrame = (gold) => { frame.clear(); drawWindow(frame, left - 8, top - 8, W + 16, W + 16, { line: gold ? GOLD : UI.line }); };
    paintFrame(false);
    let order = shufflePieces(N * N);
    let sel = -1;
    let swaps = 0;
    const spots = order.map((_, i) => {
      const img = this.add.image(left + (i % N) * (piece + gap), top + Math.floor(i / N) * (piece + gap), key, `p${order[i]}`).setOrigin(0).setScale(scale).setInteractive();
      this.sheet.add(img);
      img.on('pointerdown', () => tap(i));
      return img;
    });
    const mark = this.add.graphics();
    this.sheet.add(mark);
    const draw = () => {
      spots.forEach((img, i) => img.setFrame(`p${order[i]}`));
      mark.clear();
      if (sel >= 0) mark.lineStyle(3, GOLD, 1).strokeRect(spots[sel].x + 1, spots[sel].y + 1, piece - 2, piece - 2);
    };
    const tap = (i) => {
      if (this.done) return;
      if (sel < 0) sel = i;
      else if (sel === i) sel = -1;
      else {
        order = swapPieces(order, sel, i);
        sel = -1;
        swaps++;
        sfx.play('puzzleSlide');
      }
      draw();
      if (pictureDone(order)) {
        paintFrame(true);
        this.win(`Done in ${swaps} swaps!`);
      } else this.say(`Swaps: ${swaps}`);
    };
    this.say('Swaps: 0');
    // Shallow floors: a PEEK button shows the whole picture while it is held (deeper: no peeking).
    if (P.showExample) {
      this.giveUp.container.x = GAME_WIDTH / 2 - 168;
      const full = this.add.image(left + (W - 120 * scale) / 2, top + (W - 120 * scale) / 2, key).setOrigin(0).setScale(scale).setVisible(false); // whole-number scale: crisp
      this.sheet.add(full);
      const peek = uiButton(this, GAME_WIDTH / 2 + 8, BUTTON_Y, 160, 44, 'Peek');
      peek.hit.on('pointerdown', () => full.setVisible(!this.done));
      peek.hit.on('pointerup', () => full.setVisible(false));
      peek.hit.on('pointerout', () => full.setVisible(false));
      this.sheet.add(peek.container);
    }
  }
}
