// Item maths (no Phaser here).

// Turns items.json (keyed by id) into a map where every item also knows its own id.
export function loadItems(raw) {
  return Object.fromEntries(Object.entries(raw).map(([id, def]) => [id, { id, ...def }]));
}

export function countOf(unit, itemId) {
  return unit.items.filter((id) => id === itemId).length;
}

// Can this hero take another copy of this item? (Dead heroes can't. Some items have a stack limit.)
export function canReceive(unit, item) {
  return unit.alive && countOf(unit, item.id) < (item.maxStacks ?? Infinity);
}

// A hero's stats = their level stats + every item that currently works for them.
//   - the hero's own items (while the hero is alive)
//   - squad items held by any LIVING hero
// Items on a dead hero stop working. `percent` is a % of the level stat; `flat` adds points.
export function computeHeroStats(hero, heroes, itemDefs, levelStats) {
  const stats = { ...levelStats };
  const damageBonus = {};
  const specials = {}; // thorns, lifesteal, skillDamage, critDamage, regen (all in %)
  const procs = []; // 'chance to do something when X happens' effects the hero rolls for
  // `factor` shrinks an effect for extra copies of an item that has `falloffRatio`.
  const apply = (e, factor = 1, holder = null) => {
    if (e.proc) {
      // One entry per copy, so every copy rolls its own chance. Only the holder's own attacks roll.
      if (holder === hero) procs.push({ ...e, itemId: e.itemId });
    } else if (e.special) {
      specials[e.special] = (specials[e.special] || 0) + e.percent * factor;
      if (e.cooldownMs) specials[e.special + 'CooldownMs'] = e.cooldownMs; // e.g. blockCooldownMs
    } else if (e.damageBonus) {
      damageBonus[e.damageBonus] = (damageBonus[e.damageBonus] || 0) + e.percent * factor;
    } else if (e.percent !== undefined) {
      stats[e.stat] += ((levelStats[e.stat] * e.percent) / 100) * factor;
    } else {
      stats[e.stat] += e.flat * factor;
    }
  };
  for (const holder of heroes) {
    if (!holder.alive) continue;
    const copies = {}; // how many copies of each item we have already counted for this hero
    for (const id of holder.items) {
      const index = copies[id] || 0;
      copies[id] = index + 1;
      const item = itemDefs[id];
      if (item.scope !== 'squad' && holder !== hero) continue;
      // Each extra copy of an item with a falloffRatio adds a bit less than the one before:
      // the nth copy gives (effect x ratio^(n-1)).
      for (const e of item.effects) apply(e.proc ? { ...e, itemId: id } : e, e.falloffRatio ? Math.pow(e.falloffRatio, index) : 1, holder);
    }
  }
  // Temporary buffs from skills.
  for (const status of hero.statuses || []) {
    if (status.type === 'buff') status.mods.forEach((m) => apply(m));
  }
  stats.health = Math.max(1, Math.round(stats.health));
  stats.attack = Math.max(1, stats.attack);
  stats.attackEfficiency = Math.max(10, stats.attackEfficiency);
  for (const key of ['mana', 'defense', 'resist', 'evasion', 'crit']) stats[key] = Math.max(0, stats[key] || 0);
  return { stats, damageBonus, specials, procs };
}
