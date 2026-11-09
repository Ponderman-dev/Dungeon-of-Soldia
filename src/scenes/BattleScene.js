import Phaser from 'phaser';
import { GAME_WIDTH, UI } from '../config.js';
import { drawWindow, uiText } from '../entities/uiKit.js';
import allHeroDefs from '../data/heroes.json';
import squadIds from '../data/squad.json';
import { DEMO, demoSquad } from './demoMode.js';
import enemyDefs from '../data/enemies.json';
import minionDefs from '../data/minions.json';
import dungeons from '../data/dungeons.json';
import combatRules from '../data/combat.json';
import damageTypes from '../data/damageTypes.json';
import leveling from '../data/leveling.json';
import statusInfo from '../data/statuses.json';
import Character from '../entities/Character.js';
import Door from '../entities/Door.js';
import { floorTextureKey, FLOOR_PIXEL } from '../entities/floorTexture.js';
import floorArt from '../data/floorArt.json';
import * as sfx from '../audio/sfx.js';
import { bodyBox } from '../systems/statusFx.js';
import BattleState from '../systems/BattleState.js';
import { validateDungeon, validateHeroSkills, validateDamageTypes } from '../systems/validate.js';
import { enemiesForFloor, monsterHouse } from '../systems/dungeon.js';
import { enemySpots } from '../systems/formation.js';
import { pickSquad } from '../systems/party.js';
import { newRunStats } from '../systems/runStats.js';
import { newSeenBuffer } from '../systems/glossary.js';
import { DUNGEON_ID, ENEMY_Y, BAR_WIDTH, WALL_H, DOOR_X, T, M, itemDefs, skillDefs, BANNER_Y, charScale, DEPTH } from './battle/shared.js';
import { roomMethods } from './roomMethods.js';
import { hudMethods } from './battle/hud.js';
import { ordersMethods } from './battle/orders.js';
import { effectsMethods } from './battle/effects.js';
import { walkMethods } from './battle/walk.js';
import { eventsMethods } from './battle/events.js';
import { motionMethods } from './battle/motion.js';
import { bossViewMethods } from './battle/bossView.js';
import { resultsMethods } from './battle/results.js';

