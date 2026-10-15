import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CHAR_SCALE } from '../config.js';
import Character from '../entities/Character.js';
import Door from '../entities/Door.js';
import heroDefs from '../data/heroes.json';
import skillDefs from '../data/skills.json';
import unlocks from '../data/unlocks.json';
import dungeons from '../data/dungeons.json';
import combatRules from '../data/combat.json';
import defaultSquad from '../data/squad.json';
import { perkMods } from '../systems/party.js';
import { loadProgress, saveProgress, isUnlocked, unlockedIds, newHeroes, describeRequirement, describeProgress, randomSquad } from '../systems/progress.js';
import * as sfx from '../audio/sfx.js';
import { slotsFrom, addToSlots, removeFromSlots, isFull, squadOrder } from '../systems/squadSlots.js';

const INK = '#f3eefc';
const MUTE = '#9a8fb8';
const FONT = 'system-ui, Arial, sans-serif';
const GOLD = 0xf2b632;
const ORANGE = 0xff8a3d;
const PURPLE = 0x8b55d6;
const WALL_H = 200; // the back wall with the door, as on the battle floors
const DOOR_X = GAME_WIDTH / 2;
// Where the 3 picked heroes stand (their feet): the orange slots. Slot order = battle order.
const SLOTS = [{ x: 92, y: 420 }, { x: GAME_WIDTH / 2, y: 362 }, { x: GAME_WIDTH - 92, y: 420 }];
// The bench: every hero stands on a purple strip at the bottom that scrolls left and right.
const BENCH = { top: 548, bottom: 742, feetY: 692, firstX: 62, gap: 96 };
const WALK = combatRules.movement.walkSpeedPxPerSec * 1.6; // a bit quicker than in fights
const T = combatRules.transition;
const STAT_SHORT = { attack: 'ATK', health: 'HP', defense: 'DEF', resist: 'RES', evasion: 'EVA', crit: 'CRIT', attackEfficiency: 'SPD' };
const DEPTH = { floor: 0, slot: 1, bench: 2, hero: 5, doorFront: 8, ui: 20, panel: 40 };

// The squad select screen, drawn as the room at the dungeon's entrance (user's sketch):
// all heroes stand on a purple bench at the bottom (drag it left/right). Tap one to see the big
// details card (kit, perk, tips) with a "Choose" button; a chosen hero walks up to the next empty
// orange slot. Tap a hero in a slot to send it back. With all 3 slots filled a "Begin descent"
// button appears over the door; the squad walks into the door and the run starts.
// Locked heroes are dark on the bench; their card shows how to unlock them.
export default class SquadScene extends Phaser.Scene {
  constructor() {
    super('Squad');
  }

  init(data) {
    this.lastRun = (data && data.lastRun) || null; // { floor, kills, newly: [hero ids unlocked by that run] }
  }

  create() {
    this.progress = loadProgress();
    this.newIds = newHeroes(heroDefs, this.progress, unlocks);
    const last = this.registry.get('squadIds') || this.progress.lastSquad || defaultSquad;
    this.slots = slotsFrom(last, this.openIds());
    this.scroll = 0;
    this.panel = null;
    this.leaving = false;
    this.walkers = new Map(); // hero id -> tween of a hero that is walking

    this.drawRoom();
    this.drawSlots();
    this.drawBench();
    this.drawUi();

    // Every hero figure: on the bench, or standing in its slot.
    this.figures = new Map();
    heroDefs.forEach((def, i) => {
      const ch = new Character(this, 0, 0, def).setDepth(DEPTH.hero);
      const name = this.add.text(0, 0, def.name, { fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: INK }).setOrigin(0.5, 0).setDepth(DEPTH.hero);
      const tag = this.add.text(0, 0, 'NEW', { fontFamily: FONT, fontSize: '9px', fontStyle: 'bold', color: '#14101f', backgroundColor: '#6dff8f', padding: { x: 3, y: 1 } }).setOrigin(0.5, 1).setDepth(DEPTH.hero + 1);
      this.figures.set(def.id, { def, ch, name, tag, benchIndex: i });
    });
    for (const f of this.figures.values()) {
      const s = this.slots.indexOf(f.def.id);
      if (s >= 0) f.ch.setPosition(SLOTS[s].x, SLOTS[s].y);
    }
    this.refresh();
    this.setupInput();
    this.events.on('update', this.placeBench, this);
    this.events.once('shutdown', () => {
      this.events.off('update', this.placeBench, this);
      this.input.off('pointerdown');
      this.input.off('pointermove');
      this.input.off('pointerup');
    });
  }

