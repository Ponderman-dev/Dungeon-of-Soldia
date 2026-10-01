// Checks the dungeon data for mistakes. Returns a list of problems (empty = all good).
// Rule: every fight needs at least one enemy that melee can hit (not flying).
export function validateDungeon(dungeon, enemyDefs) {
  const problems = [];
  for (const f of dungeon.floors) {
    for (const id of f.enemies) {
      if (!enemyDefs[id]) problems.push(`Floor ${f.floor}: unknown enemy "${id}"`);
    }
    const hittable = f.enemies.some((id) => enemyDefs[id] && !enemyDefs[id].flying);
    if (!hittable) problems.push(`Floor ${f.floor}: no enemy that melee heroes can hit`);
  }
  return problems;
}
