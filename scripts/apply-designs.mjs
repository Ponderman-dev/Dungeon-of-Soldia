// Copies designs saved in the Character Studio into heroes.json / enemies.json / minions.json.
// Usage: node scripts/apply-designs.mjs <designs.json>
// <designs.json> is a list of saved designs: { kind: "hero"|"enemy"|"minion"|"item", id, height, hover?, parts }.
// Only the look changes (parts, height, hover, anims); stats and everything else stay as they are.
import fs from 'node:fs';

const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/apply-designs.mjs <designs.json>');
const designs = JSON.parse(fs.readFileSync(file, 'utf8'));

const paths = { hero: 'src/data/heroes.json', enemy: 'src/data/enemies.json', minion: 'src/data/minions.json', item: 'src/data/itemIcons.json' };
const heroes = JSON.parse(fs.readFileSync(paths.hero, 'utf8'));
const enemies = JSON.parse(fs.readFileSync(paths.enemy, 'utf8'));
const minions = JSON.parse(fs.readFileSync(paths.minion, 'utf8'));
const itemIcons = JSON.parse(fs.readFileSync(paths.item, 'utf8'));

// An item icon design (kind "item") has ONE part, "icon": its picture goes back into a 16x16 grid,
// placed where the part sits (the icon's box spans x -8..8 and y -16..0, feet at the bottom edge).
function iconArt(part) {
  const rows = part.art.rows;
  const w = Math.max(...rows.map((r) => r.length));
  const left = Math.round(part.x - w / 2 + 8);
  const top = Math.round(part.y - rows.length / 2 + 16);
  const grid = Array.from({ length: 16 }, () => Array(16).fill('.'));
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const gx = x + left, gy = y + top;
    if (ch !== '.' && gx >= 0 && gx < 16 && gy >= 0 && gy < 16) grid[gy][gx] = ch;
  }));
  return { palette: part.art.palette, rows: grid.map((r) => r.join('')) };
}

for (const d of designs) {
  if (d.kind === 'item') {
    const part = d.parts && (d.parts.icon || Object.values(d.parts)[0]);
    if (!itemIcons[d.id] || !part || !part.art) { console.log(`skip item ${d.id}`); continue; }
    itemIcons[d.id] = iconArt(part);
    console.log(`applied item icon ${d.id}`);
    continue;
  }
  const def = d.kind === 'hero' ? heroes.find((h) => h.id === d.id) : d.kind === 'minion' ? minions[d.id] : enemies[d.id];
  if (!def) {
    console.log(`skip ${d.kind} ${d.id}: not in the game data`);
    continue;
  }
  def.parts = d.parts;
  def.height = d.height;
  if (def.flying && d.hover !== undefined) def.hover = d.hover;
  // Timeline clips (anims) come with the design; a design without any removes old ones.
  if (d.anims && Object.keys(d.anims).length) def.anims = d.anims;
  else delete def.anims;
  console.log(`applied ${d.kind} ${d.id} (${Object.keys(d.parts).length} parts)`);
}

// Only rewrite the files that got a design (so the others keep their exact formatting).
const data = { hero: heroes, enemy: enemies, minion: minions, item: itemIcons };
for (const kind of new Set(designs.map((d) => d.kind))) {
  if (data[kind]) fs.writeFileSync(paths[kind], JSON.stringify(data[kind], null, 2) + '\n');
}