  // ---- drawing -------------------------------------------------------------------------------

  drawRoom() {
    const base = Number(dungeons.A.tileColors[0]);
    const line = Phaser.Display.Color.ValueToColor(base).brighten(10).color;
    const wall = Phaser.Display.Color.ValueToColor(base).darken(25).color;
    const g = this.add.graphics().setDepth(DEPTH.floor);
    g.fillStyle(base, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(wall, 1).fillRect(0, 0, GAME_WIDTH, WALL_H);
    g.lineStyle(1, line, 0.6);
    for (const [top, bottom, rowH, brickW] of [[WALL_H, GAME_HEIGHT, 44, 78], [0, WALL_H, 25, 50]]) {
      let row = 0;
      for (let y = top; y <= bottom; y += rowH, row++) {
        g.lineBetween(0, y, GAME_WIDTH, y);
        for (let x = (row % 2) * (brickW / 2); x < GAME_WIDTH; x += brickW) g.lineBetween(x, y, x, Math.min(y + rowH, bottom));
      }
    }
    // The door into the dungeon: closed until the squad sets off.
    this.door = new Door(this, this.add.container(0, 0).setDepth(DEPTH.floor), DOOR_X, WALL_H);
    // Two torches beside the door.
    for (const x of [DOOR_X - 70, DOOR_X + 70]) {
      g.fillStyle(0x5a3a22, 1).fillRect(x - 3, WALL_H - 90, 6, 18);
      const flame = this.add.ellipse(x, WALL_H - 96, 10, 14, 0xffb347).setDepth(DEPTH.floor);
      this.tweens.add({ targets: flame, scaleY: 1.25, scaleX: 0.85, alpha: 0.8, duration: 180 + Math.random() * 120, yoyo: true, repeat: -1 });
    }
  }

  drawSlots() {
    // Each slot: a soft shadow on the floor; an empty one also has a faint pale ring and a small "+".
    this.slotMarks = SLOTS.map((s, i) => {
      const shadow = this.add.ellipse(s.x, s.y, 64, 16, 0x000000, 0.28).setDepth(DEPTH.slot);
      const ring = this.add.ellipse(s.x, s.y, 58, 14).setStrokeStyle(1, 0xd8c8ff, 0.35).setDepth(DEPTH.slot);
      const num = this.add.text(s.x, s.y - 30, '+', { fontFamily: FONT, fontSize: '22px', color: '#d8c8ff' }).setOrigin(0.5).setDepth(DEPTH.slot).setAlpha(0.35);
      this.tweens.add({ targets: [ring, num], alpha: '-=0.15', duration: 1100 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      // A small "Send back" button under a filled slot (the hero walks back to the bench).
      const back = this.add.container(s.x, s.y + 42).setDepth(DEPTH.ui);
      const bg = this.add.graphics();
      bg.fillStyle(0x14101f, 0.75).fillRoundedRect(-34, -10, 68, 20, 10).lineStyle(1, 0x6f5a9a, 1).strokeRoundedRect(-34, -10, 68, 20, 10);
      back.add([bg, this.add.text(0, 0, 'Send back', { fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: '#cfc6e6' }).setOrigin(0.5)]);
      return { shadow, ring, num, back };
    });
  }

  drawBench() {
    // The heroes simply stand in a row on the floor (no box around them).
    this.pager = this.add.graphics().setDepth(DEPTH.ui);
    this.benchSpots = this.add.graphics().setDepth(DEPTH.bench);
    // Arrows at both ends (also tappable).
    this.arrows = [-1, 1].map((dir) => {
      const x = dir < 0 ? 22 : GAME_WIDTH - 22;
      const t = this.add.text(x, BENCH.feetY - 34, dir < 0 ? '‹' : '›', { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#c9a8ff' }).setOrigin(0.5).setDepth(DEPTH.ui);
      return { dir, t };
    });
  }

  drawUi() {
    // Sound on/off (small, under the test button); saved in the progress.
    const sx = GAME_WIDTH - 30, sy = 56;
    this.soundBtn = this.add.text(sx, sy, '', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#cfc6e6', backgroundColor: '#1d1530', padding: { x: 8, y: 4 } }).setOrigin(1, 0.5).setDepth(DEPTH.ui);
    const drawSound = () => this.soundBtn.setText(sfx.isMuted() ? '♪ off' : '♪ on').setAlpha(sfx.isMuted() ? 0.6 : 1);
    drawSound();
    this.soundBtn.setInteractive().on('pointerdown', () => {
      sfx.setMuted(!sfx.isMuted());
      this.progress.settings = { ...(this.progress.settings || {}), muted: sfx.isMuted() }; // keep the scene's copy of the save in step
      drawSound();
      sfx.play('tap');
    });
    if (this.lastRun && (this.lastRun.newly || []).length) this.time.delayedCall(400, () => sfx.play('unlock'));
    // One short line at the top: the last run, or what to do.
    const info = this.lastRun ? `Last run: floor ${this.lastRun.floor}` : 'Choose 3 heroes';
    this.add.text(14, 19, info, { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: this.lastRun ? '#f2b632' : INK }).setDepth(DEPTH.ui).setShadow(0, 2, '#000000', 2, false, true);

    // "Begin descent": only when all 3 slots are filled, over the door.
    this.begin = this.add.container(DOOR_X, 96).setDepth(DEPTH.ui);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.35).fillRoundedRect(-104, -16, 208, 42, 21);
    bg.fillStyle(0xc0532a, 1).fillRoundedRect(-104, -21, 208, 42, 21);
    bg.fillStyle(0xe0743a, 1).fillRoundedRect(-98, -18, 196, 16, 8); // shine
    bg.lineStyle(2, GOLD, 1).strokeRoundedRect(-104, -21, 208, 42, 21);
    this.begin.add([bg, this.add.text(0, 0, 'BEGIN DESCENT', { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setShadow(0, 2, '#5a1e0e', 0, false, true)]);
    this.beginPulse = this.tweens.add({ targets: this.begin, scale: { from: 1, to: 1.06 }, duration: 520, yoyo: true, repeat: -1 });
    this.add.zone(DOOR_X, 96, 230, 50).setInteractive().setDepth(DEPTH.ui).on('pointerdown', () => this.descend());

    // RANDOM under the bench, and the small test toggle at the very bottom.
    const rb = this.add.graphics().setDepth(DEPTH.ui);
    rb.fillStyle(0x3a2a62, 1).fillRoundedRect(GAME_WIDTH / 2 - 64, 756, 128, 34, 17).lineStyle(2, PURPLE, 1).strokeRoundedRect(GAME_WIDTH / 2 - 64, 756, 128, 34, 17);
    this.add.text(GAME_WIDTH / 2, 773, 'RANDOM', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: INK }).setOrigin(0.5).setDepth(DEPTH.ui);
    this.add.zone(GAME_WIDTH / 2, 773, 140, 40).setInteractive().setDepth(DEPTH.ui).on('pointerdown', () => this.pickRandom());
    this.toggleText = this.add.text(GAME_WIDTH / 2, 818, '', { fontFamily: FONT, fontSize: '11px', color: MUTE }).setOrigin(0.5).setDepth(DEPTH.ui).setAlpha(0.8);
    this.add.zone(GAME_WIDTH / 2, 818, 260, 28).setInteractive().setDepth(DEPTH.ui).on('pointerdown', () => this.toggleUnlockAll());
  }

  // ---- state ---------------------------------------------------------------------------------

  openIds() {
    return unlockedIds(heroDefs, this.progress, unlocks);
  }

  unlocked(id) {
    return isUnlocked(id, this.progress, unlocks);
  }

  need() {
    return Math.min(3, this.openIds().length);
  }

  ready() {
    return squadOrder(this.slots).length === this.need();
  }

  maxScroll() {
    return Math.max(0, BENCH.firstX * 2 + (heroDefs.length - 1) * BENCH.gap - GAME_WIDTH);
  }

  benchX(f) {
    return BENCH.firstX + f.benchIndex * BENCH.gap - this.scroll;
  }

  // Every frame: bench heroes follow the scroll; names and tags follow their hero.
  placeBench() {
    this.benchSpots.clear();
    for (const f of this.figures.values()) {
      const x = this.benchX(f);
      const onBench = !this.slots.includes(f.def.id) && !this.walkers.has(f.def.id);
      const inSlot = this.slots.includes(f.def.id) && !this.walkers.has(f.def.id);
      // An empty spot shows where a picked hero will come back to.
      if (x > -40 && x < GAME_WIDTH + 40) this.benchSpots.fillStyle(0x000000, onBench ? 0.28 : 0.14).fillEllipse(x, BENCH.feetY, 50, 13); // a soft shadow (faint = its hero is in a slot)
      if (onBench) f.ch.setPosition(x, BENCH.feetY);
      f.name.setPosition(f.ch.x, f.ch.y + (inSlot ? 13 : 9)).setVisible(!this.walkers.has(f.def.id) && !(this.leaving && this.slots.includes(f.def.id)));
      f.name.setColor(inSlot ? INK : this.unlocked(f.def.id) ? '#cfc6e6' : '#6f6890');
      f.tag.setPosition(f.ch.x, f.ch.y - f.def.height * CHAR_SCALE - 4);
      // Heroes on the bench only show inside it (the strip is narrower than the screen).
      const hidden = onBench && (x < 14 || x > GAME_WIDTH - 14);
      f.ch.setVisible(!hidden);
      f.name.setVisible(f.name.visible && !hidden);
    }
    // Pager dots under the rug: where the bench is scrolled to.
    const pages = Math.ceil(heroDefs.length / 3);
    const at = this.maxScroll() ? Math.round((this.scroll / this.maxScroll()) * (pages - 1)) : 0;
    this.pager.clear();
    for (let i = 0; i < pages; i++) this.pager.fillStyle(i === at ? 0xc9a8ff : 0x5a4785, 1).fillCircle(GAME_WIDTH / 2 + (i - (pages - 1) / 2) * 12, BENCH.bottom - 12, 3);
    for (const a of this.arrows) a.t.setAlpha((a.dir < 0 ? this.scroll > 1 : this.scroll < this.maxScroll() - 1) ? 1 : 0.2);
  }

  refresh() {
    for (const f of this.figures.values()) {
      const open = this.unlocked(f.def.id);
      f.ch.setWash(0x05030a, open ? 0 : 0.92); // locked = a dark shape
      const isNew = open && (this.lastRun ? (this.lastRun.newly || []).includes(f.def.id) : this.newIds.includes(f.def.id));
      f.tag.setVisible(isNew && !this.slots.includes(f.def.id));
      f.name.setText(open ? f.def.name : '? ? ?');
    }
    this.slots.forEach((id, i) => {
      const m = this.slotMarks[i];
      m.ring.setVisible(!id);
      m.num.setVisible(!id);
      m.back.setVisible(!!id && !this.walkers.has(id) && !this.leaving);
    });
    const ready = this.ready() && !this.leaving;
    this.begin.setVisible(ready);
    this.toggleText.setText(`${this.progress.unlockAll ? '☑' : '☐'} test: unlock every hero`).setColor(this.progress.unlockAll ? '#6dff8f' : MUTE);
  }

  // ---- input ---------------------------------------------------------------------------------

  setupInput() {
    let drag = null;
    this.input.on('pointerdown', (p) => {
      if (this.panel || this.leaving) return;
      if (p.y >= BENCH.top && p.y <= BENCH.bottom) drag = { x: p.x, y: p.y, scroll: this.scroll, moved: 0 };
      else {
        // The small "Send back" button under a slot.
        const back = SLOTS.findIndex((s, i) => this.slots[i] && Math.abs(p.x - s.x) < 40 && Math.abs(p.y - (s.y + 42)) < 16);
        if (back >= 0 && !this.walkers.has(this.slots[back])) return this.sendBack(this.slots[back]);
        // A hero standing in a slot: tap to see its card.
        const hit = SLOTS.findIndex((s) => Math.abs(p.x - s.x) < 44 && p.y > s.y - 86 && p.y < s.y + 30);
        if (hit >= 0 && this.slots[hit] && !this.walkers.has(this.slots[hit])) this.openPanel(this.slots[hit]);
      }
    });
    this.input.on('pointermove', (p) => {
      if (!drag || !p.isDown) return;
      drag.moved = Math.max(drag.moved, Math.abs(p.x - drag.x));
      this.scroll = Phaser.Math.Clamp(drag.scroll - (p.x - drag.x), 0, this.maxScroll());
    });
    this.input.on('pointerup', (p) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (d.moved > 10) return; // it was a drag
      const arrow = this.arrows.find((a) => Math.abs(p.x - a.t.x) < 22 && Math.abs(p.y - a.t.y) < 30);
      if (arrow) return this.scrollBy(arrow.dir * BENCH.gap * 3);
      // The bench hero nearest to the tap.
      let best = null;
      let bestD = BENCH.gap / 2;
      for (const f of this.figures.values()) {
        if (this.slots.includes(f.def.id) || this.walkers.has(f.def.id)) continue;
        const dx = Math.abs(this.benchX(f) - p.x);
        if (dx < bestD) { best = f; bestD = dx; }
      }
      if (best) this.openPanel(best.def.id);
    });
  }

  scrollBy(dx) {
    sfx.play('scroll');
    const to = Phaser.Math.Clamp(this.scroll + dx, 0, this.maxScroll());
    this.tweens.add({ targets: this, scroll: to, duration: 260, ease: 'Quad.easeOut' });
  }

  // ---- walking -------------------------------------------------------------------------------

  // A hero walks to (x, y) at a steady pace with a little hop each step, then calls done.
  walk(f, x, y, done) {
    const ch = f.ch;
    if (this.walkers.has(f.def.id)) this.walkers.get(f.def.id).stop();
    const from = { x: ch.x, y: ch.y };
    const dist = Math.hypot(x - from.x, y - from.y);
    ch.face(x < from.x ? -1 : 1);
    ch.setWalking(true);
    const tween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: Math.max(1, (dist / WALK) * 1000),
      onUpdate: (tw) => {
        const t = tw.getValue();
        const hop = Math.abs(Math.sin(((t * dist) / T.stepLenPx) * Math.PI)) * T.stepHeight;
        ch.setPosition(from.x + (x - from.x) * t, from.y + (y - from.y) * t - hop);
        ch.setDepth(DEPTH.hero + ch.y / 10000);
      },
      onComplete: () => {
        ch.setPosition(x, y).setDepth(DEPTH.hero + y / 10000);
        ch.setWalking(false);
        ch.face(1);
        this.walkers.delete(f.def.id);
        if (done) done();
      },
    });
    this.walkers.set(f.def.id, tween);
  }

  choose(id) {
    sfx.play('heroPick');
    const s = addToSlots(this.slots, id);
    if (s < 0) return;
    const f = this.figures.get(id);
    f.ch.setPosition(this.benchX(f), BENCH.feetY);
    this.walk(f, SLOTS[s].x, SLOTS[s].y, () => this.refresh());
    this.refresh();
  }

  sendBack(id) {
    sfx.play('heroBack');
    if (removeFromSlots(this.slots, id) < 0) return;
    const f = this.figures.get(id);
    // Scroll so its bench spot is on screen, then it walks there.
    const spot = BENCH.firstX + f.benchIndex * BENCH.gap;
    if (spot - this.scroll < 40 || spot - this.scroll > GAME_WIDTH - 40) this.scroll = Phaser.Math.Clamp(spot - GAME_WIDTH / 2, 0, this.maxScroll());
    this.walk(f, this.benchX(f), BENCH.feetY, () => this.refresh());
    this.refresh();
  }

  pickRandom() {
    if (this.panel || this.leaving) return;
    sfx.play('tap');
    const pick = randomSquad(this.openIds());
    for (const id of [...this.slots]) if (id && !pick.includes(id)) this.sendBack(id);
    // Keep the ones that were picked again where they stand; the rest walk up.
    for (const id of pick) if (!this.slots.includes(id)) this.choose(id);
  }

  toggleUnlockAll() {
    if (this.panel || this.leaving) return;
    sfx.play('tap');
    this.progress.unlockAll = !this.progress.unlockAll;
    saveProgress(this.progress);
    for (const id of [...this.slots]) if (id && !this.unlocked(id)) this.sendBack(id); // locked heroes can't stay picked
    this.refresh();
  }

  // ---- the details card ----------------------------------------------------------------------

  openPanel(id) {
    const def = heroDefs.find((h) => h.id === id);
    const open = this.unlocked(id);
    const picked = this.slots.includes(id);
    const full = isFull(this.slots);
    const objs = [];
    const add = (o) => { objs.push(o.setDepth(DEPTH.panel)); return o; };
    const X = 16;
    const W = GAME_WIDTH - 32;
    const Y = 40;
    const H = GAME_HEIGHT - Y - 16;
    add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05030a, 0.8)).setInteractive(); // blocks taps behind
    const card = this.add.container(0, 0).setDepth(DEPTH.panel);
    const put = (o) => { card.add(o); return o; };
    objs.push(card);
    const g = put(this.add.graphics());
    g.fillStyle(0x000000, 0.4).fillRoundedRect(X + 3, Y + 6, W, H, 20);
    g.fillStyle(0x1b1430, 1).fillRoundedRect(X, Y, W, H, 20).lineStyle(2, 0x4a3878, 1).strokeRoundedRect(X, Y, W, H, 20);
    // Portrait: the hero big on a little lit stage.
    g.fillStyle(0x2b2046, 1).fillRoundedRect(X + 12, Y + 12, W - 24, 150, 14);
    g.fillStyle(ORANGE, 0.16).fillEllipse(GAME_WIDTH / 2, Y + 142, 120, 26);
    const big = put(new Character(this, GAME_WIDTH / 2, Y + 142, def).setScale(5));
    if (!open) big.setWash(0x05030a, 0.92);
    const text = (x, y, str, size, color, bold = false, wrap = 0) => put(this.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color, wordWrap: wrap ? { width: wrap } : undefined, lineSpacing: 3 }));
    const element = ['fire', 'holy', 'dark', 'ice', 'electric'].includes(def.damageType) ? ` · ${def.damageType}` : '';
    text(GAME_WIDTH / 2, Y + 178, def.name, 24, INK, true).setOrigin(0.5, 0);
    text(GAME_WIDTH / 2, Y + 210, `${def.role || ''} · ${def.damageType === 'melee' ? 'melee' : 'ranged'}${element}`.toUpperCase(), 11, '#ffb27a', true).setOrigin(0.5, 0);
    const perk = perkMods({ def, level: 1 }).map((m) => `${m.percent !== undefined ? `+${m.percent}%` : `+${m.flat}`} ${STAT_SHORT[m.stat] || ({ skillDamage: 'skill dmg', regen: 'HP/s', dotDamage: 'DoT dmg' })[m.special] || m.special}`).join(', ');
    text(GAME_WIDTH / 2, Y + 230, `${def.summary || ''}  Team: ${perk}`, 12, MUTE, false, W - 48).setOrigin(0.5, 0).setAlign('center');

