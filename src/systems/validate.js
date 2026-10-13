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

// Checks that every damage type named in the data exists in damageTypes.json
// (heroes, enemies and their weak/resists lists, skills, statuses they apply, items).
// weak/resists may also name a category ("physical", "magical"). Returns a list of problems.
export function validateDamageTypes({ heroDefs, enemyDefs, skillDefs, itemDefs }, damageTypes) {
  const problems = [];
  const categories = new Set(Object.values(damageTypes).map((t) => t.category));
  const check = (where, type, allowCategory = false) => {
    if (type === undefined) return;
    if (!damageTypes[type] && !(allowCategory && categories.has(type))) problems.push(`${where}: unknown damage type "${type}"`);
  };
  for (const h of heroDefs) check(h.name, h.damageType);
  for (const e of Object.values(enemyDefs)) {
    check(e.name, e.damageType);
    for (const t of [...(e.weak || []), ...(e.resists || [])]) check(`${e.name} weak/resists`, t, true);
  }
  for (const [id, sk] of Object.entries(skillDefs)) {
    check(`skill ${id}`, sk.damageType);
    for (const a of sk.apply || []) check(`skill ${id} status`, a.damageType);
  }
  for (const [id, it] of Object.entries(itemDefs)) {
    for (const e of it.effects || []) {
      check(`item ${id}`, e.damageBonus);
      check(`item ${id}`, e.strike && e.strike.damageType);
      check(`item ${id}`, e.chain && e.chain.damageType);
      for (const a of e.apply || []) check(`item ${id} status`, a.damageType);
    }
  }
  return problems;
}
