import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CHAR_SCALE } from '../config.js';
import heroDefs from '../data/heroes.json';
import enemyDefs from '../data/enemies.json';
import dungeons from '../data/dungeons.json';
import combatRules from '../data/combat.json';
import damageTypes from '../data/damageTypes.json';
import leveling from '../data/leveling.json';
import Character from '../entities/Character.js';
import BattleState from '../systems/BattleState.js';
import { validateDungeon } from '../systems/validate.js';

const DUNGEON_ID = 'A';
const SLOT_Y = 720;
const SLOT_WIDTH = GAME_WIDTH / 4;
const ENEMY_Y = 340;
const BAR_WIDTH = 44;
const WALL_H = 200; // the back wall (with the door) fills the top of each floor
const DOOR_X = GAME_WIDTH / 2;
const T = combatRules.transition;

// Depth order: floor < slots < hero < hero bars < popups < banner/HUD
const DEPTH = { floor: 0, slot: 1, marker: 2, hero: 5, heroBar: 6, doorFront: 7, popup: 10, hud: 20 };

// The battle screen: enemies at the top, four heroes at the bottom, everyone auto-attacks.
// After a win the heroes walk through the door, the floor slides down, and they walk in
// from the bottom of the screen. The fight rules live in systems/BattleState.js; this scene
// only draws what happens.
export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  create() {
    this.dungeon = dungeons[DUNGEON_ID];
    for (const problem of validateDungeon(this.dungeon, enemyDefs)) console.error('Dungeon data:', problem);

    this.floor = 1;
    this.mode = 'entering'; // 'entering' | 'fighting' | 'won' | 'lost'
    this.views = new Map(); // unit uid -> { unit, ch, bg, fill, groundY, ... }
    this.state = new BattleState({
      heroDefs: heroDefs.slice(0, 4),
      enemyDefs,
      rules: combatRules,
      damageTypes,
      leveling,
    });

    this.drawHeroSlots();
    this.floorText = this.add
      .text(GAME_WIDTH / 2, 24, '', { fontFamily: 'monospace', fontSize: '16px', color: '#9a8fc0' })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.banner = this.add
      .text(GAME_WIDTH / 2, 520, '', { fontFamily: 'monospace', fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 4, align: 'center' })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.focusMarker = this.add.ellipse(0, 0, 70, 18).setStrokeStyle(2, 0xff4d4d).setVisible(false).setDepth(DEPTH.marker);

    this.showSlots(false, 0);
    this.layer = this.buildFloor(1, 0);
    this.floorText.setText('Floor 1');
    this.enterHeroes(() => this.startFighting());
  }

  // The boxes (and name labels) under the heroes are hidden while the floor changes.
  showSlots(show, duration = 250) {
    const targets = [];
    for (const h of this.state.heroes) {
      const v = this.views.get(h.uid);
      targets.push(v.slotBox, v.label);
    }
    this.tweens.add({ targets, alpha: show ? 1 : 0, duration });
  }

  startFighting() {
    this.showSlots(true);
    this.mode = 'fighting';
  }

  drawHeroSlots() {
    this.state.heroes.forEach((unit, i) => {
      const cx = SLOT_WIDTH * i + SLOT_WIDTH / 2;
      const box = this.add.rectangle(cx, SLOT_Y - 40, SLOT_WIDTH - 12, 110, 0x1d1730, 0.85).setStrokeStyle(1, 0x3a3057).setDepth(DEPTH.slot);
      const label = this.add
        .text(cx, SLOT_Y + 28, '', { fontFamily: 'monospace', fontSize: '12px', color: '#9a8fc0' })
        .setOrigin(0.5)
        .setDepth(DEPTH.slot);
      const view = this.makeView(unit, cx, SLOT_Y);
      view.label = label;
      view.slotBox = box;
      view.slotX = cx;
      view.ch.setDepth(DEPTH.hero);
      view.bg.setDepth(DEPTH.heroBar);
      view.fill.setDepth(DEPTH.heroBar);
      this.setLabel(view);
    });
  }

  // Draws one fighter: the character, plus a health bar above it.
  // Enemies are added to `parent` (their floor) so they slide with it.
  makeView(unit, x, groundY, parent = null) {
    const hover = unit.flying ? unit.def.hover || 0 : 0;
    const ch = new Character(this, x, groundY - hover, unit.def);
    const barY = groundY - hover - unit.def.height * CHAR_SCALE - 10;
    const bg = this.add.rectangle(x, barY, BAR_WIDTH + 2, 7, 0x000000);
    const fill = this.add
      .rectangle(x - BAR_WIDTH / 2, barY, BAR_WIDTH, 5, unit.side === 'hero' ? 0x4cd16a : 0xe04b4b)
      .setOrigin(0, 0.5);
    const view = { unit, ch, bg, fill, groundY };
    this.views.set(unit.uid, view);

    if (unit.side === 'enemy') {
      // Tap an enemy to focus it.
      const h = unit.def.height;
      ch.setInteractive(new Phaser.Geom.Rectangle(-16, -h - 2, 32, h + 4), Phaser.Geom.Rectangle.Contains);
      ch.on('pointerdown', () => this.state.setFocus(unit.uid));
    }
    if (parent) parent.add([ch, bg, fill]);
    return view;
  }

  // Builds one floor: back wall, door, tiled ground and the enemies. yOffset places it off-screen.
  buildFloor(n, yOffset) {
    const container = this.add.container(0, yOffset).setDepth(DEPTH.floor);
    // The inside of the door is drawn in front of the heroes, so they seem to step into it.
    const front = this.add.container(0, yOffset).setDepth(DEPTH.doorFront);
    const colors = this.dungeon.tileColors;
    const base = Number(colors[(n - 1) % colors.length]);
    const line = Phaser.Display.Color.ValueToColor(base).brighten(10).color;
    const wall = Phaser.Display.Color.ValueToColor(base).darken(25).color;

    const g = this.add.graphics();
    g.fillStyle(base, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(wall, 1).fillRect(0, 0, GAME_WIDTH, WALL_H);
    g.lineStyle(1, line, 0.6);
    // Brick rows: every other row is shifted sideways.
    const rows = [[WALL_H, GAME_HEIGHT, 44, 78], [0, WALL_H, 25, 50]];
    for (const [top, bottom, rowH, brickW] of rows) {
      let row = 0;
      for (let y = top; y <= bottom; y += rowH, row++) {
        g.lineBetween(0, y, GAME_WIDTH, y);
        for (let x = (row % 2) * (brickW / 2); x < GAME_WIDTH; x += brickW) g.lineBetween(x, y, x, Math.min(y + rowH, bottom));
      }
    }
    container.add(g);

    // The door in the back wall (purple frame, dark inside; glows when open).
    const frameColor = 0x7a3fb8;
    const dark = 0x120b1f;
    const parts = [
      this.add.rectangle(DOOR_X, WALL_H - 28, 52, 56, frameColor),
      this.add.ellipse(DOOR_X, WALL_H - 56, 52, 36, frameColor),
    ];
    const inner = [
      this.add.rectangle(DOOR_X, WALL_H - 26, 36, 52, dark),
      this.add.ellipse(DOOR_X, WALL_H - 52, 36, 28, dark),
    ];
    container.add(parts);
    front.add(inner);

    const entry = [...this.dungeon.floors].reverse().find((f) => f.floor <= n) || this.dungeon.floors[0];
    const enemies = this.state.spawnEnemies(entry.enemies, n);
    enemies.forEach((unit, i) => {
      const x = (GAME_WIDTH * (i + 1)) / (enemies.length + 1);
      this.makeView(unit, x, ENEMY_Y, container);
    });

    return {
      container,
      front,
      setDoorOpen: (open) => inner.forEach((p) => p.setFillStyle(open ? 0xffd98a : dark)),
    };
  }

  // Keeps a fighter's health bar attached to it while it moves.
  syncBar(view, baseY = view.ch.y) {
    const y = baseY - view.unit.def.height * view.ch.scaleX - 10;
    view.bg.setPosition(view.ch.x, y).setAlpha(view.ch.alpha);
    view.fill.setPosition(view.ch.x - BAR_WIDTH / 2, y).setAlpha(view.ch.alpha);
  }

  livingHeroViews() {
    return this.state.heroes.filter((h) => h.alive).map((h) => this.views.get(h.uid));
  }

  // One hero walks along a path of points at a steady pace, hopping with each step.
  // The further up the screen, the smaller the hero (perspective). Heroes lower on the
  // screen are drawn in front of heroes higher up.
  walkPath(view, points, { delay, onDone }) {
    const ch = view.ch;
    const lengths = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const len = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      lengths.push(len);
      total += len;
    }
    const doorY = WALL_H - 10;
    const scaleAt = (y) => Phaser.Math.Clamp(CHAR_SCALE * (0.5 + 0.5 * ((y - doorY) / (SLOT_Y - doorY))), CHAR_SCALE * 0.5, CHAR_SCALE * 1.3);

    this.tweens.addCounter({
      from: 0,
      to: 1,
      delay,
      duration: (total / T.walkSpeedPxPerSec) * 1000,
      ease: 'Linear',
      onStart: () => {
        view.bg.setVisible(false); // health bars would clutter the line
        view.fill.setVisible(false);
      },
      onUpdate: (tween) => {
        let d = tween.getValue() * total;
        let i = 0;
        while (i < lengths.length - 1 && d > lengths[i]) d -= lengths[i++];
        const t = lengths[i] ? d / lengths[i] : 1;
        const x = points[i].x + (points[i + 1].x - points[i].x) * t;
        const y = points[i].y + (points[i + 1].y - points[i].y) * t;
        const walked = tween.getValue() * total;
        ch.x = x;
        ch.y = y - Math.abs(Math.sin((walked / T.stepLenPx) * Math.PI)) * T.stepHeight; // the hop
        ch.setScale(scaleAt(y));
        ch.setDepth(DEPTH.hero + y / 10000);
      },
      onComplete: () => {
        const last = points[points.length - 1];
        ch.setPosition(last.x, last.y);
        ch.setScale(scaleAt(last.y));
        onDone();
      },
    });
  }

  // Delay before the nth hero starts, so the heroes keep a gap of lineGapPx in the line.
  lineDelay(i) {
    return (i * T.lineGapPx * 1000) / T.walkSpeedPxPerSec;
  }

  // Heroes come up from below the screen in a line at the centre, then fan out to their slots.
  enterHeroes(done) {
    const living = this.livingHeroViews();
    let left = living.length;
    if (!left) return done();
    living.forEach((v, i) => {
      v.ch.setScale(CHAR_SCALE).setAlpha(1).setVisible(true).setPosition(DOOR_X, GAME_HEIGHT + 90);
      v.bg.setVisible(false);
      v.fill.setVisible(false);
      this.walkPath(
        v,
        [
          { x: DOOR_X, y: GAME_HEIGHT + 90 },
          { x: DOOR_X, y: SLOT_Y + 70 },
          { x: v.slotX, y: SLOT_Y },
        ],
        {
          delay: this.lineDelay(i),
          onDone: () => {
            v.ch.setScale(CHAR_SCALE).setDepth(DEPTH.hero);
            v.ch.homeX = v.slotX;
            v.ch.homeY = SLOT_Y;
            v.bg.setVisible(true);
            v.fill.setVisible(true);
            this.syncBar(v);
            if (--left === 0) done();
          },
        },
      );
    });
  }

  // Heroes gather into a line at the centre and walk into the door one after another.
  // Heroes in the outer slots have further to walk to reach the line, so each start delay is
  // worked out from when that hero reaches the line. That keeps the gaps in the line equal.
  heroesWalkToDoor(done) {
    const living = this.livingHeroViews();
    let left = living.length;
    if (!left) return done();
    const gather = { x: DOOR_X, y: SLOT_Y - 120 };
    const toLine = living.map((v) => Math.hypot(gather.x - v.slotX, gather.y - SLOT_Y));
    const base = Math.max(...toLine.map((len, i) => len - i * T.lineGapPx));
    living.forEach((v, i) => {
      this.walkPath(
        v,
        [{ x: v.slotX, y: SLOT_Y }, gather, { x: DOOR_X, y: WALL_H - 10 }],
        {
          delay: ((base - toLine[i] + i * T.lineGapPx) * 1000) / T.walkSpeedPxPerSec,
          onDone: () => {
            v.ch.setVisible(false);
            if (--left === 0) done();
          },
        },
      );
    });
  }

  // The camera slides up: the old floor drops away and the new floor comes in from above.
  slideToNextFloor(done) {
    const old = this.layer;
    this.floor += 1;
    const next = this.buildFloor(this.floor, -GAME_HEIGHT);
    this.tweens.add({ targets: [old.container, old.front], y: GAME_HEIGHT, duration: T.slideMs, ease: 'Sine.easeInOut' });
    this.tweens.add({
      targets: [next.container, next.front],
      y: 0,
      duration: T.slideMs,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        old.container.destroy();
        old.front.destroy();
        this.layer = next;
        this.floorText.setText(`Floor ${this.floor}`);
        done();
      },
    });
  }

  update(time, delta) {
    if (this.mode !== 'fighting') return;

    // Cap the step so switching browser tabs doesn't cause a huge jump.
    const events = this.state.update(Math.min(delta, 100));
    for (const e of events) this.showEvent(e);

    const focus = this.state.focusUnit;
    if (focus) {
      const v = this.views.get(focus.uid);
      this.focusMarker.setPosition(v.ch.homeX, v.groundY + 6).setVisible(true);
    } else {
      this.focusMarker.setVisible(false);
    }

    if (this.state.allEnemiesDead()) this.onWin();
    else if (this.state.allHeroesDead()) this.onLoss();
  }

  showEvent(e) {
    if (e.type === 'attack') {
      const a = this.views.get(e.attacker.uid);
      const t = this.views.get(e.target.uid);
      a.ch.lunge(t.ch.homeX, t.ch.homeY);
      if (e.result.dodged) {
        this.popText(t, 'Miss', '#aaaaaa');
        return;
      }
      t.ch.flash();
      this.setBar(t);
      const { amount, crit, mult } = e.result;
      const mark = mult > 1 ? '!' : mult < 1 ? '…' : '';
      const color = e.attacker.side === 'hero' ? damageTypes[e.attacker.damageType].color : '#ff6b6b';
      this.popText(t, `${amount}${mark}`, crit ? '#ffd24d' : color, crit);
    } else if (e.type === 'levelup') {
      const v = this.views.get(e.unit.uid);
      this.setLabel(v);
      this.setBar(v);
      this.popText(v, `Level up! Lv${e.unit.level}`, '#ffd24d', true);
    } else if (e.type === 'death') {
      const v = this.views.get(e.unit.uid);
      this.setBar(v);
      if (e.unit.side === 'enemy') {
        this.tweens.add({ targets: [v.ch, v.bg, v.fill], alpha: 0, duration: 400, onComplete: () => this.removeView(e.unit.uid) });
      } else {
        v.ch.setAlpha(0.25);
        v.bg.setAlpha(0.4);
        v.fill.setAlpha(0.4);
      }
    }
  }

  setLabel(view) {
    view.label.setText(`${view.unit.name} Lv${view.unit.level}`);
  }

  setBar(view) {
    view.fill.width = BAR_WIDTH * (view.unit.hp / view.unit.maxHp);
  }

  removeView(uid) {
    const v = this.views.get(uid);
    if (!v) return;
    v.ch.destroy();
    v.bg.destroy();
    v.fill.destroy();
    this.views.delete(uid);
  }

  // Floating number above a fighter.
  popText(view, text, color, big = false) {
    const y = view.ch.homeY - view.unit.def.height * CHAR_SCALE - 22;
    const t = this.add
      .text(view.ch.homeX, y, text, {
        fontFamily: 'monospace',
        fontSize: big ? '20px' : '14px',
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.popup);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  onWin() {
    this.mode = 'won';
    this.focusMarker.setVisible(false);
    this.banner.setText(`Floor ${this.floor} cleared!`);
    this.layer.setDoorOpen(true);

    for (const { unit, amount } of this.state.healHeroes(combatRules.winHealPercent)) {
      const v = this.views.get(unit.uid);
      this.setBar(v);
      if (amount > 0) this.popText(v, `+${amount}`, '#6dff8f');
    }

    this.time.delayedCall(T.clearPauseMs, () => {
      this.banner.setText('');
      this.showSlots(false);
      this.heroesWalkToDoor(() => this.slideToNextFloor(() => this.enterHeroes(() => this.startFighting())));
    });
  }

  onLoss() {
    this.mode = 'lost';
    this.banner.setText(`Squad defeated\nReached floor ${this.floor}`);
    this.time.delayedCall(combatRules.restartDelayMs, () => this.scene.restart());
  }
}
