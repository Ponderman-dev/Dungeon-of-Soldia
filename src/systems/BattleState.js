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
//         attackRetarget (an attack in progress lost its target, it now goes for { target, hitInMs })
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
      engagedUid: null, // melee: the uid of the unit it is standing next to (then it only needs to swing)
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
      h.engagedUid = null;
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

  // Where a unit stands across the screen, 0 (left) to 1 (right), from its slot in its line.
  lane(unit) {
    const line = unit.side === 'hero' ? this.heroes : this.enemies;
    return (line.indexOf(unit) + 0.5) / line.length;
  }

  // The unit in `list` standing closest across the screen (ties broken at random).
  nearest(unit, list) {
    let best = null;
    let bestDist = Infinity;
    for (const other of list) {
      const dist = Math.abs(this.lane(other) - this.lane(unit)) + this.rng() * 0.001;
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
  //    dies, then take the nearest enemy. Ranged heroes pick any enemy at random.
  //  - Melee enemies keep their opponent too. A new one: usually the nearest MELEE hero (the front
  //    line), but `backlineTargetChance` % of the time a ranged hero behind it. No melee heroes left:
  //    the nearest hero. Ranged enemies pick at random.
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
    if (unit.side === 'hero') return this.setFoe(unit, this.nearest(unit, foes));
    const front = foes.filter((h) => h.damageType === 'melee');
    const back = foes.filter((h) => h.damageType !== 'melee');
    const chance = (this.rules.attackTiming && this.rules.attackTiming.backlineTargetChance) || 0;
    const goBack = !front.length || (back.length && this.rng() * 100 < chance);
    return this.setFoe(unit, this.nearest(unit, goBack ? back : front));
  }

  setFoe(unit, foe) {
    unit.foe = foe ? foe.uid : null;
    return foe;
  }

  // Two units stand next to each other if either one walked over to the other.
  standingTogether(a, b) {
    return a.engagedUid === b.uid || b.engagedUid === a.uid;
  }

  // A melee unit leaves where it stood (it walks to someone else, or is knocked back): it is no
  // longer standing next to anyone, and anyone who was standing next to it has to walk in again
  // (except `goingTo`, the unit it is walking over to).
  breakEngagement(unit, goingTo = null) {
    unit.engagedUid = null;
    for (const other of [...this.heroes, ...this.enemies]) if (other.engagedUid === unit.uid && other !== goingTo) other.engagedUid = null;
  }

  // Marks a unit dead. Enemies give XP; a dead hero's items stop working.
  killUnit(target, events) {
    const was = this.morale;
    target.alive = false;
    target.statuses = [];
    target.dotClocks = {};
    target.pending = null; // an attack it had started never lands
    this.breakEngagement(target);
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

    // Health regenerates (Heart Charm) and skill cooldowns run down.
    for (const hero of this.heroes) {
      if (!hero.alive) continue;
      const regen = (hero.specials && hero.specials.regen) || 0; // % of max health per second
      if (regen > 0) hero.hp = Math.min(hero.maxHp, hero.hp + (hero.maxHp * regen * dt) / 100000);
      hero.shareCd = Math.max(0, hero.shareCd - dt);
      for (const slot of hero.skills) slot.cooldownLeft = Math.max(0, slot.cooldownLeft - dt);
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
      if (!target) {
        unit.timer = interval; // nothing to hit yet: stay ready
        continue;
      }
      unit.timer -= interval;

      // The attack starts now and lands after `hitDelay` (melee: the run-up and swing, ranged: the
      // shot's flight). With a delay of 0 it lands at once.
      const hitInMs = this.hitDelay(unit, target);
      const approach = unit.damageType === 'melee' && !this.standingTogether(unit, target);
      if (approach) this.breakEngagement(unit, target); // it walks over to its target: it leaves where it stood
      events.push({ type: 'attackStart', attacker: unit, target, hitInMs, approach });
      if (hitInMs > 0) unit.pending = { target, remaining: hitInMs };
      else this.landAttack(unit, target, events);
    }
    return events;
  }

  // Attacks that were on their way to a unit that just died go for someone else (or are cancelled
  // if nobody is left). They get at least `retargetMinMs` to reach the new target.
  retargetAttacksOn(dead, events) {
    for (const unit of [...this.heroes, ...this.enemies]) {
      if (!unit.alive || !unit.pending || unit.pending.target !== dead) continue;
      const next = this.pickTarget(unit);
      if (!next) {
        unit.pending = null;
        events.push({ type: 'attackCancel', unit, reason: 'noTarget' });
        continue;
      }
      unit.pending.target = next;
      unit.pending.remaining = Math.max(unit.pending.remaining, (this.rules.attackTiming && this.rules.attackTiming.retargetMinMs) || 0);
      events.push({ type: 'attackRetarget', attacker: unit, target: next, hitInMs: unit.pending.remaining });
    }
  }

  // How long a basic attack takes from start to hit (combat.json `attackTiming`, per side:
  // hero / enemy). Melee: a swing if it already stands next to its target (`swingMs`), else the walk
  // over plus the swing (`meleeHitMs`). Ranged: the shot's flight (`rangedHitMs`).
  hitDelay(unit, target = null) {
    const timing = (this.rules.attackTiming && this.rules.attackTiming[unit.side]) || {};
    if (unit.damageType !== 'melee') return timing.rangedHitMs || 0;
    if (target && this.standingTogether(unit, target)) return timing.swingMs ?? timing.meleeHitMs ?? 0;
    return timing.meleeHitMs || 0;
  }

  // A basic attack hits. If its target died in the meantime it goes to a new target instead.
  landAttack(unit, target, events) {
    if (!target.alive) target = this.pickTarget(unit);
    if (!target) return;
    if (unit.damageType === 'melee') unit.engagedUid = target.uid; // it now stands next to its target
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
        this.breakEngagement(target); // pushed away: it has to walk in again
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
    if (!slot || !hero.alive || this.isStunned(hero) || this.has(hero, 'silence')) return false;
    const skill = this.skillDefs[slot.id];
    if (slot.cooldownLeft > 0) return false;
    if (skill.target === 'self') return true;
    return this.enemies.some((e) => e.alive);
  }

  // Casts a hero's skill. One-target skills hit the focused enemy, else the hero's usual target.
  // Returns events (empty if the skill could not be cast).
  castSkill(heroUid, index) {
    const events = [];
    const hero = this.heroes.find((h) => h.uid === heroUid);
    if (!hero || !this.canCast(hero, index)) return events;
    const slot = hero.skills[index];
    const skill = this.skillDefs[slot.id];

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

    slot.cooldownLeft = skill.cooldownMs;
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
    return events;
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
    }
    this.refreshStats();
  }
}
