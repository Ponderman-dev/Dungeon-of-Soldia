import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SKILL_COLORS, UI } from '../config.js';
import { drawWindow, drawCursor, uiShift, uiText, drawFlatButton, buttonTextColor, pressable, pressDown } from '../entities/uiKit.js';
import pauseData from '../data/pause.json';
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
import { DEMO as DEMO_KIND, demoSquad } from './demoMode.js'; // a demo page's saved squad
const DEMO = !!DEMO_KIND;
const TESTER = import.meta.env.VITE_TESTER === '1'; // the playtest build for itch.io: no test buttons
import { loadProgress, saveProgress, isUnlocked, unlockedIds, newHeroes, describeRequirement, describeProgress, randomSquad } from '../systems/progress.js';
import * as sfx from '../audio/sfx.js';
import { slotsFrom, addToSlots, removeFromSlots, isFull, squadOrder } from '../systems/squadSlots.js';
import { squadLayouts, LAYOUTS, LAYOUT_KEYS, SQUAD_DEPTH } from './squad/squadLayouts.js';

// The interface look (config.js UI, entities/uiKit.js): black windows, white lines, Ironslab text (sizes 8 / 16 / 24 = 10 / 20 / 30px, see config.js fontGrid).
const INK = UI.text;
const MUTE = '#a8a8b8';
const FONT = UI.font;
const WALL_H = 200; // the back wall with the door, as on the battle floors
const DOOR_X = GAME_WIDTH / 2;
// THE SAME LOOK AS THE CAMP AND THE FIGHT (session 47, user): flat camp buttons (uiKit drawFlatButton), BEGIN DESCENT
// banded like EXPEDITION, CAMP / RANDOM in a dock (gold line + dark band, like the camp's tab bar), a title window top
// left like the fight's floor counter, the sound button where the fight's pause button is (pause.json buttons).
const SIDE = 24; // the gap to the screen sides (camp.json ui.side)
const BEGIN = { y: 672, h: 60 }; // the 'Begin descent' button, over the dock (screen review: thumb reach, the gate stays clear)
const DOCK = { y: 742, btnY: 754, btnH: 44, gap: 8, toolY: 808 }; // the dock: its gold line, CAMP / RANDOM, the test row
// Where the squad stands, how big, and the rest of the middle of the screen: the layout (squad/squadLayouts.js).
const WALK = combatRules.movement.walkSpeedPxPerSec * 1.6; // a bit quicker than in fights
const T = combatRules.transition;
const DEPTH = SQUAD_DEPTH;

// The squad select screen, drawn as the room at the dungeon's entrance: the squad of 3 stands in front of the gate
// (slot order = battle order). How the heroes are shown and picked = the layout (squad/squadLayouts.js, A / B / C,
// a trial until the user picks one). With all 3 slots filled 'Begin descent' shows; the squad walks into the gate.
export default class SquadScene extends Phaser.Scene {
  constructor() {
    super('Squad');
  }

  init(data) {
    this.lastRun = (data && data.lastRun) || null; // { floor, kills, newly: [hero ids unlocked by that run] }
    this.fromCamp = !!(data && data.fromCamp); // slid up from the camp: the buttons come in after the slide
  }

