// LOADING (session 58, user: 'pages drop fps the first time, can we do a loading first?'). Every pixel picture in the
// game (hero / enemy parts, skill / item / status icons, banners, the menu floor) is made the FIRST time a page needs
// it, so the first visit to the Heroes page, the glossary card or 'Who gets it?' stuttered (measured: one 250-370 ms
// frame at 4x slower CPU; the second visit was smooth). BootScene runs these steps behind a loading bar instead:
// each step makes its pictures once (they are shared by key, so the pages just find them later).
import Phaser from 'phaser';
import Character from './Character.js';
import { skillIconKey } from './skillIconTexture.js';
import { itemIconKey, bareIconKey } from './itemIconTexture.js';
import { statusIconKey } from './statusIconTexture.js';
import { floorTextureKey } from './floorTexture.js';
import { heroBanner, hasBanner } from './heroBanner.js';
import { uiText } from './uiKit.js';
import { lookDef } from '../systems/looks.js';
import heroes from '../data/heroes.json';
import enemies from '../data/enemies.json';
import minions from '../data/minions.json';
import roomProps from '../data/roomProps.json';
import skills from '../data/skills.json';
import items from '../data/items.json';
import statusIcons from '../data/statusIcons.json';
import shop from '../data/shop.json';
import dungeons from '../data/dungeons.json';

const defsOf = (o) => Object.entries(o).filter(([k, v]) => !k.startsWith('_') && v && typeof v === 'object' && v.parts).map(([, v]) => v);
const MENU_WALL_H = 200; // the menu pages' floor (floorCrop) and the battle floors share this wall height

// Makes a character once (its part pictures stay in the texture cache), then throws the object away.
const makeChar = (scene, def) => { try { new Character(scene, -200, -200, def).destroy(); } catch (e) { /* a bad def must never stop the game */ } };

// The warm-up as small steps (each a function), so the loading bar can move between them.
export function warmUpSteps(scene) {
  const steps = [];
  for (const def of heroes) steps.push(() => makeChar(scene, def));
  for (const look of shop.looks || []) {
    const def = heroes.find((h) => h.id === look.hero);
    if (def) steps.push(() => makeChar(scene, lookDef(def, look)));
  }
  for (const def of [...defsOf(enemies), ...defsOf(minions), ...defsOf(roomProps)]) steps.push(() => makeChar(scene, def));
  steps.push(() => {
    for (const id of Object.keys(skills)) skillIconKey(scene, id);
    for (const h of heroes) skillIconKey(scene, 'passive_' + h.id);
  });
  steps.push(() => { for (const [id, it] of Object.entries(items)) { itemIconKey(scene, id, it.rarity); bareIconKey(scene, id); } });
  steps.push(() => { for (const id of Object.keys(statusIcons)) if (!id.startsWith('_')) statusIconKey(scene, id); });
  // The floors: the menu pages' floor, then each battle floor of the first dungeon (the first fights).
  steps.push(() => floorTextureKey(scene, dungeons.A.tileColors[0], 0, MENU_WALL_H));
  for (const tint of dungeons.A.tileColors.slice(1)) steps.push(() => floorTextureKey(scene, tint, 0, MENU_WALL_H));
  // Banners are PNGs decoded by the browser: wait for each one.
  steps.push(() => Promise.all(heroes.filter((h) => hasBanner(h.id)).map((h) => new Promise((done) => {
    const img = heroBanner(scene, h.id, -400, -400, 1, 1, 1);
    const check = (n) => { if (scene.textures.exists('banner_' + h.id) || n > 200) { img.destroy(); done(); } else setTimeout(() => check(n + 1), 10); };
    check(0);
  }))));
  // Text: the font's letters in every text size, drawn once.
  steps.push(() => { for (const size of ['small', 'normal', 'big']) uiText(scene, -400, -400, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 +-%/>.,:!?()', size).destroy(); });
  return steps;
}

// Every picture made so far, drawn ONE time under the loading cover: the graphics card gets each picture now, not on
// the page that first shows it. Returns the images (destroy them after one frame has been drawn).
// One of each KIND of thing the pages draw is added too (window graphics, ovals, rectangles, a tiled backdrop, text,
// a cropped picture, a shadow-tinted one, things in a container): the first draw of each kind sets the graphics card
// up for it, which also cost a stutter on the first page that used it.
export function drawAllOnce(scene) {
  const skip = new Set(['__DEFAULT', '__MISSING', '__WHITE', '__NORMAL']);
  const keys = scene.textures.getTextureKeys().filter((k) => !skip.has(k));
  const out = keys.map((k) => scene.add.image(0, 0, k).setOrigin(0).setScale(0.05));
  const box = scene.add.container(0, 0);
  box.add([
    scene.add.graphics().fillStyle(0xffffff, 1).fillRect(0, 0, 8, 8).lineStyle(2, 0xffffff, 1).strokeRect(0, 0, 8, 8),
    scene.add.ellipse(4, 4, 8, 4, 0x000000, 0.35),
    scene.add.rectangle(0, 0, 8, 8, 0xffffff).setOrigin(0),
    scene.add.tileSprite(0, 0, 8, 8, keys[0]).setOrigin(0),
    uiText(scene, 0, 0, 'Ag', 'small'),
    scene.add.image(0, 0, keys[0]).setOrigin(0).setCrop(0, 0, 2, 2),
    scene.add.image(0, 0, keys[0]).setOrigin(0).setTint(0x1c1c26).setTintMode(Phaser.TintModes.FILL),
  ]);
  return [...out, box];
}
