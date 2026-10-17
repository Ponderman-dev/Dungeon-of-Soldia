// Fills the enemy proposal page with the sprites: node docs/proposals/make-enemy-page.mjs <src.html> <out.html>
import fs from 'fs';
import { designs, toGame } from './enemy-designs.mjs';
const [src, out] = process.argv.slice(2);
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const sprites = {};
for (const d of designs) sprites[d.id] = { ...toGame(d), fodder: d.tier === 'fodder' };
const enemies = r('enemies.json');
sprites.goblin = { parts: enemies.goblin.parts };
const knight = r('heroes.json').find((h) => h.id === 'knight');
sprites.knight = { parts: knight.parts };
fs.writeFileSync(out, fs.readFileSync(src, 'utf8').replace('/*SPRITES*/{}', JSON.stringify(sprites)));