// The battle screen: enemies at the top, the squad (3 heroes) at the bottom, everyone auto-attacks.
// After a win the heroes walk through the door, the floor slides down, and they walk in
// from the bottom of the screen. The fight rules live in systems/BattleState.js; this scene
// only draws what happens.
//
// THIS FILE is the core: create(), building a floor, making fighter views, update(). The rest of the drawing is in
// ./battle/*.js (hud, orders, effects, walk, events, motion, bossView, results; shared.js = the constants) and
// roomMethods.js (special rooms): all mixed into BattleScene.prototype at the bottom of this file.
export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  create() {
    this.lastKiller = null; // the enemy that felled the last hero (defeat screen)
    this.speech = null; // the speech bubble on screen (sayLine)
    this.speechMemory = {}; // who spoke last, lines already said (systems/dialogue.js), for the whole run
    this.saidStart = false; // the run's first floor gets a 'start' line (roomMethods.beginFloor)
    // Drawing layers made on first use: a new run (scene started again) must make new ones, the old ones were destroyed
    // with the last run (bug: on a second run status effects, hits, elites, bombs... were drawn on dead layers).
    for (const k of ['arrowG', 'bombG', 'bombTopG', 'castBars', 'crownG', 'eliteG', 'heroHud', 'hitG', 'orderG', 'statusG', 'tauntLines']) this[k] = null;
    this.orderDrag = null;
    this.orderInput = false; // the scene's input listeners are gone too
    this.fxList = [];
    this.iceBreaks = [];
    this.applySettings();
    // The squad: from squad.json, or the one the TEST squad button picked (registry `squadIds`).
    const demo = !!DEMO;
    const heroDefs = pickSquad(allHeroDefs, demo ? demoSquad.heroes.map((h) => h.id) : this.registry.get('squadIds') || squadIds); // the demo page always uses its saved squad
    this.slotWidth = GAME_WIDTH / heroDefs.length;
    this.dungeon = dungeons[DUNGEON_ID];
    for (const problem of validateDungeon(this.dungeon, enemyDefs)) console.error('Dungeon data:', problem);
    for (const problem of validateHeroSkills(heroDefs, skillDefs)) console.error('Hero skills:', problem);
    for (const problem of validateDamageTypes({ heroDefs, enemyDefs, skillDefs, itemDefs }, damageTypes)) console.error('Damage types:', problem);

    this.floor = 1;
    this.director = {}; // the floor director's memory (last shape and swing, dungeon.js directFloor)
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
    this.runStats = newRunStats(this.state.heroes); // per-hero damage, healing, kills... for the game-over summary (systems/runStats.js)
    this.runStartedAt = Date.now();
    this.seenBuf = newSeenBuffer(); // what the Glossary learns this run (saved at each floor clear and at the end)
    // A demo page: the squad exactly as the smart player had it before the demo floor (src/data/demoSquad.json,
    // made by scripts/tests/make-demo-squad.mjs): its levels, items and skill pages.
    if (demo) {
      this.state.heroes.forEach((h, i) => {
        const saved = demoSquad.heroes[i];
        while (h.level < saved.level) this.state.levelUp(h);
        for (const id of saved.items) this.state.giveItem(h.uid, id);
        saved.pages.forEach((pages, k) => { for (const page of pages) this.state.addPage(h.uid, k, page); });
      });
      for (const h of this.state.heroes) h.hp = h.maxHp;
    }
    // TEST tools (testPanel.js): a floor jump restarts the scene; the squad keeps its levels, items and skill pages.
    const jump = this.registry.get('testJump');
    this.registry.remove('testJump');
    this.testRoom = jump ? { floor: jump.floor, kind: jump.room } : null;
    if (jump) {
      this.state.heroes.forEach((h, i) => {
        const saved = jump.heroes[i];
        if (!saved) return;
        while (h.level < saved.level) this.state.levelUp(h);
        for (const id of saved.items) this.state.giveItem(h.uid, id);
        saved.pages.forEach((pages, k) => { for (const page of pages) this.state.addPage(h.uid, k, page); });
      });
      for (const h of this.state.heroes) h.hp = h.maxHp;
    }

    this.drawHeroSlots();
    // The floor counter: a small black window in the top-left corner (the interface look, entities/uiKit.js).
    this.floorBox = drawWindow(this.add.graphics().setDepth(DEPTH.hud), 8, 8, 160, 32);
    this.floorText = uiText(this, 20, 25, '', 'normal')
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.hud);
    this.drawControls(); // pause + battle speed, top right
    this.banner = this.add
      .text(GAME_WIDTH / 2, BANNER_Y, '', { fontFamily: UI.font, fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 4, align: 'center', wordWrap: { width: GAME_WIDTH - 32, useAdvancedWrap: true } }) // long lines wrap instead of running off the screen
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    // Any tap closes an open passive text (not the tap that opened it: same moment).
    this.input.on('pointerdown', () => { if (this.passiveTip && this.passiveTip.active && this.time.now !== this.passiveTip.shownAt) this.hidePassive(); });
    // MOVE ORDERS: a tap on the empty fight floor = the whole squad walks there (see floorTap).
    this.input.on('pointerdown', (p, over) => { this.floorPress = { x: p.worldX, y: p.worldY, free: over.length === 0 && !this.passiveTip?.active }; });
    this.input.on('pointerup', (p) => this.floorTap(p));
    this.dangerGlow = this.add.graphics().setDepth(DEPTH.heroBar - 0.5); // low-health glow at the bottom edge (drawDangerGlow)
    this.focusMarker = this.add.ellipse(0, 0, 70, 18).setStrokeStyle(2, 0xff4d4d).setVisible(false).setDepth(DEPTH.marker);

    this.showSlots(false, 0);
    // Dev server only: ?floor=N starts the run on floor N (browser checks of deep floors).
    const startAt = import.meta.env.DEV && Number(new URLSearchParams(location.search).get('floor'));
    if (startAt > 1) this.floor = startAt;
    if (demo) this.floor = demoSquad.floor;
    if (jump) this.floor = jump.floor;
    this.layer = this.buildFloor(this.floor, 0);
    this.floorText.setText(`Floor ${this.floor}`);
    this.beginFloor(); // a fight, or a special room (roomMethods.js)
  }

  // The name labels under the heroes are hidden while the floor changes.
  showSlots(show, duration = 250) {
    for (const h of this.state.heroes) {
      const v = this.views.get(h.uid);
      // A fallen hero's labels stay dim and have no skill squares.
      this.tweens.add({ targets: v.dots, alpha: show ? (h.alive ? 1 : 0.3) : 0, duration }); // the item icons under the skills
      const buttons = [...v.skillButtons.flatMap((b) => [b.g, b.code, b.cd]), ...(v.passiveIcon ? [v.passiveIcon] : [])];
      this.tweens.add({ targets: buttons, alpha: show && h.alive ? 1 : 0, duration });
    }
  }

  // After the survivors go through the door, the fallen heroes are gone from the screen.
  removeFallenHeroes() {
    for (const h of this.state.heroes) {
      if (h.alive) continue;
      const v = this.views.get(h.uid);
      v.ch.setVisible(false);
      if (v.grave) v.grave.setVisible(false);
      this.setBarsVisible(v, false);
    }
  }

  startFighting() {
    // A boss floor: the boss roars and the screen shakes first, then a short wait before the fight starts.
    const bossViews = [...this.views.values()].filter((v) => v.unit.side === 'enemy' && v.unit.def.boss && v.unit.alive);
    if (bossViews.length && !this.bossIntroDone) {
      this.bossIntroDone = true;
      this.bossRoar(bossViews[0]);
      this.time.delayedCall(T.bossIntro.waitMs, () => this.startFighting());
      return;
    }
    this.bossIntroDone = false;
    this.aliveAtStart = this.livingHeroViews().length; // after the fight: did a squad mate fall? (the 'fallen' lines)
    this.showSlots(true);
    // Enemy health bars and tags leave their floor (they slid in with it) and go on top of every
    // fighter, like the heroes' bars, so a character never covers a bar.
    for (const v of this.views.values()) {
      if (v.unit.side !== 'enemy') continue;
      // The enemy itself leaves its floor too: from now on heroes and enemies are drawn in ONE order (lower on
      // the screen = in front), so a hero standing behind a big boss is drawn behind it.
      const fp = v.ch.parentContainer;
      if (fp) {
        fp.remove(v.ch);
        v.ch.setPosition(v.ch.x + fp.x, v.ch.y + fp.y);
        this.add.existing(v.ch);
        v.ch.setDepth(DEPTH.hero + v.ch.y / 10000);
      }
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
    if (this.state.monsterHouse) this.monsterHouseBanner();
    else for (const v of this.views.values()) if (v.unit.elite && v.unit.alive) this.eliteName(v); // "Burning Vampiric Bandit"
    if (this.state.enemies.some((u) => u.def.boss)) sfx.play('bossIntro'); // a deep gong when the boss fight starts (after the roar)
    for (const e of this.state.startFloor()) this.showEvent(e); // floor-start minions rise (Necromancer)
  }

  // TEST tools (testPanel.js): start floor `floor` again with this squad (`room`: null = the game picks, 'fight', or a room kind).
  testJump(floor, room) {
    const heroes = this.state.heroes.map((h) => ({ level: h.level, items: h.items.slice(), pages: h.skills.map((k) => (k.pages || []).slice()) }));
    this.registry.set('testJump', { floor, room, heroes });
    this.scene.stop('Reward');
    this.scene.stop('Puzzle');
    this.scene.restart();
  }

  testLevelUp() {
    for (const h of this.state.heroes) {
      if (!h.alive) continue;
      this.state.levelUp(h);
      const v = this.views.get(h.uid);
      if (v.lvl) v.lvl.setText(`Lv${h.level}`);
    }
    this.drawAllBars();
  }

  testHeal() {
    for (const h of this.state.heroes) if (h.alive) h.hp = h.maxHp;
    this.drawAllBars();
  }

  // A minion rises from the ground: a dark puff, the figure grows up out of the floor, then its bars show.
  showMinion(unit) {
    sfx.play('minionSummon');
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

  followPositions() {
    for (const v of this.views.values()) {
      const u = v.unit;
      if (!u.alive || u.x === undefined || v.ch.lunging) continue;
      const hover = u.flying ? u.def.hover || 0 : 0;
      // Hop only at walking pace: a crowd's small shoves don't lift it (Grukk used to hang mid-hop, 'floating'),
      // and the hop sinks smoothly back to the ground when it stops.
      const full = combatRules.movement.walkSpeedPxPerSec * M.hopFullSpeedShare;
      const want = u.moving ? Math.min(1, (u.speed || 0) / full) : 0;
      const was = v.hopAmt || 0;
      v.hopAmt = was + (want - was) * Math.min(1, this.game.loop.delta / (want > was ? M.hopStartMs : M.hopEaseMs)); // starts slowly: a one-frame step doesn't lift it
      v.ch.hopOffset = Math.abs(Math.sin((u.walked / M.hopLengthPx) * Math.PI)) * M.hopHeight * v.hopAmt;
      v.ch.setPosition(u.x + (v.leapX || 0) + (v.stepX || 0), u.y + (v.leapY || 0) + (v.stepY || 0) - hover - v.ch.hopOffset - v.ch.castLift - (v.leapLift || 0));
      // Look at whoever it is fighting (so the weapon swings towards it).
      const foe = (u.pending && u.pending.target) || (this.views.get(u.foe) || {}).unit || v.lookAt;
      if (foe && foe.alive && foe.x !== undefined && Math.abs(foe.x - u.x) > 6) v.ch.face(foe.x < u.x ? -1 : 1);
      v.ch.setWalking(!!u.moving || !!v.ch.moveTween); // walk clip (if it has one)
      v.ch.setStunned(this.state.isStunned(u)); // stunned clip (if it has one)
      v.ch.setDepth(DEPTH.hero + u.y / 10000); // heroes, minions and enemies: lower on the screen = in front
      this.syncBar(v);
    }
  }

  // Draws one fighter: the character, plus a health bar above it.
  // Enemies are added to `parent` (their floor) so they slide with it.
  makeView(unit, x, groundY, parent = null) {
    const hover = unit.flying ? unit.def.hover || 0 : 0;
    const ch = new Character(this, x, groundY - hover, unit.def);
    const barY = groundY - hover - unit.def.height * charScale(unit.def) - 10;
    const bg = this.add.rectangle(x, barY, BAR_WIDTH + 2, 7, 0x000000);
    const fill = this.add
      .rectangle(x - BAR_WIDTH / 2, barY, BAR_WIDTH, 5, unit.side === 'hero' ? 0x4cd16a : 0xe04b4b)
      .setOrigin(0, 0.5);
    // A thin light-blue bar above the health bar: how much shield is left (full width = max health).
    const shieldFill = this.add.rectangle(x - BAR_WIDTH / 2, barY - 5, 0, 3, 0x6fd0ff).setOrigin(0, 0.5).setStrokeStyle(1, 0x103050);
    const view = { unit, ch, bg, fill, groundY, shieldFill };
    // Status icons (statusIcons.json, rows of 3) next to the bars.
    view.chipBox = this.add.container(x, barY - 18);
    // A hero's level, just left of its health bar ("Lv3").
    if (unit.side === 'hero' && !unit.minion) {
      view.lvl = this.add
        .text(x - BAR_WIDTH / 2 - 3, barY, `Lv${unit.level}`, { fontFamily: UI.font, fontSize: '8px', color: '#ffd24d', stroke: '#000000', strokeThickness: 3 })
        .setOrigin(1, 0.5)
        .setDepth(DEPTH.heroBar);
    }
    this.views.set(unit.uid, view);

    if (unit.side === 'enemy') {
      // Tap an enemy to focus it.
      const h = unit.def.height;
      const w = Math.max(32, bodyBox(unit.def.parts, h).hw * 2 + 6); // big bosses are wider
      ch.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h - 2, w, h + 4), Phaser.Geom.Rectangle.Contains);
      ch.on('pointerdown', () => this.state.setFocus(unit.uid));
    }
    if (unit.side === 'hero' && !unit.minion) {
      // Press a hero and drag to an enemy: only that hero attacks it (drag orders, see startOrderDrag).
      const h = unit.def.height;
      ch.setInteractive(new Phaser.Geom.Rectangle(-18, -h - 4, 36, h + 8), Phaser.Geom.Rectangle.Contains);
      ch.on('pointerdown', (pointer) => this.startOrderDrag(view, pointer));
    }
    if (parent) parent.add([ch, bg, fill, shieldFill, view.chipBox]);
    return view;
  }

  // Builds one floor: back wall, door, tiled ground and the enemies. yOffset places it off-screen.
  buildFloor(n, yOffset) {
    const container = this.add.container(0, yOffset).setDepth(DEPTH.floor);
    // (kept for the floor slide; the heroes now fade out in the doorway instead of being covered)
    const front = this.add.container(0, yOffset).setDepth(DEPTH.doorFront);
    // The floor's pixel art (old flagstones, dirt, grass; a brick wall with pillars): entities/floorTexture.js.
    const colors = this.dungeon.tileColors;
    const tint = colors[(n - 1) % colors.length];
    const variant = Math.floor((n - 1) / colors.length) % floorArt.variants;
    container.add(this.add.image(0, 0, floorTextureKey(this, tint, variant, WALL_H)).setOrigin(0).setScale(FLOOR_PIXEL));

    // The door in the back wall: closed wooden doors that swing open when the floor is cleared.
    const door = new Door(this, container, DOOR_X, WALL_H);

    // A special room (treasure, Mimic, fountain, dealer, puzzle) has props instead of enemies.
    const kind = this.roomKindFor(n);
    const room = kind ? this.buildRoom(kind, container) : null;
    const lineUp = room ? [] : enemiesForFloor(this.dungeon, n, Math.random, this.director, enemyDefs);
    // Dev server only: `?house=1` makes every directed fight a Monster House.
    const devHouse = import.meta.env.DEV && new URLSearchParams(location.search).get('house') && n >= this.dungeon.director.fromFloor;
    // The MONSTER HOUSE DEMO page (`npm run build:house-demo`, VITE_DEMO=house): it starts on floor 61 with a real squad
    // (demoSquad.json) and EVERY fight floor is a Monster House (boss floors stay boss fights).
    const demo = DEMO === 'house';
    if ((devHouse || demo) && !room && !lineUp.monsterHouse && !(this.dungeon.bosses || {})[n]) {
      const always = { ...this.dungeon, director: { ...this.dungeon.director, monsterHouse: { ...this.dungeon.director.monsterHouse, fromFloor: 0, chance: 100 } }, bosses: {} };
      const house = monsterHouse(always, n, Math.random, enemyDefs);
      lineUp.splice(0, lineUp.length, ...house);
      Object.assign(lineUp, { monsterHouse: true, elites: house.elites, shape: house.shape });
    }
    // Dev server only: `?lineup=risen_skeleton*12,goblin` replaces every directed fight's enemies (effect reviews).
    const forcedLineUp = import.meta.env.DEV && !room && new URLSearchParams(location.search).get('lineup');
    if (forcedLineUp) {
      const ids = forcedLineUp.split(',').flatMap((part) => { const [id, n] = part.split('*'); return enemyDefs[id] ? Array(Number(n) || 1).fill(id) : []; });
      if (ids.length) { lineUp.splice(0, lineUp.length, ...ids); lineUp.elites = []; lineUp.monsterHouse = false; }
    }
    // Dev server only: `?elite=1` makes the first normal/strong enemy of every directed fight an elite (browser checks).
    if (import.meta.env.DEV && new URLSearchParams(location.search).get('elite') && lineUp.elites && !lineUp.elites.length) {
      const i = lineUp.findIndex((id) => (enemyDefs[id].tier || 'normal') !== 'fodder');
      if (i >= 0) lineUp.elites = [i];
    }
    const enemies = this.state.spawnEnemies(lineUp, n);
    const L = combatRules.movement.layout;
    const spots = enemySpots(enemies, { width: GAME_WIDTH, y: ENEMY_Y, perRow: L.enemyPerRow, rowGap: L.enemyRowGap, room: { rowRoom: L.rowRoom, eliteRowRoom: L.eliteRowRoom, maxGap: L.enemyRowGapMax }, top: L.enemyY + L.topMarginY });
    enemies.forEach((unit, i) => this.makeView(unit, spots[i].x, spots[i].y, container));

    return {
      container,
      front,
      room,
      setDoorOpen: (open) => (open ? door.open() : door.close()),
    };
  }

  update(time, delta) {
    this.refreshHud();
    this.placeSpeech();
    this.drawDangerGlow();
    if (this.mode !== 'fighting') {
      this.drawStatusFx();
      return;
    }

    // Hit-stop: a big skill hit freezes the fight for a split second (the drawing keeps going).
    if (this.hitStop > 0) {
      this.hitStop -= delta;
      // Positions are put back every frame here too: the small shakes/twitches drawStatusFx adds are
      // one-frame nudges, and without this they piled up during the freeze (the enemy slid away).
      this.followPositions();
      this.drawStatusFx();
      return;
    }
    // Cap the step so switching browser tabs doesn't cause a huge jump.
    const events = this.state.update(Math.min(delta, 100) * this.speed);
    this.showEvents(events);
    this.followPositions();
    this.drawTornados();
    this.drawCastBars();
    this.drawTauntLines();
    this.drawBossHud();
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

  removeView(uid) {
    const v = this.views.get(uid);
    if (!v) return;
    v.ch.destroy();
    v.bg.destroy();
    v.fill.destroy();
    v.shieldFill.destroy();
    if (v.dots) v.dots.destroy();
    if (v.lvl) v.lvl.destroy();
    v.chipBox.destroy();
    this.views.delete(uid);
  }
}

// The other method files (see the note above the class).
Object.assign(BattleScene.prototype, hudMethods, ordersMethods, effectsMethods, walkMethods, eventsMethods, motionMethods, bossViewMethods, resultsMethods, roomMethods);