  create() {
    this.progress = loadProgress();
    this.newIds = newHeroes(heroDefs, this.progress, unlocks);
    const last = DEMO ? demoSquad.heroes.map((h) => h.id) : this.registry.get('squadIds') || this.progress.lastSquad || defaultSquad; // the demo page: its saved squad
    this.slots = slotsFrom(last, this.openIds());
    this.panel = null;
    this.leaving = this.descending = false;
    this.walkers = new Map(); // hero id -> tween of a hero that is walking
    this.layoutKey = DEMO ? 'A' : this.registry.get('squadLayout') || 'A';
    this.L = LAYOUTS[this.layoutKey];
    this.tiles = null; this.stageHero = null; this.counter = null; this.infoParts = []; this.infoKey = null;

    this.drawRoom();
    this.drawSlots();
    this.layoutParts = this[`build${this.layoutKey}`]();
    this.drawUi();
    this.shifting = false; // the menu is fading in or out (taps blocked by `leaving`, buttons still drawn)
    if (this.fromCamp) { // hidden until the slide up has ended; no taps before that
      this.leaving = this.shifting = true;
      uiShift(this, this.uiParts, false, { instant: true });
      this.time.delayedCall(UI.motion.slow, () => uiShift(this, this.uiParts, true, { onDone: () => { this.leaving = this.shifting = false; this.refresh(); } }));
    }

    // The squad's figures: each picked hero stands in its slot (the others wait hidden at their tile / the stage).
    this.figures = new Map();
    heroDefs.forEach((def) => {
      const ch = new Character(this, 0, 0, def).setDepth(DEPTH.hero).setVisible(false);
      const name = this.add.text(0, 0, def.name, { fontFamily: FONT, fontSize: '8px', color: INK, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(DEPTH.hero).setVisible(false);
      this.figures.set(def.id, { def, ch, name });
    });
    for (const f of this.figures.values()) {
      const s = this.slots.indexOf(f.def.id);
      if (s >= 0) this.size(f.ch.setPosition(this.L.slots[s].x, this.L.slots[s].y).setDepth(DEPTH.hero + this.L.slots[s].y / 10000), this.L.heroScale);
    }
    this.refresh();
    this.setupInput();
    this.events.on('update', this.follow, this);
    this.events.once('shutdown', () => {
      this.events.off('update', this.follow, this);
      this.input.off('pointerdown');
      this.input.off('pointermove');
      this.input.off('pointerup');
    });
  }

  size(ch, s) { return ch.setScale(Math.sign(ch.scaleX || 1) * s, s); } // keeps the facing

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
    // Each slot: a soft shadow on the floor; an empty one also has a faint pale ring and a small "+". Tapping a hero
    // standing in it: the layout's tapSlot. Layout C: a small "Send back" button under it.
    this.slotMarks = this.L.slots.map((s, i) => {
      const k = this.L.heroScale / 3;
      const shadow = this.add.ellipse(s.x, s.y, 64 * k, 16 * k, 0x000000, 0.28).setDepth(DEPTH.slot);
      const ring = this.add.ellipse(s.x, s.y, 58 * k, 14 * k).setStrokeStyle(1, 0xd8c8ff, 0.35).setDepth(DEPTH.slot);
      const num = this.add.text(s.x, s.y - 30, '+', { fontFamily: FONT, fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setDepth(DEPTH.slot).setAlpha(0.35);
      this.tweens.add({ targets: [ring, num], alpha: '-=0.15', duration: 1100 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.add.zone(s.x, s.y - 34 * k, 70 * k, 90 * k).setInteractive().setDepth(DEPTH.hero + 1).on('pointerdown', () => {
        const id = this.slots[i];
        if (id && !this.walkers.has(id) && !this.panel && !this.leaving) this.tapSlot(id);
      });
      if (!this.L.sendBack) return { shadow, ring, num, back: null };
      const back = this.add.container(s.x, s.y + 42).setDepth(DEPTH.ui);
      const bg = this.add.graphics();
      const redraw = (pressed) => drawFlatButton(bg.clear(), -52, -15, 104, 30, { pressed }); // roomy (user: more space between box and text); a flat button
      redraw(false);
      const label = this.add.text(0, 0, 'Send back', { fontFamily: FONT, fontSize: '8px', color: buttonTextColor() }).setOrigin(0.5);
      back.add([bg, label]);
      return { shadow, ring, num, back, backLook: { redraw, sink: [label] } };
    });
  }

  drawUi() {
    const n0 = this.children.list.length; // what drawUi adds: the top part, then the bottom part (for uiShift)
    // Sound on/off: a small pixel speaker icon top right (waves = on, a cross = off); saved in the progress.
    const PB = pauseData.buttons, sx = PB.pause.x + PB.pause.w / 2, sy = PB.y + PB.h / 2, P = 2; // centre: the fight's pause button spot; pixel size
    const soundBox = this.add.graphics().setDepth(DEPTH.ui);
    const drawBox = (pressed) => drawWindow(soundBox.clear(), PB.pause.x, PB.y, PB.pause.w, PB.h, pressed ? { fill: UI.pressed } : {});
    drawBox(false);
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
    this.soundBtn = this.add.zone(sx, sy, PB.pause.w + 4, PB.h + 8).setInteractive().setDepth(DEPTH.ui);
    pressable(this, this.soundBtn, { redraw: drawBox, sink: [this.soundIcon], onTap: () => {
      sfx.setMuted(!sfx.isMuted());
      this.progress.settings = { ...(this.progress.settings || {}), muted: sfx.isMuted() }; // keep the scene's copy of the save in step
      drawSound();
      sfx.play('tap');
    } });
    if (this.lastRun && (this.lastRun.newly || []).length) this.time.delayedCall(400, () => sfx.play('unlock'));
    // The title window top left (like the fight's floor counter): 'Squad n/3'; after a run a small line under it says
    // how deep that run got.
    drawWindow(this.add.graphics().setDepth(DEPTH.ui), 8, 8, 160, 32);
    this.titleText = uiText(this, 20, 25, '', 'normal').setOrigin(0, 0.5).setDepth(DEPTH.ui);
    if (this.lastRun) {
      drawWindow(this.add.graphics().setDepth(DEPTH.ui), 8, 44, 160, 24);
      uiText(this, 20, 57, `Last run: floor ${this.lastRun.floor}`, 'small', UI.gold).setOrigin(0, 0.5).setDepth(DEPTH.ui);
    }

    const n1 = this.children.list.length;
    // BEGIN DESCENT: the screen's main action, banded like the camp's EXPEDITION. Until the squad is full it is dim
    // and says how many heroes are still missing.
    const bw = GAME_WIDTH - 2 * SIDE, by = BEGIN.y + BEGIN.h / 2;
    this.begin = this.add.container(GAME_WIDTH / 2, by).setDepth(DEPTH.ui);
    const bg = this.add.graphics();
    const drawBegin = (pressed) => drawFlatButton(bg.clear(), -bw / 2, -BEGIN.h / 2, bw, BEGIN.h, { primary: true, bands: true, pressed, enabled: this.ready() });
    this.beginText = uiText(this, 0, 1, 'BEGIN DESCENT', 'big', buttonTextColor(true, false, true)).setOrigin(0.5);
    this.begin.add([bg, this.beginText]);
    this.drawBegin = drawBegin;
    pressable(this, this.add.zone(GAME_WIDTH / 2, by, bw, BEGIN.h).setInteractive().setDepth(DEPTH.ui), {
      redraw: drawBegin, sink: [this.beginText], onTap: () => this.descend(), enabled: () => this.ready() && this.begin.visible && !this.leaving && !this.panel,
    });

    // The dock (like the camp's tab bar): a gold line, a dark band, '< CAMP' (back to the camp hub) and RANDOM; the
    // test row at its foot.
    const T = UI.goldTheme;
    this.add.graphics().setDepth(DEPTH.ui).fillStyle(T.frame, 1).fillRect(0, DOCK.y, GAME_WIDTH, 2).fillStyle(T.outline, 0.9).fillRect(0, DOCK.y + 2, GAME_WIDTH, GAME_HEIGHT - DOCK.y);
    const dw = (GAME_WIDTH - 2 * SIDE - DOCK.gap) / 2;
    [['< CAMP', SIDE, () => this.toCamp()], ['RANDOM', SIDE + dw + DOCK.gap, () => this.pickRandom()]].forEach(([label, x, onTap]) => {
      const rb = this.add.graphics().setDepth(DEPTH.ui);
      const redraw = (pressed) => drawFlatButton(rb.clear(), x, DOCK.btnY, dw, DOCK.btnH, { pressed });
      redraw(false);
      const t = uiText(this, x + dw / 2, DOCK.btnY + DOCK.btnH / 2 - 1, label, 'normal', buttonTextColor()).setOrigin(0.5).setDepth(DEPTH.ui);
      pressable(this, this.add.zone(x + dw / 2, DOCK.btnY + DOCK.btnH / 2, dw, DOCK.btnH).setInteractive().setDepth(DEPTH.ui), { redraw, sink: [t], onTap, enabled: () => !this.leaving && !this.panel });
    });
    const shown = (list) => list.filter((o) => !(o instanceof Phaser.GameObjects.Zone));
    this.uiParts = { up: shown(this.children.list.slice(n0, n1)), fade: [...this.slotMarks.map((m) => m.back).filter(Boolean), ...shown(this.layoutParts)] };
    this.uiParts.down = shown(this.children.list.slice(n1)); // (the test toggle below joins it)
    if (TESTER || DEMO) return; // the playtest build (npm run build:itch) has no test toggle
    // LAYOUT TRIAL (session 47): a small button bottom left flips A -> B -> C (the screen starts again in it).
    const lay = this.smallButton(SIDE, DOCK.toolY, 96, 24, `LAYOUT ${this.layoutKey}`, () => {
      const next = LAYOUT_KEYS[(LAYOUT_KEYS.indexOf(this.layoutKey) + 1) % LAYOUT_KEYS.length];
      this.registry.set('squadLayout', next);
      this.scene.restart({ lastRun: this.lastRun });
    });
    this.uiParts.down.push(...lay.filter((o) => !(o instanceof Phaser.GameObjects.Zone)));
    this.toggleText = this.add.text(246, DOCK.toolY + 12, '', { fontFamily: FONT, fontSize: '8px', color: MUTE }).setOrigin(0.5).setDepth(DEPTH.ui).setAlpha(0.8);
    this.add.zone(246, DOCK.toolY + 12, 260, 28).setInteractive().setDepth(DEPTH.ui).on('pointerdown', () => this.toggleUnlockAll());
    this.uiParts.down.push(this.toggleText);
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

  isNew(id) {
    return this.lastRun ? (this.lastRun.newly || []).includes(id) : this.newIds.includes(id);
  }

  // Every frame: names (layout C) follow their hero.
  follow() {
    if (!this.L.names) return;
    for (const f of this.figures.values()) {
      const show = f.ch.visible && this.slots.includes(f.def.id) && !this.walkers.has(f.def.id) && !this.leaving;
      f.name.setVisible(show);
      if (show) f.name.setPosition(f.ch.x, f.ch.y + 13);
    }
  }

  refresh() {
    for (const f of this.figures.values()) {
      if (this.descending && this.slots.includes(f.def.id)) continue; // walking into the gate
      f.ch.setVisible(this.slots.includes(f.def.id) || this.walkers.has(f.def.id));
    }
    this.slots.forEach((id, i) => {
      const m = this.slotMarks[i];
      m.ring.setVisible(!id);
      m.num.setVisible(!id);
      if (m.back) m.back.setVisible(!!id && !this.walkers.has(id) && (!this.leaving || this.shifting)); // shifting: they fade with the menu
    });
    this.begin.setVisible(!this.leaving || this.shifting);
    this.drawBegin(false);
    const ready = this.ready(), missing = this.need() - squadOrder(this.slots).length;
    this.beginText.setText(ready ? 'BEGIN DESCENT' : `PICK ${missing} MORE`).setColor(buttonTextColor(ready, false, true));
    this.titleText.setText(`Squad ${squadOrder(this.slots).length}/${this.need()}`);
    this.refreshLayout();
    if (this.toggleText) this.toggleText.setText(`${this.progress.unlockAll ? '[X]' : '[ ]'} test: unlock every hero`).setColor(this.progress.unlockAll ? UI.green : MUTE);
  }

  // ---- input ---------------------------------------------------------------------------------

  // Scene-wide taps: layout C's 'Send back' buttons (pushed on finger down, sent back on release), layout B's swipe
  // on the stage. Everything else has its own tap zone.
  setupInput() {
    let swipe = null;
    this.input.on('pointerdown', (p) => {
      if (this.panel || this.leaving) return;
      if (this.layoutKey === 'B' && p.y > 150 && p.y < 300 && p.x > 50 && p.x < GAME_WIDTH - 50) swipe = { x: p.x };
      if (!this.L.sendBack) return;
      const S = this.L.slots;
      const back = S.findIndex((s, i) => this.slots[i] && Math.abs(p.x - s.x) < 52 && Math.abs(p.y - (s.y + 42)) < 16);
      if (back >= 0 && !this.walkers.has(this.slots[back])) this.pushing = { release: pressDown(this.slotMarks[back].backLook), id: this.slots[back], slot: back, at: this.time.now };
    });
    this.input.on('pointerup', (p) => {
      if (swipe) {
        const dx = p.x - swipe.x;
        swipe = null;
        if (Math.abs(dx) > 30 && !this.panel && !this.leaving) this.flip(dx < 0 ? 1 : -1);
      }
      if (!this.pushing) return;
      const { release, id, slot, at } = this.pushing, s = this.L.slots[slot];
      this.pushing = null;
      const on = Math.abs(p.x - s.x) < 52 && Math.abs(p.y - (s.y + 42)) < 16;
      const finish = () => { release(); if (on && this.slots[slot] === id && !this.walkers.has(id)) this.sendBack(id); };
      const wait = UI.press.holdMs - (this.time.now - at);
      if (wait > 0) this.time.delayedCall(wait, finish); else finish();
    });
  }

  // ---- walking -------------------------------------------------------------------------------

  // A hero walks to (x, y) at a steady pace with a little hop each step, then calls done.
  walk(f, x, y, done, toScale = null) {
    const ch = f.ch;
    const s0 = Math.abs(ch.scaleY);
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
        if (toScale) this.size(ch, s0 + (toScale - s0) * t);
        ch.setDepth(DEPTH.ui + 1 + ch.y / 10000); // over the panels and tiles while it walks (seen the whole way)
      },
      onComplete: () => {
        ch.setPosition(x, y).setDepth(DEPTH.hero + y / 10000);
        if (toScale) this.size(ch, toScale);
        ch.setWalking(false);
        ch.face(1);
        this.walkers.delete(f.def.id);
        if (done) done();
      },
    });
    this.walkers.set(f.def.id, tween);
  }

  // A picked hero comes out of its tile (or B's stage spot), growing to full size, and walks to its slot.
  choose(id) {
    sfx.play('heroPick');
    const s = addToSlots(this.slots, id);
    if (s < 0) return;
    const f = this.figures.get(id), home = this.homeOf(id), to = this.L.slots[s];
    f.ch.setPosition(home.x, home.y).setAlpha(1).setVisible(true);
    this.size(f.ch, home.scale);
    this.walk(f, to.x, to.y, () => this.refresh(), this.L.heroScale);
    this.refresh();
  }

  // A hero leaves the squad: walks back into its tile, shrinking (layout B: fades out where it stands).
  sendBack(id) {
    sfx.play('heroBack');
    if (removeFromSlots(this.slots, id) < 0) return;
    const f = this.figures.get(id);
    if (this.L.backFade) {
      const ch = f.ch;
      this.walkers.set(id, this.tweens.add({ targets: ch, alpha: 0, duration: UI.motion.fast, onComplete: () => { this.walkers.delete(id); ch.setAlpha(1); this.refresh(); } }));
    } else {
      const home = this.homeOf(id);
      this.walk(f, home.x, home.y, () => this.refresh(), home.scale);
    }
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
    const perk = this.perkLine(def);
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
    // The two card buttons push in when held (pressed fill + the label drops), and act on release (UI.press).
    const bg = put(this.add.graphics());
    const lt = text(GAME_WIDTH / 2, by + 25, label, 17, action ? INK : UI.dim, true).setOrigin(0.5);
    const cur = put(this.add.graphics());
    if (action) drawCursor(cur, Math.round(GAME_WIDTH / 2 - lt.width / 2 - 20), by + 24);
    const drawMain = (pressed) => drawWindow(bg.clear(), X + 16, by, W - 32, 48, { line: action ? UI.line : 0x4a4a5a, ...(pressed ? { fill: UI.pressed } : {}) });
    drawMain(false);
    const mainHit = add(this.add.zone(GAME_WIDTH / 2, by + 24, W - 32, 48).setInteractive());
    if (action) pressable(this, mainHit, { redraw: drawMain, sink: [lt, cur], enabled: () => this.panel === objs, onTap: () => { this.closePanel(); action(); } });
    else mainHit.on('pointerdown', () => this.closePanel()); // LOCKED: no push, a tap just closes the card
    // Close (X) in the corner, and a tap outside the card closes it too.
    const xb = put(this.add.graphics());
    const drawX = (pressed) => drawWindow(xb.clear(), X + W - 42, Y + 10, 32, 32, pressed ? { fill: UI.pressed } : {});
    drawX(false);
    const xt = text(X + W - 26, Y + 27, 'X', 16, INK, true).setOrigin(0.5);
    pressable(this, add(this.add.zone(X + W - 26, Y + 26, 48, 48).setInteractive()), {
      redraw: drawX, sink: [xt], enabled: () => this.panel === objs, onTap: () => { sfx.play('cardClose'); this.closePanel(); },
    });

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
    this.leaving = this.shifting = true;
    sfx.play('tap');
    uiShift(this, this.uiParts, false, { onDone: () => this.slideToCamp() }); // the buttons leave first
  }

  slideToCamp() {
    const base = this.scene.get('Base');
    base.events.once(Phaser.Scenes.Events.CREATE, () => {
      const cam = base.cameras.main, mine = this.cameras.main, ms = UI.motion.slow;
      cam.scrollY = -GAME_HEIGHT; // the camp starts just below this screen
      this.tweens.add({ targets: cam, scrollY: 0, duration: ms, ease: UI.motion.easeMove });
      this.tweens.add({ targets: mine, scrollY: GAME_HEIGHT, duration: ms, ease: UI.motion.easeMove, onComplete: () => this.scene.stop() });
    });
    this.scene.launch('Base', { fromSquad: true });
  }

  descend() {
    if (!this.ready() || this.panel || this.leaving || this.walkers.size) return;
    sfx.play('descend');
    this.leaving = this.shifting = this.descending = true;
    uiShift(this, this.uiParts, false); // every button leaves (user: not only BEGIN DESCENT)
    const ids = squadOrder(this.slots);
    this.progress.lastSquad = [...ids];
    this.progress.seenUnlocked = this.openIds(); // the NEW tags are gone next time
    saveProgress(this.progress);
    this.registry.set('squadIds', [...ids]);
    this.refresh();
    this.door.open();
    const doorY = WALL_H - 10;
    const gather = { x: DOOR_X, y: Math.max(doorY + 40, Math.min(...this.L.slots.map((s) => s.y)) - 24) };
    this.infoParts.forEach((o) => this.tweens.add({ targets: o, alpha: 0, duration: UI.motion.fast })); // the info panel goes with the menu
    if (this.stageHero) this.tweens.add({ targets: [this.stageHero, this.stageShadow], alpha: 0, duration: UI.motion.fast });
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
          this.size(f.ch, this.L.heroScale * Phaser.Math.Clamp(0.55 + 0.45 * ((y - doorY) / (this.L.slots[0].y - doorY)), 0.55, 1));
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

Object.assign(SquadScene.prototype, squadLayouts);
