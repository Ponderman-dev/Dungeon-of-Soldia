import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CHAR_SCALE } from '../config.js';
import allHeroDefs from '../data/heroes.json';
import squadIds from '../data/squad.json';
import enemyDefs from '../data/enemies.json';
import dungeons from '../data/dungeons.json';
import combatRules from '../data/combat.json';
import damageTypes from '../data/damageTypes.json';
import leveling from '../data/leveling.json';
import rawItems from '../data/items.json';
import itemTypes from '../data/itemTypes.json';
import rarities from '../data/rarities.json';
import rewardRules from '../data/rewards.json';
import rawSkills from '../data/skills.json';
import statusInfo from '../data/statuses.json';
import Character from '../entities/Character.js';
import BattleState from '../systems/BattleState.js';
import { validateDungeon } from '../systems/validate.js';
import { enemiesForFloor } from '../systems/dungeon.js';
import { pickSquad, perkMods } from '../systems/party.js';
import { loadItems } from '../systems/items.js';
import { rollChoices } from '../systems/rewards.js';

const DUNGEON_ID = 'A';
const STAT_SHORT = { attack: 'ATK', health: 'HP', defense: 'DEF', resist: 'RES', evasion: 'EVA', crit: 'CRIT', attackEfficiency: 'SPD', mana: 'MANA' };
const SLOT_Y = 720;
const heroDefs = pickSquad(allHeroDefs, squadIds);
const SLOT_WIDTH = GAME_WIDTH / heroDefs.length;
const ENEMY_Y = 340;
const BAR_WIDTH = 44;
const WALL_H = 200; // the back wall (with the door) fills the top of each floor
const DOOR_X = GAME_WIDTH / 2;
const T = combatRules.transition;
const itemDefs = loadItems(rawItems);
const skillDefs = rawSkills;
const SKILL_Y = 772; // centre of the skill squares
const SKILL_W = 40;
const SKILL_H = 44;

// Depth order: floor < slots < hero < hero bars < popups < banner/HUD
const DEPTH = { floor: 0, slot: 1, marker: 2, hero: 5, heroBar: 6, doorFront: 7, popup: 10, hud: 20 };

