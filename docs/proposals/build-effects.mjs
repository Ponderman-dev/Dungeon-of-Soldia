// Rebuilds docs/proposals/hit-effects.html (the animated effects proposal page) from the pieces in this
// folder: sprite data + engine + effects + the simplified/stress sections. Item icons come from the game.
// Usage: node docs/proposals/build-effects.mjs   (then publish hit-effects.html, see README.md)
import fs from 'node:fs';
const here = (f) => new URL(f, import.meta.url);
const read = (f) => fs.readFileSync(here(f), 'utf8');
const data = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url), 'utf8'));
const icons = data('itemIcons.json'), items = data('items.json'), rar = data('rarities.json');
const statusIcons = data('statusIcons.json');
const fxIcons = `const STATUS_ICONS=${JSON.stringify(statusIcons)};\nconst ICON_ART=${JSON.stringify(icons)};\nconst ICON_RAR=${JSON.stringify(Object.fromEntries(Object.keys(icons).map((k) => [k, items[k].rarity])))};\nconst ICON_FRAME=${JSON.stringify(Object.fromEntries(Object.entries(rar).map(([k, v]) => [k, v.frame])))};\n`;
const tpl = read('page-template.html');
const assemble = tpl.slice(tpl.indexOf('function assemble(h){'), tpl.indexOf('function draw(ctx'));
const page = read('hit-effects.html');
const i = page.indexOf('<script>') + '<script>'.length, j = page.lastIndexOf('buildSprites();');
const body = read('sprites-data.js') + read('old-enemies.js') +
  'function size(s){ return { w: Math.max(...s.rows.map(r=>r.length)), h: s.rows.length }; }\n' + assemble +
  read('fx-engine.js') + read('fx-effects.js') + '\n' + fxIcons + read('fx-simple.js') + read('fx-stress.js') + '\n' + read('fx-icons.js') + '\n';
fs.writeFileSync(here('hit-effects.html'), page.slice(0, i) + '\n' + body + page.slice(j));
console.log('wrote docs/proposals/hit-effects.html');
