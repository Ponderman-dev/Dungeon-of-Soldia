// Pure fight maths (no Phaser here), so it can be tested without a screen.

// Works out one hit. Returns { dodged, crit, amount, mult }.
//   mult: 1 normal, >1 the target is weak to this damage type, <1 it resists it.
export function computeDamage(attacker, defender, rules, damageTypes, rng) {
  const cap = rules.caps;
  const evasion = Math.min(defender.stats.evasion, cap.evasion);
  if (rng() * 100 < evasion) return { dodged: true, crit: false, amount: 0, mult: 1 };

  const crit = rng() * 100 < attacker.stats.crit;
  let amount = attacker.stats.attack * (crit ? rules.critMultiplier : 1);

  let mult = 1;
  if (defender.weak.includes(attacker.damageType)) mult = rules.weakMultiplier;
  else if (defender.resists.includes(attacker.damageType)) mult = rules.resistMultiplier;
  amount *= mult;

  // Physical hits are cut by Defense, magical hits by Resist.
  const physical = damageTypes[attacker.damageType].category === 'physical';
  const cut = Math.min(physical ? defender.stats.defense : defender.stats.resist, physical ? cap.defense : cap.resist);
  amount *= 1 - cut / 100;

  return { dodged: false, crit, amount: Math.max(1, Math.round(amount)), mult };
}
