import { canReceive } from './items.js';

// Picks `count` different items for the reward screen. Rarer items come up less often.
// An item is only offered if at least one living hero could take it.
export function rollChoices({ itemDefs, rarities, count, heroes, rng = Math.random }) {
  const pool = Object.values(itemDefs).filter((item) => heroes.some((h) => canReceive(h, item)));
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
  return choices;
}
