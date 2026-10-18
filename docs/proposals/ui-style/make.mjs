// Builds the UI style proposal page: node docs/proposals/ui-style/make.mjs <out.html>
// sprites.js = hero/enemy/item pixels drawn from the game data; shots.js = screenshots of the game today.
import fs from 'fs';
const here = (f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const page = here('./template.html').replace('/*SPRITES*/', here('./sprites.js')).replace('/*SHOTS*/', here('./shots.js'));
fs.writeFileSync(process.argv[2], page);
console.log('wrote', process.argv[2], Math.round(page.length / 1024), 'KB');
