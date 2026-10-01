// Levelling maths (no Phaser here).

// XP a hero needs to go from `level` to `level + 1`.
export function xpForNextLevel(level, rules) {
  return Math.round(rules.xpBase * Math.pow(rules.xpGrowth, level - 1));
}

// A hero's stats at a given level.
//   growthPercent: % of the BASE stat added per level (health, mana, attack)
//   growthFlat:    flat points added per level (defense, resist, evasion, crit, attackEfficiency)
export function statsAtLevel(baseStats, def, level) {
  const stats = { ...baseStats };
  const extra = level - 1;
  for (const [key, pct] of Object.entries(def.growthPercent || {})) {
    stats[key] = baseStats[key] * (1 + (pct / 100) * extra);
  }
  for (const [key, pts] of Object.entries(def.growthFlat || {})) {
    stats[key] = (stats[key] || 0) + pts * extra;
  }
  stats.health = Math.round(stats.health);
  return stats;
}
