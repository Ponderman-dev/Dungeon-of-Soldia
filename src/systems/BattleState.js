import { computeDamage } from './combat.js';

// The fight itself: who is alive, who attacks whom and when.
// No Phaser in here. update() returns a list of events and the scene draws them.
export default class BattleState {
  constructor({ heroDefs, enemyDefs, rules, damageTypes, rng = Math.random }) {
    this.rules = rules;
    this.damageTypes = damageTypes;
    this.enemyDefs = enemyDefs;
    this.rng = rng;
    this.nextUid = 1;
    this.focusUid = null;
    this.heroes = heroDefs.map((d) => this.makeUnit(d, 'hero', 1));
    this.enemies = [];
  }

  makeUnit(def, side, floor) {
    const stats = { defense: 0, resist: 0, evasion: 0, crit: 0, attackEfficiency: 100, ...def.stats };
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

  interval(unit) {
    return (this.rules.baseAttackIntervalMs * 100) / unit.stats.attackEfficiency;
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

  // Moves the fight forward by dt milliseconds. Returns events for the scene to show.
  update(dt) {
    const events = [];
    for (const unit of [...this.heroes, ...this.enemies]) {
      if (!unit.alive) continue;
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

      if (target.hp <= 0 && target.alive) {
        target.alive = false;
        if (this.focusUid === target.uid) this.focusUid = null;
        events.push({ type: 'death', unit: target });
      }
    }
    return events;
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
}
