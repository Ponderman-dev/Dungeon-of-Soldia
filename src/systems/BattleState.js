import { bossMethods } from './bosses.js';
import { eliteMethods } from './elites.js';
import { computeDamage } from './combat.js';
import { movementMethods } from './battle/movement.js';
import { minionsMethods } from './battle/minions.js';
import { itemAttacksMethods } from './battle/itemAttacks.js';
import { itemReactionsMethods } from './battle/itemReactions.js';
import { heroesMethods } from './battle/heroes.js';
import { statusesMethods } from './battle/statuses.js';
import { skillsMethods } from './battle/skills.js';
import { skillBooksMethods } from './battle/skillBooks.js';
import { statsMethods } from './battle/stats.js';
import { SKILL_SLOTS } from './battle/constants.js';

export { SKILL_SLOTS }; // every hero's two skill slots, in order (battle/constants.js)

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
//
// THIS FILE is the core: making units, the update loop, basic attacks, strike(), dealing damage, kills. The rest of the
// rules are in ./battle/*.js (movement, minions, itemAttacks, itemReactions, heroes, statuses, skills, skillBooks,
// stats), bosses.js and elites.js: all mixed into BattleState.prototype at the bottom of this file.
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
      // Deep floors snowball: x(1 + percent) per floor past snowballFromFloor, compounding (floors 80+).
      const deep = s.snowballFromFloor ? Math.max(0, floor - s.snowballFromFloor) : 0;
      if (deep) {
        const m = Math.pow(1 + ((s.snowballPercentPerFloor || 0) * growth) / 100, deep);
        stats.health = Math.round(stats.health * m);
        stats.attack = Math.round(stats.attack * m);
      }
      stats.attackEfficiency *= this.rules.enemyAttackSpeedMultiplier ?? 1; // global enemy slowdown
      // Deep floors: attack speed +speedPercentPerFloor% per floor past speedFromFloor, at most speedMaxPercent.
      const fast = s.speedFromFloor ? Math.min(s.speedMaxPercent ?? Infinity, Math.max(0, floor - s.speedFromFloor) * (s.speedPercentPerFloor || 0)) : 0;
      stats.attackEfficiency *= 1 + fast / 100;
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
      walkTo: null, // MOVE ORDER: a floor spot the player sent this hero to { x, y, left } (setMove)
      casting: null, // a skill winding up: { index, remaining, total }
      regenAcc: 0, // health gained from regen this second
      regenClock: 0,
      taunting: false, // Spite Mail: the holder has a taunted enemy
      sinceHit: 0, // ms since the unit last lost health (Archer's Steady Aim)
      steady: false, // Steady Aim is active
      floor: {}, // flags that reset every floor
      xpScale, // fodder give less XP (enemyTiers)
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
    for (const s of unit.statuses) if (s.type === 'shock' || s.type === 'tangled') change += s.attackSpeedPercent; // Tangled: Brood Mother's Sticky Webs
    change += Math.min(0, ...unit.statuses.filter((s) => s.type === 'doom').map((s) => s.attackSpeedPercent || 0)); // Eclipse Idol's Doom: the strongest slow only
    // Bloodrage (Berserker): faster the more health he is missing.
    const rage = unit.def.passive && unit.def.passive.bloodrage;
    if (rage) change += rage.attackSpeedPercentPerMissing * (100 - (100 * unit.hp) / unit.maxHp);
    // Last Stand: faster below `lastStandBelow`% (30) health.
    const ls = unit.side === 'hero' && unit.specials ? unit.specials.lastStandSpeed || 0 : 0;
    if (ls && unit.hp < (unit.maxHp * (unit.specials.lastStandBelow ?? 30)) / 100) change += ls;
    // Opening Horn: faster for the first `openingHornMs` (4s) of every floor.
    if (unit.side === 'hero' && unit.specials && unit.specials.openingHorn && (this.floorMs || 0) < (unit.specials.openingHornMs || 0)) change += unit.specials.openingHorn;
    if (unit.side === 'enemy') change += this.auraSpeed(unit) - this.ghastlySlow(unit); // War Drum; Ghastly Fire burns slow
    const speed = (unit.stats.attackEfficiency / 100) * Math.max(0.2, 1 + change / 100);
    return this.rules.baseAttackIntervalMs / speed;
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

  has(unit, type) {
    return unit.statuses.some((s) => s.type === type);
  }

  // Stunned or frozen: can't attack or cast.
  isStunned(unit) {
    return unit.statuses.some((s) => s.type === 'stun' || s.type === 'freeze' || s.type === 'webbed');
  }

  spawnEnemies(ids, floor) {
    this.floorMs = 0; // the last floor's time must not carry over (Assault Breastplate's icon popped during the walk-in)
    this.focusUid = null;
    this.teamElementsMs = 0;
    this.tornados = [];
    this.bombs = []; // Kobold Sapper bombs on the floor
    this.thunders = []; // Thunderstruck circles growing under enemies
    this.spirits = []; // Reaper's Bell haunting spirits
    for (const h of this.heroes) {
      h.floor = {}; // per-floor flags (Tough Skin used, Second Wind used...)
      h.sigilHits = new Set(); // enemies this hero has already marked (Hunter's Sigil)
      h.streak = { uid: null, count: 0 }; // Brawler's Streak
      h.pending = null; // attacks aimed at the last floor's enemies are gone
      h.foe = null;
      h.order = null; // drag orders end with the floor
      h.walkTo = null; // ...and so do move orders
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

  // MOVE ORDERS (user's pick, session 30/38): drag a hero onto the floor = that hero walks there; tap the floor = the whole
  // squad walks there (side by side, `moveOrders.gatherSpacingPx` apart, in squad order). While walking a hero does not
  // attack (an attack it had started is dropped); on arrival it goes straight back to fighting (a melee hero walks back
  // to its target, a ranged one shoots from its new spot). A move order replaces that hero's drag order (attack order).
  // Fear and knockback still win while they last; a skill wind-up finishes first. Gives up after `moveOrders.maxMs`
  // (blocked in a crowd). Spots are kept inside the fight floor. Returns true when it was set.
  setMove(heroUid, x, y, events = null) {
    const hero = this.heroes.find((h) => h.uid === heroUid);
    if (!hero || !hero.alive || hero.minion || !this.hasPositions(hero)) return false;
    const L = this.rules.movement.layout;
    const MO = this.rules.moveOrders;
    hero.walkTo = {
      x: Math.min(L.width - L.marginX, Math.max(L.marginX, x)),
      y: Math.min(L.heroY, Math.max(L.enemyY + L.topMarginY, y)),
      left: MO.maxMs,
    };
    hero.order = null;
    if (hero.pending) {
      hero.pending = null;
      if (events) events.push({ type: 'attackCancel', unit: hero, reason: 'move' });
    }
    return true;
  }

  // Tap the floor: every living hero walks to the spot, side by side around it. Returns the heroes that got the order.
  moveSquad(x, y, events = null) {
    const living = this.heroes.filter((h) => h.alive && this.hasPositions(h));
    const gap = this.rules.moveOrders.gatherSpacingPx;
    return living.filter((h, i) => this.setMove(h.uid, x + (i - (living.length - 1) / 2) * gap, y, events));
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

  // RANGED minions (Wisp, Imp, Phoenix) stay at the back and shoot. User: enemies went for them instead of the heroes
  // in front, but should still hit them sometimes. So in a random pick they count as `minions.rangedTargetWeight`
  // (0.5) of a normal target, a melee enemy never walks over to one on purpose (`frontDefenders()` for the nearest
  // pick), and one standing in a melee enemy's reach is fair game (random pick among everyone in reach).
  backMinion(u) {
    return !!u.minion && u.damageType !== 'melee';
  }

  frontDefenders() {
    const all = this.defenders();
    const front = all.filter((u) => !this.backMinion(u));
    return front.length ? front : all;
  }

  // A random enemy-side pick from `list`, ranged minions weighted down (see above).
  pickWeighted(list) {
    const w = (this.rules.minions && this.rules.minions.rangedTargetWeight) ?? 1;
    const weight = (u) => (this.backMinion(u) ? w : 1);
    let roll = this.rng() * list.reduce((sum, u) => sum + weight(u), 0);
    for (const u of list) if ((roll -= weight(u)) < 0) return u;
    return list[list.length - 1];
  }

  // Marks a unit dead. Enemies give XP; a dead hero's items stop working.
  killUnit(target, events, killer = null) {
    if (target.def.phylactery && !target.finalDeath) return this.turnToDust(target, events); // Morthul: his crystal appears
    // Phoenix (minions.json `reviveOncePerFloor`): rises again once per floor at that % of max health.
    if (target.minion && target.def.reviveOncePerFloor && !target.floorRevived) {
      target.floorRevived = true;
      target.hp = Math.max(1, Math.round((target.maxHp * target.def.reviveOncePerFloor) / 100));
      target.statuses = target.statuses.filter((st) => !(this.statusDefs[st.type] && this.statusDefs[st.type].debuff));
      events.push({ type: 'minionRevive', unit: target });
      return;
    }
    const was = this.morale;
    const lastStatuses = target.statuses.slice(); // what it was suffering from when it died (item reactions below)
    target.alive = false;
    target.statuses = [];
    target.dotClocks = {};
    target.pending = null; // an attack it had started never lands
    target.casting = null;
    target.moving = false;
    target.walkTo = null;
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
      this.removeMinionsOf(target, 'holderDied', events); // minions vanish when their holder dies
      this.refreshStats();
      if (this.morale !== was) events.push({ type: 'morale', tier: this.morale });
    }
  }

  // An enemy that bursts when it dies (enemies.json `onDeath: { radius, apply: [status specs] }`, e.g.
  // the Puffshroom's poison cloud): every living hero and minion within `radius` px gets the statuses
  // (everyone when there are no positions). Event `deathBurst` (the scene draws the cloud).
  deathBurst(enemy, spec, events) {
    // A delayed burst (Kobold Sapper): a lit bomb is left on the floor and goes off after `delayMs`; whoever still
    // stands in its radius then is hit (nobody walks around it). Its blast = `damageMultiplier` x the enemy's attack.
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

  // Moves the fight forward by dt milliseconds. Returns events for the scene to show.
  update(dt) {
    const events = [];
    this.floorMs = (this.floorMs || 0) + dt;
    this.tickStatuses(dt, events);
    this.move(dt);
    this.tickTornados(dt, events);
    this.tickDelays(dt, events); // Flame Spirit / Moonlight Twinblade hits on their way
    this.tickThunders(dt, events); // Thunderstruck circles, then the bolt
    if (this.spirits && this.spirits.length) this.spirits = this.spirits.filter((x) => (x.remaining -= dt) > 0 && x.target.alive); // Reaper's Bell spirits fade
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
      const sp = hero.specials || {};
      const desperate = sp.desperate && hero.hp < (hero.maxHp * (sp.desperateBelow ?? 30)) / 100 ? sp.desperate : 1; // Heart of the Beast: x2 regen when low
      const regen = (sp.regen || 0) * desperate * aura.factor + aura.base + this.songRegen(); // % of max health per second
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
      if (hero.floor.guardCd > 0) hero.floor.guardCd -= dt; // Martyr's Shield (Bodyguard) cooldown
      if (hero.floor.guard && (hero.floor.guard.remaining -= dt) <= 0) hero.floor.guard = null;
      hero.shareCd = Math.max(0, hero.shareCd - dt);
      if (hero.soulCd > 0) hero.soulCd -= dt; // Grimoire fireball cooldown
      if (hero.barrelCd > 0) hero.barrelCd -= dt; // Bombardier's Barrel cooldown
      if (hero.triageCd > 0) hero.triageCd -= dt; // Aid Kit triage cooldown
      this.tickBandages(hero, dt, events);
      this.tickSong(hero, dt, events);
      this.tickBloodthirst(hero, dt, events);
      this.tickGrace(hero, dt, events);
      this.tickLute(hero, dt, events);
      this.tickWard(hero, dt, events);
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
      if (unit.walkTo) { unit.timer = Math.min(unit.timer, interval); continue; } // walking to a move-order spot: attacks on arrival
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
      if (unit.def.bait) { this.baitTaunt(unit, events); continue; } // Mimic: never attacks, taunts the enemies around it

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
    const lob = unit.def.passive && unit.def.passive.lobbed; // the Alchemist's flask flies slower (`lobbed.flightMs`)
    if (lob && lob.flightMs && unit.damageType !== 'melee') return lob.flightMs;
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
    const coil = this.spendCoil(unit, events, target); // Kinetic Coil: 3 stored dodge charges = a lightning strike
    const pure = this.pureSteel(unit, coil); // Sharpest Blade: an attack with no element at all
    const heart = pure ? this.heartStrike(unit) : 0; // ...every 5th one strikes at the heart
    const plus = (metro || 0) + (pure ? unit.specials.pureSteel || 0 : 0); // Metronome beat + Pure Steel
    const hit = this.strike(unit, target, events, { basic: true, riders: true, ...(coil.length ? { extraRiders: coil } : {}), ...(heart ? { multiplier: heart } : {}), ...(plus ? { damagePercent: plus } : {}), ...(unit.hitType ? { damageType: unit.hitType } : {}) }); // an elite hits with its element; riders = element charms in the same hit
    if (heart && !hit.dodged) {
      events.push({ type: 'proc', unit, label: 'Heart strike!', itemId: 'sharpest_blade', target });
      // Armor break (user): the enemy's defense drops by `heartStrikeBreak`% for a while, for the whole squad.
      if (unit.specials.heartStrikeBreak && target.alive) this.applyStatus(target, { ...(unit.specials.heartStrikeBreakSpec || { status: 'armorBreak', durationMs: 5000 }), defenseFlat: 0, defensePercent: -unit.specials.heartStrikeBreak }, unit, `heartBreak_${unit.uid}`, events);
      // The cut: EXACTLY a share of the enemy's MAX health on top (less on a boss), as item damage (it triggers nothing).
      // Fixed (session 30, user): it went through crits and damage items, so a boss's "4%" landed as 5-15% per strike.
      const cut = target.def.boss ? unit.specials.heartStrikeBossMaxHp || 0 : unit.specials.heartStrikeMaxHp || 0;
      if (cut > 0 && target.alive) this.strike(unit, target, events, { fixedAmount: (target.maxHp * cut) / 100, damageType: unit.damageType, item: true, heartCut: true });
      if (target.alive) this.applyStatus(target, unit.specials.heartStrikeSpec || { status: 'stun', durationMs: 2500 }, unit, `heart_${unit.uid}`, events);
      else unit.floor.nextHeart = true; // Killing spree: a Heart Strike that kills makes the next one a Heart Strike too
    }
    this.sweep(unit, target, hit, events); // Sweeping Strap: every 3rd swing cleaves the enemies in front
    this.fearRing(unit, target, hit, events); // Dread Bell: a ring of fear around the target
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
    this.rollProcs(unit, 'onAttack', events, { target, hit: !hit.dodged, folded: true, force: empower.some((f) => f.counter.forceProcs) });
    this.extraArrows(unit, target, events);
    this.volley(unit, target, events); // Archer: every Nth shot fires at more enemies
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
    // Frozen Demon Head: the holder deals ICE ONLY. Its own fire / electric / dark attacks and skills turn to ice
    // (session 29, user: the Mage and Necromancer were nearly harmless with it); such ITEM hits turn to ice too, at
    // `demonHeadItem`% (50) of their damage (session 31; they used to do nothing).
    if (this.demonHeadBlocks(attacker, opts.damageType || attacker.damageType)) {
      const cut = opts.item ? (attacker.specials.demonHeadItem ?? 50) / 100 : 1;
      opts = { ...opts, damageType: 'ice', ...(opts.item ? { multiplier: (opts.multiplier || 1) * cut, ...(opts.fixedAmount ? { fixedAmount: opts.fixedAmount * cut } : {}) } : {}) };
    }
    // Martyr's Shield (Bodyguard): an enemy hit on a guarded hero goes to the guarding holder instead.
    if (attacker.side === 'enemy' && target.side === 'hero' && !target.minion) {
      const martyr = this.martyrFor(target);
      if (martyr) target = martyr; // the bodyguard takes the whole hit
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
    // opts.riders: this hit carries the attacker's sure extra element hits (computeDamage adds them in; rollProcs then
    // skips their own strike, see `folded`).
    if (opts.riders) opts = { ...opts, riders: [...this.riders(attacker), ...(opts.extraRiders || [])] }; // extraRiders: Kinetic Coil's charges
    else if (opts.fixedRiders) opts = { ...opts, riders: opts.fixedRiders }; // Euclid's extra casts carry the same riders
    if (opts.riders && opts.riders.length) opts = { ...opts, riders: opts.riders.map((rd) => (this.demonHeadBlocks(attacker, rd.damageType) ? { ...rd, damageType: 'ice', multiplier: (rd.multiplier * (attacker.specials.demonHeadItem ?? 50)) / 100 } : rd)) }; // Frozen Demon Head: item riders turn to ice at 50%
    // Chill Band (NUMBING COLD): a CHILLED enemy deals `numbingCold`% less (10, +5 per extra band; the best holder counts).
    if (attacker.side === 'enemy' && this.has(attacker, 'chill')) {
      const numb = Math.max(0, ...this.heroes.map((h) => (h.alive && h.specials && h.specials.numbingCold) || 0));
      if (numb) opts = { ...opts, damagePercent: (opts.damagePercent || 0) - numb };
    }
    // Item damage bonuses of the attacker (Sucker Punch, Full Vigor, Brawler's Streak...).
    const bonus = this.itemDamageBonus(attacker, target, opts);
    if (bonus) opts = { ...opts, damagePercent: (opts.damagePercent || 0) + bonus };
    const op = this.opportunist(attacker);
    if (op && this.isDebuffed(target)) opts = { ...opts, damagePercent: (opts.damagePercent || 0) + op.damagePercent, critBonus: (opts.critBonus || 0) + op.critFlat };
    // Mage's reactions: a different element on top of the last one.
    const react = this.reaction(attacker, target, opts.damageType || attacker.damageType, events);
    if (react.damagePercent) opts = { ...opts, damagePercent: (opts.damagePercent || 0) + react.damagePercent };
    // A rider's element reacts too (Chill Band ice on a fire mark), after the hit's own element; Shatter grows only its part.
    if (opts.riders && opts.riders.length) {
      opts = { ...opts, riders: opts.riders.map((r) => {
        const rr = this.reaction(attacker, target, r.damageType, events);
        if (rr.overload && !react.overload) react.overload = rr.overload;
        return rr.damagePercent ? { ...r, multiplier: r.multiplier * (1 + rr.damagePercent / 100) } : r;
      }) };
    }
    // Samurai's Iaido: every Nth hit on him is parried outright.
    const ia = attacker.side === 'enemy' ? this.iaido(target) : null;
    let forced = false;
    if (ia && target.alive) { target.iaidoHits++; forced = target.iaidoHits % ia.every === 0; }
    // Rogue's DIRTY FIGHTING (passive.dirtyFighting): an enemy he has debuffed misses some of its attacks on HIM.
    const dirty = attacker.side === 'enemy' && target.def.passive && target.def.passive.dirtyFighting;
    if (dirty && attacker.debuffedBy && attacker.debuffedBy.has(target.uid)) opts = { ...opts, extraMissPercent: (opts.extraMissPercent || 0) + dirty.missPercent };
    const shred = target.side === 'enemy' ? this.assaultShred() : 0; // Assault Breastplate: every enemy has less defense
    // opts.fixedAmount: exactly that much, no dodge, crit, armor or bonuses (Sharpest Blade's Heart Strike cut; shields still absorb).
    const result = forced ? { dodged: true, blocked: true, parried: true, crit: false, amount: 0, mult: 1 }
      : opts.fixedAmount ? { dodged: false, crit: false, amount: Math.max(1, Math.round(opts.fixedAmount)), mult: 1 }
        : computeDamage(attacker, target, this.rules, this.damageTypes, this.rng, shred ? { ...opts, defenseShred: shred } : opts);
    if (!result.dodged && attacker.side === 'enemy' && target.side === 'hero') result.amount = this.interceptHit(attacker, target, result.amount, events); // Knight takes his share
    if (!result.dodged && target.side === 'enemy' && !opts.fixedAmount) {
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
    events.push({ type: 'attack', attacker, target, result, skill: opts.skill, damageType: opts.damageType || attacker.damageType, basic: !!opts.basic, ghastly: !!opts.ghastly, noImpact: !!opts.noImpact }); // noImpact: the scene draws its own look (Thunderstruck)
    if (dealt) this.breakEffects(target, dealt.broken, events);
    if (!result.dodged) this.afterItemHit(attacker, target, opts, events);
    if (!result.dodged && (opts.damageType || attacker.hitType || attacker.damageType) === 'dark') this.storeDark(attacker, result.amount - (result.absorbed || 0), events);
    // Frozen Demon Head: the holder's ice damage (the hit's own or its ice riders) fills the Head (not the spikes).
    if (!result.dodged && !opts.spikes) this.storeIce(attacker, (opts.damageType || attacker.hitType || attacker.damageType) === 'ice' ? result.amount - (result.absorbed || 0) : ((result.riders || []).filter((rd) => rd.damageType === 'ice').reduce((t, rd) => t + rd.amount, 0)), events);
    if (!result.dodged && !opts.item) this.euclid(attacker, target, opts, events, result.amount - (result.absorbed || 0)); // Euclid of Elements: 2+ element hits fill the prism
    // Ghastly Fire: the holder's fire hits also deal `ghastly`% (20 per copy) of the damage as DARK (it triggers nothing).
    const gf = attacker.side === 'hero' && !attacker.minion && attacker.specials ? attacker.specials.ghastly || 0 : 0;
    if (gf && !result.dodged && !opts.ghastly && (opts.damageType || attacker.damageType) === 'fire' && target.alive && target.hp > 0 && result.amount > 0) {
      this.strike(attacker, target, events, { multiplier: (result.amount * gf) / 100 / Math.max(1, attacker.stats.attack), damageType: 'dark', item: true, ghastly: true, burst: true });
    }
    if (!result.dodged && attacker.side === 'enemy' && target.side === 'hero') {
      this.onHeroHit(target, events);
      if (target.taunting && target.specials.spiteHeal && target.alive && target.hp > 0) this.healUnit(target, (target.maxHp * target.specials.spiteHeal) / 100, events, { aura: false }); // Spite Mail
      if (!opts.item) this.frostMantle(attacker, target, events);
    }
    if (result.blocked && target.specials.blockCooldownMs) {
      // A successful block sends the holder's Shield Totems on cooldown (only if the item has a `cooldownMs`; phase H: none).
      const spec = { status: 'blockCooldown', durationMs: target.specials.blockCooldownMs || 2500 };
      this.applyStatus(target, spec, target, 'totem', events);
    }
    // Lifesteal, thorns and crit debuffs work on the damage that really got through (nothing if a shield took it all).
    // Fire Heart: an enemy that hits the fire shield catches fire.
    if (dealt && dealt.absorbed > 0 && dealt.burnShield && attacker.alive && attacker.side === 'enemy') this.applyStatus(attacker, { status: 'burn', durationMs: 3000, damageMultiplier: 0.15, damageType: 'fire' }, target, 'fireheart', events);
    if (!result.dodged && !result.fullyAbsorbed && !opts.item) this.afterHit(attacker, target, result.amount - (result.absorbed || 0), events, result);
    if (!result.dodged && !opts.item) this.aegisSpikes(attacker, target, result, events);
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
    // Riposte Cloak: a hit the holder DODGED (evasion only: not a block, a blind miss or invulnerability) is answered.
    if (result.dodged && !result.missed && !result.blocked && !result.invulnerable && !opts.counter && target.side === 'hero' && !target.minion && target.specials.riposte) this.riposte(target, attacker, events);
    // Kinetic Coil v2 (session 31): every hit the holder DODGES (evasion only: no blocks, parries, blind misses) stores a
    // charge (at most `kineticCoilCount`, 3), kept for the floor.
    if (result.dodged && !result.missed && !result.blocked && !result.invulnerable && target.side === 'hero' && !target.minion && target.specials.kineticCoil) {
      target.floor.coil = Math.min(target.specials.kineticCoilCount || 3, (target.floor.coil || 0) + 1);
    }
    return result;
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
        for (const ally of hurt) this.healUnit(ally, base, events, { aura: false, by: attacker });
      }
    }
    // Harvest Scythe: a crit heals the attacker `critHeal`% (8 per copy) of the damage it dealt, at most `critHealCap`%
    // (10) of its max health per crit.
    const reap = (attacker.specials && attacker.specials.critHeal) || 0;
    if (result.crit && reap > 0 && attacker.alive && attacker.side === 'hero') {
      const cap = (attacker.maxHp * (attacker.specials.critHealCap || 100)) / 100;
      const heal = Math.max(1, Math.round(Math.min(cap, ((amount * reap) / 100) * this.regenAura().factor)));
      if (this.healUnit(attacker, heal, events, { aura: false }) > 0) events.push({ type: 'lifesteal', unit: attacker, from: target });
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
      const take = Math.min(Math.ceil(shield.amount), left); // whole points, so the numbers stay whole (shields can hold decimals)
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

  afterDamage(target, events) {
    if (!events || target.side !== 'hero' || target.minion || target.hp <= 0) return;
    this.tryIntercept(target, events); // Knight: jumps in front of a hero who drops low
    this.tryBodyguard(target, events); // Martyr's Shield: its holder takes every hit on a hero who drops low
    this.tryTriage(target, events); // Aid Kit: patches a hero who drops low
    this.tryRally(target, events); // Cautious Banner: a hero dropping low gets a shield
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

  onKill(killer, victim, events, lastStatuses = []) {
    // Elite's Badge (BOUNTY): an elite dies = every living hero heals `bounty`% (10, +5 per extra badge) of max health.
    const bounty = victim.elite ? this.heroes.filter((h) => h.alive).reduce((n, h) => n + (h.specials.bounty || 0), 0) : 0;
    if (bounty > 0) {
      const holder = this.heroes.find((h) => h.alive && h.specials.bounty);
      events.push({ type: 'proc', unit: holder, label: 'Bounty!', itemId: 'elites_badge', target: victim });
      for (const h of this.heroes) if (h.alive) this.healUnit(h, (h.maxHp * bounty) / 100 / this.regenAura().factor, events);
    }
    // Necro Crown: every enemy kill raises a skeleton (for the first living holder).
    if (this.minionBoost().crownKill) {
      const holder = this.heroes.find((h) => h.alive && h.specials.necroCrownKill);
      if (holder) this.spawnMinion(holder, { key: 'necro_crown', kind: 'weak', capGroup: 'crown', upkeep: false, spec: { minion: 'skeleton' } }, events);
    }
    if (killer && killer.side === 'hero' && !killer.minion && killer.alive) {
      const heal = killer.specials.killHeal || 0; // Bandage Roll
      if (heal > 0) this.healUnit(killer, (killer.maxHp * heal) / 100 / this.regenAura().factor, events);
      // Blood Chalice: killing a BLEEDING enemy heals the killer.
      const chalice = killer.specials.chaliceHeal || 0;
      if (chalice > 0 && lastStatuses.some((st) => st.type === 'bleed')) this.healUnit(killer, (killer.maxHp * chalice) / 100 / this.regenAura().factor, events);
      // Conqueror's Flag: every kill heals the OTHER living heroes `conqueror`% (6, +3 per extra) of their max health.
      const conq = killer.specials.conqueror || 0;
      if (conq > 0 && !victim.def.object) {
        const others = this.heroes.filter((h) => h.alive && h !== killer);
        if (others.length) events.push({ type: 'proc', unit: killer, label: 'Conquer!', itemId: 'conquerors_flag' });
        for (const h of others) this.healUnit(h, (h.maxHp * conq) / 100 / this.regenAura().factor, events);
      }
      // Quick Fingers: every kill cuts the killer's skill cooldowns.
      const cut = killer.specials.killCooldownMs || 0;
      if (cut > 0) for (const slot of killer.skills) slot.cooldownLeft = Math.max(0, slot.cooldownLeft - cut);
      // Emergency Buckler: every kill gives the killer a shield that fades away over `killShieldMs` (4s).
      if (killer.specials.killShield) this.applyStatus(killer, { status: 'shield', percentMaxHp: killer.specials.killShield, durationMs: killer.specials.killShieldMs || 4000, fade: true }, killer, 'buckler', events);
      // Reaper's Bell (HAUNTING SPIRITS, session 31): a spirit may rise and haunt another enemy.
      if (killer.specials.reaperBell && !victim.def.object) this.hauntSpirit(killer, victim, events);
    }
    // Life Crystal: when ANY enemy dies, each living holder has `lifeCrystal`% to drop a green orb there that heals
    // the heroes within `lifeCrystalRadius` px of it by `lifeCrystalHeal`% of their max health.
    for (const holder of this.heroes) {
      if (!holder.alive || !holder.specials.lifeCrystal || victim.def.object || this.rng() * 100 >= holder.specials.lifeCrystal) continue;
      const radius = holder.specials.lifeCrystalRadius || 120;
      const near = this.heroes.filter((h) => h.alive && (!this.hasPositions(h) || !this.hasPositions(victim) || Math.hypot(h.x - victim.x, h.y - victim.y) <= radius));
      events.push({ type: 'lifeOrb', unit: holder, at: victim, radius, targets: near });
      for (const h of near) this.healUnit(h, (h.maxHp * (holder.specials.lifeCrystalHeal || 5)) / 100 / this.regenAura().factor, events);
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
}

// The other rule files (see the note above the class). Bosses and elites go last.
Object.assign(BattleState.prototype, movementMethods, minionsMethods, itemAttacksMethods, itemReactionsMethods, heroesMethods, statusesMethods, skillsMethods, skillBooksMethods, statsMethods, bossMethods, eliteMethods);
