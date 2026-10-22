import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CHAR_SCALE, SKILL_COLORS, UI } from '../config.js';
import { drawWindow, drawCursor } from '../entities/uiKit.js';
import Character from '../entities/Character.js';
import Door from '../entities/Door.js';
import { skillIconKey } from '../entities/skillIconTexture.js';
import floorArt from '../data/floorArt.json';
import { floorTextureKey, FLOOR_PIXEL } from '../entities/floorTexture.js';
import { layerTexture } from '../entities/pixelLayer.js';
import { torchLayers } from '../systems/torchArt.js';
import heroDefs from '../data/heroes.json';
import skillDefs from '../data/skills.json';
import unlocks from '../data/unlocks.json';
import dungeons from '../data/dungeons.json';
import combatRules from '../data/combat.json';
import defaultSquad from '../data/squad.json';
import demoSquad from '../data/demoSquad.json'; // the Monster House demo page's saved squad
import camp from '../data/camp.json'; // slideMs: the slide back down to the camp
const DEMO = import.meta.env.VITE_DEMO === 'house';
const TESTER = import.meta.env.VITE_TESTER === '1'; // the playtest build for itch.io: no test buttons
import { perkMods } from '../systems/party.js';
import { loadProgress, saveProgress, isUnlocked, unlockedIds, newHeroes, describeRequirement, describeProgress, randomSquad } from '../systems/progress.js';
import * as sfx from '../audio/sfx.js';
import { slotsFrom, addToSlots, removeFromSlots, isFull, squadOrder } from '../systems/squadSlots.js';

// The interface look (config.js UI, entities/uiKit.js): black windows, white lines, Ironslab text (sizes 8 / 16 / 24 = 10 / 20 / 30px, see config.js fontGrid).
const INK = UI.text;
const MUTE = '#a8a8b8';
const FONT = UI.font;
const WALL_H = 200; // the back wall with the door, as on the battle floors
const DOOR_X = GAME_WIDTH / 2;
const BEGIN_Y = 700; // the 'Begin descent' button, at the bottom over RANDOM (screen review: thumb reach, the gate stays clear)
// Where the 3 picked heroes stand (their feet): the orange slots. Slot order = battle order.
const SLOTS = [{ x: 92, y: 392 }, { x: GAME_WIDTH / 2, y: 342 }, { x: GAME_WIDTH - 92, y: 392 }]; // the squad stands before the gate (screen review)
// The bench: every hero stands on a purple strip at the bottom that scrolls left and right.
const BENCH = { top: 476, bottom: 670, feetY: 620, firstX: 62, gap: 96, fadeFrom: 4, fadePx: 46 }; // fade: heroes fade out over fadePx before the screen edge
const WALK = combatRules.movement.walkSpeedPxPerSec * 1.6; // a bit quicker than in fights
const T = combatRules.transition;
const STAT_SHORT = { attack: 'ATK', health: 'HP', defense: 'DEF', resist: 'RES', evasion: 'EVA', crit: 'CRIT', attackEfficiency: 'SPD' };
const DEPTH = { floor: 0, slot: 1, bench: 2, hero: 5, doorFront: 8, ui: 20, panel: 40 };

