// Builds the puzzle proposal page: node docs/proposals/puzzles/make.mjs <out.html>
// sprites.js = heroes, enemies, chest, mimic, coin and crystal drawn from the game data (1x, the page scales them).
import fs from 'fs';
const here = (f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const page = here('./template.html').replace('/*SPRITES*/', here('./sprites.js'));
fs.writeFileSync(process.argv[2], page);
console.log('wrote', process.argv[2], Math.round(page.length / 1024), 'KB');