    // Passive, attack skill, support skill: a coloured badge + name + what it does.
    let y = Y + 280;
    const row = (badge, color, name, extra, body) => {
      g.fillStyle(color, 1).fillRoundedRect(X + 16, y, 22, 22, 6);
      text(X + 27, y + 11, badge, 12, '#14101f', true).setOrigin(0.5);
      text(X + 48, y + 3, name, 14, INK, true);
      if (extra) text(X + W - 16, y + 5, extra, 10, MUTE, true).setOrigin(1, 0);
      const b = text(X + 48, y + 23, body, 12, '#cfc6e6', false, W - 64);
      y = b.y + b.height + 14;
    };
    const atk = skillDefs[def.skills.attack];
    const sup = skillDefs[def.skills.support];
    row('P', 0xf2d66b, def.passive.name, 'passive', def.passive.description);
    row('A', 0xff9a7a, atk.name, `${atk.cooldownMs / 1000}s`, atk.description);
    row('S', 0x8ee6a8, sup.name, `${sup.cooldownMs / 1000}s`, sup.description);
    // One tip is enough here.
    if (def.tips && def.tips.length) {
      g.lineStyle(1, 0x3a2f57, 1).lineBetween(X + 16, y - 4, X + W - 16, y - 4);
      text(X + 16, y + 6, `Tip: ${def.tips[0]}`, 12, '#c9a8ff', false, W - 32);
    }

