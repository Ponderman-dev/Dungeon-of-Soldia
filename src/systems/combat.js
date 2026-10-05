// Pure fight maths (no Phaser here), so it can be tested without a screen.

// An enemy's `weak` / `resists` lists can name a damage type ("fire") or a whole category
// ("magical", "physical").
function weakResistMultiplier(defender, type, rules, damageTypes) {
  const category = damageTypes[type].category;
  const has = (list) => list.includes(type) || list.includes(category);
  if (has(defender.weak)) return rules.weakMultiplier;
  if (has(defender.resists)) return rules.resistMultiplier;
  return 1;
}

// How much % damage a number of Defense (or Resist) points cuts. No hard cap:
// up to `linearUpTo` points it is 1 point = 1% (10 defense = 10% less), after that each extra
// point is worth a bit less and the cut creeps toward 100% without ever reaching it.
export function armorPercent(points, rules) {
  const knee = rules.armorCurve.linearUpTo;
  if (points <= knee) return points;
  const room = 100 - knee;
  return knee + room * (1 - Math.exp(-(points - knee) / room));
}

// Physical hits are cut by Defense, magical hits by Resist (same curve for both).
function armourCut(defender, type, rules, damageTypes) {
  const physical = damageTypes[type].category === 'physical';
  return armorPercent(physical ? defender.stats.defense : defender.stats.resist, rules);
}

// Works out one hit. Returns { dodged, crit, amount, mult }.
//   mult: 1 normal, >1 the target is weak to this damage type, <1 it resists it.
//   opts.multiplier: skill damage (x the attacker's attack). opts.damageType: overrides the attacker's type.
export function computeDamage(attacker, defender, rules, damageTypes, rng, opts = {}) {
  const type = opts.damageType || attacker.damageType;
  const evasion = Math.min(defender.stats.evasion, rules.caps.evasion);
  if (rng() * 100 < evasion) return { dodged: true, crit: false, amount: 0, mult: 1 };

  // Block (Shield Totem): a hit is stopped completely.
  // While the totems recharge (a 'blockCooldown' status) nothing is blocked.
  const block = (defender.specials && defender.specials.block) || 0;
  const recharging = defender.statuses && defender.statuses.some((st) => st.type === 'blockCooldown');
  if (block > 0 && !recharging && rng() * 100 < block) return { dodged: true, blocked: true, crit: false, amount: 0, mult: 1 };

  // Melee swings often miss flying enemies.
  if (type === 'melee' && defender.flying && rng() * 100 < rules.meleeVsFlyingMissPercent) {
    return { dodged: true, crit: false, amount: 0, mult: 1 };
  }

  const crit = rng() * 100 < Math.min(attacker.stats.crit, rules.caps.crit);
  const critMultiplier = rules.critMultiplier + ((attacker.specials && attacker.specials.critDamage) || 0) / 100;
  let amount = attacker.stats.attack * (opts.multiplier || 1) * (crit ? critMultiplier : 1);

  const mult = weakResistMultiplier(defender, type, rules, damageTypes);
  amount *= mult;
  amount *= 1 + ((attacker.damageBonus && attacker.damageBonus[type]) || 0) / 100;
  amount *= 1 - armourCut(defender, type, rules, damageTypes) / 100;

  return { dodged: false, crit, amount: Math.max(1, Math.round(amount)), mult };
}

// Damage over time (poison...): can't be dodged or crit, but weakness, resist and armour still apply.
// (The caster's damage bonus for this type is already inside `amount`, see BattleState.applyStatus.)
// opts.ignoresArmor: Bleed goes straight through defense.
export function computeDotDamage(defender, amount, type, rules, damageTypes, opts = {}) {
  const mult = weakResistMultiplier(defender, type, rules, damageTypes);
  const cut = opts.ignoresArmor ? 0 : armourCut(defender, type, rules, damageTypes);
  return Math.max(1, Math.round(amount * mult * (1 - cut / 100)));
}
