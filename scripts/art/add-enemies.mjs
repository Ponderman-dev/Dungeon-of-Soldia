// Writes proposed enemies into enemies.json (sprites from docs/proposals/enemy-designs.mjs) and the dungeon
// roster. Run with the ids to add: node scripts/art/add-enemies.mjs swarmling boneRat ...
// Re-running replaces an enemy's entry (its sprite and its rules below).
import fs from 'fs';
import { designs, toGame } from '../../docs/proposals/enemy-designs.mjs';
const read = (f) => JSON.parse(fs.readFileSync(`src/data/${f}.json`, 'utf8'));
const write = (f, d) => fs.writeFileSync(`src/data/${f}.json`, JSON.stringify(d, null, 2) + '\n');

// Rules per enemy (the look comes from the design). `from` = first floor in the roster.
const RULES = {
  // ---- fodder (step 2)
  swarmling: { from: 13, tier: 'fodder', damageType: 'melee', weak: ['ice'], resists: ['fire'], xp: 10,
    stats: { health: 130, attack: 5, defense: 0, attackEfficiency: 110 },
    onHit: [{ status: 'burn', chance: 15, durationMs: 2000, damageMultiplier: 0.2, damageType: 'fire' }] },
  boneRat: { from: 25, tier: 'fodder', damageType: 'melee', weak: ['holy'], resists: [], xp: 8,
    stats: { health: 100, attack: 4, defense: 0, evasion: 10, attackEfficiency: 160 } },
  shadeWisp: { from: 35, tier: 'fodder', damageType: 'dark', weak: ['holy'], resists: ['dark'], xp: 10,
    stats: { health: 110, attack: 5, defense: 0, resist: 10, evasion: 15, attackEfficiency: 100 } },
  mushling: { from: 22, tier: 'fodder', damageType: 'melee', weak: ['fire'], resists: [], xp: 9,
    stats: { health: 170, attack: 3, defense: 2, attackEfficiency: 80 },
    onDeath: { radius: 60, color: '#6de07a', apply: [{ status: 'poison', durationMs: 3000, damageMultiplier: 0.15, damageType: 'dark' }] } },
};

const ids = process.argv.slice(2);
const E = read('enemies');
const D = read('dungeons');
for (const id of ids) {
  const design = designs.find((d) => d.id === id);
  const rule = RULES[id];
  if (!design || !rule) throw new Error('unknown enemy ' + id);
  const { from, ...rest } = rule;
  const look = toGame(design);
  E[id] = { name: look.name, ...rest, flying: !!look.flying, ...look };
  D.A.roster = D.A.roster.filter((e) => e.id !== id);
  D.A.roster.push({ id, from });
}
D.A.roster.sort((a, b) => a.from - b.from);
write('enemies', E);
write('dungeons', D);
console.log('added', ids.join(', '));
