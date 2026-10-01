// Checks the dungeon data for mistakes. Returns a list of problems (empty = all good).
export function validateDungeon(dungeon, enemyDefs) {
  const problems = [];
  for (const f of dungeon.floors) {
    for (const id of f.enemies) {
      if (!enemyDefs[id]) problems.push(`Floor ${f.floor}: unknown enemy "${id}"`);
    }
  }
  return problems;
}
