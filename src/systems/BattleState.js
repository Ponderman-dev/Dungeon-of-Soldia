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
  constructor({ heroDefs, enemyDefs, itemDefs = {}, skillDefs = {}, statusDefs = {}, rules, damageTypes, leveling, rng = Math.random }) {
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
    this.heroes = heroDefs.map((d) => this.makeUnit(d, 'hero', 1));
    this.enemies = [];
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
    for (const h of this.heroes) {
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
    const taunt = unit.statuses.find((s) => s.type === 'taunt');
    if (taunt) {
      const taunter = [...this.heroes, ...this.enemies].find((u) => u.uid === taunt.sourceUid);
      if (taunter && taunter.alive && taunter.side !== unit.side) return taunter;
    }
    const foes = (unit.side === 'hero' ? this.enemies : this.heroes).filter((u) => u.alive);
    if (!foes.length) return null;
    if (unit.side === 'hero') {
      const focus = foes.find((e) => e.uid === this.focusUid);
      if (focus) return this.setFoe(unit, focus);
    }
    if (unit.damageType !== 'melee') return foes[Math.floor(this.rng() * foes.length)];
    const current = foes.find((u) => u.uid === unit.foe);
    if (current) return current;
    return this.setFoe(unit, this.nearest(unit, foes));
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
    const units = [...this.heroes, ...this.enemies].filter((u) => u.alive && this.hasPositions(u));
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
  killUnit(target, events) {
    const was = this.morale;
    target.alive = false;
    target.statuses = [];
    target.dotClocks = {};
    target.pending = null; // an attack it had started never lands
    target.casting = null;
    target.moving = false;
    for (const u of [...this.heroes, ...this.enemies]) if (u.foe === target.uid) u.foe = null;
    this.retargetAttacksOn(target, events);
    if (this.focusUid === target.uid) this.focusUid = null;
    events.push({ type: 'death', unit: target });
    if (target.side === 'enemy') this.awardXp(target, events);
    else {
      this.refreshStats();
      if (this.morale !== was) events.push({ type: 'morale', tier: this.morale });
    }
  }

  // Moves the fight forward by dt milliseconds. Returns events for the scene to show.
  update(dt) {
    const events = [];
    this.tickStatuses(dt, events);
    this.move(dt);

    // Health regenerates (Heart Charm) and skill cooldowns run down.
    for (const hero of this.heroes) {
      if (!hero.alive) continue;
      const regen = (hero.specials && hero.specials.regen) || 0; // % of max health per second
      if (regen > 0) hero.hp = Math.min(hero.maxHp, hero.hp + (hero.maxHp * regen * dt) / 100000);
      hero.shareCd = Math.max(0, hero.shareCd - dt);
      for (const slot of hero.skills) slot.cooldownLeft = Math.max(0, slot.cooldownLeft - dt);
      this.tickCasting(hero, dt, events);
    }

    for (const unit of [...this.heroes, ...this.enemies]) {
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
    for (const unit of [...this.heroes, ...this.enemies]) {
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
    const hit = this.strike(unit, target, events, { basic: true });
    this.rollProcs(unit, 'onAttack', events, { target, hit: !hit.dodged });
  }

  // One hit: damage, block cooldown, lifesteal/thorns/crit debuffs, death. Used by basic attacks,
  // skills and item procs. opts: multiplier, damageType (see computeDamage), skill (the skill def),
  // basic (a hero's/enemy's normal attack, not a skill or item hit),
  // projectile ('bomb', 'lightning': the scene draws it flying from the attacker).
  strike(attacker, target, events, opts = {}) {
    const result = computeDamage(attacker, target, this.rules, this.damageTypes, this.rng, opts);
    if (!result.dodged) target.hp = Math.max(0, target.hp - result.amount);
    if (opts.projectile) events.push({ type: 'projectile', from: opts.from || attacker, to: target, kind: opts.projectile });
    events.push({ type: 'attack', attacker, target, result, skill: opts.skill, damageType: opts.damageType || attacker.damageType, basic: !!opts.basic });
    if (result.blocked) {
      // A successful block sends the holder's Shield Totems on cooldown.
      const spec = { status: 'blockCooldown', durationMs: target.specials.blockCooldownMs || 2500 };
      this.applyStatus(target, spec, target, 'totem', events);
    }
    if (!result.dodged) this.afterHit(attacker, target, result.amount, events, result);
    if (target.hp <= 0 && target.alive) this.killUnit(target, events);
    return result;
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
      if (proc.proc !== trigger || this.rng() * 100 >= proc.chance) continue;
      if (!proc.silent) events.push({ type: 'proc', unit: hero, label: proc.label });
      const enemy = ctx.target && ctx.target.alive ? ctx.target : null;
      let landed = ctx.hit !== false; // statuses on the target need the attack to have connected
      if (proc.doubleHit && enemy) this.strike(hero, enemy, events);
      if (proc.strike && enemy) {
        const hit = this.strike(hero, enemy, events, {
          multiplier: proc.strike.damageMultiplier,
          damageType: proc.strike.damageType,
          projectile: proc.strike.projectile,
        });
        landed = !hit.dodged;
      }
      if (proc.chain && enemy) this.chainHit(hero, enemy, proc.chain, events);
      const targets = proc.targets === 'squad' ? this.heroes.filter((h) => h.alive) : proc.targets === 'target' ? (enemy && landed ? [enemy] : []) : [hero];
      for (const spec of proc.apply || []) {
        for (const target of targets) this.applyStatus(target, spec, hero, `proc_${proc.itemId}`, events);
      }
    }
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
      this.strike(hero, target, events, { multiplier: chain.damageMultiplier, damageType: chain.damageType, projectile: 'lightning', from });
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
      const base = Math.max(1, Math.round((amount * lifesteal) / 100));
      const heal = Math.min(attacker.maxHp - attacker.hp, base);
      if (heal > 0) {
        attacker.hp += heal;
        events.push({ type: 'heal', unit: attacker, amount: heal });
      }
      // Bloodlust Mask: sometimes the heal is shared with the rest of the squad (then a cooldown).
      const share = attacker.specials.lifestealShare || 0;
      if (share > 0 && attacker.shareCd <= 0 && this.rng() * 100 < share) {
        attacker.shareCd = attacker.specials.lifestealShareCooldownMs || 3000;
        events.push({ type: 'proc', unit: attacker, label: 'Life Share!' });
        for (const ally of this.heroes) {
          const got = ally === attacker || !ally.alive ? 0 : Math.min(ally.maxHp - ally.hp, base);
          if (got <= 0) continue;
          ally.hp += got;
          events.push({ type: 'heal', unit: ally, amount: got });
        }
      }
    }
    // Gambler's Dice: a crit also gives the enemy a random debuff.
    const dice = attacker.specials && attacker.specials.critDebuffList;
    if (result.crit && dice && dice.length && target.alive && target.hp > 0 && this.rng() * 100 < attacker.specials.critDebuff) {
      const spec = dice[Math.floor(this.rng() * dice.length)];
      this.applyStatus(target, spec, attacker, `dice_${attacker.uid}`, events);
    }
    const thorns = (target.specials && target.specials.thorns) || 0;
    if (thorns > 0 && target.alive && target.hp > 0 && attacker.damageType === 'melee' && attacker.alive) {
      const back = Math.max(1, Math.round((amount * thorns) / 100));
      attacker.hp = Math.max(0, attacker.hp - back);
      events.push({ type: 'thorns', unit: attacker, amount: back });
      if (attacker.hp <= 0) this.killUnit(attacker, events);
    }
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
    const duration = spec.durationMs * scale;
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
        status.damageType = spec.damageType || info.damageType || 'dark';
        status.ignoresArmor = spec.ignoresArmor ?? !!info.ignoresArmor;
        // Damage-type items boost damage over time of that type too (e.g. +15% dark boosts poison).
        const bonus = ((source.damageBonus && source.damageBonus[status.damageType]) || 0) / 100;
        status.damage = Math.max(1, Math.round(source.stats.attack * spec.damageMultiplier * (1 + bonus)));
        if (!(spec.status in target.dotClocks)) target.dotClocks[spec.status] = 0; // first stack: start the tick clock
      }
    }
    if (spec.status === 'buff') this.refreshStats();
    events.push({ type: 'status', unit: target, change: 'apply', status });

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
    for (const unit of [...this.heroes, ...this.enemies]) {
      if (!unit.alive) continue;
      for (const status of unit.statuses) status.remaining -= dt;
      this.tickDots(unit, dt, events);
      if (!unit.alive) continue;
      for (const status of [...unit.statuses]) {
        if (status.remaining > 0) continue;
        unit.statuses.splice(unit.statuses.indexOf(status), 1);
        if (status.type === 'buff') buffEnded = true;
        events.push({ type: 'status', unit, change: 'expire', status });
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
      unit.dotClocks[type] += dt;
      while (unit.dotClocks[type] >= tickMs && unit.alive) {
        unit.dotClocks[type] -= tickMs;
        const total = stacks.reduce((sum, s) => sum + s.damage, 0);
        const { damageType, ignoresArmor } = stacks[0];
        const amount = computeDotDamage(unit, total, damageType, this.rules, this.damageTypes, { ignoresArmor });
        unit.hp = Math.max(0, unit.hp - amount);
        events.push({ type: 'dot', unit, amount, damageType, status: type, stacks: stacks.length });
        if (unit.hp <= 0) this.killUnit(unit, events);
      }
    }
  }

  // ---- skills -------------------------------------------------------------------------

  // Can this hero cast this skill right now? Returns false if not (dead, stunned, cooling down,
  // or nothing to aim at). Skills cost no mana: only the cooldown limits them.
  canCast(hero, index) {
    const slot = hero.skills[index];
    if (!slot || !hero.alive || hero.casting || this.isStunned(hero) || this.has(hero, 'silence')) return false;
    const skill = this.skillDefs[slot.id];
    if (slot.cooldownLeft > 0) return false;
    if (skill.target === 'self') return true;
    return this.enemies.some((e) => e.alive);
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
    const skill = this.skillDefs[slot.id];
    slot.cooldownLeft = skill.cooldownMs;
    const castMs = this.castTime(skill);
    if (castMs <= 0) {
      this.releaseSkill(hero, index, events);
      return events;
    }
    hero.casting = { index, remaining: castMs, total: castMs };
    events.push({ type: 'castStart', unit: hero, skill, index, castMs });
    return events;
  }

  // A wind-up runs down. Stunned, frozen or silenced meanwhile: the skill is LOST (it stays on
  // cooldown, the user's choice).
  tickCasting(hero, dt, events) {
    if (!hero.casting) return;
    const slot = hero.skills[hero.casting.index];
    const skill = this.skillDefs[slot.id];
    if (this.isStunned(hero) || this.has(hero, 'silence')) {
      hero.casting = null;
      events.push({ type: 'castCancel', unit: hero, skill, reason: 'interrupted' });
      return;
    }
    hero.casting.remaining -= dt;
    if (hero.casting.remaining > 0) return;
    const { index } = hero.casting;
    hero.casting = null;
    this.releaseSkill(hero, index, events);
  }

  // The skill goes off. One-target skills hit the focused enemy, else the hero's usual target
  // (picked now, at the end of the wind-up).
  releaseSkill(hero, index, events) {
    const slot = hero.skills[index];
    const skill = this.skillDefs[slot.id];
    if (skill.target !== 'self' && !this.enemies.some((e) => e.alive)) {
      events.push({ type: 'castCancel', unit: hero, skill, reason: 'noTarget' });
      return;
    }

    let targets;
    if (skill.target === 'self') targets = [hero];
    else if (skill.target === 'allEnemies') targets = this.enemies.filter((e) => e.alive);
    else targets = [this.pickTarget(hero)];
    const splash = (hero.specials && hero.specials.skillSplash) || 0; // Siege Cannon: % chance to hit the neighbours too
    if (skill.target === 'enemy' && skill.damageMultiplier && splash > 0 && this.rng() * 100 < splash) {
      const near = this.neighbours(targets[0]);
      if (near.length) {
        targets = [...targets, ...near];
        events.push({ type: 'proc', unit: hero, label: 'Splash!' });
      }
    }

    events.push({ type: 'cast', unit: hero, skill, targets });

    for (const target of targets) {
      if (skill.damageMultiplier) {
        const result = this.strike(hero, target, events, {
          multiplier: skill.damageMultiplier * (1 + ((hero.specials && hero.specials.skillDamage) || 0) / 100),
          damageType: skill.damageType,
          skill,
        });
        if (result.dodged || !target.alive) continue;
      }
      for (const spec of skill.apply || []) this.applyStatus(target, spec, hero, slot.id, events);
    }
  }

  // ---- XP, levels, items --------------------------------------------------------------

  // Splits an enemy's XP between the living heroes. Dead heroes get nothing.
  awardXp(enemy, events) {
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
      const { stats, damageBonus, specials, procs } = computeHeroStats(hero, this.heroes, this.itemDefs, levelStats, this.rules.morale);
      const hpDelta = stats.health - hero.maxHp;
      hero.stats = stats;
      hero.damageBonus = damageBonus;
      hero.specials = specials;
      hero.procs = procs;
      hero.maxHp = stats.health;
      hero.hp = Math.max(1, hpDelta > 0 ? hero.hp + hpDelta : Math.min(hero.hp, hero.maxHp));
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
