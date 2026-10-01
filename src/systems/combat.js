// Pure fight maths (no Phaser here), so it can be tested without a screen.

function weakResistMultiplier(defender, type, rules) {
  if (defender.weak.includes(type)) return rules.weakMultiplier;
  if (defender.resists.includes(type)) return rules.resistMultiplier;
  return 1;
}

// Physical hits are cut by Defense, magical hits by Resist (both capped).
function armourCut(defender, type, rules, damageTypes) {
  const physical = damageTypes[type].category === 'physical';
  return Math.min(physical ? defender.stats.defense : defender.stats.resist, physical ? rules.caps.defense : rules.caps.resist);
}

// Works out one hit. Returns { dodged, crit, amount, mult }.
//   mult: 1 normal, >1 the target is weak to this damage type, <1 it resists it.
//   opts.multiplier: skill damage (x the attacker's attack). opts.damageType: overrides the attacker's type.
export function computeDamage(attacker, defender, rules, damageTypes, rng, opts = {}) {
  const type = opts.damageType || attacker.damageType;
  const evasion = Math.min(defender.stats.evasion, rules.caps.evasion);
  if (rng() * 100 < evasion) return { dodged: true, crit: false, amount: 0, mult: 1 };

  // Block (Shield Totem): a hit is stopped completely.
  const block = (defender.specials && defender.specials.block) || 0;
  if (rng() * 100 < block) return { dodged: true, blocked: true, crit: false, amount: 0, mult: 1 };

  // Melee swings often miss flying enemies.
  if (type === 'melee' && defender.flying && rng() * 100 < rules.meleeVsFlyingMissPercent) {
    return { dodged: true, crit: false, amount: 0, mult: 1 };
  }

  const crit = rng() * 100 < attacker.stats.crit;
  const critMultiplier = rules.critMultiplier + ((attacker.specials && attacker.specials.critDamage) || 0) / 100;
  let amount = attacker.stats.attack * (opts.multiplier || 1) * (crit ? critMultiplier : 1);

  const mult = weakResistMultiplier(defender, type, rules);
  amount *= mult;
  amount *= 1 + ((attacker.damageBonus && attacker.damageBonus[type]) || 0) / 100;
  amount *= 1 - armourCut(defender, type, rules, damageTypes) / 100;

  return { dodged: false, crit, amount: Math.max(1, Math.round(amount)), mult };
}

// Damage over time (poison): can't be dodged or crit, but weakness, resist and armour still apply.
export function computeDotDamage(defender, amount, type, rules, damageTypes) {
  const mult = weakResistMultiplier(defender, type, rules);
  return Math.max(1, Math.round(amount * mult * (1 - armourCut(defender, type, rules, damageTypes) / 100)));
}