// The squad select screen, drawn as the room at the dungeon's entrance (user's sketch):
// all heroes stand on a purple bench at the bottom (drag it left/right). Tap one to see the big
// details card (kit, perk, tips) with a "Choose" button; a chosen hero walks up to the next empty
// orange slot. Tap a hero in a slot to send it back. With all 3 slots filled a "Begin descent"
// button appears at the bottom; the squad walks into the door and the run starts.
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
    const last = DEMO ? demoSquad.heroes.map((h) => h.id) : this.registry.get('squadIds') || this.progress.lastSquad || defaultSquad; // the demo page: its saved squad
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
      const name = this.add.text(0, 0, def.name, { fontFamily: FONT, fontSize: '8px', color: INK, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(DEPTH.hero);
      const tag = this.add.text(0, 0, 'NEW', { fontFamily: FONT, fontSize: '8px', color: '#000000', backgroundColor: '#6ee07a', padding: { x: 3, y: 2 } }).setOrigin(0.5, 1).setDepth(DEPTH.hero + 1);
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
    this.add.image(0, 0, floorTextureKey(this, dungeons.A.tileColors[0], 0, WALL_H)).setOrigin(0).setScale(FLOOR_PIXEL).setDepth(DEPTH.floor); // as on the battle floors
    // The door into the dungeon: closed until the squad sets off.
    this.door = new Door(this, this.add.container(0, 0).setDepth(DEPTH.floor), DOOR_X, WALL_H, { big: true }); // the dungeon entrance
    // Two torches on the pillars beside the door: pixel art (systems/torchArt.js), the flame flickers by switching frames.
    const T = floorArt.torch, L = torchLayers(T), P = FLOOR_PIXEL;
    const img = (lay, key, x, y) => this.add.image(x, y, layerTexture(this, key, lay)).setOrigin(lay.ax / lay.w, lay.ay / lay.h).setScale(P).setDepth(DEPTH.floor);
    const flameKeys = L.flames.map((f, i) => layerTexture(this, `torch-flame-${i}`, f));
    for (const x of floorArt.pillars.x.map((ax) => ax * P)) { // on the two pillars
      const y = WALL_H - 33 * P; // the top of the handle
      const glow = img(L.glow, 'torch-glow', x, y);
      this.tweens.add({ targets: glow, alpha: 0.75, duration: 300 + Math.random() * 120, yoyo: true, repeat: -1 });
      img(L.holder, 'torch-holder', x, y);
      const flame = img(L.flames[0], 'torch-flame-0', x, y);
      let f = Math.floor(Math.random() * flameKeys.length);
      this.time.addEvent({ delay: T.frameMs, loop: true, callback: () => { f = (f + 1 + Math.floor(Math.random() * 2)) % flameKeys.length; flame.setTexture(flameKeys[f]); } });
    }
  }

  drawSlots() {
    // Each slot: a soft shadow on the floor; an empty one also has a faint pale ring and a small "+".
    this.slotMarks = SLOTS.map((s, i) => {
      const shadow = this.add.ellipse(s.x, s.y, 64, 16, 0x000000, 0.28).setDepth(DEPTH.slot);
      const ring = this.add.ellipse(s.x, s.y, 58, 14).setStrokeStyle(1, 0xd8c8ff, 0.35).setDepth(DEPTH.slot);
      const num = this.add.text(s.x, s.y - 30, '+', { fontFamily: FONT, fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setDepth(DEPTH.slot).setAlpha(0.35);
      this.tweens.add({ targets: [ring, num], alpha: '-=0.15', duration: 1100 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      // A small "Send back" button under a filled slot (the hero walks back to the bench).
      const back = this.add.container(s.x, s.y + 42).setDepth(DEPTH.ui);
      const bg = this.add.graphics();
      drawWindow(bg, -52, -15, 104, 30); // roomy (user: more space between box and text)
      back.add([bg, this.add.text(0, 0, 'Send back', { fontFamily: FONT, fontSize: '8px', color: INK }).setOrigin(0.5)]);
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
      const t = this.add.text(x, BENCH.feetY - 34, dir < 0 ? '<' : '>', { fontFamily: FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(0.5).setDepth(DEPTH.ui);
      return { dir, t };
    });
  }

  drawUi() {
    // Sound on/off: a small pixel speaker icon top right (waves = on, a cross = off); saved in the progress.
    const sx = GAME_WIDTH - 30, sy = TESTER ? 30 : 92, P = 2; // centre (under the TEST buttons when they are there), pixel size
    drawWindow(this.add.graphics().setDepth(DEPTH.ui), sx - 18, sy - 18, 36, 36);
    this.soundIcon = this.add.graphics().setDepth(DEPTH.ui);
    const px = (g, x, y, w = 1, h = 1) => g.fillRect(sx + x * P, sy + y * P, w * P, h * P); // on a 2px grid around the centre
    const drawSound = () => {
      const g = this.soundIcon.clear(), off = sfx.isMuted();
      g.fillStyle(Phaser.Display.Color.HexStringToColor(off ? UI.dim : INK).color, 1);
      px(g, -6, -2, 3, 4); // the box
      px(g, -3, -3, 1, 6); px(g, -2, -4, 1, 8); px(g, -1, -5, 1, 10); // the cone
      if (off) { for (let i = 0; i < 5; i++) { px(g, 2 + i, -2 + i); px(g, 6 - i, -2 + i); } } // a cross
      else { px(g, 1, -1, 1, 2); px(g, 3, -3, 1, 1); px(g, 4, -2, 1, 4); px(g, 3, 2, 1, 1); px(g, 5, -5, 1, 1); px(g, 6, -4, 1, 8); px(g, 5, 4, 1, 1); } // sound waves
    };
    drawSound();
    this.soundBtn = this.add.zone(sx, sy, 44, 44).setInteractive().setDepth(DEPTH.ui);
    this.soundBtn.on('pointerdown', () => {
      sfx.setMuted(!sfx.isMuted());
      this.progress.settings = { ...(this.progress.settings || {}), muted: sfx.isMuted() }; // keep the scene's copy of the save in step
      drawSound();
      sfx.play('tap');
    });
    if (this.lastRun && (this.lastRun.newly || []).length) this.time.delayedCall(400, () => sfx.play('unlock'));
    // One short line at the top after a run: how deep it got (no 'Choose 3 heroes' hint any more, user 2026-10-20).
    if (this.lastRun) {
      drawWindow(this.add.graphics().setDepth(DEPTH.ui), 8, 8, 196, 26);
      this.add.text(20, 21, `Last run: floor ${this.lastRun.floor}`, { fontFamily: FONT, fontSize: '8px', color: UI.gold }).setOrigin(0, 0.5).setDepth(DEPTH.ui);
    }

    // "Begin descent": only when all 3 slots are filled, at the bottom over RANDOM.
    this.begin = this.add.container(DOOR_X, BEGIN_Y).setDepth(DEPTH.ui);
    const bg = this.add.graphics();
    drawWindow(bg, -150, -28, 300, 56);
    const cur = drawCursor(this.add.graphics(), -128, 0); // the blinking ▶ cursor: everything is ready
    this.time.addEvent({ delay: 500, loop: true, callback: () => cur.setVisible(!cur.visible) });
    this.begin.add([bg, cur, this.add.text(8, 1, 'BEGIN DESCENT', { fontFamily: FONT, fontSize: '16px', color: INK }).setOrigin(0.5)]);
    this.add.zone(DOOR_X, BEGIN_Y, 300, 56).setInteractive().setDepth(DEPTH.ui).on('pointerdown', () => this.descend());

    // The bottom row: '< CAMP' (back to the camp hub, user: at the bottom for the flow) and RANDOM; then the small test
    // toggle at the very bottom.
    const rb = this.add.graphics().setDepth(DEPTH.ui);
    [['< CAMP', 30, () => this.toCamp()], ['RANDOM', GAME_WIDTH - 180, () => this.pickRandom()]].forEach(([label, x, onTap]) => {
      drawWindow(rb, x, 744, 150, 46);
      this.add.text(x + 75, 767, label, { fontFamily: FONT, fontSize: '16px', color: INK }).setOrigin(0.5).setDepth(DEPTH.ui);
      this.add.zone(x + 75, 767, 150, 46).setInteractive().setDepth(DEPTH.ui).on('pointerdown', onTap);
    });
    if (TESTER) return; // the playtest build (npm run build:itch) has no test toggle
    this.toggleText = this.add.text(GAME_WIDTH / 2, 818, '', { fontFamily: FONT, fontSize: '8px', color: MUTE }).setOrigin(0.5).setDepth(DEPTH.ui).setAlpha(0.8);
    this.add.zone(GAME_WIDTH / 2, 818, 260, 28).setInteractive().setDepth(DEPTH.ui).on('pointerdown', () => this.toggleUnlockAll());
  }

  // ---- state ---------------------------------------------------------------------------------

  openIds() {
    if (DEMO) return heroDefs.map((h) => h.id); // the demo page: every hero open (its saved squad may hold locked ones)
    return unlockedIds(heroDefs, this.progress, unlocks);
  }

  unlocked(id) {
    return DEMO || isUnlocked(id, this.progress, unlocks);
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
      // Near the bench's ends a hero fades out (it slides off smoothly instead of popping away).
      const fade = Phaser.Math.Clamp((Math.min(x, GAME_WIDTH - x) - BENCH.fadeFrom) / BENCH.fadePx, 0, 1);
      // An empty spot shows where a picked hero will come back to.
      if (fade > 0) this.benchSpots.fillStyle(0x000000, (onBench ? 0.28 : 0.14) * fade).fillEllipse(x, BENCH.feetY, 50, 13); // a soft shadow (faint = its hero is in a slot)
      if (this.leaving && this.slots.includes(f.def.id)) continue; // walking into the door: descend() darkens, fades and hides it
      if (onBench) f.ch.setPosition(x, BENCH.feetY);
      f.name.setPosition(f.ch.x, f.ch.y + (inSlot ? 13 : 9)).setVisible(!this.walkers.has(f.def.id) && !(this.leaving && this.slots.includes(f.def.id)));
      f.name.setColor(inSlot ? INK : this.unlocked(f.def.id) ? '#d0d0dc' : '#6a6a7a');
      f.tag.setPosition(f.ch.x, f.ch.y - f.def.height * CHAR_SCALE - 4);
      const a = onBench ? fade : 1;
      f.ch.setVisible(a > 0).setAlpha(a);
      f.name.setVisible(f.name.visible && a > 0).setAlpha(a);
      f.tag.setAlpha(a);
    }
    // Pager dots under the rug: where the bench is scrolled to.
    const pages = Math.ceil(heroDefs.length / 3);
    const at = this.maxScroll() ? Math.round((this.scroll / this.maxScroll()) * (pages - 1)) : 0;
    this.pager.clear();
    for (let i = 0; i < pages; i++) this.pager.fillStyle(i === at ? 0xffffff : 0x4a4a5a, 1).fillRect(GAME_WIDTH / 2 + (i - (pages - 1) / 2) * 12 - 3, BENCH.bottom - 15, 6, 6); // square pixel dots
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
    if (this.toggleText) this.toggleText.setText(`${this.progress.unlockAll ? '[X]' : '[ ]'} test: unlock every hero`).setColor(this.progress.unlockAll ? UI.green : MUTE);
  }

  // ---- input ---------------------------------------------------------------------------------

  setupInput() {
    let drag = null;
    this.input.on('pointerdown', (p) => {
      if (this.panel || this.leaving) return;
      if (p.y >= BENCH.top && p.y <= BENCH.bottom) drag = { x: p.x, y: p.y, scroll: this.scroll, moved: 0 };
      else {
        // The small "Send back" button under a slot.
        const back = SLOTS.findIndex((s, i) => this.slots[i] && Math.abs(p.x - s.x) < 52 && Math.abs(p.y - (s.y + 42)) < 16);
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
    drawWindow(g, X, Y, W, H);
    // Portrait: the hero big in an inner window on the dungeon floor colour.
    drawWindow(g, X + 12, Y + 12, W - 24, 150, { fill: 0x14101f });
    g.fillStyle(0x000000, 0.35).fillEllipse(GAME_WIDTH / 2, Y + 142, 120, 22);
    const big = put(new Character(this, GAME_WIDTH / 2, Y + 142, def).setScale(5));
    if (!open) big.setWash(0x05030a, 0.92);
    // Every size lands on the font's 8px grid: big titles 24, names 16, the rest 8.
    const text = (x, y, str, size, color, bold = false, wrap = 0) => put(this.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size >= 24 ? 24 : size >= 14 ? 16 : 8}px`, color, wordWrap: wrap ? { width: wrap, useAdvancedWrap: true } : undefined, lineSpacing: size >= 14 ? 6 : 4 }));
    const element = ['fire', 'holy', 'dark', 'ice', 'electric'].includes(def.damageType) ? ` - ${def.damageType}` : '';
    text(GAME_WIDTH / 2, Y + 178, def.name, 24, INK, true).setOrigin(0.5, 0);
    text(GAME_WIDTH / 2, Y + 210, `${def.role || ''} - ${def.damageType === 'melee' ? 'melee' : 'ranged'}${element}`.toUpperCase(), 11, UI.gold, true).setOrigin(0.5, 0);
    const perk = perkMods({ def, level: 1 }).map((m) => `${m.percent !== undefined ? `+${m.percent}%` : `+${m.flat}`} ${STAT_SHORT[m.stat] || ({ skillDamage: 'skill dmg', regen: 'HP/s', dotDamage: 'DoT dmg' })[m.special] || m.special}`).join(', ');
    text(GAME_WIDTH / 2, Y + 230, `${def.summary || ''}  Team: ${perk}`, 12, MUTE, false, W - 48).setOrigin(0.5, 0).setAlign('center');

    // Passive, attack skill, support skill: its pixel icon (skillIcons.json; passive in a gold frame, skills in a
    // red / green window like the fight buttons) + name + what it does. No icon: the old coloured letter badge.
    let y = Y + 280;
    const row = (iconId, badge, color, name, extra, body) => {
      const key = skillIconKey(this, iconId, badge === 'P');
      if (key && badge === 'P') put(this.add.image(X + 16, y, key).setOrigin(0).setScale(2));
      else if (key) {
        drawWindow(g, X + 16, y, 40, 40, { line: color });
        put(this.add.image(X + 36, y + 20, key).setScale(2));
      } else {
        g.fillStyle(color, 1).fillRect(X + 16, y, 22, 22); // a square coloured badge: P passive, A attack, S support
        text(X + 27, y + 12, badge, 8, '#000000', true).setOrigin(0.5);
      }
      const tx = key ? X + 66 : X + 48;
      const n = text(tx, y + 3, name, 14, INK, true, W - (tx - X) - 16);
      const b = text(tx, n.y + n.height + 8, extra ? `${extra}. ${body}` : body, 12, '#d0d0dc', false, W - (tx - X) - 16);
      y = Math.max(b.y + b.height, key ? y + 40 : 0) + 16;
    };
    const atk = skillDefs[def.skills.attack];
    const sup = skillDefs[def.skills.support];
    row(`passive_${def.id}`, 'P', 0xffd84a, def.passive.name, '', def.passive.description);
    row(def.skills.attack, 'A', SKILL_COLORS.attack.ready, atk.name, `Cooldown ${atk.cooldownMs / 1000}s`, atk.description);
    row(def.skills.support, 'S', SKILL_COLORS.support.ready, sup.name, `Cooldown ${sup.cooldownMs / 1000}s`, sup.description);
    // One tip is enough here.
    // The button at the bottom.
    const by = Y + H - 64;
    if (def.tips && def.tips.length) {
      const tip = text(X + 16, y + 6, `Tip: ${def.tips[0]}`, 12, UI.gold, false, W - 32);
      // Only when it fits above the button (and the unlock line of a locked hero); a long card skips it.
      if (tip.y + tip.height > by - (open ? 10 : 34)) tip.destroy();
      else g.fillStyle(0xffffff, 1).fillRect(X + 16, y - 6, W - 32, 2); // a white pixel rule
    }
    let label;
    let action = null;
    if (!open) {
      const req = unlocks.requirements[id];
      label = 'LOCKED';
      text(GAME_WIDTH / 2, by - 22, req ? `${describeRequirement(req, unlocks)}  (${describeProgress(req, this.progress, unlocks)})` : '', 13, UI.gold, true).setOrigin(0.5);
    } else if (picked) {
      label = 'SEND BACK';
      action = () => this.sendBack(id);
    } else if (full) {
      // Squad full: choosing still works, the hero in the last slot walks back to the bench (user's choice).
      const out = this.slots[this.slots.length - 1];
      label = 'CHOOSE';
      text(GAME_WIDTH / 2, by - 22, `${heroDefs.find((h) => h.id === out).name} goes back to the bench.`, 12, MUTE, true).setOrigin(0.5);
      action = () => { this.sendBack(out); this.choose(id); };
    } else {
      label = 'CHOOSE';
      action = () => this.choose(id);
    }
    drawWindow(g, X + 16, by, W - 32, 48, { line: action ? UI.line : 0x4a4a5a });
    const lt = text(GAME_WIDTH / 2, by + 25, label, 17, action ? INK : UI.dim, true).setOrigin(0.5);
    if (action) drawCursor(g, Math.round(GAME_WIDTH / 2 - lt.width / 2 - 20), by + 24);
    add(this.add.zone(GAME_WIDTH / 2, by + 24, W - 32, 48).setInteractive()).on('pointerdown', () => {
      this.closePanel();
      if (action) action();
    });
    // Close (X) in the corner, and a tap outside the card closes it too.
    drawWindow(g, X + W - 42, Y + 10, 32, 32);
    text(X + W - 26, Y + 27, 'X', 16, INK, true).setOrigin(0.5);
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
  // '< CAMP': the screen slides down back into the camp hub (the reverse of BaseScene.toExpedition).
  toCamp() {
    if (this.panel || this.leaving) return;
    this.leaving = true;
    sfx.play('tap');
    const base = this.scene.get('Base');
    base.events.once(Phaser.Scenes.Events.CREATE, () => {
      const cam = base.cameras.main, mine = this.cameras.main, ms = camp.ui.slideMs;
      cam.scrollY = -GAME_HEIGHT; // the camp starts just below this screen
      this.tweens.add({ targets: cam, scrollY: 0, duration: ms, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: mine, scrollY: GAME_HEIGHT, duration: ms, ease: 'Sine.easeInOut', onComplete: () => this.scene.stop() });
    });
    this.scene.launch('Base');
  }

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
    const A = floorArt.door.anim;
    const doorOpenMs = A.rattleMs + A.swingMs + A.bounceMs; // until the gate has slammed open
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
        delay: doorOpenMs + T.squadEnter.waitMs + i * T.squadEnter.staggerMs, // the gate swings open, a beat of waiting, then in
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
          const left = Phaser.Math.Clamp(((1 - tw.getValue()) * total) / T.doorFadePx, 0, 1); // 1 -> 0 over the last doorFadePx
          f.ch.setWash(0x000000, Math.round((1 - left) * T.doorDarken * 10) / 10); // goes dark in the doorway's shadow
          f.ch.setAlpha(Phaser.Math.Clamp(left * T.doorFadeLate, 0, 1)); // then fades out
        },
        onComplete: () => {
          f.ch.setVisible(false);
          if (--left === 0) {
            this.cameras.main.fadeOut(T.squadEnter.fadeMs, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Battle'));
          }
        },
      });
    });
  }
}
