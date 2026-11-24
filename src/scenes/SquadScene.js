import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SKILL_COLORS, UI } from '../config.js';
import { drawWindow, drawCursor, uiShift, uiText, drawFlatButton, buttonTextColor, pressable, prepareScreen, dropScreen, slideToScreen, whenScreenReady } from '../entities/uiKit.js';
import pauseData from '../data/pause.json';
import Character from '../entities/Character.js';
import Door from '../entities/Door.js';
import { skillIconKey } from '../entities/skillIconTexture.js';
import floorArt from '../data/floorArt.json';
import { floorTextureKey, FLOOR_PIXEL } from '../entities/floorTexture.js';
import { drawWallTorches } from '../entities/wallTorches.js';
import heroDefs from '../data/heroes.json';
import skillDefs from '../data/skills.json';
import unlocks from '../data/unlocks.json';
import dungeons from '../data/dungeons.json';
import combatRules from '../data/combat.json';
import defaultSquad from '../data/squad.json';
import campData from '../data/camp.json';
import { DEMO as DEMO_KIND, demoSquad } from './demoMode.js'; // a demo page's saved squad
const DEMO = !!DEMO_KIND;
// The SQUAD SCREEN DEMO page (npm run build:squad-demo, session 47): opens here like a new player (the test toggle
// opens every hero); BEGIN DESCENT walks into the gate and comes back here (no fight).
const SQUAD_DEMO = import.meta.env.VITE_SQUAD_DEMO === '1';
const TESTER = import.meta.env.VITE_TESTER === '1'; // the playtest build for itch.io: no test buttons
import { loadProgress, saveProgress, isUnlocked, unlockedIds, newHeroes, describeRequirement, describeProgress, randomSquad, requirementProgress } from '../systems/progress.js';
import * as sfx from '../audio/sfx.js';
import * as music from '../audio/music.js';
import { slotsFrom, addToSlots, removeFromSlots, isFull, squadOrder } from '../systems/squadSlots.js';
import { squadGrid, squadLabel, SQUAD_VIEW, SQUAD_DEPTH } from './squad/squadGrid.js';
import { drawBeginButton, beginTextColor } from './squad/beginButton.js';

// The interface look (config.js UI, entities/uiKit.js): black windows, white lines, Ironslab text (sizes 8 / 16 / 24 = 10 / 20 / 30px, see config.js fontGrid).
const MUTE = '#a8a8b8';
const FONT = UI.font;
const WALL_H = 200; // the back wall with the door, as on the battle floors
const DOOR_X = GAME_WIDTH / 2;
// THE SAME LOOK AS THE CAMP AND THE FIGHT (session 47, user): flat camp buttons (uiKit drawFlatButton), BEGIN DESCENT
// banded like EXPEDITION, CAMP / RANDOM in a dock (gold line + dark band, like the camp's tab bar), a title window top
// left like the fight's floor counter, the sound button where the fight's pause button is (pause.json buttons).
const SIDE = 24; // the gap to the screen sides (camp.json ui.side)
const BEGIN = { y: 644, h: 76 }; // 'Begin descent': right under the hero row, bigger (user, session 47); lower with the row (session 48)
const DOCK = { y: 742, btnY: 754, btnH: 44, gap: 8, toolY: 808 }; // the dock: its gold line, CAMP / RANDOM, the test row
// Where the squad stands, how big, the names and the hero grid: squad/squadGrid.js (SQUAD_VIEW).
const WALK = combatRules.movement.walkSpeedPxPerSec * 1.6; // a bit quicker than in fights
const T = combatRules.transition;
const DEPTH = SQUAD_DEPTH;

// The squad select screen, drawn as the room at the dungeon's entrance: the squad of 3 stands in front of the gate
// (slot order = battle order) with their names and Send back buttons; under them every hero is a tile (squadGrid.js,
// the user's pick C of the session 47 trial); a tap opens the details card. A picked hero walks in from the side of the
// screen, a sent back one walks off it. With all 3 slots filled 'Begin descent' lights up; the squad walks into the gate.
export default class SquadScene extends Phaser.Scene {
  constructor() {
    super('Squad');
  }

