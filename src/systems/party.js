// Party rules with no Phaser in them: who is in the squad, hero perks, and morale.

// The heroes that go into a run, in the order of `squadIds` (the others stay on the bench).
export function pickSquad(heroDefs, squadIds) {
  return squadIds.map((id) => heroDefs.find((h) => h.id === id));
}

// A hero's perk helps the whole party while that hero is alive. Each mod looks like an item effect
// ({ stat, percent } or { stat, flat }) and can grow with the hero's level (`growth` per level).
export function perkMods(hero) {
  const perk = hero.def.perk;
  if (!perk) return [];
  return perk.mods.map((m) => {
    const bonus = (m.growth || 0) * (hero.level - 1);
    return m.percent !== undefined ? { stat: m.stat, percent: m.percent + bonus } : { stat: m.stat, flat: m.flat + bonus };
  });
}

// Morale: 'full' while everyone is alive, 'incomplete' once a hero has fallen, 'alone' when only one is left.
export function moraleTier(heroes) {
  const living = heroes.filter((h) => h.alive).length;
  if (heroes.length < 2 || living === heroes.length) return 'full';
  return living <= 1 ? 'alone' : 'incomplete';
}