// The battle screen: enemies at the top, the squad (3 heroes) at the bottom, everyone auto-attacks.
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
      heroDefs,
      enemyDefs,
      itemDefs,
      skillDefs,
      rules: combatRules,
      damageTypes,
      leveling,
    });

    this.drawHeroSlots();
    this.floorText = this.add
      .text(16, 24, '', { fontFamily: 'monospace', fontSize: '16px', color: '#9a8fc0' })
      .setOrigin(0, 0.5)
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

  // The name labels under the heroes are hidden while the floor changes.
  showSlots(show, duration = 250) {
    for (const h of this.state.heroes) {
      const v = this.views.get(h.uid);
      // A fallen hero's labels stay dim and have no skill squares.
      this.tweens.add({ targets: [v.label, v.perkLabel], alpha: show ? (h.alive ? 1 : 0.3) : 0, duration });
      const buttons = v.skillButtons.flatMap((b) => [b.g, b.code, b.cost, b.cd]);
      this.tweens.add({ targets: buttons, alpha: show && h.alive ? 1 : 0, duration });
    }
  }

  // After the survivors go through the door, the fallen heroes are gone from the screen.
  removeFallenHeroes() {
    for (const h of this.state.heroes) {
      if (h.alive) continue;
      const v = this.views.get(h.uid);
      v.ch.setVisible(false);
      this.setBarsVisible(v, false);
    }
  }

  startFighting() {
    this.showSlots(true);
    this.mode = 'fighting';
  }

  drawHeroSlots() {
    this.state.heroes.forEach((unit, i) => {
      const cx = SLOT_WIDTH * i + SLOT_WIDTH / 2;
      const label = this.add
        .text(cx, GAME_HEIGHT - 22, '', { fontFamily: 'monospace', fontSize: '12px', color: '#9a8fc0' })
        .setOrigin(0.5)
        .setDepth(DEPTH.slot);
      // The hero's party perk, under the name.
      const perkLabel = this.add
        .text(cx, GAME_HEIGHT - 8, '', { fontFamily: 'monospace', fontSize: '9px', color: '#7fd8a0' })
        .setOrigin(0.5)
        .setDepth(DEPTH.slot);
      const view = this.makeView(unit, cx, SLOT_Y);
      view.label = label;
      view.perkLabel = perkLabel;
      view.slotX = cx;
      view.ch.setDepth(DEPTH.hero);
      for (const part of [view.bg, view.fill, view.mbg, view.mfill]) part.setDepth(DEPTH.heroBar);
      view.chipBox.setDepth(DEPTH.heroBar);

      // The two skill squares under the hero: tap to cast.
      view.skillButtons = unit.skills.map((slot, j) => {
        const x = cx + (j === 0 ? -22 : 22);
        const textStyle = { fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#f3eefc' };
        const button = {
          x: x - SKILL_W / 2,
          y: SKILL_Y - SKILL_H / 2,
          g: this.add.graphics().setDepth(3),
          code: this.add.text(x, SKILL_Y - 6, skillDefs[slot.id].short, textStyle).setOrigin(0.5).setDepth(4),
          cost: this.add.text(x, SKILL_Y + 12, String(skillDefs[slot.id].manaCost), { ...textStyle, fontSize: '10px' }).setOrigin(0.5).setDepth(4),
          cd: this.add.text(x, SKILL_Y - 6, '', { ...textStyle, fontSize: '16px', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(5),
        };
        this.add
          .zone(x, SKILL_Y, SKILL_W + 6, SKILL_H + 6)
          .setInteractive()
          .setDepth(6)
          .on('pointerdown', () => this.castFromUI(unit.uid, j));
        return button;
      });
      this.setLabel(view);
    });
  }

  // Taps on a skill square.
  castFromUI(heroUid, index) {
    if (this.mode !== 'fighting') return;
    for (const e of this.state.castSkill(heroUid, index)) this.showEvent(e);
  }

  // Redraws the skill squares and mana bars (ready / cooling down / not enough mana).
  refreshHud() {
    for (const hero of this.state.heroes) {
      const view = this.views.get(hero.uid);
      this.setMana(view);
      if (hero.alive) this.setBar(view); // health regeneration moves the bar
      view.skillButtons.forEach((b, j) => {
        const slot = hero.skills[j];
        const skill = skillDefs[slot.id];
        const ready = this.mode === 'fighting' && this.state.canCast(hero, j);
        const g = b.g;
        g.clear();
        g.fillStyle(ready ? 0x2a4fb8 : 0x1b2347, hero.alive ? 1 : 0.5).fillRoundedRect(b.x, b.y, SKILL_W, SKILL_H, 8);
        if (slot.cooldownLeft > 0) {
          const frac = slot.cooldownLeft / skill.cooldownMs;
          g.fillStyle(0x000000, 0.55).fillRoundedRect(b.x, b.y, SKILL_W, SKILL_H * frac, 8);
        }
        g.lineStyle(ready ? 3 : 2, ready ? 0xf2b632 : 0x3b6fe0, ready ? 1 : 0.5).strokeRoundedRect(b.x, b.y, SKILL_W, SKILL_H, 8);
        b.cd.setText(slot.cooldownLeft > 0 ? String(Math.ceil(slot.cooldownLeft / 1000)) : '');
        b.cost.setColor(hero.mana >= skill.manaCost ? '#8fb0ff' : '#ff8c8c');
        b.code.setColor(ready ? '#f3eefc' : '#8a86a0');
      });
    }
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
    // Status tags (STUN, SLOW, PSN, BUFF) next to the bars.
    view.chipBox = this.add.container(x, barY + (unit.side === 'hero' ? 20 : -22));
    if (unit.side === 'hero') {
      view.mbg = this.add.rectangle(x, barY + 8, BAR_WIDTH + 2, 5, 0x000000);
      view.mfill = this.add.rectangle(x - BAR_WIDTH / 2, barY + 8, BAR_WIDTH, 3, 0x3b6fe0).setOrigin(0, 0.5);
      // Item dots above the health bar: dot colour = item type, ring = rarity.
      // A container so the count numbers move, fade and hide together with the dots.
      view.dotsG = this.add.graphics();
      view.dots = this.add.container(x, barY - 12, [view.dotsG]).setDepth(DEPTH.heroBar);
    }
    this.views.set(unit.uid, view);

    if (unit.side === 'enemy') {
      // Tap an enemy to focus it.
      const h = unit.def.height;
      ch.setInteractive(new Phaser.Geom.Rectangle(-16, -h - 2, 32, h + 4), Phaser.Geom.Rectangle.Contains);
      ch.on('pointerdown', () => this.state.setFocus(unit.uid));
    }
    if (parent) parent.add([ch, bg, fill, view.chipBox]);
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

    const enemies = this.state.spawnEnemies(enemiesForFloor(this.dungeon, n), n);
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
    if (view.dots) view.dots.setPosition(view.ch.x, y - 12).setAlpha(view.ch.alpha);
    if (view.mbg) {
      view.mbg.setPosition(view.ch.x, y + 8).setAlpha(view.ch.alpha);
      view.mfill.setPosition(view.ch.x - BAR_WIDTH / 2, y + 8).setAlpha(view.ch.alpha);
    }
    view.chipBox.setPosition(view.ch.x, y + (view.unit.side === 'hero' ? 20 : -22)).setAlpha(view.ch.alpha);
  }

  // Shows or hides a fighter's health bar (and item dots).
  setBarsVisible(view, visible) {
    view.bg.setVisible(visible);
    view.fill.setVisible(visible);
    if (view.dots) view.dots.setVisible(visible);
    if (view.mbg) {
      view.mbg.setVisible(visible);
      view.mfill.setVisible(visible);
    }
    view.chipBox.setVisible(visible);
  }

  setMana(view) {
    if (view.mfill) view.mfill.width = BAR_WIDTH * (view.unit.mana / view.unit.maxMana);
  }

  // Redraws the status tags on a fighter: one tag per kind of status it has right now.
  drawChips(view) {
    view.chipBox.removeAll(true);
    const kinds = [...new Set(view.unit.statuses.map((st) => st.type))];
    const tags = kinds.map((kind) => statusInfo[kind]);
    // The party's morale tag (INCOMPLETE / ALL ALONE) shows on every living hero.
    const morale = view.unit.side === 'hero' && view.unit.alive ? combatRules.morale[this.state.morale] : null;
    if (morale) tags.unshift(morale);
    let x = 0;
    for (const info of tags) {
      const chip = this.add
        .text(x, 0, info.label, { fontFamily: 'monospace', fontSize: '9px', fontStyle: 'bold', color: info.textColor, backgroundColor: info.color, padding: { x: 2, y: 1 } })
        .setOrigin(0, 0.5);
      view.chipBox.add(chip);
      x += chip.width + 3;
    }
    // Centre the row on the fighter.
    view.chipBox.iterate((chip) => (chip.x -= (x - 3) / 2));
  }

  // Redraws the dots for a hero's items: one dot per kind of item, with a small number beside it
  // when the hero has several copies. Up to 5 dots per row, rows going up.
  drawDots(view) {
    const g = view.dotsG;
    g.clear();
    view.dots.list.slice(1).forEach((o) => o.destroy()); // old count labels
    const counts = new Map();
    for (const id of view.unit.items) counts.set(id, (counts.get(id) || 0) + 1);
    const kinds = [...counts.entries()];
    const perRow = 5;
    const gap = 16;
    kinds.forEach(([id, count], i) => {
      const def = itemDefs[id];
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, kinds.length - row * perRow);
      const x = ((i % perRow) - (inRow - 1) / 2) * gap;
      const y = -row * 11;
      g.fillStyle(Number(itemTypes[def.type].color), 1).fillCircle(x, y, 3.5);
      g.lineStyle(1.5, Number(rarities[def.rarity].color), 1).strokeCircle(x, y, 4.5);
      if (count > 1) {
        const label = this.add
          .text(x + 5, y + 1, String(count), { fontFamily: 'monospace', fontSize: '9px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 2 })
          .setOrigin(0, 0.5);
        view.dots.add(label);
      }
    });
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
      onStart: () => this.setBarsVisible(view, false), // bars and dots would clutter the line
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
      this.setBarsVisible(v, false);
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
            this.setBarsVisible(v, true);
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
    this.refreshHud();
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
        if (e.result.blocked) this.popText(t, 'Blocked!', '#9fc4ff', true);
        else this.popText(t, 'Miss', '#aaaaaa');
        return;
      }
      t.ch.flash();
      this.setBar(t);
      const { amount, crit, mult } = e.result;
      const mark = mult > 1 ? '!' : mult < 1 ? '…' : '';
      const color = e.attacker.side === 'hero' ? damageTypes[e.damageType || e.attacker.damageType].color : '#ff6b6b';
      this.popText(t, `${amount}${mark}`, crit ? '#ffd24d' : color, crit);
    } else if (e.type === 'projectile') {
      this.showProjectile(this.views.get(e.from.uid), this.views.get(e.to.uid), e.kind);
    } else if (e.type === 'cast') {
      const caster = this.views.get(e.unit.uid);
      this.popText(caster, e.skill.name, '#9fc4ff');
      if (e.skill.target !== 'self' && e.targets[0]) {
        const t = this.views.get(e.targets[0].uid);
        caster.ch.lunge(t.ch.homeX, t.ch.homeY);
      }
    } else if (e.type === 'status') {
      const v = this.views.get(e.unit.uid);
      this.drawChips(v);
      if (e.change === 'apply' && e.status.type !== 'buff' && statusInfo[e.status.type].popup !== false) {
        this.popText(v, statusInfo[e.status.type].label + '!', statusInfo[e.status.type].color);
      }
      if (e.status.type === 'buff') this.drawAllBars();
    } else if (e.type === 'proc') {
      this.popText(this.views.get(e.unit.uid), e.label, '#ffd24d', true);
    } else if (e.type === 'heal') {
      const v = this.views.get(e.unit.uid);
      this.setBar(v);
      this.popText(v, `+${e.amount}`, '#6dff8f');
    } else if (e.type === 'thorns') {
      const v = this.views.get(e.unit.uid);
      v.ch.flash();
      this.setBar(v);
      this.popText(v, `${e.amount} thorns`, '#e8a0ff');
    } else if (e.type === 'dot') {
      const v = this.views.get(e.unit.uid);
      v.ch.flash();
      this.setBar(v);
      this.popText(v, String(e.amount), damageTypes[e.damageType].color);
    } else if (e.type === 'morale') {
      for (const h of this.state.heroes) {
        const v = this.views.get(h.uid);
        this.setBar(v);
        this.drawChips(v);
        if (h.alive) this.popText(v, `${combatRules.morale[e.tier].label}!`, combatRules.morale[e.tier].popupColor, true);
      }
    } else if (e.type === 'levelup') {
      const v = this.views.get(e.unit.uid);
      this.setLabel(v);
      this.setBar(v);
      this.popText(v, `Level up! Lv${e.unit.level}`, '#ffd24d', true);
    } else if (e.type === 'death') {
      const v = this.views.get(e.unit.uid);
      this.setBar(v);
      if (e.unit.side === 'enemy') {
        this.drawChips(v);
        this.tweens.add({ targets: [v.ch, v.bg, v.fill], alpha: 0, duration: 400, onComplete: () => this.removeView(e.unit.uid) });
      } else {
        v.ch.freeze(); // stop floating
        v.perkLabel.setText('perk lost');
        v.ch.setAlpha(0.25);
        v.skillButtons.forEach((b) => [b.g, b.code, b.cost, b.cd].forEach((o) => o.setAlpha(0)));
        v.bg.setAlpha(0.4);
        v.fill.setAlpha(0.4);
        if (v.dots) v.dots.setAlpha(0.4);
        v.mbg.setAlpha(0.4);
        v.mfill.setAlpha(0.4);
        this.drawChips(v);
        this.drawAllBars(); // squad items from this hero stop working, so max health may change
      }
    }
  }

  // Placeholder projectiles: a fire bomb flies in an arc, lightning is a zig-zag line that fades.
  showProjectile(from, to, kind) {
    if (!from || !to) return;
    const sx = from.ch.homeX, sy = from.ch.homeY - 14, tx = to.ch.homeX, ty = to.ch.homeY - 14;
    if (kind === 'lightning') {
      const g = this.add.graphics().setDepth(DEPTH.popup);
      g.lineStyle(3, 0xffe94d, 1).beginPath().moveTo(sx, sy);
      for (let i = 1; i < 5; i++) g.lineTo(sx + ((tx - sx) * i) / 5 + Phaser.Math.Between(-10, 10), sy + ((ty - sy) * i) / 5 + Phaser.Math.Between(-10, 10));
      g.lineTo(tx, ty).strokePath();
      this.tweens.add({ targets: g, alpha: 0, duration: 350, onComplete: () => g.destroy() });
      return;
    }
    const b = this.add.circle(sx, sy, 5, 0xff7a3d).setStrokeStyle(2, 0xffd24d).setDepth(DEPTH.popup);
    this.tweens.add({ targets: b, x: tx, duration: 280, ease: 'Sine.easeIn' });
    this.tweens.add({ targets: b, y: { from: sy, to: ty }, duration: 280, ease: 'Quad.easeOut', onComplete: () => { b.destroy(); } });
  }

  drawAllBars() {
    for (const h of this.state.heroes) this.setBar(this.views.get(h.uid));
  }

  setLabel(view) {
    view.label.setText(`${view.unit.name} Lv${view.unit.level}`);
    // e.g. "Team +10% HP" (the hero's perk; it grows with the hero's level)
    const unit = view.unit;
    const bits = perkMods(unit).map((m) => `${m.percent !== undefined ? `+${Math.round(m.percent * 10) / 10}%` : `+${Math.round(m.flat * 10) / 10}`} ${STAT_SHORT[m.stat]}`);
    view.perkLabel.setText(unit.def.perk ? `Team ${bits.join(' ')}` : '');
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
    if (v.dots) v.dots.destroy();
    if (v.mbg) {
      v.mbg.destroy();
      v.mfill.destroy();
    }
    v.chipBox.destroy();
    this.views.delete(uid);
  }

  // Floating number above a fighter.
  popText(view, text, color, big = false) {
    // Pop-ups that appear together stack upwards instead of overlapping.
    view.popSlot = ((view.popSlot ?? -1) + 1) % 4;
    const y = view.ch.homeY - view.unit.def.height * CHAR_SCALE - 22 - view.popSlot * 15;
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
    t.x = Phaser.Math.Clamp(t.x, t.width / 2 + 4, GAME_WIDTH - t.width / 2 - 4); // keep it on screen
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  onWin() {
    this.mode = 'won';
    this.focusMarker.setVisible(false);
    this.banner.setText(`Floor ${this.floor} cleared!`);
    this.layer.setDoorOpen(true);

    this.state.restoreMana(combatRules.winManaPercent);
    this.state.clearStatuses();
    for (const h of this.state.heroes) this.drawChips(this.views.get(h.uid));
    for (const { unit, amount } of this.state.winHeal(combatRules.winHealPercent)) {
      const v = this.views.get(unit.uid);
      this.setBar(v);
      if (amount > 0) this.popText(v, `+${amount}`, '#6dff8f');
    }

    this.time.delayedCall(T.clearPauseMs, () => {
      this.banner.setText('');
      this.showReward(() => {
        this.showSlots(false);
        this.heroesWalkToDoor(() => {
          this.removeFallenHeroes();
          this.slideToNextFloor(() => this.enterHeroes(() => this.startFighting()));
        });
      });
    });
  }

  // Shows the reward screen. When it is done, the hero gets the item and `next` runs.
  showReward(next) {
    const choices = rollChoices({ itemDefs, rarities, count: rewardRules.choices, heroes: this.state.heroes, potionChance: rewardRules.potionChance });
    if (!choices.length) return next();
    this.scene.launch('Reward', {
      state: this.state,
      choices,
      floor: this.floor,
      onDone: (itemId, heroUid) => {
        this.scene.stop('Reward');
        this.scene.resume();
        this.applyReward(itemId, heroUid);
        this.time.delayedCall(700, next); // a moment to see the new dot
      },
    });
    this.scene.pause();
  }

  // Applies the chosen reward: a potion heals every living hero; an item goes to the chosen hero.
  applyReward(itemId, heroUid) {
    const item = itemDefs[itemId];
    if (item.kind !== 'potion') return this.giveItem(itemId, heroUid);
    for (const { unit, amount } of this.state.healHeroes(item.healPercent)) {
      const v = this.views.get(unit.uid);
      this.setBar(v);
      if (amount > 0) this.popText(v, `+${amount}`, '#6dff8f', true);
    }
  }

  giveItem(itemId, heroUid) {
    this.state.giveItem(heroUid, itemId);
    const item = itemDefs[itemId];
    this.drawAllBars();
    const view = this.views.get(heroUid);
    this.drawDots(view);
    this.popText(view, `+${item.name}`, `#${Number(rarities[item.rarity].color).toString(16).padStart(6, '0')}`, true);
  }

  onLoss() {
    this.mode = 'lost';
    this.banner.setText(`Squad defeated\nReached floor ${this.floor}`);
    this.time.delayedCall(combatRules.restartDelayMs, () => this.scene.restart());
  }
}