  init(data) {
    this.lastRun = (data && data.lastRun) || null; // { floor, kills, newly: [hero ids unlocked by that run] }
    this.fromCamp = !!(data && data.fromCamp); // slid up from the camp: the buttons come in after the slide
  }

  create() {
    music.play('squad');
    this.progress = loadProgress();
    this.newIds = newHeroes(heroDefs, this.progress, unlocks);
    const last = DEMO ? demoSquad.heroes.map((h) => h.id) : this.registry.get('squadIds') || this.progress.lastSquad || defaultSquad; // the demo page: its saved squad
    this.slots = slotsFrom(last, this.openIds());
    this.panel = null;
    this.leaving = this.descending = false;
    this.walkers = new Map(); // hero id -> tween of a hero that is walking
    this.L = SQUAD_VIEW;
    this.tiles = null; this.gridParts = []; this.gridTabs = null; this.gridGlide = null; this.gridNudged = false; // (Phaser reuses the scene object)

    this.drawRoom();
    this.drawSlots();
    this.labelParts = this.buildLabels();
    this.buildGrid();
    this.drawUi();
    this.shifting = false; // the menu is fading in or out (taps blocked by `leaving`, buttons still drawn)
    this.nextScreen = null; // the camp built early (uiKit prepareScreen)
    if (this.fromCamp) { // hidden until the slide has ended (arrive); no taps before that
      this.leaving = this.shifting = true;
      uiShift(this, this.uiParts, false, { instant: true });
    }

    // The squad's figures: each picked hero stands in its slot (the others wait hidden off screen).
    this.figures = new Map();
    heroDefs.forEach((def) => {
      const ch = new Character(this, 0, 0, def).setDepth(DEPTH.hero).setVisible(false);
      this.figures.set(def.id, { def, ch });
    });
    for (const f of this.figures.values()) {
      const s = this.slots.indexOf(f.def.id);
      if (s >= 0) this.size(f.ch.setPosition(this.fromCamp ? this.sideX(s, false) : this.L.slots[s].x, this.L.slots[s].y).setDepth(DEPTH.hero + this.L.slots[s].y / 10000), this.L.heroScale);
    } // (from the camp the squad waits off the sides and walks in after the slide: arrive)
    this.refresh();
    this.setupInput();
    this.events.once('shutdown', () => {
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
    // Two torches on the pillars beside the door (entities/wallTorches.js).
    drawWallTorches(this, WALL_H, (o) => o.setDepth(DEPTH.floor));
  }

  drawSlots() {
    // Each slot: a soft shadow on the floor; an empty one also has a faint pale ring and a small "+". A hero standing in
    // it has its name and a way to send it back under it (squadGrid buildLabels); tapping the hero opens its card.
    this.slotMarks = this.L.slots.map((s, i) => {
      const k = this.L.heroScale / 3;
      const shadow = this.add.ellipse(s.x, s.y, 64 * k, 16 * k, 0x000000, 0.28).setDepth(DEPTH.slot);
      const ring = this.add.ellipse(s.x, s.y, 58 * k, 14 * k).setStrokeStyle(1, 0xd8c8ff, 0.35).setDepth(DEPTH.slot);
      const num = this.add.text(s.x, s.y - 30, '+', { fontFamily: FONT, fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setDepth(DEPTH.slot).setAlpha(0.35);
      this.tweens.add({ targets: [ring, num], alpha: '-=0.15', duration: 1100 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.add.zone(s.x, s.y - 34 * k, 70 * k, 90 * k).setInteractive().setDepth(DEPTH.hero + 1).on('pointerdown', () => {
        const id = this.slots[i];
        if (id && !this.walkers.has(id) && !this.panel && !this.leaving) this.openPanel(id);
      });
      return { shadow, ring, num };
    });
  }

  drawUi() {
    const n0 = this.children.list.length; // what drawUi adds: the top part, then the bottom part (for uiShift)
    // Sound on/off: a small pixel speaker icon top right (waves = on, a cross = off); saved in the progress.
    const PB = pauseData.buttons, sx = PB.pause.x + PB.pause.w / 2, sy = PB.y + PB.h / 2, P = 2; // centre: the fight's pause button spot; pixel size
    const soundBox = this.add.graphics().setDepth(DEPTH.ui);
    const drawBox = (pressed) => drawWindow(soundBox.clear(), PB.pause.x, PB.y, PB.pause.w, PB.h, pressed ? { fill: UI.pressed, quiet: true } : { quiet: true });
    drawBox(false);
    this.soundIcon = this.add.graphics().setDepth(DEPTH.ui);
    const px = (g, x, y, w = 1, h = 1) => g.fillRect(sx + x * P, sy + y * P, w * P, h * P); // on a 2px grid around the centre
    const drawSound = () => {
      const g = this.soundIcon.clear(), off = sfx.isMuted();
      g.fillStyle(Phaser.Display.Color.HexStringToColor(off ? UI.dim : UI.text).color, 1);
      px(g, -6, -2, 3, 4); // the box
      px(g, -3, -3, 1, 6); px(g, -2, -4, 1, 8); px(g, -1, -5, 1, 10); // the cone
      if (off) { for (let i = 0; i < 5; i++) { px(g, 2 + i, -2 + i); px(g, 6 - i, -2 + i); } } // a cross
      else { px(g, 1, -1, 1, 2); px(g, 3, -3, 1, 1); px(g, 4, -2, 1, 4); px(g, 3, 2, 1, 1); px(g, 5, -5, 1, 1); px(g, 6, -4, 1, 8); px(g, 5, 4, 1, 1); } // sound waves
    };
    drawSound();
    this.soundBtn = this.add.zone(sx, sy, PB.pause.w + 4, PB.h + 8).setInteractive().setDepth(DEPTH.ui);
    pressable(this, this.soundBtn, { redraw: drawBox, sink: [this.soundIcon], onTap: () => {
      sfx.setMuted(!sfx.isMuted());
      music.refresh();
      this.progress.settings = { ...(this.progress.settings || {}), muted: sfx.isMuted() }; // keep the scene's copy of the save in step
      drawSound();
      sfx.play('tap');
    } });
    if (this.lastRun && (this.lastRun.newly || []).length) this.time.delayedCall(400, () => sfx.play('unlock'));
    // The title window top left (like the fight's floor counter): 'SQUAD n/3'; after a run a small line under it says
    // how deep that run got.
    drawWindow(this.add.graphics().setDepth(DEPTH.ui), 8, 8, 160, 32, { quiet: true });
    this.titleText = squadLabel(this, 20, 24, '', UI.text).setOrigin(0, 0.5).setDepth(DEPTH.ui);
    if (this.lastRun) {
      drawWindow(this.add.graphics().setDepth(DEPTH.ui), 8, 44, 160, 24, { quiet: true });
      uiText(this, 20, 57, `Last run: floor ${this.lastRun.floor}`, 'small', UI.gold).setOrigin(0, 0.5).setDepth(DEPTH.ui);
    }

    const n1 = this.children.list.length;
    // BEGIN DESCENT: the screen's main action, banded like the camp's EXPEDITION. Until the squad is full it is dim
    // and says how many heroes are still missing.
    // Its look: the gold design in crimson (squad/beginButton.js).
    const bw = GAME_WIDTH - 2 * SIDE, by = BEGIN.y + BEGIN.h / 2; // as wide as CAMP + RANDOM below it (user, session 54)
    this.begin = this.add.container(GAME_WIDTH / 2, by).setDepth(DEPTH.ui);
    const bg = this.add.graphics();
    this.beginText = uiText(this, 0, 1, 'BEGIN DESCENT', 'big', beginTextColor(true)).setOrigin(0.5);
    const drawBegin = (pressed) => {
      const ready = this.ready();
      drawBeginButton(bg.clear(), -bw / 2, -BEGIN.h / 2, bw, BEGIN.h, { pressed, enabled: ready });
      this.beginText.setColor(beginTextColor(ready));
    };
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
      const t = squadLabel(this, x + dw / 2, DOCK.btnY + DOCK.btnH / 2, label, buttonTextColor()).setOrigin(0.5).setDepth(DEPTH.ui);
      pressable(this, this.add.zone(x + dw / 2, DOCK.btnY + DOCK.btnH / 2, dw, DOCK.btnH).setInteractive().setDepth(DEPTH.ui), { redraw, sink: [t], onTap, enabled: () => !this.leaving && !this.panel,
        // '< CAMP': the camp is built while the finger holds (no hitch in the slide)
        ...(label === '< CAMP' ? { onDown: () => prepareScreen(this, 'Base', { fromSquad: true }, -GAME_HEIGHT), onCancel: () => dropScreen(this) } : {}) });
    });
    const shown = (list) => list.filter((o) => !(o instanceof Phaser.GameObjects.Zone));
    this.uiParts = { up: shown(this.children.list.slice(n0, n1)), fade: [...this.labelParts, ...shown(this.gridParts)] };
    this.uiParts.down = shown(this.children.list.slice(n1)); // (the test toggle below joins it)
    if (TESTER || DEMO) return; // the playtest build (npm run build:itch) and the fight demos have no test row
    this.toggleText = this.add.text(GAME_WIDTH / 2, DOCK.toolY + 12, '', { fontFamily: FONT, fontSize: '8px', color: MUTE }).setOrigin(0.5).setDepth(DEPTH.ui).setAlpha(0.8);
    this.add.zone(GAME_WIDTH / 2, DOCK.toolY + 12, 260, 28).setInteractive().setDepth(DEPTH.ui).onPress(() => this.toggleUnlockAll());
    this.uiParts.down.push(this.toggleText);
  }

  // ---- state ---------------------------------------------------------------------------------

  openIds() {
    if (DEMO) return heroDefs.map((h) => h.id); // the fight demo pages: every hero open (its saved squad may hold locked ones)
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

  refresh() {
    for (const f of this.figures.values()) {
      if (this.descending && this.slots.includes(f.def.id)) continue; // walking into the gate
      f.ch.setVisible(this.slots.includes(f.def.id) || this.walkers.has(f.def.id));
    }
    this.slots.forEach((id, i) => {
      const m = this.slotMarks[i];
      m.ring.setVisible(!id);
      m.num.setVisible(!id);
    });
    this.begin.setVisible(!this.leaving || this.shifting);
    const ready = this.ready(), missing = this.need() - squadOrder(this.slots).length;
    this.beginText.setText(ready ? 'BEGIN DESCENT' : `PICK ${missing} MORE`);
    this.drawBegin(false);
    this.titleText.setText(`SQUAD ${squadOrder(this.slots).length}/${this.need()}`);
    if (this.tiles) for (const t of this.tiles.values()) t.draw();
    this.drawNames();
    if (this.toggleText) this.toggleText.setText(`${this.progress.unlockAll ? '[X]' : '[ ]'} test: unlock every hero`).setColor(this.progress.unlockAll ? UI.green : MUTE);
  }

  // ---- input ---------------------------------------------------------------------------------

  // Every tap has its own tap zone (tiles, slots, the X buttons, the dock); scene-wide only the hero row's swipe.
  setupInput() {
    this.input.on('pointerdown', (p) => this.gridDown(p)); // swiping the hero row (squadGrid.js)
    this.input.on('pointermove', (p) => this.gridMove(p));
    this.input.on('pointerup', () => this.gridUp());
  }

  // ---- walking -------------------------------------------------------------------------------

  // A hero walks to (x, y) at a steady pace with a little hop each step, then calls done.
  walk(f, x, y, done, speed = WALK) {
    const ch = f.ch;
    if (this.walkers.has(f.def.id)) this.walkers.get(f.def.id).stop();
    const from = { x: ch.x, y: ch.y };
    const dist = Math.hypot(x - from.x, y - from.y);
    ch.face(x < from.x ? -1 : 1);
    ch.setWalking(true);
    const tween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: Math.max(1, (dist / speed) * 1000),
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

  // The screen edge a slot's hero walks in from / off to (user, session 47: 'walk in from the side'): the left slot
  // the left edge, the right slot the right edge, the middle one comes in from the left and leaves to the right.
  sideX(slot, leaving) {
    const s = this.L.slots[slot], off = this.L.sideOffPx;
    const right = s.x > GAME_WIDTH / 2 || (s.x === GAME_WIDTH / 2 && leaving);
    return right ? GAME_WIDTH + off : -off;
  }

  // A picked hero walks in from the side of the screen to its slot.
  choose(id) {
    sfx.play('heroPick');
    const s = addToSlots(this.slots, id);
    if (s < 0) return;
    const f = this.figures.get(id), to = this.L.slots[s];
    f.ch.setPosition(this.sideX(s, false), to.y).setAlpha(1).setVisible(true);
    this.size(f.ch, this.L.heroScale);
    this.walk(f, to.x, to.y, () => this.refresh());
    this.refresh();
  }

  // A hero leaves the squad: walks off the side of the screen (then waits hidden).
  sendBack(id) {
    const slot = this.slots.indexOf(id);
    if (slot < 0) return;
    sfx.play('heroBack');
    removeFromSlots(this.slots, id);
    const f = this.figures.get(id);
    this.walk(f, this.sideX(slot, true), f.ch.y, () => this.refresh());
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
    this.uiParts.fade = this.uiParts.fade.filter((o) => !this.gridParts.includes(o));
    this.buildGrid(); // which heroes have tiles changes
    this.uiParts.fade.push(...this.gridParts.filter((o) => !(o instanceof Phaser.GameObjects.Zone)));
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
    // A LOCKED hero's card shows nothing of its kit (user, session 47): a smaller card, centred, with only its grey
    // shape, '? ? ?', how to unlock it and a progress bar (SQUAD_VIEW.lockedCard).
    const LC = this.L.lockedCard;
    const H = open ? GAME_HEIGHT - 40 - 16 : LC.h;
    const Y = open ? 40 : Math.round((GAME_HEIGHT - LC.h) / 2);
    add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05030a, 0.8)).setInteractive(); // blocks taps behind
    const card = this.add.container(0, 0).setDepth(DEPTH.panel);
    const put = (o) => { card.add(o); return o; };
    objs.push(card);
    const g = put(this.add.graphics());
    drawWindow(g, X, Y, W, H);
    // Portrait: the hero big in an inner window on the dungeon floor colour.
    drawWindow(g, X + 12, Y + 12, W - 24, open ? this.L.card.portraitH : 150, { fill: 0x14101f }); // shorter for an open hero: room for the text
    const feet = open ? Y + this.L.card.portraitH - 6 : Y + 142;
    g.fillStyle(0x000000, 0.35).fillEllipse(GAME_WIDTH / 2, feet, open ? 72 : 120, open ? 14 : 22);
    const big = put(new Character(this, GAME_WIDTH / 2, feet, def).setScale(open ? this.L.card.heroScale : 5));
    if (!open) big.setWash(this.L.lockedWash, 1);
    // Every size lands on the font's 8px grid: big titles 24, names 16, the rest 8.
    const text = (x, y, str, size, color, bold = false, wrap = 0) => put(this.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size >= 24 ? 24 : size >= 14 ? 16 : 8}px`, color, wordWrap: wrap ? { width: wrap, useAdvancedWrap: true } : undefined, lineSpacing: size >= 14 ? 6 : 4 }));
    const element = ['fire', 'holy', 'dark', 'ice', 'electric'].includes(def.damageType) ? ` - ${def.damageType}` : '';
    if (!open) return this.lockedCardBody(id, { objs, put, text, g, X, Y, W, H, card });
    // READABLE CARD (user, session 47: 'this info is hard to read'): name, role, the summary in bright text with air
    // between the lines, the team bonus on its own gold line; then each skill in its OWN BOX: icon + name + a coloured
    // tag (PASSIVE / ATTACK - 10s / SUPPORT - 12s: the cooldown lives in the tag, not the text), the description under
    // them; the tip in a box of its own when it fits. Sizes and colours: SQUAD_VIEW.card.
    const C = this.L.card;
    const small = (x, y, str, color, wrap) => put(this.add.text(x, y, str, { fontFamily: FONT, fontSize: '8px', color, wordWrap: wrap ? { width: wrap, useAdvancedWrap: true } : undefined, lineSpacing: C.lineGap }));
    const prose = (x, y, str, color, wrap) => small(x, y, str, color, wrap).setLetterSpacing(C.letterGap); // longer text: airier
    text(GAME_WIDTH / 2, Y + 122, def.name, 24, UI.text, true).setOrigin(0.5, 0);
    small(GAME_WIDTH / 2, Y + 160, `${def.role || ''} - ${def.damageType === 'melee' ? 'melee' : 'ranged'}${element}`.toUpperCase(), UI.gold).setOrigin(0.5, 0);
    const sum = prose(GAME_WIDTH / 2, Y + 176, def.summary || '', C.body, W - 48).setOrigin(0.5, 0).setAlign('center');
    const team = small(GAME_WIDTH / 2, sum.y + sum.height + 8, `TEAM BONUS: ${this.perkLine(def)}`, UI.gold).setOrigin(0.5, 0);
    let y = team.y + team.height + 12;
    const bx = X + 12, bw = W - 24;
    const box = (top, h) => g.fillStyle(0x000000, 1).fillRect(bx - 2, top - 2, bw + 4, h + 4).fillStyle(C.edge, 1).fillRect(bx, top, bw, h).fillStyle(C.fill, 1).fillRect(bx + 2, top + 2, bw - 4, h - 4);
    const section = (iconId, tag, tagColor, name, body) => {
      const top = y, P = C.pad;
      const key = skillIconKey(this, iconId);
      const nm = text(bx + P + 44, top + P - 1, name, 16, UI.text, true, bw - 2 * P - 44);
      const tg = small(bx + P + 44, nm.y + nm.height + 4, tag, tagColor);
      const ds = prose(bx + P, Math.max(tg.y + tg.height, top + P + 36) + 8, body, C.body, bw - 2 * P);
      const h = ds.y + ds.height + P - top;
      box(top, h); // drawn once its height is known (the card graphics sits under every text, so it stays behind)
      drawWindow(g, bx + P, top + P, 36, 36, { line: tagColor === UI.gold ? 0xffd84a : UI.line });
      if (key) put(this.add.image(bx + P + 18, top + P + 18, key).setScale(2));
      y = top + h + C.gap;
    };
    const atk = skillDefs[def.skills.attack];
    const sup = skillDefs[def.skills.support];
    section(`passive_${def.id}`, 'PASSIVE', UI.gold, def.passive.name, def.passive.description);
    section(def.skills.attack, `ATTACK - ${atk.cooldownMs / 1000}s`, UI.red, atk.name, atk.description);
    section(def.skills.support, `SUPPORT - ${sup.cooldownMs / 1000}s`, UI.green, sup.name, sup.description);
    // The button at the bottom; the tip (one) in its own box above it, only when it fits.
    const by = Y + H - 64;
    if (def.tips && def.tips.length) {
      const P = C.pad, tip = prose(bx + P, y + P, `TIP: ${def.tips[0]}`, C.tip, bw - 2 * P);
      const h = tip.height + 2 * P;
      if (y + h > by - 30) tip.destroy();
      else box(y, h);
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
      // Squad full: choosing still works, the hero in the last slot walks off (user's choice).
      const out = this.slots[this.slots.length - 1];
      label = 'CHOOSE';
      text(GAME_WIDTH / 2, by - 22, `${heroDefs.find((h) => h.id === out).name} leaves the squad.`, 12, MUTE, true).setOrigin(0.5);
      action = () => { this.sendBack(out); this.choose(id); };
    } else {
      label = 'CHOOSE';
      action = () => this.choose(id);
    }
    // The two card buttons push in when held (pressed fill + the label drops), and act on release (UI.press).
    const bg = put(this.add.graphics());
    const lt = text(GAME_WIDTH / 2, by + 25, label, 17, action ? UI.text : UI.dim, true).setOrigin(0.5);
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
    const xt = text(X + W - 26, Y + 27, 'X', 16, UI.text, true).setOrigin(0.5);
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

  // The rest of a LOCKED hero's card: '? ? ?', LOCKED HERO, the goal, a progress bar with the numbers, and the X
  // (a tap anywhere on the card or outside closes it).
  lockedCardBody(id, { objs, put, text, g, X, Y, W, H, card }) {
    const req = unlocks.requirements[id], LC = this.L.lockedCard;
    text(GAME_WIDTH / 2, Y + 178, '? ? ?', 24, UI.text, true).setOrigin(0.5, 0);
    text(GAME_WIDTH / 2, Y + 216, 'LOCKED HERO', 11, UI.gold, true).setOrigin(0.5, 0);
    if (req) {
      text(GAME_WIDTH / 2, Y + LC.goalY, describeRequirement(req, unlocks), 16, UI.text, true, W - 32).setOrigin(0.5, 0).setAlign('center');
      const p = requirementProgress(req, this.progress), bw = W - 64, bx = X + 32, by = Y + LC.barY;
      g.fillStyle(0x000000, 1).fillRect(bx - 2, by - 2, bw + 4, LC.barH + 4).fillStyle(UI.goldTheme.tileEdge, 1).fillRect(bx, by, bw, LC.barH);
      g.fillStyle(UI.goldTheme.picked, 1).fillRect(bx, by, Math.round(bw * Math.min(1, p.have / p.need)), LC.barH);
      text(GAME_WIDTH / 2, by + LC.barH + 10, describeProgress(req, this.progress, unlocks), 8, MUTE, true).setOrigin(0.5, 0);
    }
    put(this.add.zone(X + W / 2, Y + H / 2, W, H).setInteractive()).on('pointerdown', () => { sfx.play('cardClose'); this.closePanel(); });
    drawWindow(g, X + W - 42, Y + 10, 32, 32);
    text(X + W - 26, Y + 27, 'X', 16, UI.text, true).setOrigin(0.5);
    add_shade_close(objs[0], this);
    this.panel = objs;
    sfx.play('cardOpen');
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
  // The slide from the camp has ended (uiKit slideToScreen): the squad walks in from the left and right (user, session
  // 55), then the buttons come in.
  arrive() {
    this.squadWalk(false, () => uiShift(this, this.uiParts, true, { onDone: () => { this.leaving = this.shifting = false; this.refresh(); } }));
  }

  // The picked heroes walk in from the screen sides to their slots (out = false), or off to the sides (out = true), one
  // after another (camp.json toSquad.squadStaggerMs). done runs when the last one has arrived.
  squadWalk(out, done) {
    const picked = this.slots.map((id, s) => [id, s]).filter(([id]) => id);
    let left = picked.length;
    if (!left) { done(); return; }
    picked.forEach(([id, s], i) => this.time.delayedCall(i * campData.toSquad.squadStaggerMs, () => {
      const f = this.figures.get(id), to = this.L.slots[s];
      this.walk(f, out ? this.sideX(s, true) : to.x, to.y, () => { if (--left === 0) done(); }, campData.toSquad.squadSpeed);
    }));
  }

  // '< CAMP': the screen slides down back into the camp hub (the reverse of BaseScene.toExpedition).
  toCamp() {
    if (this.panel || this.leaving) return;
    this.leaving = this.shifting = true;
    sfx.play('tap');
    whenScreenReady(this, 'Base', { fromSquad: true }, -GAME_HEIGHT, () => { // the camp is built, then the buttons leave
      let left = 2; // and the squad walks off the sides (the reverse of arrive); the slide starts while they walk
      const both = () => { if (--left === 0) this.slideToCamp(); };
      uiShift(this, this.uiParts, false, { onDone: both });
      this.squadWalk(true, () => {});
      this.time.delayedCall(campData.toSquad.slideAfterMs, both);
    });
  }

  slideToCamp() { // the camp comes up from below (built early: uiKit slideToScreen)
    slideToScreen(this, 'Base', { fromSquad: true }, -GAME_HEIGHT);
  }

  descend() {
    if (!this.ready() || this.panel || this.leaving || this.walkers.size) return;
    sfx.play('descend');
    music.play('descent'); // the squad song fades out (user); the battle songs start on floor 1
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
    const A = floorArt.door.anim;
    const doorOpenMs = A.rattleMs + A.swingMs + A.bounceMs; // until the gate has slammed open
    let left = ids.length;
    ids.forEach((id, i) => {
      const f = this.figures.get(id);
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
            this.cameras.main.once('camerafadeoutcomplete', () => (SQUAD_DEMO ? this.scene.restart() : this.scene.start('Battle')));
          }
        },
      });
    });
  }
}

// A tap on the dark shade around a locked hero's card closes it.
function add_shade_close(shade, scene) { shade.on('pointerdown', () => { if (scene.panel) { sfx.play('cardClose'); scene.closePanel(); } }); }

Object.assign(SquadScene.prototype, squadGrid);
