import { computeDamage, computeDotDamage } from './combat.js';
import { xpForNextLevel, statsAtLevel } from './leveling.js';
import { computeHeroStats } from './items.js';

// The fight itself: who is alive, who attacks whom and when, mana, skills and statuses.
// No Phaser in here. update() and castSkill() return a list of events and the scene draws them.
//
// Events: attack, death, levelup, cast, status (apply / expire), dot (poison tick)
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

  makeUnit(def, side, floor) {
    const stats = { defense: 0, resist: 0, evasion: 0, crit: 0, attackEfficiency: 100, mana: 0, ...def.stats };
    if (side === 'enemy') {
      const s = this.rules.floorScaling;
      // Health and attack grow in steps: +perStep every stepFloors floors.
      const hpSteps = Math.floor((floor - 1) / s.hpStepFloors);
      stats.health = Math.round(stats.health * (1 + s.hpPerStep * hpSteps));
      const atkSteps = Math.floor((floor - 1) / s.attackStepFloors);
      stats.attack = Math.round(stats.attack * (1 + s.attackPerStep * atkSteps));
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
    this.enemies = ids.map((id) => this.makeUnit(this.enemyDefs[id], 'enemy', floor));
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

    // Mana comes back and skill cooldowns run down.
    for (const hero of this.heroes) {
      if (!hero.alive) continue;
      hero.mana = Math.min(hero.maxMana, hero.mana + (this.rules.manaRegenPerSec * dt) / 1000);
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

      const result = computeDamage(unit, target, this.rules, this.damageTypes, this.rng);
      if (!result.dodged) target.hp = Math.max(0, target.hp - result.amount);
      events.push({ type: 'attack', attacker: unit, target, result });
      if (target.hp <= 0 && target.alive) this.killUnit(target, events);
    }
    return events;
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

    hero.mana -= skill.manaCost;
    slot.cooldownLeft = skill.cooldownMs;
    events.push({ type: 'cast', unit: hero, skill, targets });

    for (const target of targets) {
      if (skill.damageMultiplier) {
        const result = computeDamage(hero, target, this.rules, this.damageTypes, this.rng, {
          multiplier: skill.damageMultiplier,
          damageType: skill.damageType,
        });
        if (!result.dodged) target.hp = Math.max(0, target.hp - result.amount);
        events.push({ type: 'attack', attacker: hero, target, result, skill });
        if (result.dodged) continue;
        if (target.hp <= 0) {
          this.killUnit(target, events);
          continue;
        }
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
      const { stats, damageBonus } = computeHeroStats(hero, this.heroes, this.itemDefs, levelStats);
      const hpDelta = stats.health - hero.maxHp;
      const manaDelta = stats.mana - hero.maxMana;
      hero.stats = stats;
      hero.damageBonus = damageBonus;
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
