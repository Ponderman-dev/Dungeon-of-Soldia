// Copies designs saved in the Character Studio into heroes.json / enemies.json.
// Usage: node scripts/apply-designs.mjs <designs.json>
// <designs.json> is a list of saved designs: { kind: "hero"|"enemy", id, height, hover?, parts }.
// Only the look changes (parts, height, hover); stats and everything else stay as they are.
import fs from 'node:fs';

const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/apply-designs.mjs <designs.json>');
const designs = JSON.parse(fs.readFileSync(file, 'utf8'));

const paths = { hero: 'src/data/heroes.json', enemy: 'src/data/enemies.json' };
const heroes = JSON.parse(fs.readFileSync(paths.hero, 'utf8'));
const enemies = JSON.parse(fs.readFileSync(paths.enemy, 'utf8'));

for (const d of designs) {
  const def = d.kind === 'hero' ? heroes.find((h) => h.id === d.id) : enemies[d.id];
  if (!def) {
    console.log(`skip ${d.kind} ${d.id}: not in the game data`);
    continue;
  }
  def.parts = d.parts;
  def.height = d.height;
  if (def.flying && d.hover !== undefined) def.hover = d.hover;
  console.log(`applied ${d.kind} ${d.id} (${Object.keys(d.parts).length} parts)`);
}

fs.writeFileSync(paths.hero, JSON.stringify(heroes, null, 2) + '\n');
fs.writeFileSync(paths.enemy, JSON.stringify(enemies, null, 2) + '\n');
