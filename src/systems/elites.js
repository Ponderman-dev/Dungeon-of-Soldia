// Elite enemies (no Phaser). Added to BattleState.prototype (see the bottom of BattleState.js), so `this` is the
// fight. WHICH enemies are elite is decided by the floor director (dungeon.js pickElites: `ids.elites` = indexes);
// HOW an elite works is data in combat.json `elites`:
//   - stats: health x healthMultiplier, attack x attackMultiplier, + defenseFlat / resistFlat, XP x xpMultiplier,
//     drawn drawScaleBonus pixel size bigger, a glow in its element colour and a gold crown (the scene).
//   - ONE element (burning, frozen, storm, cursed, toxic): its hits use the element's damage type (it still walks
//     or shoots like its normal self), put the element's status on heroes (`onHit`), resists it / is weak to another;
//     cursed heals from its hits (lifesteal), storm's every Nth hit jumps to a second hero, toxic leaves a cloud.
//   - ONE trait (vampiric, shielded, thorny, splitting, regenerating, unstoppable, explosive).
// Its name says both: "Burning Vampiric Bandit". After a fight with an elite one reward card is a rarity higher
// (`floorHadElite`, read by the scene and the bots).

const pick = (obj, rng) => {
  const keys = Object.keys(obj).filter((k) => !k.startsWith('_'));
  return keys[Math.floor(rng() * keys.length)];
};
const without = (list, drop) => list.filter((t) => !drop.includes(t));

export const eliteMethods = {
  // Turns a freshly made enemy into an elite. `element` / `trait` = ids (random when not given).
  makeElite(u, element = null, trait = null) {
    const E = this.rules.elites;
    if (!E || u.elite) return u;
    element = element || pick(E.elements, this.rng);
    trait = trait || pick(E.traits, this.rng);
    const el = E.elements[element];
    const tr = E.traits[trait];
    const base = u.def;
    const resists = [...without(base.resists || [], el.weak || []), ...(el.resists || [])];
    const weak = [...without(base.weak || [], el.resists || []), ...(el.weak || [])];
    const onDeath = [].concat(base.onDeath || [], el.onDeath || []);
    u.def = {
      ...base,
      name: `${el.name} ${tr.name} ${base.name}`,
      drawScale: (base.drawScale ?? 3) + (E.drawScaleBonus ?? 0),
      weak,
      resists,
      onHit: [...(base.onHit || []), ...(el.onHit || [])],
      onDeath: onDeath.length ? onDeath : undefined,
      statusDurationScale: (base.statusDurationScale ?? 1) * (tr.statusDurationScale ?? 1),
      eliteOf: base, // the normal enemy (Splitting copies)
    };
    u.name = u.def.name;
    u.weak = weak;
    u.resists = resists;
    u.hitType = el.damageType; // its basic hits (landAttack); u.damageType stays = how it moves
    for (const st of [u.stats, u.baseStats]) {
      st.health = Math.round(st.health * E.healthMultiplier);
      st.attack = Math.round(st.attack * E.attackMultiplier);
      st.defense = (st.defense || 0) + (E.defenseFlat || 0);
      st.resist = (st.resist || 0) + (E.resistFlat || 0);
    }
    u.hp = u.maxHp = u.stats.health;
    u.xpScale = (u.xpScale ?? 1) * (E.xpMultiplier ?? 1);
    u.specials = { ...u.specials, lifesteal: (el.lifesteal || 0) + (tr.lifesteal || 0), thorns: tr.thorns || 0 };
    u.elite = { element, trait, color: el.color, hits: 0, unhit: 0 };
    this.floorHadElite = true;
    if (tr.shieldPercent) this.eliteShield(u, null);
    return u;
  },

  // Shielded: a shield of shieldPercent of max health (no time limit). It regrows after regrowMs without being hit.
  eliteShield(u, events) {
    const pct = this.rules.elites.traits[u.elite.trait].shieldPercent;
    const amount = Math.round((u.maxHp * pct) / 100);
    const st = { key: 'shield:elite', type: 'shield', amount, maxAmount: amount, remaining: Infinity, total: Infinity, sourceUid: u.uid, onBreak: null };
    u.statuses.push(st);
    if (events) events.push({ type: 'status', unit: u, change: 'apply', status: st });
  },

  // Every update: Regenerating heals, a Shielded elite's shield regrows.
  tickElites(dt, events) {
    for (const u of this.enemies) {
      if (!u.alive || !u.elite) continue;
      const tr = this.rules.elites.traits[u.elite.trait];
      u.elite.unhit += dt;
      if (tr.regenPercentPerSec && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + (u.maxHp * tr.regenPercentPerSec * dt) / 100000);
      if (tr.shieldPercent && u.elite.unhit >= tr.regrowMs && !u.statuses.some((st) => st.key === 'shield:elite')) {
        this.eliteShield(u, events);
        events.push({ type: 'proc', unit: u, label: 'Shield!' });
      }
    }
  },

  // A basic hit of an elite landed: Storm's every Nth hit also jumps to a second hero/minion (the one nearest the target).
  eliteAfterAttack(u, target, hit, events) {
    const el = this.rules.elites.elements[u.elite.element];
    if (!el.jumpEvery || hit.dodged || !u.alive) return;
    u.elite.hits += 1;
    if (u.elite.hits % el.jumpEvery !== 0) return;
    const next = this.defenders().filter((d) => d !== target).sort((a, b) => this.distance(a, target) - this.distance(b, target))[0];
    if (!next) return;
    events.push({ type: 'proc', unit: u, label: 'Arc!', target: next });
    this.strike(u, next, events, { multiplier: el.jump.damageMultiplier, damageType: el.damageType, projectile: 'lightning', from: target, item: true });
  },

  // An elite died: Explosive bursts (its element's damage + statuses on the heroes nearby), Splitting falls apart
  // into smaller normal copies.
  eliteDeath(u, events) {
    const E = this.rules.elites;
    const el = E.elements[u.elite.element];
    const tr = E.traits[u.elite.trait];
    if (tr.burst) {
      const hit = this.defenders().filter((d) => !this.hasPositions(u) || !this.hasPositions(d) || Math.hypot(d.x - u.x, d.y - u.y) <= tr.burst.radius);
      events.push({ type: 'deathBurst', unit: u, radius: tr.burst.radius, color: el.color, targets: hit, explosive: true });
      for (const d of hit) {
        if (!d.alive) continue;
        this.strike(u, d, events, { multiplier: tr.burst.damageMultiplier, damageType: el.damageType, item: true, burst: true });
        if (d.alive) for (const spec of el.onHit || []) this.applyStatus(d, spec, u, `elite_burst_${u.uid}`, events);
      }
    }
    if (tr.split) {
      const base = u.def.eliteOf;
      const hp = Math.max(1, Math.round((u.maxHp * tr.split.hpPercent) / 100));
      for (let i = 0; i < tr.split.count; i++) {
        const c = this.spawnEnemyUnit({ ...base, drawScale: Math.max(2, (base.drawScale ?? 3) - 1) }, u, events, 40);
        if (!c) continue;
        c.hp = c.maxHp = c.stats.health = c.baseStats.health = hp;
        c.splitCopy = true;
      }
      events.push({ type: 'proc', unit: u, label: 'Split!' });
    }
  },
};
