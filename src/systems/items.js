// Item maths (no Phaser here).
import { perkMods, moraleTier } from './party.js';

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
// `squadMult` (Bard's Hymn): squad items (type 'squad') work this much stronger.
export function computeHeroStats(hero, heroes, itemDefs, levelStats, moraleRules = {}, extraMods = [], squadMult = 1) {
  const stats = { ...levelStats };
  const damageBonus = {};
  const specials = {}; // thorns, lifesteal, skillDamage, critDamage, regen (all in %)
  const procs = []; // 'chance to do something when X happens' effects the hero rolls for
  const minionSources = []; // minion items the hero holds: one entry per copy { itemId, kind: 'weak' | 'greater', spec / minion }
  // `factor` shrinks an effect for extra copies of an item that has `falloffRatio`.
  const apply = (e, factor = 1, holder = null) => {
    if (e.minionSpawner || e.greaterMinion || e.minionOnHit) {
      // A minion item (only its holder gets the minions): weak spawner, minion that pops out when the holder is hit,
      // or greater minion, one entry per copy.
      if (holder === hero) {
        if (e.greaterMinion) minionSources.push({ itemId: e.itemId, kind: 'greater', minion: e.greaterMinion });
        else if (e.minionOnHit) minionSources.push({ itemId: e.itemId, kind: 'weak', onHit: true, spec: e.minionOnHit });
        else minionSources.push({ itemId: e.itemId, kind: 'weak', spec: e.minionSpawner });
      }
    } else if (e.proc) {
      // One entry per copy, so every copy rolls its own chance. Only the holder's own attacks roll.
      // `unique` effects only count once however many copies the hero has (e.g. a freeze chance that doesn't stack).
      // `falloffRatio` on a proc shrinks its chance for extra copies (Serrated Edge: 10%, 8%, 6.4%...).
      // `chancePerExtra` (with `unique`): ONE roll whose chance grows with every extra copy (Hex Doll: 8%, 12%, 16%...).
      const n = holder ? holder.items.filter((i) => i === e.itemId).length : 1;
      const chance = e.chancePerExtra ? e.chance + e.chancePerExtra * (n - 1) : e.chance * factor;
      if (holder === hero && !(e.unique && procs.some((p) => p.unique && p.itemId === e.itemId))) procs.push({ ...e, chance, itemId: e.itemId, copies: n });
    } else if (e.special) {
      // `unique`: the value does NOT grow with more copies (e.g. the Second Wind heal); `cap`: the total stops here.
      if (e.unique) specials[e.special] = e.percent;
      else specials[e.special] = Math.min(e.cap ?? Infinity, (specials[e.special] || 0) + e.percent * factor);
      if (e.below !== undefined) specials[e.special + 'Below'] = e.below;
      if (e.cooldownMs) specials[e.special + 'CooldownMs'] = e.cooldownMs; // e.g. blockCooldownMs
      if (e.debuffs) specials[e.special + 'List'] = e.debuffs; // e.g. critDebuffList
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
      // the nth copy gives (effect x ratio^(n-1)). `perExtra`: the first copy gives the effect's value, every
      // extra copy gives `perExtra` instead (Blood Chalice: +20%, then +10% per extra chalice).
      for (const e of item.effects) {
        let factor = e.falloffRatio ? Math.pow(e.falloffRatio, index) : 1;
        if (e.perExtra !== undefined && index > 0) factor = e.perExtra / (e.percent ?? e.flat);
        if (item.type === 'squad') factor *= squadMult;
        apply({ ...e, itemId: id }, factor, holder);
      }
    }
  }
  // Hero perks: every living hero's perk helps the whole party (a fallen hero's perk is lost).
  for (const holder of heroes) if (holder.alive) perkMods(holder).forEach((m) => apply(m));
  // Morale: the party is weaker once heroes have fallen.
  const tier = moraleRules[moraleTier(heroes)];
  // Last Stand Banner: the holder feels 50% less of the morale penalty, each extra banner halves what is left again.
  if (tier) tier.mods.forEach((m) => apply(m, Math.pow(0.5, specials.lastStand || 0)));
  // Extra mods from the game rules (minion upkeep).
  extraMods.forEach((m) => apply(m));
  // Temporary buffs from skills.
  for (const status of hero.statuses || []) {
    if (status.type === 'buff') status.mods.forEach((m) => apply(m));
  }
  stats.health = Math.max(1, Math.round(stats.health));
  stats.attack = Math.max(1, stats.attack);
  stats.attackEfficiency = Math.max(10, stats.attackEfficiency);
  for (const key of ['defense', 'resist', 'evasion', 'crit']) stats[key] = Math.max(0, stats[key] || 0);
  return { stats, damageBonus, specials, procs, minionSources };
}
