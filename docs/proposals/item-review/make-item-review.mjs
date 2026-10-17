// Builds the ITEM REVIEW page: every item of the game (items.json) with its real framed icon (itemIcons.json +
// rarities.json frames, drawn exactly like the game: systems/itemIcons.js), its text, a NEW tag for the items that
// were never on the old icon page, and a notes box per item. The notes are saved in the page's database
// (collection `notes`, doc id = item id: { note, updatedAt }); read them with ArtifactData `list` of `notes`.
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
const oldPage = fs.readFileSync(new URL('../items-meta.js', import.meta.url), 'utf8'); // the 72 items of the old icon page

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

// What each item plays after its icon pop, as [group, name] effects of the effect stage (src/studio/fxStage.js).
const FX = {
  lucky_coin: [['hit', 'crit']], feather_boots: [['hit', 'dodge']], heart_charm: [['status', 'regenBoost']],
  war_banner: [['item', 'battleCry']], shield_totem: [['hit', 'block']], quick_gloves: [['hit', 'melee'], ['hit', 'melee']],
  bulwark_plate: [['item', 'thorns']], bloodlust_mask: [['item', 'lifesteal'], ['item', 'battleCry']], gamblers_dice: [['hit', 'crit'], ['item', 'dice']],
  fire_bombs: [['item', 'bomb']], chill_band: [['hit', 'ice'], ['status', 'chill']], static_crystal: [['item', 'lightning'], ['status', 'shock']],
  aid_kit: [['hit', 'heal']], sucker_punch_glove: [['item', 'suckerPunch']], bandage_roll: [['hit', 'heal']], second_wind_flask: [['hit', 'heal']],
  kindling: [['hit', 'fire']], frost_charm: [['hit', 'ice']], storm_charm: [['hit', 'electric']], shadow_charm: [['hit', 'dark']],
  ember_charm: [['status', 'burn']], venom_fang: [['status', 'poison']], rusty_nails: [['status', 'armorBreak']], serrated_edge: [['status', 'bleed']],
  hex_doll: [['status', 'curse']], dread_bell: [['status', 'fear']], gag_rune: [['status', 'silence']], fire_arrows: [['shot', 'firearrow'], ['hit', 'fire']],
  executioners_axe: [['item', 'executioner']], magma_core: [['status', 'burn']], shatter_hammer: [['item', 'shatter']], blood_chalice: [['status', 'bleed']],
  plague_flask: [['item', 'plague']], hunters_sigil: [['status', 'mark']], thousand_cuts: [['status', 'bleed'], ['item', 'knifeBurst']],
  frozen_thunderbolt: [['item', 'thunderbolt']], warding_charm: [['status', 'shield']], overheal_ring: [['status', 'shield']], spiked_aegis: [['item', 'aegisBlast']],
  provokers_horn: [['status', 'taunt']], spite_mail: [['status', 'taunt'], ['item', 'thorns']], martyrs_shield: [['hit', 'block']], fire_heart: [['status', 'shield'], ['hit', 'fire']],
  lost_clerics_grimoire: [['item', 'greenfire']], metronome: [['hit', 'melee']], mimic_chest: [['item', 'mimic']], jolly_banner: [['item', 'battleCry'], ['status', 'buff']],
  excalibur: [['item', 'tornado']], quiver_of_plenty: [['shot', 'ranged'], ['hit', 'ranged']], last_stand_banner: [['status', 'shield'], ['status', 'buff']],
  mirror_buckler: [['hit', 'dark']], phoenix_feather: [['status', 'invulnerable'], ['hit', 'heal']], flame_spirit: [['shot', 'darkbolt'], ['shot', 'darkbolt']],
  spirit_axe: [['item', 'spiritAxe']], heart_of_the_beast: [['status', 'regenBoost'], ['hit', 'heal']], moonlight_twinblade: [['item', 'moon']], ghastly_fire: [['hit', 'fire'], ['hit', 'dark']],
};
// Which items pop their icon in a fight: every itemId the fight rules put on a proc event, the non-silent procs and the
// damage bonuses that show (Sucker Punch, Executioner), minus the noPop ones (itemFx.json).
const rulesSrc = fs.readFileSync(new URL('../../../src/systems/BattleState.js', import.meta.url), 'utf8');
const itemFxData = read('itemFx.json');
const popIds = new Set([...rulesSrc.matchAll(/itemId: '([a-z_]+)'/g)].map((m) => m[1]).concat(['sucker_punch_glove', 'executioners_axe']));
for (const [id, it] of Object.entries(items)) for (const e of it.effects || []) if (e.proc && !e.silent) popIds.add(id);
for (const [id, v] of Object.entries(itemFxData)) if (v && v.noPop) popIds.delete(id);

const ORDER = ['common', 'rare', 'epic', 'legendary'];
const list = Object.entries(items)
  .filter(([, it]) => it.kind !== 'potion')
  .map(([id, it]) => ({
    id, name: it.name, rarity: it.rarity, type: it.type || '', desc: it.description || '', perStack: it.perStack || '',
    isNew: !oldPage.includes(`"${id}"`),
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
