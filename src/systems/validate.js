// Checks the dungeon data for mistakes. Returns a list of problems (empty = all good).
export function validateDungeon(dungeon, enemyDefs) {
  const problems = [];
  for (const f of dungeon.floors) {
    for (const id of [...f.enemies, ...(f.otherwise || [])]) {
      if (!enemyDefs[id]) problems.push(`Floor ${f.floor}: unknown enemy "${id}"`);
    }
  }
  return problems;
}

// Checks that every hero has one attack skill and one support skill, and that each skill exists
// and is the right kind (skills.json `kind`). Returns a list of problems (empty = all good).
export function validateHeroSkills(heroDefs, skillDefs) {
  const problems = [];
  for (const hero of heroDefs) {
    for (const kind of ['attack', 'support']) {
      const id = hero.skills && hero.skills[kind];
      if (!id) problems.push(`${hero.name}: no ${kind} skill`);
      else if (!skillDefs[id]) problems.push(`${hero.name}: unknown skill "${id}"`);
      else if (skillDefs[id].kind !== kind) problems.push(`${hero.name}: "${id}" is a ${skillDefs[id].kind} skill, not ${kind}`);
    }
  }
  return problems;
}
