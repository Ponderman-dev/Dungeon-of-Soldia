import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CHAR_SCALE, SKILL_COLORS } from '../config.js';
import allHeroDefs from '../data/heroes.json';
import squadIds from '../data/squad.json';
import enemyDefs from '../data/enemies.json';
import minionDefs from '../data/minions.json';
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
import { statusIconKey } from '../entities/statusIconTexture.js';
import statusIcons from '../data/statusIcons.json';
import { iconList, iconLayout, ICON_PX } from '../systems/statusIcons.js';
import { statusLook, iceBreak, bodyBox } from '../systems/statusFx.js';
import BattleState from '../systems/BattleState.js';
import { validateDungeon, validateHeroSkills, validateDamageTypes } from '../systems/validate.js';
import { enemiesForFloor } from '../systems/dungeon.js';
import { pickSquad, perkMods } from '../systems/party.js';
import { loadItems } from '../systems/items.js';
import { rollChoices } from '../systems/rewards.js';
import { loadProgress, saveProgress, recordRun, unlockedIds } from '../systems/progress.js';
import unlocks from '../data/unlocks.json';

const DUNGEON_ID = 'A';
const SPECIAL_SHORT = { skillDamage: 'SKILL DMG', regen: 'HP/s', dotDamage: 'DOT DMG' };
const STAT_SHORT = { attack: 'ATK', health: 'HP', defense: 'DEF', resist: 'RES', evasion: 'EVA', crit: 'CRIT', attackEfficiency: 'SPD' };
const SLOT_Y = 720;
const ENEMY_Y = 340;
const BAR_WIDTH = 44;
const WALL_H = 200; // the back wall (with the door) fills the top of each floor
const DOOR_X = GAME_WIDTH / 2;
const T = combatRules.transition;
const M = combatRules.attackMotion; // how walking looks (hop) and arrows
const FX = combatRules.skillFx; // how skills look when they go off
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
    // The squad: from squad.json, or the one the TEST squad button picked (registry `squadIds`).
    const heroDefs = pickSquad(allHeroDefs, this.registry.get('squadIds') || squadIds);
    this.slotWidth = GAME_WIDTH / heroDefs.length;
    this.dungeon = dungeons[DUNGEON_ID];
    for (const problem of validateDungeon(this.dungeon, enemyDefs)) console.error('Dungeon data:', problem);
    for (const problem of validateHeroSkills(heroDefs, skillDefs)) console.error('Hero skills:', problem);
    for (const problem of validateDamageTypes({ heroDefs, enemyDefs, skillDefs, itemDefs }, damageTypes)) console.error('Damage types:', problem);

    this.floor = 1;
    this.mode = 'entering'; // 'entering' | 'fighting' | 'won' | 'lost'
    this.views = new Map(); // unit uid -> { unit, ch, bg, fill, groundY, ... }
    this.state = new BattleState({
      heroDefs,
      enemyDefs,
      minionDefs,
      itemDefs,
      skillDefs,
      statusDefs: statusInfo,
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
      const buttons = v.skillButtons.flatMap((b) => [b.g, b.code, b.cd]);
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
    // Enemy health bars and tags leave their floor (they slid in with it) and go on top of every
    // fighter, like the heroes' bars, so a character never covers a bar.
    for (const v of this.views.values()) {
      if (v.unit.side !== 'enemy') continue;
      for (const part of [v.bg, v.fill, v.shieldFill, v.chipBox]) {
        const parent = part.parentContainer;
        if (!parent) continue;
        parent.remove(part);
        part.setPosition(part.x + parent.x, part.y + parent.y);
        this.add.existing(part);
        part.setDepth(DEPTH.heroBar);
      }
    }
    // From now on the fight rules move everyone: tell them where each fighter stands (its feet).
    for (const v of this.views.values()) {
      if (!v.unit.alive) continue;
      v.ch.stopMove();
      this.state.place(v.unit, v.ch.x, v.unit.side === 'hero' ? v.ch.y : v.groundY);
    }
    this.mode = 'fighting';
    for (const e of this.state.startFloor()) this.showEvent(e); // floor-start minions rise (Necromancer)
  }

  // A minion rises from the ground: a dark puff, the figure grows up out of the floor, then its bars show.
  showMinion(unit) {
    const v = this.makeView(unit, unit.x, unit.y);
    v.slotX = unit.x; // where a greater minion waits (it walks to the door and back with the squad)
    v.slotY = unit.y;
    v.ch.setDepth(DEPTH.hero);
    for (const part of [v.bg, v.fill, v.shieldFill, v.chipBox]) part.setDepth(DEPTH.heroBar).setAlpha(0);
    const target = v.ch.scaleY;
    v.ch.scaleY = 0.05;
    v.ch.castLift = 0;
    this.puff(unit.x, unit.y, 0x4a3a6a, 7);
    this.tweens.add({
      targets: v.ch,
      scaleY: target,
      duration: 420,
      ease: 'Back.easeOut',
      onComplete: () => {
        for (const part of [v.bg, v.fill, v.shieldFill, v.chipBox]) part.setAlpha(1);
        this.syncBar(v);
      },
    });
  }

  // A little cloud of puffs at a spot (spawn / vanish cue).
  puff(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      const dx = (i - (count - 1) / 2) * 7;
      const c = this.add.circle(x + dx, y - 2, 5 + (i % 3) * 2, color, 0.8).setDepth(DEPTH.popup - 2);
      this.tweens.add({ targets: c, y: y - 22 - (i % 3) * 8, x: x + dx * 1.6, alpha: 0, scale: 1.6, duration: 520 + (i % 3) * 90, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
    }
  }

  // Status effects ON the fighters, every frame: each status plays its own loop (stars, ice, snow, sparks,
  // flames, bubbles, drops, brackets...) all at once, and tints the sprite (Freeze turns it to ice).
  // The recipes live in systems/statusFx.js; this only draws them at the fighter's body.
  drawStatusFx() {
    if (!this.statusG) this.statusG = this.add.graphics().setDepth(DEPTH.heroBar - 0.05);
    const g = this.statusG;
    g.clear();
    const now = this.time.now;
    for (const v of this.views.values()) {
      const u = v.unit;
      if (!u.alive || !v.ch.active) { if (v.ch.active) v.ch.setStatusLook(null, 0); continue; }
      const kinds = {};
      for (const st of u.statuses) {
        const age = isFinite(st.total) && isFinite(st.remaining) ? st.total - st.remaining : 1e9;
        const k = kinds[st.type] || (kinds[st.type] = { stacks: 0, age: Infinity });
        k.stacks += 1;
        k.age = Math.min(k.age, age);
      }
      if (!v.box) v.box = bodyBox(u.def.parts, u.def.height);
      let look;
      try { look = statusLook(kinds, v.box, now + (u.uid % 7) * 137); } // each fighter a little out of step
      catch (err) { console.error(err); continue; } // a broken effect must never stop the fight
      v.ch.setStatusLook(look.tint, look.ice);
      if (look.dx && this.mode === 'fighting') v.ch.x += look.dx * Math.abs(v.ch.scaleY);
      this.paintFx(g, v, look.draws);
    }
    // Ice breaking off a fighter whose Freeze just ended.
    this.iceBreaks = (this.iceBreaks || []).filter((b) => now - b.start < 400 && b.view.ch.active);
    for (const b of this.iceBreaks) this.paintFx(g, b.view, iceBreak(b.view.box || bodyBox(b.view.unit.def.parts, b.view.unit.def.height), (now - b.start) / 400));
  }

  // Draws effect pixels (character pixels around the feet, x = 0 at the body's middle) on a fighter.
  paintFx(g, v, draws) {
    if (!draws.length || !v.ch.visible || v.ch.alpha <= 0) return;
    const S = Math.abs(v.ch.scaleY);
    const box = v.box || { cx: 0 };
    const X = v.ch.x + box.cx * v.ch.scaleX, Y = v.ch.y;
    for (const [x, y, w, h, c, a] of draws) {
      g.fillStyle(c, a * v.ch.alpha);
      g.fillRect(X + x * S - S / 2, Y + y * S, w * S, h * S);
    }
  }

  // A thin red line from every taunted enemy to the one who taunted it, so you can see who it is forced to hit.
  drawTauntLines() {
    if (!this.tauntLines) this.tauntLines = this.add.graphics().setDepth(DEPTH.marker + 1);
    const g = this.tauntLines;
    g.clear();
    for (const e of this.state.enemies) {
      if (!e.alive) continue;
      const taunter = this.state.tauntedBy(e);
      if (!taunter) continue;
      const a = this.center(this.views.get(e.uid));
      const b = this.center(this.views.get(taunter.uid));
      g.lineStyle(2, 0xe05a2a, 0.55);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  // A charge bar just under a hero's health bar while it winds up a skill, in the skill's colour
  // (attack red, support green). It fills up until the skill goes off.
  drawCastBars() {
    if (!this.castBars) this.castBars = this.add.graphics().setDepth(DEPTH.heroBar);
    const g = this.castBars;
    g.clear();
    for (const h of this.state.heroes) {
      if (!h.alive || !h.casting) continue;
      const v = this.views.get(h.uid);
      const kind = h.skills[h.casting.index].kind;
      const x = v.bg.x - BAR_WIDTH / 2;
      const y = v.bg.y + 6;
      const p = 1 - h.casting.remaining / h.casting.total;
      g.fillStyle(0x000000, 1).fillRect(x - 1, y - 1, BAR_WIDTH + 2, 5);
      g.fillStyle(SKILL_COLORS[kind].ready, 1).fillRect(x, y, BAR_WIDTH * Math.max(0, Math.min(1, p)), 3);
    }
  }

  // Morale: a faint wash over every living hero (light = INCOMPLETE, darker = ALL ALONE). No text.
  drawMoraleWash() {
    const m = combatRules.morale[this.state.morale];
    const color = m ? Phaser.Display.Color.HexStringToColor(m.tint).color : 0;
    for (const h of this.state.heroes) {
      const v = this.views.get(h.uid);
      if (v) v.ch.setWash(color, h.alive && m ? m.tintAmount : 0);
    }
  }

  // Draws every living fighter where the fight rules say it stands, hopping while it walks.
  // Lower on the screen = drawn in front.
  // Excalibur tornadoes glide to the enemy they are on.
  drawTornados() {
    if (!this.tornadoViews) return;
    for (const [id, tv] of this.tornadoViews) {
      if (!this.state.tornados.includes(tv.t)) { tv.g.destroy(); this.tornadoViews.delete(id); continue; }
      const v = this.views.get(tv.t.target.uid);
      if (!v) continue;
      tv.g.x += (v.ch.x - tv.g.x) * 0.15;
      tv.g.y += (v.ch.y - tv.g.y) * 0.15;
    }
  }

  followPositions() {
    for (const v of this.views.values()) {
      const u = v.unit;
      if (!u.alive || u.x === undefined || v.ch.lunging) continue;
      const hover = u.flying ? u.def.hover || 0 : 0;
      v.ch.hopOffset = u.moving ? Math.abs(Math.sin((u.walked / M.hopLengthPx) * Math.PI)) * M.hopHeight : 0;
      v.ch.setPosition(u.x + (v.leapX || 0), u.y + (v.leapY || 0) - hover - v.ch.hopOffset - v.ch.castLift - (v.leapLift || 0));
      // Look at whoever it is fighting (so the weapon swings towards it).
      const foe = (u.pending && u.pending.target) || (this.views.get(u.foe) || {}).unit || v.lookAt;
      if (foe && foe.alive && foe.x !== undefined && Math.abs(foe.x - u.x) > 6) v.ch.face(foe.x < u.x ? -1 : 1);
      v.ch.setWalking(!!u.moving || !!v.ch.moveTween); // walk clip (if it has one)
      v.ch.setStunned(this.state.isStunned(u)); // stunned clip (if it has one)
      if (u.side === 'hero') v.ch.setDepth(DEPTH.hero + u.y / 10000);
      this.syncBar(v);
    }
  }

  drawHeroSlots() {
    this.state.heroes.forEach((unit, i) => {
      const cx = this.slotWidth * i + this.slotWidth / 2;
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
      for (const part of [view.bg, view.fill]) part.setDepth(DEPTH.heroBar);
      view.chipBox.setDepth(DEPTH.heroBar);

      // The two skill squares under the hero: tap to cast. Left = attack skill (red), right = support skill (green).
      view.skillButtons = unit.skills.map((slot, j) => {
        const x = cx + (j === 0 ? -22 : 22);
        const textStyle = { fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#f3eefc' };
        const button = {
          x: x - SKILL_W / 2,
          y: SKILL_Y - SKILL_H / 2,
          g: this.add.graphics().setDepth(3),
          code: this.add.text(x, SKILL_Y, skillDefs[slot.id].short, textStyle).setOrigin(0.5).setDepth(4),
          cd: this.add.text(x, SKILL_Y, '', { ...textStyle, fontSize: '16px', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(5),
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

  // Redraws the skill squares (ready / cooling down) and health bars.
  refreshHud() {
    for (const hero of this.state.heroes) {
      const view = this.views.get(hero.uid);
      if (hero.alive) this.setBar(view); // health regeneration moves the bar
      if (view.steadyShown !== hero.steady) {
        view.steadyShown = hero.steady; // Steady Aim switched on or off: redraw the tags
        this.drawChips(view);
      }
      view.skillButtons.forEach((b, j) => {
        const slot = hero.skills[j];
        const skill = skillDefs[slot.id];
        b.code.setText(this.state.currentSpell(hero, j).short); // a rotation skill shows its NEXT spell
        const ready = this.mode === 'fighting' && this.state.canCast(hero, j);
        const g = b.g;
        g.clear();
        const colors = SKILL_COLORS[slot.kind];
        g.fillStyle(ready ? colors.ready : colors.idle, hero.alive ? 1 : 0.5).fillRoundedRect(b.x, b.y, SKILL_W, SKILL_H, 8);
        if (slot.cooldownLeft > 0) {
          const frac = slot.cooldownLeft / skill.cooldownMs;
          g.fillStyle(0x000000, 0.55).fillRoundedRect(b.x, b.y, SKILL_W, SKILL_H * frac, 8);
        }
        g.lineStyle(ready ? 3 : 2, ready ? 0xf2b632 : colors.ready, ready ? 1 : 0.5).strokeRoundedRect(b.x, b.y, SKILL_W, SKILL_H, 8);
        b.cd.setText(slot.cooldownLeft > 0 ? String(Math.ceil(slot.cooldownLeft / 1000)) : '');
        b.code.setColor(ready ? '#f3eefc' : '#8a86a0');
        b.code.setVisible(slot.cooldownLeft <= 0); // the cooldown number takes the letters' place
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
    // A thin light-blue bar above the health bar: how much shield is left (full width = max health).
    const shieldFill = this.add.rectangle(x - BAR_WIDTH / 2, barY - 5, 0, 3, 0x6fd0ff).setOrigin(0, 0.5).setStrokeStyle(1, 0x103050);
    const view = { unit, ch, bg, fill, groundY, shieldFill };
    // Status icons (statusIcons.json, rows of 3) next to the bars.
    view.chipBox = this.add.container(x, barY - 18);
    if (unit.side === 'hero') {
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
    if (parent) parent.add([ch, bg, fill, shieldFill, view.chipBox]);
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
  syncBar(view, baseY = view.ch.y + view.ch.hopOffset) {
    const y = baseY - view.unit.def.height * Math.abs(view.ch.scaleY) - 10;
    view.bg.setPosition(view.ch.x, y).setAlpha(view.ch.alpha);
    view.fill.setPosition(view.ch.x - BAR_WIDTH / 2, y).setAlpha(view.ch.alpha);
    view.shieldFill.setPosition(view.ch.x - BAR_WIDTH / 2, y - 5).setAlpha(view.ch.alpha);
    // Hero item dots sit above the status icon rows (if any).
    if (view.dots) view.dots.setPosition(view.ch.x, y - 12 - (view.iconRows || 0) * ICON_PX * CHAR_SCALE).setAlpha(view.ch.alpha);
    view.chipBox.setPosition(view.ch.x, y - 18).setAlpha(view.ch.alpha);
    this.blinkIcons(view);
  }

  // Shows or hides a fighter's health bar (and item dots).
  setBarsVisible(view, visible) {
    view.bg.setVisible(visible);
    view.fill.setVisible(visible);
    view.shieldFill.setVisible(visible);
    if (view.dots) view.dots.setVisible(visible);
    view.chipBox.setVisible(visible);
  }

  // Redraws the status tags on a fighter: one tag per kind of status it has right now.
  drawChips(view) {
    view.chipBox.removeAll(true);
    const kinds = [...new Set(view.unit.statuses.map((st) => st.type))];
    // An "every Nth attack" passive shows its count on the hero itself: after the (N-1)th attack the weapon
    // shines until the Nth goes off (a counter with a rotation shows the colour of the element that comes NEXT).
    const counter = view.unit.side === 'hero' && view.unit.alive ? view.unit.def.counter : null;
    const next = counter && counter.rotation ? counter.rotation[(view.unit.beatsFired || 0) % counter.rotation.length].color : null;
    view.ch.setGlow(counter && view.unit.counterCount >= counter.every - 1 ? Phaser.Display.Color.HexStringToColor(next || counter.color || '#c8a0ff').color : null);
    // Status ICONS (statusIcons.json) in rows of 3 over the health bar, rows going up (a hero's item dots move
    // up above them). Stacking statuses (bleed, burn, poison, chill) show their
    // stack count just right of the icon. The icon pops up a little when it arrives or gains a stack.
    const S = CHAR_SCALE;
    const list = iconList(statusIcons, kinds, (k) => (statusInfo[k] && (statusInfo[k].dot || statusInfo[k].stacking) ? this.state.stacks(view.unit, k) : 1), view.unit.steady ? ['steady'] : []);
    const before = view.iconCounts || {};
    view.iconCounts = {};
    view.icons = [];
    view.iconRows = Math.ceil(list.length / 3);
    for (const e of iconLayout(list)) {
      view.iconCounts[e.id] = e.n;
      const img = this.add.image(e.x * S, e.y * S, statusIconKey(this, e.id)).setScale(S);
      view.chipBox.add(img);
      const parts = [img];
      if (e.n > 1) {
        const num = this.add
          .text((e.x + ICON_PX / 2) * S, e.y * S + 1, String(e.n), { fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: '#ffffff', stroke: '#1a1020', strokeThickness: 3 })
          .setOrigin(0, 0.5);
        view.chipBox.add(num);
        parts.push(num);
      }
      if (before[e.id] !== e.n && (before[e.id] || 0) < e.n) this.tweens.add({ targets: parts, y: `-=${S}`, duration: 75, yoyo: true });
      view.icons.push({ id: e.id, parts });
    }
    // A status that has no icon yet still shows its old text tag, so nothing is ever hidden.
    let x = 0;
    const leftovers = kinds.filter((k) => !statusIcons[k] && statusInfo[k] && !statusInfo[k].instant);
    for (const k of leftovers) {
      const chip = this.add
        .text(x, -((Math.ceil(list.length / 3) || 0) * ICON_PX * S) - 10, statusInfo[k].label, { fontFamily: 'monospace', fontSize: '9px', fontStyle: 'bold', color: statusInfo[k].textColor, backgroundColor: statusInfo[k].color, padding: { x: 2, y: 1 } })
        .setOrigin(0, 0.5);
      view.chipBox.add(chip);
      x += chip.width + 3;
    }
  }

  // Makes a status icon blink in its last moments (every frame, from syncBar).
  blinkIcons(view) {
    if (!view.icons || !view.icons.length) return;
    const blinkOn = Math.floor(this.time.now / 100) % 2 === 1;
    for (const ic of view.icons) {
      const sts = view.unit.statuses.filter((st) => st.type === ic.id);
      const left = sts.length ? Math.max(...sts.map((st) => st.remaining)) : Infinity;
      const hide = blinkOn && left > 0 && left < 800;
      for (const p of ic.parts) p.setVisible(!hide);
    }
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

  // Who walks through the door with the squad: the living heroes, then any greater minions.
  livingHeroViews() {
    const heroes = this.state.heroes.filter((h) => h.alive).map((h) => this.views.get(h.uid));
    const greater = this.state.minions.filter((m) => m.greater && m.alive).map((m) => this.views.get(m.uid)).filter(Boolean);
    return [...heroes, ...greater];
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
          { x: DOOR_X, y: (v.slotY ?? SLOT_Y) + 70 },
          { x: v.slotX, y: v.slotY ?? SLOT_Y },
        ],
        {
          delay: this.lineDelay(i),
          onDone: () => {
            v.ch.setScale(CHAR_SCALE).setDepth(DEPTH.hero);
            v.ch.homeX = v.slotX;
            v.ch.homeY = v.slotY ?? SLOT_Y;
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
    const toLine = living.map((v) => Math.hypot(gather.x - v.slotX, gather.y - (v.slotY ?? SLOT_Y)));
    const base = Math.max(...toLine.map((len, i) => len - i * T.lineGapPx));
    living.forEach((v, i) => {
      this.walkPath(
        v,
        [{ x: v.slotX, y: v.slotY ?? SLOT_Y }, gather, { x: DOOR_X, y: WALL_H - 10 }],
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
    if (this.mode !== 'fighting') {
      this.drawStatusFx();
      return;
    }

    // Hit-stop: a big skill hit freezes the fight for a split second (the drawing keeps going).
    if (this.hitStop > 0) {
      this.hitStop -= delta;
      this.drawStatusFx();
      return;
    }
    // Cap the step so switching browser tabs doesn't cause a huge jump.
    const events = this.state.update(Math.min(delta, 100));
    for (const e of events) this.showEvent(e);
    this.followPositions();
    this.drawTornados();
    this.drawCastBars();
    this.drawTauntLines();
    this.drawStatusFx();

    const focus = this.state.focusUnit;
    if (focus) {
      const v = this.views.get(focus.uid);
      // The red circle stays under the enemy wherever it is now (it may have walked down to fight).
      this.focusMarker.setPosition(v.ch.x, v.ch.y + v.ch.hopOffset + (v.groundY - v.ch.homeY) + 6).setVisible(true);
    } else {
      this.focusMarker.setVisible(false);
    }

    if (this.state.allEnemiesDead()) this.onWin();
    else if (this.state.allHeroesDead()) this.onLoss();
  }

  showEvent(e) {
    if (e.type === 'attackStart') {
      const a = this.views.get(e.attacker.uid);
      const t = this.views.get(e.target.uid);
      if (!a || !t) return;
      a.lookAt = e.target; // it turns to face what it attacks
      // Melee: it already walked up (the fight rules move it), now it swings. Ranged: an arrow.
      if (e.attacker.damageType !== 'melee') this.shootArrow(a, t, e.hitInMs);
      else a.ch.swing(e.hitInMs);
    } else if (e.type === 'attackRetarget') {
      // Its target died while the arrow was flying: the arrow bends towards the new target.
      const a = this.views.get(e.attacker.uid);
      const t = this.views.get(e.target.uid);
      if (a && t && a.arrow && a.arrow.active) this.flyArrow(a, a.arrow, t, e.hitInMs);
    } else if (e.type === 'attackCancel') {
      const c = this.views.get(e.unit.uid);
      if (c) this.landArrow(c); // a cancelled shot vanishes
    } else if (e.type === 'attack') {
      const a = this.views.get(e.attacker.uid);
      const t = this.views.get(e.target.uid);
      if (e.basic) {
        // The walk/swing or the arrow already showed this attack. Melee fighters STAY where they are.
        this.landArrow(a); // the arrow reaches its target exactly as the damage lands
      } else if (!a.ch.moveTween) {
        a.ch.lunge(t.ch.x, t.ch.y); // skills and item hits: a small jab (only from its own spot)
      }
      if (e.result.invulnerable) {
        this.popText(t, 'Immune!', '#ffe08a', true);
        return;
      }
      if (e.result.dodged) {
        if (e.result.blocked) this.popText(t, 'Blocked!', '#9fc4ff', true);
        else this.popText(t, 'Miss', '#aaaaaa');
        return;
      }
      this.setBar(t);
      this.drawChips(t); // the shield tag shows what is left
      if (e.result.absorbed > 0) {
        this.popText(t, `Shield -${e.result.absorbed}`, '#6fd0ff');
        if (e.result.fullyAbsorbed) return;
        e.result = { ...e.result, amount: e.result.amount - e.result.absorbed };
      }
      const { amount, crit, mult } = e.result;
      const mark = mult > 1 ? '!' : mult < 1 ? '…' : '';
      if (e.skill) {
        // A skill hit: flashes in the skill colour and shows a big coloured number that pops.
        t.ch.flash(Phaser.Display.Color.HexStringToColor(FX.attackColor).color, FX.flashMs);
        t.ch.hurt();
        this.popText(t, `${amount}${mark}`, crit ? '#ffd24d' : FX.attackColor, true, FX.numberSizePx);
        return;
      }
      t.ch.flash();
      t.ch.hurt();
      const color = e.attacker.side === 'hero' ? damageTypes[e.damageType || e.attacker.damageType].color : '#ff6b6b';
      this.popText(t, `${amount}${mark}`, crit ? '#ffd24d' : color, crit);
    } else if (e.type === 'projectile') {
      this.showProjectile(this.views.get(e.from.uid), this.views.get(e.to.uid), e.kind);
    } else if (e.type === 'castStart') {
      // The hero winds up: its name pops up and a charge bar fills (see drawCastBars).
      this.popText(this.views.get(e.unit.uid), e.skill.name, '#9fc4ff');
      this.views.get(e.unit.uid).ch.castWindUp(e.castMs); // crouch and raise the weapon
    } else if (e.type === 'castCancel') {
      const cv = this.views.get(e.unit.uid);
      if (cv) cv.ch.castCancel();
      if (e.reason === 'interrupted') this.popText(this.views.get(e.unit.uid), 'Interrupted!', '#ff8a5c', true);
    } else if (e.type === 'cast') {
      const caster = this.views.get(e.unit.uid);
      this.skillBurst(caster, e);
      if (e.skill.leap && e.targets[0]) this.leapAt(caster, this.views.get(e.targets[0].uid)); // Savage Leap
      caster.ch.castRelease(e.skill.kind); // the skill's own animation (not the normal swing)
      if ((e.skill.target === 'enemy' || e.skill.target === 'allEnemies') && e.targets[0] && !e.skill.leap) {
        const t = this.views.get(e.targets[0].uid);
        caster.ch.lunge(t.ch.x, t.ch.y);
      }
    } else if (e.type === 'status') {
      const v = this.views.get(e.unit.uid);
      this.drawChips(v);
      if (e.change === 'expire' && e.status.type === 'freeze' && v && !e.unit.statuses.some((st) => st.type === 'freeze')) {
        (this.iceBreaks = this.iceBreaks || []).push({ view: v, start: this.time.now }); // the ice breaks off
      }
      if (e.change === 'apply' && e.status.type !== 'buff' && statusInfo[e.status.type].popup !== false) {
        this.popText(v, statusInfo[e.status.type].label + '!', statusInfo[e.status.type].color);
      }
      if (e.status.type === 'buff') this.drawAllBars();
      if (e.status.type === 'shield') this.setBar(v);
    } else if (e.type === 'itemUsed') {
      this.drawDots(this.views.get(e.unit.uid)); // a consumable was used up: one dot less
    } else if (e.type === 'wave') {
      // One wave of a channel (Rain of Arrows, Crescendo): a ring on the caster that grows with the wave.
      const v = this.views.get(e.unit.uid);
      if (v) {
        const c = this.center(v);
        const ring = this.add.circle(c.x, c.y, 10).setStrokeStyle(2 + e.wave, 0xffd84d).setDepth(DEPTH.popup - 1);
        this.tweens.add({ targets: ring, radius: 24 + e.wave * 10, alpha: 0, duration: 400, onComplete: () => ring.destroy() });
      }
    } else if (e.type === 'flask') {
      this.showFlask(this.views.get(e.unit.uid), this.views.get(e.target.uid), Number(e.flask.color));
    } else if (e.type === 'minionSpawn') {
      this.showMinion(e.unit);
    } else if (e.type === 'tornadoSpawn') {
      this.tornadoViews = this.tornadoViews || new Map();
      const g = this.add.container(0, 0).setDepth(DEPTH.popup - 2);
      for (let i = 0; i < 4; i++) {
        const w = 40 - i * 8;
        const r = this.add.rectangle(0, -i * 10, w, 6, 0xcfe8ff, 0.8 - i * 0.12);
        g.add(r);
        this.tweens.add({ targets: r, x: { from: -6, to: 6 }, duration: 160 + i * 40, yoyo: true, repeat: -1 });
      }
      this.tornadoViews.set(e.tornado.id, { g, t: e.tornado });
      this.puff(g.x, g.y, 0xcfe8ff, 4);
    } else if (e.type === 'tornadoEnd') {
      const tv = this.tornadoViews && this.tornadoViews.get(e.tornado.id);
      if (tv) {
        this.tornadoViews.delete(e.tornado.id);
        this.tweens.add({ targets: tv.g, alpha: 0, duration: 250, onComplete: () => tv.g.destroy() });
      }
    } else if (e.type === 'minionExplode') {
      const v = this.views.get(e.unit.uid);
      if (v) {
        this.puff(v.ch.x, v.ch.y - 8, 0xff8a3d, 8);
        const ring = this.add.circle(v.ch.x, v.ch.y - 8, 10).setStrokeStyle(3, 0xffb84d).setDepth(DEPTH.popup - 1);
        this.tweens.add({ targets: ring, radius: e.radius * 0.6, alpha: 0, duration: 350, onComplete: () => ring.destroy() });
      }
    } else if (e.type === 'minionVanish') {
      const v = this.views.get(e.unit.uid);
      if (!v) return;
      v.ch.stopMove();
      this.puff(v.ch.x, v.ch.y, 0x6a5a8a, 4);
      this.tweens.add({ targets: [v.ch, v.bg, v.fill, v.shieldFill, v.chipBox], alpha: 0, duration: 300, onComplete: () => this.removeView(e.unit.uid) });
    } else if (e.type === 'beat') {
      // The holder's weapon shines once charged (drawChips). When the Nth attack goes off: a flash on the attacker
      // and a big burst (rings, rays, sparks) on its target (or around the attacker for a heal beat).
      this.drawChips(this.views.get(e.holder.uid));
      if (!e.fired) return;
      const v = this.views.get(e.unit.uid);
      const color = Phaser.Display.Color.HexStringToColor(e.color || e.counter.color || '#c8a0ff').color;
      v.ch.flash(color, 160);
      const tv = e.counter.effect === 'empower' && e.target ? this.views.get(e.target.uid) : null;
      const c = this.center(tv || v);
      for (let i = 0; i < 2; i++) {
        const ring = this.add.circle(c.x, c.y, 8).setStrokeStyle(4 - i, i ? 0xffffff : color).setDepth(DEPTH.popup - 1);
        this.tweens.add({ targets: ring, radius: 60 - i * 20, alpha: 0, duration: 450, delay: i * 80, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
      }
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const ray = this.add.rectangle(c.x, c.y, 14, 3, color).setRotation(ang).setDepth(DEPTH.popup - 1);
        this.tweens.add({ targets: ray, x: c.x + Math.cos(ang) * 46, y: c.y + Math.sin(ang) * 46, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => ray.destroy() });
      }
      this.puff(c.x, c.y + 10, color, 6);
      this.cameras.main.shake(70, 0.002);
    } else if (e.type === 'deathBurst') {
      // An enemy bursts when it dies (Puffshroom poison cloud): a cloud that spreads to its radius.
      const v = this.views.get(e.unit.uid);
      const c = v ? this.center(v) : { x: e.unit.x, y: e.unit.y };
      const color = Phaser.Display.Color.HexStringToColor(e.color || '#6de07a').color;
      const cloud = this.add.circle(c.x, c.y, 10, color, 0.45).setDepth(DEPTH.popup - 2);
      this.tweens.add({ targets: cloud, radius: e.radius || 80, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => cloud.destroy() });
      this.puff(c.x, c.y + 8, color, 8);
    } else if (e.type === 'shieldBreak') {
      const v = this.views.get(e.unit.uid);
      this.drawChips(v);
      this.setBar(v);
      this.popText(v, 'Shield broken!', '#6fd0ff', true);
      this.cameras.main.shake(90, 0.003);
    } else if (e.type === 'proc') {
      this.popText(this.views.get(e.unit.uid), e.label, '#ffd24d', true);
    } else if (e.type === 'heal') {
      const v = this.views.get(e.unit.uid);
      this.setBar(v);
      this.popText(v, `+${Math.round(e.amount)}`, '#6dff8f');
    } else if (e.type === 'thorns') {
      const v = this.views.get(e.unit.uid);
      v.ch.flash();
      this.setBar(v);
      this.popText(v, `${e.amount} thorns`, '#e8a0ff');
    } else if (e.type === 'dot') {
      const v = this.views.get(e.unit.uid);
      this.setBar(v);
      this.drawChips(v);
      if (e.immune) {
        this.popText(v, 'Immune!', '#ffe08a');
        return;
      }
      if (e.absorbed > 0) this.popText(v, `Shield -${e.absorbed}`, '#6fd0ff');
      if (e.amount > 0) {
        v.ch.flash();
        this.popText(v, String(e.amount), damageTypes[e.damageType].color);
      }
    } else if (e.type === 'morale') {
      this.drawMoraleWash();
      for (const h of this.state.heroes) this.setBar(this.views.get(h.uid));
    } else if (e.type === 'levelup') {
      const v = this.views.get(e.unit.uid);
      this.setLabel(v);
      this.setBar(v);
      this.popText(v, `Level up! Lv${e.unit.level}`, '#ffd24d', true);
    } else if (e.type === 'death') {
      const v = this.views.get(e.unit.uid);
      this.setBar(v);
      if (e.unit.side === 'enemy' || e.unit.minion) {
        v.ch.stopMove(); // it fades out where it fell
        v.ch.castCancel();
        v.ch.die(); // death clip (if it has one) while it fades
        this.drawChips(v);
        this.tweens.add({ targets: [v.ch, v.bg, v.fill, v.shieldFill], alpha: 0, duration: 400, onComplete: () => this.removeView(e.unit.uid) });
      } else {
        // A hero who falls while away at an enemy is put back in its slot.
        v.ch.stopMove();
        v.ch.setPosition(v.ch.homeX, v.ch.homeY).setDepth(DEPTH.hero);
        this.syncBar(v);
        v.ch.die(); // death clip if it has one, then it stops moving
        v.perkLabel.setText('perk lost');
        v.ch.setAlpha(0.25);
        v.skillButtons.forEach((b) => [b.g, b.code, b.cd].forEach((o) => o.setAlpha(0)));
        v.bg.setAlpha(0.4);
        v.fill.setAlpha(0.4);
        if (v.dots) v.dots.setAlpha(0.4);
        this.drawChips(v);
        this.drawAllBars(); // squad items from this hero stop working, so max health may change
      }
    }
  }

  // ---- hero attack motion (melee run-up, arrows) --------------------------------------------

  // A hero walks back to its slot after a win, at the normal walking speed.
  runHome(v) {
    if (!v) return;
    v.ch.y += v.ch.hopOffset; // land first if it was mid-hop
    v.ch.hopOffset = 0;
    const dist = Math.hypot(v.ch.homeX - v.ch.x, v.ch.homeY - v.ch.y);
    if (dist < 1) return;
    v.ch.moveTo(v.ch.homeX, v.ch.homeY, (dist / combatRules.movement.walkSpeedPxPerSec) * 1000, {
      hop: { height: M.hopHeight, length: M.hopLengthPx },
      onUpdate: () => this.syncBar(v),
      onDone: () => {
        if (v.unit.side === 'hero') v.ch.setDepth(DEPTH.hero);
        this.syncBar(v);
      },
    });
  }

  // A ranged fighter's basic attack: an arrow that flies to the target and arrives as the hit lands.
  // The middle of a fighter's body right now (where shots aim): above its feet, wherever it stands.
  center(v) {
    return { x: v.ch.x, y: v.ch.y + v.ch.hopOffset - (v.unit.def.height * v.ch.scaleY) / 2 };
  }

  shootArrow(a, t, hitInMs) {
    const from = this.center(a);
    // Placeholder arrow: a shaft with a small head (real art later).
    const arrow = this.add.container(from.x, from.y, [
      this.add.rectangle(-4, 0, 22, 3, Number(a.unit.damageType !== 'ranged' && damageTypes[a.unit.damageType] ? Phaser.Display.Color.HexStringToColor(damageTypes[a.unit.damageType].color).color : M.arrowColor)),
      this.add.triangle(9, 0, 0, -4, 0, 4, 7, 0, 0xffffff),
    ]).setDepth(DEPTH.popup - 1);
    a.arrow = arrow;
    this.flyArrow(a, arrow, t, hitInMs);
    a.ch.lunge(t.ch.x, t.ch.y); // a small recoil-like jab as it shoots
  }

  // Flies an arrow from where it is now to a target (which may move), arriving after `ms`.
  // Called again with a new target if the old one dies while the arrow is in the air.
  flyArrow(a, arrow, t, ms) {
    if (arrow.flight) arrow.flight.stop();
    const fromX = arrow.x;
    const fromY = arrow.y;
    arrow.flight = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: Math.max(1, ms),
      onUpdate: (tween) => {
        const p = tween.getValue();
        const to = this.center(t); // aims at where the target is NOW, so it always hits
        arrow.setPosition(fromX + (to.x - fromX) * p, fromY + (to.y - fromY) * p);
        arrow.rotation = Math.atan2(to.y - fromY, to.x - fromX);
      },
      onComplete: () => this.landArrow(a),
    });
  }

  // The arrow is used up (it hit, or it was cancelled).
  landArrow(a) {
    if (!a.arrow) return;
    if (a.arrow.flight) a.arrow.flight.stop();
    a.arrow.destroy();
    a.arrow = null;
  }

  // Placeholder projectiles: a fire bomb flies to its target (and follows it), lightning is a zig-zag
  // line between the two fighters (drawn where they stand now) that fades.
  // A flask lobbed in an arc from the thrower to the target, in the flask's colour.
  showFlask(from, to, color) {
    if (!from || !to) return;
    const start = this.center(from);
    const f = this.add.circle(start.x, start.y, 5, color).setStrokeStyle(2, 0x20242c).setDepth(DEPTH.popup);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 360,
      onUpdate: (tween) => {
        const p = tween.getValue();
        const now = this.center(to);
        f.setPosition(start.x + (now.x - start.x) * p, start.y + (now.y - start.y) * p - Math.sin(p * Math.PI) * 40);
      },
      onComplete: () => {
        const at = this.center(to);
        f.destroy();
        const splash = this.add.circle(at.x, at.y, 6, color, 0.7).setDepth(DEPTH.popup - 1);
        this.tweens.add({ targets: splash, radius: 26, alpha: 0, duration: 420, onComplete: () => splash.destroy() });
      },
    });
  }

  showProjectile(from, to, kind) {
    if (!from || !to) return;
    const start = this.center(from);
    const end = this.center(to);
    if (kind === 'rain') {
      // Rain of Arrows: an arrow drops from above onto the target.
      const a = this.add.container(end.x + Phaser.Math.Between(-8, 8), end.y - 130, [this.add.rectangle(0, -4, 3, 20, Number(M.arrowColor)), this.add.triangle(0, 8, -4, 0, 4, 0, 0, 8, 0xffffff)]).setDepth(DEPTH.popup);
      this.tweens.add({ targets: a, y: end.y, duration: 230, ease: 'Quad.easeIn', onComplete: () => a.destroy() });
      return;
    }
    if (kind === 'note') {
      // Crescendo: a music note floats up from the bard to the target.
      const n = this.add.text(start.x, start.y, '♪', { fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold', color: '#ffd84d', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(DEPTH.popup);
      this.tweens.add({ targets: n, x: end.x, y: end.y, duration: 320, ease: 'Sine.easeOut', onComplete: () => n.destroy() });
      return;
    }
    if (kind === 'crescent') {
      // Wind Cutter: a pale crescent wave sweeping to the target.
      const c = this.add.arc(start.x, start.y, 16, 120, 240, false, 0xe8f4ff, 0.9).setStrokeStyle(2, 0xffffff).setDepth(DEPTH.popup);
      c.rotation = Math.atan2(end.y - start.y, end.x - start.x) + Math.PI;
      this.tweens.add({ targets: c, x: end.x, y: end.y, scale: 1.8, alpha: 0.2, duration: 300, onComplete: () => c.destroy() });
      return;
    }
    if (kind === 'fireball' || kind === 'darkbolt' || kind === 'holybolt' || kind === 'greenfire') {
      const color = { fireball: 0xff7a3d, darkbolt: 0x9b5fe0, holybolt: 0xfff2a0, greenfire: 0x6bff7a }[kind];
      const b = this.add.circle(start.x, start.y, kind === 'fireball' ? 9 : 7, color).setStrokeStyle(2, 0xffffff, 0.8).setDepth(DEPTH.popup);
      this.tweens.add({ targets: b, x: end.x, y: end.y, duration: 320, ease: 'Quad.easeIn', onComplete: () => { const boom = this.add.circle(end.x, end.y, 8, color, 0.8).setDepth(DEPTH.popup - 1); this.tweens.add({ targets: boom, radius: 28, alpha: 0, duration: 300, onComplete: () => boom.destroy() }); b.destroy(); } });
      return;
    }
    if (kind === 'lightning') {
      const g = this.add.graphics().setDepth(DEPTH.popup);
      g.lineStyle(3, 0xffe94d, 1).beginPath().moveTo(start.x, start.y);
      for (let i = 1; i < 5; i++) g.lineTo(start.x + ((end.x - start.x) * i) / 5 + Phaser.Math.Between(-10, 10), start.y + ((end.y - start.y) * i) / 5 + Phaser.Math.Between(-10, 10));
      g.lineTo(end.x, end.y).strokePath();
      this.tweens.add({ targets: g, alpha: 0, duration: 350, onComplete: () => g.destroy() });
      return;
    }
    if (kind === 'knife') {
      // A small throwing knife that spins as it flies straight to its target.
      const k = this.add.rectangle(start.x, start.y, 11, 3, 0xdfe6ee).setStrokeStyle(1, 0x20242c).setDepth(DEPTH.popup);
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 200,
        onUpdate: (tween) => {
          const p = tween.getValue();
          const now = this.center(to);
          k.setPosition(start.x + (now.x - start.x) * p, start.y + (now.y - start.y) * p);
          k.rotation = p * 14;
        },
        onComplete: () => k.destroy(),
      });
      return;
    }
    const b = this.add.circle(start.x, start.y, 5, 0xff7a3d).setStrokeStyle(2, 0xffd24d).setDepth(DEPTH.popup);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 280,
      onUpdate: (tween) => {
        const p = tween.getValue();
        const now = this.center(to); // follows the target, so the bomb always lands on it
        b.setPosition(start.x + (now.x - start.x) * p, start.y + (now.y - start.y) * p - Math.sin(p * Math.PI) * 24);
      },
      onComplete: () => b.destroy(),
    });
  }

  drawAllBars() {
    for (const h of this.state.heroes) this.setBar(this.views.get(h.uid));
  }

  setLabel(view) {
    view.label.setText(`${view.unit.name} Lv${view.unit.level}`);
    // e.g. "Team +10% HP" (the hero's perk; it grows with the hero's level)
    const unit = view.unit;
    const bits = perkMods(unit).map((m) => `${m.percent !== undefined ? `+${Math.round(m.percent * 10) / 10}%` : `+${Math.round(m.flat * 10) / 10}`} ${STAT_SHORT[m.stat] || SPECIAL_SHORT[m.special] || m.special}`);
    view.perkLabel.setText(unit.def.perk ? `Team ${bits.join(' ')}` : '');
  }

  setBar(view) {
    view.fill.width = BAR_WIDTH * (view.unit.hp / view.unit.maxHp);
    view.shieldFill.width = Math.min(BAR_WIDTH, BAR_WIDTH * (this.state.shieldAmount(view.unit) / view.unit.maxHp));
  }

  removeView(uid) {
    const v = this.views.get(uid);
    if (!v) return;
    v.ch.destroy();
    v.bg.destroy();
    v.fill.destroy();
    v.shieldFill.destroy();
    if (v.dots) v.dots.destroy();
    v.chipBox.destroy();
    this.views.delete(uid);
  }

  // Floating number above a fighter.
  // Savage Leap: the hero jumps at the target in an arc and lands back in his spot.
  leapAt(caster, target) {
    if (!target) return;
    const dx = (target.ch.x - caster.ch.x) * 0.8;
    const dy = (target.ch.y - caster.ch.y) * 0.8;
    const jump = { p: 0 };
    const set = () => {
      caster.leapX = dx * jump.p;
      caster.leapY = dy * jump.p;
      caster.leapLift = Math.sin(jump.p * Math.PI) * 26;
    };
    this.tweens.add({ targets: jump, p: 1, duration: 230, ease: 'Quad.easeOut', onUpdate: set, onComplete: () => this.tweens.add({ targets: jump, p: 0, duration: 300, delay: 120, ease: 'Quad.easeInOut', onUpdate: set, onComplete: () => { caster.leapX = caster.leapY = caster.leapLift = 0; } }) });
  }

  // A skill goes off: the caster flashes in the skill colour, a ring bursts (on each target for an
  // attack skill, around the caster for a support skill) and the skill's name shows as a banner.
  // Attack skills also shake the screen and freeze the fight for a split second (hit-stop).
  skillBurst(caster, e) {
    const attack = e.skill.kind === 'attack';
    const colorText = attack ? FX.attackColor : FX.supportColor;
    const color = Phaser.Display.Color.HexStringToColor(colorText).color;
    caster.ch.flash(color, FX.flashMs);
    const spots = attack || e.skill.target === 'squad' || e.skill.target === 'enemy' || e.skill.target === 'lowestAlly' ? e.targets.map((t) => this.views.get(t.uid)).filter(Boolean) : [caster];
    for (const v of spots) {
      const c = this.center(v);
      const ring = this.add.circle(c.x, c.y, 10).setStrokeStyle(4, color).setDepth(DEPTH.popup - 1);
      this.tweens.add({ targets: ring, radius: FX.ringRadius, alpha: 0, duration: FX.ringMs, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    }
    const banner = this.add
      .text(GAME_WIDTH / 2, FX.bannerY, e.skill.name, { fontFamily: 'monospace', fontSize: '24px', fontStyle: 'bold', color: colorText, stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(DEPTH.popup + 1)
      .setScale(0.5);
    this.tweens.add({ targets: banner, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: banner, alpha: 0, y: FX.bannerY - 16, delay: FX.bannerMs * 0.6, duration: FX.bannerMs * 0.4, onComplete: () => banner.destroy() });
    // A skill that puts statuses on every enemy (Smoke Bomb) also shows a grey cloud on each of them.
    if (e.skill.applyEnemies) for (const en of this.state.enemies) if (en.alive && this.views.get(en.uid)) this.puff(this.views.get(en.uid).ch.x, this.views.get(en.uid).ch.y, 0x9a9aa8, 6);
    if (attack) {
      this.cameras.main.shake(FX.shakeMs, FX.shakeIntensity);
      this.hitStop = FX.hitStopMs;
    }
  }

  popText(view, text, color, big = false, sizePx = null) {
    // Pop-ups that appear together stack upwards instead of overlapping.
    view.popSlot = ((view.popSlot ?? -1) + 1) % 4;
    // Above where the fighter is right now (a hero may be away at an enemy).
    const y = view.ch.y + view.ch.hopOffset - view.unit.def.height * CHAR_SCALE - 22 - view.popSlot * 15;
    const t = this.add
      .text(view.ch.x, y, text, {
        fontFamily: 'monospace',
        fontSize: sizePx ? `${sizePx}px` : big ? '20px' : '14px',
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.popup);
    t.x = Phaser.Math.Clamp(t.x, t.width / 2 + 4, GAME_WIDTH - t.width / 2 - 4); // keep it on screen
    if (sizePx) {
      t.setScale(1.5); // skill numbers pop in big, then settle
      this.tweens.add({ targets: t, scale: 1, duration: 150, ease: 'Back.easeOut' });
    }
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: sizePx ? 1000 : 800, onComplete: () => t.destroy() });
  }

  onWin() {
    this.mode = 'won';
    for (const e of this.state.endFloor()) this.showEvent(e); // weak minions vanish with the floor
    if (this.castBars) this.castBars.clear(); // a wind-up still going is dropped
    if (this.tauntLines) this.tauntLines.clear();
    this.focusMarker.setVisible(false);
    this.banner.setText(`Floor ${this.floor} cleared!`);
    this.layer.setDoorOpen(true);

    this.state.clearStatuses();
    for (const h of this.state.heroes) {
      const v = this.views.get(h.uid);
      v.lookAt = null;
      if (h.alive) v.ch.face(1); // look the normal way again
      if (h.alive) {
        v.ch.setStunned(false);
        v.ch.cheer(); // victory clip (if it has one)
      }
      if (h.alive) this.runHome(v); // anyone still out at an enemy walks back before the door walk
      this.drawChips(v);
    }
    for (const m of this.state.minions) {
      const mv = this.views.get(m.uid);
      if (m.greater && m.alive && mv) {
        mv.lookAt = null;
        mv.ch.face(1);
        this.runHome(mv); // a greater minion walks back to its waiting spot too
      }
    }
    for (const { unit, amount } of this.state.winHeal(combatRules.winHealPercent)) {
      const v = this.views.get(unit.uid);
      this.setBar(v);
      if (Math.round(amount) > 0) this.popText(v, `+${Math.round(amount)}`, '#6dff8f');
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
    const choices = rollChoices({ itemDefs, rules: rewardRules, floor: this.floor, count: rewardRules.choices, heroes: this.state.heroes, potionChance: rewardRules.potionChance });
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
      if (Math.round(amount) > 0) this.popText(v, `+${Math.round(amount)}`, '#6dff8f', true);
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
    // Save the run (floor reached, enemies defeated) and see which heroes it unlocked.
    const progress = loadProgress();
    const before = unlockedIds(allHeroDefs, progress, unlocks);
    recordRun(progress, { floor: this.floor, kills: this.state.kills || 0 });
    saveProgress(progress);
    const newly = unlockedIds(allHeroDefs, progress, unlocks).filter((id) => !before.includes(id));
    const lastRun = { floor: this.floor, kills: this.state.kills || 0, newly };
    this.time.delayedCall(combatRules.restartDelayMs, () => this.scene.start('Squad', { lastRun }));
  }
}
