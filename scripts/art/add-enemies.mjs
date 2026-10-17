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
  // ---- the 10 new enemies, batch 1 (step 5)
  sapper: { from: 5, until: 35, damageType: 'melee', weak: ['ice'], resists: [], xp: 12,
    stats: { health: 150, attack: 5, defense: 0, evasion: 5, attackEfficiency: 125 },
    onDeath: { delayMs: 1500, radius: 75, color: '#ff7a3d', damageMultiplier: 2.5, damageType: 'fire' } },
  shaman: { from: 12, until: 50, damageType: 'dark', weak: ['physical'], resists: [], xp: 18,
    stats: { health: 150, attack: 5, defense: 0, resist: 10, attackEfficiency: 80 },
    abilities: [{ id: 'shaman_mend', name: 'Mend', minor: true, everyMs: 6000, firstMs: 3000, target: 'lowestAlly', healAllies: 15, needsHurt: true }] },
  shieldbearer: { from: 20, damageType: 'melee', weak: ['electric'], resists: ['physical'], xp: 20,
    stats: { health: 260, attack: 6, defense: 6, attackEfficiency: 80 },
    abilities: [{ id: 'bearer_guard', name: 'Guard', minor: true, everyMs: 8000, firstMs: 2000, target: 'lowestAlly', shield: { percentOwnHp: 20, durationMs: 8000 } }] },
  golem: { from: 46, max: 1, tier: 'strong', damageType: 'melee', weak: ['electric'], resists: ['physical'], xp: 40,
    stats: { health: 700, attack: 16, defense: 10, attackEfficiency: 45 },
    abilities: [{ id: 'golem_enrage', name: 'Enrage!', minor: true, hpBelow: 50, target: 'self', apply: [{ status: 'buff', durationMs: 600000, mods: [{ stat: 'attackEfficiency', percent: 50 }] }] }] },
  hound: { from: 58, damageType: 'melee', weak: ['ice'], resists: ['fire'], xp: 24,
    stats: { health: 220, attack: 7, defense: 2, evasion: 10, attackEfficiency: 150 },
    onHit: [{ status: 'burn', chance: 30, durationMs: 3000, damageMultiplier: 0.2, damageType: 'fire' }],
    abilities: [{ id: 'hound_howl', name: 'Howl!', minor: true, hpBelow: 30, target: 'otherAllies', apply: [{ status: 'buff', durationMs: 5000, mods: [{ stat: 'attackEfficiency', percent: 25 }] }] }] },
  // ---- batch 2
  worm: { from: 38, damageType: 'melee', weak: ['fire'], resists: [], xp: 26,
    stats: { health: 300, attack: 8, defense: 4, attackEfficiency: 80 },
    abilities: [{ id: 'worm_burrow', name: 'Burrow', minor: true, everyMs: 8000, firstMs: 4000, target: 'self', burrow: { ms: 1500, stunMs: 800, damageMultiplier: 1 } }] },
  acolyte: { from: 42, damageType: 'dark', weak: ['holy'], resists: ['dark'], xp: 24,
    stats: { health: 200, attack: 6, defense: 0, resist: 15, attackEfficiency: 80 },
    raise: { radius: 180, into: 'risen_skeleton' } },
  blinkimp: { from: 52, damageType: 'melee', weak: ['ice'], resists: [], xp: 24,
    stats: { health: 200, attack: 8, defense: 0, evasion: 15, attackEfficiency: 110 },
    abilities: [{ id: 'imp_blink', name: 'Blink', minor: true, everyMs: 5000, firstMs: 2500, target: 'lowestHero', blink: true, damageMultiplier: 1.3 }] },
  banshee: { from: 65, damageType: 'dark', weak: ['holy'], resists: [], xp: 28,
    stats: { health: 220, attack: 7, defense: 0, resist: 10, evasion: 15, attackEfficiency: 90 },
    abilities: [{ id: 'banshee_wail', name: 'Wail', minor: true, everyMs: 10000, firstMs: 5000, castMs: 1500, target: 'allHeroes', apply: [{ status: 'silence', durationMs: 1500 }] }] },
  sentinel: { from: 75, damageType: 'melee', weak: [], resists: [], xp: 32,
    stats: { health: 450, attack: 10, defense: 10, resist: 10, attackEfficiency: 80 },
    adapt: { ms: 4000 } },
};

const ids = process.argv.slice(2);
const E = read('enemies');
const D = read('dungeons');
for (const id of ids) {
  const design = designs.find((d) => d.id === id);
  const rule = RULES[id];
  if (!design || !rule) throw new Error('unknown enemy ' + id);
  const { from, until, max, ...rest } = rule;
  const look = toGame(design);
  E[id] = { name: look.name, ...rest, flying: !!look.flying, ...look };
  D.A.roster = D.A.roster.filter((e) => e.id !== id);
  D.A.roster.push({ id, from, ...(until !== undefined && { until }), ...(max !== undefined && { max }) });
}
D.A.roster.sort((a, b) => a.from - b.from);
write('enemies', E);
write('dungeons', D);
console.log('added', ids.join(', '));
