import { computeDamage, computeDotDamage } from './combat.js';
import { xpForNextLevel, statsAtLevel } from './leveling.js';
import { computeHeroStats } from './items.js';
import { moraleTier } from './party.js';

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
    this.enemyDefs = enemyDefs;
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

  makeUnit(def, side, floor, fightSize = 1) {
    const stats = { defense: 0, resist: 0, evasion: 0, crit: 0, attackEfficiency: 100, ...def.stats };
    delete stats.mana; // mana is switched off for now (skills run on cooldown only)
    if (side === 'enemy') {
      const s = this.rules.floorScaling;
      // Health and attack grow in steps: +perStep every stepFloors floors.
      const hpSteps = Math.floor((floor - 1) / s.hpStepFloors);
      stats.health = Math.round(stats.health * (1 + s.hpPerStep * hpSteps));
      const atkSteps = Math.floor((floor - 1) / s.attackStepFloors);
      stats.attack = Math.round(stats.attack * (1 + s.attackPerStep * atkSteps));
      stats.attackEfficiency *= this.rules.enemyAttackSpeedMultiplier ?? 1; // global enemy slowdown
      // Fights with 4+ enemies start a bit weaker and ramp up, so floor 21 isn't a cliff.
      const ease = this.rules.bigFightEase;
      if (ease && fightSize >= ease.minEnemies && floor >= ease.fromFloor) {
        const scale = ease.startScale + (1 - ease.startScale) * Math.min(1, (floor - ease.fromFloor) / ease.rampFloors);
        stats.health = Math.round(stats.health * scale);
        stats.attack = Math.round(stats.attack * scale);
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
      alive: true,
      damageType: def.damageType,
      flying: !!def.flying,
      weak: def.weak || [],
      resists: def.resists || [],
      timer: 0,
    };
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
    const speed = (unit.stats.attackEfficiency / 100) * Math.max(0.2, 1 + change / 100);
    return this.rules.baseAttackIntervalMs / speed;
  }

  has(unit, type) {
    return unit.statuses.some((s) => s.type === type);
  }

  // Stunned or frozen: can't attack or cast.
  isStunned(unit) {
    return unit.statuses.some((s) => s.type === 'stun' || s.type === 'freeze');
  }

  spawnEnemies(ids, floor) {
    this.focusUid = null;
    this.tornados = [];
    for (const h of this.heroes) {
      h.floor = {}; // per-floor flags (Tough Skin used, Second Wind used...)
      h.firstHits = new Set(); // enemies this hero has already hit with a basic attack (Sucker Punch)
      h.sigilHits = new Set(); // enemies this hero has already marked (Hunter's Sigil)
      h.streak = { uid: null, count: 0 }; // Brawler's Streak
      h.pending = null; // attacks aimed at the last floor's enemies are gone
      h.foe = null;
      h.casting = null;
    }
    this.enemies = ids.map((id) => this.makeUnit(this.enemyDefs[id], 'enemy', floor, ids.length));
    return this.enemies;
  }

  setFocus(uid) {
    const unit = this.enemies.find((e) => e.uid === uid);
    this.focusUid = unit && unit.alive ? uid : null;
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
    for (const [line, y] of [[this.heroes, L.heroY], [this.enemies, L.enemyY]]) {
      line.forEach((u, i) => this.place(u, (L.width * (i + 0.5)) / line.length, y));
    }
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
    const taunter = this.tauntedBy(unit);
    if (taunter) return taunter;
    const foes = (unit.side === 'hero' ? this.enemies.filter((u) => u.alive) : this.defenders());
    if (!foes.length) return null;
    if (unit.side === 'hero' && !unit.minion) { // minions ignore tap focus
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
    const dx = (target.x - unit.x) / M.reachX;
    const dy = (target.y - unit.y) / M.reachY;
    return dx * dx + dy * dy <= 1;
  }

  // Everyone who can walks this update: melee fighters towards their target (until in reach), feared
  // ones back to their own spot, knocked-back ones get pushed. Then fighters that stand too close push
  // apart a little (`separateX/Y`), so a crowd spreads around a target instead of piling up.
  move(dt) {
    const M = this.rules.movement;
    if (!M) return;
    const units = this.allUnits().filter((u) => u.alive && this.hasPositions(u));
    const before = new Map(units.map((u) => [u, { x: u.x, y: u.y }]));
    const step = (M.walkSpeedPxPerSec * dt) / 1000;
    for (const u of units) {
      if (u.knock) {
        const t = Math.min(dt, u.knock.remaining);
        u.x += u.knock.vx * t;
        u.y += u.knock.vy * t;
        u.knock.remaining -= dt;
        if (u.knock.remaining <= 0) u.knock = null;
        continue;
      }
      if (this.isStunned(u) || u.pending || u.casting) continue; // frozen in place, or busy swinging / casting
      let goal = null;
      if (this.has(u, 'fear')) goal = { x: u.homeX, y: u.homeY, stop: 0 };
      else if (u.damageType === 'melee') {
        const target = this.pickTarget(u);
        if (target && !this.inReach(u, target)) goal = { x: target.x, y: target.y };
      }
      if (!goal) continue;
      const dx = goal.x - u.x;
      const dy = goal.y - u.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.5) continue;
      const d = Math.min(step, len);
      u.x += (dx / len) * d;
      u.y += (dy / len) * d;
    }
    // Push apart. Ranged fighters hold their ground (only the other one moves).
    const push = (M.separatePushPerSec * dt) / 1000;
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        const a = units[i];
        const b = units[j];
        const d = Math.hypot((b.x - a.x) / M.separateX, (b.y - a.y) / M.separateY); // < 1 = too close
        if (d >= 1) continue;
        let nx = b.x - a.x;
        let ny = b.y - a.y;
        let len = Math.hypot(nx, ny);
        if (len < 0.01) {
          nx = a.uid < b.uid ? 1 : -1; // exactly on top of each other: split sideways
          ny = 0;
          len = 1;
        }
        const amount = Math.min(push, (1 - d) * M.separateX);
        const wa = a.damageType === 'melee' || b.damageType !== 'melee' ? 1 : 0;
        const wb = b.damageType === 'melee' || a.damageType !== 'melee' ? 1 : 0;
        a.x -= (nx / len) * amount * (wa / (wa + wb));
        a.y -= (ny / len) * amount * (wa / (wa + wb));
        b.x += (nx / len) * amount * (wb / (wa + wb));
        b.y += (ny / len) * amount * (wb / (wa + wb));
      }
    }
    const L = M.layout;
    for (const u of units) {
      u.x = Math.min(L.width - L.marginX, Math.max(L.marginX, u.x));
      u.y = Math.min(L.heroY, Math.max(L.enemyY + L.topMarginY, u.y));
      const b = before.get(u);
      const moved = Math.hypot(u.x - b.x, u.y - b.y);
      u.moving = moved > 0.05;
      u.walked += moved;
    }
  }

  // Marks a unit dead. Enemies give XP; a dead hero's items stop working.
  killUnit(target, events, killer = null) {
    const was = this.morale;
    const lastStatuses = target.statuses.slice(); // what it was suffering from when it died (item reactions below)
    target.alive = false;
    target.statuses = [];
    target.dotClocks = {};
    target.pending = null; // an attack it had started never lands
    target.casting = null;
    target.moving = false;
    for (const u of this.allUnits()) if (u.foe === target.uid) u.foe = null;
    this.retargetAttacksOn(target, events);
    if (this.focusUid === target.uid) this.focusUid = null;
    events.push({ type: 'death', unit: target });
    if (target.minion) {
      this.minionDied(target, events); // no XP, no morale
      return;
    }
    if (target.side === 'enemy') {
      this.awardXp(target, events);
      this.onKill(killer, target, events, lastStatuses);
    }
    else {
      this.removeMinionsOf(target, 'holderDied', events); // minions vanish when their holder dies
      this.refreshStats();
      if (this.morale !== was) events.push({ type: 'morale', tier: this.morale });
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
      const g = (byItem[src.itemId] = byItem[src.itemId] || { key: src.itemId, kind: src.kind, minion: src.minion, spec: src.spec, onHit: !!src.onHit, copies: 0, upkeep: true });
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
    const sum = { bone: 0, whistle: 0, speed: 0, dust: 0, crown: 0, crownKill: false };
    for (const h of this.heroes) {
      if (!h.alive) continue;
      const sp = h.specials;
      sum.bone += sp.boneCharm || 0;
      sum.whistle += sp.whistleCap || 0;
      sum.speed += sp.whistleSpeed || 0;
      sum.dust += sp.graveDust || 0;
      sum.crown += sp.necroCrownCap || 0;
      sum.crownKill = sum.crownKill || !!sp.necroCrownKill;
    }
    return { bone: sum.bone, weakCap: Math.min(4, sum.whistle) + Math.min(6, sum.crown), weakSpeed: sum.speed, dust: sum.dust, crownKill: sum.crownKill };
  }

  sourceState(hero, key) {
    hero.sourceState = hero.sourceState || {};
    return (hero.sourceState[key] = hero.sourceState[key] || { timer: 0, wait: 0 });
  }

  // The fight of a new floor begins: floor-start minions rise, greater minions that are due come back,
  // spawn timers start over.
  startFloor(events = []) {
    for (const hero of this.heroes) {
      if (!hero.alive) continue;
      hero.sinceHit = 0; // Steady Aim starts counting again with every fight
      // Fire Heart: a fire shield at the start of every floor (20% max health per copy) that slowly regenerates and burns attackers.
      if (hero.specials.fireHeart) {
        const amount = (hero.maxHp * hero.specials.fireHeart) / 100 * (1 + (hero.specials.shieldBonus || 0) / 100);
        hero.statuses = hero.statuses.filter((st) => st.key !== 'shield:fireheart');
        hero.statuses.push({ key: 'shield:fireheart', type: 'shield', amount, maxAmount: amount, remaining: Infinity, total: Infinity, sourceUid: hero.uid, onBreak: null, regenPerSec: amount * 0.05, burns: true });
        events.push({ type: 'status', unit: hero, change: 'apply', status: hero.statuses[hero.statuses.length - 1] });
      }
      for (const src of hero.minionSources || []) {
        const st = this.sourceState(hero, src.key);
        if (src.kind === 'weak' && !src.onHit) {
          st.timer = this.spawnDelay(src.spec);
          for (let i = 0; i < (src.spec.atFloorStart || 0) * (src.burst || 1); i++) this.spawnMinion(hero, src, events);
        } else if (src.kind === 'greater' && st.wait <= 0 && !this.minions.some((m) => m.holderUid === hero.uid && m.sourceKey === src.key)) {
          this.spawnMinion(hero, src, events);
        }
      }
    }
    return events;
  }

  // The floor is won: weak minions vanish; greater ones stay, and a dead one is one floor closer to coming back.
  endFloor(events = []) {
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

  spawnDelay(sp) {
    return sp.minMs + this.rng() * ((sp.maxMs ?? sp.minMs) - sp.minMs);
  }

  tickSpawner(hero, dt, events) {
    if (!this.enemies.some((e) => e.alive)) return; // only while there is a fight
    for (const src of hero.minionSources || []) {
      if (src.kind !== 'weak' || src.onHit) continue;
      const st = this.sourceState(hero, src.key);
      st.timer -= dt;
      if (st.timer > 0) continue;
      st.timer += this.spawnDelay(src.spec);
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
      const cap = (src.capGroup === 'hero' ? src.spec.cap || 4 : this.rules.minions.itemWeakCap) + this.minionBoost().weakCap;
      if (mine.length >= cap) this.vanishMinion(mine[0], 'pushedOut', events);
    }
    const m = this.makeUnit({ id, ...def, stats: { ...def.stats } }, 'hero', 1);
    m.minion = true;
    m.greater = src.kind === 'greater';
    m.holderUid = holder.uid;
    m.sourceKey = src.key;
    m.capGroup = src.capGroup;
    m.upkeep = src.upkeep;
    m.upkeepScale = (src.upkeepScale ?? 1) * (src.kind === 'weak' ? src.copies || 1 : 1); // every copy of a weak spawner item costs upkeep; a greater item once
    m.rawStats = { ...def.stats }; // the stats before copies, boosters and growth (refreshMinionStats scales them)
    m.copies = src.copies || (src.key === 'mimic_chest' ? holder.specials.mimicCopies || 1 : 1);
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
    this.explodeMinion(m, events); // Mimic, Grave Dust
    const holder = this.heroes.find((h) => h.uid === m.holderUid);
    if (m.greater && holder) this.sourceState(holder, m.sourceKey).wait = this.rules.minions.revivalFloors;
    this.refreshStats();
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
    const own = m.def.explode ? m.def.explode.damageMultiplier * (m.copies || 1) : 0;
    const dust = m.greater ? 0 : this.minionBoost().dust * 2; // Grave Dust: 200% attack per copy, weak minions only
    const total = own + dust;
    if (total <= 0) return;
    const radius = (m.def.explode && m.def.explode.radius) || 120;
    events.push({ type: 'minionExplode', unit: m, radius });
    for (const e of this.enemies.filter((x) => x.alive)) {
      if (this.hasPositions(m) && this.hasPositions(e) && Math.hypot(e.x - m.x, e.y - m.y) > radius * 1.6) continue;
      this.strike(m, e, events, { multiplier: total, damageType: 'fire', item: true });
    }
  }

  // A minion's stats: its minions.json stats scaled by copies of its item (copyStatBonus per extra copy), growth per
  // survived floor (Spirit Knight) and the squad's Bone Charms (health and attack); weak minions also attack faster with
  // Overseer's Whistles; plus any buff the squad gave it. Its health keeps the same % when the scale changes.
  refreshMinionStats(m) {
    const raw = m.rawStats || m.baseStats;
    const boost = this.minionBoost();
    const bonus = m.def.copyStatBonus ?? this.rules.minions.copyStatBonus ?? 0;
    const growth = m.def.growthPerFloor ? 1 + Math.min(m.def.growthMax ?? 1, m.def.growthPerFloor * (m.floors || 0)) : 1;
    const scale = (1 + bonus * ((m.copies || 1) - 1)) * growth * (1 + boost.bone / 100);
    const ratio = m.maxHp > 0 ? m.hp / m.maxHp : 1;
    m.maxHp = Math.max(1, Math.round(raw.health * scale));
    m.hp = Math.min(m.maxHp, Math.round(m.maxHp * ratio));
    m.baseStats = { ...raw, health: m.maxHp, attack: Math.round(raw.attack * scale) };
    if (!m.greater) m.baseStats.attackEfficiency = raw.attackEfficiency * (1 + boost.weakSpeed / 100);
    const stats = { ...m.baseStats };
    for (const st of m.statuses) {
      if (st.type !== 'buff') continue;
      for (const mod of st.mods) {
        if (mod.percent !== undefined) stats[mod.stat] += ((m.baseStats[mod.stat] || 0) * mod.percent) / 100;
        else stats[mod.stat] = (stats[mod.stat] || 0) + mod.flat;
      }
    }
    for (const key of ['defense', 'resist', 'evasion', 'crit']) stats[key] = Math.max(0, stats[key] || 0);
    stats.attack = Math.max(1, stats.attack);
    stats.attackEfficiency = Math.max(10, stats.attackEfficiency);
    stats.health = m.maxHp; // buffs never change a minion's health
    m.stats = stats;
  }

  // Moves the fight forward by dt milliseconds. Returns events for the scene to show.
  update(dt) {
    const events = [];
    this.tickStatuses(dt, events);
    this.move(dt);
    for (const m of this.minions) if (m.healCd > 0) m.healCd -= dt; // Phoenix heal cooldown
    this.tickTornados(dt, events);

    // Health regenerates (Heart Charm) and skill cooldowns run down.
    for (const hero of this.heroes) {
      if (!hero.alive) continue;
      // Regen (Heart Charm) and the Cleric's aura: every hero regenerates a little, and regen/heals from items are stronger.
      const aura = this.regenAura();
      const regen = ((hero.specials && hero.specials.regen) || 0) * aura.factor + aura.base; // % of max health per second
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
      this.tickTaunting(hero);
      if (hero.floor.martyrCd > 0) hero.floor.martyrCd -= dt;
      hero.shareCd = Math.max(0, hero.shareCd - dt);
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
      if (unit.casting) continue; // winding up a skill: no basic attacks meanwhile
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
    const fired = this.countBeats(unit, events); // "every Nth attack" passives that go off on THIS attack
    // A heal beat (Cleric): instead of hitting the enemy, the attack heals the most hurt ally.
    for (const f of fired) {
      if (f.counter.effect === 'heal' && this.fireHeal(f.holder, f.counter, events)) return;
    }
    const empower = fired.filter((f) => f.counter.effect === 'empower');
    const hit = this.strike(unit, target, events, { basic: true });
    // Minion hits that put a status on the target (Imp burns, Gargoyle taunts).
    if (unit.minion && unit.def.onAttackApply && target.alive && !hit.dodged) {
      for (const spec of unit.def.onAttackApply) this.applyStatus(target, spec, unit, `minion_${unit.def.id}`, events);
    }
    // An empowered beat (Mage Spellweaver, Bard Rhythm): a free extra hit and debuffs on the target.
    for (const f of empower) {
      const c = f.counter;
      events.push({ type: 'proc', unit, label: c.firedLabel || 'Empowered!' });
      // Metronome (on the counter's holder): the empowered beat hits harder.
      if (c.strike && target.alive) this.strike(unit, target, events, { multiplier: c.strike.damageMultiplier * (1 + ((f.holder.specials.metronome || 0) / 100)), damageType: c.strike.damageType });
      if (target.alive && !hit.dodged) for (const spec of c.apply || []) this.applyStatus(target, spec, unit, `counter_${f.holder.uid}`, events);
    }
    this.rollProcs(unit, 'onAttack', events, { target, hit: !hit.dodged, force: empower.some((f) => f.counter.forceProcs) });
    // Fire Arrows: ranged attacks have a 50% chance (it does not stack) for an extra fire hit; more copies hit harder.
    const fa = unit.specials && unit.specials.fireArrows;
    if (fa && unit.damageType !== 'melee' && target.alive && this.rng() < 0.5) {
      events.push({ type: 'proc', unit, label: 'Fire Arrow!' });
      this.strike(unit, target, events, { multiplier: fa / 100, damageType: 'fire', projectile: 'bomb', item: true });
    }
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
    return { base, factor: 1 + mult / 100 };
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
  countBeats(unit, events) {
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
          events.push({ type: 'beat', unit, holder, counter: c, count: c.every, fired: true });
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
      if (hit) fired.push({ holder, counter: c });
      events.push({ type: 'beat', unit, holder, counter: c, count: hit ? c.every : holder.counterCount, fired: hit });
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
    events.push({ type: 'proc', unit: holder, label: counter.firedLabel || 'Heal!' });
    this.healUnit(ally, amount, events, { aura: false });
    return true;
  }

  // One hit: damage, block cooldown, lifesteal/thorns/crit debuffs, death. Used by basic attacks,
  // skills and item procs. opts: multiplier, damageType (see computeDamage), skill (the skill def),
  // basic (a hero's/enemy's normal attack, not a skill or item hit),
  // projectile ('bomb', 'lightning': the scene draws it flying from the attacker).
  strike(attacker, target, events, opts = {}) {
    // Martyr's Shield: when an enemy hits a hero, another hero holding it may take the hit instead.
    if (attacker.side === 'enemy' && target.side === 'hero' && !target.minion) {
      const martyr = this.martyrFor(target);
      if (martyr) {
        target = martyr;
        events.push({ type: 'proc', unit: martyr, label: 'Martyr!' });
        const copies = martyr.specials.martyrCopies || 1;
        martyr.floor.martyrCd = this.martyrCooldown(copies);
        const cost = Math.max(1, Math.round(martyr.maxHp * 0.03 * Math.pow(0.8, copies - 1))); // health cost (placeholder numbers)
        martyr.hp = Math.max(1, martyr.hp - cost);
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
    const result = computeDamage(attacker, target, this.rules, this.damageTypes, this.rng, opts);
    // Tough Skin: the first hit the holder takes each floor deals much less.
    if (!result.dodged && target.side === 'hero' && target.specials.toughSkin && !target.floor.toughUsed) {
      target.floor.toughUsed = true;
      const cut = Math.min(0.9, 1 - 0.4 * Math.pow(0.75, target.specials.toughSkin - 1));
      result.amount = Math.max(1, Math.round(result.amount * (1 - cut)));
      events.push({ type: 'proc', unit: target, label: 'Tough Skin!' });
    }
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
    if (opts.projectile) events.push({ type: 'projectile', from: opts.from || attacker, to: target, kind: opts.projectile });
    events.push({ type: 'attack', attacker, target, result, skill: opts.skill, damageType: opts.damageType || attacker.damageType, basic: !!opts.basic });
    if (dealt) this.breakEffects(target, dealt.broken, events);
    if (!result.dodged) this.afterItemHit(attacker, target, opts, events);
    if (!result.dodged && attacker.side === 'enemy' && target.side === 'hero') this.onHeroHit(target, events);
    if (result.blocked) {
      // A successful block sends the holder's Shield Totems on cooldown.
      const spec = { status: 'blockCooldown', durationMs: target.specials.blockCooldownMs || 2500 };
      this.applyStatus(target, spec, target, 'totem', events);
    }
    // Lifesteal, thorns and crit debuffs work on the damage that really got through (nothing if a shield took it all).
    // Fire Heart: an enemy that hits the fire shield catches fire.
    if (dealt && dealt.absorbed > 0 && dealt.burnShield && attacker.alive && attacker.side === 'enemy') this.applyStatus(attacker, { status: 'burn', durationMs: 3000, damageMultiplier: 0.15, damageType: 'fire' }, target, 'fireheart', events);
    if (!result.dodged && !result.fullyAbsorbed && !opts.item) this.afterHit(attacker, target, result.amount - (result.absorbed || 0), events, result);
    if (target.hp <= 0 && target.alive) this.killUnit(target, events, attacker);
    return result;
  }

  // Item effects that react to a hit that connected (the attacker's items).
  //  - Shatter Hammer: the hit breaks a freeze.   - Hunter's Sigil: the first hit on each enemy Marks it.
  //  - Frozen Thunderbolt: an electric hit bursts into ice on the enemies next to the target (a burst triggers nothing).
  afterItemHit(attacker, target, opts, events) {
    const sp = attacker.specials;
    if (!sp || attacker.side !== 'hero' || attacker.minion || !target.alive) return;
    if (sp.shatterHammer) {
      const freeze = target.statuses.find((st) => st.type === 'freeze');
      if (freeze) {
        target.statuses.splice(target.statuses.indexOf(freeze), 1);
        events.push({ type: 'status', unit: target, change: 'expire', status: freeze });
        events.push({ type: 'proc', unit: attacker, label: 'Shatter!' });
      }
    }
    if (sp.hunterSigil && !attacker.sigilHits.has(target.uid) && target.side === 'enemy') {
      attacker.sigilHits.add(target.uid);
      const copies = sp.hunterSigil / 10;
      this.applyStatus(target, { status: 'mark', durationMs: 5000 + 2500 * (copies - 1), damageTakenPercent: sp.hunterSigil }, attacker, `sigil_${attacker.uid}`, events);
    }
    if (sp.frozenThunderbolt && (opts.damageType || attacker.damageType) === 'electric' && !opts.burst) {
      for (const e of this.neighbours(target)) {
        this.strike(attacker, e, events, { multiplier: sp.frozenThunderbolt / 100, damageType: 'ice', item: true, burst: true });
        if (e.alive) this.applyStatus(e, { status: 'chill', durationMs: 5000, stacks: 2 }, attacker, 'thunderbolt', events);
      }
    }
  }

  // Extra damage % from the ATTACKER's item specials for this hit.
  //  - suckerPunch: the first BASIC attack on each enemy.   - fullVigor: while the attacker is at full health.
  //  - brawlerMax: +2% per consecutive basic hit on the same target, up to the item's max (basic attacks only).
  itemDamageBonus(attacker, target, opts) {
    const sp = attacker.specials;
    if (!sp || attacker.side !== 'hero' || attacker.minion) return 0;
    let bonus = 0;
    if (opts.basic) {
      if (sp.suckerPunch && !attacker.firstHits.has(target.uid)) bonus += sp.suckerPunch;
      attacker.firstHits.add(target.uid);
      if (sp.brawlerMax) {
        const st = attacker.streak;
        bonus += Math.min(sp.brawlerMax, st.uid === target.uid ? st.count * 2 : 0);
        attacker.streak = { uid: target.uid, count: st.uid === target.uid ? st.count + 1 : 1 };
      }
    }
    if (sp.fullVigor && attacker.hp >= attacker.maxHp) bonus += sp.fullVigor;
    // Bonuses against what the target is suffering from or how hurt it is.
    const kinds = new Set(target.statuses.filter((st) => this.statusDefs[st.type] && this.statusDefs[st.type].debuff).map((st) => st.type));
    if (sp.magmaCore && kinds.has('burn')) bonus += sp.magmaCore; // Magma Core
    if (sp.bloodChalice && kinds.has('bleed')) bonus += sp.bloodChalice; // Blood Chalice
    if (sp.shatterHammer && kinds.has('freeze')) bonus += sp.shatterHammer; // Shatter Hammer (the freeze is broken after the hit)
    if (sp.exploiter && kinds.size >= 3) bonus += sp.exploiter; // Exploiter's Lens
    if (sp.executioner && target.hp < target.maxHp * 0.25) bonus += sp.executioner; // Executioner's Axe
    if (sp.hornDamage && this.has(target, 'taunt')) bonus += sp.hornDamage; // Provoker's Horn: taunted enemies take more
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
      const chance = debuffs ? this.debuffChance(hero, proc.chance) : proc.chance; // Opportunist: his debuffs are likelier
      if (proc.meleeOnly && hero.damageType !== 'melee') continue; // Thousand Cuts: melee hits only
      if (proc.proc !== trigger || (!ctx.force && this.rng() * 100 >= chance)) continue; // ctx.force: every proc goes off
      if (!proc.silent) events.push({ type: 'proc', unit: hero, label: proc.label });
      const enemy = ctx.target && ctx.target.alive ? ctx.target : null;
      let landed = ctx.hit !== false; // statuses on the target need the attack to have connected
      if (proc.doubleHit && enemy) this.strike(hero, enemy, events);
      if (proc.strike && enemy) {
        const hit = this.strike(hero, enemy, events, {
          multiplier: proc.strike.damageMultiplier,
          damageType: proc.strike.damageType,
          projectile: proc.strike.projectile,
          item: true, // damage made BY an item never triggers lifesteal, thorns or other item effects
        });
        landed = !hit.dodged;
      }
      if (proc.chain && enemy) this.chainHit(hero, enemy, proc.chain, events);
      if (proc.tornado && enemy && landed) this.spawnTornado(hero, proc.tornado, enemy, events);
      const targets = proc.targets === 'squad' ? this.squadUnits() : proc.targets === 'target' ? (enemy && landed ? [enemy] : []) : [hero];
      // A status spec can pick its own receivers with `to` (self / squad / target), e.g. a proc that taunts
      // the enemy hit AND gives the holder a defense buff.
      let ally; // Jolly Banner: the holder and ONE random other living hero (picked once per proc)
      const receivers = (to) => (to === 'selfAndAlly' ? (ally = ally || this.randomAlly(hero), ally ? [hero, ally] : [hero]) : to === 'squad' ? this.squadUnits() : to === 'target' ? (enemy && landed ? [enemy] : []) : to === 'self' ? [hero] : targets);
      for (const spec of proc.apply || []) {
        // scalesWithCopies: the status gets stronger with every copy of the item held (Ember Charm's burn).
        let real = spec.scalesWithCopies ? { ...spec, damageMultiplier: spec.damageMultiplier * (proc.copies || 1) } : spec;
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
        if (!t.holder.alive || !t.target.alive) {
          const alive = this.enemies.filter((e) => e.alive);
          if (!alive.length) break;
          t.target = alive[Math.floor(this.rng() * alive.length)];
          events.push({ type: 'tornadoMove', tornado: t, target: t.target });
        }
        this.strike(t.holder, t.target, events, { multiplier: t.spec.damageMultiplier, damageType: t.spec.damageType, item: true });
        t.ticks++;
        if (t.spec.hopEvery && t.ticks % t.spec.hopEvery === 0) {
          const others = this.enemies.filter((e) => e.alive && e !== t.target);
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
  chainHit(hero, first, chain, events) {
    const hit = new Set([first]);
    let from = hero;
    let target = first;
    for (let jump = 0; target; jump++) {
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
    const lifesteal = (attacker.specials && attacker.specials.lifesteal) || 0;
    if (lifesteal > 0 && attacker.alive) {
      const base = Math.max(1, Math.round(((amount * lifesteal) / 100) * this.regenAura().factor)); // the Cleric's aura makes item heals stronger
      this.healUnit(attacker, base, events, { aura: false });
      // Bloodlust Mask: sometimes the heal is shared with the rest of the squad (then a cooldown).
      const share = attacker.specials.lifestealShare || 0;
      if (share > 0 && attacker.shareCd <= 0 && this.rng() * 100 < share) {
        attacker.shareCd = attacker.specials.lifestealShareCooldownMs || 3000;
        events.push({ type: 'proc', unit: attacker, label: 'Life Share!' });
        for (const ally of this.heroes) {
          if (ally !== attacker && ally.alive) this.healUnit(ally, base, events, { aura: false });
        }
      }
    }
    // Gambler's Dice: a crit also gives the enemy a random debuff.
    const dice = attacker.specials && attacker.specials.critDebuffList;
    if (result.crit && dice && dice.length && target.alive && target.hp > 0 && this.rng() * 100 < this.debuffChance(attacker, attacker.specials.critDebuff)) {
      const spec = dice[Math.floor(this.rng() * dice.length)];
      this.applyStatus(target, spec, attacker, `dice_${attacker.uid}`, events);
    }
    const thorns = ((target.specials && target.specials.thorns) || 0) + (target.taunting ? target.specials.spiteReflect || 0 : 0); // Spite Mail adds reflect while taunting
    if (thorns > 0 && target.alive && target.hp > 0 && attacker.damageType === 'melee' && attacker.alive) {
      const back = Math.max(1, Math.round((amount * thorns) / 100));
      const d = this.dealDamage(attacker, back, events);
      if (!d.immune) events.push({ type: 'thorns', unit: attacker, amount: back - d.absorbed });
      this.breakEffects(attacker, d.broken, events);
      if (attacker.hp <= 0 && attacker.alive) this.killUnit(attacker, events);
    }
  }

  // ---- shields and invulnerability ------------------------------------------------------------

  // The ONE place health is taken away by a hit, a damage-over-time tick or thorns.
  //  - Invulnerable: nothing happens (`immune`).
  //  - Shields soak damage first, oldest first. A shield with nothing left is BROKEN (collected in
  //    `broken`, callers pass it to breakEffects() once the hit has been reported).
  // Returns { lost (health lost), absorbed (taken by shields), immune, broken }.
  dealDamage(target, amount, events = null) {
    if (this.has(target, 'invulnerable')) return { lost: 0, absorbed: 0, immune: true, broken: [] };
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
    target.hp = Math.max(0, target.hp - left);
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

  // Things that react to a unit having lost health (called from dealDamage when it has an events list).
  afterDamage(target, events) {
    if (!events || target.side !== 'hero' || target.minion || target.hp <= 0) return;
    // Second Wind Flask: below its threshold ONE flask is used up and heals (once per floor per holder).
    const below = target.specials.secondWindBelow;
    if (target.specials.secondWind && !target.floor.flaskUsed && target.hp < (target.maxHp * below) / 100) {
      const id = this.consumeItem(target, 'secondWind');
      if (id) {
        target.floor.flaskUsed = true;
        events.push({ type: 'proc', unit: target, label: 'Second Wind!' });
        events.push({ type: 'itemUsed', unit: target, itemId: id });
        this.healUnit(target, (target.maxHp * target.specials.secondWind) / 100 / this.regenAura().factor, events);
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
  // A friendly was hit by an enemy: Mimic Chest (10% a Mimic pops out of the holder) and Phoenix (heals the squad a little).
  onHeroHit(target, events) {
    if (!target.minion && target.alive && target.specials.mimic && this.rng() * 100 < target.specials.mimic) {
      const src = { key: 'mimic_chest', kind: 'weak', capGroup: 'items', upkeep: true, upkeepScale: this.rules.minions.upkeepWeakScale ?? 0.5, spec: { minion: 'mimic' }, copies: target.specials.mimicCopies || 1 };
      events.push({ type: 'proc', unit: target, label: 'Mimic!' });
      this.spawnMinion(target, src, events);
    }
    const ph = target.minion && target.alive && target.def.onHitHeal;
    if (ph && !(target.healCd > 0)) {
      target.healCd = ph.cooldownMs;
      const pct = ph.percentMaxHp * (1 + 0.25 * ((target.copies || 1) - 1));
      for (const h of this.heroes) if (h.alive) this.healUnit(h, (h.maxHp * pct) / 100 / this.regenAura().factor, events);
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
      // Plague Flask: HALF of the holder's poison stacks on the dead enemy spread to other enemies (+1 enemy per copy).
      const plague = hero.specials.plagueFlask || 0;
      const poison = mine('poison');
      if (plague > 0 && poison.length) {
        const half = poison.slice(0, Math.ceil(poison.length / 2));
        const others = this.enemies.filter((e) => e.alive && e !== victim).sort((a, b) => this.distance(victim, a) - this.distance(victim, b)).slice(0, plague);
        if (others.length) events.push({ type: 'proc', unit: hero, label: 'Plague!' });
        for (const e of others) for (const st of half) this.addDotStack(e, st);
      }
      // Thousand Cuts: an enemy dying while bleeding bursts knives into the enemies next to it.
      const burst = hero.specials.knifeBurst || 0;
      if (burst > 0 && mine('bleed').length) {
        events.push({ type: 'proc', unit: hero, label: 'Knife burst!' });
        for (const e of this.neighbours(victim)) this.strike(hero, e, events, { multiplier: burst / 100, damageType: 'melee', item: true });
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
        events.push({ type: 'proc', unit, label: 'Aegis blast!' });
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
    const scale = info.control ? target.def.statusDurationScale ?? 1 : 1;
    // A shield with no durationMs lasts until it is broken.
    // Catalyst (Alchemist): debuffs on ENEMIES last longer.
    const cat = target.side === 'enemy' && this.statusDefs[spec.status] && this.statusDefs[spec.status].debuff ? this.catalyst() : { dur: 1, dot: 1 };
    const duration = (spec.durationMs ?? (spec.status === 'shield' ? Infinity : 0)) * scale * cat.dur;
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
      status = stacking ? null : target.statuses.find((s) => s.key === key);
      if (!status) {
        status = { key, type: spec.status };
        target.statuses.push(status);
      }
      status.remaining = duration;
      status.total = duration;
      if (spec.status === 'buff') status.mods = spec.mods;
      if (spec.status === 'taunt') status.sourceUid = source.uid;
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
        // Damage-type items boost damage over time of that type too (e.g. +15% dark boosts poison).
        const bonus = ((source.damageBonus && source.damageBonus[status.damageType]) || 0) / 100;
        status.damage = Math.max(1, Math.round(source.stats.attack * spec.damageMultiplier * (1 + bonus) * cat.dot));
        if (!(spec.status in target.dotClocks)) target.dotClocks[spec.status] = 0; // first stack: start the tick clock
      }
    }
    if (spec.status === 'buff') this.refreshStats();
    events.push({ type: 'status', unit: target, change: 'apply', status });
    if (spec.status === 'taunt') this.redirectToTaunter(target, events);
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
        const total = stacks.reduce((sum, s) => sum + s.damage, 0);
        const { damageType, ignoresArmor } = stacks[0];
        const amount = computeDotDamage(unit, total, damageType, this.rules, this.damageTypes, { ignoresArmor });
        const d = this.dealDamage(unit, amount, events);
        events.push({ type: 'dot', unit, amount: d.immune ? 0 : amount - d.absorbed, absorbed: d.absorbed, immune: d.immune, damageType, status: type, stacks: stacks.length });
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
    return { ...base, ...base.rotation[(slot.rotation || 0) % base.rotation.length] };
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
    slot.cooldownLeft = skill.cooldownMs * (1 - Math.min(50, hero.specials.cooldown || 0) / 100); // Hourglass
    const castMs = this.castTime(skill);
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
    if (!this.targetsAllies(skill) && !this.enemies.some((e) => e.alive)) {
      events.push({ type: 'castCancel', unit: hero, skill, reason: 'noTarget' });
      return;
    }
    if (!echo && this.skillDefs[slot.id].rotation) slot.rotation = ((slot.rotation || 0) + 1) % this.skillDefs[slot.id].rotation.length; // next spell next time

    let targets;
    if (skill.random) targets = [];
    else if (skill.target === 'self') targets = [hero];
    else if (skill.target === 'squad') targets = this.squadUnits(); // every living hero and minion
    else if (skill.target === 'lowestAlly') targets = [this.lowestHealthPercent()];
    else if (skill.target === 'allEnemies') targets = this.enemies.filter((e) => e.alive);
    else targets = [this.pickTarget(hero)];
    if (skill.chain && targets[0]) targets = this.chainOrder(targets[0]); // Chain Lightning: through ALL enemies, nearest next
    const splash = (hero.specials && hero.specials.skillSplash) || 0; // Siege Cannon: % chance to hit the neighbours too
    if (skill.target === 'enemy' && skill.damageMultiplier && splash > 0 && this.rng() * 100 < splash) {
      const near = this.neighbours(targets[0]);
      if (near.length) {
        targets = [...targets, ...near];
        events.push({ type: 'proc', unit: hero, label: 'Splash!' });
      }
    }

    events.push({ type: 'cast', unit: hero, skill, targets });
    // `cleanse: N`: every target loses N debuffs (a whole kind each, the oldest first).
    if (skill.cleanse) for (const t of targets) this.cleanse(t, skill.cleanse, events);
    // `applyEnemies`: statuses every living enemy gets (Smoke Bomb: blind).
    for (const spec of skill.applyEnemies || []) for (const e of this.enemies.filter((x) => x.alive)) this.applyStatus(e, spec, hero, slot.id, events);

    if (skill.channel) {
      // A channel: after the cast it keeps firing waves; the hero is busy until the last one.
      const ch = skill.channel;
      hero.casting = { index, remaining: ch.waves.length * ch.intervalMs, total: ch.waves.length * ch.intervalMs, channel: { skill, slotId: slot.id, waves: ch.waves, intervalMs: ch.intervalMs, timer: 0, wave: 0 } };
      return;
    }
    if (skill.random) {
      this.throwFlasks(hero, skill, slot.id, events);
      return;
    }
    let first = true;
    for (const target of targets) {
      this.skillHit(hero, skill, slot.id, target, events, { jumpFrom: skill.chain && !first ? targets[targets.indexOf(target) - 1] : null, scale: echo ? echo.power : 1 });
      first = false;
      // Fireball: the neighbours of its target are hit too, for a share of the damage, with the same debuffs.
      if (skill.splash && target === targets[0] && skill.target === 'enemy') {
        for (const n of this.neighbours(target)) this.skillHit(hero, skill, slot.id, n, events, { multiplier: skill.splash.damageMultiplier, scale: echo ? echo.power : 1 });
      }
    }
    // Echo Rune: a skill sometimes casts a second time (the echo cannot echo, the Mage's rotation does not move again).
    // Channels (Rain of Arrows, Crescendo) do not echo.
    const chance = hero.specials.echo || 0;
    if (!echo && chance > 0 && !skill.channel && this.rng() * 100 < chance) {
      events.push({ type: 'proc', unit: hero, label: 'Echo!' });
      const copies = hero.specials.echoCopies || 1;
      this.releaseSkill(hero, index, events, { spell: skill, power: Math.min(1, 0.6 + 0.1 * (copies - 1)) });
    }
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
    const base = opts.multiplier ?? skill.damageMultiplier;
    if (base) {
      let mult = base * (1 + ((hero.specials && hero.specials.skillDamage) || 0) / 100) * (opts.scale ?? 1);
      // Bonus damage against certain enemies: `debuffedMultiplier` (any debuff: Smite, Death Coil), `bonusVs`
      // (a list of { status, multiplier }: Chain Lightning vs burning/frozen), `doubleIf` (x2 if the target
      // is bleeding / below half health: Savage Leap).
      if (skill.debuffedMultiplier && this.isDebuffed(target)) mult *= skill.debuffedMultiplier;
      for (const b of skill.bonusVs || []) if (target.statuses.some((st) => st.type === b.status)) mult *= b.multiplier;
      if (skill.doubleIf && skill.doubleIf.some((c) => (c === 'bleed' ? this.has(target, 'bleed') : c === 'below50' ? target.hp < target.maxHp / 2 : false))) mult *= 2;
      result = this.strike(hero, target, events, {
        multiplier: mult,
        damageType: skill.damageType,
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
    const mult = ch.waves[ch.wave];
    const targets = this.enemies.filter((e) => e.alive);
    events.push({ type: 'wave', unit: hero, skill: ch.skill, wave: ch.wave, waves: ch.waves.length, targets });
    for (const t of targets) {
      const res = this.skillHit(hero, { ...ch.skill, apply: null, onCrit: ch.skill.onCrit }, ch.slotId, t, events, { multiplier: mult });
      if (res && !res.dodged && t.alive) for (const spec of ch.skill.waveApply || []) if (this.rng() * 100 < (spec.chance ?? 100)) this.applyStatus(t, spec, hero, ch.slotId, events);
    }
    ch.wave++;
  }

  // Alchemist flasks: `random: { count, target: 'enemy' | 'ally', pool: [ { name, color, damageType,
  // damageMultiplier, apply, heal } ] }`. Each flask picks a random living target and a random flask from the pool.
  throwFlasks(hero, skill, slotId, events) {
    const r = skill.random;
    for (let i = 0; i < r.count; i++) {
      const side = r.target === 'enemy' ? this.enemies.filter((e) => e.alive) : this.heroes.filter((h) => h.alive);
      if (!side.length) return;
      const target = side[Math.floor(this.rng() * side.length)];
      const flask = r.pool[Math.floor(this.rng() * r.pool.length)];
      events.push({ type: 'flask', unit: hero, target, flask });
      this.skillHit(hero, { damageType: flask.damageType, damageMultiplier: flask.damageMultiplier, apply: flask.apply, heal: flask.heal }, `${slotId}_${flask.name}`, target, events);
    }
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
    const raw = Math.round(amount * (opts.aura === false ? 1 : this.regenAura().factor));
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
    const cap = unit.maxHp * 0.25;
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
    if (!sp || !sp.grimoireChance || unit.side !== 'hero' || unit.minion || !unit.alive) return;
    const foes = this.enemies.filter((e) => e.alive);
    if (!foes.length || this.rng() * 100 >= sp.grimoireChance) return;
    const target = foes[Math.floor(this.rng() * foes.length)];
    events.push({ type: 'proc', unit, label: 'Grimoire!' });
    this.strike(unit, target, events, { multiplier: sp.grimoireDamage / 100, damageType: 'fire', projectile: 'greenfire', item: true });
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
    const share = (enemy.def.xp || 0) / living.length;
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
      const upkeep = [];
      const paying = this.upkeepCount(hero);
      const mr = this.rules.minions || {};
      if (paying > 0) upkeep.push({ stat: 'attackEfficiency', percent: (mr.upkeepAttackSpeedPercent || 0) * paying }, { stat: 'defense', percent: (mr.upkeepDefensePercent || 0) * paying });
      if (hero.taunting && hero.specials && hero.specials.spiteMail) upkeep.push({ stat: 'defense', flat: hero.specials.spiteMail }); // Spite Mail
      const sa = hero.def.passive && hero.def.passive.steadyAim;
      if (sa && hero.steady) upkeep.push({ stat: 'attackEfficiency', percent: sa.attackSpeedPercent }, { stat: 'crit', flat: sa.critFlat });
      const { stats, damageBonus, specials, procs, minionSources } = computeHeroStats(hero, this.heroes, this.itemDefs, levelStats, this.rules.morale, upkeep);
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
    for (const m of this.minions) {
      // A greater minion's item got another copy: it grows (see refreshMinionStats).
      const holder = m.greater && this.heroes.find((h) => h.uid === m.holderUid);
      const src = holder && (holder.minionSources || []).find((x) => x.key === m.sourceKey);
      if (src) m.copies = src.copies;
      this.refreshMinionStats(m);
    }
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
    const result = computeHeroStats(hero, this.heroes, this.itemDefs, levelStats, this.rules.morale);
    hero.items.pop();
    return result;
  }

  // Heals every living hero by a % of their max health. Returns [{ unit, amount }].
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
      const bonus = (h.specials && h.specials.clearHeal) || 0;
      const amount = Math.min(Math.round((h.maxHp * (percent + bonus)) / 100), h.maxHp - h.hp);
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
