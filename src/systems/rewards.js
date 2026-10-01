import { canReceive } from './items.js';

// Picks `count` different items for the reward screen. Rarer items come up less often.
// An item is only offered if at least one living hero could take it.
// Very rarely (potionChance) one of the choices is replaced by the Shared Potion, which heals
// the whole party. The potion is only offered when some living hero is hurt.
export function rollChoices({ itemDefs, rarities, count, heroes, potionChance = 0, rng = Math.random }) {
  const pool = Object.values(itemDefs).filter((item) => item.kind !== 'potion' && heroes.some((h) => canReceive(h, item)));
  const choices = [];
  while (choices.length < count && pool.length) {
    const total = pool.reduce((sum, item) => sum + rarities[item.rarity].weight, 0);
    let roll = rng() * total;
    let index = 0;
    while (index < pool.length - 1 && roll >= rarities[pool[index].rarity].weight) {
      roll -= rarities[pool[index].rarity].weight;
      index++;
    }
    choices.push(pool.splice(index, 1)[0]);
  }

  const potion = Object.values(itemDefs).find((item) => item.kind === 'potion');
  const hurt = heroes.some((h) => h.alive && h.hp < h.maxHp);
  if (potion && hurt && choices.length && rng() < potionChance) {
    choices[Math.floor(rng() * choices.length)] = potion;
  }
  return choices;
}