    // The button at the bottom.
    const by = Y + H - 64;
    let label;
    let color;
    let action = null;
    if (!open) {
      const req = unlocks.requirements[id];
      label = 'LOCKED';
      color = 0x3a3350;
      text(GAME_WIDTH / 2, by - 22, req ? `${describeRequirement(req, unlocks)}  (${describeProgress(req, this.progress, unlocks)})` : '', 13, '#ffd9a0', true).setOrigin(0.5);
    } else if (picked) {
      label = 'SEND BACK';
      color = 0x6b2f3a;
      action = () => this.sendBack(id);
    } else if (full) {
      // Squad full: choosing still works, the hero in the last slot walks back to the bench (user's choice).
      const out = this.slots[this.slots.length - 1];
      label = 'CHOOSE';
      color = 0x2f9a55;
      text(GAME_WIDTH / 2, by - 22, `${heroDefs.find((h) => h.id === out).name} goes back to the bench.`, 12, MUTE, true).setOrigin(0.5);
      action = () => { this.sendBack(out); this.choose(id); };
    } else {
      label = 'CHOOSE';
      color = 0x2f9a55;
      action = () => this.choose(id);
    }
    g.fillStyle(color, 1).fillRoundedRect(X + 16, by, W - 32, 48, 24);
    if (action) g.lineStyle(2, GOLD, 1).strokeRoundedRect(X + 16, by, W - 32, 48, 24);
    text(GAME_WIDTH / 2, by + 24, label, 17, action ? '#ffffff' : '#8a82a8', true).setOrigin(0.5);
    add(this.add.zone(GAME_WIDTH / 2, by + 24, W - 32, 48).setInteractive()).on('pointerdown', () => {
      this.closePanel();
      if (action) action();
    });
    // Close (X) in the corner, and a tap outside the card closes it too.
    g.fillStyle(0x14101f, 0.8).fillCircle(X + W - 26, Y + 26, 15);
    text(X + W - 26, Y + 26, '✕', 16, INK, true).setOrigin(0.5);
    add(this.add.zone(X + W - 26, Y + 26, 48, 48).setInteractive()).on('pointerdown', () => { sfx.play('cardClose'); this.closePanel(); });

