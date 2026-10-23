// Builds the NEW ITEM EFFECTS REVIEW page: one recorded clip per new item effect (record.mjs), each with OK / CHANGE + a note.
// 1) node record.mjs <dir> [port]   2) node make.mjs <dir>   -> <dir>/soldia-item-fx-review.html
// Publish with `root` = <dir> and files clips/* (clips are NOT in git: re-record them). Reuses the old 'New item effects'
// page url (see docs/proposals/README.md). Notes in db collection `review`, doc = clip id: { verdict: 'ok'|'change', text }.
import fs from 'node:fs';
import path from 'node:path';
import { framedIconPixels } from '../../../src/systems/itemIcons.js';

const DIR = path.resolve(process.argv[2]);
const read = (f) => JSON.parse(fs.readFileSync(new URL(`../../../src/data/${f}`, import.meta.url)));
const items = read('items.json'), icons = read('itemIcons.json'), rarities = read('rarities.json');

// [clip id, title, item ids, what the clip shows, what is still open about its look]
const CLIPS = [
  ['bombs', 'Element bombs', ['ice_bomb', 'electric_bomb', 'dark_bomb', 'poison_bombs'], 'Fire Bombs\' bomb in each element\'s colours: ice (Knight), electric + dark (Rogue), poison (Archer). Chance pushed up for the clip.', ''],
  ['barrel', 'Bombardier\'s Barrel', ['bombardiers_barrel'], 'Archer with all 5 bombs: when a bomb goes off the barrel throws 2-4 more, 0.15s apart (\'Bombs away!\' icon pop).', ''],
  ['life-crystal', 'Life Crystal', ['life_crystal'], 'A kill pops a green orb out of the dead enemy, small orbs fly to the heroes it heals (green numbers).', ''],
  ['reapers-bell', 'Reaper\'s Bell', ['reapers_bell'], 'Every kill explodes in a purple cloud (the Puffshroom death cloud) and can chain to the next enemy.', ''],
  ['demon-head', 'Frozen Demon Head', ['frozen_demon_head'], 'Mage + Archer store ice damage; when full, Ice Spikes burst under an enemy + shake, then FREEZE.', 'Spikes are plain pale triangles right now; could be redrawn as pixel ice.'],
  ['euclid', 'Euclid of Elements', ['euclid_of_elements'], 'A hit with 2+ elements casts 3 more times, 0.15s apart (normal hits of those elements, \'Euclid!\' pop).', ''],
  ['sharpest-blade', 'Sharpest Blade', ['sharpest_blade'], '\'Heart strike!\': 4.5x hit + stun. Today only the icon pop and a normal hit number.', 'No big look yet: maybe a big dramatic slash?'],
  ['kinetic-coil', 'Kinetic Coil', ['kinetic_coil'], 'Rogue dodges store charges, the next attack adds electric damage.', 'Charges have NO look at all yet (maybe sparks on the hero?).'],
  ['emergency-buckler', 'Emergency Buckler', ['emergency_buckler'], 'Each kill gives the killer a small shield (the normal shield bar + ring) that fades over 4s.', ''],
  ['rally-flag', 'Rally Flag', ['rally_flag'], 'The Knight drops under 30%: every hero gets a shield (normal shield look).', ''],
  ['sweeping-strap', 'Sweeping Strap', ['sweeping_strap'], 'Knight + Samurai basic attacks also hit enemies next to the target for a small amount.', 'Side hits only show as small numbers.'],
  ['frost-mantle', 'Frost Mantle', ['frost_mantle'], 'A melee enemy that hits the holder gets chilled (snowflake status icon, icon pop).', ''],
];

const L = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function packGrid(grid) {
  const pal = [];
  const rows = grid.map((row) => row.map((c) => { if (c === null) return '.'; const h = '#' + c.toString(16).padStart(6, '0'); let i = pal.indexOf(h); if (i < 0) { pal.push(h); i = pal.length - 1; } return L[i]; }).join(''));
  return { p: pal, r: rows };
}
const hex = (n) => '#' + Number(n).toString(16).padStart(6, '0');
const data = CLIPS.map(([id, title, ids, shows, open]) => ({ id, title, shows, open,
  items: ids.map((i) => ({ name: items[i].name, desc: items[i].description, rarity: rarities[items[i].rarity].label, color: hex(rarities[items[i].rarity].color), icon: packGrid(framedIconPixels(icons[i], rarities[items[i].rarity].frame)) })) }));
const tpl = fs.readFileSync(new URL('./template.html', import.meta.url), 'utf8');
fs.writeFileSync(path.join(DIR, 'soldia-item-fx-review.html'), tpl.replace('/*DATA*/', () => `const CLIPS = ${JSON.stringify(data)};`));
console.log('wrote', path.join(DIR, 'soldia-item-fx-review.html'));
