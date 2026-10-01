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
  const apply = (e) => {
    if (e.damageBonus) {
      damageBonus[e.damageBonus] = (damageBonus[e.damageBonus] || 0) + e.percent;
    } else if (e.percent !== undefined) {
      stats[e.stat] += (levelStats[e.stat] * e.percent) / 100;
    } else {
      stats[e.stat] += e.flat;
    }
  };
  for (const holder of heroes) {
    if (!holder.alive) continue;
    for (const id of holder.items) {
      const item = itemDefs[id];
      if (item.scope !== 'squad' && holder !== hero) continue;
      item.effects.forEach(apply);
    }
  }
  // Temporary buffs from skills.
  for (const status of hero.statuses || []) {
    if (status.type === 'buff') status.mods.forEach(apply);
  }
  stats.health = Math.max(1, Math.round(stats.health));
  stats.attack = Math.max(1, stats.attack);
  stats.attackEfficiency = Math.max(10, stats.attackEfficiency);
  for (const key of ['mana', 'defense', 'resist', 'evasion', 'crit']) stats[key] = Math.max(0, stats[key] || 0);
  return { stats, damageBonus };
}