    this.panel = objs;
    sfx.play('cardOpen');
    // The card slides up a little and fades in.
    card.setAlpha(0).setY(30);
    this.tweens.add({ targets: card, alpha: 1, y: 0, duration: 200, ease: 'Quad.easeOut' });
    objs[0].setAlpha(0);
    this.tweens.add({ targets: objs[0], alpha: 1, duration: 160 });
  }

  closePanel() {
    if (!this.panel) return;
    for (const o of this.panel) o.destroy();
    this.panel = null;
  }

  // ---- start the run -------------------------------------------------------------------------

  // The squad walks into the door one after another (smaller as they go deeper), then the run starts.
  descend() {
    if (!this.ready() || this.panel || this.leaving || this.walkers.size) return;
    sfx.play('descend');
    this.leaving = true;
    const ids = squadOrder(this.slots);
    this.progress.lastSquad = [...ids];
    this.progress.seenUnlocked = this.openIds(); // the NEW tags are gone next time
    saveProgress(this.progress);
    this.registry.set('squadIds', [...ids]);
    this.refresh();
    this.door.open();
    const doorY = WALL_H - 10;
    const gather = { x: DOOR_X, y: 300 };
    let left = ids.length;
    ids.forEach((id, i) => {
      const f = this.figures.get(id);
      f.name.setVisible(false);
      const start = { x: f.ch.x, y: f.ch.y };
      const pts = [start, gather, { x: DOOR_X, y: doorY }];
      const lens = [Math.hypot(gather.x - start.x, gather.y - start.y), gather.y - doorY];
      const total = lens[0] + lens[1];
      f.ch.setWalking(true);
      this.tweens.addCounter({
        from: 0,
        to: 1,
        delay: 450 + i * 380, // the doors swing open first
        duration: (total / WALK) * 1000,
        onUpdate: (tw) => {
          let d = tw.getValue() * total;
          const k = d > lens[0] ? 1 : 0;
          if (k) d -= lens[0];
          const t = lens[k] ? d / lens[k] : 1;
          const x = pts[k].x + (pts[k + 1].x - pts[k].x) * t;
          const y = pts[k].y + (pts[k + 1].y - pts[k].y) * t;
          const hop = Math.abs(Math.sin(((tw.getValue() * total) / T.stepLenPx) * Math.PI)) * T.stepHeight;
          f.ch.setPosition(x, y - hop).setDepth(DEPTH.hero + y / 10000);
          f.ch.setScale(CHAR_SCALE * Phaser.Math.Clamp(0.55 + 0.45 * ((y - doorY) / (SLOTS[0].y - doorY)), 0.55, 1));
          f.ch.setAlpha(Phaser.Math.Clamp(((1 - tw.getValue()) * total) / T.doorFadePx, 0, 1)); // fades out in the doorway
        },
        onComplete: () => {
          f.ch.setVisible(false);
          if (--left === 0) {
            this.cameras.main.fadeOut(260, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Battle'));
          }
        },
      });
    });
  }
}
