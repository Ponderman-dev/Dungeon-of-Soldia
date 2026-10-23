import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CHAR_SCALE, SKILL_COLORS, UI } from '../config.js';
import { drawWindow, uiText, uiStyle, uiButton } from '../entities/uiKit.js';
import allHeroDefs from '../data/heroes.json';
import squadIds from '../data/squad.json';
import { DEMO, demoSquad } from './demoMode.js'; // the demo pages (Monster House, Brood Mother) and their squads
import enemyDefs from '../data/enemies.json';
import minionDefs from '../data/minions.json';
import dungeons from '../data/dungeons.json';
import combatRules from '../data/combat.json';
import damageTypes from '../data/damageTypes.json';
import leveling from '../data/leveling.json';
import rawItems from '../data/items.json';
import rarities from '../data/rarities.json';
import rewardRules from '../data/rewards.json';
import rawSkills from '../data/skills.json';
import statusInfo from '../data/statuses.json';
import Character from '../entities/Character.js';
import Door from '../entities/Door.js';
import { floorTextureKey, FLOOR_PIXEL } from '../entities/floorTexture.js';
import floorArt from '../data/floorArt.json';
import * as sfx from '../audio/sfx.js';
import { statusIconKey } from '../entities/statusIconTexture.js';
import { itemIconKey } from '../entities/itemIconTexture.js';
import { skillIconKey } from '../entities/skillIconTexture.js';
import itemFxData from '../data/itemFx.json';
import * as itemFx from '../systems/itemFx.js';
import skillFxData from '../data/skillFx.json';
import { castFx, shotFx, CAST_MS, SHOT_MS } from '../systems/skillFx.js';
import effectsData from '../data/effects.json';
import { makeTuner } from '../systems/fxTune.js';
import statusIcons from '../data/statusIcons.json';
import { iconList, iconLayout, ICON_PX } from '../systems/statusIcons.js';
import { statusLook, iceBreak, bodyBox } from '../systems/statusFx.js';
import { eliteGlow, crownPixels } from '../systems/eliteFx.js';
import { projectileFx, impactFx, critFx, IMPACT_MS, CRIT_MS, MOMENT_MS, dodgeFx, blockFx, soakFx, shieldBreakFx, healFx, deathPuffFx } from '../systems/hitFx.js';
import BattleState from '../systems/BattleState.js';
import dialogue from '../data/dialogue.json';
import { pickSpeech, clearSpeech } from '../systems/dialogue.js';
import { validateDungeon, validateHeroSkills, validateDamageTypes } from '../systems/validate.js';
import { enemiesForFloor, monsterHouse } from '../systems/dungeon.js';
import { enemySpots } from '../systems/formation.js';
import { pickSquad } from '../systems/party.js';
import { loadItems } from '../systems/items.js';
import { rollChoices } from '../systems/rewards.js';
import bookData from '../data/skillBooks.json';
import { maybeAddBook } from '../systems/books.js';
import { loadProgress, saveProgress, recordRun, unlockedIds } from '../systems/progress.js';
import unlocks from '../data/unlocks.json';
import defeatData from '../data/defeat.json';
import { roomMethods } from './roomMethods.js';

const DUNGEON_ID = 'A';
const SLOT_Y = 720;
const ENEMY_Y = 340;
const BAR_WIDTH = 44;
const POP_REPEAT_MS = 600; // the same word over one fighter is not popped again within this time
const WALL_H = 200; // the back wall (with the door) fills the top of each floor
const DOOR_X = GAME_WIDTH / 2;
const T = combatRules.transition;
const M = combatRules.attackMotion; // how walking looks (hop) and arrows
const FX = combatRules.skillFx; // how skills look when they go off
const itemDefs = loadItems(rawItems);
// Effect settings from the Studio (speed and colour swaps per effect, data/effects.json).
const TUNE = makeTuner(effectsData);
// Skill name -> its own cast effect (skillFx.json; a rotation spell is 'skillId:SHORT').
const DASH_BY_NAME = {}; // skill name -> its dash (combat.json skillFx.dash)
const WAVE_BY_NAME = {}; // skill name -> its per-wave look (combat.json skillFx.wave)
const SKILL_FX_BY_NAME = {};
const LOOK_BY_NAME = {}; // skill (or rotation spell) name -> how its v2 look plays (combat.json skillFx.look), with its id
for (const [id, sk] of Object.entries(rawSkills)) {
  if (id.startsWith('_')) continue;
  if (sk.rotation) for (const r of sk.rotation) SKILL_FX_BY_NAME[r.name] = skillFxData[`${id}:${r.short}`];
  else SKILL_FX_BY_NAME[sk.name] = skillFxData[id];
  if (sk.rotation) for (const r of sk.rotation) { const L = combatRules.skillFx.look[`${id}:${r.short}`]; if (L) LOOK_BY_NAME[r.name] = { ...L, id, area: r.area }; }
  else if (combatRules.skillFx.look[id]) LOOK_BY_NAME[sk.name] = { ...combatRules.skillFx.look[id], id, area: sk.area, landSplash: sk.landSplash, holyNova: sk.holyNova };
  if (combatRules.skillFx.dash[id]) DASH_BY_NAME[sk.name] = combatRules.skillFx.dash[id];
  if (combatRules.skillFx.wave[id]) WAVE_BY_NAME[sk.name] = combatRules.skillFx.wave[id];
}
const skillDefs = rawSkills;
// A skill's per-wave look (combat.json skillFx.wave), by the wave's skill (a copy of the skill def, so by name).
const waveLook = (skill) => WAVE_BY_NAME[skill.name];
const SKILL_Y = 772; // centre of the skill squares
const SKILL_W = 40;
const SKILL_H = 44;

