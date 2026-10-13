import { canReceive } from './items.js';

// The rarity odds for a floor (rewards.json `rarityOdds`: the last band whose fromFloor <= floor).
export function rarityOddsFor(floor, rules) {
  let odds = rules.rarityOdds[0].odds;
  for (const band of rules.rarityOdds) if (floor >= band.fromFloor) odds = band.odds;
  return odds;
}

// What the squad can already "make": the damage types of its living heroes (melee / ranged),
// anything a living hero `provides` (heroes.json), and anything the items of living heroes provide.
// An item that `needs` something the squad can't make yet shows up less often (but can still show up).
export function squadSources(heroes, itemDefs) {
  const sources = new Set();
  for (const hero of heroes) {
    if (!hero.alive) continue;
    sources.add(hero.def.damageType);
    for (const tag of hero.def.provides || []) sources.add(tag);
    for (const id of hero.items) for (const tag of (itemDefs[id] && itemDefs[id].provides) || []) sources.add(tag);
  }
  return sources;
}

// How likely an item is to be picked inside its rarity.
export function dropWeight(item, sources, rules) {
  const weight = item.dropWeight ?? rules.defaultDropWeight;
  return item.needs && !sources.has(item.needs) ? weight * rules.needsMissingFactor : weight;
}

// Picks one entry from a list using weights (`weightOf`). Returns its index.
function pickWeighted(list, weightOf, rng) {
  const total = list.reduce((sum, x) => sum + weightOf(x), 0);
  let roll = rng() * total;
  for (let i = 0; i < list.length - 1; i++) {
    roll -= weightOf(list[i]);
    if (roll < 0) return i;
  }
  return list.length - 1;
}

// Picks `count` different items for the reward screen.
// Each card: 1) roll a RARITY with the floor's odds, 2) pick an item of that rarity by its drop weight.
// An item is only offered if at least one living hero could take it. If a rarity has nothing left,
// it is skipped (the other rarities share its chance).
// Very rarely (potionChance) one of the choices is replaced by the Shared Potion, which heals
// the whole party. The potion is only offered when some living hero is hurt.
export function rollChoices({ itemDefs, count, heroes, rules, floor = 1, potionChance = 0, rng = Math.random }) {
  const pool = Object.values(itemDefs).filter((item) => item.kind !== 'potion' && heroes.some((h) => canReceive(h, item)));
  const sources = squadSources(heroes, itemDefs);
  const odds = rarityOddsFor(floor, rules);
  const choices = [];
  while (choices.length < count && pool.length) {
    const rarities = Object.keys(odds).filter((r) => odds[r] > 0 && pool.some((item) => item.rarity === r));
    if (!rarities.length) break;
    const rarity = rarities[pickWeighted(rarities, (r) => odds[r], rng)];
    const inRarity = pool.filter((item) => item.rarity === rarity);
    const item = inRarity[pickWeighted(inRarity, (it) => dropWeight(it, sources, rules), rng)];
    choices.push(item);
    pool.splice(pool.indexOf(item), 1);
  }

  const potion = Object.values(itemDefs).find((item) => item.kind === 'potion');
  const hurt = heroes.some((h) => h.alive && h.hp < h.maxHp);
  if (potion && hurt && choices.length && rng() < potionChance) {
    choices[Math.floor(rng() * choices.length)] = potion;
  }
  return choices;
}
