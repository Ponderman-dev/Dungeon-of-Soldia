import { computeDamage, computeDotDamage } from './combat.js';
import { xpForNextLevel, statsAtLevel } from './leveling.js';
import { computeHeroStats } from './items.js';

// The fight itself: who is alive, who attacks whom and when, mana, skills and statuses.
// No Phaser in here. update() and castSkill() return a list of events and the scene draws them.
//
// Health regeneration (specials.regen) happens silently inside update(); the scene just redraws bars.
// Events: attack, death, levelup, cast, status (apply / expire), dot (poison tick),
//         heal (lifesteal), thorns (reflected damage), proc (an item's chance effect went off)
export default class BattleState {
  constructor({ heroDefs, enemyDefs, itemDefs = {}, skillDefs = {}, rules, damageTypes, leveling, rng = Math.random }) {
    this.rules = rules;
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
  }

  makeUnit(def, side, floor, fightSize = 1) {
    const stats = { defense: 0, resist: 0, evasion: 0, crit: 0, attackEfficiency: 100, mana: 0, ...def.stats };
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
      mana: stats.mana,
      maxMana: stats.mana,
      baseStats: { ...stats },
      level: 1,
      xp: 0,
      items: [],
      skills: (def.skills || []).map((id) => ({ id, cooldownLeft: 0 })),
      statuses: [],
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

  // Milliseconds between attacks. Slow makes it longer.
  interval(unit) {
    const slow = unit.statuses.filter((s) => s.type === 'slow').reduce((sum, s) => sum + s.attackSpeedPercent, 0);
    const speed = (unit.stats.attackEfficiency / 100) * Math.max(0.2, 1 + slow / 100);
    return this.rules.baseAttackIntervalMs / speed;
  }

  isStunned(unit) {
    return unit.statuses.some((s) => s.type === 'stun');
  }

  spawnEnemies(ids, floor) {
    this.focusUid = null;
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

  pickTarget(unit) {
    if (unit.side === 'hero') {
      const alive = this.enemies.filter((e) => e.alive);
      const focus = alive.find((e) => e.uid === this.focusUid);
      return focus || alive[0] || null;
    }
    const alive = this.heroes.filter((h) => h.alive);
    return alive.length ? alive[Math.floor(this.rng() * alive.length)] : null;
  }

  // Marks a unit dead. Enemies give XP; a dead hero's items stop working.
  killUnit(target, events) {
    target.alive = false;
    target.statuses = [];
    if (this.focusUid === target.uid) this.focusUid = null;
    events.push({ type: 'death', unit: target });
    if (target.side === 'enemy') this.awardXp(target, events);
    else this.refreshStats();
  }

  // Moves the fight forward by dt milliseconds. Returns events for the scene to show.
  update(dt) {
    const events = [];
    this.tickStatuses(dt, events);

    // Mana comes back, health regenerates (Heart Charm) and skill cooldowns run down.
    for (const hero of this.heroes) {
      if (!hero.alive) continue;
      const regen = (hero.specials && hero.specials.regen) || 0; // % of max health per second
      if (regen > 0) hero.hp = Math.min(hero.maxHp, hero.hp + (hero.maxHp * regen * dt) / 100000);
      hero.mana = Math.min(hero.maxMana, hero.mana + (this.rules.manaRegenPerSec * dt) / 1000);
      hero.shareCd = Math.max(0, hero.shareCd - dt);
      for (const slot of hero.skills) slot.cooldownLeft = Math.max(0, slot.cooldownLeft - dt);
    }

    for (const unit of [...this.heroes, ...this.enemies]) {
      if (!unit.alive || this.isStunned(unit)) continue;
      unit.timer += dt;
      const interval = this.interval(unit);
      if (unit.timer < interval) continue;

      const target = this.pickTarget(unit);
      if (!target) {
        unit.timer = interval; // nothing to hit yet: stay ready
        continue;
      }
      unit.timer -= interval;

      this.strike(unit, target, events);
      this.rollProcs(unit, 'onAttack', events, { target });
    }
    return events;
  }

  // One hit: damage, block cooldown, lifesteal/thorns/crit debuffs, death. Used by basic attacks,
  // skills and item procs. opts: multiplier, damageType (see computeDamage), skill (the skill def),
  // projectile ('bomb', 'lightning': the scene draws it flying from the attacker).
  strike(attacker, target, events, opts = {}) {
    const result = computeDamage(attacker, target, this.rules, this.damageTypes, this.rng, opts);
    if (!result.dodged) target.hp = Math.max(0, target.hp - result.amount);
    if (opts.projectile) events.push({ type: 'projectile', from: opts.from || attacker, to: target, kind: opts.projectile });
    events.push({ type: 'attack', attacker, target, result, skill: opts.skill, damageType: opts.damageType || attacker.damageType });
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
  //   apply      - give statuses to `targets`: self, squad or target (the hit enemy)
  rollProcs(hero, trigger, events, ctx = {}) {
    if (hero.side !== 'hero' || !hero.alive) return;
    for (const proc of [...hero.procs]) {
      if (proc.proc !== trigger || this.rng() * 100 >= proc.chance) continue;
      events.push({ type: 'proc', unit: hero, label: proc.label });
      const enemy = ctx.target && ctx.target.alive ? ctx.target : null;
      let landed = true;
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

  // ---- statuses (stun, slow, poison, buffs) ----------------------------------------------

  // Gives a unit a status. The same status from the same skill just restarts its timer.
  // Bosses can have `statusDurationScale` (e.g. 0.5) in their data to shorten statuses on them.
  applyStatus(target, spec, source, skillId, events) {
    const scale = target.def.statusDurationScale ?? 1;
    const duration = spec.durationMs * scale;
    const key = `${spec.status}:${skillId}`;
    let status = target.statuses.find((s) => s.key === key);
    if (!status) {
      status = { key, type: spec.status };
      target.statuses.push(status);
    }
    status.remaining = duration;
    status.total = duration;
    if (spec.status === 'slow') status.attackSpeedPercent = spec.attackSpeedPercent;
    if (spec.status === 'buff') status.mods = spec.mods;
    if (spec.status === 'poison') {
      status.tickMs = spec.tickMs;
      status.tickTimer = status.tickTimer || 0;
      status.damage = Math.max(1, Math.round(source.stats.attack * spec.damageMultiplier));
      status.damageType = spec.damageType || 'dark';
    }
    if (spec.status === 'buff') this.refreshStats();
    events.push({ type: 'status', unit: target, change: 'apply', status });
  }

  // Counts statuses down, poison ticks, and removes finished statuses.
  tickStatuses(dt, events) {
    let buffEnded = false;
    for (const unit of [...this.heroes, ...this.enemies]) {
      if (!unit.alive) continue;
      for (const status of [...unit.statuses]) {
        status.remaining -= dt;
        if (status.type === 'poison') {
          status.tickTimer += dt;
          while (status.tickTimer >= status.tickMs && unit.alive) {
            status.tickTimer -= status.tickMs;
            const amount = computeDotDamage(unit, status.damage, status.damageType, this.rules, this.damageTypes);
            unit.hp = Math.max(0, unit.hp - amount);
            events.push({ type: 'dot', unit, amount, damageType: status.damageType });
            if (unit.hp <= 0) this.killUnit(unit, events);
          }
        }
        if (!unit.alive) break;
        if (status.remaining <= 0) {
          unit.statuses.splice(unit.statuses.indexOf(status), 1);
          if (status.type === 'buff') buffEnded = true;
          events.push({ type: 'status', unit, change: 'expire', status });
        }
      }
    }
    if (buffEnded) this.refreshStats();
  }

  // ---- skills -------------------------------------------------------------------------

  // Can this hero cast this skill right now? Returns false if not (dead, stunned, cooling down,
  // not enough mana, or nothing to aim at).
  canCast(hero, index) {
    const slot = hero.skills[index];
    if (!slot || !hero.alive || this.isStunned(hero)) return false;
    const skill = this.skillDefs[slot.id];
    if (slot.cooldownLeft > 0 || hero.mana < skill.manaCost) return false;
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

    hero.mana -= skill.manaCost;
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
  // new max. Mana works the same way.
  refreshStats() {
    for (const hero of this.heroes) {
      if (!hero.alive) continue;
      const levelStats = statsAtLevel(hero.baseStats, hero.def, hero.level);
      const { stats, damageBonus, specials, procs } = computeHeroStats(hero, this.heroes, this.itemDefs, levelStats);
      const hpDelta = stats.health - hero.maxHp;
      const manaDelta = stats.mana - hero.maxMana;
      hero.stats = stats;
      hero.damageBonus = damageBonus;
      hero.specials = specials;
      hero.procs = procs;
      hero.maxHp = stats.health;
      hero.hp = Math.max(1, hpDelta > 0 ? hero.hp + hpDelta : Math.min(hero.hp, hero.maxHp));
      hero.maxMana = stats.mana;
      hero.mana = manaDelta > 0 ? hero.mana + manaDelta : Math.min(hero.mana, hero.maxMana);
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
    const result = computeHeroStats(hero, this.heroes, this.itemDefs, levelStats);
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
    for (const h of this.heroes) h.statuses = [];
    this.refreshStats();
  }

  // Gives every living hero back a % of their max mana.
  restoreMana(percent) {
    for (const h of this.heroes) {
      if (h.alive) h.mana = Math.min(h.maxMana, h.mana + (h.maxMana * percent) / 100);
    }
  }
}
