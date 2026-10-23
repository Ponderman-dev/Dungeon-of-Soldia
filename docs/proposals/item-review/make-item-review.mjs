// Builds the ITEM REVIEW page: every item of the game (items.json) with its real framed icon (itemIcons.json +
// rarities.json frames, drawn exactly like the game: systems/itemIcons.js), its text, a NEW tag for the round's new
// items (NEW_ITEMS, + a real-fight clip each: CLIPS) and a notes box per item. The notes are saved in the page's database
// (collection `notes3` this round, doc id = item id: { note, name, updatedAt }); read them with ArtifactData `list`.
// Each card also plays what the item SHOWS IN A FIGHT on a little stage (Knight vs Goblin), with the game's own effect
// code (src/studio/fxStage.js, bundled by vite.fx.config.js): its icon pop when the game pops it, then its effects (FX).
// node docs/proposals/item-review/make-item-review.mjs <out.html>   (builds the effect bundle first)
import fs from 'fs';
import { execSync } from 'child_process';
import { framedIconPixels } from '../../../src/systems/itemIcons.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../../../src/data/${f}`, import.meta.url)));
const items = read('items.json');
const icons = read('itemIcons.json');
const rarities = read('rarities.json');

// A framed icon as { p: palette of '#rrggbb', r: rows of palette letters ('.' = empty) }.
const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function packGrid(grid) {
  const pal = [];
  const rows = grid.map((row) => row.map((c) => {
    if (c === null) return '.';
    const hex = '#' + c.toString(16).padStart(6, '0');
    let i = pal.indexOf(hex);
    if (i < 0) { pal.push(hex); i = pal.length - 1; }
    return LETTERS[i];
  }).join(''));
  return { p: pal, r: rows };
}

// What each item plays after its icon pop (item-fx-show.json).
const FX = JSON.parse(fs.readFileSync(new URL('./item-fx-show.json', import.meta.url), 'utf8'));
// Which items pop their icon in a fight: every itemId the fight rules put on a proc event, the non-silent procs and the
// damage bonuses that show (Sucker Punch, Executioner), minus the noPop ones (itemFx.json).
const rulesSrc = fs.readFileSync(new URL('../../../src/systems/BattleState.js', import.meta.url), 'utf8');
const itemFxData = read('itemFx.json');
const popIds = new Set([...rulesSrc.matchAll(/itemId: '([a-z_]+)'/g)].map((m) => m[1]).concat(['sucker_punch_glove', 'executioners_axe']));
for (const [id, it] of Object.entries(items)) for (const e of it.effects || []) if (e.proc && !e.silent) popIds.add(id);
for (const [id, v] of Object.entries(itemFxData)) if (v && v.noPop) popIds.delete(id);

// Round 3: the 21 new items (session 27). Those with a look get a clip recorded in a real fight
// (docs/proposals/item-fx-review/record.mjs, published next to the page as clips/<clip>.mp4 + .webm).
const NEW_ITEMS = ['hunters_badge', 'elites_badge', 'swarm_swatter', 'better_odds', 'opening_horn', 'quick_fingers', 'life_crystal', 'emergency_buckler', 'rally_flag', 'frost_mantle', 'reapers_bell', 'ice_bomb', 'electric_bomb', 'dark_bomb', 'poison_bombs', 'bombardiers_barrel', 'sweeping_strap', 'kinetic_coil', 'sharpest_blade', 'euclid_of_elements', 'frozen_demon_head'];
const BOMBS = 'Fire Bombs\' bomb in each element\'s colours: ice (Knight), electric + dark (Rogue), poison (Archer).';
const CLIPS = {
  ice_bomb: ['bombs', BOMBS], electric_bomb: ['bombs', BOMBS], dark_bomb: ['bombs', BOMBS], poison_bombs: ['bombs', BOMBS],
  bombardiers_barrel: ['barrel', 'Archer with all 5 bombs: when a bomb goes off, 2-4 more fly 0.15s apart (\'Bombs away!\').'],
  life_crystal: ['life-crystal', 'A kill pops a green orb out of the dead enemy, small orbs fly to the heroes it heals.'],
  reapers_bell: ['reapers-bell', 'Every kill explodes in a purple cloud (the Puffshroom cloud) and can chain.'],
  frozen_demon_head: ['demon-head', 'The Mage stores ice; when full, a giant icicle (your sketch) traps the enemy, holds it still while frozen, then shatters.'],
  euclid_of_elements: ['euclid', 'A hit with 2+ elements casts 3 more times, 0.15s apart: a fireball / icicle / white bolt flies for each (Archer: fire + ice + electric charms).'],
  sharpest_blade: ['sharpest-blade', '\'Heart strike!\' (4.5x + stun): a huge bright-yellow slash through the enemy.'],
  kinetic_coil: ['kinetic-coil', 'Rogue dodges store charges for an electric hit. Open: the charges have NO look yet (sparks on the hero?).'],
  emergency_buckler: ['emergency-buckler', 'Each kill gives the killer a small shield (normal shield look) that fades over 4s.'],
  rally_flag: ['rally-flag', 'The Knight drops under 30%: every hero gets a shield (normal shield look).'],
  sweeping_strap: ['sweeping-strap', 'Every strap hit: one Sven-style cleave crescent bursts out of the target (reach 60px).'],
  frost_mantle: ['frost-mantle', 'A melee enemy that hits the holder gets chilled (icon pop + snowflake status).'],
};

const ORDER = ['common', 'rare', 'epic', 'legendary'];
const list = Object.entries(items)
  .filter(([, it]) => it.kind !== 'potion')
  .map(([id, it]) => ({
    id, name: it.name, rarity: it.rarity, type: it.type || '', desc: it.description || '', perStack: it.perStack || '',
    isNew: NEW_ITEMS.includes(id), clip: CLIPS[id] ? CLIPS[id][0] : '', clipNote: CLIPS[id] ? CLIPS[id][1] : '',
    pop: popIds.has(id), fx: FX[id] || [],
    icon: packGrid(framedIconPixels(icons[id], rarities[it.rarity] && rarities[it.rarity].frame)),
  }))
  .sort((a, b) => ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name));
const rar = Object.fromEntries(ORDER.map((r) => [r, { label: rarities[r].label, color: '#' + Number(rarities[r].color).toString(16).padStart(6, '0') }]));

execSync('npx vite build --config docs/proposals/item-review/vite.fx.config.js', { cwd: new URL('../../../', import.meta.url), stdio: 'inherit' });
const fxBundle = fs.readFileSync(new URL('./dist/fx.js', import.meta.url), 'utf8').replaceAll('</script', '<\\/script');
const template = fs.readFileSync(new URL('./template.html', import.meta.url), 'utf8');
const data = JSON.stringify({ items: list, rarities: rar }).replaceAll('</', '<\\/');
const out = template.replace('/*DATA*/null', () => data).replace('/*FXBUNDLE*/', () => fxBundle);
fs.writeFileSync(process.argv[2] || 'item-review.html', out);
console.log(`wrote ${process.argv[2]}: ${list.length} items, ${list.filter((x) => x.isNew).length} new`);
