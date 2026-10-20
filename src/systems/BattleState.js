import { bossMethods } from './bosses.js';
import { eliteMethods } from './elites.js';
import { computeDamage, computeDotDamage } from './combat.js';
import { xpForNextLevel, statsAtLevel } from './leveling.js';
import { computeHeroStats } from './items.js';
import { moraleTier } from './party.js';
import { partArt, artSize } from './pixelArt.js';
import { enemySpots } from './formation.js';

// Every hero has one attack skill and one support skill, in this order (index 0 and 1).
export const SKILL_SLOTS = ['attack', 'support'];

// The fight itself: who is alive, who attacks whom and when, skills and statuses.
// No Phaser in here. update() and castSkill() return a list of events and the scene draws them.
//
// Health regeneration (specials.regen) happens silently inside update(); the scene just redraws bars.
// Events: attack, death, levelup, cast, status (apply / expire), dot (a damage-over-time tick: bleed, burn, poison),
//         heal (lifesteal), thorns (reflected damage), proc (an item's chance effect went off),
//         morale (the party became 'incomplete' or 'alone' because a hero fell),
//         attackStart (a basic attack begins: { attacker, target, hitInMs }; its 'attack' event comes when it lands),
//         attackCancel (an attack in progress was stopped: the attacker got stunned, frozen, feared,
//                       knocked back, or nothing is left to hit),
//         attackRetarget (a ranged attack in progress lost its target, it now goes for { target, hitInMs })
//         minionSpawn (a minion rose: { unit, holder }), minionVanish (it left without dying: floor ended, holder died,
//                     pushed out by a newer one: { unit, reason })
//         beat (a counter passive counted a basic attack: { unit (the attacker), holder, counter, count, fired })
//         shieldBreak (a shield was used up by damage: { unit, status }; a shield that just runs out of time
//                      is only a normal 'status' expire event)
//         castStart (a hero starts winding up a skill: { unit, skill, index, castMs }; 'cast' comes when it goes off)
//         castCancel (a wind-up was interrupted by stun / freeze / silence, or nothing is left to hit;
//                     the skill is lost and stays on cooldown)
//
// MOVEMENT: every fighter has a real position (x, y = its feet on the ground, in screen pixels) once
// place() / placeLines() was called. Melee fighters WALK to their target at a steady speed
// (combat.json `movement`) and only start an attack when they are close enough (`reach`); ranged
// fighters stay where they are. Fighters gently push apart so they don't stand on top of each other.
// Without positions (some rule tests) nobody moves and melee can always hit.
export default class BattleState {
  constructor({ heroDefs, enemyDefs, minionDefs = {}, itemDefs = {}, skillDefs = {}, statusDefs = {}, rules, damageTypes, leveling, rng = Math.random }) {
    this.rules = rules;
    this.statusDefs = statusDefs; // statuses.json: tags plus rules (dot, control, tickMs...)
    this.itemDefs = itemDefs;
    this.skillDefs = skillDefs;
    this.leveling = leveling;
    this.damageTypes = damageTypes;
    // Every enemy def knows its own id (bosses refer to other enemies by id: auras, summons, twins).
    this.enemyDefs = Object.fromEntries(Object.entries(enemyDefs || {}).map(([id, d]) => [id, d && typeof d === 'object' && !id.startsWith('_') ? { id, ...d } : d]));
    this.rng = rng;
    this.nextUid = 1;
    this.focusUid = null;
    // A passive can hold the hero's `counter` (every Nth attack) and `spawner` (minions): they are also read from the def itself.
    this.heroes = heroDefs.map((d) => this.makeUnit({ ...d, counter: d.counter ?? (d.passive && d.passive.counter), spawner: d.spawner ?? (d.passive && d.passive.spawner) }, 'hero', 1));
    this.enemies = [];
    this.tornados = []; // Excalibur tornadoes { holder, remaining, tick, hops, target, spec }
    this.minions = []; // extra fighters on the hero side (minions.json); never part of the squad
    this.minionDefs = minionDefs;
    this.morale = 'full';
    this.refreshStats(); // perks count from the start
  }

  makeUnit(def, side, floor) {
    const stats = { defense: 0, resist: 0, evasion: 0, crit: 0, attackEfficiency: 100, ...def.stats };
    delete stats.mana; // mana is switched off for now (skills run on cooldown only)
    let xpScale = 1;
    if (side === 'enemy' && !def.noFloorScaling) {
      const s = this.rules.floorScaling;
      // A tier (combat.json enemyTiers, e.g. fodder): weaker, grows slower, smaller, less XP.
      const tier = def.tier && this.rules.enemyTiers && this.rules.enemyTiers[def.tier];
      const tiered = tier && floor >= tier.fromFloor;
      const growth = tiered ? tier.growthShare ?? 1 : 1;
      // Health and attack grow in steps: +perStep every stepFloors floors.
      const hpSteps = Math.floor((floor - 1) / s.hpStepFloors);
      stats.health = Math.round(stats.health * (1 + s.hpPerStep * growth * hpSteps) * (tiered ? tier.hpScale ?? 1 : 1));
      const atkSteps = Math.floor((floor - 1) / s.attackStepFloors);
      stats.attack = Math.round(stats.attack * (1 + s.attackPerStep * growth * atkSteps) * (tiered ? tier.attackScale ?? 1 : 1));
      stats.attackEfficiency *= this.rules.enemyAttackSpeedMultiplier ?? 1; // global enemy slowdown
      if (tiered) {
        xpScale = tier.xpScale ?? 1;
        if (tier.drawScale) def = { ...def, drawScale: tier.drawScale };
      }
    }
    const unit = {
      uid: this.nextUid++,
      side,
      def,
      name: def.name,
      stats,
      hp: stats.health,
      maxHp: stats.health,
      baseStats: { ...stats },
      level: 1,
      xp: 0,
      items: [],
      // Slot 0 = attack skill, slot 1 = support skill (heroes.json `skills: { attack, support }`).
      skills: SKILL_SLOTS.filter((kind) => def.skills && def.skills[kind]).map((kind) => ({ id: def.skills[kind], kind, cooldownLeft: 0 })),
      statuses: [],
      dotClocks: {}, // damage over time: ms since the last tick, per kind (bleed, burn, poison)
      pending: null, // a basic attack that has started but not landed yet: { target, remaining }
      foe: null, // melee: the uid of the opponent it keeps fighting (see pickTarget)
      x: undefined, // where it stands (feet), set by place(); undefined = no movement (tests)
      y: undefined,
      homeX: undefined, // its own spot (where fear sends it back to)
      homeY: undefined,
      moving: false, // walked this update (the scene makes it hop)
      walked: 0, // total distance walked (the scene uses it for the hop rhythm)
      knock: null, // being knocked back: { vx, vy, remaining }
      casting: null, // a skill winding up: { index, remaining, total }
      regenAcc: 0, // health gained from regen this second
      regenClock: 0,
      taunting: false, // Spite Mail: the holder has a taunted enemy
      sinceHit: 0, // ms since the unit last lost health (Archer's Steady Aim)
      steady: false, // Steady Aim is active
      floor: {}, // flags that reset every floor
      xpScale, // fodder give less XP (enemyTiers)
      firstHits: new Set(),
      sigilHits: new Set(),
      streak: { uid: null, count: 0 },
      spawnTimer: 0, // minion spawner (def.spawner): ms until the next minion
      minion: false, // true for minions (hero side, not in this.heroes)
      holderUid: null, // minions: the hero whose passive/item made it
      counterCount: 0, // "every Nth attack" passive (def.counter): basic attacks counted so far
      damageBonus: {},
      specials: {},
      procs: [],
      shareCd: 0, // Bloodlust Mask: ms until its lifesteal can be shared again
      rage: 0, // Berserker: Rage bar (0..max), full = Frenzy
      combo: { uid: null, points: 0 }, // Rogue: combo points on one enemy
      iaidoHits: 0, // Samurai: hits taken (every Nth is parried)
      interceptCd: 0, // Knight: ms until Intercept can save someone again
      song: (def.passive && def.passive.songs && def.passive.songs.start) || null, // Bard: the song he plays (null = none)
      nextSong: (def.passive && def.passive.songs && def.passive.songs.first) || null, // Bard v3: the song Change Song plays next
      songLeft: 0, // Bard v3: ms the song still plays (songs.durationMs)
      alive: true,
      damageType: def.damageType,
      flying: !!def.flying,
      weak: def.weak || [],
      resists: def.resists || [],
      timer: 0,
    };
    unit.size = this.bodySize(def); // 1 = hero-sized; bosses are 2-3 (movement: push-apart and reach)
    if (side === 'enemy') this.initBoss(unit); // boss abilities, plates, heat... (bosses.js)
    unit.timer = this.rng() * this.interval(unit); // so attacks don't all land together
    return unit;
  }

  // Milliseconds between attacks. Chill (per stack) and Shock make it longer.
  interval(unit) {
    const chill = this.statusDefs.chill || {};
    let change = -this.stacks(unit, 'chill') * (chill.slowPerStackPercent || 0);
    for (const s of unit.statuses) if (s.type === 'shock') change += s.attackSpeedPercent;
    // Bloodrage (Berserker): faster the more health he is missing.
    const rage = unit.def.passive && unit.def.passive.bloodrage;
    if (rage) change += rage.attackSpeedPercentPerMissing * (100 - (100 * unit.hp) / unit.maxHp);
    if (unit.side === 'enemy') change += this.auraSpeed(unit) - this.ghastlySlow(unit); // War Drum; Ghastly Fire burns slow
    const speed = (unit.stats.attackEfficiency / 100) * Math.max(0.2, 1 + change / 100);
    return this.rules.baseAttackIntervalMs / speed;
  }

  // Ghastly Fire: an enemy burning from a holder attacks `ghastlySlow`% slower per burn stack (5, +2 per extra copy), max 75%.
  ghastlySlow(unit) {
    let slow = 0;
    for (const st of unit.statuses) {
      if (st.type !== 'burn') continue;
      const h = this.heroes.find((x) => x.uid === st.sourceUid && x.alive);
      if (h && h.specials && h.specials.ghastlySlow) slow += h.specials.ghastlySlow;
    }
    return Math.min(75, slow);
  }

  // Spirit Axe: `spiritAxe`% (8 per copy) when the holder is hit: a ghostly axe spins around it for 3s, hitting every
  // enemy within `spiritAxeRadius` (110 px) every 0.5s for `spiritAxeDamage`% (items.json) of the holder's attack (item damage). One spin at a time.
  trySpiritAxe(target, events) {
    const ch = (target.specials && target.specials.spiritAxe) || 0;
    if (!ch || target.minion || !target.alive || (target.axeLeft || 0) > 0 || this.rng() * 100 >= ch) return;
    target.axeLeft = 3000;
    target.axeTick = 0;
    events.push({ type: 'proc', unit: target, label: 'Spirit Axe!', itemId: 'spirit_axe' });
  }

  tickSpiritAxe(hero, dt, events) {
    if (!(hero.axeLeft > 0)) return;
    hero.axeLeft -= dt;
    hero.axeTick -= dt;
    while (hero.axeTick <= 0 && hero.axeLeft > 0) { // a pulse at once, then every 0.5s: 6 pulses in 3s
      hero.axeTick += 500;
      const near = this.targetableEnemies().filter((e) => !this.hasPositions(hero) || !this.hasPositions(e) || Math.hypot(e.x - hero.x, e.y - hero.y) <= 110);
      for (const e of near) this.strike(hero, e, events, { multiplier: (hero.specials.spiritAxeDamage || 35) / 100, damageType: 'melee', item: true });
    }
    if (hero.axeLeft <= 0) hero.axeLeft = 0;
  }

  // Flame Spirit: launches 3-5 slow dark fireballs, one after another, at random enemies (`damageMultiplier` each, 300%; item damage).
  conjureSpirit(hero, events, mult = 0.8) {
    const n = 3 + Math.floor(this.rng() * 3);
    events.push({ type: 'proc', unit: hero, label: 'Dark Spirit!', itemId: 'flame_spirit' });
    for (let i = 0; i < n; i++) this.later(250 * i, (ev) => {
      if (!hero.alive) return;
      const foes = this.targetableEnemies();
      if (!foes.length) return;
      const t = foes[Math.floor(this.rng() * foes.length)];
      ev.push({ type: 'projectile', from: hero, to: t, kind: 'spiritfire' }); // a big dark fireball that sways slowly to its target
      this.later(900, (ev2) => { if (t.alive && hero.alive) this.strike(hero, t, ev2, { multiplier: mult, damageType: 'dark', item: true }); });
    });
  }

  // Moonlight Twinblade: a crescent flies at the enemy and hits it 3 times (60% each, +20% per extra copy, item damage).
  moonCrescent(hero, foe, copies, events, hit = 0.6) {
    events.push({ type: 'proc', unit: hero, label: 'Moonlight!', itemId: 'moonlight_twinblade', target: foe });
    events.push({ type: 'projectile', from: hero, to: foe, kind: 'moon' });
    const mult = hit * (1 + 0.2 * (copies - 1)); // `hitMultiplier` of the proc in items.json
    for (let i = 0; i < 3; i++) this.later(300 + 120 * i, (ev) => { if (foe.alive && hero.alive) this.strike(hero, foe, ev, { multiplier: mult, damageType: 'ranged', item: true }); });
  }

  // Things that happen a little later (Flame Spirit fireballs, Moonlight hits): `this.delays`, ticked in update().
  later(ms, fn) {
    (this.delays = this.delays || []).push({ remaining: ms, fn });
  }

  tickDelays(dt, events) {
    if (!this.delays || !this.delays.length) return;
    const due = [];
    for (const d of this.delays) { d.remaining -= dt; if (d.remaining <= 0) due.push(d); }
    this.delays = this.delays.filter((d) => d.remaining > 0);
    for (const d of due) d.fn(events);
  }

  // Ghastly Fire on a burn tick: each holder's share of the burn also hits as DARK damage (`ghastly`% per copy).
  ghastlyBurn(unit, stacks, events) {
    for (const h of this.heroes) {
      const pct = h.alive && h.specials ? h.specials.ghastly || 0 : 0;
      if (!pct) continue;
      const mine = stacks.filter((s) => s.sourceUid === h.uid).reduce((n, s) => n + s.damage, 0);
      if (!mine) continue;
      const amount = Math.max(1, Math.round(computeDotDamage(unit, (mine * pct) / 100, 'dark', this.rules, this.damageTypes, {})));
      const d = this.dealDamage(unit, amount, events);
      events.push({ type: 'dot', unit, amount: d.immune ? 0 : amount - d.absorbed, absorbed: d.absorbed, immune: d.immune, damageType: 'dark', status: 'burn', stacks: 0 });
      this.breakEffects(unit, d.broken, events);
    }
  }

  has(unit, type) {
    return unit.statuses.some((s) => s.type === type);
  }

  // Stunned or frozen: can't attack or cast.
  isStunned(unit) {
    return unit.statuses.some((s) => s.type === 'stun' || s.type === 'freeze' || s.type === 'webbed');
  }

  spawnEnemies(ids, floor) {
    this.focusUid = null;
    this.teamElementsMs = 0;
    this.tornados = [];
    this.bombs = []; // Kobold Sapper bombs on the floor
    for (const h of this.heroes) {
      h.floor = {}; // per-floor flags (Tough Skin used, Second Wind used...)
      h.firstHits = new Set(); // enemies this hero has already hit with a basic attack (Sucker Punch)
      h.sigilHits = new Set(); // enemies this hero has already marked (Hunter's Sigil)
      h.streak = { uid: null, count: 0 }; // Brawler's Streak
      h.pending = null; // attacks aimed at the last floor's enemies are gone
      h.foe = null;
      h.order = null; // drag orders end with the floor
      h.casting = null;
    }
    this.floorNo = floor;
    this.hasStarted = false;
    this.enemies = ids.map((id) => this.makeUnit(this.enemyDefs[id], 'enemy', floor));
    for (const i of ids.elites || []) if (this.enemies[i]) this.makeElite(this.enemies[i]); // the director's elites (elites.js)
    this.floorHadElite = this.enemies.some((e) => e.elite); // one reward card a rarity higher after this fight
    this.monsterHouse = !!ids.monsterHouse; // a Monster House floor (dungeon.js): banner + its own prize
    return this.enemies;
  }

  setFocus(uid) {
    const unit = this.enemies.find((e) => e.uid === uid);
    this.focusUid = unit && unit.alive ? uid : null;
  }

  // DRAG ORDER (user's sketch): drag from a hero to an enemy = ONLY that hero attacks that enemy (basic attacks and its
  // one-target skills) until it dies; the squad's tap focus is untouched. Beats tap focus for that hero; taunt and
  // charm still win. Cleared when the enemy dies or the floor ends. Returns true when it was set.
  setOrder(heroUid, enemyUid) {
    const hero = this.heroes.find((h) => h.uid === heroUid);
    const enemy = this.enemies.find((e) => e.uid === enemyUid);
    if (!hero || !hero.alive || !enemy || !enemy.alive || this.untargetable(enemy)) return false;
    hero.order = enemy.uid;
    if (hero.damageType === 'melee') hero.foe = enemy.uid;
    return true;
  }

  // The enemy a hero was ordered to attack, if it is still there and can be hit.
  orderOf(hero) {
    if (!hero.order) return null;
    return this.enemies.find((e) => e.uid === hero.order && e.alive && !this.untargetable(e)) || null;
  }

  get focusUnit() {
    return this.enemies.find((e) => e.uid === this.focusUid && e.alive) || null;
  }

  allEnemiesDead() {
    return this.enemies.every((e) => !e.alive);
  }

  allHeroesDead() {
    return this.heroes.every((h) => !h.alive);
  }

  // Every fighter: heroes, enemies and minions.
  allUnits() {
    return [...this.heroes, ...this.enemies, ...this.minions];
  }

  // The hero side's fighters (squad heroes + minions) and who enemies can attack.
  defenders() {
    return [...this.heroes, ...this.minions].filter((u) => u.alive);
  }

  // Puts a fighter at a spot (its feet). This is also its home spot (fear sends it back there).
  place(unit, x, y) {
    unit.x = unit.homeX = x;
    unit.y = unit.homeY = y;
    unit.moving = false;
    unit.knock = null;
  }

  // Places both lines like the battle screen does (combat.json `movement.layout`): heroes in a row at
  // the bottom, enemies in a row at the top, spread evenly. Used by tests and the balance bot.
  placeLines() {
    const L = this.rules.movement.layout;
    this.heroes.forEach((u, i) => this.place(u, (L.width * (i + 0.5)) / this.heroes.length, L.heroY));
    const spots = enemySpots(this.enemies, { width: L.width, y: L.enemyY, perRow: L.enemyPerRow, rowGap: L.enemyRowGap, spread: 'lane' });
    this.enemies.forEach((u, i) => this.place(u, spots[i].x, spots[i].y));
  }

  hasPositions(unit) {
    return unit.x !== undefined;
  }

  // Where a unit stands across the screen, 0 (left) to 1 (right), from its slot in its line.
  lane(unit) {
    const line = unit.side === 'hero' ? this.heroes : this.enemies;
    return (line.indexOf(unit) + 0.5) / line.length;
  }

  // How far apart two units are (real distance if they have positions, else by lane).
  distance(a, b) {
    if (this.hasPositions(a) && this.hasPositions(b)) return Math.hypot(a.x - b.x, a.y - b.y);
    return Math.abs(this.lane(a) - this.lane(b));
  }

  // The unit in `list` standing closest (ties broken at random).
  nearest(unit, list) {
    let best = null;
    let bestDist = Infinity;
    for (const other of list) {
      const dist = this.distance(unit, other) + this.rng() * 0.001;
      if (dist < bestDist) {
        best = other;
        bestDist = dist;
      }
    }
    return best;
  }

  // Who a unit attacks next (basic attacks, and single-target skills with no tapped enemy).
  //  - Taunted: whoever taunted it.
  //  - Heroes: the tapped enemy if there is one. Melee heroes keep their opponent (`foe`) until it
  //    dies, then take the NEAREST enemy. Ranged heroes pick any enemy at random.
  //  - Melee enemies keep their opponent too, and a new one is always the NEAREST hero (melee or
  //    ranged). Ranged enemies pick at random.
  pickTarget(unit) {
    // Charmed (Bard's Discord): an enemy attacks the nearest OTHER enemy instead.
    if (unit.side === 'enemy' && this.has(unit, 'charm')) {
      const others = this.enemies.filter((e) => e.alive && e !== unit);
      return others.length ? this.nearest(unit, others) : null;
    }
    const taunter = this.tauntedBy(unit);
    if (taunter) return taunter;
    const foes = (unit.side === 'hero' ? this.targetableEnemies() : this.defenders());
    if (!foes.length) return null;
    if (unit.side === 'hero' && !unit.minion) { // minions ignore tap focus and orders
      const order = this.orderOf(unit);
      if (order) return this.setFoe(unit, order); // its own drag order beats the squad's tap focus
      const focus = foes.find((e) => e.uid === this.focusUid);
      if (focus) return this.setFoe(unit, focus);
    }
    if (unit.damageType !== 'melee') return foes[Math.floor(this.rng() * foes.length)];
    const current = foes.find((u) => u.uid === unit.foe);
    if (current) return current;
    return this.setFoe(unit, this.nearest(unit, foes));
  }

  // Who a unit is taunted by: the most recent taunter that is still alive (an older taunt takes over
  // again when the newer taunter dies). null if it is not taunted. Taunt beats everything else.
  tauntedBy(unit) {
    for (const st of [...unit.statuses].reverse()) {
      if (st.type !== 'taunt') continue;
      const taunter = this.allUnits().find((u) => u.uid === st.sourceUid);
      if (taunter && taunter.alive && taunter.side !== unit.side) return taunter;
    }
    return null;
  }

  // A unit just got taunted while an attack of its was on the way to someone else: a melee swing is
  // dropped (it walks over to the taunter instead), an arrow bends towards the taunter.
  redirectToTaunter(unit, events) {
    const taunter = this.tauntedBy(unit);
    if (!taunter || !unit.pending || unit.pending.target === taunter) return;
    if (unit.damageType === 'melee') {
      unit.pending = null;
      unit.timer = this.interval(unit); // ready again as soon as it reaches the taunter
      events.push({ type: 'attackCancel', unit, reason: 'taunted' });
    } else {
      unit.pending.target = taunter;
      events.push({ type: 'attackRetarget', attacker: unit, target: taunter, hitInMs: unit.pending.remaining });
    }
  }

  setFoe(unit, foe) {
    unit.foe = foe ? foe.uid : null;
    return foe;
  }

  // A melee unit is close enough to hit: inside an oval around the target (`reachX` sideways, `reachY`
  // up/down, a little more up/down because the fighters are tall). Without positions: always.
  inReach(unit, target) {
    if (!this.hasPositions(unit) || !this.hasPositions(target)) return true;
    const M = this.rules.movement;
    // A big target can be hit from its edge, and a big attacker swings from its own edge (bug: a boss walked into
    // the hero's middle, got pushed out, walked back in: overlapping and jittering).
    const big = (target.size || 1) + (unit.size || 1) - 2;
    const dx = (target.x - unit.x) / (M.reachX * (1 + big * 0.5));
    const dy = (target.y - unit.y) / (M.reachY * (1 + big * 0.3));
    return dx * dx + dy * dy <= 1;
  }

  // How big a fighter's body is compared with a hero (1): its sprite width (without the weapon) on screen
  // divided by movement.normalBodyPx, never below 1.
  bodySize(def) {
    const M = this.rules.movement;
    if (!M || !M.normalBodyPx || !def.parts) return 1;
    let x0 = Infinity, x1 = -Infinity;
    for (const [name, p] of Object.entries(def.parts)) {
      if (name === 'weapon') continue;
      const { w } = artSize(partArt(p));
      x0 = Math.min(x0, p.x - w / 2);
      x1 = Math.max(x1, p.x + w / 2);
    }
    if (!isFinite(x0)) return 1;
    return Math.max(1, ((x1 - x0) * (def.drawScale ?? 3)) / M.normalBodyPx);
  }