// Depth order: floor < slots < hero < hero bars < popups < banner/HUD
// How big one character pixel is on screen (bosses use finer pixels: `drawScale` in enemies.json).
const BANNER_Y = 520; // the big banner text (rooms); 'Floor N cleared!' goes higher (combat.json transition.clearBannerY)
const charScale = (def) => def.drawScale ?? CHAR_SCALE;

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
    this.banner = this.add
      .text(GAME_WIDTH / 2, BANNER_Y, '', { fontFamily: UI.font, fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 4, align: 'center', wordWrap: { width: GAME_WIDTH - 32, useAdvancedWrap: true } }) // long lines wrap instead of running off the screen
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    // Any tap closes an open passive text (not the tap that opened it: same moment).
    this.input.on('pointerdown', () => { if (this.passiveTip && this.passiveTip.active && this.time.now !== this.passiveTip.shownAt) this.hidePassive(); });
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

  // The boss's roar before a boss fight: a hard shake, a white flash, manga action lines bursting from the
  // boss over the whole screen and a huge ROAR!! that slams in (numbers: combat.json transition.bossIntro).
  bossRoar(view) {
    const B = T.bossIntro;
    const L = B.lines;
    sfx.play('bossRoar');
    this.cameras.main.shake(B.shakeMs, B.shakeIntensity);
    this.cameras.main.flash(B.flashMs, 255, 255, 255);
    const c = this.center(view);
    const fp = view.ch.parentContainer; // before the fight the boss still stands in its floor container
    if (fp) { c.x += fp.x; c.y += fp.y; }
    const far = Math.hypot(GAME_WIDTH, GAME_HEIGHT); // every line runs off the screen
    const g = this.add.graphics().setDepth(DEPTH.popup + 1);
    // Thin wedges from a ring round the boss out to the screen edge, a new random set each flicker.
    const drawLines = () => {
      g.clear().fillStyle(Number(L.color), 1);
      for (let i = 0; i < L.count; i++) {
        const a = ((i + Math.random() * 0.8) / L.count) * Math.PI * 2;
        const half = (L.widthPx * (0.35 + Math.random() * 0.65)) / 2 / far; // the angle half the wide end covers
        const r0 = L.innerPx * (1 + Math.random() * 0.6);
        g.fillTriangle(
          c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0,
          c.x + Math.cos(a - half) * far, c.y + Math.sin(a - half) * far,
          c.x + Math.cos(a + half) * far, c.y + Math.sin(a + half) * far,
        );
      }
    };
    drawLines();
    g.setAlpha(L.alpha);
    const flicker = this.time.addEvent({ delay: L.flickerMs, loop: true, callback: drawLines });
    this.tweens.add({ targets: g, alpha: 0, delay: B.roarMs * 0.7, duration: B.roarMs * 0.3, onComplete: () => { flicker.remove(); g.destroy(); } });
    // ROAR!! slams in huge over the boss (kept on screen), shakes, then fades.
    const t = this.add.text(GAME_WIDTH / 2, Phaser.Math.Clamp(c.y, 140, GAME_HEIGHT / 2), 'ROAR!!', {
      fontFamily: UI.font, fontSize: `${B.textPx}px`, color: '#ff3a2a', stroke: '#000000', strokeThickness: 10, align: 'center',
    }).setOrigin(0.5).setDepth(DEPTH.popup + 2);
    if (t.width > GAME_WIDTH - 12) t.setScale((GAME_WIDTH - 12) / t.width);
    const end = t.scale;
    t.setScale(end * 3).setAlpha(0);
    this.tweens.add({ targets: t, scale: end, alpha: 1, duration: 180, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, angle: { from: -4, to: 4 }, delay: 180, duration: 70, yoyo: true, repeat: Math.max(0, Math.floor((B.roarMs - 400) / 140)) });
    this.tweens.add({ targets: t, alpha: 0, scale: end * 1.3, delay: B.roarMs, duration: 300, onComplete: () => t.destroy() });
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
  // Small per-frame markers for the hero mechanics (rework v2): the Berserker's Rage bar under his health bar,
  // the Rogue's combo pips under the enemy he is working on, and the Bard's current song (a note: gold = March,
  // green = Ballad) right of his health bar.
  drawHeroHud() {
    if (!this.heroHud) this.heroHud = this.add.graphics().setDepth(DEPTH.heroBar + 0.5);
    const g = this.heroHud;
    g.clear();
    for (const h of this.state.heroes) {
      const v = this.views.get(h.uid);
      if (!v || !h.alive || !v.bg.visible || !v.ch.active) continue;
      const rage = h.def.passive && h.def.passive.rage;
      if (rage) {
        const x = v.bg.x - BAR_WIDTH / 2, y = v.bg.y + 5;
        const full = this.state.frenzied(h);
        g.fillStyle(0x000000, 0.85).fillRect(x - 1, y - 1, BAR_WIDTH + 2, 4);
        g.fillStyle(full ? 0xffd24d : 0xff6a2a, 1).fillRect(x, y, full ? BAR_WIDTH : (BAR_WIDTH * h.rage) / rage.max, 2);
      }
      // Necromancer's Souls: a purple bar under his health bar fills with every minion death (pale when full).
      const legion = h.def.passive && h.def.passive.legion;
      if (legion && h.souls) {
        const x = v.bg.x - BAR_WIDTH / 2, y = v.bg.y + 5;
        g.fillStyle(0x000000, 0.85).fillRect(x - 1, y - 1, BAR_WIDTH + 2, 4);
        g.fillStyle(h.souls >= legion.maxSouls ? 0xe6c8ff : 0xa064ff, 1).fillRect(x, y, (BAR_WIDTH * h.souls) / legion.maxSouls, 2);
      }
      // Knight's Grudge: a bar under his health bar fills with every reflected hit (gold when full).
      const grudge = h.def.passive && h.def.passive.grudge;
      if (grudge && h.grudge) {
        const x = v.bg.x - BAR_WIDTH / 2, y = v.bg.y + 5;
        g.fillStyle(0x000000, 0.85).fillRect(x - 1, y - 1, BAR_WIDTH + 2, 4);
        g.fillStyle(h.grudge >= grudge.maxStacks ? 0xffd24d : 0xff9a3c, 1).fillRect(x, y, (BAR_WIDTH * h.grudge) / grudge.maxStacks, 2);
      }
      if (h.def.passive && h.def.passive.combo && h.combo.points > 0) {
        const tv = this.views.get(h.combo.uid);
        if (tv && tv.unit.alive && tv.ch.active && tv.bg.visible) {
          const max = h.def.passive.combo.max;
          for (let i = 0; i < max; i++) {
            const px = tv.bg.x - (max * 6) / 2 + i * 6 + 1, py = tv.bg.y + 6;
            g.fillStyle(0x000000, 0.9).fillRect(px - 1, py - 1, 6, 5);
            g.fillStyle(i < h.combo.points ? (h.combo.points >= max ? 0xff4a4a : 0xffd24d) : 0x3a3350, 1).fillRect(px, py, 4, 3);
          }
        }
      }
      if (h.song) {
        const col = h.song === 'ballad' ? 0x6dff8f : 0xffb84d;
        const x = v.bg.x + BAR_WIDTH / 2 + 6, y = v.bg.y - 2;
        g.fillStyle(0x000000, 1).fillRect(x - 3, y + 1, 5, 4).fillRect(x + 1, y - 6, 3, 8);
        g.fillStyle(col, 1).fillRect(x - 2, y + 2, 3, 2).fillRect(x + 2, y - 5, 1, 7).fillRect(x + 2, y - 5, 2, 1);
      }
    }
  }

  drawStatusFx() {
    this.drawHeroHud();
    this.drawHitFx(); // hits first: a hit's colour flash wins over the status tint this frame
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
      if (kinds.shield && u.statuses.some((st) => st.key === 'shield:fireheart')) { // Fire Heart: a red, fiery shield
        kinds.fireShield = kinds.shield;
        if (!u.statuses.some((st) => st.type === 'shield' && st.key !== 'shield:fireheart')) delete kinds.shield;
      }
      if (u.side === 'hero' && u.items && u.items.includes('heart_of_the_beast') && this.state.enemies.some((en) => en.alive)) { // Heart of the Beast: orange regen wins
        kinds.beastRegen = kinds.regenBoost || { stacks: 1, age: 1e9 };
        delete kinds.regenBoost;
      }
      if (!v.box) v.box = bodyBox(u.def.parts, u.def.height);
      let look;
      try { look = statusLook(kinds, v.box, now + (u.uid % 7) * 137, TUNE); } // each fighter a little out of step
      catch (err) { console.error(err); continue; } // a broken effect must never stop the fight
      v.ch.setStatusLook(v.hitTint || look.tint, look.ice);
      // Still sliding in with its floor (an elite's shield at the start): the screen-space effects wait until it
      // has arrived, or they were drawn at its final spot before the enemy got there.
      if (v.ch.parentContainer) continue;
      this.nudge(v, look.dx * Math.abs(v.ch.scaleY));
      this.paintFx(g, v, look.draws);
    }
    this.drawElites(now);
    this.drawBombs(now);
    this.drawThunders(now);
    // Assault Breastplate's ARMOR DOWN icon comes and goes with its holder (item given, holder fell): redraw enemy icons.
    const shred = this.assaultCopies();
    for (const e of this.state.enemies) {
      const ev = this.views.get(e.uid);
      if (ev && e.alive && ev.shredShown !== shred) { ev.shredShown = shred; this.drawChips(ev); } // new enemies get it too
    }
    this.drawOrders();
    // Ice breaking off a fighter whose Freeze just ended.
    this.iceBreaks = (this.iceBreaks || []).filter((b) => now - b.start < 400 && b.view.ch.active);
    for (const b of this.iceBreaks) this.paintFx(g, b.view, iceBreak(b.view.box || bodyBox(b.view.unit.def.parts, b.view.unit.def.height), (now - b.start) / 400));
  }

  // ELITES (systems/eliteFx.js): a glow in the element colour, drawn BEHIND every fighter (a halo on the floor and
  // motes rising along the body), and a small gold crown just left of the health bar. Only once the enemy has left
  // its floor container (the fight has started).
  drawElites(now) {
    if (!this.eliteG) this.eliteG = this.add.graphics().setDepth(DEPTH.hero - 0.001);
    if (!this.crownG) this.crownG = this.add.graphics().setDepth(DEPTH.heroBar);
    const g = this.eliteG, cg = this.crownG;
    g.clear();
    cg.clear();
    const crown = (this.crown = this.crown || crownPixels());
    for (const v of this.views.values()) {
      const u = v.unit;
      if (u.adapt && u.alive && v.ch.active && !v.ch.parentContainer) { // Crystal Sentinel: a glow in the colour of what it resists
        if (!v.box) v.box = bodyBox(u.def.parts, u.def.height);
        this.paintFx(g, v, eliteGlow(v.box, Phaser.Display.Color.HexStringToColor(damageTypes[u.adapt.type].color).color, now + u.uid * 97));
      }
      if (!u.elite || !u.alive || u.burrowed || !v.ch.active || v.ch.parentContainer) continue;
      if (!v.box) v.box = bodyBox(u.def.parts, u.def.height);
      const color = (u.elite.colorInt ??= Phaser.Display.Color.HexStringToColor(u.elite.color).color);
      this.paintFx(g, v, eliteGlow(v.box, color, now + u.uid * 97));
      if (!v.bg.visible) continue;
      const P = 2; // crown pixel size
      const x0 = v.bg.x - BAR_WIDTH / 2 - 1 - 6 * P, y0 = v.bg.y - 2 * P;
      for (const [c, r, col] of crown) cg.fillStyle(col, v.bg.alpha).fillRect(x0 + c * P, y0 + r * P, P, P);
    }
  }

  // DRAG ORDERS (user's sketch): press a living hero during a fight and drag: a red arrow follows the finger and the
  // enemy under it gets a ring; let go over an enemy = only that hero attacks it (BattleState.setOrder). Letting go
  // anywhere else does nothing. Tap-to-focus on enemies is unchanged.
  startOrderDrag(view, pointer) {
    if (this.mode !== 'fighting' || !view.unit.alive) return;
    this.orderDrag = { view, x: pointer.worldX, y: pointer.worldY };
    if (!this.orderInput) {
      this.orderInput = true;
      this.input.on('pointermove', (p) => { if (this.orderDrag) { this.orderDrag.x = p.worldX; this.orderDrag.y = p.worldY; } });
      this.input.on('pointerup', (p) => this.endOrderDrag(p));
      this.input.on('gameout', () => { this.orderDrag = null; });
    }
  }

  // The enemy under a point (the nearest living, hittable one within its body), or null.
  enemyAt(x, y) {
    let best = null, bestD = Infinity;
    for (const v of this.views.values()) {
      const u = v.unit;
      if (u.side !== 'enemy' || !u.alive || this.state.untargetable(u)) continue;
      const c = this.center(v);
      const reach = Math.max(40, (bodyBox(u.def.parts, u.def.height).hw + 6) * charScale(u.def));
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < reach && d < bestD) { best = v; bestD = d; }
    }
    return best;
  }

  endOrderDrag(p) {
    const drag = this.orderDrag;
    this.orderDrag = null;
    if (!drag || this.mode !== 'fighting') return;
    // The enemy under the finger, or the one that was lit up a moment ago (small enemies walk; fingers are big).
    const lit = drag.over && drag.over.unit.alive && this.views.get(drag.over.unit.uid) === drag.over ? drag.over : null;
    const target = this.enemyAt(p.worldX, p.worldY) || lit;
    if (!target || !this.state.setOrder(drag.view.unit.uid, target.unit.uid)) return;
    sfx.play('tap');
    this.ring(target, 0xffa040);
    this.popText(drag.view, 'On it!', '#ffa040');
  }

  // Every frame: the drag arrow (while dragging), and for every hero with an order a thin orange ring under its
  // target and a small one under the hero itself (so you can see who has an order).
  drawOrders() {
    if (!this.orderG) this.orderG = this.add.graphics().setDepth(DEPTH.marker + 0.5);
    if (!this.arrowG) this.arrowG = this.add.graphics().setDepth(DEPTH.popup - 0.5);
    const g = this.orderG, a = this.arrowG;
    g.clear();
    a.clear();
    const foot = (v) => ({ x: v.ch.x, y: v.ch.y + v.ch.hopOffset + (v.groundY - v.ch.homeY) + 6 });
    for (const h of this.state.heroes) {
      const t = h.alive && this.state.orderOf(h);
      const hv = this.views.get(h.uid), tv = t && this.views.get(t.uid);
      if (!hv || !tv) continue;
      const tf = foot(tv), hf = { x: hv.ch.x, y: hv.ch.y + 4 };
      g.lineStyle(2, 0xffa040, 0.9).strokeEllipse(tf.x, tf.y, 54, 14);
      g.lineStyle(2, 0xffa040, 0.6).strokeEllipse(hf.x, hf.y, 34, 9);
    }
    const d = this.orderDrag;
    if (!d || !d.view.unit.alive || this.mode !== 'fighting') { if (d) this.orderDrag = null; return; }
    const from = this.center(d.view);
    const over = this.enemyAt(d.x, d.y);
    d.over = over || (d.over && Math.hypot(this.center(d.over).x - d.x, this.center(d.over).y - d.y) < 70 ? d.over : null); // stays lit a little while the finger slips off
    const to = over ? this.center(over) : { x: d.x, y: d.y };
    const ang = Math.atan2(to.y - from.y, to.x - from.x), len = Math.hypot(to.x - from.x, to.y - from.y);
    if (len < 12) return; // a tap, not a drag yet
    a.lineStyle(6, 0x1a1020, 0.8).lineBetween(from.x, from.y, to.x - Math.cos(ang) * 10, to.y - Math.sin(ang) * 10);
    a.lineStyle(3, 0xff4d4d, 1).lineBetween(from.x, from.y, to.x - Math.cos(ang) * 10, to.y - Math.sin(ang) * 10);
    const head = (k, w) => [to.x - Math.cos(ang) * k + Math.cos(ang + Math.PI / 2) * w, to.y - Math.sin(ang) * k + Math.sin(ang + Math.PI / 2) * w];
    const [l1, l2] = head(16, 9), [r1, r2] = head(16, -9);
    a.fillStyle(0xff4d4d, 1).fillTriangle(to.x, to.y, l1, l2, r1, r2);
    if (over) { const f = foot(over); a.lineStyle(3, 0xff4d4d, 1).strokeEllipse(f.x, f.y, 62, 16); }
  }

  // Kobold Sapper bombs (BattleState.bombs): a red danger ring on the floor that fills up, and a black pixel bomb with a
  // spark on its fuse that blinks faster as it gets close. The blast itself is the `deathBurst` event.
  drawBombs(now) {
    if (!this.bombG) this.bombG = this.add.graphics().setDepth(DEPTH.hero - 0.002); // the ring: on the floor, behind fighters
    if (!this.bombTopG) this.bombTopG = this.add.graphics().setDepth(DEPTH.heroBar - 0.06); // the bomb: in front of them
    const g = this.bombG, top = this.bombTopG;
    g.clear();
    top.clear();
    const P = CHAR_SCALE;
    for (const b of this.state.bombs || []) {
      const p = 1 - b.remaining / b.total; // 0 when dropped, 1 when it goes off
      g.lineStyle(2, 0xff4a3a, 0.35 + 0.4 * p).strokeEllipse(b.x, b.y, b.radius * 2, b.radius * 1.4);
      g.fillStyle(0xff4a3a, 0.08 + 0.16 * p).fillEllipse(b.x, b.y, b.radius * 2 * p, b.radius * 1.4 * p);
      const x = Math.round(b.x / P) * P, y = Math.round((b.y - 4) / P) * P;
      const rows = ['..ooo..', '.oxhxo.', 'oxhxxxo', 'oxxxxxo', 'oxxxxxo', '.oxxxo.', '..ooo..'];
      const col = { o: 0x0a0610, x: 0x3e3e4e, h: 0x9a9ab4 };
      rows.forEach((r, ry) => [...r].forEach((c, rx) => { if (c !== '.') top.fillStyle(col[c], 1).fillRect(x + (rx - 3) * P, y + (ry - 7) * P, P, P); }));
      top.fillStyle(0x9a6b3a, 1).fillRect(x + 1 * P, y - 8 * P, P, P).fillRect(x + 2 * P, y - 9 * P, P, P); // the fuse
      const blink = Math.sin(now / (120 - 90 * p)) > 0; // the spark blinks faster near the end
      top.fillStyle(blink ? 0xffffff : 0xffe066, 1).fillRect(x + 3 * P, y - 10 * P, P, P);
      if (blink) top.fillStyle(0xff7a2a, 1).fillRect(x + 4 * P, y - 10 * P, P, P).fillRect(x + 3 * P, y - 11 * P, P, P).fillRect(x + 2 * P, y - 10 * P, P, P);
    }
  }

  // Thunderstruck (BattleState.thunders): an electric circle grows on the floor under the marked enemy and follows it;
  // the bolt itself is the `thunderstruck` event (itemFx.thunderstruckFx).
  drawThunders(now) {
    if (!this.thunderG) this.thunderG = this.add.graphics().setDepth(DEPTH.hero - 0.001); // on the floor, behind fighters
    const g = this.thunderG, P = CHAR_SCALE;
    g.clear();
    for (const t of this.state.thunders || []) {
      const v = this.views.get(t.target.uid);
      if (!v || !v.ch.active) continue;
      const f = { x: v.ch.x / P, y: (v.ch.y + v.ch.hopOffset + (v.groundY - v.ch.homeY) + 2) / P };
      const draws = itemFx.thunderMarkFx(1 - t.remaining / t.total, f, t.target.def.boss ? 24 : 15, now, t.uid);
      for (const [x, y, w, h, c, a] of draws) g.fillStyle(c, a).fillRect(x * P, y * P, w * P, h * P);
    }
  }

  // An elite's name pops up over it when the fight starts ("Burning Vampiric" / "Bandit"), in its element colour.
  eliteName(v) {
    const u = v.unit;
    const base = u.def.eliteOf ? u.def.eliteOf.name : '';
    const head = base && u.name.endsWith(base) ? u.name.slice(0, -base.length).trim() : u.name;
    const t = this.add
      .text(v.ch.x, 0, base ? `${head}\n${base}` : head, { fontFamily: UI.font, fontSize: '8px', color: u.elite.color, stroke: '#000000', strokeThickness: 3, align: 'center' })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.popup);
    // The tag FOLLOWS the elite while it walks (screen review), rising a little as it fades.
    const rise = { d: 0 };
    const follow = () => {
      if (!v.ch.active) return;
      t.x = Phaser.Math.Clamp(Math.round(v.ch.x), t.width / 2 + 4, GAME_WIDTH - t.width / 2 - 4);
      t.y = Math.round(v.ch.y - u.def.height * charScale(u.def) - 30 - rise.d);
    };
    follow();
    this.events.on('update', follow);
    t.once('destroy', () => this.events.off('update', follow));
    t.setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: rise, d: 16, delay: 1900, duration: 600 });
    this.tweens.add({ targets: t, alpha: 0, delay: 1900, duration: 600, onComplete: () => t.destroy() });
    this.ring(v, Phaser.Display.Color.HexStringToColor(u.elite.color).color);
  }

  // HITS (systems/hitFx.js): shots in the air (arrow, fire bolt, ice shard, lightning, dark orb, holy mote)
  // and what happens where they land, per damage type, plus the crit layer. Drawn every frame in
  // character pixels (world / CHAR_SCALE) so everything stays on the pixel grid.
  drawHitFx() {
    if (!this.hitG) this.hitG = this.add.graphics().setDepth(DEPTH.popup - 1);
    const g = this.hitG;
    g.clear();
    const now = this.time.now, S = CHAR_SCALE;
    for (const v of this.views.values()) { v.hitTint = null; }
    const draw = (draws) => { for (const [x, y, w, h, c, a] of draws) { g.fillStyle(c, a); g.fillRect(x * S - S / 2, y * S, w * S, h * S); } };
    const at = (v) => { const c = this.center(v); return { x: c.x / S, y: c.y / S }; };
    // Shots in the air.
    for (const v of this.views.values()) {
      const arrow = v.arrow;
      if (!arrow || !arrow.active) continue;
      const head = { x: arrow.x / S, y: arrow.y / S };
      const start = arrow.kind === 'electric' && v.ch.active ? at(v) : { x: arrow.startX / S, y: arrow.startY / S };
      draw(TUNE.paint('shot', arrow.kind, projectileFx(arrow.kind, start, head, now * TUNE.speed('shot', arrow.kind), v.unit.uid)));
    }
    // Item effects and other timed recipes (addFx): each returns its pixels for its progress q.
    this.fxList = (this.fxList || []).filter((f) => now - f.start < f.ms);
    for (const f of this.fxList) {
      try {
        const out = f.fn((now - f.start) / f.ms, now);
        if (Array.isArray(out)) { draw(out); continue; }
        draw(out.draws || []);
        for (const [v, tint] of out.tints || []) if (v && tint && (!v.hitTint || tint[1] > v.hitTint[1])) v.hitTint = tint; // a skill colours fighters for a moment
      } catch (err) { console.error(err); f.ms = 0; }
    }
    // Excalibur tornadoes: a swirling pixel funnel where each one is.
    if (this.tornadoViews) for (const tv of this.tornadoViews.values()) if (tv.g.active) draw(TUNE.paint('item', 'tornado', itemFx.tornadoFx(tv.g.x / S, tv.g.y / S, now * TUNE.speed('item', 'tornado'))));
    // Impacts and other hit moments (they follow the fighter while they play). A death puff stays put.
    this.impacts = (this.impacts || []).filter((h) => now - h.start < h.ms && (h.kind === 'puff' || h.view.ch.active));
    for (const h of this.impacts) {
      const paint = (name, draws) => draw(TUNE.paint('hit', name, draws));
      if (h.kind === 'puff') { paint('puff', deathPuffFx((now - h.start) / h.ms, h.x, h.y)); continue; }
      const v = h.view, ch = v.ch;
      if (h.attacker && h.attacker.ch.active) h.side = h.attacker.ch.x < ch.x ? -1 : 1;
      const u = { ...this.fxBody(v), side: h.side };
      const { x, y } = u;
      const q = (now - h.start) / h.ms;
      if (h.crit) { paint('crit', critFx(q, u, now)); continue; }
      if (h.kind) {
        if (h.kind === 'dodge') { const o = dodgeFx(q, u); paint('dodge', o.draws); this.nudge(v, o.dx * S); }
        else if (h.kind === 'block') paint('block', blockFx(q, u));
        else if (h.kind === 'soak') paint('soak', soakFx(q, u));
        else if (h.kind === 'shieldBreak') paint('shieldBreak', shieldBreakFx(q, u));
        else if (h.kind === 'heal') { const o = healFx(q, u, h.seed); paint('heal', o.draws); if (o.tint && !v.hitTint) v.hitTint = [TUNE.color('hit', 'heal', o.tint[0]), o.tint[1]]; }
        continue;
      }
      const out = impactFx(h.type, q, u, now, h.seed, h.attacker && h.attacker.ch.active ? at(h.attacker) : null);
      if (h.ghastly) { draw(TUNE.paint('item', 'ghastlyFire', itemFx.ghastlyDraws(out.draws, u))); continue; } // Ghastly Fire: the fire hit, bigger and purple
      paint(h.type, out.draws);
      if (out.tint && (!v.hitTint || out.tint[1] > v.hitTint[1])) v.hitTint = [TUNE.color('hit', h.type, out.tint[0]), out.tint[1]];
      this.nudge(v, out.dx * S);
    }
  }

  // Effects may nudge a figure sideways for one frame (a twitch, a side-step). That only works for
  // figures that followPositions() puts back on their spot every frame: living, placed and not
  // mid-jab. Anything else (a dead enemy squashing into the floor) would keep the nudges and slide away.
  // A one-frame sideways nudge (twitch, side-step, shake). Several in the same frame do NOT pile up:
  // the total never goes past the biggest single one (so a fighter missed by three heroes at once doesn't
  // jump far away), and nudges from opposite sides cancel out (no flicker).
  nudge(v, px) {
    if (!px || !this.shakeable(v)) return;
    const frame = this.game.loop.frame;
    if (v.nudgeFrame !== frame) { v.nudgeFrame = frame; v.nudgeSum = 0; v.nudgeMax = 0; v.nudgeX = 0; }
    v.nudgeSum += px;
    v.nudgeMax = Math.max(v.nudgeMax, Math.abs(px));
    const want = Math.max(-v.nudgeMax, Math.min(v.nudgeMax, v.nudgeSum));
    v.ch.x += want - v.nudgeX;
    v.nudgeX = want;
  }

  shakeable(v) {
    return this.mode === 'fighting' && v.unit.alive && v.unit.x !== undefined && !v.ch.lunging;
  }

  // A timed effect: fn(q, now) returns pixel draws (character pixels) while q goes 0..1 over ms.
  // tag = [group, name]: the effect's Studio settings (data/effects.json) change its speed and colours.
  addFx(ms, fn, tag = null) {
    let run = fn;
    if (tag) {
      const [group, name] = tag;
      ms = TUNE.ms(group, name, ms);
      run = (q, now) => {
        const out = fn(q, now);
        if (Array.isArray(out)) return TUNE.paint(group, name, out);
        return { ...out, draws: TUNE.paint(group, name, out.draws || []), tints: (out.tints || []).map(([v, t]) => [v, t && [TUNE.color(group, name, t[0]), t[1]]]) };
      };
    }
    (this.fxList = this.fxList || []).push({ start: this.time.now, ms, fn: run });
  }

  // Where a fighter is, in character pixels: its middle (pt) and its body (body, as the fx recipes want it).
  fxPoint(v) {
    const c = this.center(v);
    return { x: c.x / CHAR_SCALE, y: c.y / CHAR_SCALE };
  }

  fxBody(v) {
    if (!v.box) v.box = bodyBox(v.unit.def.parts, v.unit.def.height);
    const k = charScale(v.unit.def) / CHAR_SCALE; // a boss's body box is in its own (finer) pixels
    const x = (v.ch.x + v.box.cx * v.ch.scaleX) / CHAR_SCALE, y = v.ch.y / CHAR_SCALE;
    const b = { x, y, top: y + v.box.top * k, mid: y + v.box.mid * k, bot: y + v.box.bot * k, hw: v.box.hw * k };
    // The weapon part (staff, bow, lute, flask, sword): the skill looks anchor on it, so they follow a redesigned hero.
    const w = v.unit.def.parts && v.unit.def.parts.weapon;
    if (w) { b.wx = (v.ch.x + w.x * v.ch.scaleX) / CHAR_SCALE; b.wy = y + w.y * k; b.wtop = y + (w.y - w.h / 2) * k; b.wbot = y + (w.y + w.h / 2) * k; }
    return b;
  }

  // An item went off: its icon pops over the holder (instead of a text label) and its own effect plays
  // (src/data/itemFx.json says which; systems/itemFx.js draws it).
  itemProc(e, v) {
    const spec = itemFxData[e.itemId];
    if (!(spec && spec.noPop)) { // frequent simple procs (Quiver, Metronome) stay quiet: no icon, no sound
      sfx.play('itemProc');
      this.iconPop(v, e.itemId);
    }
    if (spec && spec.text) this.popText(v, spec.text, spec.textColor || '#cfe8ff'); // e.g. Mirror Buckler: 'Reflected!'
    if (!spec || !spec.effect) return;
    const ms = itemFx.ITEM_MS[spec.effect];
    const tag = ['item', spec.effect];
    const tv = e.target ? this.views.get(e.target.uid) : null;
    if (spec.effect === 'battleCry') {
      const color = spec.color ? Number(spec.color) : undefined;
      const squad = this.state.heroes.filter((h) => h.alive).map((h) => this.views.get(h.uid)).filter(Boolean);
      this.addFx(ms, (q, now) => [...itemFx.battleCryFx(q, this.fxBody(v), color), ...squad.flatMap((h) => (h.ch.active ? itemFx.speedLinesFx(q, this.fxBody(h), now, color) : []))], tag);
    } else if (spec.effect === 'shatter' && tv) {
      const at = this.fxBody(tv);
      this.addFx(ms, (q) => itemFx.shatterFx(q, tv.ch.active ? this.fxBody(tv) : at), tag);
      this.cameras.main.shake(110, 0.004);
    } else if (spec.effect === 'knifeBurst' && e.at) {
      const dv = this.views.get(e.at.uid);
      if (!dv) return;
      const b = this.fxBody(dv); // where the enemy died (it is gone soon)
      this.addFx(ms, (q) => itemFx.knifeBurstFx(q, b.x, b.mid), tag);
    } else if (spec.effect === 'plague' && e.from && e.to) {
      const fv = this.views.get(e.from.uid);
      if (!fv) return;
      const a = this.fxPoint(fv);
      for (const o of e.to) {
        const ov = this.views.get(o.uid);
        if (ov) this.addFx(ms, (q) => itemFx.plagueFx(q, a, ov.ch.active ? this.fxPoint(ov) : a), tag);
      }
    } else if (spec.effect === 'thunderbolt' && tv) {
      this.addFx(ms, (q) => (tv.ch.active ? itemFx.thunderboltFx(q, this.fxBody(tv)) : []), tag);
    } else if (spec.effect === 'suckerPunch' && tv) {
      const side = v.ch.x < tv.ch.x ? -1 : 1;
      this.addFx(ms, (q) => (tv.ch.active ? itemFx.suckerPunchFx(q, this.fxBody(tv), side) : []), tag);
    } else if (spec.effect === 'executioner' && tv) {
      const at = this.fxBody(tv); // the enemy may die from this very hit
      this.addFx(ms, (q) => itemFx.executionerFx(q, tv.ch.active ? this.fxBody(tv) : at), tag);
    } else if (spec.effect === 'dice' && tv) {
      const at = this.fxBody(tv);
      this.addFx(ms, (q, now) => itemFx.diceFx(q, tv.ch.active ? this.fxBody(tv) : at, now), tag);
    } else if (spec.effect === 'mimic') {
      const b = this.fxBody(v);
      this.addFx(ms, (q, now) => itemFx.mimicFx(q, b.x + b.hw + 6, b.y, now), tag); // beside the holder
    } else if (spec.effect === 'aegisBlast') {
      this.addFx(ms, (q) => (v.ch.active ? itemFx.aegisBlastFx(q, this.fxBody(v)) : []), tag);
    } else if (spec.effect === 'spiritAxe') {
      this.addFx(ms, (q, now) => (v.ch.active ? itemFx.spiritAxeFx(q, this.fxBody(v), now) : []), tag);
    }
  }

  // The item's framed icon jumps up over the holder, holds, then floats up and fades. itemFx.json iconPop.stack
  // decides what happens when many fire at once (user, session 26: the row of 5 moons over the Archer):
  // 'count' = the same item again bumps its icon and shows x2, x3...; 'bounce' = the same, no number;
  // 'queue' = one icon at a time, the others wait their turn; 'deck' = dealt like cards onto one pile, deckGapMs
  // apart, each card fading on its own; 'row' = the old way, all side by side.
  // Different items stand side by side, at most maxSide (more are skipped).
  iconPop(v, itemId) {
    const def = itemDefs[itemId];
    if (!v || !def || !v.ch.active) return;
    const cfg = itemFxData.iconPop;
    const stack = cfg.stack || 'row';
    if (stack === 'deck') return this.dealPop(v, itemId);
    v.pops = (v.pops || []).filter((o) => o.active);
    if (stack === 'queue' && v.pops.length) {
      v.popQueue = v.popQueue || [];
      if (v.popQueue.length < (cfg.queueMax || 3) && !v.popQueue.includes(itemId)) v.popQueue.push(itemId);
      return;
    }
    if (stack === 'count' || stack === 'bounce') {
      const same = v.pops.find((o) => o.itemId === itemId);
      if (same) return this.bumpPop(same, stack === 'count');
      if (v.pops.length >= (cfg.maxSide || 3)) return;
    }
    const n = v.pops.length;
    // Extra pops stand side by side; near a side of the screen they line up towards the middle
    // instead, so none is cut off by the edge.
    const half = (20 * cfg.scale) / 2 + 4;
    const nearEdge = v.ch.x < GAME_WIDTH * 0.3 ? 1 : v.ch.x > GAME_WIDTH * 0.7 ? -1 : 0;
    const offset = nearEdge ? nearEdge * n * cfg.gapPx : (n ? (n % 2 ? 1 : -1) * Math.ceil(n / 2) * cfg.gapPx : 0);
    // It FOLLOWS the hero (user): placed every frame just above the bar, however big the icon is.
    const spot = () => ({ x: Phaser.Math.Clamp(v.ch.x + offset, half, GAME_WIDTH - half), y: v.bg.y - (10 * cfg.scale + 4) });
    const lift = { d: 12 };
    const img = this.add.image(spot().x, spot().y + lift.d, itemIconKey(this, itemId, def.rarity)).setScale(cfg.scale).setDepth(DEPTH.popup);
    Object.assign(img, { itemId, lift, count: 1, label: null });
    const follow = () => {
      if (!v.ch.active) return;
      const p = spot();
      img.setPosition(Math.round(p.x), Math.round(p.y + lift.d));
      if (img.label) img.label.setPosition(img.x + 10 * cfg.scale, img.y + 9 * cfg.scale).setAlpha(img.alpha);
    };
    this.events.on('update', follow);
    img.once('destroy', () => {
      this.events.off('update', follow);
      if (img.label) img.label.destroy();
      // The queue: the next waiting item pops (a little quicker) once this one is gone.
      const next = v.popQueue && v.popQueue.shift();
      if (next && v.ch.active) this.iconPop(v, next);
    });
    v.pops.push(img);
    const ms = cfg.ms * (stack === 'queue' && v.popQueue && v.popQueue.length ? cfg.queueMsShare || 1 : 1);
    this.tweens.add({ targets: lift, d: 0, duration: ms * 0.25, ease: 'Back.easeOut' });
    this.fadePop(img, ms);
    // a white ring flashes out from the icon as it appears (and moves with it)
    this.addFx(ms * 0.25, (q) => { const out = []; const c = { x: img.x / CHAR_SCALE, y: img.y / CHAR_SCALE }; const r = (9 + q * 16) * (cfg.scale / CHAR_SCALE); for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; out.push([Math.round(c.x + Math.cos(a) * r), Math.round(c.y + Math.sin(a) * r), 1, 1, 0xffffff, 1 - q]); } return out; });
  }

  // 'deck': the icon is dealt onto a pile over the hero like a card: deckGapMs after the last one, a little up and
  // right of it (deckStepPx), slapping down from big. Each card rises and fades on its own like a normal pop (user);
  // the cards above slide down into the gap. More than deckMax cards: the bottom card goes.
  dealPop(v, itemId) {
    const def = itemDefs[itemId];
    const cfg = itemFxData.iconPop;
    const d = (v.deck = v.deck || { cards: [], nextAt: 0 });
    const now = this.time.now;
    const at = Math.max(now, d.nextAt);
    d.nextAt = at + (cfg.deckGapMs || 50);
    this.time.delayedCall(at - now, () => {
      if (!v.ch.active) return;
      d.cards = d.cards.filter((c) => c.active);
      while (d.cards.length >= (cfg.deckMax || 6)) d.cards.shift().destroy();
      const half = (20 * cfg.scale) / 2 + 4;
      const step = cfg.deckStepPx || 4;
      const img = this.add.image(0, 0, itemIconKey(this, itemId, def.rarity)).setScale(cfg.scale * 1.4).setDepth(DEPTH.popup + d.cards.length * 0.001);
      Object.assign(img, { slot: d.cards.length, lift: { d: 0 } });
      const place = () => {
        if (!v.ch.active || !img.active) return;
        const k = img.slot;
        img.setPosition(Math.round(Phaser.Math.Clamp(v.ch.x - step + k * step, half, GAME_WIDTH - half - 24)), Math.round(v.bg.y - (10 * cfg.scale + 4) - k * step + img.lift.d));
      };
      place();
      this.events.on('update', place);
      img.once('destroy', () => {
        this.events.off('update', place);
        d.cards = d.cards.filter((c) => c !== img && c.active);
        d.cards.forEach((c, i) => (c.slot = i));
      });
      d.cards.push(img);
      d.cards.forEach((c, i) => (c.slot = i));
      this.tweens.add({ targets: img, scale: cfg.scale, duration: 90, ease: 'Quad.easeIn' });
      this.fadePop(img, cfg.ms);
    });
  }

  // The hold, then the icon floats up and fades (started again when the same item fires again).
  fadePop(img, ms) {
    const cfg = itemFxData.iconPop;
    if (img.fade) img.fade.forEach((t) => t.remove());
    img.setAlpha(1);
    img.fade = [
      this.tweens.add({ targets: img.lift, d: -cfg.riseCharPx * CHAR_SCALE, delay: ms * 0.7, duration: ms * 0.3 }),
      this.tweens.add({ targets: img, alpha: 0, delay: ms * 0.7, duration: ms * 0.3, onComplete: () => img.destroy() }),
    ];
  }

  // The same item fired again while its icon is up: the icon jumps a little, stays longer, and (count) shows x2, x3...
  bumpPop(img, showCount) {
    const cfg = itemFxData.iconPop;
    img.count += 1;
    this.tweens.killTweensOf(img.lift);
    img.lift.d = Math.min(img.lift.d, 0) + 6;
    this.tweens.add({ targets: img.lift, d: 0, duration: cfg.ms * 0.2, ease: 'Back.easeOut' });
    this.fadePop(img, cfg.ms);
    if (!showCount) return;
    if (!img.label) img.label = this.add.text(img.x, img.y, '', { fontFamily: UI.font, fontSize: '8px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(DEPTH.popup + 0.1);
    img.label.setText(`x${img.count}`).setScale(1.5);
    this.tweens.add({ targets: img.label, scale: 1, duration: 160, ease: 'Back.easeOut' });
  }

  // Where an AREA skill lands: a faint ring (circle), wedge (cone) or strip (band) on the floor that
  // flashes and fades, so you can see who is inside (BattleState.areaHit).
  showZone(z, ms) {
    const g = this.add.graphics().setDepth(DEPTH.marker);
    const color = Number(FX.areaColor);
    const draw = (q) => {
      g.clear();
      const a = 0.5 * (1 - q);
      g.fillStyle(color, a * 0.35).lineStyle(2, color, a);
      if (z.shape === 'band') {
        g.fillRect(0, z.y - z.halfHeight, GAME_WIDTH, z.halfHeight * 2).lineBetween(0, z.y - z.halfHeight, GAME_WIDTH, z.y - z.halfHeight).lineBetween(0, z.y + z.halfHeight, GAME_WIDTH, z.y + z.halfHeight);
      } else if (z.shape === 'cone') {
        g.slice(z.x, z.y, z.range, z.dir - z.half, z.dir + z.half, false).fillPath().strokePath();
      } else {
        const grow = 0.85 + 0.15 * Math.min(1, q * 4);
        g.fillEllipse(z.x, z.y, z.radius * 2 * grow, z.radius * 2 * z.ySquash * grow).strokeEllipse(z.x, z.y, z.radius * 2 * grow, z.radius * 2 * z.ySquash * grow);
      }
    };
    draw(0);
    this.tweens.addCounter({ from: 0, to: 1, duration: ms, onUpdate: (tw) => draw(tw.getValue()), onComplete: () => g.destroy() });
  }

  // Starts one of the other hit moments on a fighter: 'dodge', 'block', 'soak', 'shieldBreak', 'heal'.
  addMoment(kind, v, attacker = null) {
    if (!v || !v.ch || !v.ch.active) return;
    const side = attacker && attacker.ch && attacker.ch.x < v.ch.x ? -1 : 1;
    const seed = (this.impactSeed = (this.impactSeed || 0) + 1);
    (this.impacts = this.impacts || []).push({ kind, start: this.time.now, ms: TUNE.ms('hit', kind, MOMENT_MS[kind]), view: v, attacker, side, seed });
  }

  // A hit landed: start its impact effect (and the crit layer) on the target.
  addImpact(e, a, t) {
    const type = IMPACT_MS[e.damageType] ? e.damageType : IMPACT_MS[e.attacker.damageType] ? e.attacker.damageType : 'melee';
    const side = a && a.ch.x < t.ch.x ? -1 : 1;
    const seed = (this.impactSeed = (this.impactSeed || 0) + 1);
    const ghastly = type === 'fire' && e.attacker.side === 'hero' && !e.attacker.minion && e.attacker.specials && e.attacker.specials.ghastly > 0;
    (this.impacts = this.impacts || []).push({ type, start: this.time.now, ms: TUNE.ms('hit', type, IMPACT_MS[type]), view: t, attacker: a, side, seed, ghastly });
    if (e.result.crit) {
      this.impacts.push({ crit: true, start: this.time.now, ms: TUNE.ms('hit', 'crit', CRIT_MS), view: t, attacker: a, side, seed });
      this.cameras.main.shake(90, 0.003); // a tiny shake for crits
    }
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
    // A boss winding up a move: a red bar that fills (a channel: it empties while it lasts). Stun it to stop it!
    for (const u of this.state.enemies) {
      const c = u.alive && u.bossCast;
      const v = c && this.views.get(u.uid);
      if (!v || !(c.total > 0)) continue;
      const p = c.channel ? c.remaining / c.total : 1 - c.remaining / c.total;
      const x = v.bg.x - BAR_WIDTH / 2, y = v.bg.y + 6;
      g.fillStyle(0x000000, 1).fillRect(x - 1, y - 1, BAR_WIDTH + 2, 5);
      g.fillStyle(c.channel ? 0xc070ff : 0xff4a3a, 1).fillRect(x, y, BAR_WIDTH * Math.max(0, Math.min(1, p)), 3);
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

  drawHeroSlots() {
    this.state.heroes.forEach((unit, i) => {
      const cx = this.slotWidth * i + this.slotWidth / 2;
      const view = this.makeView(unit, cx, SLOT_Y);
      // The hero's items: small item icons under the skill squares (drawDots).
      view.dots = this.add.container(cx - 2, SKILL_Y + SKILL_H / 2 + 14).setDepth(DEPTH.slot); // under the passive + skill squares
      view.slotX = cx;
      view.ch.setDepth(DEPTH.hero);
      for (const part of [view.bg, view.fill]) part.setDepth(DEPTH.heroBar);
      view.chipBox.setDepth(DEPTH.heroBar);

      // The two skill squares under the hero: tap to cast. Left = attack skill (red), right = support skill (green).
      // Each shows the skill's pixel icon (skillIcons.json); a skill without one shows its 2 letters.
      view.skillButtons = unit.skills.map((slot, j) => {
        const x = cx + (j === 0 ? -12 : 32); // a little right of centre: the passive icon sits on the left
        const textStyle = uiStyle('normal', UI.text);
        const iconKey = skillIconKey(this, slot.id);
        const button = {
          x: x - SKILL_W / 2,
          y: SKILL_Y - SKILL_H / 2,
          g: this.add.graphics().setDepth(3),
          code: iconKey ? this.add.image(x, SKILL_Y, iconKey).setScale(2).setDepth(4) : this.add.text(x, SKILL_Y, skillDefs[slot.id].short, textStyle).setOrigin(0.5).setDepth(4),
          cd: this.add.text(x, SKILL_Y, '', { ...textStyle, color: UI.text, stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setDepth(5),
        };
        this.add
          .zone(x, SKILL_Y, SKILL_W + 6, SKILL_H + 6)
          .setInteractive()
          .setDepth(6)
          .on('pointerdown', () => this.castFromUI(unit.uid, j));
        return button;
      });
      // The hero's passive: a small gold-framed icon left of the skill squares; tap it to read what it does.
      const pKey = skillIconKey(this, `passive_${unit.def.id}`, true);
      if (pKey) {
        const px = cx - 12 - SKILL_W / 2 - 13;
        view.passiveIcon = this.add.image(px, SKILL_Y, pKey).setDepth(4);
        this.add.zone(px, SKILL_Y, 26, 30).setInteractive().setDepth(6).on('pointerdown', () => this.showPassive(view));
      }
    });
  }

  // A tap on a passive icon: its name and what it does, in a small black window over the squad for a few seconds.
  // Any other tap closes it at once (that tap still does its normal job); tapping the same icon again closes it too.
  showPassive(view) {
    const p = view.unit.def.passive;
    if (!p) return;
    const again = this.passiveTip && this.passiveTip.active && this.passiveTip.view === view;
    this.hidePassive();
    if (again) return;
    sfx.play('tap');
    const t = this.add.text(GAME_WIDTH / 2, 0, `${p.name}\n${p.description}`, { fontFamily: UI.font, fontSize: '8px', color: UI.text, lineSpacing: 5, align: 'left', wordWrap: { width: GAME_WIDTH - 52, useAdvancedWrap: true } }).setOrigin(0.5, 1);
    const y = SKILL_Y - SKILL_H / 2 - 92;
    t.setY(y);
    const g = drawWindow(this.add.graphics(), GAME_WIDTH / 2 - t.width / 2 - 12, y - t.height - 12, t.width + 24, t.height + 24, { line: 0xf2b632 });
    this.passiveTip = this.add.container(0, 0, [g, t]).setDepth(DEPTH.hud + 1);
    const tip = this.passiveTip;
    tip.view = view;
    tip.shownAt = this.time.now;
    this.time.delayedCall(3500, () => { if (tip.active) this.tweens.add({ targets: tip, alpha: 0, duration: 250, onComplete: () => tip.destroy() }); });
  }

  hidePassive() {
    if (this.passiveTip && this.passiveTip.active) this.passiveTip.destroy();
    this.passiveTip = null;
  }

  // Taps on a skill square.
  castFromUI(heroUid, index) {
    if (this.mode !== 'fighting') return;
    this.showEvents(this.state.castSkill(heroUid, index));
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
        const spell = this.state.currentSpell(hero, j);
        if (b.code.setText) b.code.setText(spell.short); // (no icon) a rotation skill shows its NEXT spell's letters
        const ready = this.mode === 'fighting' && this.state.canCast(hero, j);
        const g = b.g;
        g.clear();
        // A black window: its line is red (attack) or green (support) when it can be cast, grey while it cools down
        // (a grey fill drains from the top). The Mage's rotation always shows the NEXT spell's element (user).
        const kindColor = slot.kind === 'attack' ? UI.red : UI.green;
        const element = skill.rotation && damageTypes[spell.damageType] ? Phaser.Display.Color.HexStringToColor(damageTypes[spell.damageType].color).color : null;
        const line = element ?? (ready ? SKILL_COLORS[slot.kind].ready : 0x4a4a5a);
        drawWindow(g, b.x, b.y, SKILL_W, SKILL_H, { line, alpha: hero.alive ? 1 : 0.5 });
        if (slot.cooldownLeft > 0) {
          const frac = slot.cooldownLeft / skill.cooldownMs;
          g.fillStyle(0x2a2a36, 1).fillRect(b.x + 4, b.y + 4, SKILL_W - 8, Math.round((SKILL_H - 8) * frac));
        }
        this.drawPageMarks(g, b, slot, hero.alive);
        b.cd.setText(slot.cooldownLeft > 0 ? String(Math.ceil(slot.cooldownLeft / 1000)) : '');
        if (b.code.setColor) {
          b.code.setColor(ready ? kindColor : UI.dim);
          b.code.setVisible(slot.cooldownLeft <= 0); // the cooldown number takes the letters' place
        } else if (ready && hero.alive) b.code.clearTint();
        else b.code.setTint(hero.alive ? 0x5a5a66 : 0x2a2a30); // the icon darkens while it cools down (the number shows on it)
      });
    }
  }

  // Skill book pages on a skill square: a small white dot per stat page along the bottom edge (rows of 5, going up),
  // a purple diamond per modifier along the top edge (rows of 4, going down). No page limit (user), so they wrap.
  drawPageMarks(g, b, slot, alive) {
    const pages = slot.pages || [];
    if (!pages.length) return;
    const a = alive ? 1 : 0.4;
    const stats = pages.filter((p) => p.kind === 'stat').length;
    for (let i = 0; i < stats; i++) {
      const row = Math.floor(i / 5), inRow = Math.min(5, stats - row * 5), k = i % 5;
      const x = b.x + SKILL_W / 2 + (k - (inRow - 1) / 2) * 7 - 2;
      const y = b.y + SKILL_H - 8 - row * 7;
      g.fillStyle(0x000000, a).fillRect(x - 1, y, 6, 6);
      g.fillStyle(0xf3eefc, a).fillRect(x, y + 1, 4, 4);
    }
    const mods = pages.filter((p) => p.kind === 'modifier').length;
    for (let i = 0; i < mods; i++) {
      const row = Math.floor(i / 4), k = i % 4;
      const cx = mods <= 2 ? (k === 0 ? b.x + 7 : b.x + SKILL_W - 7) : b.x + 6 + k * 9.3; // 1-2: the two top corners, as before
      const cy = b.y + 7 + row * 9;
      g.fillStyle(0x000000, a).fillTriangle(cx - 5, cy, cx, cy - 5, cx + 5, cy).fillTriangle(cx - 5, cy, cx, cy + 5, cx + 5, cy);
      g.fillStyle(0xc8a0ff, a).fillTriangle(cx - 3, cy, cx, cy - 3, cx + 3, cy).fillTriangle(cx - 3, cy, cx, cy + 3, cx + 3, cy);
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

  // Keeps a fighter's health bar attached to it while it moves.
  syncBar(view, baseY = view.ch.y + view.ch.hopOffset) {
    const y = baseY - view.unit.def.height * Math.abs(view.ch.scaleY) - 10;
    // The bar (and the Lv label left of it) stays on screen when the fighter stands at a side wall.
    const left = BAR_WIDTH / 2 + (view.lvl ? view.lvl.width + 5 : 2);
    const x = Phaser.Math.Clamp(view.ch.x, left, GAME_WIDTH - BAR_WIDTH / 2 - 2);
    view.bg.setPosition(x, y).setAlpha(view.ch.alpha);
    view.fill.setPosition(x - BAR_WIDTH / 2, y).setAlpha(view.ch.alpha);
    view.shieldFill.setPosition(x - BAR_WIDTH / 2, y - 5).setAlpha(view.ch.alpha);
    view.chipBox.setPosition(x, y - 18).setAlpha(view.ch.alpha);
    if (view.lvl) view.lvl.setPosition(x - BAR_WIDTH / 2 - 3, y).setAlpha(view.bg.alpha);
    this.blinkIcons(view);
  }

  // Shows or hides a fighter's health bar (and item dots).
  setBarsVisible(view, visible) {
    view.bg.setVisible(visible);
    view.fill.setVisible(visible);
    view.shieldFill.setVisible(visible);
    view.chipBox.setVisible(visible);
    if (view.lvl) view.lvl.setVisible(visible);
  }

  // Redraws the status tags on a fighter: one tag per kind of status it has right now.
  // How many Assault Breastplates the living heroes hold (its enemy icon shows this number).
  assaultCopies() {
    if (!(this.state.assaultShred() > 0)) return 0; // not yet (0.5s into the floor) or nobody holds one
    return this.state.heroes.reduce((n, h) => n + (h.alive ? h.items.filter((id) => id === 'assault_breastplate').length : 0), 0);
  }

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
    // Assault Breastplate's aura (not a status): an ARMOR DOWN icon on every enemy, its number = copies held.
    const shredCopies = view.unit.side === 'enemy' && view.unit.alive ? this.assaultCopies() : 0;
    const extra = [...(view.unit.steady ? ['steady'] : []), ...(shredCopies ? ['assaultShred'] : [])];
    const list = iconList(statusIcons, kinds, (k) => (k === 'assaultShred' ? shredCopies : statusInfo[k] && (statusInfo[k].dot || statusInfo[k].stacking) ? this.state.stacks(view.unit, k) : 1), extra);
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
          .text((e.x + ICON_PX / 2) * S, e.y * S + 1, String(e.n), { fontFamily: UI.font, fontSize: '8px', color: '#ffffff', stroke: '#1a1020', strokeThickness: 3 })
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
        .text(x, -((Math.ceil(list.length / 3) || 0) * ICON_PX * S) - 10, statusInfo[k].label, { fontFamily: UI.font, fontSize: '8px', color: statusInfo[k].textColor, backgroundColor: statusInfo[k].color, padding: { x: 2, y: 1 } })
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

  // The hero's items under its skill squares: one small framed item icon per kind of item (the frame tells
  // the rarity), with a number when it has several copies. 5 per row, 2 rows; more kinds show "+N".
  drawDots(view) {
    if (!view || !view.dots) return;
    view.dots.removeAll(true);
    const counts = new Map();
    for (const id of view.unit.items) counts.set(id, (counts.get(id) || 0) + 1);
    let kinds = [...counts.entries()];
    const perRow = 5, gap = 22, rowH = 22, maxShown = perRow * 2;
    let more = 0;
    if (kinds.length > maxShown) { more = kinds.length - (maxShown - 1); kinds = kinds.slice(0, maxShown - 1); }
    const n = kinds.length + (more ? 1 : 0);
    const at = (i) => { const row = Math.floor(i / perRow), inRow = Math.min(perRow, n - row * perRow); return [((i % perRow) - (inRow - 1) / 2) * gap, row * rowH]; };
    const style = { fontFamily: UI.font, fontSize: '8px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 };
    kinds.forEach(([id, count], i) => {
      const def = itemDefs[id];
      const [x, y] = at(i);
      view.dots.add(this.add.image(x, y, itemIconKey(this, id, def.rarity)));
      if (count > 1) view.dots.add(this.add.text(x + 11, y + 11, String(count), style).setOrigin(1, 1));
    });
    if (more) { const [x, y] = at(kinds.length); view.dots.add(this.add.text(x, y, `+${more}`, { ...style, fontSize: '8px' }).setOrigin(0.5)); }
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
  walkPath(view, points, { delay, onDone, fadeLastPx = 0 }) {
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
        const step = Math.floor(walked / T.stepLenPx);
        if (step !== view.lastStep) { view.lastStep = step; if (step > 0 && ch.alpha > 0.3) sfx.play('step'); } // a footstep each landing
        ch.setScale(scaleAt(y));
        ch.setDepth(DEPTH.hero + y / 10000);
        if (fadeLastPx) { // stepping through the door: the hero goes dark in the doorway's shadow, then fades out
          const k = Phaser.Math.Clamp((total - walked) / fadeLastPx, 0, 1);
          ch.setWash(0x000000, Math.round((1 - k) * T.doorDarken * 10) / 10);
          ch.setAlpha(Phaser.Math.Clamp(k * T.doorFadeLate, 0, 1));
        }
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
      v.ch.setWash(0x000000, 0); // out of the last doorway's shadow
      this.drawMoraleWash(); // (and the morale wash back on)
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
          fadeLastPx: T.doorFadePx,
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
    if (DEMO !== 'brood') this.floor += 1; // the Brood Mother demo page: floor 40 again and again
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
    const events = this.state.update(Math.min(delta, 100));
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

  // A held event can still be drawn: its fighters still have their views.
  lateOk(e) {
    const ids = e.type === 'attack' ? [e.attacker, e.target] : e.type === 'death' || e.type === 'heal' ? [e.unit] : [];
    return this.mode === 'fighting' || this.mode === 'won' ? ids.every((u) => !u || this.views.get(u.uid)) : false;
  }

  // One batch of events. A v2 skill look (combat.json skillFx.look / wave / flask / counter) HOLDS the hits it draws:
  // that caster's damage numbers, the heals and the enemy deaths of the same batch wait until the look lands (hitMs,
  // + staggerMs per target in the look's target order), and projectiles the look already draws are not drawn again.
  // Only the drawing waits: the fight itself (BattleState) has already done it all.
  showEvents(events) {
    let hold = null;
    for (const e of events) {
      if (hold && e.type === 'projectile' && e.from === hold.unit && (hold.swallow || []).includes(e.kind)) continue;
      const opened = this.holdFor(e);
      if (opened !== undefined) { hold = opened; this.showEvent(e); continue; }
      const late = hold && this.heldMs(hold, e);
      if (late) this.time.delayedCall(late, () => this.showEvent(e, true));
      else this.showEvent(e);
    }
  }

  // Does this event start a hold? Returns the hold, null (it ends the last one) or undefined (not a look's event).
  holdFor(e) {
    if (e.type === 'cast' && e.unit.side === 'hero') {
      const L = LOOK_BY_NAME[e.skill.name];
      return L && L.hitMs ? { unit: e.unit, ms: L.hitMs, stagger: L.staggerMs || 0, order: e.targets, swallow: L.swallow } : null;
    }
    if (e.type === 'wave' && e.unit.side === 'hero') {
      const W = waveLook(e.skill);
      return W && W.hitMs ? { unit: e.unit, ms: W.hitMs, stagger: W.staggerMs || 0, order: e.targets, swallow: W.swallow } : undefined;
    }
    if (e.type === 'flask' && e.flask && e.flask.name) return { unit: e.unit, ms: FX.flask.hitMs, stagger: 0, order: [e.target] };
    // A crescent that is not part of a Wind Cutter (those are swallowed by its cast hold) is a Counter Stance counter-cut.
    if (e.type === 'projectile' && e.kind === 'crescent' && e.from.side === 'hero') return { unit: e.from, ms: FX.counter.hitMs, stagger: 0, order: [e.to] };
    return undefined;
  }

  // How long an event waits under a hold (0 = now).
  heldMs(hold, e) {
    const at = (u) => hold.ms + hold.stagger * Math.max(0, hold.order.indexOf(u));
    if (e.type === 'attack' && e.attacker === hold.unit && !e.basic) return at(e.target);
    if (e.type === 'heal') return hold.ms;
    if (e.type === 'death' && e.unit.side === 'enemy') return at(e.unit) + 1;
    return 0;
  }

  showEvent(e, late = false) {
    if (late && !this.lateOk(e)) return; // a held event whose fighter is already gone
    if (e.type === 'attackStart') {
      const a = this.views.get(e.attacker.uid);
      const t = this.views.get(e.target.uid);
      if (!a || !t) return;
      a.lookAt = e.target; // it turns to face what it attacks
      // Melee: it already walked up (the fight rules move it), now it swings. Ranged: an arrow.
      const lob = e.attacker.def.passive && e.attacker.def.passive.lobbed;
      if (lob) this.lobFlask(a, t, e.hitInMs, Number(lob.color)); // Alchemist: his shots are flasks
      else if (e.attacker.damageType !== 'melee') this.shootArrow(a, t, e.hitInMs);
      else { a.ch.swing(e.hitInMs); this.stepIn(a, t, e.hitInMs); }
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
      if (!t) return;
      // `a` can be gone: a Kobold Sapper's bomb goes off after the Sapper's body has faded (user bug: the game froze).
      if (e.basic) {
        // The walk/swing or the arrow already showed this attack. Melee fighters STAY where they are.
        if (a) this.landArrow(a); // the arrow reaches its target exactly as the damage lands
      } else if (a && !a.ch.moveTween) {
        a.ch.lunge(t.ch.x, t.ch.y); // skills and item hits: a small jab (only from its own spot)
      }
      if (e.result.invulnerable) {
        this.popText(t, 'Immune!', '#ffe08a', true);
        sfx.play('block');
        return;
      }
      if (e.result.dodged) {
        if (e.result.blocked) { this.popText(t, 'Blocked!', '#9fc4ff', true); this.addMoment('block', t, a); sfx.play('block'); }
        else { this.popText(t, 'Miss', '#aaaaaa'); this.addMoment('dodge', t, a); sfx.play('miss'); }
        return;
      }
      this.hitSound(e);
      this.setBar(t);
      this.drawChips(t); // the shield tag shows what is left
      if (e.result.absorbed > 0) {
        sfx.play('shieldSoak');
        this.popText(t, `Shield -${e.result.absorbed}`, '#6fd0ff');
        this.addMoment('soak', t, a);
        if (e.result.fullyAbsorbed) return;
        e.result = { ...e.result, amount: e.result.amount - e.result.absorbed };
      }
      const { amount, crit, mult } = e.result;
      const mark = mult > 1 ? '!' : mult < 1 ? '…' : '';
      if (!e.skill && t && !e.ghastly && !e.noImpact) this.addImpact(e, a, t); // the hit's own look, per damage type (systems/hitFx.js)
      // Element charms ride inside the hit (one number): their element's hit look and sound play with it.
      for (const r of e.result.riders || []) {
        if (t) this.addImpact({ ...e, damageType: r.damageType, result: { ...e.result, crit: false } }, a, t);
        this.hitSound({ ...e, damageType: r.damageType, result: { crit: false } });
      }
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
      if (e.kind === 'crescent' && e.from.side === 'hero') this.playCounterLook(this.views.get(e.from.uid), this.views.get(e.to.uid)); // Counter Stance
      else this.showProjectile(this.views.get(e.from.uid), this.views.get(e.to.uid), e.kind);
    } else if (e.type === 'castStart' && e.boss) {
      // A boss winds up a move: its name in red over it, and a red bar fills (drawCastBars).
      sfx.play('bossWarn');
      const bv = this.views.get(e.unit.uid);
      if (bv) { this.popText(bv, e.skill.name, '#ff7a6a', true); bv.ch.flash(0xff4a3a, 140); }
      // A slam move (Grukk's Quake Jump): it rises into the air during the wind-up (it crashes down in 'bossAbility').
      if (bv && e.ability && e.ability.slam) this.tweens.add({ targets: Object.assign(bv, { leapLift: bv.leapLift || 0 }), leapLift: e.ability.slam.liftPx, duration: e.castMs, ease: 'Quad.easeOut' });
    } else if (e.type === 'castStart') {
      // The hero winds up and a charge bar fills (see drawCastBars); its name shows when it goes off (skillName).
      this.stopStep(this.views.get(e.unit.uid)); // the skill cuts the attack short (Character.stopAttack: the swing)
      this.views.get(e.unit.uid).ch.castWindUp(e.castMs);
      this.playCharge(this.views.get(e.unit.uid), e); // crouch and raise the weapon
    } else if (e.type === 'castCancel') {
      const cv = this.views.get(e.unit.uid);
      if (!cv) return;
      cv.ch.castCancel();
      if (cv.leapLift && e.unit.side === 'enemy' && !e.unit.statuses.some((st) => st.type === 'airborne')) this.tweens.add({ targets: cv, leapLift: 0, duration: 200, ease: 'Quad.easeIn' }); // a stopped slam drops
      if (e.reason === 'interrupted') { this.popText(this.views.get(e.unit.uid), 'Interrupted!', '#ff8a5c', true); sfx.play('interrupted'); }
    } else if (e.type === 'cast') {
      const caster = this.views.get(e.unit.uid);
      this.stopStep(caster); // an instant skill also cuts the attack short
      if (e.unit.side === 'hero' && !e.unit.minion) sfx.play(sfx.has(`skill_${e.skillId}`) ? `skill_${e.skillId}` : 'skillCast'); // each skill its own sound
      if (e.zone) this.showZone(e.zone, FX.areaMs);
      const look = e.unit.side === 'hero' ? LOOK_BY_NAME[e.skill.name] : null;
      if (look) this.lookMoves(caster, e, look); // before the burst: the look wants to know where he lands
      this.skillBurst(caster, e);
      if (e.skill.leap && e.targets[0] && !(look && look.leap)) this.leapAt(caster, this.views.get(e.targets[0].uid), null, e.moved); // Savage Leap
      const dash = DASH_BY_NAME[e.skill.name];
      if (dash && e.targets[0]) this.dashAt(caster, this.views.get(e.targets[0].uid), dash, e.moved); // Defense Bash, Multistrike
      caster.ch.castRelease(e.skill.kind); // the skill's own animation (not the normal swing)
      if ((e.skill.target === 'enemy' || e.skill.target === 'allEnemies') && e.targets[0] && !e.skill.leap && !dash && !look) {
        const t = this.views.get(e.targets[0].uid);
        caster.ch.lunge(t.ch.x, t.ch.y);
      }
    } else if (e.type === 'status') {
      const v = this.views.get(e.unit.uid);
      this.drawChips(v);
      if (e.change === 'expire' && e.status.type === 'freeze' && v && !e.unit.statuses.some((st) => st.type === 'freeze')) {
        (this.iceBreaks = this.iceBreaks || []).push({ view: v, start: this.time.now }); // the ice breaks off
      }
      if (e.change === 'apply' && (e.status.type === 'stun' || e.status.type === 'freeze')) sfx.play(e.status.type);
      if (e.change === 'apply' && e.status.type !== 'buff' && statusInfo[e.status.type].popup !== false) {
        this.popText(v, statusInfo[e.status.type].label + '!', statusInfo[e.status.type].color);
      }
      if (e.status.type === 'buff') this.drawAllBars();
      if (e.status.type === 'shield') this.setBar(v);
    } else if (e.type === 'itemUsed') {
      this.drawDots(this.views.get(e.unit.uid)); // a consumable was used up: one dot less
    } else if (e.type === 'wave') {
      if (e.zone) this.showZone(e.zone, FX.areaMs * 0.7);
      // One wave of a channel (Rain of Arrows, Crescendo): a ring on the caster that grows with the wave.
      // A skill with its own wave look (combat.json skillFx.wave, e.g. Multistrike slashes) plays that instead.
      const v = this.views.get(e.unit.uid);
      const own = waveLook(e.skill);
      if (own && own.none) { /* its cast look draws it (Holy Nova's smite) */ } else if (own) this.playWaveFx(own, v, e);
      else if (v) {
        const c = this.center(v);
        const ring = this.add.circle(c.x, c.y, 10).setStrokeStyle(2 + e.wave, 0xffd84d).setDepth(DEPTH.popup - 1);
        this.tweens.add({ targets: ring, radius: 24 + e.wave * 10, alpha: 0, duration: 400, onComplete: () => ring.destroy() });
      }
    } else if (e.type === 'flask') {
      if (e.flask.name && e.unit.side === 'hero') this.playFlaskLook(this.views.get(e.unit.uid), this.views.get(e.target.uid), e.flask); // Alchemist v2 look
      else this.showFlask(this.views.get(e.unit.uid), this.views.get(e.target.uid), Number(e.flask.color));
    } else if (e.type === 'minionSpawn') {
      this.showMinion(e.unit);
    } else if (e.type === 'tornadoSpawn') {
      this.tornadoViews = this.tornadoViews || new Map();
      // It appears ON the enemy it was made on (then glides from enemy to enemy). The container only carries
      // the position: drawHitFx() draws the pixel funnel there.
      const at = this.views.get((e.target || e.tornado.target).uid);
      const g = this.add.container(at ? at.ch.x : GAME_WIDTH / 2, at ? at.ch.y : SLOT_Y - 200).setDepth(DEPTH.popup - 2);
      this.tornadoViews.set(e.tornado.id, { g, t: e.tornado });
      this.puff(g.x, g.y, 0xcfe8ff, 4);
    } else if (e.type === 'thunderstruck') {
      // Thunderstruck: a giant bolt from the top of the screen onto the marked enemy, with a small shake.
      const tv = this.views.get(e.target.uid);
      if (tv) {
        const seed = (this.impactSeed = (this.impactSeed || 0) + 1);
        this.addFx(itemFx.ITEM_MS.thunderstruck, (q, now) => (tv.ch.active ? itemFx.thunderstruckFx(q, this.fxBody(tv), now, seed) : []), ['item', 'thunderstruck']);
        this.cameras.main.shake(120, 0.004);
      }
    } else if (e.type === 'bombFizzle') {
      this.puff(e.bomb.x, e.bomb.y, 0x4a4a52, 4); // a Sapper bomb goes out with the floor: a little grey smoke
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
      if (e.explosive) this.cameras.main.shake(120, 0.004); // an Explosive elite
    } else if (e.type === 'iceSpikes') {
      // Frozen Demon Head: big ice spikes burst up out of the ground under the enemy, then shatter.
      const v = this.views.get(e.target.uid);
      const c = v ? this.center(v) : { x: e.target.x, y: e.target.y };
      const foot = c.y + 18;
      [[-18, 26], [-8, 40], [4, 48], [15, 34], [24, 22]].forEach(([dx, h], i) => {
        const spike = this.add.triangle(c.x + dx, foot, -5, 0, 5, 0, 0, -h, i % 2 ? 0x9fe0ff : 0xe8fbff).setOrigin(0, 0).setStrokeStyle(1, 0x3b8ee0).setDepth(DEPTH.popup - 1).setScale(1, 0);
        this.tweens.add({ targets: spike, scaleY: 1, duration: 120, delay: i * 30, ease: 'Back.easeOut', onComplete: () => this.tweens.add({ targets: spike, alpha: 0, delay: 380, duration: 220, onComplete: () => spike.destroy() }) });
      });
      this.puff(c.x, foot, 0x9fe0ff, 10);
      this.cameras.main.shake(120, 0.004);
    } else if (e.type === 'lifeOrb') {
      // Life Crystal: a green orb pops out of the dead enemy, then a small orb flies to every hero it heals.
      const v = this.views.get(e.at.uid);
      const c = v ? this.center(v) : { x: e.at.x, y: e.at.y };
      const orb = this.add.circle(c.x, c.y, 6, 0x5ddf6a).setDepth(DEPTH.popup - 1);
      this.tweens.add({ targets: orb, y: c.y - 18, scale: 1.4, duration: 220, yoyo: true, onComplete: () => orb.destroy() });
      for (const t of e.targets) {
        const tv = this.views.get(t.uid);
        if (!tv) continue;
        const to = this.center(tv);
        const bit = this.add.circle(c.x, c.y - 18, 4, 0x9dffa8).setDepth(DEPTH.popup - 1);
        this.tweens.add({ targets: bit, x: to.x, y: to.y, delay: 220, duration: 320, ease: 'Quad.easeIn', onComplete: () => { bit.destroy(); this.puff(to.x, to.y, 0x5ddf6a, 4); } });
      }
    } else if (e.type === 'shieldBreak') {
      sfx.play('shieldBreak');
      const v = this.views.get(e.unit.uid);
      this.drawChips(v);
      this.setBar(v);
      this.popText(v, 'Shield broken!', '#6fd0ff', true);
      this.addMoment('shieldBreak', v);
      this.cameras.main.shake(90, 0.003);
    } else if (e.type === 'soulFeed') { // Soul Lantern: every kill, glowing green lines swirl round the holder
      const hv = this.views.get(e.unit.uid);
      if (hv) this.addFx(itemFx.ITEM_MS.soulLantern, (q, now) => (hv.ch.active ? itemFx.soulLanternFx(q, this.fxBody(hv), now) : []), ['item', 'soulLantern']);
    } else if (e.type === 'proc') {
      const v = this.views.get(e.unit.uid);
      if (e.itemId && itemDefs[e.itemId]) this.itemProc(e, v); // an item: its icon pops + its own effect
      else this.popText(v, e.label, '#ffd24d', true); // passives and other moments keep their text
    } else if (e.type === 'lifesteal') {
      const v = this.views.get(e.unit.uid), fv = this.views.get(e.from.uid);
      if (v && fv) { const a = this.fxPoint(fv); this.addFx(itemFx.ITEM_MS.lifesteal, (q) => itemFx.lifestealFx(q, a, v.ch.active ? this.fxPoint(v) : a), ['item', 'lifesteal']); }
    } else if (e.type === 'heal') {
      const v = this.views.get(e.unit.uid);
      this.setBar(v);
      this.popText(v, `+${Math.round(e.amount)}`, '#6dff8f');
      if (!v.healFxAt || this.time.now - v.healFxAt > 450) { v.healFxAt = this.time.now; this.addMoment('heal', v); } // not on every tiny heal
    } else if (e.type === 'thorns') {
      const v = this.views.get(e.unit.uid);
      v.ch.flash();
      this.setBar(v);
      this.popText(v, `${e.amount} thorns`, '#e8a0ff');
      const hv = e.holder ? this.views.get(e.holder.uid) : null;
      if (hv) this.addFx(itemFx.ITEM_MS.thorns, (q) => (hv.ch.active ? itemFx.thornsFx(q, this.fxBody(hv)) : []), ['item', 'thorns']); // spikes jab out of the holder
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
        this.popText(v, e.crit ? `${e.amount}!` : String(e.amount), e.crit ? '#ffd24d' : damageTypes[e.damageType].color, e.crit); // Catalyst Vial: a crit tick is big and gold
      }
    } else if (e.type === 'morale') {
      this.drawMoraleWash();
      for (const h of this.state.heroes) this.setBar(this.views.get(h.uid));
    } else if (e.type === 'intercept') {
      // Knight's Intercept: he jumps in to guard a hurt ally.
      const kv = this.views.get(e.unit.uid), av = this.views.get(e.ally.uid);
      if (kv) { this.popText(kv, 'Intercept!', '#6fa8ff', true); kv.ch.flash(0x6fa8ff, 160); }
      if (av) av.ch.flash(0x6fa8ff, 160);
    } else if (e.type === 'intercepted') {
      const kv = this.views.get(e.unit.uid);
      if (kv) { this.setBar(kv); if (e.amount > 0) this.popText(kv, `-${e.amount}`, '#9cc4ff'); }
    } else if (e.type === 'selfCost') {
      const v = this.views.get(e.unit.uid);
      if (v) { this.setBar(v); this.popText(v, `-${e.amount}`, '#ff5a5a'); }
    } else if (e.type === 'reaction') {
      // Mage's reactions: a big coloured word over the enemy.
      const v = this.views.get(e.unit.uid);
      const look = { steam: ['Steam!', '#e8e8f0'], shatter: ['Shatter!', '#8fe0ff'], overload: ['Overload!', '#ffa040'] }[e.kind];
      if (v && look) { this.popText(v, look[0], look[1], true); v.ch.flash(Number('0x' + look[1].slice(1)), 140); }
    } else if (e.type === 'song') {
      const v = this.views.get(e.unit.uid);
      if (v && e.song) this.popText(v, e.song === 'ballad' ? 'Ballad!' : 'March!', e.song === 'ballad' ? '#6dff8f' : '#ffb84d', true); // song: null = it stopped
      this.drawAllBars();
    } else if (e.type === 'lute') {
      // Bard's lute: the boost's name over him, a ring in its colour on every hero.
      const v = this.views.get(e.unit.uid), col = Number(e.color);
      if (v) this.popText(v, `${e.boost}!`, '#' + col.toString(16).padStart(6, '0'), true);
      for (const h of this.state.heroes) { const hv = this.views.get(h.uid); if (h.alive && hv) this.ring(hv, col); }
    } else if (e.type === 'combo') {
      // drawn every frame by drawHeroHud()
    } else if (this.showBookEvent(e)) {
      // skill book modifier moments (Titan, Roar, Ricochet, Aftershock)
    } else if (this.showBossEvent(e)) {
      // boss moves (systems/bosses.js): handled in showBossEvent()
    } else if (e.type === 'levelup') {
      sfx.play('levelUp');
      const v = this.views.get(e.unit.uid);
      this.setBar(v);
      if (v.lvl) v.lvl.setText(`Lv${e.unit.level}`);
      this.popText(v, `LEVEL UP\nLv${e.unit.level}`, '#ffd24d', true, 8); // two short lines: three heroes levelling at once don't print over each other
    } else if (e.type === 'death') {
      const v = this.views.get(e.unit.uid);
      this.setBar(v);
      sfx.play(e.unit.side === 'enemy' || e.unit.minion ? 'enemyDeath' : 'heroFall');
      if (e.unit.side === 'hero' && !e.unit.minion) this.lastKiller = e.killer && e.killer.side === 'enemy' ? e.killer.def.name : null; // named on the defeat screen
      if (e.unit.side === 'enemy' || e.unit.minion) {
        v.ch.stopMove(); // it fades out where it fell
        v.ch.castCancel();
        v.ch.die(); // death clip (if it has one)
        this.drawChips(v);
        // A last white flash, it squashes flat into the floor, then a grey puff of smoke and it is gone.
        v.ch.flash(0xffffff, 120);
        this.tweens.add({ targets: [v.bg, v.fill, v.shieldFill, v.chipBox], alpha: 0, duration: 250 });
        this.tweens.add({ targets: v.ch, scaleY: v.ch.scaleY * 0.1, alpha: 0.6, delay: 120, duration: 300, ease: 'Quad.easeIn' });
        this.time.delayedCall(380, () => {
          if (v.ch.active) (this.impacts = this.impacts || []).push({ kind: 'puff', start: this.time.now, ms: TUNE.ms('hit', 'puff', MOMENT_MS.puff), x: v.ch.x / CHAR_SCALE, y: v.ch.y / CHAR_SCALE });
          this.removeView(e.unit.uid);
        });
      } else {
        // A hero who falls while away at an enemy is put back in its slot.
        v.ch.stopMove();
        v.ch.setPosition(v.ch.homeX, v.ch.homeY).setDepth(DEPTH.hero);
        this.syncBar(v);
        v.ch.die(); // death clip if it has one, then it stops moving
        this.heroFell(v);
        v.skillButtons.forEach((b) => [b.g, b.code, b.cd].forEach((o) => o.setAlpha(0)));
        if (v.passiveIcon) v.passiveIcon.setAlpha(0);
        v.bg.setAlpha(0.4);
        v.fill.setAlpha(0.4);
        if (v.lvl) v.lvl.setAlpha(0.4);
        if (v.dots) v.dots.setAlpha(0.3); // its items stop working
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
    // The shot itself is drawn in pixels by drawHitFx() (its look per damage type: systems/hitFx.js);
    // this empty container only carries its position along the flight.
    const arrow = this.add.container(from.x, from.y);
    arrow.kind = a.unit.hitType || a.unit.damageType; // an elite archer shoots its element
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
    arrow.startX = fromX; // the trail points back along the flight
    arrow.startY = fromY;
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
    // A pixel flask lobbed over that splashes in its colour (systems/skillFx.js); it aims at where the target is NOW.
    const a = this.fxPoint(from);
    let b = this.fxPoint(to);
    const seed = (this.impactSeed = (this.impactSeed || 0) + 1);
    this.addFx(SHOT_MS.flask, (q, now) => { if (to.ch.active) b = this.fxPoint(to); return shotFx('flask', q, a, b, now, seed, color); }, ['shot', 'flask']);
    this.time.delayedCall(SHOT_MS.flask / 2, () => sfx.play('flaskBreak')); // the glass breaks as it lands (half-way)
  }


  // Alchemist's basic attack (Lobbed Shots): the flask recipe lobs over in the first half, so it runs twice the
  // flight time and lands as the hit does.
  lobFlask(from, to, hitInMs, color) {
    const a = this.fxPoint(from);
    let b = this.fxPoint(to);
    const seed = (this.impactSeed = (this.impactSeed || 0) + 1);
    this.addFx(Math.max(200, hitInMs * 2), (q, now) => { if (to.ch.active) b = this.fxPoint(to); return shotFx('flask', q, a, b, now, seed, color); }, ['shot', 'flask']);
    this.time.delayedCall(Math.max(100, hitInMs), () => sfx.play('flaskBreak'));
    from.ch.lunge(to.ch.x, to.ch.y);
  }

  showProjectile(from, to, kind) {
    if (!from || !to) return;
    if (kind === 'arrow') return this.shootArrow(from, to, 200); // Quiver of Plenty's extra arrow: a normal shot
    const start = this.center(from);
    // Skill shots in pixels (systems/skillFx.js); they aim at where the target is NOW.
    if (SHOT_MS[kind] || kind === 'crescent') {
      if (kind === 'crescent') return; // Wind Cutter: the cast effect sweeps one crescent over the whole line
      const a = this.fxPoint(from);
      let b = this.fxPoint(to);
      const seed = (this.impactSeed = (this.impactSeed || 0) + 1);
      this.addFx(SHOT_MS[kind], (q, now) => { if (to.ch.active) b = this.fxPoint(to); return shotFx(kind, q, a, b, now, seed); }, ['shot', kind]);
      return;
    }
    // Pixel looks from systems/itemFx.js: Fire Bombs' bomb, lightning bolts (Static Crystal, Chain Lightning),
    // the Grimoire's green ghost fire. They aim at where the target is NOW.
    if (itemFx.BOMB_KINDS[kind]) { // Fire / Ice / Electric / Dark / Poison bombs: the same bomb in their element's colours
      const a = this.fxPoint(from);
      let b = this.fxPoint(to);
      const seed = (this.impactSeed = (this.impactSeed || 0) + 1);
      this.addFx(itemFx.ITEM_MS.bomb, (q, now) => { if (to.ch.active) b = this.fxPoint(to); return itemFx.bombFx(q, a, b, now, seed, itemFx.BOMB_KINDS[kind]); }, ['item', 'bomb']);
      return;
    }
    if (kind === 'lightning' || kind === 'greenfire' || kind === 'moon' || kind === 'spiritfire') {
      const a = this.fxPoint(from);
      let b = this.fxPoint(to);
      const seed = (this.impactSeed = (this.impactSeed || 0) + 1);
      const fn = { lightning: itemFx.lightningFx, greenfire: itemFx.greenfireFx, moon: itemFx.moonFx, spiritfire: itemFx.spiritFireFx }[kind];
      this.addFx(itemFx.ITEM_MS[kind], (q, now) => { if (to.ch.active) b = this.fxPoint(to); return fn(q, a, b, now, seed); }, ['item', kind]);
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
    }); // any other kind: a plain orange ball (fallback)
  }

  drawAllBars() {
    for (const h of this.state.heroes) this.setBar(this.views.get(h.uid));
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
    if (v.lvl) v.lvl.destroy();
    v.chipBox.destroy();
    this.views.delete(uid);
  }

  // The big smoke cloud a fallen hero turns into (combat.json heroDanger poof*): puffs burst out in a ring and up.
  heroPoof(x, y) {
    const D = combatRules.heroDanger, n = D.poofCount, color = Phaser.Display.Color.HexStringToColor(D.poofColor).color;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, r = 6 + (i % 3) * 3;
      const c = this.add.circle(x + Math.cos(a) * 6, y + Math.sin(a) * 4, r, i % 4 === 0 ? 0xb8b8c4 : color, 0.95).setDepth(DEPTH.popup - 2).setScale(0.4);
      this.tweens.add({ targets: c, x: x + Math.cos(a) * 30, y: y + Math.sin(a) * 18 - 12, scale: 1.5, alpha: 0, duration: D.poofMs + (i % 3) * 80, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
    }
    const core = this.add.circle(x, y, 12, 0xffffff, 1).setDepth(DEPTH.popup - 2).setScale(0.5); // the bright middle
    this.tweens.add({ targets: core, scale: 2, alpha: 0, duration: D.poofMs * 0.6, ease: 'Quad.easeOut', onComplete: () => core.destroy() });
  }

  // A pixel tombstone (grey stone, dark cross) standing at x, y (its foot); it pops up out of the smoke.
  makeGrave(x, y) {
    const P = CHAR_SCALE, w = 8, hgt = 10;
    const grave = this.add.graphics().setDepth(DEPTH.hero - 0.5);
    grave.fillStyle(0x1a1a1a).fillRect(-w / 2 * P - P, -hgt * P - P, (w + 2) * P, (hgt + 1) * P); // outline
    grave.fillStyle(0x8a8a96).fillRect(-w / 2 * P, -hgt * P, w * P, hgt * P);
    grave.fillStyle(0x1a1a1a).fillRect(-w / 2 * P - P, -hgt * P - P, P, P).fillRect((w / 2) * P, -hgt * P - P, P, P); // round top corners
    grave.fillStyle(0xb4b4c0).fillRect(-w / 2 * P, -hgt * P, w * P, P); // light top edge
    grave.fillStyle(0x3a3a44).fillRect(-P, -8 * P, P, 6 * P).fillRect(-2 * P, -6 * P, 4 * P, P); // the cross
    grave.fillStyle(0x2a2a30, 0.6).fillRect(-w / 2 * P - 2 * P, 0, (w + 4) * P, P); // a little dirt at its foot
    grave.setPosition(x, y).setScale(0.3, 0.3);
    this.tweens.add({ targets: grave, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.easeOut' });
    return grave;
  }

  // A hero in danger (combat.json heroDanger): below lowHpPercent health a soft red glow rises from the bottom edge of
  // the screen under that hero's slot, stronger the lower its health, pulsing slowly. A hero that just fell flares its
  // column once (v.fellAt). Pixel bands, no smoothing.
  drawDangerGlow() {
    const D = combatRules.heroDanger, g = this.dangerGlow;
    g.clear();
    const now = this.time.now, color = Phaser.Display.Color.HexStringToColor(D.glowColor).color;
    const bandH = Math.ceil(D.glowHeightPx / D.glowBands);
    this.state.heroes.forEach((h, i) => {
      const v = this.views.get(h.uid);
      if (!v) return;
      let strength = 0;
      const ratio = h.hp / h.maxHp;
      if (h.alive && this.mode === 'fighting' && ratio * 100 < D.lowHpPercent) {
        const deep = 1 - (ratio * 100) / D.lowHpPercent; // 0 at the line .. 1 at no health
        const pulse = 0.75 + 0.25 * Math.sin((now / D.pulseMs) * Math.PI * 2);
        strength = (D.glowMinStrength + (1 - D.glowMinStrength) * deep) * pulse;
      }
      if (v.fellAt !== undefined && now - v.fellAt < D.fellGlowMs) strength = Math.max(strength, 1.4 * (1 - (now - v.fellAt) / D.fellGlowMs));
      if (strength <= 0) return;
      const x = this.slotWidth * i;
      for (let k = 0; k < D.glowBands; k++) {
        const fade = 1 - k / D.glowBands;
        g.fillStyle(color, Math.min(1, D.glowAlpha * strength * fade * fade));
        g.fillRect(x, GAME_HEIGHT - (k + 1) * bandH, this.slotWidth, bandH);
      }
    });
  }

  // The whole screen pulses red when a hero falls (combat.json heroDanger deathFlash*): in fast, out slower.
  deathFlash() {
    const D = combatRules.heroDanger;
    const color = Phaser.Display.Color.HexStringToColor(D.deathFlashColor).color;
    const r = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, color).setAlpha(0).setDepth(DEPTH.popup - 1);
    this.tweens.chain({
      targets: r,
      tweens: [
        { alpha: D.deathFlashAlpha, duration: D.deathFlashInMs, ease: 'Quad.easeOut' },
        { alpha: 0, duration: D.deathFlashOutMs, ease: 'Quad.easeIn' },
      ],
      onComplete: () => r.destroy(),
    });
  }

  // A hero fell (combat.json heroDanger): a white flash, it tips over (towards the middle of the screen), lies still a
  // moment, then POOF: a cloud of smoke bursts over the body and it is replaced by a tombstone. '<NAME> FELL' shows
  // over it and its column of the danger glow flares.
  heroFell(v) {
    const D = combatRules.heroDanger;
    v.fellAt = this.time.now;
    v.ch.flash(0xffffff, 160);
    this.deathFlash();
    sfx.play('heroDeath'); // a low bell toll, over the fall thud
    const back = v.ch.homeX < GAME_WIDTH / 2 ? -1 : 1; // its body falls towards the middle of the screen, never off the edge
    this.tweens.add({ targets: v.ch, angle: -90 * back, duration: D.fallMs, ease: 'Bounce.easeOut' });
    // Where the lying body is: half its height along the floor from its feet.
    const bodyX = v.ch.homeX - back * (v.unit.def.height * charScale(v.unit.def)) / 2, bodyY = v.ch.homeY - 6;
    this.time.delayedCall(D.fallMs + D.lieMs, () => {
      if (!v.ch.active) return;
      this.heroPoof(bodyX, bodyY);
      this.time.delayedCall(D.poofMs * 0.2, () => {
        if (!v.ch.active) return;
        v.ch.setVisible(false); // gone under the smoke
        v.grave = this.makeGrave(bodyX, v.ch.homeY);
      });
    });
    // '<NAME> FELL' over the hero.
    const y = v.ch.homeY - v.unit.def.height * charScale(v.unit.def) - 34;
    const t = this.add.text(v.ch.homeX, y, `${v.unit.name.toUpperCase()}\nFELL`, { fontFamily: UI.font, fontSize: `${D.textSizePx}px`, color: D.textColor, stroke: '#000000', strokeThickness: 4, align: 'center' })
      .setOrigin(0.5).setDepth(DEPTH.popup).setScale(1.6).setAlpha(0);
    t.x = Phaser.Math.Clamp(t.x, t.width / 2 + 4, GAME_WIDTH - t.width / 2 - 4);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: y - 16, delay: 200 + D.textHoldMs, duration: D.textOutMs, onComplete: () => t.destroy() });
  }

  // Floating number above a fighter.
  // Savage Leap: the hero jumps at the target in an arc and lands back in his spot.
  // With `S` (combat.json skillFx.look.brawl_leap.leap) it is the v2 SLAM: up fast and high (liftPx), hangs, slams down
  // at upMs, holds holdMs, comes back in backMs.
  leapAt(caster, target, S = null, from = null) {
    if (!target) return;
    if (from) { // the rules already put him where he lands (skills.json staysAtImpact): fly over from where he was, stay there
      const u = caster.unit, ox = from.x - u.x, oy = from.y - u.y, lift = S ? S.liftPx : 26, j = { p: 0 };
      const setF = () => {
        caster.leapX = ox * (1 - j.p);
        caster.leapY = oy * (1 - j.p);
        caster.leapLift = S ? Math.sin(Math.pow(j.p, 0.6) * Math.PI) * lift : Math.sin(j.p * Math.PI) * 26;
      };
      setF();
      this.tweens.add({ targets: j, p: 1, duration: S ? S.upMs : 230, ease: S ? 'Linear' : 'Quad.easeOut', onUpdate: setF, onComplete: () => { caster.leapX = caster.leapY = caster.leapLift = 0; } });
      return;
    }
    const share = S ? S.share : 0.8;
    const dx = (target.ch.x - caster.ch.x) * share;
    const dy = (target.ch.y - caster.ch.y) * share;
    const jump = { p: 0 }, lift = S ? S.liftPx : 26;
    let going = true;
    const set = () => {
      caster.leapX = dx * jump.p;
      caster.leapY = dy * jump.p;
      // the slam: the peak comes early and the fall is quick; no lift on the way back
      caster.leapLift = S ? (going ? Math.sin(Math.pow(jump.p, 0.6) * Math.PI) * lift : 0) : Math.sin(jump.p * Math.PI) * 26;
    };
    const back = () => { going = false; this.tweens.add({ targets: jump, p: 0, duration: S ? S.backMs : 300, delay: S ? S.holdMs : 120, ease: 'Quad.easeInOut', onUpdate: set, onComplete: () => { caster.leapX = caster.leapY = caster.leapLift = 0; } }); };
    this.tweens.add({ targets: jump, p: 1, duration: S ? S.upMs : 230, ease: S ? 'Linear' : 'Quad.easeOut', onUpdate: set, onComplete: back });
  }

  // How a v2 skill look moves the scene (combat.json skillFx.look): the leap slam or a recoil, then at the hit (hitMs)
  // the shake, the hit-stop and the hit enemies jittering. Also notes where Savage Leap lands (for its look).
  lookMoves(caster, e, L) {
    const t0 = e.targets[0] && this.views.get(e.targets[0].uid);
    if (L.leap && t0) {
      const a = this.fxBody(caster), b = this.fxBody(t0); // before the leap: he is still drawn where he takes off
      this.leapAt(caster, t0, L.leap, e.moved);
      e.land = e.moved ? { x: a.x + (e.unit.x - e.moved.x) / CHAR_SCALE, y: a.y + (e.unit.y - e.moved.y) / CHAR_SCALE } // where the rules put him
        : { x: a.x + (b.x - a.x) * L.leap.share, y: a.y + (b.y - a.y) * L.leap.share }; // where he lands: it never moves
    }
    if (L.move && L.move.type === 'recoil') {
      const to = t0 ? t0.ch : { x: caster.ch.x, y: caster.ch.y - 100 }; // no target: rock back down (enemies are above)
      const dx = caster.ch.x - to.x, dy = caster.ch.y - to.y, len = Math.hypot(dx, dy) || 1, r = { p: 0 };
      const set = () => { caster.leapX = (dx / len) * L.move.px * r.p; caster.leapY = (dy / len) * L.move.px * r.p; };
      this.tweens.add({ targets: r, p: 1, duration: 50, ease: 'Quad.easeOut', onUpdate: set,
        onComplete: () => this.tweens.add({ targets: r, p: 0, duration: 270, ease: 'Quad.easeOut', onUpdate: set, onComplete: () => { caster.leapX = caster.leapY = 0; } }) });
    }
    const hitViews = e.targets.filter((u) => u.side === 'enemy').map((u) => this.views.get(u.uid)).filter(Boolean);
    const radius = (L.leap ? L.landSplash && L.landSplash.radius : 0) || 0;
    if (L.leap && radius && e.land) for (const en of this.state.enemies) { // everyone in the landing area is thrown back too
      const v = en.alive && this.views.get(en.uid); if (!v || hitViews.includes(v)) continue;
      const b = this.fxBody(v); if (Math.hypot(b.x - e.land.x, (b.y - e.land.y) * 1.4) * CHAR_SCALE <= radius) hitViews.push(v);
    }
    this.time.delayedCall(L.hitMs || 0, () => {
      if (L.shakeMs) this.cameras.main.shake(L.shakeMs, L.shakeIntensity);
      if (L.stopMs) this.hitStop = Math.max(this.hitStop || 0, L.stopMs);
      hitViews.forEach((v, i) => {
        if (L.leap && L.leap.knockPx && e.land) this.knockFrom(v, e.land, L.leap.knockPx);
        else if (L.jitterPx) this.time.delayedCall((L.staggerMs || 0) * i, () => this.jitter(v, L.jitterPx, L.jitterMs));
      });
    });
  }

  // A melee basic attack steps in to the target (combat.json attackMotion.meleeStep): the fighter stands at reach, so
  // its view moves towards the target, arrives as the hit lands, holds, then steps back. Rules position unchanged.
  stepIn(a, t, hitInMs) {
    const S = combatRules.attackMotion.meleeStep;
    const u = a.unit, o = t.unit;
    if (!S || !S.sides.includes(u.side) || u.x == null || o.x == null) return;
    const dx = o.x - u.x, dy = o.y - u.y, len = Math.hypot(dx, dy) || 1;
    const k = ((u.size || 1) + (o.size || 1)) / 2;
    const px = Phaser.Math.Clamp(len - S.contactPx * k, 0, S.maxPx);
    if (px < 2) return;
    if (a.stepTween) a.stepTween.stop();
    const st = { p: 0 };
    const set = () => { if (a.ch.active) { a.stepX = (dx / len) * px * st.p; a.stepY = (dy / len) * px * st.p; } };
    a.stepTween = this.tweens.add({ targets: st, p: 1, duration: Math.max(60, hitInMs), ease: 'Quad.easeIn', onUpdate: set,
      onComplete: () => { a.stepTween = this.tweens.add({ targets: st, p: 0, delay: S.holdMs, duration: S.backMs, ease: 'Quad.easeOut', onUpdate: set,
        onComplete: () => { a.stepX = a.stepY = 0; a.stepTween = null; } }); } });
  }

  // A skill starts: a melee step-in that is still going stops, and the fighter is back on its spot at once.
  stopStep(a) {
    if (!a || !a.stepTween) return;
    a.stepTween.stop();
    a.stepTween = null;
    a.stepX = a.stepY = 0;
  }

  // A fighter jitters side to side (a hard hit); uses the leap offset.
  jitter(v, px, ms) {
    if (!v || !v.ch.active) return;
    const j = { p: 0 };
    this.tweens.add({ targets: j, p: 1, duration: ms, onUpdate: () => { if (v.ch.active) v.leapX = Math.round(Math.sin(j.p * Math.PI * 6) * px * (1 - j.p)); }, onComplete: () => { v.leapX = 0; } });
  }

  // A fighter is thrown back away from a point (character pixels), then settles back.
  knockFrom(v, at, px) {
    if (!v || !v.ch.active) return;
    const b = this.fxBody(v), dx = b.x - at.x, dy = b.y - at.y, len = Math.hypot(dx, dy) || 1, k = { p: 0 };
    const set = () => { if (v.ch.active) { v.leapX = (dx / len) * px * k.p; v.leapY = (dy / len) * px * k.p; } };
    this.tweens.add({ targets: k, p: 1, duration: 90, ease: 'Quad.easeOut', onUpdate: set,
      onComplete: () => this.tweens.add({ targets: k, p: 0, delay: 110, duration: 400, ease: 'Quad.easeInOut', onUpdate: set, onComplete: () => { v.leapX = v.leapY = 0; } }) });
  }

  // Alchemist v2: one named flask (Flask Barrage / Mystery Brew) spins over and shatters (combat.json skillFx.flask).
  playFlaskLook(from, to, flask) {
    if (!from || !to) return;
    const F = FX.flask, seed = (this.impactSeed = (this.impactSeed || 0) + 1);
    let a = this.fxBody(from), b = this.fxBody(to);
    const enemies = () => this.state.enemies.filter((u) => u.alive).map((u) => this.views.get(u.uid)).filter((v) => v && v.ch.active);
    this.addFx(CAST_MS[F.recipe], (q, now) => {
      if (from.ch.active) a = this.fxBody(from); if (to.ch.active) b = this.fxBody(to);
      const out = castFx(F.recipe, q, { caster: a, targets: [b], squad: [], enemies: enemies().map((v) => this.fxBody(v)), flask, hitMs: F.hitMs, seed }, now);
      return { draws: out.draws, tints: out.tints.map(([list, , tint]) => [list === 'targets' ? to : from, tint]) };
    }, ['skill', F.recipe]);
    this.time.delayedCall(F.hitMs, () => {
      sfx.play('flaskBreak');
      if (to.unit.side === 'enemy') { this.cameras.main.shake(F.shakeMs, F.shakeIntensity); this.jitter(to, F.jitterPx, F.jitterMs); }
    });
  }

  // Samurai v2: a counter-cut thrown back from far away (Counter Stance): clang, crescent, cut (combat.json skillFx.counter).
  playCounterLook(from, to) {
    if (!from || !to) return;
    const K = FX.counter;
    let a = this.fxBody(from), b = this.fxBody(to);
    this.addFx(CAST_MS[K.recipe], (q, now) => {
      if (from.ch.active) a = this.fxBody(from); if (to.ch.active) b = this.fxBody(to);
      const out = castFx(K.recipe, q, { caster: a, targets: [b], squad: [], enemies: [], hitMs: K.hitMs }, now);
      return { draws: out.draws, tints: out.tints.map(([list, , tint]) => [list === 'targets' ? to : from, tint]) };
    }, ['skill', K.recipe]);
    this.time.delayedCall(K.hitMs, () => {
      this.cameras.main.shake(K.shakeMs, K.shakeIntensity);
      if (K.stopMs) this.hitStop = Math.max(this.hitStop || 0, K.stopMs);
      this.jitter(to, K.jitterPx, K.jitterMs);
    });
  }

  // An aggressive skill dash (combat.json skillFx.dash): the hero shoots at its target from wherever it stands, the
  // target is knocked back at the hit with a small shake, then both settle back. Uses the same view offsets as leapAt.
  dashAt(caster, target, D, from = null) {
    if (!target || !target.ch.active) return;
    if (from) { // the rules already put him at the hit (skills.json staysAtImpact): shoot over from where he was, stay there
      const u = caster.unit, ox = from.x - u.x, oy = from.y - u.y, olen = Math.hypot(ox, oy) || 1, go = { p: 0 };
      const setF = () => { caster.leapX = ox * (1 - go.p); caster.leapY = oy * (1 - go.p); };
      setF();
      this.tweens.add({ targets: go, p: 1, duration: D.inMs, ease: 'Quad.easeIn', onUpdate: setF,
        onComplete: () => {
          caster.leapX = caster.leapY = 0;
          if (D.shakeMs) this.cameras.main.shake(D.shakeMs, D.shakeIntensity);
          if (!D.knockPx || !target.ch.active) return;
          const ux = -ox / olen, uy = -oy / olen, kb = { p: 0 };
          const setK = () => { target.leapX = ux * D.knockPx * kb.p; target.leapY = uy * D.knockPx * kb.p; };
          this.tweens.add({ targets: kb, p: 1, duration: D.knockMs, ease: 'Quad.easeOut', onUpdate: setK,
            onComplete: () => this.tweens.add({ targets: kb, p: 0, duration: D.knockBackMs, ease: 'Quad.easeInOut', onUpdate: setK, onComplete: () => { target.leapX = target.leapY = 0; } }) });
        } });
      return;
    }
    const dx = target.ch.x - caster.ch.x, dy = target.ch.y - caster.ch.y, len = Math.hypot(dx, dy) || 1;
    const reach = Phaser.Math.Clamp(len - D.stopPx, D.minPx, D.maxPx);
    const ux = dx / len, uy = dy / len;
    const go = { p: 0 };
    const set = () => { caster.leapX = ux * reach * go.p; caster.leapY = uy * reach * go.p; };
    this.tweens.add({ targets: go, p: 1, duration: D.inMs, ease: 'Quad.easeIn', onUpdate: set,
      onComplete: () => {
        this.tweens.add({ targets: go, p: 0, delay: D.holdMs, duration: D.outMs, ease: 'Quad.easeOut', onUpdate: set, onComplete: () => { caster.leapX = caster.leapY = 0; } });
        if (D.shakeMs) this.cameras.main.shake(D.shakeMs, D.shakeIntensity);
        if (!D.knockPx || !target.ch.active) return;
        const kb = { p: 0 };
        const setK = () => { target.leapX = ux * D.knockPx * kb.p; target.leapY = uy * D.knockPx * kb.p; };
        this.tweens.add({ targets: kb, p: 1, duration: D.knockMs, ease: 'Quad.easeOut', onUpdate: setK,
          onComplete: () => this.tweens.add({ targets: kb, p: 0, duration: D.knockBackMs, ease: 'Quad.easeInOut', onUpdate: setK, onComplete: () => { target.leapX = target.leapY = 0; } }) });
      } });
  }

  // A skill goes off: the caster flashes in the skill colour, a ring bursts (on each target for an
  // attack skill, around the caster for a support skill) and the skill's name shows as a banner.
  // Attack skills also shake the screen and freeze the fight for a split second (hit-stop).
  skillBurst(caster, e) {
    const attack = e.skill.kind === 'attack';
    const colorText = attack ? FX.attackColor : FX.supportColor;
    const color = Phaser.Display.Color.HexStringToColor(colorText).color;
    const heroColor = caster.unit.side === 'hero' && FX.name.heroColors[caster.unit.def.id]; // a hero with its own look flashes in its colour
    caster.ch.flash(heroColor ? Phaser.Display.Color.HexStringToColor(heroColor).color : color, FX.flashMs);
    const own = SKILL_FX_BY_NAME[e.skill.name];
    if (own) this.playSkillFx(own, caster, e); // the skill's own effect (systems/skillFx.js) instead of the plain rings
    const spots = own ? [] : attack || e.skill.target === 'squad' || e.skill.target === 'enemy' || e.skill.target === 'lowestAlly' ? e.targets.map((t) => this.views.get(t.uid)).filter(Boolean) : [caster];
    for (const v of spots) {
      const c = this.center(v);
      const ring = this.add.circle(c.x, c.y, 10).setStrokeStyle(4, color).setDepth(DEPTH.popup - 1);
      this.tweens.add({ targets: ring, radius: FX.ringRadius, alpha: 0, duration: FX.ringMs, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    }
    this.skillName(caster, e.skill.name);
    // A skill that puts statuses on every enemy (Smoke Bomb) also shows a grey cloud on each of them.
    if (e.skill.applyEnemies && !own) for (const en of this.state.enemies) if (en.alive && this.views.get(en.uid)) this.puff(this.views.get(en.uid).ch.x, this.views.get(en.uid).ch.y, 0x9a9aa8, 6);
    if (attack && !(caster.unit.side === 'hero' && LOOK_BY_NAME[e.skill.name])) { // a v2 look shakes / freezes at its own hit (lookMoves)
      this.cameras.main.shake(FX.shakeMs, FX.shakeIntensity);
      this.hitStop = FX.hitStopMs;
    }
  }

  // The skill's NAME (user's pick B): once, in capitals, over the hero at one fixed pixel size (never scaled). It slides
  // up a little while it fades in, holds, then rises and fades (combat.json skillFx.name).
  skillName(caster, name) {
    const N = FX.name;
    const hero = caster.unit.def && caster.unit.def.id;
    const color = (caster.unit.side === 'hero' && N.heroColors[hero]) || N.defaultColor;
    let y = Math.round(caster.ch.y + caster.ch.hopOffset - caster.unit.def.height * charScale(caster.unit.def) - N.abovePx);
    // Never on top of another skill name or the 'Floor cleared!' banner: it goes above them instead.
    this.nameLabels = (this.nameLabels || []).filter((o) => o.t.active);
    const blocks = this.nameLabels.map((o) => o.box);
    if (this.banner.text) blocks.push(this.banner.getBounds());
    const w = name.length * N.sizePx + 12, h = N.sizePx + 8, x0 = Phaser.Math.Clamp(caster.ch.x, w / 2 + 6, GAME_WIDTH - w / 2 - 6);
    for (let i = 0; i < 6; i++) {
      const hit = blocks.find((b) => Math.abs(b.centerX - x0) < (b.width + w) / 2 && Math.abs(b.centerY - y) < (b.height + h) / 2);
      if (!hit) break;
      y = Math.round(hit.y - h / 2 - 2);
    }
    const t = this.add
      .text(caster.ch.x, y + N.risePx, name.toUpperCase(), { fontFamily: UI.font, fontSize: `${N.sizePx}px`, color, stroke: '#000000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(DEPTH.popup + 1)
      .setAlpha(0);
    t.x = Math.round(Phaser.Math.Clamp(t.x, t.width / 2 + 6, GAME_WIDTH - t.width / 2 - 6)); // keep it on screen
    this.nameLabels.push({ t, box: new Phaser.Geom.Rectangle(t.x - t.width / 2, y - t.height / 2, t.width, t.height) });
    this.tweens.add({ targets: t, y, alpha: 1, duration: N.inMs, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: t, y: y - N.risePx, alpha: 0, delay: N.inMs + N.holdMs, duration: N.outMs, onComplete: () => t.destroy() });
  }

  // One wave of a channel with its own look: the recipe plays on the wave's targets, with a small shake per wave.
  playWaveFx(W, v, e) {
    const tv = e.targets.map((u) => this.views.get(u.uid)).filter((x) => x && x.ch.active);
    if (!v || !tv.length) return;
    const last = e.wave === e.waves - 1;
    // The shake and the jitter come when the wave lands (hitMs: Arrow Rain's arrows fall first).
    this.time.delayedCall(W.hitMs || 0, () => {
      this.cameras.main.shake(last ? W.lastShakeMs : W.shakeMs, last ? W.lastShakeIntensity : W.shakeIntensity);
      if (W.targetShakePx) for (const x of tv) this.jitter(x, last ? W.lastTargetShakePx : W.targetShakePx, W.targetShakeMs); // the hit enemy jitters side to side
    });
    const frozen = tv.map((x) => this.fxBody(x));
    const z = e.zone, center = z && z.x != null ? { x: z.x / CHAR_SCALE, y: z.y / CHAR_SCALE } : null; // the area the wave falls on
    this.addFx(CAST_MS[W.recipe], (q, now) => {
      const c = { caster: v.ch.active ? this.fxBody(v) : null, targets: tv.map((x, i) => (x.ch.active ? (frozen[i] = this.fxBody(x)) : frozen[i])), squad: [], enemies: [], wave: e.wave, waves: e.waves, hitMs: W.hitMs, center, radius: z && z.radius ? z.radius / CHAR_SCALE : undefined };
      const out = castFx(W.recipe, q, c, now);
      return { draws: out.draws, tints: out.tints.map(([list, i, tint]) => [list === 'targets' ? tv[i] : v, tint]) };
    }, ['skill', W.recipe]);
  }

  // The CHARGE beat (combat.json skillFx.charge): the skill's wind-up look on the hero, for the whole wind-up. Stops
  // early when the wind-up is cut (castCancel) or the hero is gone.
  // A rotation spell has its own charge ('skillId:SHORT'); { recipe, tremble } also trembles the hero (Berserker,
  // Alchemist). The recipe gets the song that comes next (Bard) and where the enemies are (c.aim, the Archer's aim).
  playCharge(v, e) {
    const slot = e.unit.skills && e.unit.skills[e.index];
    const spec = slot && ((e.skill && e.skill.short && FX.charge[`${slot.id}:${e.skill.short}`]) || FX.charge[slot.id]);
    if (!v || !spec || !e.castMs) return;
    const name = spec.recipe || spec, tremble = spec.tremble || 0;
    const cast = e.unit.casting;
    const aim = () => { const en = this.state.enemies.filter((u) => u.alive).map((u) => this.views.get(u.uid)).filter((x) => x && x.ch.active).map((x) => this.fxBody(x)); return en.length ? { x: en.reduce((s2, b) => s2 + b.x, 0) / en.length, y: en.reduce((s2, b) => s2 + b.mid, 0) / en.length } : null; };
    this.addFx(e.castMs, (q, now) => {
      if (!v.ch.active || (cast && e.unit.casting !== cast)) { if (tremble) v.leapX = 0; return []; }
      if (tremble) v.leapX = v.trembleX = q >= 0.999 ? 0 : Math.round(Math.sin(now / 23) * q * tremble); // shaking with rage / shaking the flask
      const out = castFx(name, q, { caster: this.fxBody(v), targets: [], squad: [], enemies: [], song: e.unit.nextSong || 'march', aim: aim() }, now);
      return { draws: out.draws, tints: out.tints.map(([, , tint]) => [v, tint]) };
    }, ['skill', name]);
    // The effect's last frame is rarely exactly the end: settle him back in place unless a leap/dash took over.
    if (tremble) this.time.delayedCall(e.castMs + 30, () => { if (v.ch.active && v.leapX === v.trembleX) v.leapX = 0; });
  }

  // A skill's own cast effect: the recipe gets where the caster, its targets, the squad and the enemies are
  // NOW (every frame), and may colour some of them for a moment.
  playSkillFx(name, caster, e) {
    const views = (units) => units.map((u) => this.views.get(u.uid)).filter((v) => v && v.ch.active);
    const L = caster.unit.side === 'hero' ? LOOK_BY_NAME[e.skill.name] : null; // a v2 look (combat.json skillFx.look)
    const squad = views(this.state.heroes.filter((h) => h.alive));
    // Bone Sacrifice: his skeletons are already dead in the fight, their views still stand for a moment.
    const minions = L && L.minions ? this.state.minions.filter((m) => m.holderUid === caster.unit.uid).map((m) => this.views.get(m.uid)).filter((v) => v && v.ch.active) : [];
    const lists = { caster: [caster], targets: L && L.targets === 'squad' ? squad : views(e.targets), squad, enemies: views(this.state.enemies.filter((u) => u.alive)), minions };
    const frozen = {}; // last known bodies, for fighters that are gone mid-effect
    const bodies = (k) => lists[k].map((v, i) => (v.ch.active ? (frozen[k + i] = this.fxBody(v)) : frozen[k + i] || this.fxBody(v)));
    const area = L && (L.radius === 'area' ? L.area && L.area.radius : L.radius === 'landSplash' ? L.landSplash && L.landSplash.radius : L.radius === 'holyNova' ? L.holyNova && L.holyNova.radius : 0);
    const enemyAim = () => { const en = bodies('enemies'); return en.length ? { x: en.reduce((s2, b) => s2 + b.x, 0) / en.length, y: en.reduce((s2, b) => s2 + b.mid, 0) / en.length } : null; };
    this.addFx(CAST_MS[name], (q, now) => {
      const c = { caster: bodies('caster')[0], targets: bodies('targets'), squad: bodies('squad'), enemies: bodies('enemies'), minions: bodies('minions'), hitMs: L ? L.hitMs || 0 : (DASH_BY_NAME[e.skill.name] || {}).inMs || 0 };
      if (L) Object.assign(c, { radius: area ? area / CHAR_SCALE : undefined, land: e.land, song: caster.unit.song, allHit: !!L.allHit, aim: enemyAim() });
      const out = castFx(name, q, c, now);
      return { draws: out.draws, tints: out.tints.map(([list, i, tint]) => [lists[list] && lists[list][i], tint]) };
    }, ['skill', name]);
  }

  // A hit's sound: one per damage type (sounds.json hitMelee, hitFire...), plus a crack on top for a crit.
  hitSound(e) {
    const type = e.damageType || e.attacker.damageType;
    const cue = { melee: 'hitMelee', ranged: 'hitRanged', fire: 'hitFire', ice: 'hitIce', electric: 'hitElectric', dark: 'hitDark', holy: 'hitHoly' }[type] || 'hitMelee';
    sfx.play(cue);
    if (e.result.crit) sfx.play('crit');
  }

  // Skill book modifier moments. Returns false for other events.
  showBookEvent(e) {
    const v = e.unit && this.views.get(e.unit.uid);
    switch (e.type) {
      case 'grow': {
        if (!v) return true;
        const base = charScale(e.unit.def);
        const set = (k) => { if (v.ch.active) v.ch.setScale((Math.sign(v.ch.scaleX) || 1) * base * k, base * k); };
        const g = { k: 1 };
        this.tweens.add({ targets: g, k: e.scale, duration: 200, ease: 'Back.easeOut', onUpdate: () => set(g.k) });
        this.tweens.add({ targets: g, k: 1, delay: e.durationMs, duration: 250, onUpdate: () => set(g.k) });
        this.popText(v, 'Titan!', '#ffd24d', true);
        return true;
      }
      case 'roar':
        if (v) { this.popText(v, 'Roar!', '#ff7a6a', true); this.ring(v, 0xff7a6a); this.cameras.main.shake(90, 0.002); }
        return true;
      case 'ricochet':
        this.ring(this.views.get(e.to.uid), 0xc8a0ff);
        return true;
      case 'aftershock':
        for (const t of e.targets) this.ring(this.views.get(t.uid), 0xc8a0ff, 0.7);
        return true;
      default: return false;
    }
  }

  // ---- bosses (systems/bosses.js) -------------------------------------------------------------
  // Draws the boss moves. Returns false for events that are not boss events.
  showBossEvent(e) {
    const v = e.unit && this.views.get(e.unit.uid);
    switch (e.type) {
      case 'enemySpawn': this.showEnemySpawn(e.unit); return true;
      // ---- the new enemies, batch 2 ----
      case 'burrow': // Cave Worm digs in: a dirt puff, it sinks into the floor (its bars fade with it)
        if (!v) return true;
        this.puff(v.ch.x, v.ch.y, 0x8a6a4a, 9);
        this.tweens.add({ targets: v.ch, alpha: 0, duration: 260 });
        return true;
      case 'surface': // ...and bursts out next to a hero
        if (!v) return true;
        this.time.delayedCall(20, () => { // after followPositions has moved it to its new spot
          this.puff(v.ch.x, v.ch.y, 0x8a6a4a, 12);
          this.tweens.add({ targets: v.ch, alpha: e.unit.def.alpha ?? 1, duration: 120 });
          this.cameras.main.shake(90, 0.003);
        });
        return true;
      case 'blink': { // Blink Imp: a purple flash where it was and where it lands
        const c1 = this.add.circle(e.from.x, e.from.y - 20, 14, 0xd04a8a, 0.7).setDepth(DEPTH.popup - 1);
        this.tweens.add({ targets: c1, scale: 0.1, alpha: 0, duration: 260, onComplete: () => c1.destroy() });
        this.puff(e.from.x, e.from.y, 0xd04a8a, 6);
        this.time.delayedCall(20, () => { if (v) { this.ring(v, 0xd04a8a); this.puff(v.ch.x, v.ch.y, 0xd04a8a, 6); } });
        return true;
      }
      case 'raiseDead': // Bone Acolyte: a green-black puff where the enemy fell, a popup over the acolyte
        if (v) this.popText(v, 'Rise!', '#9fe07a', true);
        return true;
      case 'adapt': // Crystal Sentinel: says what it resists now (its glow in that colour is drawn in drawElites)
        if (v && e.damageType) this.popText(v, `Resists ${e.damageType}!`, damageTypes[e.damageType].color);
        return true;
      case 'revive':
        this.removeView(e.unit.uid); // its old figure may still be fading
        this.showEnemySpawn(e.unit, 0xffd24d);
        this.popText(this.views.get(e.unit.uid), 'Revived!', '#ffd24d', true);
        return true;
      case 'hatch': if (v) { this.puff(v.ch.x, v.ch.y, 0xd8d0a0, 6); this.popText(v, 'Hatched!', '#e8e0b0'); } return true;
      case 'dust':
        if (!v) return true;
        this.setBar(v);
        this.drawChips(v);
        this.puff(v.ch.x, v.ch.y, 0x8a8a9a, 9);
        this.tweens.add({ targets: v.ch, alpha: 0.2, duration: 400 });
        this.popText(v, 'Break the crystal!', '#c8a0ff', true);
        return true;
      case 'reform':
        if (!v) return true;
        this.setBar(v);
        this.tweens.add({ targets: v.ch, alpha: e.unit.def.alpha ?? 1, duration: 400 });
        this.popText(v, 'He rises again!', '#c070ff', true);
        this.cameras.main.shake(160, 0.004);
        return true;
      case 'bossAbility': {
        if (e.minor) {
          // A normal enemy's small move (Shaman's Mend, Shieldbearer's Guard, Golem's Enrage, Hound's Howl): its name pops
          // up over it and a ring in the move's colour bursts on each target. No banner, no shake.
          const a = e.ability;
          const color = a.healAllies ? 0x6dff8f : a.shield ? 0x6fd0ff : 0xff8a3a;
          if (v) { this.popText(v, a.name, `#${color.toString(16).padStart(6, '0')}`); v.ch.flash(color, 140); }
          for (const t of e.targets) this.ring(this.views.get(t.uid), color, 0.8);
          return true;
        }
        if (e.quiet) {
          for (const t of e.targets) { const tv = this.views.get(t.uid); if (tv && v) this.showProjectile(v, tv, 'lightning'); }
          return true;
        }
        if (v) v.ch.flash(0xff4a3a, 160);
        const slam = e.ability.slam;
        if (v && slam) {
          // Quake Jump: it crashes down from the air, the ground shakes hard and dust bursts out round its feet.
          this.tweens.add({ targets: v, leapLift: 0, duration: slam.dropMs, ease: 'Quad.easeIn', onComplete: () => {
            this.cameras.main.shake(slam.shakeMs, slam.shakeIntensity);
            this.puff(v.ch.x, v.ch.y, 0x8a7a6a, 14);
          } });
        }
        sfx.play('bossMove');
        this.bossBanner(e.ability.name);
        for (const t of e.targets) this.ring(this.views.get(t.uid), 0xff4a3a);
        if (!slam) this.cameras.main.shake(120, 0.003);
        return true;
      }
      case 'bossChannel':
        for (const t of e.targets) this.ring(this.views.get(t.uid), 0xc070ff, 0.6);
        return true;
      case 'drain': {
        const tv = this.views.get(e.unit.uid), fv = this.views.get(e.from.uid);
        if (tv) { this.setBar(tv); if (e.amount > 0) this.popText(tv, `-${e.amount}`, '#c070ff'); }
        if (fv) this.setBar(fv);
        return true;
      }
      case 'plateBreak':
        if (!v) return true;
        this.popText(v, e.left > 0 ? 'Armor cracked!' : 'Armor shattered!', '#bfe0ff', true);
        this.puff(v.ch.x, v.ch.y - 30, 0xbfe0ff, 6);
        this.cameras.main.shake(140, 0.004);
        return true;
      case 'immuneStatus': if (v) this.popText(v, 'Immune', '#aaaaaa'); return true;
      case 'enrage':
        if (!v) return true;
        v.ch.flash(0xff2a2a, 300);
        this.popText(v, 'ENRAGED!', '#ff4a3a', true);
        this.drawChips(v);
        return true;
      case 'swap': {
        const w = this.views.get(e.with.uid);
        for (const x of [v, w]) if (x) this.puff(x.ch.x, x.ch.y, 0x4a3a6a, 6);
        if (v) this.popText(v, 'Swap!', '#c8a0ff');
        return true;
      }
      case 'skyPhase':
        if (!v) return true;
        this.bossBanner('TAKES TO THE SKY!');
        this.tweens.add({ targets: v, leapLift: 90, duration: 600, ease: 'Quad.easeOut' });
        return true;
      case 'grounded':
        if (!v) return true;
        this.tweens.add({ targets: v, leapLift: 0, duration: 220, ease: 'Quad.easeIn', onComplete: () => this.puff(v.ch.x, v.ch.y, 0x8a7a6a, 8) });
        this.popText(v, 'Grounded!', '#ffd24d', true);
        this.cameras.main.shake(200, 0.006);
        return true;
      case 'reflect': if (v) this.popText(v, 'Reflected!', '#bfe0ff', true); return true;
      default: return false;
    }
  }

  // A new enemy joins the fight (summon, hatchling, clone, a revived twin): it grows out of a dark puff.
  showEnemySpawn(unit, color = 0x4a3a6a) {
    if (this.views.has(unit.uid)) return;
    const v = this.makeView(unit, unit.x ?? GAME_WIDTH / 2, unit.y ?? ENEMY_Y);
    v.ch.setDepth(DEPTH.hero + v.ch.y / 10000); // sorted with everyone else (followPositions keeps it up to date)
    for (const part of [v.bg, v.fill, v.shieldFill, v.chipBox]) part.setDepth(DEPTH.heroBar);
    const target = v.ch.scaleY;
    v.ch.scaleY = 0.05;
    this.puff(v.ch.x, v.ch.y, color, 6);
    this.tweens.add({ targets: v.ch, scaleY: target, duration: 360, ease: 'Back.easeOut' });
    this.syncBar(v);
  }

  // A thin ring that bursts on a fighter (boss moves mark who they hit).
  ring(v, color, alpha = 0.9) {
    if (!v || !v.ch.active) return;
    const c = this.center(v);
    const r = this.add.circle(c.x, c.y, 10).setStrokeStyle(3, color, alpha).setDepth(DEPTH.popup - 1);
    this.tweens.add({ targets: r, scale: 3, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
  }

  // "IT'S A MONSTER HOUSE!": huge, it slams in with a shake and a red flash, wobbles, then fades. Then the elites' names.
  monsterHouseBanner() {
    sfx.play('bossIntro');
    this.cameras.main.flash(180, 120, 20, 20);
    this.cameras.main.shake(320, 0.008);
    const y = 300;
    const style = { fontFamily: UI.font, stroke: '#000000', strokeThickness: 7, align: 'center' };
    const top = this.add.text(GAME_WIDTH / 2, y - 30, "IT'S A", { ...style, fontSize: '24px', color: '#ffd24d' }).setOrigin(0.5).setDepth(DEPTH.popup + 2);
    const big = this.add.text(GAME_WIDTH / 2, y + 8, 'MONSTER HOUSE!', { ...style, fontSize: '24px', color: '#ff4a3a' }).setOrigin(0.5).setDepth(DEPTH.popup + 2);
    if (big.width > GAME_WIDTH - 12) big.setFontSize(Math.floor((34 * (GAME_WIDTH - 12)) / big.width));
    for (const [t, d] of [[top, 0], [big, 90]]) {
      t.setScale(2.6).setAlpha(0);
      this.tweens.add({ targets: t, scale: 1, alpha: 1, delay: d, duration: 260, ease: 'Back.easeOut' });
      this.tweens.add({ targets: t, angle: { from: -3, to: 3 }, delay: d + 260, duration: 140, yoyo: true, repeat: 4 });
      this.tweens.add({ targets: t, alpha: 0, y: t.y - 24, delay: 1900 + d, duration: 450, onComplete: () => t.destroy() });
    }
    this.time.delayedCall(2300, () => { for (const v of this.views.values()) if (v.unit.elite && v.unit.alive) this.eliteName(v); });
  }

  // A boss move's name, big and red, in the middle of the screen.
  bossBanner(text) {
    const b = this.add
      .text(GAME_WIDTH / 2, FX.bannerY - 40, text, { fontFamily: UI.font, fontSize: '16px', color: '#ff6a5a', stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(DEPTH.popup + 1)
      .setScale(1.4);
    b.x = Phaser.Math.Clamp(b.x, b.width / 2 + 4, GAME_WIDTH - b.width / 2 - 4);
    this.tweens.add({ targets: b, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: b, alpha: 0, y: b.y - 16, delay: 900, duration: 400, onComplete: () => b.destroy() });
  }

  // The boss bar at the top of the screen: its name, a big health bar, its heat gauge (Ignatius) and
  // armor plates (Frost Warden). Twin bosses get one bar each.
  drawBossHud() {
    if (!this.bossG) {
      this.bossG = this.add.graphics().setDepth(DEPTH.hud);
      this.bossNames = [];
    }
    const g = this.bossG;
    g.clear();
    const bosses = this.mode === 'fighting' ? this.state.enemies.filter((u) => u.def.boss && (u.alive || this.state.enemies.some((o) => o.alive && o.reviveUid === u.uid))) : [];
    const W = 300, X = (GAME_WIDTH - W) / 2;
    bosses.forEach((u, i) => {
      const y = 104 + i * 34;
      let t = this.bossNames[i];
      if (!t) t = this.bossNames[i] = this.add.text(X, 0, '', { fontFamily: UI.font, fontSize: '8px', color: '#ffe0d8', stroke: '#000000', strokeThickness: 3 }).setOrigin(0, 1).setDepth(DEPTH.hud);
      t.setText(u.dust ? `${u.name} (dust)` : u.alive ? u.name : `${u.name} (down)`).setPosition(X, y - 3).setVisible(true);
      g.fillStyle(0x000000, 0.85).fillRect(X - 2, y - 2, W + 4, 12);
      g.fillStyle(0x3a1018, 1).fillRect(X, y, W, 8);
      const p = u.alive && !u.dust ? Math.max(0, u.hp / u.maxHp) : 0;
      g.fillStyle(u.dust ? 0x8a8a9a : 0xe04b4b, 1).fillRect(X, y, W * p, 8);
      g.fillStyle(0xffffff, 0.25).fillRect(X, y, W * p, 2);
      if (u.def.plates) for (let k = 0; k < u.def.plates.count; k++) {
        const px = X + W - 10 - k * 14;
        g.fillStyle(0x000000, 1).fillRect(px - 1, y - 13, 12, 9);
        g.fillStyle(k < u.plates ? 0xbfe0ff : 0x30384a, 1).fillRect(px, y - 12, 10, 7);
      }
      if (u.def.heat) {
        const hp = Math.min(1, u.heat / u.def.heat.max);
        g.fillStyle(0x000000, 0.85).fillRect(X - 2, y + 11, W + 4, 6);
        g.fillStyle(hp > 0.8 ? 0xffe060 : 0xff8a2a, 1).fillRect(X, y + 12, W * hp, 4);
      }
    });
    for (let i = bosses.length; i < this.bossNames.length; i++) this.bossNames[i].setVisible(false);
  }

  popText(view, text, color, big = false, sizePx = null) {
    // The same WORD (Counter!, Blocked!) already floating over this fighter is not shown again: a Samurai
    // countering a lot made an unreadable pile. Numbers always show.
    const now = this.time.now;
    view.recentPops = view.recentPops || {};
    if (/[a-z]/i.test(text)) {
      const last = view.recentPops[text];
      if (last && now - last < POP_REPEAT_MS) return;
      view.recentPops[text] = now;
    }
    // Pop-ups that appear together stack upwards instead of overlapping.
    view.popSlot = ((view.popSlot ?? -1) + 1) % 4;
    // Above where the fighter is right now (a hero may be away at an enemy).
    const y = view.ch.y + view.ch.hopOffset - view.unit.def.height * charScale(view.unit.def) - 22 - view.popSlot * 15;
    const t = this.add
      .text(view.ch.x, y, text, {
        fontFamily: UI.font,
        fontSize: sizePx ? `${sizePx}px` : big ? '20px' : '14px',
        color,
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
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
    sfx.play('floorClear');
    sfx.play('doorOpen');
    for (const e of this.state.endFloor()) this.showEvent(e); // weak minions vanish with the floor
    if (this.castBars) this.castBars.clear(); // a wind-up still going is dropped
    if (this.tauntLines) this.tauntLines.clear();
    this.drawBossHud(); // mode is 'won': the boss bar goes away
    this.focusMarker.setVisible(false);
    this.banner.setY(T.clearBannerY).setText(`Floor ${this.floor}\ncleared!`); // two lines (user): one line ran off the screen on floor 10+
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
    // A hero says something about the floor (before the win heal: a close call reads the health it ended with).
    const someoneFell = this.livingHeroViews().length < (this.aliveAtStart ?? 0);
    const bossFloor = !!(this.dungeon.bosses && this.dungeon.bosses[this.floor]);
    const said = clearSpeech(dialogue, this.state.heroes, { bossFloor, someoneFell });
    this.sayLine(said.kind, said.heroes); // never waited for: the bubble goes away just after the reward screen opens
    for (const { unit, amount } of this.state.winHeal(combatRules.winHealPercent)) {
      const v = this.views.get(unit.uid);
      this.setBar(v);
      if (Math.round(amount) > 0) this.popText(v, `+${Math.round(amount)}`, '#6dff8f');
    }

    this.time.delayedCall(T.clearPauseMs, () => {
      this.banner.setText('').setY(BANNER_Y);
      this.showReward(() => this.goToNextFloor());
    });
  }

  // A speech bubble over a living hero (purely for show; lines in data/dialogue.json, picked by systems/dialogue.js).
  // kind = 'start' | 'clear' | 'boss' | 'fallen' | 'hurt' | 'close'; `heroes` = who may speak (default: the squad).
  // Returns how long the bubble stays (ms), 0 = no bubble.
  sayLine(kind, heroes = this.state.heroes) {
    const s = pickSpeech(dialogue, heroes, kind, Math.random, this.speechMemory);
    const v = s && this.views.get(s.uid);
    if (!v) return 0;
    if (this.speech) this.speech.c.destroy();
    const R = dialogue.rules;
    const t = uiText(this, 0, 0, s.text, R.sizePx, R.textColor, { align: 'center', wordWrap: { width: R.maxWidthPx - 2 * R.padPx } }).setOrigin(0.5, 1);
    const w = Math.ceil((t.width + 2 * R.padPx) / 2) * 2, h = Math.ceil((t.height + 2 * R.padPx) / 2) * 2;
    t.setPosition(0, -R.tailPx - R.padPx + 2);
    const box = drawWindow(this.add.graphics(), -w / 2, -R.tailPx - h, w, h, { fill: R.fill, line: R.line }); // white bubble, black line: not like the black UI windows
    const tail = this.add.graphics();
    const c = this.add.container(0, 0, [box, tail, t]).setDepth(DEPTH.popup + 3).setScale(0.6).setAlpha(0);
    this.speech = { c, v, box, tail, w };
    this.placeSpeech();
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: R.inMs, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: R.inMs + R.holdMs, duration: R.outMs, onComplete: () => c.destroy() });
    return R.inMs + R.holdMs + R.outMs;
  }

  // Keeps the speech bubble over its hero's head (heroes walk home after a win) and inside the screen; the tail
  // always points at the hero.
  placeSpeech() {
    const S = this.speech;
    if (!S || !S.c.active) return;
    const R = dialogue.rules, ch = S.v.ch;
    const headY = ch.y + (ch.hopOffset || 0) - S.v.unit.def.height * charScale(S.v.unit.def) - R.abovePx;
    const x = Math.round(Phaser.Math.Clamp(ch.x, S.w / 2 + 6, GAME_WIDTH - S.w / 2 - 6));
    S.c.setPosition(x, Math.round(headY));
    // The tail: a small stepped point under the window, pointing at the hero (moves along the bottom when clamped).
    const dx = Math.round(Phaser.Math.Clamp(ch.x - x, -S.w / 2 + 10, S.w / 2 - 10) / 2) * 2;
    if (S.tailDx === dx) return;
    S.tailDx = dx;
    S.tail.clear();
    for (let r = 0; r < R.tailPx + 2; r += 2) {
      const half = R.tailPx + 2 - r;
      S.tail.fillStyle(R.line, 1).fillRect(dx - half, -R.tailPx - 2 + r, half * 2, 2);
      if (half > 2) S.tail.fillStyle(R.fill, 1).fillRect(dx - half + 2, -R.tailPx - 2 + r, half * 2 - 4, 2);
    }
  }

  // Shows the reward screen. When it is done, the hero gets the item and `next` runs.
  showReward(next) {
    // A beaten Mimic (special room) gives a rare/epic pick instead of the normal reward.
    const room = this.layer.room;
    if (room && room.kind === 'mimic') return this.itemPick('MIMIC DEFEATED', next, room.rules.rewardOdds);
    // A cleared Monster House: a pick from the epic pool with a small legendary chance (an elite there still bumps a card).
    if (this.state.monsterHouse) return this.itemPick('MONSTER HOUSE CLEARED', next, this.dungeon.director.monsterHouse.rewardOdds, this.state.floorHadElite ? combatRules.elites.rewardBump : 0);
    const bossFloor = !!(this.dungeon.bosses && this.dungeon.bosses[this.floor]) && this.state.heroes.some((h) => h.alive);
    // A BOSS floor: set rarities (rewards.json bossRarities: 2 epic + 1 legendary), no potion or book card.
    let choices = bossFloor ? this.rollItems(null, 0, rewardRules.bossRarities) : this.rollItems(null, this.state.floorHadElite ? combatRules.elites.rewardBump : 0); // an elite: one card a rarity higher
    if (!bossFloor) choices = maybeAddBook(choices, bookData, this.state.heroes, bookData.bookChancePerScreen); // a skill book card, about 1 in 15 screens
    // After a BOSS the squad also gets a free golden book (3 modifier pages), after the item reward.
    const afterNormal = bossFloor ? () => this.openRewardSheet([bookData.cards.golden], next, 'BOSS DEFEATED: A GOLDEN BOOK') : next;
    if (!choices.length) return afterNormal();
    this.openRewardSheet(choices, afterNormal);
  }

  // 3 item cards for a reward sheet (odds = optional rarity odds instead of the floor's).
  rollItems(odds = null, bump = 0, rarities = null) {
    return rollChoices({ itemDefs, rules: rewardRules, floor: this.floor, count: rewardRules.choices, heroes: this.state.heroes, potionChance: odds || rarities ? 0 : rewardRules.potionChance, offered: (this.state.offeredOnce = this.state.offeredOnce || new Set()), odds, bump, rarities });
  }

  // The reward sheet with these cards; `next` runs after the pick has been applied.
  openRewardSheet(choices, next, banner = null) {
    // A speech bubble goes away just after the reward screen pops up (user: never seen after the reward). The battle is
    // paused under the reward screen, so the reward screen's clock removes it.
    const bubble = this.speech && this.speech.c.active ? this.speech : null;
    if (bubble) this.scene.get('Reward').events.once('create', (rs) => rs.time.delayedCall(dialogue.rules.goneAfterRewardMs, () => bubble.c.destroy()));
    this.scene.launch('Reward', {
      state: this.state,
      choices,
      floor: this.floor,
      banner,
      onDone: (itemId, heroUid, book) => {
        this.scene.stop('Reward');
        this.scene.resume();
        if (book) this.applyPage(heroUid, book);
        else this.applyReward(itemId, heroUid);
        this.time.delayedCall(700, next); // a moment to see the new dot
      },
    });
    this.scene.pause();
  }

  // A skill book page goes on the chosen skill (BattleState.addPage); the hero shows it.
  applyPage(heroUid, { page, index, replace }) {
    const res = this.state.addPage(heroUid, index, page, replace);
    const v = this.views.get(heroUid);
    if (res.ok && v) {
      this.gainText(v, page.name, '#c8a0ff');
      v.ch.flash(0xc8a0ff, 200);
    }
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
    this.iconPop(view, itemId);
    this.gainText(view, item.name, `#${Number(rarities[item.rarity].color).toString(16).padStart(6, '0')}`);
  }

  // A new item or book page on a hero (user: the old 20px '+Name' popup looked 'stretchy and big'): its name at one
  // fixed small size (combat.json gainText), never scaled, slides up a little and fades, like the skill names.
  gainText(view, text, color) {
    if (!view || !view.ch.active) return;
    const G = combatRules.gainText;
    const t = this.add.text(view.ch.x, view.bg.y, text, { fontFamily: UI.font, fontSize: `${G.sizePx}px`, color, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(DEPTH.popup + 1).setAlpha(0);
    // It FOLLOWS the hero (the squad may walk off to the door), above the health bar and the item's icon pop.
    const rise = { d: G.risePx };
    const follow = () => {
      if (!view.ch.active) return;
      t.x = Math.round(Phaser.Math.Clamp(view.ch.x, t.width / 2 + 6, GAME_WIDTH - t.width / 2 - 6));
      t.y = Math.round(view.bg.y - G.abovePx + rise.d);
    };
    follow();
    this.events.on('update', follow);
    t.once('destroy', () => this.events.off('update', follow));
    this.tweens.add({ targets: rise, d: 0, duration: G.inMs, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: t, alpha: 1, duration: G.inMs });
    this.tweens.add({ targets: rise, d: -G.risePx, delay: G.inMs + G.holdMs, duration: G.outMs });
    this.tweens.add({ targets: t, alpha: 0, delay: G.inMs + G.holdMs, duration: G.outMs, onComplete: () => t.destroy() });
  }

  onLoss() {
    this.mode = 'lost';
    sfx.play('defeat');
    this.drawBossHud();
    this.banner.setText('');
    // Save the run (floor reached, enemies defeated) and see which heroes it unlocked.
    const progress = loadProgress();
    const before = unlockedIds(allHeroDefs, progress, unlocks);
    recordRun(progress, { floor: this.floor, kills: this.state.kills || 0 });
    saveProgress(progress);
    const newly = unlockedIds(allHeroDefs, progress, unlocks).filter((id) => !before.includes(id));
    const lastRun = { floor: this.floor, kills: this.state.kills || 0, newly };
    this.showDefeat(() => this.scene.start('Squad', { lastRun }));
  }

  // The defeat screen (user): the screen dims first, then SQUAD DEFEATED pops in, then how far the squad got and a
  // random line on how it ended (naming the enemy that landed the last blow), then a Back button. Data: defeat.json.
  showDefeat(onBack) {
    const D = defeatData;
    const top = 1000; // above everything (flying enemies sit high too)
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000).setOrigin(0).setAlpha(0).setDepth(top).setInteractive(); // also blocks taps on the fight
    this.tweens.add({ targets: dim, alpha: D.dimAlpha, duration: D.dimMs });
    const title = uiText(this, GAME_WIDTH / 2, 300, 'SQUAD\nDEFEATED', D.titlePx, '#ff4a3a', { align: 'center', stroke: '#000000', strokeThickness: 8 })
      .setOrigin(0.5).setDepth(top + 1).setAlpha(0);
    if (title.width > GAME_WIDTH - 16) title.setScale((GAME_WIDTH - 16) / title.width);
    const end = title.scale;
    this.time.delayedCall(D.titleDelayMs, () => {
      title.setScale(end * 2.6);
      this.tweens.add({ targets: title, scale: end, alpha: 1, duration: 260, ease: 'Back.easeOut' });
      this.time.delayedCall(200, () => this.cameras.main.shake(220, 0.006));
    });
    const name = this.lastKiller;
    const pool = name ? D.withKiller : D.noKiller;
    const line = pool[Math.floor(Math.random() * pool.length)]
      .replace(/\ba \{enemy\}/, `${/^[aeiou]/i.test(name || '') ? 'an' : 'a'} {enemy}`)
      .replace(/\{enemy\}/g, name || '');
    const story = uiText(this, GAME_WIDTH / 2, 420, `${D.story.replace('{floor}', this.floor)} before ${line}`, 'normal', UI.text, {
      align: 'center', wordWrap: { width: GAME_WIDTH - 48 },
    }).setOrigin(0.5, 0).setDepth(top + 1).setAlpha(0);
    this.time.delayedCall(D.storyDelayMs, () => this.tweens.add({ targets: story, alpha: 1, y: { from: story.y + 12, to: story.y }, duration: 400 }));
    this.time.delayedCall(D.buttonDelayMs, () => {
      const w = 200, h = 64;
      const btn = uiButton(this, (GAME_WIDTH - w) / 2, Math.max(story.y + story.height + 40, 640), w, h, D.button, { selected: true, depth: top + 2, onTap: () => { sfx.play('tap'); onBack(); } });
      btn.container.setAlpha(0);
      this.tweens.add({ targets: btn.container, alpha: 1, duration: 300 });
    });
  }
}

Object.assign(BattleScene.prototype, roomMethods); // special rooms (treasure, Mimic, fountain, dealer, puzzle)
