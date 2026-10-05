// Pure fight maths (no Phaser here), so it can be tested without a screen.

// Adds up one number from every status of one kind on a unit (e.g. all Weaken on it: -20 + -20).
// Different sources add up; the same source refreshes instead (see BattleState.applyStatus).
function statusSum(unit, type, field) {
  return (unit.statuses || []).reduce((sum, s) => (s.type === type ? sum + (s[field] || 0) : sum), 0);
}

// Mark: the unit takes more damage from everything (hits and damage over time).
function markMultiplier(defender) {
  return 1 + statusSum(defender, 'mark', 'damageTakenPercent') / 100;
}

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
// Armor Break lowers defense, Curse lowers resist (they can go below 0: then the hit does MORE damage).
function armourCut(defender, type, rules, damageTypes) {
  const physical = damageTypes[type].category === 'physical';
  const points = physical
    ? defender.stats.defense + statusSum(defender, 'armorBreak', 'defenseFlat')
    : defender.stats.resist + statusSum(defender, 'curse', 'resistFlat');
  return armorPercent(points, rules);
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

  // Blind: the attacker misses some of its attacks.
  const blind = statusSum(attacker, 'blind', 'missPercent');
  if (blind > 0 && rng() * 100 < blind) return { dodged: true, missed: true, crit: false, amount: 0, mult: 1 };

  // Melee swings often miss flying enemies.
  if (type === 'melee' && defender.flying && rng() * 100 < rules.meleeVsFlyingMissPercent) {
    return { dodged: true, crit: false, amount: 0, mult: 1 };
  }

  const crit = rng() * 100 < Math.min(attacker.stats.crit, rules.caps.crit);
  const critMultiplier = rules.critMultiplier + ((attacker.specials && attacker.specials.critDamage) || 0) / 100;
  // Weaken: the attacker hits softer.
  const attack = attacker.stats.attack * Math.max(0, 1 + statusSum(attacker, 'weaken', 'attackPercent') / 100);
  let amount = attack * (opts.multiplier || 1) * (crit ? critMultiplier : 1);

  const mult = weakResistMultiplier(defender, type, rules, damageTypes);
  amount *= mult;
  amount *= 1 + ((attacker.damageBonus && attacker.damageBonus[type]) || 0) / 100;
  amount *= 1 - armourCut(defender, type, rules, damageTypes) / 100;
  amount *= markMultiplier(defender);

  return { dodged: false, crit, amount: Math.max(1, Math.round(amount)), mult };
}

// Damage over time (poison...): can't be dodged or crit, but weakness, resist and armour still apply.
// (The caster's damage bonus for this type is already inside `amount`, see BattleState.applyStatus.)
// opts.ignoresArmor: Bleed goes straight through defense.
export function computeDotDamage(defender, amount, type, rules, damageTypes, opts = {}) {
  const mult = weakResistMultiplier(defender, type, rules, damageTypes);
  const cut = opts.ignoresArmor ? 0 : armourCut(defender, type, rules, damageTypes);
  return Math.max(1, Math.round(amount * mult * (1 - cut / 100) * markMultiplier(defender)));
}