  // Everyone who can walks this update: melee fighters towards their target (until in reach), feared
  // ones back to their own spot, knocked-back ones get pushed. Then fighters that stand too close push
  // apart a little (`separateX/Y`), so a crowd spreads around a target instead of piling up.
  // Pushing is gentle: a fighter that is standing still (swinging, waiting, stunned) gives way much
  // less than one that is walking (`settledPushShare`), and near the side walls a fighter is hardly
  // pushed further towards the wall (`wallSoftPx`), so crowds do not slide into the walls.
  move(dt) {
    const M = this.rules.movement;
    if (!M) return;
    const units = this.allUnits().filter((u) => u.alive && this.hasPositions(u));
    const before = new Map(units.map((u) => [u, { x: u.x, y: u.y }]));
    const step = (M.walkSpeedPxPerSec * dt) / 1000;
    const walking = new Set();
    for (const u of units) {
      if (u.knock) {
        const t = Math.min(dt, u.knock.remaining);
        u.x += u.knock.vx * t;
        u.y += u.knock.vy * t;
        u.knock.remaining -= dt;
        if (u.knock.remaining <= 0) u.knock = null;
        continue;
      }
      if (this.isStunned(u) || u.pending || u.casting || u.bossCast || u.def.object || u.dust || u.burrowed) continue; // frozen in place, busy, an object, underground
      let goal = null;
      // A lit bomb nearby (Kobold Sapper): heroes and minions walk out of its blast first.
      const bomb = u.side === 'hero' && (this.bombs || []).find((b) => Math.hypot(u.x - b.x, u.y - b.y) < b.radius + 12);
      if (bomb) goal = this.bombEscape(u, bomb);
      else if (this.has(u, 'fear')) goal = { x: u.homeX, y: u.homeY, stop: 0 };
      else if (u.damageType === 'melee') {
        const target = this.pickTarget(u);
        const blast = u.side === 'hero' && target && (this.bombs || []).some((b) => Math.hypot(target.x - b.x, target.y - b.y) < b.radius + 12); // don't walk into a bomb
        if (target && !blast && !this.inReach(u, target)) goal = { x: target.x, y: target.y };
      }
      if (!goal) continue;
      const dx = goal.x - u.x;
      const dy = goal.y - u.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.5) continue;
      const d = Math.min(step, len);
      u.x += (dx / len) * d;
      u.y += (dy / len) * d;
      u.speed = dt > 0 ? (d * 1000) / dt : 0;
      walking.add(u);
    }
    // Push apart. Ranged fighters hold their ground (only the other one moves).
    const push = (M.separatePushPerSec * dt) / 1000;
    const L = M.layout;
    const settled = M.settledPushShare ?? 1;
    const share = (u, other) => {
      if (u.def.object) return 0; // objects (War Drum, eggs) never budge
      if (u.minion !== other.minion) return u.minion ? 1 : 0; // minions always make way (they never block a hero or shove an enemy)
      if ((u.size || 1) >= (other.size || 1) * M.bigHoldRatio) return 0; // a big body (boss) is not shoved around by small ones
      if (u.damageType !== 'melee' && other.damageType === 'melee') return 0; // ranged hold their ground
      return walking.has(u) || u.knock ? 1 : settled;
    };
    // How much of a sideways push towards the nearest side wall a fighter still takes (1 far away, 0 at the wall).
    const wallFactor = (u, dirX) => {
      if (!M.wallSoftPx || !L) return 1;
      const room = dirX < 0 ? u.x - L.marginX : L.width - L.marginX - u.x;
      return Math.max(0, Math.min(1, room / M.wallSoftPx));
    };
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        const a = units[i];
        const b = units[j];
        const ghost = (m, o) => m.minion && !walking.has(m) && walking.has(o); // a minion standing still lets walkers pass through it
        if (ghost(a, b) || ghost(b, a)) continue;
        const k = ((a.size || 1) + (b.size || 1)) / 2; // big bodies (bosses) keep others further away
        const d = Math.hypot((b.x - a.x) / (M.separateX * k), (b.y - a.y) / (M.separateY * (1 + (k - 1) * 0.5))); // < 1 = too close
        if (d >= 1) continue;
        let nx = b.x - a.x;
        let ny = b.y - a.y;
        let len = Math.hypot(nx, ny);
        if (len < 0.01) {
          nx = a.uid < b.uid ? 1 : -1; // exactly on top of each other: split sideways
          ny = 0;
          len = 1;
        }
        const amount = Math.min(push, (1 - d) * M.separateX * k);
        let wa = share(a, b);
        let wb = share(b, a);
        if (wa + wb === 0) {
          if (a.def.object !== b.def.object) continue; // a boss next to its own object (eggs): neither budges
          wa = wb = 1;
        }
        // Two fighters both standing still only drift apart slowly (no jostling while they swing).
        const calm = wa < 1 && wb < 1 ? M.settledPairPush ?? 1 : 1;
        const fa = (amount * calm * wa) / (wa + wb);
        const fb = (amount * calm * wb) / (wa + wb);
        a.x -= (nx / len) * fa * wallFactor(a, -nx);
        a.y -= (ny / len) * fa;
        b.x += (nx / len) * fb * wallFactor(b, nx);
        b.y += (ny / len) * fb;
      }
    }
    for (const u of units) {
      u.x = Math.min(L.width - L.marginX, Math.max(L.marginX, u.x));
      u.y = Math.min(L.heroY, Math.max(L.enemyY + L.topMarginY, u.y));
      const b = before.get(u);
      const moved = Math.hypot(u.x - b.x, u.y - b.y);
      u.moving = moved > 0.05;
      if (!walking.has(u)) u.speed = 0; // its OWN walking pace (px/s); being shoved is not a step, so the scene doesn't hop it
      u.walked += moved;
    }
  }

  // A dash or leap skill (skills.json `staysAtImpact`: Defense Bash, Multistrike, Savage Leap) really moves the hero to
  // where it hits, and it stays there (user 2026-10-20: no walking back to its spot). How far is the skill's look
  // (combat.json skillFx): a dash goes the distance minus `stopPx`, between `minPx` and `maxPx`; a leap goes `share` of
  // the way, but never past the target's push-apart edge. Returns where it came from (the scene slides it over from
  // there), or null without positions.
  moveToImpact(hero, target, skillId) {
    const M = this.rules.movement, F = this.rules.skillFx || {};
    if (!M || !this.hasPositions(hero) || !this.hasPositions(target)) return null;
    const dash = F.dash && F.dash[skillId], leap = F.look && F.look[skillId] && F.look[skillId].leap;
    if (!dash && !leap) return null;
    const dx = target.x - hero.x, dy = target.y - hero.y, len = Math.hypot(dx, dy);
    if (len < 1) return null;
    let go = dash ? Math.min(dash.maxPx, Math.max(dash.minPx, len - dash.stopPx)) : len * leap.share;
    // Never into the target's body: stop at the push-apart edge (else he is slowly shoved back out = looks like going back).
    const ux = dx / len, uy = dy / len, k = ((hero.size || 1) + (target.size || 1)) / 2;
    const edge = 1 / Math.hypot(ux / (M.separateX * k), uy / (M.separateY * (1 + (k - 1) * 0.5)));
    go = Math.max(0, Math.min(go, len - edge - 1));
    const from = { x: hero.x, y: hero.y }, L = M.layout;
    hero.x = Math.min(L.width - L.marginX, Math.max(L.marginX, hero.x + ux * go));
    hero.y = Math.min(L.heroY, Math.max(L.enemyY + L.topMarginY, hero.y + uy * go));
    return from;
  }

  // Where a fighter goes to get out of a bomb's blast: straight away from it, kept inside the field; if the field's
  // edge is in the way (heroes stand at the bottom), the nearest way out sideways instead.
  bombEscape(u, b) {
    const L = this.rules.movement.layout;
    const clampX = (x) => Math.min(L.width - L.marginX, Math.max(L.marginX, x));
    const clampY = (y) => Math.min(L.heroY, Math.max(L.enemyY + L.topMarginY, y));
    const out = b.radius + 20;
    const dx = u.x - b.x, dy = u.y - b.y, d = Math.hypot(dx, dy);
    const away = d > 1 ? { x: clampX(b.x + (dx / d) * out), y: clampY(b.y + (dy / d) * out) } : null;
    const safe = (p) => Math.hypot(p.x - b.x, p.y - b.y) >= b.radius + 12;
    const options = [away, { x: clampX(b.x - out), y: clampY(u.y) }, { x: clampX(b.x + out), y: clampY(u.y) }, { x: clampX(u.x), y: clampY(b.y - out) }].filter((p) => p && safe(p));
    if (!options.length) return null;
    return options.reduce((a, p) => (Math.hypot(p.x - u.x, p.y - u.y) < Math.hypot(a.x - u.x, a.y - u.y) ? p : a));
  }

  // Marks a unit dead. Enemies give XP; a dead hero's items stop working.
  killUnit(target, events, killer = null) {
    if (target.def.phylactery && !target.finalDeath) return this.turnToDust(target, events); // Morthul: his crystal appears
    const was = this.morale;
    const lastStatuses = target.statuses.slice(); // what it was suffering from when it died (item reactions below)
    target.alive = false;
    target.statuses = [];
    target.dotClocks = {};
    target.pending = null; // an attack it had started never lands
    target.casting = null;
    target.moving = false;
    for (const u of this.allUnits()) {
      if (u.foe === target.uid) u.foe = null;
      if (u.order === target.uid) u.order = null; // a drag order ends with its enemy
    }
    this.retargetAttacksOn(target, events);
    if (this.focusUid === target.uid) this.focusUid = null;
    events.push({ type: 'death', unit: target, killer });
    if (target.minion) {
      this.minionDied(target, events); // no XP, no morale
      return;
    }
    if (target.side === 'enemy') {
      if (target.def.reformFor) this.phylacteryBroken(target, events); // Morthul's crystal broke: he dies for good
      if (target.def.link) this.linkDeath(target, events); // Rask & Vesh: the other one enrages
      if (!target.xpless) this.awardXp(target, events);
      if (!target.def.object) this.soulLanternKill(events);
      this.onKill(killer, target, events, lastStatuses);
      for (const spec of [].concat(target.def.onDeath || [])) this.deathBurst(target, spec, events); // a list: a Toxic elite Puffshroom has two
      if (target.elite) this.eliteDeath(target, events); // Explosive bursts, Splitting falls apart (elites.js)
      this.acolyteRaise(target, events); // a Bone Acolyte nearby raises it (bosses.js)
    }
    else {
      this.lastStand(target, events); // Last Stand Banner: the survivors rally
      this.removeMinionsOf(target, 'holderDied', events); // minions vanish when their holder dies
      this.refreshStats();
      if (this.morale !== was) events.push({ type: 'morale', tier: this.morale });
    }
  }

  // An enemy that bursts when it dies (enemies.json `onDeath: { radius, apply: [status specs] }`, e.g.
  // the Puffshroom's poison cloud): every living hero and minion within `radius` px gets the statuses
  // (everyone when there are no positions). Event `deathBurst` (the scene draws the cloud).
  deathBurst(enemy, spec, events) {
    // A delayed burst (Kobold Sapper): a lit bomb is left on the floor and goes off after `delayMs`; heroes and
    // minions in its radius walk out of it (move()). Its blast = `damageMultiplier` x the enemy's attack.
    if (spec.delayMs && !spec.lit) {
      const bomb = { uid: this.nextUid++, x: enemy.x, y: enemy.y, radius: spec.radius, remaining: spec.delayMs, total: spec.delayMs, color: spec.color };
      (this.bombs = this.bombs || []).push(bomb);
      events.push({ type: 'bombDrop', bomb, unit: enemy });
      this.later(spec.delayMs, (ev) => {
        this.bombs = this.bombs.filter((b) => b !== bomb);
        ev.push({ type: 'bombBoom', bomb });
        this.deathBurst(enemy, { ...spec, lit: true }, ev);
      });
      return;
    }
    const hit = this.defenders().filter((u) => !this.hasPositions(enemy) || !this.hasPositions(u) || Math.hypot(u.x - enemy.x, u.y - enemy.y) <= (spec.radius ?? Infinity));
    events.push({ type: 'deathBurst', unit: enemy, radius: spec.radius, color: spec.color, targets: hit, explosive: !!spec.damageMultiplier });
    for (const u of hit) {
      if (spec.damageMultiplier && u.alive) this.strike(enemy, u, events, { multiplier: spec.damageMultiplier, damageType: spec.damageType, item: true, burst: true });
      if (u.alive) for (const st of spec.apply || []) this.applyStatus(u, st, enemy, `death_${enemy.uid}`, events);
    }
  }

  // ---- minions (minions.json) ------------------------------------------------------------------
  // Minions are extra fighters on the hero side, made by a SOURCE:
  //  - the hero's own passive: def.spawner (Necromancer's Skeleton Summoner), weak, costs no upkeep;
  //  - minion ITEMS the hero holds (items.js `minionSources`): effect `minionSpawner` (weak) or
  //    `greaterMinion` (greater). Each copy of a weak spawner item is its own source (own timer and cap);
  //    copies of a greater item only make the ONE minion stronger (copyStatBonus per extra copy).
  // A weak source is { minion, minMs, maxMs, cap, atFloorStart }: a minion every minMs..maxMs while a
  // fight runs and atFloorStart of them when a fight begins; over the cap the OLDEST goes. Weak minions
  // vanish when the floor ends or when their holder dies.
  // A GREATER minion (kind 'greater') is summoned at the start of a fight if there is none, keeps its
  // health between floors (nothing heals it after a win, only healing/buffs), stays with the squad, and
  // when it dies it can only come back after `minions.revivalFloors` (2) floors have been cleared, at the
  // start of the next floor. Minions are never in `this.heroes`: no XP, perks or morale, they don't count
  // as living heroes. Enemies can attack them (and taunt-pull).
  // UPKEEP: for every minion ITEM of a hero that has a live minion, the holder loses attack speed and
  // defense (combat.json `minions`), see refreshStats().

  // The hero's minion sources, from its own passive and its minion items. Kept in hero.minionSources.
  buildSources(hero, itemSources = []) {
    const list = [];
    // The hero's own passive (Necromancer): weak, its own cap, no upkeep.
    if (hero.def.spawner) list.push({ key: 'hero', kind: 'weak', capGroup: 'hero', spec: hero.def.spawner, upkeep: false });
    const byItem = {};
    for (const src of itemSources) {
      const g = (byItem[src.itemId] = byItem[src.itemId] || { key: src.itemId, kind: src.kind, minion: src.minion, spec: src.spec, onHit: !!src.onHit, copies: 0, upkeep: !(src.spec && src.spec.upkeep === false) }); // Rat Cage: `upkeep: false`
      g.copies++;
    }
    // One source per item: a weak spawner has ONE shared timer and spawns `burst` (= copies) minions each time, all
    // weak item minions of a holder share one cap; a greater minion is ONE minion however many copies.
    for (const g of Object.values(byItem)) {
      if (g.kind === 'weak') list.push({ ...g, capGroup: 'items', burst: g.copies, upkeepScale: this.rules.minions.upkeepWeakScale ?? 0.5 });
      else list.push({ ...g, upkeepScale: 1 });
    }
    return list;
  }

  // Squad-wide minion boosters (Bone Charm, Overseer's Whistle, Grave Dust, Necro Crown): they reach EVERY minion
  // whoever holds them, and cost no upkeep. Caps: Whistle +4 weak cap in total, Necro Crown +6.
  minionBoost() {
    const sum = { bone: 0, whistle: 0, speed: 0, whistleHp: 0, dust: 0, crown: 0, crownKill: false };
    for (const h of this.heroes) {
      if (!h.alive) continue;
      const sp = h.specials;
      const x = (h.def.passive && h.def.passive.legion && h.def.passive.legion.minionItemMultiplier) || 1; // Legion: minion items count double for him
      sum.bone += (sp.boneCharm || 0) * x;
      sum.whistle += (sp.whistleCap || 0) * x;
      sum.speed += (sp.whistleSpeed || 0) * x;
      sum.whistleHp += (sp.whistleHealth || 0) * x;
      sum.dust += (sp.graveDust || 0) * x;
      sum.crown += (sp.necroCrownCap || 0) * x;
      sum.crownKill = sum.crownKill || !!sp.necroCrownKill;
      sum.spawnSpeed = Math.max(sum.spawnSpeed || 0, sp.necroCrownSpeed || 0); // does not grow with copies
    }
    return { bone: sum.bone, weakCap: Math.min(4, sum.whistle) + Math.min(6, sum.crown), weakSpeed: sum.speed, weakHealth: sum.whistleHp, dust: sum.dust, crownKill: sum.crownKill, spawnSpeed: sum.spawnSpeed || 0 };
  }

  sourceState(hero, key) {
    hero.sourceState = hero.sourceState || {};
    return (hero.sourceState[key] = hero.sourceState[key] || { timer: 0, wait: 0 });
  }

  // The fight of a new floor begins: floor-start minions rise, greater minions that are due come back,
  // spawn timers start over.
  startFloor(events = []) {
    this.hasStarted = true;
    // Rest fountain blessing (rooms.json fountain): a regen buff on every living hero for the next few FIGHTS.
    const bless = this.blessing && this.blessing.fights > 0 ? this.blessing : null;
    if (bless) bless.fights--;
    for (const hero of this.heroes) {
      if (!hero.alive) continue;
      if (bless) this.applyStatus(hero, { status: 'regenBoost', durationMs: 1e9, percentMaxHpPerSec: bless.regenPercentPerSec }, hero, 'fountain', events);
      hero.sinceHit = 0; // Steady Aim starts counting again with every fight
      hero.wardTimer = 0;
      this.wardShield(hero, events); // Warding Charm
      // Fire Heart: a fire shield at the start of every floor (20% max health per copy) that slowly regenerates and burns attackers.
      if (hero.specials.fireHeart) {
        const amount = (hero.maxHp * hero.specials.fireHeart) / 100 * (1 + (hero.specials.shieldBonus || 0) / 100);
        hero.statuses = hero.statuses.filter((st) => st.key !== 'shield:fireheart');
        const nova = hero.specials.fireHeartNova ? { damageMultiplier: hero.specials.fireHeartNova / 100, damageType: 'fire' } : null; // breaks = fire nova
        hero.statuses.push({ key: 'shield:fireheart', type: 'shield', amount, maxAmount: amount, remaining: Infinity, total: Infinity, sourceUid: hero.uid, onBreak: nova, regenPerSec: amount * 0.05, burns: true });
        events.push({ type: 'status', unit: hero, change: 'apply', status: hero.statuses[hero.statuses.length - 1] });
      }
      for (const src of hero.minionSources || []) {
        const st = this.sourceState(hero, src.key);
        if (src.kind === 'weak' && !src.onHit) {
          st.timer = this.spawnDelay(src.spec, src.copies);
          // Weak minions are there from the START of every fight (user's choice), then more come on the timer.
          for (let i = 0; i < (src.spec.atFloorStart ?? 1) * (src.burst || 1); i++) this.spawnMinion(hero, src, events);
        } else if (src.kind === 'greater' && st.wait <= 0 && !this.minions.some((m) => m.holderUid === hero.uid && m.sourceKey === src.key)) {
          this.spawnMinion(hero, src, events);
        }
      }
    }
    return events;
  }

  // The floor is won: weak minions vanish; greater ones stay, and a dead one is one floor closer to coming back.
  endFloor(events = []) {
    // Excalibur tornadoes die out with the floor (they must not follow the squad to the next one).
    for (const t of this.tornados) events.push({ type: 'tornadoEnd', tornado: t });
    this.tornados = [];
    this.bookTimers = []; // Aftershock pulses do not follow the squad to the next floor
    this.delays = []; // nor do fireballs / crescents still on their way
    for (const b of this.bombs || []) events.push({ type: 'bombFizzle', bomb: b }); // a Sapper bomb still lit when the floor is won goes out
    this.bombs = [];
    for (const h of this.heroes) h.axeLeft = 0;
    for (const m of [...this.minions]) {
      if (!m.greater) this.vanishMinion(m, 'floorEnd', events);
      else m.floors++; // a greater minion that survived the floor (Spirit Knight grows)
    }
    for (const hero of this.heroes) {
      for (const src of hero.minionSources || []) {
        const st = this.sourceState(hero, src.key);
        if (src.kind === 'greater' && st.wait > 0) st.wait--;
      }
    }
    return events;
  }

  // `fasterPerCopy` (Rat Cage): each extra copy of the item makes the next minion come that many % sooner.
  spawnDelay(sp, copies = 1) {
    const ms = sp.minMs + this.rng() * ((sp.maxMs ?? sp.minMs) - sp.minMs);
    return ms / (1 + ((sp.fasterPerCopy || 0) * (copies - 1)) / 100) / (1 + this.minionBoost().spawnSpeed / 100); // Necro Crown: +50%
  }

  // The shared cap of a hero's weak ITEM minions: combat.json itemWeakCap, plus `capPerCopy` for every extra copy
  // of a spawner item that has it (Rat Cage: +1 rat per extra cage).
  itemWeakCap(holder) {
    let cap = this.rules.minions.itemWeakCap;
    for (const src of holder.minionSources || []) if (src.kind === 'weak' && src.spec && src.spec.capPerCopy) cap += src.spec.capPerCopy * ((src.copies || 1) - 1);
    return cap;
  }

  tickSpawner(hero, dt, events) {
    if (!this.enemies.some((e) => e.alive)) return; // only while there is a fight
    for (const src of hero.minionSources || []) {
      if (src.kind !== 'weak' || src.onHit) continue;
      const st = this.sourceState(hero, src.key);
      st.timer -= dt;
      if (st.timer > 0) continue;
      st.timer += this.spawnDelay(src.spec, src.copies);
      for (let i = 0; i < (src.burst || 1); i++) this.spawnMinion(hero, src, events); // one more minion per copy of the item
    }
  }

  // A minion rises next to its holder. Weak, over the cap: the oldest one from the same source is pushed out.
  spawnMinion(holder, src, events) {
    const id = src.kind === 'weak' ? src.spec.minion : src.minion;
    const def = this.minionDefs[id];
    if (!def) return null;
    if (src.kind === 'weak') {
      // Over the cap: the oldest weak minion of the same cap group (the hero's own, or all item minions) goes.
      const mine = this.minions.filter((m) => m.holderUid === holder.uid && m.capGroup === src.capGroup);
      const cap = (src.capGroup === 'hero' ? src.spec.cap || 4 : this.itemWeakCap(holder)) + this.minionBoost().weakCap;
      if (mine.length >= cap) this.vanishMinion(mine[0], 'pushedOut', events);
    }
    const m = this.makeUnit({ id, ...def, stats: { ...def.stats } }, 'hero', 1);
    m.minion = true;
    if (def.hitType) m.hitType = def.hitType; // Ice Spirit Knight: moves as melee, its hits are ice
    m.greater = src.kind === 'greater';
    m.holderUid = holder.uid;
    m.sourceKey = src.key;
    m.capGroup = src.capGroup;
    m.upkeep = src.upkeep;
    m.upkeepScale = src.upkeepScale ?? 1; // an item costs its upkeep ONCE, however many copies (user's choice)
    m.rawStats = { ...def.stats }; // the stats before copies, boosters and growth (refreshMinionStats scales them)
    m.copies = src.copies || (src.key === 'mimic_chest' ? holder.specials.mimicCopies || 1 : 1);
    if (src.spec && src.spec.copyStatBonus !== undefined) m.copyBonus = src.spec.copyStatBonus; // per item: Rat 0, Wisp 0.2, Imp 0.15
    // Wisp Lantern: each extra copy lets the wisps' bolts jump to one more enemy (`chainPerCopy`).
    const cpc = src.spec && src.spec.chainPerCopy;
    if (cpc && m.copies > 1) m.chain = { jumps: cpc.jumps * (m.copies - 1), damageMultiplier: cpc.damageMultiplier, damageType: def.damageType, skipFirst: true };
    m.floors = 0;
    m.timer = 0;
    if (this.hasPositions(holder)) {
      const M = this.rules.movement;
      this.place(m, holder.x + (this.rng() - 0.5) * 80, holder.y - 36 - this.rng() * 20);
      m.x = Math.min(M.layout.width - M.layout.marginX, Math.max(M.layout.marginX, m.x));
    }
    this.minions.push(m);
    this.refreshStats(); // scaling, squad buffs and the holder's upkeep
    m.hp = m.maxHp; // a new minion always starts at full health
    events.push({ type: 'minionSpawn', unit: m, holder });
    return m;
  }

  vanishMinion(m, reason, events) {
    if (!this.minions.includes(m)) return;
    m.alive = false;
    m.pending = null;
    m.casting = null;
    for (const u of this.allUnits()) if (u.foe === m.uid) u.foe = null;
    this.minions = this.minions.filter((x) => x !== m);
    this.retargetAttacksOn(m, events);
    this.refreshStats(); // its holder stops paying upkeep for it
    events.push({ type: 'minionVanish', unit: m, reason });
  }

  // All minions made by `holder` leave (the holder died).
  removeMinionsOf(holder, reason, events) {
    for (const m of this.minions.filter((x) => x.holderUid === holder.uid)) this.vanishMinion(m, reason, events);
  }

  // A minion was killed: a greater one starts its revival wait.
  minionDied(m, events = []) {
    this.minions = this.minions.filter((x) => x !== m);
    this.gainSoul(events); // Necromancer's Legion
    this.explodeMinion(m, events); // Mimic, Grave Dust
    const holder = this.heroes.find((h) => h.uid === m.holderUid);
    if (m.greater && holder) this.sourceState(holder, m.sourceKey).wait = this.rules.minions.revivalFloors;
    this.refreshStats();
  }

  // Necromancer's LEGION (passive.legion): every minion that dies gives each living Necromancer a Soul (up to
  // `maxSouls`); his skill with `soulBonusPercent` (Death Coil) spends them all for extra damage.
  gainSoul(events) {
    for (const h of this.heroes) {
      const L = h.alive && h.def.passive && h.def.passive.legion;
      if (!L || (h.souls || 0) >= L.maxSouls) continue;
      h.souls = (h.souls || 0) + 1;
      events.push({ type: 'soul', unit: h, souls: h.souls });
    }
  }

  // BONE SACRIFICE (skill `boneSacrifice: { minion, basePercent, perMinionPercent, durationMs }`): all his skeletons
  // die (Grave Dust makes them explode, each death is a Soul) and every living hero gets a shield of basePercent +
  // perMinionPercent per skeleton of their max health.
  boneSacrifice(hero, skill, slotId, events) {
    const B = skill.boneSacrifice;
    const bones = this.minions.filter((m) => m.alive && m.holderUid === hero.uid && m.def.id === B.minion);
    for (const m of bones) {
      events.push({ type: 'proc', unit: m, label: 'Sacrifice!' });
      m.hp = 0;
      this.killUnit(m, events);
    }
    const pct = B.basePercent + B.perMinionPercent * bones.length;
    for (const h of this.heroes.filter((x) => x.alive)) this.applyStatus(h, { status: 'shield', percentMaxHp: pct, durationMs: B.durationMs }, hero, slotId, events);
  }

  // The upkeep a hero pays: every minion ITEM of his that has a live minion costs its full upkeep (greater minion)
  // or half (weak spawner items, `minions.upkeepWeakScale`). Returns the total in "full upkeeps".
  upkeepCount(hero) {
    const seen = new Map();
    for (const m of this.minions) if (m.holderUid === hero.uid && m.upkeep) seen.set(m.sourceKey, m.upkeepScale);
    let total = 0;
    for (const v of seen.values()) total += v;
    return total;
  }

  // A dying weak minion explodes when it has an explosion of its own (Mimic) and/or Grave Dust is out there: damage
  // to the enemies near it (item damage, nothing else triggers).
  explodeMinion(m, events) {
    const own = m.def.explode ? m.def.explode.damageMultiplier * (1 + 0.25 * ((m.copies || 1) - 1)) : 0; // Mimic: +25% per extra chest
    const dust = m.greater ? 0 : this.minionBoost().dust / 100; // Grave Dust: `graveDust`% attack per copy (400), weak minions only
    const total = own + dust;
    if (total <= 0) return;
    const radius = (m.def.explode && m.def.explode.radius) || 120;
    events.push({ type: 'minionExplode', unit: m, radius });
    for (const e of this.enemies.filter((x) => x.alive)) {
      if (this.hasPositions(m) && this.hasPositions(e) && Math.hypot(e.x - m.x, e.y - m.y) > radius * 1.6) continue;
      this.strike(m, e, events, { multiplier: total, damageType: 'fire', item: true });
      if (dust > 0 && e.alive) this.applyStatus(e, { status: 'poison', durationMs: 5000, damageMultiplier: 0.3 }, m, 'graveDust', events); // Grave Dust also poisons
    }
  }

  // A minion's stats: its minions.json stats scaled by copies of its item (copyStatBonus per extra copy), growth per
  // survived floor (Spirit Knight) and the squad's Bone Charms (health and attack); weak minions also attack faster with
  // Overseer's Whistles; plus any buff the squad gave it. Its health keeps the same % when the scale changes.
  refreshMinionStats(m) {
    const raw = m.rawStats || m.baseStats;
    const boost = this.minionBoost();
    const bonus = m.copyBonus ?? m.def.copyStatBonus ?? this.rules.minions.copyStatBonus ?? 0;
    const growth = m.def.growthPerFloor ? 1 + Math.min(m.def.growthMax ?? 1, m.def.growthPerFloor * (m.floors || 0)) : 1;
    const holder = this.heroes.find((h) => h.uid === m.holderUid);
    const legion = holder && holder.def.passive && holder.def.passive.legion;
    const lvl = legion && m.def.id === legion.minion ? 1 + ((legion.perLevelPercent || 0) * ((holder.level || 1) - 1)) / 100 : 1; // Legion: his skeletons level up with him
    const scale = (1 + bonus * ((m.copies || 1) - 1)) * growth * (1 + boost.bone / 100) * lvl;
    const ratio = m.maxHp > 0 ? m.hp / m.maxHp : 1;
    const hpScale = m.greater ? 1 : 1 + (boost.weakHealth || 0) / 100; // Overseer's Whistle: weak minions are tougher
    m.maxHp = Math.max(1, Math.round(raw.health * scale * hpScale));
    m.hp = Math.min(m.maxHp, Math.round(m.maxHp * ratio));
    m.baseStats = { ...raw, health: m.maxHp, attack: Math.round(raw.attack * scale) };
    if (!m.greater) m.baseStats.attackEfficiency = raw.attackEfficiency * (1 + boost.weakSpeed / 100);
    const stats = { ...m.baseStats };
    for (const st of m.statuses) {
      if (st.type !== 'buff') continue;
      for (const mod of st.mods) {
        if (!mod.stat) continue; // specials (e.g. Blood Pact's lifesteal) are for heroes only
        if (mod.percent !== undefined) stats[mod.stat] += ((m.baseStats[mod.stat] || 0) * mod.percent) / 100;
        else stats[mod.stat] = (stats[mod.stat] || 0) + mod.flat;
      }
    }
    for (const key of ['defense', 'resist', 'evasion', 'crit']) stats[key] = Math.max(0, stats[key] || 0);
    stats.attack = Math.max(1, stats.attack);
    stats.attackEfficiency = Math.max(10, stats.attackEfficiency);
    stats.health = m.maxHp; // buffs never change a minion's health
    m.stats = stats;
    // Element minions (Imp, Wisp, Phoenix, Ice Spirit Knight) get `holderElementShare` of their hero's +% for their element.
    const share = m.def.holderElementShare || 0;
    const type = m.def.hitType || m.def.damageType;
    m.damageBonus = share && holder && holder.damageBonus && holder.damageBonus[type] ? { [type]: holder.damageBonus[type] * share } : {};
  }

  // Moves the fight forward by dt milliseconds. Returns events for the scene to show.
  update(dt) {
    const events = [];
    this.tickStatuses(dt, events);
    this.move(dt);
    this.tickTornados(dt, events);
    this.tickDelays(dt, events); // Flame Spirit / Moonlight Twinblade hits on their way
    this.tickBookTimers(dt, events); // skill book Aftershock pulses
    this.tickBosses(dt, events); // boss moves, eggs, heat, revives... (bosses.js)
    this.tickElites(dt, events); // elite regen and shields (elites.js)
    if (this.teamElementsMs > 0) this.teamElementsMs -= dt; // Arcane Ward's Team Elements

    // Minions with their own regen (Phoenix: `regenPercent` of max health per second).
    for (const m of this.minions) if (m.alive && m.def.regenPercent && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + (m.maxHp * m.def.regenPercent * dt) / 100000);
    // Health regenerates (Heart Charm) and skill cooldowns run down.
    for (const hero of this.heroes) {
      if (!hero.alive) continue;
      // Regen (Heart Charm) and the Cleric's aura: every hero regenerates a little, and regen/heals from items are stronger.
      const aura = this.regenAura();
      const regen = (((hero.specials && hero.specials.regen) || 0) * aura.factor + aura.base + this.songRegen()) * (1 + ((hero.specials && hero.specials.healAmp) || 0) / 100); // % of max health per second
      if (regen > 0) {
        const gain = Math.min(hero.maxHp - hero.hp, (hero.maxHp * regen * dt) / 100000);
        hero.hp += gain;
        hero.regenAcc += gain;
      }
      hero.regenClock += dt;
      if (hero.regenClock >= 1000) { // regen counts as ONE heal per second for "heal received" items
        hero.regenClock -= 1000;
        if (hero.regenAcc >= 1) this.onHealed(hero, hero.regenAcc, events);
        hero.regenAcc = 0;
      }
      this.tickSteadyAim(hero, dt);
      if (hero.interceptCd > 0) hero.interceptCd -= dt; // Knight's Intercept cooldown
      this.tickTaunting(hero);
      if (hero.floor.martyrCd > 0) hero.floor.martyrCd -= dt;
      hero.shareCd = Math.max(0, hero.shareCd - dt);
      if (hero.soulCd > 0) hero.soulCd -= dt; // Grimoire fireball cooldown
      if (hero.triageCd > 0) hero.triageCd -= dt; // Aid Kit triage cooldown
      this.tickBandages(hero, dt, events);
      this.tickSong(hero, dt, events);
      this.tickBloodthirst(hero, dt, events);
      this.tickGrace(hero, dt, events);
      this.tickLute(hero, dt, events);
      this.tickWard(hero, dt, events);
      this.tickSpiritAxe(hero, dt, events);
      this.tickSpawner(hero, dt, events);
      for (const slot of hero.skills) slot.cooldownLeft = Math.max(0, slot.cooldownLeft - dt);
      this.tickCasting(hero, dt, events);
    }

    for (const unit of this.allUnits()) {
      if (!unit.alive) continue;
      const busy = this.isStunned(unit) || this.has(unit, 'fear'); // stunned, frozen or feared: no attacks
      // An attack in progress (started, not landed yet): it lands when its time runs out.
      if (unit.pending) {
        if (busy) {
          unit.pending = null; // interrupted: the attack is lost
          events.push({ type: 'attackCancel', unit, reason: this.has(unit, 'fear') ? 'fear' : 'stun' });
        } else {
          unit.pending.remaining -= dt;
          if (unit.pending.remaining <= 0) {
            const { target } = unit.pending;
            unit.pending = null;
            this.landAttack(unit, target, events);
          }
        }
      }
      if (!unit.alive || busy) continue;
      if (unit.casting || unit.bossCast) continue; // winding up a skill: no basic attacks meanwhile
      if (unit.def.object || unit.dust || this.untargetable(unit)) continue; // objects never attack; dust / in the sky cannot
      unit.timer += dt;
      const interval = this.interval(unit);
      if (unit.timer < interval) continue;
      if (unit.pending) {
        unit.timer = interval; // still busy with the last attack: start the next one right after
        continue;
      }

      // Shocked: sometimes the attack fumbles and the unit is stunned for a moment instead.
      const shock = unit.statuses.find((s) => s.type === 'shock');
      if (shock && this.rng() * 100 < shock.fumbleChance) {
        unit.timer -= interval;
        events.push({ type: 'proc', unit, label: 'Fumble!' });
        this.applyStatus(unit, { status: 'stun', durationMs: shock.fumbleStunMs }, unit, 'shock_fumble', events);
        continue;
      }

      const target = this.pickTarget(unit);
      // Nothing to hit yet, or a melee fighter still walking over: stay ready, attack on arrival.
      if (!target || (unit.damageType === 'melee' && !this.inReach(unit, target))) {
        unit.timer = interval;
        continue;
      }
      unit.timer -= interval;

      // The attack starts now and lands after `hitDelay` (melee: the swing, ranged: the shot's
      // flight). With a delay of 0 it lands at once.
      const hitInMs = this.hitDelay(unit, target);
      events.push({ type: 'attackStart', attacker: unit, target, hitInMs });
      if (hitInMs > 0) unit.pending = { target, remaining: hitInMs };
      else this.landAttack(unit, target, events);
    }
    return events;
  }

  // Attacks that were on their way to a unit that just died: an arrow goes for someone else (it gets
  // at least `retargetMinMs`); a melee swing is lost (the fighter stays ready and walks to its next
  // target, attacking when it gets there). Nobody left: cancelled.
  retargetAttacksOn(dead, events) {
    for (const unit of this.allUnits()) {
      if (!unit.alive || !unit.pending || unit.pending.target !== dead) continue;
      const next = this.pickTarget(unit);
      if (!next || (unit.damageType === 'melee' && !this.inReach(unit, next))) {
        unit.pending = null;
        unit.timer = this.interval(unit); // ready again as soon as it reaches someone
        events.push({ type: 'attackCancel', unit, reason: 'noTarget' });
        continue;
      }
      unit.pending.target = next;
      unit.pending.remaining = Math.max(unit.pending.remaining, (this.rules.attackTiming && this.rules.attackTiming.retargetMinMs) || 0);
      events.push({ type: 'attackRetarget', attacker: unit, target: next, hitInMs: unit.pending.remaining });
    }
  }

  // How long a basic attack takes from start to hit (combat.json `attackTiming`, per side:
  // hero / enemy). Melee: the swing (`swingMs`; the walk over happens before, see move()).
  // Ranged: the shot's flight (`rangedHitMs`).
  hitDelay(unit) {
    const timing = (this.rules.attackTiming && this.rules.attackTiming[unit.side]) || {};
    return (unit.damageType === 'melee' ? timing.swingMs : timing.rangedHitMs) || 0;
  }

  // A basic attack hits. If its target died in the meantime it goes to a new target instead.
  landAttack(unit, target, events) {
    if (!target.alive) target = this.pickTarget(unit);
    if (!target) return;
    const fired = this.countBeats(unit, events, target); // "every Nth attack" passives that go off on THIS attack
    // A heal beat (Cleric): instead of hitting the enemy, the attack heals the most hurt ally.
    for (const f of fired) {
      if (f.counter.effect === 'heal' && this.fireHeal(f.holder, f.counter, events)) return;
    }
    const empower = fired.filter((f) => f.counter.effect === 'empower');
    const metro = this.metronomeBeat(unit, target, events); // Metronome: every 4th basic attack of the holder hits harder
    const hit = this.strike(unit, target, events, metro ? { basic: true, damagePercent: metro, ...(unit.hitType ? { damageType: unit.hitType } : {}) } : unit.hitType ? { basic: true, damageType: unit.hitType } : { basic: true }); // an elite hits with its element
    if (unit.elite) this.eliteAfterAttack(unit, target, hit, events); // Storm: every 4th hit jumps
    this.cycleElement(unit); // Mage: the next basic attack is the next element
    if (!hit.dodged) this.addCombo(unit, target, 1, events);
    if (unit.minion && unit.chain && !hit.dodged) this.chainHit(unit, target, unit.chain, events); // Wisp Lantern copies: the bolt jumps on // Rogue: a combo point on this enemy
    this.pierce(unit, target, hit, events); // Archer: a shot on a Marked enemy goes through to the one behind
    this.lobbedShot(unit, target, hit, events); // Alchemist: the flask splashes and poisons
    // Minion hits that put a status on the target (Imp burns, Gargoyle taunts).
    if (unit.minion && unit.def.onAttackApply && target.alive && !hit.dodged) {
      for (const spec of unit.def.onAttackApply) this.applyStatus(target, spec, unit, `minion_${unit.def.id}`, events);
    }
    // Enemy hits that may put a status on the hero they hit (enemies.json `onHit`: each spec has a
    // `chance` in %, e.g. the Spider poisons). Only when the hit connected.
    if (unit.side === 'enemy' && unit.def.onHit && target.alive && !hit.dodged) {
      for (const spec of unit.def.onHit) {
        if (this.rng() * 100 < (spec.chance ?? 100)) this.applyStatus(target, spec, unit, `enemy_${unit.name}`, events);
      }
    }
    // An empowered beat (Mage Spellweaver, Bard Rhythm): a free extra hit and debuffs on the target.
    for (const f of empower) {
      const c = f.counter;
      const el = f.element; // a counter with a `rotation` (Mage) cycles its elements: damage type + debuff of this beat
      if (c.strike && target.alive) this.strike(unit, target, events, { multiplier: c.strike.damageMultiplier, damageType: el ? el.damageType : c.strike.damageType });
      if (target.alive && !hit.dodged) for (const spec of (el ? el.apply : c.apply) || []) this.applyStatus(target, spec, unit, `counter_${f.holder.uid}`, events);
    }
    this.rollProcs(unit, 'onAttack', events, { target, hit: !hit.dodged, force: empower.some((f) => f.counter.forceProcs) });
    this.fireArrows(unit, target, events);
    this.extraArrows(unit, target, events);
    this.volley(unit, target, events); // Archer: every Nth shot fires at more enemies
  }

  // Mage's ELEMENT CYCLE (passive.elementCycle: ['fire', 'ice', 'electric']): her basic attacks go through the list in
  // turn (`hitType` = the element of her NEXT shot, also how the scene draws it), so they keep setting off Reactions.
  cycleElement(unit) {
    const cyc = unit.def.passive && unit.def.passive.elementCycle;
    if (!cyc || unit.side !== 'hero') return;
    unit.cycleIndex = ((unit.cycleIndex || 0) + 1) % cyc.length;
    unit.hitType = cyc[unit.cycleIndex];
  }

  // Archer's VOLLEY (passive.volley): every `every`th basic shot also fires at `arrows`-1 other enemies (the nearest
  // to her target), +`perQuiver` per Quiver of Plenty she holds. Each arrow is a full shot that rolls her on-hit items
  // (and Fire Arrows). The count is kept for the whole run.
  volley(unit, target, events) {
    const V = unit.def.passive && unit.def.passive.volley;
    if (!V || unit.side !== 'hero') return;
    unit.volleyCount = (unit.volleyCount || 0) + 1;
    if (unit.volleyCount < V.every) return;
    unit.volleyCount = 0;
    const quivers = unit.items.filter((i) => i === 'quiver_of_plenty').length;
    let n = V.arrows - 1 + quivers * (V.perQuiver || 0);
    const others = this.targetableEnemies().filter((e) => e !== target);
    if (!others.length) return;
    events.push({ type: 'proc', unit, label: 'Volley!', target });
    const from = target.alive ? target : others[0];
    others.sort((a, b) => (this.hasPositions(a) ? this.distance(a, from) - this.distance(b, from) : 0));
    for (const e of others) {
      if (n-- <= 0) break;
      const res = this.strike(unit, e, events, { multiplier: V.damageMultiplier, projectile: 'arrow' });
      this.rollProcs(unit, 'onAttack', events, { target: e, hit: !res.dodged });
      this.fireArrows(unit, e, events);
    }
  }

  // Quiver of Plenty: a RANGED basic attack of the holder has `extraArrow`% (15 per copy) to shoot one more arrow at a
  // DIFFERENT enemy (full damage, on-hit items roll); past 100% the rest is the chance for a third arrow (max 2 extra).
  extraArrows(unit, target, events) {
    const ch = (unit.specials && unit.specials.extraArrow) || 0;
    if (!ch || unit.minion || unit.side !== 'hero' || unit.damageType === 'melee') return;
    let n = Math.min(2, Math.floor(ch / 100) + (this.rng() * 100 < ch % 100 ? 1 : 0));
    const hit = new Set([target]);
    while (n-- > 0) {
      const others = this.targetableEnemies().filter((e) => !hit.has(e));
      if (!others.length) return;
      const other = others[Math.floor(this.rng() * others.length)];
      hit.add(other);
      events.push({ type: 'proc', unit, label: 'Extra arrow!', itemId: 'quiver_of_plenty', target: other });
      const res = this.strike(unit, other, events, { projectile: 'arrow' });
      this.rollProcs(unit, 'onAttack', events, { target: other, hit: !res.dodged });
    }
  }

  // Metronome: the holder counts its own basic attacks; every 4th (`metronomeEvery`) gets +`metronome`% damage
  // (+50% per copy). The count is kept for the whole run. Returns the bonus for this attack (0 = none).
  metronomeBeat(unit, target, events) {
    const bonus = (unit.specials && unit.specials.metronome) || 0;
    if (!bonus || unit.minion || unit.side !== 'hero') return 0;
    unit.metroCount = (unit.metroCount || 0) + 1;
    if (unit.metroCount < (unit.specials.metronomeEvery || 4)) return 0;
    unit.metroCount = 0;
    events.push({ type: 'proc', unit, label: 'Metronome!', itemId: 'metronome', target });
    return bonus;
  }

  // Bandage Roll: every `bandageTossEveryMs` (8s) of a fight the holder throws 1-3 bandages (random) at the most hurt
  // living heroes (one each, most hurt first); each heals `bandageToss` FLAT health (5 per roll). Only hurt heroes get one.
  tickBandages(hero, dt, events) {
    const heal = hero.specials.bandageToss || 0;
    if (!heal || !this.enemies.some((e) => e.alive)) return;
    hero.bandageTimer = (hero.bandageTimer || 0) + dt;
    if (hero.bandageTimer < (hero.specials.bandageTossEveryMs || 8000)) return;
    hero.bandageTimer = 0;
    const hurt = this.heroes.filter((h) => h.alive && h.hp < h.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    const count = Math.min(hurt.length, 1 + Math.floor(this.rng() * 3));
    if (!count) return;
    events.push({ type: 'proc', unit: hero, label: 'Bandage!', itemId: 'bandage_roll' });
    for (const ally of hurt.slice(0, count)) {
      events.push({ type: 'flask', unit: hero, target: ally, flask: { color: '0xf2e6cc' } }); // drawn as a lobbed bandage
      this.healUnit(ally, heal, events, { aura: false });
    }
  }

  // Warding Charm: a shield of `wardPulse`% max health (8, does not grow with copies; Warding Charm's own shield bonus
  // makes it bigger) at the start of every fight and again every `wardPulseEveryMs` (10s) while enemies live; it refills.
  wardShield(hero, events) {
    if (!hero.specials.wardPulse) return;
    this.applyStatus(hero, { status: 'shield', percentMaxHp: hero.specials.wardPulse }, hero, 'warding', events);
  }
  tickWard(hero, dt, events) {
    if (!hero.specials.wardPulse || !this.enemies.some((e) => e.alive)) return;
    hero.wardTimer = (hero.wardTimer || 0) + dt;
    if (hero.wardTimer < (hero.specials.wardPulseEveryMs || 10000)) return;
    hero.wardTimer = 0;
    this.wardShield(hero, events);
  }

  // Fire Arrows: ranged attacks have a 50% chance (it does not stack) for an extra fire hit; more copies hit harder.
  fireArrows(unit, target, events) {
    const fa = unit.specials && unit.specials.fireArrows;
    if (fa && unit.damageType !== 'melee' && target.alive && this.rng() < 0.5) {
      events.push({ type: 'proc', unit, label: 'Fire Arrow!', itemId: 'fire_arrows', target });
      this.strike(unit, target, events, { multiplier: fa / 100, damageType: 'fire', projectile: 'firearrow', item: true }); // a flaming arrow, not a bomb
    }
  }

  // ---- hero rework v2: signature mechanics (all numbers in the hero's passive in heroes.json) ----------

  // Knight's INTERCEPT (passive.intercept): when an ally drops under `belowPercent` health, the Knight guards
  // them for `durationMs`: he takes `sharePercent` of every enemy hit on them (see strike). Cooldown `cooldownMs`.
  tryIntercept(ally, events) {
    for (const k of this.heroes) {
      const ic = k.alive && k !== ally && k.def.passive && k.def.passive.intercept;
      if (!ic || k.interceptCd > 0 || ally.hp >= (ally.maxHp * ic.belowPercent) / 100) continue;
      k.interceptCd = ic.cooldownMs;
      this.applyStatus(ally, { status: 'guarded', durationMs: ic.durationMs }, k, 'intercept', events);
      events.push({ type: 'intercept', unit: k, ally });
      return;
    }
  }

  // The Knight takes his share of a hit on a guarded ally. Returns the amount the ally still takes.
  interceptHit(attacker, target, amount, events) {
    const g = target.statuses.find((st) => st.type === 'guarded');
    const k = g && this.heroes.find((h) => h.uid === g.sourceUid && h.alive && h !== target);
    if (!k) return amount;
    const part = Math.round((amount * k.def.passive.intercept.sharePercent) / 100);
    if (part <= 0) return amount;
    const d = this.dealDamage(k, part, events);
    events.push({ type: 'intercepted', unit: k, ally: target, amount: d.immune ? 0 : part - d.absorbed });
    this.breakEffects(k, d.broken, events);
    if (!d.immune) this.afterHit(attacker, k, part - d.absorbed, events); // his Bulwark Plate / Spite Mail reflect it
    if (k.hp <= 0 && k.alive) this.killUnit(k, events, attacker);
    return amount - part;
  }

  // Berserker's RAGE (passive.rage): fills from his hits (`perHitDealt`, x`critMultiplier` on crits) and
  // hits he takes (`perHitTaken`); full = FRENZY (a buff with `frenzy.mods` for `frenzy.durationMs`).
  gainRage(hero, amount, events) {
    const r = hero.def.passive && hero.def.passive.rage;
    if (!r || !hero.alive || hero.side !== 'hero' || this.frenzied(hero)) return;
    hero.rage = Math.min(r.max, hero.rage + amount);
    if (hero.rage < r.max) return;
    hero.rage = 0;
    if (events) events.push({ type: 'proc', unit: hero, label: 'Frenzy!' });
    this.applyStatus(hero, { status: 'buff', durationMs: r.frenzy.durationMs, mods: r.frenzy.mods }, hero, 'frenzy', events || []);
  }

  frenzied(hero) {
    return hero.statuses.some((st) => st.key === 'buff:frenzy');
  }

  // Rogue's COMBO (passive.combo): points on ONE enemy (another enemy starts over), up to `max`.
  addCombo(hero, target, n, events) {
    const c = hero.def.passive && hero.def.passive.combo;
    if (!c || !target || target.side !== 'enemy') return;
    if (hero.combo.uid !== target.uid) hero.combo = { uid: target.uid, points: 0 };
    hero.combo.points = Math.min(c.max, hero.combo.points + n);
    events.push({ type: 'combo', unit: hero, target, points: hero.combo.points });
  }

  // Archer's pierce (passive.steadyAim.pierce): a basic shot on a MARKED enemy (on ANY enemy with
  // `everyShot`) also hits the closest other enemy within `radius` of it for `damageMultiplier`.
  pierce(unit, target, hit, events) {
    const p = unit.def.passive && unit.def.passive.steadyAim && unit.def.passive.steadyAim.pierce;
    if (!p || hit.dodged || (!p.everyShot && !this.has(target, 'mark'))) return;
    const others = this.enemies.filter((e) => e.alive && e !== target && (!this.hasPositions(e) || this.distance(e, target) <= p.radius));
    if (!others.length) return;
    const next = this.nearest(target, others);
    events.push({ type: 'proc', unit, label: 'Pierce!' });
    this.strike(unit, next, events, { multiplier: p.damageMultiplier, projectile: 'knife', from: target });
  }

  // Alchemist's LOBBED SHOTS (passive.lobbed): his basic attack is a flask. It poisons the target (`apply`) and
  // splashes `splashMultiplier` on every other enemy within `splashRadius` of it, poisoning them too.
  lobbedShot(unit, target, hit, events) {
    const L = unit.def.passive && unit.def.passive.lobbed;
    if (!L || hit.dodged) return;
    const near = this.enemies.filter((e) => e.alive && e !== target && this.hasPositions(e) && this.hasPositions(target) && this.distance(e, target) <= L.splashRadius);
    const poison = (e) => { for (const spec of L.apply || []) if (e.alive) this.applyStatus(e, spec, unit, 'passive_lobbed', events); };
    poison(target);
    for (const e of near) {
      const h = this.strike(unit, e, events, { multiplier: L.splashMultiplier });
      if (!h.dodged) poison(e);
    }
  }

  // Bard's SONGS (passive.songs): the song he plays helps the squad while he lives.
  bards() {
    return this.heroes.filter((h) => h.alive && h.def.passive && h.def.passive.songs);
  }

  songRegen() {
    let regen = 0;
    for (const b of this.bards()) if (b.song === 'ballad') regen += b.def.passive.songs.ballad.regenPercentPerSec * (1 + (b.specials.baton || 0) / 100);
    return regen;
  }

  // Change Song: switches the song and plays a short burst of the new one (a squad heal or a speed buff).
  // Bard v3 (`songs.first` + `durationMs`): plays `nextSong` for durationMs, the next cast plays the other one.
  switchSong(bard, events) {
    const songs = bard.def.passive.songs;
    if (songs.durationMs) {
      bard.song = bard.nextSong || 'march';
      bard.nextSong = bard.song === 'march' ? 'ballad' : 'march';
      bard.songLeft = songs.durationMs;
    } else bard.song = bard.song === 'march' ? 'ballad' : 'march';
    const burst = songs[bard.song].burst || {};
    events.push({ type: 'song', unit: bard, song: bard.song });
    for (const u of this.squadUnits()) {
      if (burst.healPercent) this.healUnit(u, (u.maxHp * burst.healPercent) / 100, events);
      if (burst.mods) this.applyStatus(u, { status: 'buff', durationMs: burst.durationMs, mods: burst.mods }, bard, 'song_burst', events);
    }
    this.refreshStats();
  }

  // Cleric's GRACE (passive.grace): every `everyMs` of a fight she heals the most hurt hero (`heal`, made stronger by
  // her aura like item heals). Healing SOMEONE ELSE gives HER `selfBuff` (+attack, +attack speed).
  tickGrace(hero, dt, events) {
    const G = hero.def.passive && hero.def.passive.grace;
    if (!G) return;
    hero.floor.grace = (hero.floor.grace || 0) + dt;
    if (hero.floor.grace < G.everyMs) return;
    const ally = this.lowestHealthPercent();
    if (!ally || ally.hp >= ally.maxHp) { hero.floor.grace = G.everyMs; return; } // nobody hurt: it waits, charged
    hero.floor.grace = 0;
    events.push({ type: 'flask', unit: hero, target: ally, flask: { color: '0xfff2a0' } }); // a holy mote lobbed over
    this.clericHeal(hero, ally, this.healAmount(hero, ally, G.heal) * this.regenAura().factor, events);
  }

  // A heal from the Cleric: if it lands on SOMEONE ELSE she gets Grace's self buff. Returns the health restored.
  clericHeal(cleric, ally, amount, events) {
    const got = this.healUnit(ally, amount, events, { aura: false });
    const G = cleric.def.passive && cleric.def.passive.grace;
    if (G && G.selfBuff && ally !== cleric && got > 0) this.applyStatus(cleric, { status: 'buff', durationMs: G.selfBuff.durationMs, mods: G.selfBuff.mods }, cleric, 'grace', events);
    return got;
  }

  // HOLY NOVA (skill `holyNova: { heal, radius, damageMultiplier, healSharePercent }`): heals the most hurt hero, and
  // every enemy within `radius` of THAT hero takes holy damage = damageMultiplier + healSharePercent% of the heal (so it
  // grows with her healing). No on-hit items.
  holyNova(hero, skill, slotId, ally, events) {
    const N = skill.holyNova;
    if (!ally) return;
    const raw = this.healAmount(hero, ally, N.heal) * this.regenAura().factor;
    this.clericHeal(hero, ally, raw, events);
    const zone = { shape: 'circle', x: ally.x, y: ally.y, radius: N.radius, ySquash: 0.7 };
    const foes = this.enemies.filter((e) => e.alive && (!this.hasPositions(e) || !this.hasPositions(ally) || this.inZone(e, zone)));
    events.push({ type: 'wave', unit: hero, skill, wave: 0, waves: 1, targets: foes, zone: this.hasPositions(ally) ? zone : null });
    const mult = N.damageMultiplier + ((N.healSharePercent / 100) * raw) / Math.max(1, hero.stats.attack);
    for (const e of foes) this.skillHit(hero, { damageType: skill.damageType, damageMultiplier: mult }, slotId, e, events);
  }

  // Berserker's BLOODTHIRST (passive.bloodthirst): below `belowPercent` health he gets +`attackPercent`% attack and
  // x`lifestealMultiplier` lifesteal (`hero.thirst`, statUpkeep / afterHit); it LINGERS `lingerMs` after he heals back
  // above, so lifesteal does not switch it off at once.
  tickBloodthirst(hero, dt, events) {
    const B = hero.def.passive && hero.def.passive.bloodthirst;
    if (!B) return;
    if (hero.hp < (hero.maxHp * B.belowPercent) / 100) hero.thirstLinger = B.lingerMs;
    else if (hero.thirstLinger > 0) hero.thirstLinger -= dt;
    const on = hero.thirstLinger > 0;
    if (on === !!hero.thirst) return;
    hero.thirst = on;
    if (on) events.push({ type: 'proc', unit: hero, label: 'Bloodthirst!' });
    this.refreshStats();
  }

  // Bard v3: a song plays only `songs.durationMs`, then stops (no song until the next Change Song).
  tickSong(hero, dt, events) {
    if (!hero.song || !hero.songLeft) return;
    hero.songLeft -= dt;
    if (hero.songLeft > 0) return;
    hero.songLeft = 0;
    hero.song = null;
    events.push({ type: 'song', unit: hero, song: null });
    this.refreshStats();
  }

  // MARCH (`songs.march.procChancePercent`): item procs of the squad are likelier while it plays.
  marchProcs() {
    let p = 0;
    for (const b of this.bards()) if (b.song === 'march') p += b.def.passive.songs.march.procChancePercent || 0;
    return 1 + p / 100;
  }

  // BALLAD (`songs.ballad.healPercent`): item healing (heals, lifesteal, item regen) is stronger while it plays.
  balladHeal() {
    let p = 0;
    for (const b of this.bards()) if (b.song === 'ballad') p += b.def.passive.songs.ballad.healPercent || 0;
    return 1 + p / 100;
  }

  // Bard's HYMN (`passive.hymn.squadItemMultiplier`): squad items (items.json type 'squad') work this much
  // stronger while he lives (computeHeroStats scales their effects).
  squadItemMult() {
    let m = 1;
    for (const h of this.heroes) if (h.alive && h.def.passive && h.def.passive.hymn) m *= h.def.passive.hymn.squadItemMultiplier;
    return m;
  }

  // Bard's LUTE (`passive.lute`): every `everyMs` of a floor's fight he plays a random boost for the whole squad.
  tickLute(hero, dt, events) {
    const L = hero.def.passive && hero.def.passive.lute;
    if (!L) return;
    hero.floor.lute = (hero.floor.lute || 0) + dt;
    if (hero.floor.lute < L.everyMs) return;
    hero.floor.lute -= L.everyMs;
    const boost = L.boosts[Math.floor(this.rng() * L.boosts.length)];
    events.push({ type: 'lute', unit: hero, boost: boost.name, color: boost.color });
    for (const u of this.squadUnits()) {
      if (boost.mods) this.applyStatus(u, { status: 'buff', durationMs: L.durationMs, mods: boost.mods }, hero, 'lute', events);
      if (boost.regenPercentPerSec) this.applyStatus(u, { status: 'regenBoost', durationMs: L.durationMs, percentMaxHpPerSec: boost.regenPercentPerSec }, hero, 'lute', events);
    }
  }

  // Mage's REACTIONS (passive.reactions, while the Mage lives): a fire / ice / electric hit leaves that element
  // on the enemy (status 'element'); a DIFFERENT element on top reacts (and uses the mark up):
  //   fire + ice = steam (`steam` statuses: Blind), ice + electric = shatter (this hit +`shatterPercent`%),
  //   fire + electric = overload (`overload`: a fire burst on the enemies around it).
  // Returns { damagePercent, overload } for the hit that is about to land.
  reaction(attacker, target, type, events) {
    const out = { damagePercent: 0, overload: null };
    // Arcane Ward's TEAM ELEMENTS (`teamElements`): for a while every squad hit that has no element leaves a random one.
    if (attacker.side === 'hero' && this.teamElementsMs > 0 && !['fire', 'ice', 'electric'].includes(type)) type = ['fire', 'ice', 'electric'][Math.floor(this.rng() * 3)];
    if (attacker.side !== 'hero' || target.side !== 'enemy' || !['fire', 'ice', 'electric'].includes(type)) return out;
    const mage = this.heroes.find((h) => h.alive && h.def.passive && h.def.passive.reactions);
    if (!mage) return out;
    const R = mage.def.passive.reactions;
    const mark = target.statuses.find((st) => st.type === 'element');
    if (mark && mark.element !== type) {
      target.statuses.splice(target.statuses.indexOf(mark), 1);
      events.push({ type: 'status', unit: target, change: 'expire', status: mark });
      const pair = [mark.element, type].sort().join('+');
      const kind = pair === 'fire+ice' ? 'steam' : pair === 'electric+ice' ? 'shatter' : 'overload';
      events.push({ type: 'reaction', unit: target, kind, attacker });
      if (kind === 'steam') for (const spec of R.steam) this.applyStatus(target, spec, mage, 'steam', events);
      if (kind === 'shatter') out.damagePercent = R.shatterPercent;
      if (kind === 'overload') out.overload = R.overload;
      return out;
    }
    if (mark) target.statuses.splice(target.statuses.indexOf(mark), 1);
    this.applyStatus(target, { status: 'element', durationMs: R.markMs }, mage, 'element', events);
    const st = target.statuses.find((x) => x.type === 'element');
    if (st) st.element = type;
    return out;
  }

  // Samurai's IAIDO (passive.iaido): every `every`th hit he takes is parried. A parried, blocked or dodged
  // hit is answered with a counter-cut (`counterMultiplier`, a basic melee hit: his on-hit items can go off).
  iaido(target) {
    return (target.def.passive && target.def.passive.iaido) || null;
  }

  counterCut(samurai, attacker, events) {
    const ia = this.iaido(samurai);
    if (!ia || !samurai.alive || !attacker.alive || this.isStunned(samurai)) return;
    // Counter Stance (`parry` status): the parried hit is THROWN BACK, whatever the distance.
    const stance = this.has(samurai, 'parry');
    if (!stance && this.hasPositions(samurai) && this.hasPositions(attacker) && !this.inReach(samurai, attacker)) return; // too far to cut back
    events.push({ type: 'proc', unit: samurai, label: 'Counter!' });
    // v3 `counterCrit`: the counter-cut is a sure crit, so it uses his CRIT DAMAGE.
    const res = this.strike(samurai, attacker, events, { multiplier: ia.counterMultiplier, counter: true, critBonus: ia.counterCrit ? 100 : 0, ...(stance && !this.inReach(samurai, attacker) ? { projectile: 'crescent' } : {}) });
    this.rollProcs(samurai, 'onAttack', events, { target: attacker, hit: !res.dodged });
  }

  // ---- passives that change over time or need a living hero --------------------------------------
  // Cleric: while she lives, every hero regenerates `baseRegenPercentPerSec` and regen/heals from items
  // are `healMultiplierPercent` stronger. Returns { base, factor }.
  regenAura() {
    let base = 0;
    let mult = 0;
    for (const h of this.heroes) {
      const a = h.alive && h.def.passive && h.def.passive.regenAura;
      if (!a) continue;
      base += a.baseRegenPercentPerSec;
      mult += a.healMultiplierPercent;
    }
    return { base, factor: (1 + mult / 100) * this.balladHeal() }; // Bard's Ballad: item heals stronger too
  }

  // Alchemist: while he lives, debuffs on enemies last longer and damage over time hits harder.
  catalyst() {
    let dur = 0;
    let dot = 0;
    for (const h of this.heroes) {
      const c = h.alive && h.def.passive && h.def.passive.catalyst;
      if (!c) continue;
      dur += c.durationPercent;
      dot += c.dotPercent;
    }
    return { dur: 1 + dur / 100, dot: 1 + dot / 100 };
  }

  // Martyr's Shield: 8% (fixed) that a living hero holding it, who is not the target and is off cooldown, steps in.
  martyrFor(target) {
    for (const h of this.heroes) {
      if (h === target || !h.alive || !h.specials.martyr || (h.floor.martyrCd || 0) > 0) continue;
      if (this.rng() * 100 < h.specials.martyr) return h;
    }
    return null;
  }

  // Martyr's cooldown in ms: 6s, 20% shorter for every extra copy.
  martyrCooldown(copies) {
    return 6000 * Math.pow(0.8, copies - 1);
  }

  // Spite Mail: while the holder has a taunted enemy (it taunted one that still lives) he gets +defense and reflect.
  tickTaunting(hero) {
    if (!hero.specials || !hero.specials.spiteMail) {
      if (hero.taunting) hero.taunting = false;
      return;
    }
    const now = this.enemies.some((e) => e.alive && this.tauntedBy(e) === hero);
    if (now !== hero.taunting) {
      hero.taunting = now;
      this.refreshStats();
    }
  }

  // Archer: after `afterMs` without being hit he gets attack speed and crit (hero.steady) until hit again.
  tickSteadyAim(hero, dt) {
    const sa = hero.def.passive && hero.def.passive.steadyAim;
    if (!sa) return;
    hero.sinceHit += dt;
    const steady = hero.sinceHit >= sa.afterMs;
    if (steady !== hero.steady) {
      hero.steady = steady;
      this.refreshStats();
    }
  }

  // ---- Opportunist (the Rogue's passive: def.passive.opportunist) ---------------------------------
  opportunist(unit) {
    return (unit.def.passive && unit.def.passive.opportunist) || null;
  }

  // Passives that make the unit's own chance-based debuffs likelier (Rogue's Opportunist, Samurai's Focused Strike).
  debuffBoost(unit) {
    const p = unit.def.passive;
    return (p && ((p.opportunist && p.opportunist.debuffChancePercent) || (p.focusedStrike && p.focusedStrike.debuffChancePercent))) || 0;
  }

  // Has the unit any harmful status (statuses.json `debuff: true`)?
  isDebuffed(unit) {
    return unit.statuses.some((st) => this.statusDefs[st.type] && this.statusDefs[st.type].debuff);
  }

  // The chance (in %) that one of the unit's own CHANCE-based debuffs goes off: the Rogue gets a bonus.
  debuffChance(unit, chance) {
    return chance * (1 + this.debuffBoost(unit) / 100);
  }

  // ---- "every Nth attack" counters (a hero def can have `counter`) ----------------------------------
  // counter: { id, label, color, every (4), scope: 'self' | 'squad', effect: 'empower' | 'heal',
  //   firedLabel, strike {damageMultiplier, damageType}, apply [status specs], forceProcs,
  //   heal { percentMaxHp, attackMultiplier } }.
  //  - scope 'self' counts the holder's own basic attacks, 'squad' counts the basic attacks of every
  //    living hero of the squad (not skills, not minions). A dead holder counts nothing.
  //  - The count is kept for the whole run (it does not reset between floors).
  //  - 'empower': when the count reaches `every` that attack also gets a free extra hit (`strike`) and
  //    debuffs (`apply`); `forceProcs` makes the attacker's on-hit item procs all go off.
  //  - 'heal': that attack heals the lowest-health ally instead of hitting. If nobody is hurt it hits
  //    normally and the counter stays charged until somebody is.
  // Returns the counters that fired on this attack ({ holder, counter }), and sends a `beat` event for
  // every counted attack (the scene shows the count).
  countBeats(unit, events, target = null) {
    const fired = [];
    if (unit.side !== 'hero' || unit.minion) return fired; // minions never count
    for (const holder of this.heroes) {
      const c = holder.def.counter;
      if (!c || !holder.alive) continue;
      if (c.scope === 'squad' ? false : holder !== unit) continue;
      if (holder.counterCount >= c.every) {
        // Already charged and waiting (a heal with nobody hurt): this attack tries again, no new count.
        if (c.effect === 'heal' && this.lowestHealthAlly()) {
          holder.counterCount = 0;
          fired.push({ holder, counter: c });
          events.push({ type: 'beat', unit, holder, counter: c, count: c.every, fired: true, target });
        }
        continue;
      }
      holder.counterCount++;
      const hit = holder.counterCount >= c.every;
      if (hit && c.effect === 'heal' && !this.lowestHealthAlly()) {
        events.push({ type: 'beat', unit, holder, counter: c, count: holder.counterCount, fired: false });
        continue; // charged, waiting for somebody to be hurt
      }
      if (hit) holder.counterCount = 0;
      const element = hit && c.rotation ? c.rotation[(holder.beatsFired || 0) % c.rotation.length] : null;
      if (element) holder.beatsFired = (holder.beatsFired || 0) + 1;
      if (hit) fired.push({ holder, counter: c, element });
      events.push({ type: 'beat', unit, holder, counter: c, count: hit ? c.every : holder.counterCount, fired: hit, target, color: element && element.color });
    }
    return fired;
  }

  // Heroes and minions that are alive: what squad-wide buffs and effects reach.
  squadUnits() {
    return [...this.heroes.filter((h) => h.alive), ...this.minions.filter((m) => m.alive)];
  }

  // Removes `count` debuffs from a unit: each one is a whole KIND (all stacks of poison, say), the oldest
  // first. Which statuses are debuffs: statuses.json `debuff: true`.
  cleanse(unit, count, events) {
    for (let i = 0; i < count; i++) {
      const bad = unit.statuses.find((st) => this.statusDefs[st.type] && this.statusDefs[st.type].debuff);
      if (!bad) return;
      const gone = unit.statuses.filter((st) => st.type === bad.type);
      unit.statuses = unit.statuses.filter((st) => st.type !== bad.type);
      if (this.statusDefs[bad.type].dot) delete unit.dotClocks[bad.type];
      for (const st of gone) events.push({ type: 'status', unit, change: 'expire', status: st });
      events.push({ type: 'proc', unit, label: 'Cleansed!' });
    }
  }

  // The living hero with the lowest health % that is actually hurt, or null.
  lowestHealthAlly() {
    let best = null;
    for (const h of this.heroes) {
      if (!h.alive || h.hp >= h.maxHp) continue;
      if (!best || h.hp / h.maxHp < best.hp / best.maxHp) best = h;
    }
    return best;
  }

  // The Cleric's beat: heal the most hurt ally (percentMaxHp of THEIR health + attackMultiplier x the
  // caster's attack). Returns false if nobody is hurt.
  fireHeal(holder, counter, events) {
    const ally = this.lowestHealthAlly();
    if (!ally) return false;
    const h = counter.heal || {};
    const amount = Math.max(1, Math.round(((h.percentMaxHp || 0) * ally.maxHp) / 100 + (h.attackMultiplier || 0) * holder.stats.attack));
    this.healUnit(ally, amount, events, { aura: false });
    return true;
  }

  // One hit: damage, block cooldown, lifesteal/thorns/crit debuffs, death. Used by basic attacks,
  // skills and item procs. opts: multiplier, damageType (see computeDamage), skill (the skill def),
  // basic (a hero's/enemy's normal attack, not a skill or item hit),
  // projectile ('bomb', 'lightning': the scene draws it flying from the attacker).
  strike(attacker, target, events, opts = {}) {
    // Out of reach (Morthul's dust, Vharox in the sky): the hit just misses.
    if (target.side === 'enemy' && this.untargetable(target)) {
      const miss = { dodged: true, missed: true, crit: false, amount: 0, mult: 1 };
      events.push({ type: 'attack', attacker, target, result: miss, skill: opts.skill, damageType: opts.damageType || attacker.damageType, basic: !!opts.basic });
      return miss;
    }
    // Martyr's Shield: when an enemy hits a hero, another hero holding it may take the hit instead.
    if (attacker.side === 'enemy' && target.side === 'hero' && !target.minion) {
      const martyr = this.martyrFor(target);
      if (martyr) {
        target = martyr;
        events.push({ type: 'proc', unit: martyr, label: 'Martyr!', itemId: 'martyrs_shield' });
        const copies = martyr.specials.martyrCopies || 1;
        martyr.floor.martyrCd = this.martyrCooldown(copies); // no health cost any more (phase H); the item gives defense instead
      }
    }
    // Opportunist (Rogue): more damage and crit against enemies that have any debuff.
    // Focus Stance (Samurai): his next BASIC attack is a sure crit, then the status is used up.
    if (opts.basic) {
      const sure = attacker.statuses.find((st) => st.type === 'guaranteedCrit');
      if (sure) {
        opts = { ...opts, critBonus: (opts.critBonus || 0) + 100 };
        attacker.statuses.splice(attacker.statuses.indexOf(sure), 1);
        events.push({ type: 'status', unit: attacker, change: 'expire', status: sure });
      }
    }
    // Item damage bonuses of the attacker (Sucker Punch, Full Vigor, Brawler's Streak...).
    const bonus = this.itemDamageBonus(attacker, target, opts);
    if (bonus) opts = { ...opts, damagePercent: (opts.damagePercent || 0) + bonus };
    const op = this.opportunist(attacker);
    if (op && this.isDebuffed(target)) opts = { ...opts, damagePercent: (opts.damagePercent || 0) + op.damagePercent, critBonus: (opts.critBonus || 0) + op.critFlat };
    // Mage's reactions: a different element on top of the last one.
    const react = this.reaction(attacker, target, opts.damageType || attacker.damageType, events);
    if (react.damagePercent) opts = { ...opts, damagePercent: (opts.damagePercent || 0) + react.damagePercent };
    // Samurai's Iaido: every Nth hit on him is parried outright.
    const ia = attacker.side === 'enemy' ? this.iaido(target) : null;
    let forced = false;
    if (ia && target.alive) { target.iaidoHits++; forced = target.iaidoHits % ia.every === 0; }
    // Rogue's DIRTY FIGHTING (passive.dirtyFighting): an enemy he has debuffed misses some of its attacks on HIM.
    const dirty = attacker.side === 'enemy' && target.def.passive && target.def.passive.dirtyFighting;
    if (dirty && attacker.debuffedBy && attacker.debuffedBy.has(target.uid)) opts = { ...opts, extraMissPercent: (opts.extraMissPercent || 0) + dirty.missPercent };
    const result = forced ? { dodged: true, blocked: true, parried: true, crit: false, amount: 0, mult: 1 } : computeDamage(attacker, target, this.rules, this.damageTypes, this.rng, opts);
    if (!result.dodged && attacker.side === 'enemy' && target.side === 'hero') result.amount = this.interceptHit(attacker, target, result.amount, events); // Knight takes his share
    if (!result.dodged && target.side === 'enemy') {
      result.amount = this.plateHit(target, result.amount, opts.damageType || attacker.damageType, events); // Frost Warden's ice plates
      this.heatFromHit(target, opts.damageType || attacker.damageType, events); // Ignatius: fire heats him, ice cools him
    }
    if (!result.dodged) for (const [itemId, label] of this.bonusItems || []) events.push({ type: 'proc', unit: attacker, label, itemId, target });
    // Tough Skin: EVERY hit the holder takes deals `toughSkin` less (2 per copy), never below 1. Silent (no icon pop).
    if (!result.dodged && target.side === 'hero' && target.specials.toughSkin && result.amount > 1) {
      result.amount = Math.max(1, Math.round(result.amount - target.specials.toughSkin));
    }
    // Mirror Buckler: a RANGED or MAGIC enemy hit on the holder may bounce back at the attacker (the holder takes nothing).
    if (!result.dodged && attacker.side === 'enemy' && target.side === 'hero' && !target.minion && attacker.alive && this.mirrorBounce(attacker, target, result, opts, events)) return result;
    let dealt = null;
    if (!result.dodged) {
      dealt = this.dealDamage(target, result.amount, events);
      if (dealt.immune) {
        // Invulnerable: the hit does nothing at all (like a block: no lifesteal, thorns, debuffs).
        result.dodged = true;
        result.invulnerable = true;
        result.amount = 0;
      } else {
        result.absorbed = dealt.absorbed; // taken by shields
        if (dealt.lost === 0) result.fullyAbsorbed = true;
      }
    }
    if (!result.dodged && target.def.adapt && target.alive && target.hp > 0) this.adaptTo(target, opts.damageType || attacker.hitType || attacker.damageType, events); // Crystal Sentinel
    if (opts.projectile) events.push({ type: 'projectile', from: opts.from || attacker, to: target, kind: opts.projectile });
    events.push({ type: 'attack', attacker, target, result, skill: opts.skill, damageType: opts.damageType || attacker.damageType, basic: !!opts.basic, ghastly: !!opts.ghastly });
    if (dealt) this.breakEffects(target, dealt.broken, events);
    if (!result.dodged) this.afterItemHit(attacker, target, opts, events);
    // Ghastly Fire: the holder's fire hits also deal `ghastly`% (20 per copy) of the damage as DARK (it triggers nothing).
    const gf = attacker.side === 'hero' && !attacker.minion && attacker.specials ? attacker.specials.ghastly || 0 : 0;
    if (gf && !result.dodged && !opts.ghastly && (opts.damageType || attacker.damageType) === 'fire' && target.alive && target.hp > 0 && result.amount > 0) {
      this.strike(attacker, target, events, { multiplier: (result.amount * gf) / 100 / Math.max(1, attacker.stats.attack), damageType: 'dark', item: true, ghastly: true, burst: true });
    }
    if (!result.dodged && attacker.side === 'enemy' && target.side === 'hero') this.onHeroHit(target, events);
    if (result.blocked && target.specials.blockCooldownMs) {
      // A successful block sends the holder's Shield Totems on cooldown (only if the item has a `cooldownMs`; phase H: none).
      const spec = { status: 'blockCooldown', durationMs: target.specials.blockCooldownMs || 2500 };
      this.applyStatus(target, spec, target, 'totem', events);
    }
    // Lifesteal, thorns and crit debuffs work on the damage that really got through (nothing if a shield took it all).
    // Fire Heart: an enemy that hits the fire shield catches fire.
    if (dealt && dealt.absorbed > 0 && dealt.burnShield && attacker.alive && attacker.side === 'enemy') this.applyStatus(attacker, { status: 'burn', durationMs: 3000, damageMultiplier: 0.15, damageType: 'fire' }, target, 'fireheart', events);
    if (!result.dodged && !result.fullyAbsorbed && !opts.item) this.afterHit(attacker, target, result.amount - (result.absorbed || 0), events, result);
    const rage = attacker.def.passive && attacker.def.passive.rage;
    if (rage && !result.dodged && opts.basic) this.gainRage(attacker, rage.perHitDealt * (result.crit ? rage.critMultiplier : 1), events); // Berserker: his hits fill Rage (crits twice)
    if (react.overload && !result.dodged) {
      // Overload: a fire burst on the enemies around the target.
      const near = this.enemies.filter((e) => e.alive && e !== target && (!this.hasPositions(e) || !this.hasPositions(target) || this.distance(e, target) <= react.overload.radius));
      for (const e of near) this.strike(attacker, e, events, { multiplier: react.overload.damageMultiplier, damageType: 'fire', item: true, burst: true });
    }
    if (target.hp <= 0 && target.alive) this.killUnit(target, events, attacker);
    // Iaido: a parried / blocked / dodged hit on the Samurai is answered (not a blind miss, not his own counter).
    if (ia && result.dodged && !result.missed && !opts.counter) this.counterCut(target, attacker, events);
    return result;
  }

  // Item effects that react to a hit that connected (the attacker's items).
  //  - Shatter Hammer: the hit breaks a freeze.   - Hunter's Sigil: the first hit on each enemy Marks it.
  //  - Frozen Thunderbolt: electric hits add ice + Chill; at 3 Chill / frozen the enemy shatters into ice on it and its neighbours.
  afterItemHit(attacker, target, opts, events) {
    const sp = attacker.specials;
    if (!sp || attacker.side !== 'hero' || attacker.minion || !target.alive) return;
    if (sp.shatterHammer) {
      const freeze = target.statuses.find((st) => st.type === 'freeze');
      if (freeze) {
        target.statuses.splice(target.statuses.indexOf(freeze), 1);
        events.push({ type: 'status', unit: target, change: 'expire', status: freeze });
        events.push({ type: 'proc', unit: attacker, label: 'Shatter!', itemId: 'shatter_hammer', target });
      }
    }
    if (sp.hunterSigil && !attacker.sigilHits.has(target.uid) && target.side === 'enemy') {
      attacker.sigilHits.add(target.uid);
      const copies = Math.max(1, attacker.items.filter((id) => id === 'hunters_sigil').length);
      this.applyStatus(target, { status: 'mark', durationMs: 5000 + 2500 * (copies - 1), damageTakenPercent: sp.hunterSigil }, attacker, `sigil_${attacker.uid}`, events);
    }
    if (sp.frozenThunderbolt && (opts.damageType || attacker.damageType) === 'electric' && !opts.burst) {
      // Frozen Thunderbolt: every electric hit adds a small ICE hit and 1 Chill; at `thunderShatterAt` Chill (or Frozen)
      // the target shatters: an ice burst on it and its neighbours, the cold is used up.
      if (sp.thunderIce) this.strike(attacker, target, events, { multiplier: sp.thunderIce / 100, damageType: 'ice', item: true, burst: true });
      if (target.alive) this.applyStatus(target, { status: 'chill', durationMs: 5000 }, attacker, 'thunderbolt', events);
      const cold = target.statuses.filter((st) => st.type === 'chill' || st.type === 'freeze');
      if (target.alive && (cold.some((st) => st.type === 'freeze') || this.stacks(target, 'chill') >= (sp.thunderShatterAt || 3))) {
        events.push({ type: 'proc', unit: attacker, label: 'Thunderbolt!', itemId: 'frozen_thunderbolt', target });
        for (const e of [target, ...this.neighbours(target)]) if (e.alive) this.strike(attacker, e, events, { multiplier: sp.frozenThunderbolt / 100, damageType: 'ice', item: true, burst: true });
        for (const st of cold) {
          const i = target.statuses.indexOf(st);
          if (i < 0) continue; // already gone (Shatter Hammer broke the freeze)
          target.statuses.splice(i, 1);
          events.push({ type: 'status', unit: target, change: 'expire', status: st });
        }
      }
    }
  }

  // Extra damage % from the ATTACKER's item specials for this hit.
  //  - suckerPunch: the first BASIC attack on each enemy.   - fullVigor: while the attacker is above 90% health.
  //  - brawlerMax: +2% per basic hit in a row (any enemy), up to the item's max; lost on stun/freeze/fear.
  itemDamageBonus(attacker, target, opts) {
    const sp = attacker.specials;
    this.bonusItems = []; // items that boosted this hit (the scene shows them: Sucker Punch, Executioner's Axe)
    if (!sp || attacker.side !== 'hero' || attacker.minion) return 0;
    let bonus = 0;
    if (opts.basic) {
      if (sp.suckerPunch && !attacker.firstHits.has(target.uid)) { bonus += sp.suckerPunch; this.bonusItems.push(['sucker_punch_glove', 'Sucker Punch!']); }
      attacker.firstHits.add(target.uid);
      if (sp.brawlerMax) {
        const st = attacker.streak;
        // A COMBO of the holder's basic hits on ANY enemy; lost when the holder is stunned, frozen or feared (applyStatus).
        bonus += Math.min(sp.brawlerMax, st.count * 2);
        attacker.streak = { uid: target.uid, count: st.count + 1 };
      }
    }
    if (sp.fullVigor && attacker.hp >= attacker.maxHp * 0.9) bonus += sp.fullVigor; // Full Vigor: above 90% health
    // Bonuses against what the target is suffering from or how hurt it is.
    const kinds = new Set(target.statuses.filter((st) => this.statusDefs[st.type] && this.statusDefs[st.type].debuff).map((st) => st.type));
    if (sp.magmaCore && kinds.has('burn')) bonus += sp.magmaCore; // Magma Core
    if (sp.bloodChalice && kinds.has('bleed')) bonus += sp.bloodChalice; // Blood Chalice
    if (sp.shatterHammer && kinds.has('freeze')) bonus += sp.shatterHammer; // Shatter Hammer (the freeze is broken after the hit)
    else if (sp.shatterChill && kinds.has('chill')) bonus += sp.shatterChill; // ...and a smaller bonus vs chilled enemies
    if (sp.exploiter && kinds.size >= 3) bonus += sp.exploiter; // Exploiter's Lens
    if (sp.executioner && target.hp < target.maxHp * 0.25) { bonus += sp.executioner; this.bonusItems.push(['executioners_axe', 'Execute!']); } // Executioner's Axe
    if (sp.hornDamage && this.has(target, 'taunt')) bonus += sp.hornDamage; // Provoker's Horn: taunted enemies take more
    if (sp.spotter && (this.focusUid === target.uid || this.heroes.some((h) => h.alive && h.order === target.uid))) bonus += sp.spotter; // Spotter's Lens: the TAPPED (or drag-ordered) enemy takes more from the squad
    if (sp.bossDamage && target.def.boss) bonus += sp.bossDamage; // Giantslayer's Brand
    return bonus;
  }

  // Items with a chance effect (e.g. War Banner): each copy rolls separately every time the
  // trigger happens. ctx.target is the enemy that was just attacked. A proc can:
  //   doubleHit  - hit the same target once more (Quick Gloves)
  //   strike     - an extra hit { damageMultiplier, damageType, projectile } (Fire Bombs, Chill Band)
  //   chain      - a bolt that jumps to other enemies { jumps, damageMultiplier, damageType } (Static Crystal)
  //   apply      - give statuses to `targets`: self, squad or target (the hit enemy; only if the attack connected)
  //   silent     - no popup (for effects that go off on every attack)
  rollProcs(hero, trigger, events, ctx = {}) {
    if (hero.side !== 'hero' || !hero.alive) return;
    for (const proc of [...hero.procs]) {
      const debuffs = (proc.apply || []).some((sp) => (sp.to === 'target' || (!sp.to && proc.targets === 'target')) && this.statusDefs[sp.status] && this.statusDefs[sp.status].debuff);
      const base = String(proc.itemId).startsWith('passive_') ? proc.chance : proc.chance * this.marchProcs(); // Bard's March: item procs likelier
      const chance = (debuffs ? this.debuffChance(hero, base) : base) * (ctx.chanceMult || 1); // Opportunist: his debuffs are likelier; Savage Leap: x chanceMult
      if (proc.meleeOnly && hero.damageType !== 'melee') continue; // Thousand Cuts: melee hits only
      if (proc.rangedOnly && hero.damageType === 'melee') continue; // Moonlight Twinblade: ranged attacks only
      if (proc.proc !== trigger || (!ctx.force && this.rng() * 100 >= chance)) continue; // ctx.force: every proc goes off
      const enemy = ctx.target && ctx.target.alive ? ctx.target : null;
      let landed = ctx.hit !== false; // statuses on the target need the attack to have connected
      // Damage from a proc (extra hit, bomb, bolt, tornado) is never wasted: if the attack just killed its
      // enemy it goes to the enemy nearest to it instead. Statuses on the target still need the hit enemy.
      const foe = enemy || (ctx.target ? this.nearest(ctx.target, this.targetableEnemies()) : null);
      const damages = !!(proc.doubleHit || proc.strike || proc.chain || proc.tornado || proc.flameSpirit || proc.moonlight);
      const targets = proc.targets === 'squad' ? this.squadUnits() : proc.targets === 'target' ? (enemy && landed ? [enemy] : []) : [hero];
      // A status spec can pick its own receivers with `to` (self / squad / target), e.g. a proc that taunts
      // the enemy hit AND gives the holder a defense buff.
      let ally; // Jolly Banner: the holder and ONE random other living hero (picked once per proc)
      const receivers = (to) => (to === 'selfAndAlly' ? (ally = ally || this.randomAlly(hero), ally ? [hero, ally] : [hero]) : to === 'squad' ? this.squadUnits() : to === 'target' ? (enemy && landed ? [enemy] : []) : to === 'self' ? [hero] : targets);
      // A proc that can't do anything (its enemy died or the attack missed) doesn't go off at all, so its
      // icon never pops for nothing.
      if (!(damages && foe) && !(proc.apply || []).some((spec) => receivers(spec.to).length)) continue;
      if (!proc.silent) events.push({ type: 'proc', unit: hero, label: proc.label, itemId: proc.itemId, target: foe || ctx.target || null });
      if (proc.doubleHit && foe) { const dh = this.strike(hero, foe, events); if (!dh.dodged) this.addCombo(hero, foe, 1, events); }
      if (debuffs && enemy && ctx.hit !== false && !String(proc.itemId).startsWith('passive_')) this.addCombo(hero, enemy, 1, events); // Rogue: a debuff item proc = a combo point
      if (proc.strike && foe) {
        const hit = this.strike(hero, foe, events, {
          multiplier: proc.strike.damageMultiplier,
          damageType: proc.strike.damageType,
          projectile: proc.strike.projectile,
          item: true, // damage made BY an item never triggers lifesteal, thorns or other item effects
        });
        landed = foe === enemy && !hit.dodged;
      }
      const extra = (proc.copies || 1) - 1;
      // Static Crystal: +`jumpsPerExtra` jumps per extra crystal.
      if (proc.chain && foe) this.chainHit(hero, foe, proc.chain.jumpsPerExtra ? { ...proc.chain, jumps: proc.chain.jumps + proc.chain.jumpsPerExtra * extra } : proc.chain, events);
      // Excalibur: tornadoes hit `damagePerExtraPercent` harder per extra copy. A tornado also comes on a miss.
      if (proc.flameSpirit && foe) this.conjureSpirit(hero, events, proc.damageMultiplier || 0.8);
      if (proc.moonlight && foe) this.moonCrescent(hero, foe, proc.copies || 1, events, proc.hitMultiplier);
      if (proc.tornado && foe) this.spawnTornado(hero, proc.tornado.damagePerExtraPercent ? { ...proc.tornado, damageMultiplier: proc.tornado.damageMultiplier * (1 + (proc.tornado.damagePerExtraPercent * extra) / 100) } : proc.tornado, foe, events);
      for (const spec of proc.apply || []) {
        // scalesWithCopies: the status gets stronger with every copy of the item held; `damagePerExtraPercent`:
        // +that % per extra copy (Ember Charm's burn +10% per extra charm).
        let real = spec.scalesWithCopies ? { ...spec, damageMultiplier: spec.damageMultiplier * (proc.copies || 1) } : spec;
        if (spec.damagePerExtraPercent) real = { ...real, damageMultiplier: spec.damageMultiplier * (1 + (spec.damagePerExtraPercent * ((proc.copies || 1) - 1)) / 100) };
        if (spec.durationPerCopyMs) real = { ...real, durationMs: spec.durationMs + spec.durationPerCopyMs * ((proc.copies || 1) - 1) }; // Jolly Banner: longer with every extra copy
        for (const target of receivers(spec.to)) this.applyStatus(target, real, hero, `proc_${proc.itemId}`, events);
      }
    }
  }

  // Excalibur: a tornado lives `durationMs`, hits its enemy every `tickMs` (item damage) and drifts to another
  // random living enemy every `hopEvery` ticks. At most `max` at once: a new one pushes the oldest out.
  spawnTornado(hero, spec, enemy, events) {
    const mine = this.tornados.filter((t) => t.holder === hero);
    if (this.tornados.length >= spec.max) {
      const old = this.tornados.shift();
      events.push({ type: 'tornadoEnd', tornado: old });
    }
    const t = { id: this.nextUid++, holder: hero, remaining: spec.durationMs, tick: spec.tickMs, ticks: 0, target: enemy, spec };
    this.tornados.push(t);
    events.push({ type: 'tornadoSpawn', tornado: t, target: enemy });
    return mine;
  }

  tickTornados(dt, events) {
    for (const t of [...this.tornados]) {
      t.remaining -= dt;
      t.tick -= dt;
      while (t.tick <= 0 && t.remaining > -t.spec.tickMs) {
        t.tick += t.spec.tickMs;
        if (!t.holder.alive || !t.target.alive || this.untargetable(t.target)) {
          const alive = this.targetableEnemies();
          if (!alive.length) break;
          t.target = alive[Math.floor(this.rng() * alive.length)];
          events.push({ type: 'tornadoMove', tornado: t, target: t.target });
        }
        this.strike(t.holder, t.target, events, { multiplier: t.spec.damageMultiplier, damageType: t.spec.damageType, item: true });
        t.ticks++;
        if (t.spec.hopEvery && t.ticks % t.spec.hopEvery === 0) {
          const others = this.targetableEnemies().filter((e) => e !== t.target);
          if (others.length) {
            t.target = others[Math.floor(this.rng() * others.length)];
            events.push({ type: 'tornadoMove', tornado: t, target: t.target });
          }
        }
        if (t.remaining <= 0) break;
      }
      if (t.remaining <= 0 || !this.enemies.some((e) => e.alive)) {
        this.tornados = this.tornados.filter((x) => x !== t);
        events.push({ type: 'tornadoEnd', tornado: t });
      }
    }
  }

  // One random living hero other than `hero` (undefined if he is alone).
  randomAlly(hero) {
    const others = this.heroes.filter((h) => h.alive && h !== hero);
    return others[Math.floor(this.rng() * others.length)];
  }

  // Slot neighbours of an enemy: the living enemies standing right next to it.
  neighbours(enemy) {
    const i = this.enemies.indexOf(enemy);
    return [this.enemies[i - 1], this.enemies[i + 1]].filter((e) => e && e.alive);
  }

  // A bolt hits `first`, then jumps `jumps` more times to the closest enemies not hit yet.
  // `skipFirst`: `first` was already hit (a Wisp's own bolt), only the jumps deal damage.
  chainHit(hero, first, chain, events) {
    const hit = new Set([first]);
    let from = hero;
    let target = first;
    for (let jump = 0; target; jump++) {
      if (jump === 0 && chain.skipFirst) {
        if (chain.jumps < 1) break;
        from = target;
        const here0 = this.enemies.indexOf(from);
        target = this.enemies.filter((e) => e.alive && !hit.has(e)).sort((a, b) => Math.abs(this.enemies.indexOf(a) - here0) - Math.abs(this.enemies.indexOf(b) - here0))[0];
        if (target) hit.add(target);
        continue;
      }
      const res = this.strike(hero, target, events, { multiplier: chain.damageMultiplier, damageType: chain.damageType, projectile: 'lightning', from, item: true });
      if (!res.dodged && target.alive) for (const spec of chain.apply || []) this.applyStatus(target, spec, hero, 'chain', events); // Static Crystal: Shock on every enemy hit
      if (jump >= chain.jumps) break;
      from = target;
      const here = this.enemies.indexOf(from);
      const next = this.enemies.filter((e) => e.alive && !hit.has(e)).sort((a, b) => Math.abs(this.enemies.indexOf(a) - here) - Math.abs(this.enemies.indexOf(b) - here))[0];
      if (next) hit.add(next);
      target = next;
    }
  }

  // Item specials that trigger when a hit lands: lifesteal heals the attacker, thorns reflects
  // some of a MELEE hit back at the attacker.
  afterHit(attacker, target, amount, events, result = {}) {
    const lifesteal = ((attacker.specials && attacker.specials.lifesteal) || 0) * (attacker.thirst ? attacker.def.passive.bloodthirst.lifestealMultiplier : 1); // Bloodthirst: doubled
    if (lifesteal > 0 && attacker.alive) {
      const base = Math.max(1, Math.round(((amount * lifesteal) / 100) * (attacker.side === 'hero' ? this.regenAura().factor : 1))); // the Cleric's aura makes item heals stronger (not an elite's)
      if (this.healUnit(attacker, base, events, { aura: false }) > 0) {
        events.push({ type: 'lifesteal', unit: attacker, from: target }); // drawn as drops flying back
        if (attacker.def.passive && attacker.def.passive.rage) this.gainRage(attacker, attacker.def.passive.rage.perHitDealt, events); // lifesteal fills Rage twice as fast
      }
      // Bloodlust Mask: sometimes the heal is shared with the rest of the squad (then a cooldown).
      const share = attacker.specials.lifestealShare || 0;
      const hurt = this.heroes.filter((ally) => ally !== attacker && ally.alive && ally.hp < ally.maxHp);
      if (share > 0 && hurt.length && attacker.shareCd <= 0 && this.rng() * 100 < share) { // only when someone can use it
        attacker.shareCd = attacker.specials.lifestealShareCooldownMs || 3000;
        events.push({ type: 'proc', unit: attacker, label: 'Life Share!', itemId: 'bloodlust_mask' });
        for (const ally of hurt) this.healUnit(ally, base, events, { aura: false });
      }
    }
    // Gambler's Dice: a crit also gives the enemy a random debuff.
    const dice = attacker.specials && attacker.specials.critDebuffList;
    if (result.crit && dice && dice.length && target.alive && target.hp > 0 && this.rng() * 100 < this.debuffChance(attacker, attacker.specials.critDebuff)) {
      const spec = dice[Math.floor(this.rng() * dice.length)];
      events.push({ type: 'proc', unit: attacker, label: 'Dice!', itemId: 'gamblers_dice', target });
      this.applyStatus(target, spec, attacker, `dice_${attacker.uid}`, events);
    }
    const thorns = ((target.specials && target.specials.thorns) || 0) + (target.taunting ? target.specials.spiteReflect || 0 : 0); // Spite Mail adds reflect while taunting
    if (thorns > 0 && target.alive && target.hp > 0 && attacker.damageType === 'melee' && attacker.alive) {
      const back = Math.max(1, Math.round((amount * thorns) / 100));
      const d = this.dealDamage(attacker, back, events);
      if (!d.immune) events.push({ type: 'thorns', unit: attacker, amount: back - d.absorbed, holder: target });
      this.addGrudge(target, events);
      this.breakEffects(attacker, d.broken, events);
      if (attacker.hp <= 0 && attacker.alive) this.killUnit(attacker, events);
    }
  }

  // Knight's GRUDGE (passive.grudge): every hit he reflects (thorns, Spite Mail, Mirror Buckler) charges his next
  // Shield Bash by `perReflectPercent`, up to `maxStacks`; the Bash uses the charge up (skillHit, `grudgeCharged`).
  addGrudge(holder, events) {
    const g = holder.def && holder.def.passive && holder.def.passive.grudge;
    if (!g || !holder.alive) return;
    const was = holder.grudge || 0;
    holder.grudge = Math.min(g.maxStacks, was + 1);
    if (holder.grudge !== was) events.push({ type: 'grudge', unit: holder, stacks: holder.grudge });
  }

  // ---- shields and invulnerability ------------------------------------------------------------

  // The ONE place health is taken away by a hit, a damage-over-time tick or thorns.
  //  - Invulnerable: nothing happens (`immune`).
  //  - Shields soak damage first, oldest first. A shield with nothing left is BROKEN (collected in
  //    `broken`, callers pass it to breakEffects() once the hit has been reported).
  // Returns { lost (health lost), absorbed (taken by shields), immune, broken }.
  dealDamage(target, amount, events = null) {
    if (this.has(target, 'invulnerable')) return { lost: 0, absorbed: 0, immune: true, broken: [] };
    if (target.elite && amount > 0) target.elite.unhit = 0; // a Shielded elite's shield only regrows while it is left alone
    let left = amount;
    let absorbed = 0;
    let burnShield = false;
    const broken = [];
    for (const shield of [...target.statuses]) {
      if (shield.type !== 'shield' || left <= 0) continue;
      const take = Math.min(shield.amount, left);
      if (shield.burns) burnShield = true;
      shield.amount -= take;
      left -= take;
      absorbed += take;
      if (shield.amount <= 0) {
        target.statuses.splice(target.statuses.indexOf(shield), 1);
        broken.push(shield);
      }
    }
    if (left >= target.hp && left > 0) left = this.deathSave(target, left, events || []);
    target.hp = Math.max(0, target.hp - left);
    if (target.hp <= 0) this.phoenixSave(target, events || []); // Phoenix Feather: one feather is used up instead of dying
    if (left > 0 && target.def.passive && target.def.passive.rage) this.gainRage(target, target.def.passive.rage.perHitTaken, events); // Berserker: hits taken fill Rage
    if (left > 0 || absorbed > 0) {
      target.sinceHit = 0; // being hit resets Steady Aim
      if (target.steady) {
        target.steady = false;
        this.refreshStats();
      }
    }
    this.afterDamage(target, events);
    return { lost: left, absorbed, immune: false, broken, burnShield };
  }

  // Last Stand Banner: when a hero falls every survivor gets a shield of 20% max health and +30% attack for 8s, both per
  // banner held by living heroes (`lastStand` = copies). The holder's morale penalty shrinks too (items.js).
  lastStand(fallen, events) {
    const copies = this.heroes.filter((h) => h.alive && h !== fallen).reduce((n, h) => n + ((h.specials && h.specials.lastStand) || 0), 0);
    if (!copies) return;
    const holder = this.heroes.find((h) => h.alive && h.specials && h.specials.lastStand);
    events.push({ type: 'proc', unit: holder, label: 'Last Stand!', itemId: 'last_stand_banner' });
    for (const h of this.heroes.filter((x) => x.alive && x !== fallen)) {
      this.applyStatus(h, { status: 'shield', percentMaxHp: 20 * copies, durationMs: 8000 }, h, 'last_stand', events);
      this.applyStatus(h, { status: 'buff', durationMs: 8000, mods: [{ stat: 'attack', percent: 30 * copies }] }, h, 'last_stand', events);
    }
  }

  // Soul Lantern: every `lanternEvery` (8) enemies the squad defeats, each holder gains +1% attack and max health per
  // lantern for the rest of the run, with NO limit (`hero.lanternGain`, used in statUpkeep()).
  // Every kill feeds the lantern (`soulFeed` event: green lines swirl round the holder); every 8th pops its icon.
  soulLanternKill(events = []) {
    let changed = false;
    for (const h of this.heroes) {
      const n = h.alive && h.specials ? h.specials.soulLantern || 0 : 0;
      if (!n) continue;
      h.lanternKills = (h.lanternKills || 0) + 1;
      events.push({ type: 'soulFeed', unit: h });
      if (h.lanternKills % 8 !== 0) continue;
      events.push({ type: 'proc', unit: h, label: 'Soul Lantern!', itemId: 'soul_lantern' });
      const before = h.lanternGain || 0;
      h.lanternGain = before + n; // no limit (user's choice: legendary, offered at most once per run)
      if (h.lanternGain !== before) changed = true;
    }
    if (changed) this.refreshStats();
  }

  // Scholar's Bookmark: +`bookmark`% skill damage (4 per copy) for every page on the holder's skills, modifiers count double.
  bookmarkBonus(hero) {
    const per = (hero.specials && hero.specials.bookmark) || 0;
    if (!per) return 0;
    let pages = 0;
    for (const slot of hero.skills || []) for (const p of slot.pages || []) pages += p.kind === 'modifier' ? 2 : 1;
    return per * pages;
  }

  // Death save (combat.json deathSave), once per run per hero: the first hit that would kill only does
  // `damagePercent`% of its damage. If that still kills, the hero dies anyway. Event `deathSave` { unit, survived }.
  deathSave(target, amount, events) {
    const rule = this.rules.deathSave;
    if (!rule || target.side !== 'hero' || target.minion || !target.alive || target.deathSaveUsed) return amount;
    target.deathSaveUsed = true;
    const cut = Math.round((amount * rule.damagePercent) / 100);
    events.push({ type: 'deathSave', unit: target, survived: cut < target.hp });
    return cut;
  }

  // Phoenix Feather (used up): when the holder would die it stays at 1 health, is invulnerable for 1s and heals back up
  // to 70% of max health over 3s (a regen boost). Every feather is one more save.
  phoenixSave(target, events) {
    const sp = target.specials;
    if (target.side !== 'hero' || target.minion || !target.alive || !sp || !sp.phoenixFeather) return;
    const id = this.consumeItem(target, 'phoenixFeather');
    if (!id) return;
    target.hp = 1;
    events.push({ type: 'proc', unit: target, label: 'Phoenix!', itemId: 'phoenix_feather' });
    events.push({ type: 'itemUsed', unit: target, itemId: id });
    // 1s untouchable, then it climbs back to 70% of max health over 3s.
    this.applyStatus(target, { status: 'invulnerable', durationMs: 1000 }, target, 'phoenix_feather', events);
    this.applyStatus(target, { status: 'regenBoost', durationMs: 3000, percentMaxHpPerSec: (70 - 100 / target.maxHp) / 3 }, target, 'phoenix_feather', events);
  }

  // Mirror Buckler: `mirrorBuckler`% chance (12 per copy, stops at 60%) that a ranged/magic hit bounces back; every copy
  // past 5 makes the bounced hit 25% stronger. Returns true when it bounced (the hit is then reported as blocked).
  mirrorBounce(attacker, target, result, opts, events) {
    const sp = target.specials;
    const type = opts.damageType || attacker.damageType;
    if (!sp || !sp.mirrorBuckler || type === 'melee') return false;
    const copies = sp.mirrorBuckler / 12;
    if (this.rng() * 100 >= Math.min(60, sp.mirrorBuckler)) return false;
    const back = Math.max(1, Math.round(result.amount * (1 + 0.25 * Math.max(0, copies - 5))));
    result.dodged = true; result.blocked = true; result.reflected = true; result.amount = 0;
    events.push({ type: 'proc', unit: target, label: 'Mirror!', itemId: 'mirror_buckler', target: attacker });
    events.push({ type: 'attack', attacker, target, result, damageType: type });
    const d = this.dealDamage(attacker, back, events);
    if (!d.immune) events.push({ type: 'thorns', unit: attacker, amount: back - d.absorbed, holder: target });
    this.addGrudge(target, events);
    this.breakEffects(attacker, d.broken, events);
    if (attacker.hp <= 0 && attacker.alive) this.killUnit(attacker, events);
    return true;
  }

  // Things that react to a unit having lost health (called from dealDamage when it has an events list).
  // Aid Kit (TRIAGE): when any living hero drops below `triageBelow`% (30) health, a living holder whose kit is ready
  // patches them at once for `triage` FLAT health (15 per kit), then waits `triageCooldownMs` (10s).
  tryTriage(target, events) {
    if (target.hp <= 0) return;
    for (const h of this.heroes) {
      const sp = h.specials;
      if (!h.alive || !sp || !sp.triage || (h.triageCd || 0) > 0) continue;
      if (target.hp >= (target.maxHp * (sp.triageBelow || 30)) / 100) return;
      h.triageCd = sp.triageCooldownMs || 10000;
      events.push({ type: 'proc', unit: h, label: 'Triage!', itemId: 'aid_kit', target });
      if (h !== target) events.push({ type: 'flask', unit: h, target, flask: { color: '0xff6b6b' } }); // a red-cross kit lobbed over
      this.healUnit(target, sp.triage, events, { aura: false });
      return;
    }
  }

  afterDamage(target, events) {
    if (!events || target.side !== 'hero' || target.minion || target.hp <= 0) return;
    this.tryIntercept(target, events); // Knight: jumps in front of a hero who drops low
    this.tryTriage(target, events); // Aid Kit: patches a hero who drops low
    // Second Wind Flask: below its threshold ONE flask is used up and heals (once per floor per holder).
    const below = target.specials.secondWindBelow;
    if (target.specials.secondWind && !target.floor.flaskUsed && target.hp < (target.maxHp * below) / 100) {
      const percent = target.specials.secondWind; // read it BEFORE the flask is used up (the last one leaves no special behind)
      const id = this.consumeItem(target, 'secondWind');
      if (id) {
        target.floor.flaskUsed = true;
        events.push({ type: 'proc', unit: target, label: 'Second Wind!', itemId: 'second_wind_flask' });
        events.push({ type: 'itemUsed', unit: target, itemId: id });
        this.healUnit(target, (target.maxHp * percent) / 100 / this.regenAura().factor, events);
      }
    }
  }

  // Uses up one copy of an item that has the special `name` (a consumable). Returns its id, or null.
  consumeItem(hero, name) {
    const i = hero.items.findIndex((id) => (this.itemDefs[id].effects || []).some((e) => e.special === name));
    if (i < 0) return null;
    const [id] = hero.items.splice(i, 1);
    this.refreshStats();
    return id;
  }

  // Item reactions to a kill (killer = the unit that dealt the last blow, if known).
  // A friendly was hit by an enemy: Spirit Axe, Mimic Chest (10% a Mimic pops out of the holder).
  onHeroHit(target, events) {
    this.trySpiritAxe(target, events);
    if (!target.minion && target.alive && target.specials.mimic && this.rng() * 100 < target.specials.mimic) {
      const src = { key: 'mimic_chest', kind: 'weak', capGroup: 'items', upkeep: true, upkeepScale: this.rules.minions.upkeepWeakScale ?? 0.5, spec: { minion: 'mimic' }, copies: target.specials.mimicCopies || 1 };
      events.push({ type: 'proc', unit: target, label: 'Mimic!', itemId: 'mimic_chest' });
      this.spawnMinion(target, src, events);
    }
  }

  onKill(killer, victim, events, lastStatuses = []) {
    // Necro Crown: every enemy kill raises a skeleton (for the first living holder).
    if (this.minionBoost().crownKill) {
      const holder = this.heroes.find((h) => h.alive && h.specials.necroCrownKill);
      if (holder) this.spawnMinion(holder, { key: 'necro_crown', kind: 'weak', capGroup: 'items', upkeep: false, spec: { minion: 'skeleton' } }, events);
    }
    if (killer && killer.side === 'hero' && !killer.minion && killer.alive) {
      const heal = killer.specials.killHeal || 0; // Bandage Roll
      if (heal > 0) this.healUnit(killer, (killer.maxHp * heal) / 100 / this.regenAura().factor, events);
      // Blood Chalice: killing a BLEEDING enemy heals the killer.
      const chalice = killer.specials.chaliceHeal || 0;
      if (chalice > 0 && lastStatuses.some((st) => st.type === 'bleed')) this.healUnit(killer, (killer.maxHp * chalice) / 100 / this.regenAura().factor, events);
    }
    // Items of any living hero whose effect depends on the enemy's stacks when it dies:
    for (const hero of this.heroes) {
      if (!hero.alive) continue;
      const mine = (type) => lastStatuses.filter((st) => st.type === type && st.sourceUid === hero.uid);
      // Plague Flask: `plagueShare`% (15% per copy, can pass 100%) of the holder's poison stacks on the dead enemy spread
      // to other enemies (+1 enemy per copy).
      const plague = hero.specials.plagueFlask || 0;
      const poison = mine('poison');
      if (plague > 0 && poison.length) {
        const count = Math.max(1, Math.round((poison.length * (hero.specials.plagueShare || 50)) / 100));
        const half = Array.from({ length: count }, (_, i) => poison[i % poison.length]);
        const others = this.enemies.filter((e) => e.alive && e !== victim).sort((a, b) => this.distance(victim, a) - this.distance(victim, b)).slice(0, plague);
        if (others.length) events.push({ type: 'proc', unit: hero, label: 'Plague!', itemId: 'plague_flask', from: victim, to: others });
        for (const e of others) for (const st of half) this.addDotStack(e, st);
      }
      // Thousand Cuts: an enemy dying while bleeding bursts knives into the enemies next to it.
      const burst = hero.specials.knifeBurst || 0;
      const near = burst > 0 && mine('bleed').length ? this.neighbours(victim) : [];
      if (near.length) {
        events.push({ type: 'proc', unit: hero, label: 'Knife burst!', itemId: 'thousand_cuts', at: victim });
        for (const e of near) this.strike(hero, e, events, { multiplier: burst / 100, damageType: 'melee', item: true });
      }
    }
  }

  // Puts a copy of a damage-over-time stack on a unit (Plague Flask).
  addDotStack(unit, stack) {
    unit.statuses.push({ ...stack, key: `${stack.key}#${unit.uid}` });
    if (!(stack.type in unit.dotClocks)) unit.dotClocks[stack.type] = 0;
  }

  // A shield was broken: tell the scene, and run its `onBreak` effect if it has one
  // (Bone Ward: bone shards hit every enemy of the holder for damageMultiplier x the caster's attack).
  breakEffects(unit, broken, events) {
    for (const shield of broken) {
      events.push({ type: 'shieldBreak', unit, status: shield });
      // Spiked Aegis: a shield of the holder broken by damage explodes (item damage on every enemy).
      if (unit.side === 'hero' && !unit.minion && unit.specials.spikedAegis) {
        events.push({ type: 'proc', unit, label: 'Aegis blast!', itemId: 'spiked_aegis' });
        for (const foe of this.enemies.filter((e) => e.alive)) this.strike(unit, foe, events, { multiplier: unit.specials.spikedAegis / 100, damageType: 'melee', item: true });
      }
      if (!shield.onBreak) continue;
      const caster = this.allUnits().find((u) => u.uid === shield.sourceUid && u.alive) || unit;
      const foes = unit.side === 'hero' ? this.enemies.filter((u) => u.alive) : this.defenders();
      events.push({ type: 'proc', unit, label: 'Shards!' });
      for (const foe of foes) this.strike(caster, foe, events, { multiplier: shield.onBreak.damageMultiplier, damageType: shield.onBreak.damageType });
    }
  }

  // How much shield a unit has left (all its shields together).
  shieldAmount(unit) {
    return unit.statuses.reduce((sum, st) => (st.type === 'shield' ? sum + st.amount : sum), 0);
  }

  // ---- statuses (statuses.json) ----------------------------------------------------------

  // Gives a unit a status (rules in statuses.json).
  //  - Damage over time (`dot`: bleed, burn, poison) and `stacking` statuses (chill): EVERY
  //    application adds a new stack (spec.stacks, default 1), with no limit, each with its own timer.
  //    All stacks of one damage-over-time kind tick together.
  //  - Chill: at `freezeAt` stacks the unit freezes for `freezeMs` and all its chill is removed.
  //  - `instant` statuses (knockback) happen once and leave nothing behind.
  //  - Anything else: the same status from the same source (skill/item) just restarts its timer.
  // Bosses have `statusDurationScale` (e.g. 0.5): CONTROL statuses (statuses.json `control`:
  // stun, freeze, chill, fear...) last less on them. Damage over time is never shortened.
  applyStatus(target, spec, source, skillId, events) {
    const info = this.statusDefs[spec.status] || {};
    if ((target.def.statusImmune || []).includes(spec.status)) {
      events.push({ type: 'immuneStatus', unit: target, status: spec.status }); // Frost Warden: no Chill / Freeze
      return;
    }
    if (target.def.heat) this.heatFromStatus(target, spec.status, events);
    if (info.debuff && target.side === 'enemy' && source && source.side === 'hero') (target.debuffedBy = target.debuffedBy || new Set()).add(source.uid); // who has debuffed it (Dirty Fighting)
    if (target.streak && ['stun', 'freeze', 'fear'].includes(spec.status)) target.streak = { uid: null, count: 0 }; // Brawler's Streak combo is lost
    const scale = info.control ? target.def.statusDurationScale ?? 1 : 1;
    // A shield with no durationMs lasts until it is broken.
    // Catalyst (Alchemist): debuffs on ENEMIES last longer.
    const cat = target.side === 'enemy' && this.statusDefs[spec.status] && this.statusDefs[spec.status].debuff ? this.catalyst() : { dur: 1, dot: 1 };
    const will = info.control && target.side === 'hero' && target.specials ? target.specials.ironWill || 0 : 0; // Iron Will Talisman
    const duration = (spec.durationMs ?? (spec.status === 'shield' ? Infinity : 0)) * scale * cat.dur * (1 - Math.min(95, will) / 100);
    const key = `${spec.status}:${skillId}`;

    if (info.instant) {
      // Knockback: the next attack starts over (a boss only loses part of its wind-up), and an attack
      // already on its way is stopped.
      if (spec.status === 'knockback') {
        target.timer *= 1 - scale;
        // Pushed back `knockbackPx` towards its own side over `knockbackMs` (heroes down, enemies up).
        const M = this.rules.movement;
        if (M && this.hasPositions(target)) {
          const dir = target.side === 'hero' ? 1 : -1;
          target.knock = { vx: 0, vy: (dir * M.knockbackPx) / M.knockbackMs, remaining: M.knockbackMs };
        }
        if (target.pending) {
          target.pending = null;
          events.push({ type: 'attackCancel', unit: target, reason: 'knockback' });
        }
      }
      events.push({ type: 'status', unit: target, change: 'apply', status: { key, type: spec.status, remaining: 0, total: 0 } });
      return;
    }

    const stacking = info.dot || info.stacking;
    const count = stacking ? spec.stacks || 1 : 1;
    let status;
    for (let i = 0; i < count; i++) {
      // `stackEach` (Hex Doll's Curse, Rusty Nails' Armor Break): every application is its own stack with its own timer.
      status = stacking || spec.stackEach ? null : target.statuses.find((s) => s.key === key);
      if (!status) {
        status = { key, type: spec.status };
        target.statuses.push(status);
      }
      status.remaining = duration;
      status.total = duration;
      if (spec.status === 'buff') status.mods = spec.mods;
      if (spec.status === 'taunt' || spec.status === 'guarded') status.sourceUid = source.uid; // who taunted / who guards
      if (spec.status === 'shield') {
        // Size: a flat `amount`, plus `percentMaxHp` of the holder's health, plus `attackMultiplier` x the
        // caster's attack. The same shield (same source + skill) is refilled instead of stacking.
        const wards = 1 + ((target.specials && target.specials.shieldBonus) || 0) / 100; // Warding Charm: shields received are bigger
        status.amount = Math.max(1, Math.round(((spec.amount || 0) + ((spec.percentMaxHp || 0) * target.maxHp) / 100 + (spec.attackMultiplier || 0) * source.stats.attack) * wards));
        status.maxAmount = status.amount;
        status.sourceUid = source.uid;
        status.onBreak = spec.onBreak || null;
      }
      if (spec.status === 'invulnerable') status.healPercentOnEnd = spec.healPercentOnEnd || 0;
      if (spec.status === 'regenBoost') status.percentMaxHpPerSec = spec.percentMaxHpPerSec || 0;
      // Stat debuffs: the number comes from the skill/item, or the default in statuses.json.
      for (const field of ['attackPercent', 'defenseFlat', 'resistFlat', 'missPercent', 'damageTakenPercent']) {
        if (spec[field] !== undefined || info[field] !== undefined) status[field] = spec[field] ?? info[field];
      }
      if (spec.status === 'shock') {
        status.attackSpeedPercent = spec.attackSpeedPercent ?? info.attackSpeedPercent ?? 0;
        status.fumbleChance = spec.fumbleChance ?? info.fumbleChance ?? 0;
        status.fumbleStunMs = spec.fumbleStunMs ?? info.fumbleStunMs ?? 300;
      }
      if (info.dot) {
        status.stack = true;
        status.sourceUid = source.uid; // who applied this stack (kill credit, Plague Flask, Thousand Cuts, Magma Core)
        status.damageType = spec.damageType || info.damageType || 'dark';
        status.ignoresArmor = spec.ignoresArmor ?? !!info.ignoresArmor;
        // Damage-type items boost damage over time of that type too (e.g. +15% fire boosts Burn; not Poison).
        const bonus = info.typeBonus === false ? 0 : ((source.damageBonus && source.damageBonus[status.damageType]) || 0) / 100; // Poison: `typeBonus: false`
        const magma = spec.status === 'burn' && source.side === 'hero' && source.specials ? source.specials.magmaBurn || 0 : 0; // Magma Core: burns tick harder
        status.damage = Math.max(1, Math.round(source.stats.attack * spec.damageMultiplier * (1 + bonus) * cat.dot * (1 + ((source.side === 'hero' && source.specials && source.specials.dotDamage) || 0) / 100) * (1 + magma / 100)));
        if (!(spec.status in target.dotClocks)) target.dotClocks[spec.status] = 0; // first stack: start the tick clock
      }
    }
    if (spec.status === 'buff') this.refreshStats();
    events.push({ type: 'status', unit: target, change: 'apply', status });
    if (spec.status === 'taunt') this.redirectToTaunter(target, events);
    if (spec.status === 'charm' && target.pending) {
      target.pending = null; // charmed: whatever it was swinging at, it now turns on its friends
      events.push({ type: 'attackCancel', unit: target, reason: 'charmed' });
    }
    // Thousand Cuts: whenever the holder applies Bleed it adds 1 EXTRA Bleed stack.
    if (spec.status === 'bleed' && source && source.specials && source.specials.thousandCuts && !spec.extra && source.side === 'hero') {
      this.applyStatus(target, { ...spec, extra: true }, source, `${skillId}_extra`, events);
    }
    // Gag Rune: a stun or freeze the holder causes also Silences the enemy (2s, +1s per extra copy).
    const gag = source && source.specials && source.specials.gagRune;
    if (gag && target.side === 'enemy' && source.side === 'hero' && (spec.status === 'stun' || spec.status === 'freeze')) {
      this.applyStatus(target, { status: 'silence', durationMs: (1 + gag) * 1000 }, source, 'gag_rune', events);
    }

    // Enough chill: the unit freezes and the chill is used up.
    if (spec.status === 'chill' && info.freezeAt && this.stacks(target, 'chill') >= info.freezeAt) {
      target.statuses = target.statuses.filter((s) => s.type !== 'chill');
      this.applyStatus(target, { status: 'freeze', durationMs: info.freezeMs }, source, 'chill', events);
    }
  }

  // How many stacks of a status a unit has (damage over time: one per application).
  stacks(unit, type) {
    return unit.statuses.filter((s) => s.type === type).length;
  }

  // Counts statuses down, ticks damage over time, and removes finished statuses.
  tickStatuses(dt, events) {
    let buffEnded = false;
    for (const unit of this.allUnits()) {
      if (!unit.alive) continue;
      for (const status of unit.statuses) status.remaining -= dt;
      for (const st of unit.statuses) if (st.regenPerSec && st.amount < st.maxAmount) st.amount = Math.min(st.maxAmount, st.amount + (st.regenPerSec * dt) / 1000); // Fire Heart's shield regenerates
      for (const st of unit.statuses) {
        if (st.type !== 'regenBoost' || unit.hp >= unit.maxHp) continue;
        const gain = Math.min(unit.maxHp - unit.hp, (unit.maxHp * st.percentMaxHpPerSec * this.regenAura().factor * dt) / 100000); // Ballad of Rest (Cleric aura makes it stronger)
        unit.hp += gain;
        unit.regenAcc += gain;
      }
      this.tickDots(unit, dt, events);
      if (!unit.alive) continue;
      for (const status of [...unit.statuses]) {
        if (status.remaining > 0) continue;
        unit.statuses.splice(unit.statuses.indexOf(status), 1);
        if (status.type === 'buff') buffEnded = true;
        events.push({ type: 'status', unit, change: 'expire', status });
        if (status.type === 'invulnerable' && status.healPercentOnEnd > 0) {
          // Divine Shield: it heals when the invulnerability ends.
          this.healUnit(unit, (unit.maxHp * status.healPercentOnEnd) / 100, events, { aura: false });
        }
      }
    }
    if (buffEnded) this.refreshStats();
  }

  // Damage over time: all stacks of one kind (bleed, burn, poison) tick together every `tickMs`
  // (statuses.json). One tick = the sum of every stack's damage, shown as one number.
  tickDots(unit, dt, events) {
    for (const type of Object.keys(unit.dotClocks)) {
      const stacks = unit.statuses.filter((s) => s.type === type);
      if (!stacks.length) {
        delete unit.dotClocks[type]; // last stack gone: the next one starts a fresh clock
        continue;
      }
      const tickMs = (this.statusDefs[type] && this.statusDefs[type].tickMs) || 1000;
      // Magma Core: burn ticks faster when the holder who set it burning has the core (burnSpeed, up to +100%).
      const src = type === 'burn' ? this.heroes.find((h) => h.uid === stacks[0].sourceUid) : null;
      unit.dotClocks[type] += dt * (1 + ((src && src.specials.burnSpeed) || 0) / 100);
      while (unit.dotClocks[type] >= tickMs && unit.alive) {
        unit.dotClocks[type] -= tickMs;
        // Catalyst Vial: each DIFFERENT damage over time on this enemy makes the holder's stacks tick `dotMix`% harder.
        const kinds = unit.side === 'enemy' ? new Set(unit.statuses.filter((s) => s.stack).map((s) => s.type)).size : 0;
        const mix = (s) => { const h = kinds && this.heroes.find((x) => x.uid === s.sourceUid && x.alive); return h && h.specials.dotMix ? 1 + (h.specials.dotMix * kinds) / 100 : 1; };
        const total = stacks.reduce((sum, s) => sum + s.damage * mix(s), 0);
        const { damageType, ignoresArmor } = stacks[0];
        const amount = computeDotDamage(unit, total, damageType, this.rules, this.damageTypes, { ignoresArmor });
        const d = this.dealDamage(unit, amount, events);
        events.push({ type: 'dot', unit, amount: d.immune ? 0 : amount - d.absorbed, absorbed: d.absorbed, immune: d.immune, damageType, status: type, stacks: stacks.length });
        if (type === 'burn' && unit.alive && unit.hp > 0) this.ghastlyBurn(unit, stacks, events); // Ghastly Fire: burns also deal dark damage
        this.breakEffects(unit, d.broken, events);
        if (unit.hp <= 0 && unit.alive) this.killUnit(unit, events);
      }
    }
  }

  // ---- skills -------------------------------------------------------------------------

  // The skill a slot would cast NOW. A skill with a `rotation` (the Mage's Elemental Rotation) is a list of
  // spells; the slot's `rotation` counter says which one is next (it advances when the spell goes off).
  // The spell's fields (name, short, target, damage...) override the skill's.
  currentSpell(hero, index) {
    const slot = hero.skills[index];
    const base = this.skillDefs[slot.id];
    if (!base.rotation) return base;
    return this.charmed(hero, { ...base, ...base.rotation[(slot.rotation || 0) % base.rotation.length] });
  }

  // Mage's spells grow with their element charm (`charm: { item, damagePercent, splashPercent, radiusPercent, jumps }`,
  // per copy the caster holds): Kindling = bigger Fireball, Frost Charm = bigger Nova, Storm Charm = more Chain jumps.
  charmed(hero, spell) {
    const c = spell.charm;
    const n = c && hero.items ? hero.items.filter((i) => i === c.item).length : 0;
    if (!n) return spell;
    const out = { ...spell };
    if (c.damagePercent) out.damageMultiplier = spell.damageMultiplier * (1 + (c.damagePercent * n) / 100);
    if (c.splashPercent && spell.splash) out.splash = { ...spell.splash, damageMultiplier: spell.splash.damageMultiplier * (1 + (c.splashPercent * n) / 100) };
    if (c.radiusPercent && spell.area) out.area = { ...spell.area, radius: spell.area.radius * (1 + (c.radiusPercent * n) / 100) };
    if (c.jumps && spell.chainJumps !== undefined) out.chainJumps = spell.chainJumps + c.jumps * n;
    return out;
  }

  // Can this hero cast this skill right now? Returns false if not (dead, stunned, cooling down,
  // or nothing to aim at). Skills cost no mana: only the cooldown limits them.
  canCast(hero, index) {
    const slot = hero.skills[index];
    if (!slot || !hero.alive || hero.casting || this.isStunned(hero) || this.has(hero, 'silence')) return false;
    const skill = this.currentSpell(hero, index);
    if (slot.cooldownLeft > 0) return false;
    if (this.targetsAllies(skill)) return true;
    return this.enemies.some((e) => e.alive);
  }

  // Skills that only touch the hero's side (no enemy needed to cast them).
  targetsAllies(skill) {
    return skill.target === 'self' || skill.target === 'squad' || skill.target === 'lowestAlly' || (skill.random && skill.random.target === 'ally');
  }

  // How long a skill winds up before it goes off: the skill's `castMs`, else combat.json
  // `skillWindUp.defaultCastMs` (0 = instant). Longer than a normal attack, so you can see it coming.
  castTime(skill) {
    return skill.castMs ?? (this.rules.skillWindUp && this.rules.skillWindUp.defaultCastMs) ?? 0;
  }

  // Taps a hero's skill: it goes on cooldown at once and starts winding up (castStart); it goes off
  // when the wind-up is done (see tickCasting). Instant if the wind-up time is 0.
  // Returns events (empty if the skill could not be cast).
  castSkill(heroUid, index) {
    const events = [];
    const hero = this.heroes.find((h) => h.uid === heroUid);
    if (!hero || !this.canCast(hero, index)) return events;
    const slot = hero.skills[index];
    const skill = this.currentSpell(hero, index);
    const book = this.pageTotals(slot); // skill book pages: shorter cooldown / wind-up (Swift, Steady Hands, Hasty, Overcharge)
    slot.cooldownLeft = skill.cooldownMs * (1 - Math.min(95, hero.specials.cooldown || 0) / 100) * (1 - Math.min(75, book.cooldown) / 100); // Hourglass
    const castMs = this.castTime(skill) * (1 - Math.min(75, book.windup) / 100) * book.windupMultiplier;
    if (castMs <= 0) {
      this.releaseSkill(hero, index, events);
      return events;
    }
    hero.casting = { index, remaining: castMs, total: castMs };
    events.push({ type: 'castStart', unit: hero, skill, index, castMs });
    return events;
  }

  // A wind-up (or a channel, see startChannel) runs down. Stunned, frozen or silenced meanwhile: the
  // skill is LOST (it stays on cooldown, the user's choice); a channel stops where it is.
  tickCasting(hero, dt, events) {
    if (!hero.casting) return;
    const c = hero.casting;
    const skill = c.channel ? c.channel.skill : this.currentSpell(hero, c.index);
    if (this.isStunned(hero) || this.has(hero, 'silence')) {
      hero.casting = null;
      events.push({ type: 'castCancel', unit: hero, skill, reason: 'interrupted' });
      return;
    }
    c.remaining -= dt;
    if (c.channel) {
      // The channel fires its waves one after another (Rain of Arrows, Crescendo).
      c.channel.timer -= dt;
      while (c.channel.timer <= 0 && c.channel.wave < c.channel.waves.length) {
        this.fireWave(hero, c.channel, events);
        c.channel.timer += c.channel.intervalMs;
      }
      if (c.channel.wave >= c.channel.waves.length) hero.casting = null;
      return;
    }
    if (c.flasks) {
      // Flasks thrown one after another (`random.intervalMs`, Alchemist).
      const f = c.flasks;
      f.timer -= dt;
      while (f.timer <= 0 && f.left > 0) {
        this.castPages = f.book.length ? { hero, mods: f.book } : null;
        const thrown = this.throwFlask(hero, f.skill, f.slotId, f.healed, events);
        this.castPages = null;
        f.left = thrown ? f.left - 1 : 0;
        f.timer += f.skill.random.intervalMs;
      }
      if (f.left <= 0) hero.casting = null;
      return;
    }
    if (c.remaining > 0) return;
    const { index } = c;
    hero.casting = null;
    this.releaseSkill(hero, index, events);
  }

  // The skill goes off. One-target skills hit the focused enemy, else the hero's usual target
  // (picked now, at the end of the wind-up).
  releaseSkill(hero, index, events, echo = null) {
    const slot = hero.skills[index];
    let skill = echo ? echo.spell : this.currentSpell(hero, index);
    // Conductor's Baton: the holder's SUPPORT skills are stronger and last longer.
    if (skill.kind === 'support' && hero.specials.baton) skill = this.scaleSupport(skill, 1 + hero.specials.baton / 100);
    // Skill book pages on this skill: power and duration (an echo is already scaled), modifiers (see bookCast / skillHit).
    const book = this.pageTotals(slot);
    const desp = book.mods.find((m) => m.desperate); // Desperate: more power while the caster is low
    const power = book.power + (desp && (hero.hp / hero.maxHp) * 100 < desp.desperate.belowPercent ? desp.desperate.power : 0);
    if (!echo && (power || book.duration)) skill = this.scaleSkill(skill, Math.max(0.1, 1 + power / 100), 1 + book.duration / 100);
    // Nothing to hit: no living enemy, or every one left can't be hit right now (Morthul as dust, Vharox in the sky).
    if (!this.targetsAllies(skill) && !this.targetableEnemies().length) {
      events.push({ type: 'castCancel', unit: hero, skill, reason: 'noTarget' });
      return;
    }
    if (!echo && this.skillDefs[slot.id].rotation) slot.rotation = ((slot.rotation || 0) + 1) % this.skillDefs[slot.id].rotation.length; // next spell next time

    let targets;
    let zone = null;
    if (skill.random) targets = [];
    else if (skill.target === 'self') targets = [hero];
    else if (skill.target === 'squad') targets = this.squadUnits(); // every living hero and minion
    else if (skill.target === 'lowestAlly') targets = [this.lowestHealthPercent()];
    else if (skill.target === 'allEnemies') ({ targets, zone } = this.areaHit(hero, skill)); // an `area` skill hits only who stands in it
    else targets = [this.pickTarget(hero)];
    targets = targets.filter(Boolean); // a pick can come back empty (no target left): never hit "nobody"
    if (!skill.random && !targets.length) {
      events.push({ type: 'castCancel', unit: hero, skill, reason: 'noTarget' });
      return;
    }
    if (skill.chain && targets[0]) targets = this.chainOrder(targets[0]); // Chain Lightning: through ALL enemies, nearest next
    if (skill.chain && skill.chainJumps !== undefined) targets = targets.slice(0, 1 + skill.chainJumps); // ...or `chainJumps` jumps (v3)
    const splash = (hero.specials && hero.specials.skillSplash) || 0; // Siege Cannon: % chance to hit the neighbours too
    if (skill.target === 'enemy' && skill.damageMultiplier && splash > 0 && this.rng() * 100 < splash) {
      const near = this.neighbours(targets[0]);
      if (near.length) {
        targets = [...targets, ...near];
        events.push({ type: 'proc', unit: hero, label: 'Splash!', itemId: 'siege_cannon' });
      }
    }

    const moved = skill.staysAtImpact && targets[0] ? this.moveToImpact(hero, targets[0], slot.id) : null; // dash / leap: he stays where he hit
    events.push({ type: 'cast', unit: hero, skill, skillId: slot.id, targets, zone, moved }); // skillId: the skill's own sound (skill_<id>); moved = where he came from
    if (!echo) this.bookCast(hero, skill, book.mods, events, targets);
    this.castPages = book.mods.length ? { hero, mods: book.mods } : null; // on-hit modifiers (Inks, Siphon) for this cast's hits
    // Blood Pact: the skill costs the caster some of their own health.
    if (skill.selfCostPercent) {
      const cost = Math.round((hero.maxHp * skill.selfCostPercent) / 100);
      hero.hp = Math.max(1, hero.hp - cost);
      events.push({ type: 'selfCost', unit: hero, amount: cost });
    }
    for (const spec of skill.selfApply || []) this.applyStatus(hero, spec, hero, `${slot.id}_self`, events); // Challenge: +defense for himself
    if (skill.songSwitch) this.switchSong(hero, events); // Bard's Change Song
    if (skill.teamElements) { this.teamElementsMs = skill.teamElements.durationMs; events.push({ type: 'proc', unit: hero, label: 'Team Elements!' }); } // Arcane Ward v3
    // `cleanse: N`: every target loses N debuffs (a whole kind each, the oldest first).
    if (skill.cleanse) for (const t of targets) this.cleanse(t, skill.cleanse, events);
    // `applyEnemies`: statuses every living enemy gets (Smoke Bomb: blind).
    for (const spec of skill.applyEnemies || []) for (const e of this.enemies.filter((x) => x.alive)) this.applyStatus(e, spec, hero, slot.id, events);

    if (skill.channel) {
      // A channel: after the cast it keeps firing waves; the hero is busy until the last one.
      const ch = skill.channel;
      hero.casting = { index, remaining: ch.waves.length * ch.intervalMs, total: ch.waves.length * ch.intervalMs, channel: { skill, slotId: slot.id, waves: ch.waves, intervalMs: ch.intervalMs, timer: 0, wave: 0, zone, book: book.mods, aimUid: targets[0] && targets[0].uid } };
      this.castPages = null;
      return;
    }
    if (skill.random && skill.random.intervalMs && !echo) {
      // Flasks one after another: the first goes now, the rest every `intervalMs`; the hero is busy until the last.
      const r = skill.random;
      const flasks = { skill, slotId: slot.id, healed: new Set(), left: r.count, timer: 0, book: book.mods };
      const ms = Math.max(1, (r.count - 1) * r.intervalMs);
      hero.casting = { index, remaining: ms, total: ms, flasks };
      this.castPages = null;
      this.tickCasting(hero, 0, events);
      return;
    }
    if (skill.boneSacrifice) {
      this.boneSacrifice(hero, skill, slot.id, events);
      this.castPages = null;
      return;
    }
    if (skill.holyNova) {
      this.holyNova(hero, skill, slot.id, targets[0], events);
      this.castPages = null;
      return;
    }
    if (skill.random) {
      this.throwFlasks(hero, skill, slot.id, events);
      this.castPages = null;
      return;
    }
    let first = true;
    for (const target of targets) {
      // Eviscerate (`finisher`): spends the combo points on this enemy; a full combo crits, bleeds and fires every on-hit item.
      let fin = null;
      if (skill.finisher) {
        const pts = hero.combo.uid === target.uid ? hero.combo.points : 0;
        const full = pts >= ((hero.def.passive && hero.def.passive.combo && hero.def.passive.combo.max) || 5);
        fin = { multiplier: skill.damageMultiplier + skill.finisher.perPoint * pts, critBonus: full ? 100 : 0, full };
        hero.combo = { uid: target.uid, points: 0 };
        events.push({ type: 'combo', unit: hero, target, points: 0, spent: pts });
      }
      const res = this.skillHit(hero, skill, slot.id, target, events, { jumpFrom: skill.chain && !first ? targets[targets.indexOf(target) - 1] : null, scale: echo ? echo.power : 1, multiplier: fin ? fin.multiplier : undefined, critBonus: fin ? fin.critBonus : 0 });
      if (fin && fin.full && target.alive && res && !res.dodged) {
        for (const spec of skill.finisher.applyAtMax || []) this.applyStatus(target, spec, hero, `${slot.id}_max`, events);
        this.rollProcs(hero, 'onAttack', events, { target, hit: true, force: true });
      }
      // Headshot (`triggersOnHit`): counts as a basic attack for on-hit items (and Fire Arrows).
      if (skill.triggersOnHit && res && target.alive) {
        this.rollProcs(hero, 'onAttack', events, { target, hit: !res.dodged });
        this.fireArrows(hero, target, events);
      }
      // Savage Leap v3 (`procBoost`): every enemy it hits rolls his on-hit items, at `procBoost` times their chance.
      if (skill.procBoost && res && target.alive) this.rollProcs(hero, 'onAttack', events, { target, hit: !res.dodged, chanceMult: skill.procBoost });
      // Savage Leap (`landSplash`): a shockwave hits the other enemies near where he lands.
      if (skill.landSplash && first) {
        const near = this.enemies.filter((e) => e.alive && e !== target && (this.hasPositions(e) && this.hasPositions(target) ? this.distance(e, target) <= skill.landSplash.radius : this.neighbours(target).includes(e)));
        for (const e of near) {
          const r = this.skillHit(hero, { ...skill, apply: null, doubleIf: null, landSplash: null }, slot.id, e, events, { multiplier: skill.landSplash.damageMultiplier });
          if (skill.procBoost && r && e.alive) this.rollProcs(hero, 'onAttack', events, { target: e, hit: !r.dodged, chanceMult: skill.procBoost });
        }
      }
      first = false;
      // Fireball: the neighbours of its target are hit too, for a share of the damage, with the same debuffs.
      if (skill.splash && target === targets[0] && skill.target === 'enemy') {
        for (const n of this.neighbours(target)) this.skillHit(hero, skill, slot.id, n, events, { multiplier: skill.splash.damageMultiplier, scale: echo ? echo.power : 1 });
      }
    }
    // Wind Cutter v3 (`killCooldownCutPercent`): if the cast killed an enemy, its cooldown is cut.
    if (skill.killCooldownCutPercent && !echo && targets.some((t) => !t.alive)) {
      slot.cooldownLeft *= 1 - skill.killCooldownCutPercent / 100;
      events.push({ type: 'proc', unit: hero, label: 'Perfect Cut!' });
    }
    if (!echo) this.bookAfterCast(hero, skill, slot.id, targets, book.mods, events);
    this.castPages = null;
    // Echo Rune: a skill sometimes casts a second time (the echo cannot echo, the Mage's rotation does not move again).
    // Channels (Rain of Arrows, Crescendo) and flasks thrown one by one do not echo.
    const chance = hero.specials.echo || 0;
    if (!echo && chance > 0 && !skill.channel && !(skill.random && skill.random.intervalMs) && this.rng() * 100 < chance) {
      events.push({ type: 'proc', unit: hero, label: 'Echo!', itemId: 'echo_rune' });
      const copies = hero.specials.echoCopies || 1;
      this.releaseSkill(hero, index, events, { spell: skill, power: 0.6 + 0.1 * (copies - 1) });
    }
  }

  // ---- skill books (skillBooks.json pages, combat.json `books` limits) ----------------------------------------
  // Puts a page ({ id, kind, ... } from skillBooks.json) on skill `index` of a hero, for the rest of the run.
  // Stat pages: at most books.maxStatPages per skill (they may repeat). Modifiers: at most books.modifierSlots, no
  // duplicates; on a full skill pass `replace` = which of its modifiers (0, 1...) the new one replaces.
  // Returns { ok, reason?: 'noHero' | 'full' | 'duplicate', replaced? }.
  addPage(heroUid, index, page, replace = null) {
    const hero = this.heroes.find((h) => h.uid === heroUid);
    const slot = hero && hero.skills[index];
    if (!slot || !hero.alive) return { ok: false, reason: 'noHero' };
    const lim = this.rules.books || {};
    const pages = (slot.pages = slot.pages || []);
    if (page.kind === 'stat') {
      if (pages.filter((p) => p.kind === 'stat').length >= (lim.maxStatPages ?? 3)) return { ok: false, reason: 'full' };
      pages.push(page);
      return { ok: true };
    }
    const mods = pages.filter((p) => p.kind === 'modifier');
    if (mods.some((p) => p.id === page.id)) return { ok: false, reason: 'duplicate' };
    if (mods.length >= (lim.modifierSlots ?? 2)) {
      if (replace === null || !mods[replace]) return { ok: false, reason: 'full' };
      pages.splice(pages.indexOf(mods[replace]), 1, page);
      return { ok: true, replaced: mods[replace] };
    }
    pages.push(page);
    return { ok: true };
  }

  // What the pages on one skill add up to (percent numbers; windupMultiplier multiplies).
  pageTotals(slot) {
    const t = { power: 0, cooldown: 0, windup: 0, duration: 0, windupMultiplier: 1, mods: [] };
    for (const p of (slot && slot.pages) || []) {
      t.power += p.power || 0;
      t.cooldown += p.cooldown || 0;
      t.windup += p.windup || 0;
      t.duration += p.duration || 0;
      if (p.windupMultiplier) t.windupMultiplier *= p.windupMultiplier;
      if (p.kind === 'modifier') t.mods.push(p);
    }
    return t;
  }

  // Modifiers that act once when the skill goes off: statuses on the caster / squad (Bulwark, Rally). A skill that
  // hits no enemy (a support skill) uses the page's support version: Inks go on the enemy nearest the caster,
  // Siphon heals the caster a % of max health.
  bookCast(hero, skill, mods, events, targets = []) {
    const hitsEnemies = !!(skill.damageMultiplier || skill.channel || (skill.random && skill.random.target === 'enemy'));
    for (const m of mods) {
      for (const spec of m.selfApply || []) this.applyStatus(hero, spec, hero, `book_${m.id}`, events);
      for (const spec of m.squadApply || []) for (const u of this.squadUnits()) this.applyStatus(u, spec, hero, `book_${m.id}`, events);
      if (m.grow) events.push({ type: 'grow', unit: hero, scale: m.grow.scale, durationMs: m.grow.durationMs }); // Titan (the scene makes the hero bigger)
      // Blood Price: the most hurt allies heal, the caster pays (never below 1 health).
      if (m.allyHeal) {
        const allies = this.heroes.filter((h) => h.alive && h !== hero).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, m.allyHeal.count);
        for (const a of allies) this.healUnit(a, Math.round((a.maxHp * m.allyHeal.percentMaxHp) / 100), events);
      }
      if (m.selfCostPercent) {
        const cost = Math.round((hero.hp * m.selfCostPercent) / 100);
        hero.hp = Math.max(1, hero.hp - cost);
        events.push({ type: 'selfCost', unit: hero, amount: cost });
      }
      // Cyclone: a tornado on the skill's enemy target (or the enemy nearest the caster).
      if (m.tornado) {
        const e = targets.find((t) => t.side === 'enemy' && t.alive) || this.nearest(hero, this.targetableEnemies());
        if (e) this.spawnTornado(hero, m.tornado, e, events);
      }
      // Purify: the caster loses a debuff (a support skill cleans every ally it touches).
      if (m.purify) for (const u of hitsEnemies ? [hero] : [hero, ...targets.filter((t) => t.side === 'hero' && t !== hero)]) this.cleanse(u, m.purify, events);
      // Roar: enemies near the caster must hit it for a moment; it gets some armor.
      if (m.roar) {
        for (const e of this.targetableEnemies().filter((x) => !this.hasPositions(hero) || !this.hasPositions(x) || this.distance(hero, x) <= m.roar.radius)) this.applyStatus(e, m.roar.taunt, hero, `book_${m.id}`, events);
        this.applyStatus(hero, m.roar.self, hero, `book_${m.id}_self`, events);
        events.push({ type: 'roar', unit: hero });
      }
      // Gravecall: a weak skeleton (at most `max` page skeletons per hero; the oldest goes).
      if (m.summon) {
        const mine = this.minions.filter((x) => x.holderUid === hero.uid && x.capGroup === 'book');
        if (mine.length >= m.summon.max) this.vanishMinion(mine[0], 'pushedOut', events);
        this.spawnMinion(hero, { kind: 'weak', key: `book_${m.id}`, capGroup: 'book', spec: { minion: m.summon.minion } }, events);
      }
      if (hitsEnemies) continue;
      if (m.ink) {
        const e = this.nearest(hero, this.targetableEnemies());
        if (e) for (const spec of m.ink) this.applyStatus(e, spec, hero, `book_${m.id}`, events);
      }
      if (m.supportHealPercent) this.healUnit(hero, Math.round((hero.maxHp * m.supportHealPercent) / 100), events);
    }
  }

  // Modifiers on every enemy a skill hit lands on: Inks (statuses), Siphon (heals the caster).
  bookOnHit(hero, target, result, events) {
    const cp = this.castPages;
    if (!cp || cp.hero !== hero || target.side !== 'enemy' || !result || result.dodged) return;
    for (const m of cp.mods) {
      const dealt = (result.amount || 0) - (result.absorbed || 0);
      if (m.siphonPercent && dealt > 0) this.healUnit(hero, Math.max(1, Math.round((dealt * m.siphonPercent) / 100)), events);
      if (m.ink && target.alive) for (const spec of m.ink) this.applyStatus(target, spec, hero, `book_${m.id}`, events);
      if (m.onHitChance && target.alive && this.rng() * 100 < m.onHitChance.chance) for (const spec of m.onHitChance.apply) this.applyStatus(target, spec, hero, `book_${m.id}`, events);
    }
  }

  // Modifiers after the skill's hits: Ricochet (one more target at a share), Aftershock (a later pulse, see tickBookTimers).
  bookAfterCast(hero, skill, slotId, targets, mods, events) {
    for (const m of mods) {
      if (m.ricochet && targets.length === 1) {
        const first = targets[0];
        if (first.side === 'enemy' && skill.damageMultiplier) {
          const other = this.nearest(first, this.targetableEnemies().filter((e) => e !== first));
          if (other) {
            events.push({ type: 'ricochet', unit: hero, from: first, to: other });
            this.skillHit(hero, skill, `${slotId}_ricochet`, other, events, { multiplier: skill.damageMultiplier * m.ricochet });
          }
        } else if (first.side === 'hero') {
          const other = this.heroes.filter((h) => h.alive && h !== first).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
          if (other) {
            events.push({ type: 'ricochet', unit: hero, from: first, to: other });
            this.skillHit(hero, this.scaleSkill(skill, m.ricochet, 1), `${slotId}_ricochet`, other, events);
          }
        }
      }
      if (m.aftershock && (skill.damageMultiplier || skill.heal)) {
        (this.bookTimers = this.bookTimers || []).push({ left: m.aftershock.delayMs, hero, slotId, targets: [...targets], power: m.aftershock.power, skill: { damageType: skill.damageType, damageMultiplier: skill.damageMultiplier, heal: skill.heal } });
      }
    }
  }

  // Aftershock pulses: the same targets are hit (or healed) again for a share, with no statuses.
  tickBookTimers(dt, events) {
    if (!this.bookTimers || !this.bookTimers.length) return;
    for (const t of [...this.bookTimers]) {
      t.left -= dt;
      if (t.left > 0) continue;
      this.bookTimers.splice(this.bookTimers.indexOf(t), 1);
      if (!t.hero.alive) continue;
      const alive = t.targets.filter((u) => u.alive);
      if (!alive.length) continue;
      events.push({ type: 'aftershock', unit: t.hero, targets: alive });
      const sk = { damageType: t.skill.damageType, damageMultiplier: t.skill.damageMultiplier ? t.skill.damageMultiplier * t.power : 0, heal: t.skill.heal ? { percentMaxHp: (t.skill.heal.percentMaxHp || 0) * t.power, attackMultiplier: (t.skill.heal.attackMultiplier || 0) * t.power } : null };
      for (const u of alive) if ((u.side === 'enemy') === !!sk.damageMultiplier) this.skillHit(t.hero, sk, `${t.slotId}_after`, u, events);
    }
  }

  // A skill with skill book power `power` (1.08 = +8%: damage, heals, shields, buff sizes) and `dur` (1.15 = what it
  // gives lasts 15% longer). Returns a scaled copy.
  scaleSkill(skill, power, dur) {
    const spec = (s) => {
      const out = { ...s };
      if (out.durationMs) out.durationMs *= dur;
      if (out.mods) out.mods = out.mods.map((m) => ({ ...m, ...(m.percent !== undefined ? { percent: m.percent * power } : {}), ...(m.flat !== undefined ? { flat: m.flat * power } : {}) }));
      for (const f of ['amount', 'percentMaxHp', 'attackMultiplier', 'healPercentOnEnd', 'percentMaxHpPerSec']) if (out[f] !== undefined) out[f] *= power;
      return out;
    };
    const list = (a) => (a ? a.map(spec) : a);
    const out = { ...skill, apply: list(skill.apply), applyEnemies: list(skill.applyEnemies), selfApply: list(skill.selfApply), waveApply: list(skill.waveApply), onCrit: list(skill.onCrit) };
    if (skill.damageMultiplier) out.damageMultiplier = skill.damageMultiplier * power;
    if (skill.heal) out.heal = { ...skill.heal, percentMaxHp: (skill.heal.percentMaxHp || 0) * power, attackMultiplier: (skill.heal.attackMultiplier || 0) * power };
    if (skill.channel) out.channel = { ...skill.channel, waves: skill.channel.waves.map((w) => w * power) };
    if (skill.finisher) out.finisher = { ...skill.finisher, perPoint: skill.finisher.perPoint * power, applyAtMax: list(skill.finisher.applyAtMax) };
    if (skill.splash) out.splash = { ...skill.splash, damageMultiplier: skill.splash.damageMultiplier * power };
    if (skill.landSplash) out.landSplash = { ...skill.landSplash, damageMultiplier: skill.landSplash.damageMultiplier * power };
    if (skill.random) out.random = { ...skill.random, pool: skill.random.pool.map((f) => ({ ...f, ...(f.damageMultiplier ? { damageMultiplier: f.damageMultiplier * power } : {}), ...(f.apply ? { apply: list(f.apply) } : {}), ...(f.heal ? { heal: { ...f.heal, percentMaxHp: f.heal.percentMaxHp * power } } : {}) })) };
    return out;
  }

  // A support skill made stronger and longer by `k` (1.25 = 25%): every status it applies lasts longer, its
  // numbers (buff mods, shields, heals, regen, marks) are bigger.
  scaleSupport(skill, k) {
    const scaleSpec = (spec) => {
      const out = { ...spec };
      if (out.durationMs) out.durationMs *= k;
      if (out.mods) out.mods = out.mods.map((m) => ({ ...m, ...(m.percent !== undefined ? { percent: m.percent * k } : {}), ...(m.flat !== undefined ? { flat: m.flat * k } : {}) }));
      for (const f of ['amount', 'percentMaxHp', 'attackMultiplier', 'healPercentOnEnd', 'percentMaxHpPerSec', 'damageTakenPercent']) if (out[f] !== undefined) out[f] *= k;
      return out;
    };
    const out = { ...skill };
    if (skill.apply) out.apply = skill.apply.map(scaleSpec);
    if (skill.applyEnemies) out.applyEnemies = skill.applyEnemies.map(scaleSpec);
    if (skill.heal) out.heal = { ...skill.heal, percentMaxHp: (skill.heal.percentMaxHp || 0) * k };
    if (skill.random) out.random = { ...skill.random, pool: skill.random.pool.map((f) => ({ ...f, ...(f.apply ? { apply: f.apply.map(scaleSpec) } : {}), ...(f.heal ? { heal: { ...f.heal, percentMaxHp: f.heal.percentMaxHp * k } } : {}) })) };
    return out;
  }

  // One hit of a skill on one target (damage, bonuses, statuses, healing). opts.multiplier overrides the
  // skill's damageMultiplier (waves, splash). Returns the strike result or null (no damage in this skill).
  skillHit(hero, skill, slotId, target, events, opts = {}) {
    let result = null;
    // Sela's Mirror Ward: the first hero skill that hits her bounces back on the caster.
    const ward = hero.side === 'hero' && target.side === 'enemy' && this.reflects(target);
    if (ward && (skill.damageMultiplier || (skill.apply || []).length)) {
      target.statuses.splice(target.statuses.indexOf(ward), 1);
      events.push({ type: 'status', unit: target, change: 'expire', status: ward });
      events.push({ type: 'reflect', unit: target, at: hero });
      if (skill.damageMultiplier) return this.strike(hero, hero, events, { multiplier: (opts.multiplier ?? skill.damageMultiplier), damageType: skill.damageType, reflected: true });
      return null;
    }
    let base = opts.multiplier ?? skill.damageMultiplier;
    // Defense Bash (`defenseMultiplier`): also deals that many times the caster's DEFENSE (as a share of his attack).
    if (skill.defenseMultiplier && opts.multiplier === undefined) base += (skill.defenseMultiplier * hero.stats.defense) / Math.max(1, hero.stats.attack);
    // Necromancer's Souls (`soulBonusPercent`): every Soul makes this skill stronger, then they are all spent.
    if (skill.soulBonusPercent && hero.souls) {
      base *= 1 + (hero.souls * skill.soulBonusPercent) / 100;
      events.push({ type: 'proc', unit: hero, label: `Souls x${hero.souls}!` });
      hero.souls = 0;
      events.push({ type: 'soul', unit: hero, souls: 0 });
    }
    // Knight's Grudge: the charge from reflected hits makes this skill stronger, then it is used up.
    if (skill.grudgeCharged && hero.grudge) {
      base *= 1 + (hero.grudge * hero.def.passive.grudge.perReflectPercent) / 100;
      events.push({ type: 'proc', unit: hero, label: `Grudge x${hero.grudge}!` });
      hero.grudge = 0;
      events.push({ type: 'grudge', unit: hero, stacks: 0 });
    }
    if (base) {
      let mult = base * (1 + (((hero.specials && hero.specials.skillDamage) || 0) + this.bookmarkBonus(hero)) / 100) * (opts.scale ?? 1);
      // Bonus damage against certain enemies: `debuffedMultiplier` (any debuff: Smite, Death Coil), `bonusVs`
      // (a list of { status, multiplier }: Chain Lightning vs burning/frozen), `doubleIf` (x2 if the target
      // is bleeding / below half health: Savage Leap).
      if (skill.debuffedMultiplier && this.isDebuffed(target)) mult *= skill.debuffedMultiplier;
      for (const b of skill.bonusVs || []) if (target.statuses.some((st) => st.type === b.status)) mult *= b.multiplier;
      if (skill.doubleIf && skill.doubleIf.some((c) => (c === 'bleed' ? this.has(target, 'bleed') : c === 'below50' ? target.hp < target.maxHp / 2 : false))) mult *= 2;
      result = this.strike(hero, target, events, {
        multiplier: mult,
        damageType: skill.damageType,
        critBonus: (opts.critBonus || 0) + (skill.sureCrit ? 100 : 0), // Wind Cutter v3: always crits
        ignoreArmor: !!skill.ignoresArmor,
        skill,
        projectile: skill.chain ? 'lightning' : skill.projectile,
        from: opts.jumpFrom || undefined,
      });
      // Smite: the most hurt ally heals for a share of the damage that got through.
      if (skill.healShare && !result.dodged) {
        const ally = this.lowestHealthAlly();
        const amount = Math.round(((result.amount - (result.absorbed || 0)) * skill.healShare) / 100);
        if (ally && amount > 0) this.healUnit(ally, amount, events);
      }
      // Death Coil: a kill raises a skeleton.
      if (!target.alive && skill.onKill && skill.onKill.raise) {
        this.spawnMinion(hero, { kind: 'weak', key: 'hero', spec: { minion: skill.onKill.raise, cap: (hero.def.spawner && hero.def.spawner.cap) || 4 } }, events);
      }
      this.bookOnHit(hero, target, result, events); // Inks, Siphon
      if (result.dodged || !target.alive) return result;
      // `onCrit`: statuses that only a crit puts on the target (Fan of Knives: bleed).
      if (result.crit) for (const spec of skill.onCrit || []) this.applyStatus(target, spec, hero, `${slotId}_crit`, events);
    }
    for (const spec of skill.apply || []) this.applyStatus(target, spec, hero, slotId, events);
    if (skill.heal) this.healUnit(target, this.healAmount(hero, target, skill.heal), events);
    return result;
  }

  // One wave of a channel: every living enemy takes a hit (growing in Crescendo), `waveApply` statuses with a chance each.
  fireWave(hero, ch, events) {
    this.castPages = ch.book && ch.book.length ? { hero, mods: ch.book } : null;
    const mult = ch.waves[ch.wave];
    // The zone follows its main target while that one lives (enemies walk during a channel).
    const z = ch.zone;
    const aim = z && this.enemies.find((e) => e.uid === z.aimUid && e.alive);
    if (aim && z.at !== 'caster') {
      if (z.shape === 'cone') z.dir = Math.atan2(aim.y - z.y, aim.x - z.x);
      else { z.x = aim.x; z.y = aim.y; }
    }
    let targets = this.enemies.filter((e) => e.alive && (!z || e === aim || this.inZone(e, z)));
    // A one-enemy channel (Multistrike, skill target 'enemy'): every wave hits the same enemy, or the next one if it died.
    if (ch.skill.target === 'enemy') {
      let one = this.enemies.find((e) => e.uid === ch.aimUid && e.alive);
      if (!one) { one = this.pickTarget(hero); if (one) ch.aimUid = one.uid; }
      targets = one ? [one] : [];
    }
    events.push({ type: 'wave', unit: hero, skill: ch.skill, wave: ch.wave, waves: ch.waves.length, targets, zone: z });
    for (const t of targets) {
      const res = this.skillHit(hero, { ...ch.skill, apply: null, onCrit: ch.skill.onCrit }, ch.slotId, t, events, { multiplier: mult });
      if (res && !res.dodged && t.alive) for (const spec of ch.skill.waveApply || []) if (this.rng() * 100 < (spec.chance ?? 100)) this.applyStatus(t, spec, hero, ch.slotId, events);
      // Arrow Rain (`waveOnHit`): every wave rolls the caster's on-hit items (and Fire Arrows) on each enemy it hits.
      if (ch.skill.waveOnHit && res && t.alive) {
        this.rollProcs(hero, 'onAttack', events, { target: t, hit: !res.dodged });
        this.fireArrows(hero, t, events);
      }
    }
    this.castPages = null;
    ch.wave++;
  }

  // AREA skills (skills.json `area`): where the skill lands and which enemies stand in it.
  //   { shape: 'circle', at: 'target' | 'caster', radius, ySquash }  an oval around the hero's target (or itself)
  //   { shape: 'cone', range, angleDeg }                              a wedge from the caster towards its target
  //   { shape: 'band', halfHeight }                                   a strip across the field at the target's height
  // The target itself is always hit. Without positions (some rule tests) or without `area`: every living enemy.
  areaHit(hero, skill) {
    const alive = this.targetableEnemies();
    const a = skill.area;
    if (!a || !this.hasPositions(hero) || !alive.every((e) => this.hasPositions(e))) return { targets: alive, zone: null };
    const aim = this.pickTarget(hero) || alive[0];
    let zone;
    if (a.shape === 'cone') zone = { shape: 'cone', x: hero.x, y: hero.y, dir: Math.atan2(aim.y - hero.y, aim.x - hero.x), range: a.range, half: ((a.angleDeg || 60) * Math.PI) / 360 };
    else if (a.shape === 'band') zone = { shape: 'band', x: aim.x, y: aim.y, halfHeight: a.halfHeight };
    else {
      const c = a.at === 'caster' ? hero : aim;
      zone = { shape: 'circle', x: c.x, y: c.y, radius: a.radius, ySquash: a.ySquash ?? 0.7 };
    }
    zone.aimUid = aim.uid;
    zone.at = a.at;
    return { targets: alive.filter((e) => e === aim || this.inZone(e, zone)), zone };
  }

  inZone(unit, z) {
    if (!this.hasPositions(unit)) return true;
    const dx = unit.x - z.x;
    const dy = unit.y - z.y;
    if (z.shape === 'band') return Math.abs(dy) <= z.halfHeight;
    if (z.shape === 'cone') {
      if (Math.hypot(dx, dy) > z.range) return false;
      let diff = Math.atan2(dy, dx) - z.dir;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return Math.abs(diff) <= z.half;
    }
    const ry = z.radius * z.ySquash;
    return (dx / z.radius) ** 2 + (dy / ry) ** 2 <= 1;
  }

  // Alchemist flasks: `random: { count, target: 'enemy' | 'ally', pool: [ { name, color, damageType,
  // damageMultiplier, apply, heal } ] }`. Each flask picks a random living target and a random flask from the pool.
  // With `intervalMs` they go one after another (tickCasting), else all at once.
  throwFlasks(hero, skill, slotId, events) {
    const healed = new Set();
    for (let i = 0; i < skill.random.count; i++) if (!this.throwFlask(hero, skill, slotId, healed, events)) return;
  }

  // One flask. Returns false when there is nobody left to throw at.
  throwFlask(hero, skill, slotId, healed, events) {
    const r = skill.random;
    const side = r.target === 'enemy' ? this.enemies.filter((e) => e.alive) : this.heroes.filter((h) => h.alive);
    if (!side.length) return false;
    const flask = r.pool[Math.floor(this.rng() * r.pool.length)];
    // `healsMostHurt`: a healing flask goes to the most hurt hero (lowest health %) not healed yet this cast.
    let target = side[Math.floor(this.rng() * side.length)];
    if (r.healsMostHurt && flask.heal) {
      const open = side.filter((h) => !healed.has(h));
      if (open.length) target = open.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a));
      healed.add(target);
    }
    events.push({ type: 'flask', unit: hero, target, flask });
    this.skillHit(hero, { damageType: flask.damageType, damageMultiplier: flask.damageMultiplier, apply: flask.apply, heal: flask.heal }, `${slotId}_${flask.name}`, target, events);
    // Enemy flasks splash a small area where they land (`splash: { radius, multiplier }`).
    if (r.target === 'enemy' && r.splash) {
      for (const e of this.enemies.filter((x) => x.alive && x !== target && this.hasPositions(x) && this.hasPositions(target) && this.distance(x, target) <= r.splash.radius)) {
        this.skillHit(hero, { damageType: flask.damageType, damageMultiplier: flask.damageMultiplier * r.splash.multiplier, apply: flask.apply }, `${slotId}_${flask.name}_splash`, e, events);
      }
    }
    return true;
  }

  // How much a heal of `spec` { percentMaxHp, attackMultiplier } gives `target` from `healer`.
  healAmount(healer, target, spec) {
    return Math.max(1, Math.round(((spec.percentMaxHp || 0) * target.maxHp) / 100 + (spec.attackMultiplier || 0) * healer.stats.attack));
  }

  // Heals a unit. `amount` is made stronger by the Cleric's aura (unless opts.aura is false: the caller already did it).
  // Healing that would go above full health is "overheal" (Overheal Ring turns it into a shield). A heal
  // that really restored health is a "heal received": the Lost Cleric's Grimoire reacts to it.
  // Returns the health restored.
  healUnit(unit, amount, events, opts = {}) {
    const amp = 1 + ((unit.specials && unit.specials.healAmp) || 0) / 100; // Heart of the Beast: all healing received is stronger
    const raw = Math.round(amount * amp * (opts.aura === false ? 1 : this.regenAura().factor));
    const room = unit.maxHp - unit.hp;
    const got = Math.min(room, raw);
    if (raw - got > 0) this.overheal(unit, raw - got, events);
    if (got <= 0) return 0;
    unit.hp += got;
    events.push({ type: 'heal', unit, amount: got });
    this.onHealed(unit, got, events);
    return got;
  }

  // Overheal Ring: a share of the healing above full health becomes a shield, up to 25% of max health in total.
  overheal(unit, over, events) {
    const pct = unit.specials && unit.specials.overhealRing;
    if (!pct || unit.minion) return;
    const cap = unit.maxHp * 0.25 * (unit.specials.overhealCopies || 1); // +25% max health per ring
    const add = Math.min(cap, over * (Math.min(100, pct) / 100) * (1 + (unit.specials.shieldBonus || 0) / 100));
    if (add < 1) return;
    let st = unit.statuses.find((x) => x.key === 'shield:overheal');
    if (st) st.amount = Math.min(cap, st.amount + add);
    else {
      st = { key: 'shield:overheal', type: 'shield', amount: Math.min(cap, add), maxAmount: cap, remaining: Infinity, total: Infinity, sourceUid: unit.uid, onBreak: null };
      unit.statuses.push(st);
    }
    events.push({ type: 'status', unit, change: 'apply', status: st });
  }

  // The unit was healed for `got` health: Lost Cleric's Grimoire launches green fire at a random enemy
  // (chance per copy, capped; its fireball is item damage: no lifesteal, no other effects).
  onHealed(unit, got, events) {
    const sp = unit.specials;
    if (!sp || !sp.soulEnergy || unit.side !== 'hero' || unit.minion || !unit.alive) return;
    // Lost Cleric's Grimoire: healing received is stored as Soul Energy (100% per copy). At 10% of max health it
    // bursts out as a green fireball dealing 250% of the stored energy (at most one every 0.1s).
    unit.soul = (unit.soul || 0) + (got * sp.soulEnergy) / 100;
    const foes = this.targetableEnemies();
    if (!foes.length || unit.soul < unit.maxHp * 0.1 || (unit.soulCd || 0) > 0) return;
    const target = foes[Math.floor(this.rng() * foes.length)];
    const damage = unit.soul * ((sp.soulDamage || 250) / 100);
    unit.soul = 0;
    unit.soulCd = 100;
    events.push({ type: 'proc', unit, label: 'Grimoire!', itemId: 'lost_clerics_grimoire', target });
    this.strike(unit, target, events, { multiplier: damage / Math.max(1, unit.stats.attack), damageType: 'fire', projectile: 'greenfire', item: true });
  }

  // All enemies in a chain order: from `first`, always to the nearest one not yet hit.
  chainOrder(first) {
    const left = this.enemies.filter((e) => e.alive && e !== first);
    const order = [first];
    let at = first;
    while (left.length) {
      left.sort((a, b) => this.distance(at, a) - this.distance(at, b));
      at = left.shift();
      order.push(at);
    }
    return order;
  }

  // The living hero with the lowest health % (full health counts), for Divine Shield.
  lowestHealthPercent() {
    return this.heroes.filter((h) => h.alive).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  }

  // ---- XP, levels, items --------------------------------------------------------------

  // Splits an enemy's XP between the living heroes. Dead heroes get nothing.
  awardXp(enemy, events) {
    this.kills = (this.kills || 0) + 1; // enemies killed in this run (saved with the run's results)
    const living = this.heroes.filter((h) => h.alive);
    if (!living.length) return;
    const share = ((enemy.def.xp || 0) * (enemy.xpScale ?? 1)) / living.length;
    for (const hero of living) {
      hero.xp += share;
      while (hero.xp >= xpForNextLevel(hero.level, this.leveling)) {
        hero.xp -= xpForNextLevel(hero.level, this.leveling);
        this.levelUp(hero);
        events.push({ type: 'levelup', unit: hero });
      }
    }
  }

  // Raises a hero one level.
  levelUp(hero) {
    hero.level += 1;
    this.refreshStats();
  }

  // Works out every living hero's stats again (level + items + buffs). If max health goes up,
  // current health goes up by the same amount; if it goes down, current health is capped to the
  // new max.
  refreshStats() {
    this.morale = moraleTier(this.heroes);
    for (const hero of this.heroes) {
      if (!hero.alive) continue;
      const levelStats = statsAtLevel(hero.baseStats, hero.def, hero.level);
      const tough = 1 + ((this.rules.heroDefense && this.rules.heroDefense.percent) || 0) / 100; // combat.json heroDefense
      levelStats.defense = (levelStats.defense || 0) * tough;
      levelStats.resist = (levelStats.resist || 0) * tough;
      const { stats, damageBonus, specials, procs, minionSources } = computeHeroStats(hero, this.heroes, this.itemDefs, levelStats, this.rules.morale, this.statUpkeep(hero), this.squadItemMult());
      hero.minionSources = this.buildSources(hero, minionSources);
      const hpDelta = stats.health - hero.maxHp;
      hero.stats = stats;
      hero.damageBonus = damageBonus;
      hero.specials = specials;
      // The hero's own passive can have procs too (Knight's Taunt Wall); they roll like item procs.
      hero.procs = [...procs, ...(((hero.def.passive && hero.def.passive.procs) || []).map((p) => ({ ...p, itemId: `passive_${hero.def.id}` })))];
      hero.maxHp = stats.health;
      hero.hp = Math.max(1, hpDelta > 0 ? hero.hp + hpDelta : Math.min(hero.hp, hero.maxHp));
    }
    for (const e of this.enemies) if (e.alive) this.refreshEnemyStats(e);
    for (const m of this.minions) {
      // A greater minion's item got another copy: it grows (see refreshMinionStats).
      const holder = m.greater && this.heroes.find((h) => h.uid === m.holderUid);
      const src = holder && (holder.minionSources || []).find((x) => x.key === m.sourceKey);
      if (src) m.copies = src.copies;
      this.refreshMinionStats(m);
    }
  }

  // An enemy's stats = its base stats (floor scaling, elite) + its `buff` statuses (Rask & Vesh enrage, Stone Golem,
  // Lava Hound howl). Buffs never change its health.
  refreshEnemyStats(e) {
    const buffs = e.statuses.filter((st) => st.type === 'buff');
    if (!buffs.length && !e.buffed) return;
    e.buffed = buffs.length > 0;
    const stats = { ...e.baseStats };
    for (const st of buffs) {
      for (const mod of st.mods || []) {
        if (!mod.stat || mod.stat === 'health') continue;
        if (mod.percent !== undefined) stats[mod.stat] += ((e.baseStats[mod.stat] || 0) * mod.percent) / 100;
        else stats[mod.stat] = (stats[mod.stat] || 0) + mod.flat;
      }
    }
    stats.health = e.maxHp;
    e.stats = stats;
  }

  // Changes to a hero's stats that come from its current state, not its items: minion upkeep,
  // Spite Mail while taunting, the Archer's Steady Aim.
  statUpkeep(hero) {
    const upkeep = [];
    const paying = this.upkeepCount(hero);
    const mr = this.rules.minions || {};
    if (paying > 0) upkeep.push({ stat: 'attackEfficiency', percent: (mr.upkeepAttackSpeedPercent || 0) * paying }, { stat: 'defense', percent: (mr.upkeepDefensePercent || 0) * paying });
    if (hero.taunting && hero.specials && hero.specials.spiteMail) upkeep.push({ stat: 'defense', flat: hero.specials.spiteMail }); // Spite Mail
    if (hero.lanternGain) upkeep.push({ stat: 'attack', percent: hero.lanternGain }, { stat: 'health', percent: hero.lanternGain }); // Soul Lantern
    const sa = hero.def.passive && hero.def.passive.steadyAim;
    if (sa && hero.steady) upkeep.push({ stat: 'attackEfficiency', percent: sa.attackSpeedPercent }, { stat: 'crit', flat: sa.critFlat });
    if (hero.thirst) upkeep.push({ stat: 'attack', percent: hero.def.passive.bloodthirst.attackPercent }); // Berserker's Bloodthirst
    const iai = hero.def.passive && hero.def.passive.iaido;
    if (iai && iai.evasionFlat) upkeep.push({ stat: 'evasion', flat: iai.evasionFlat }); // Samurai v3: built-in evasion
    const lob = hero.def.passive && hero.def.passive.lobbed;
    if (lob && lob.attackSpeedPercent) upkeep.push({ stat: 'attackEfficiency', percent: lob.attackSpeedPercent }); // Alchemist: slower flasks
    // Bard's March: the whole squad attacks faster while he plays it (Conductor's Baton makes it stronger).
    for (const b of this.bards()) if (b.song === 'march') upkeep.push({ stat: 'attackEfficiency', percent: b.def.passive.songs.march.attackSpeedPercent * (1 + ((b.specials && b.specials.baton) || 0) / 100) });
    return upkeep;
  }

  // Gives a hero an item.
  giveItem(heroUid, itemId) {
    const hero = this.heroes.find((h) => h.uid === heroUid);
    hero.items.push(itemId);
    this.refreshStats();
  }

  // What a hero's stats WOULD be with one more copy of an item (nothing changes).
  previewStats(heroUid, itemId) {
    const hero = this.heroes.find((h) => h.uid === heroUid);
    hero.items.push(itemId);
    const levelStats = statsAtLevel(hero.baseStats, hero.def, hero.level);
    const result = computeHeroStats(hero, this.heroes, this.itemDefs, levelStats, this.rules.morale, this.statUpkeep(hero), this.squadItemMult()); // same state bonuses as now, so before > after compares like with like
    hero.items.pop();
    return result;
  }

  // Rest fountain: the next `fights` fights start with a regen buff of `regenPercentPerSec` on every living hero.
  // A second fountain replaces the first (it does not stack).
  bless(regenPercentPerSec, fights) {
    this.blessing = { regenPercentPerSec, fights };
  }

  // Heals every living hero by a % of their max health. Returns [{ unit, amount }].
  // A trap outside a fight (a Mimic in the Puzzle Room bites): one random living hero loses `percent` of max health,
  // but never dies from it (at least 1 health is left). Returns { unit, amount } or null.
  trapDamage(percent) {
    const alive = this.heroes.filter((h) => h.alive);
    if (!alive.length) return null;
    const unit = alive[Math.floor(this.rng() * alive.length)];
    const amount = Math.min(Math.round((unit.maxHp * percent) / 100), unit.hp - 1);
    unit.hp -= amount;
    return { unit, amount };
  }

  healHeroes(percent) {
    const healed = [];
    for (const h of this.heroes) {
      if (!h.alive) continue;
      const amount = Math.min(Math.round((h.maxHp * percent) / 100), h.maxHp - h.hp);
      h.hp += amount;
      healed.push({ unit: h, amount });
    }
    return healed;
  }

  // The heal after a won floor: the normal % plus each hero's own Aid Kits.
  winHeal(percent) {
    const healed = [];
    for (const h of this.heroes) {
      if (!h.alive) continue;
      const bonus = (h.specials && h.specials.clearHealFlat) || 0; // Aid Kit: +8 health per kit (flat)
      const amount = Math.min(Math.round((h.maxHp * percent) / 100 + bonus), h.maxHp - h.hp);
      h.hp += amount;
      healed.push({ unit: h, amount });
    }
    return healed;
  }

  // Removes every status from the heroes (called when a floor is cleared).
  clearStatuses() {
    for (const h of this.heroes) {
      h.statuses = [];
      h.dotClocks = {};
      h.casting = null;
    }
    this.refreshStats();
  }
}

// Boss rules live in bosses.js (abilities, objects, plates, heat, twins, phylactery, clones, sky phase).
Object.assign(BattleState.prototype, bossMethods, eliteMethods);
