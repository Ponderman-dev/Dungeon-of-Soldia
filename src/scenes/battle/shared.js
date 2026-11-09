// Constants and look-up tables shared by BattleScene.js and its method files in this folder (positions, depths,
// combat.json shortcuts, skill name -> look tables).
import { GAME_WIDTH, CHAR_SCALE } from '../../config.js';
import combatRules from '../../data/combat.json';
import rawItems from '../../data/items.json';
import rawSkills from '../../data/skills.json';
import skillFxData from '../../data/skillFx.json';
import effectsData from '../../data/effects.json';
import { makeTuner } from '../../systems/fxTune.js';
import { loadItems } from '../../systems/items.js';

export const DUNGEON_ID = 'A';
export const SLOT_Y = 720;
export const ENEMY_Y = 340;
export const BAR_WIDTH = 44;
export const POP_REPEAT_MS = 600; // the same word over one fighter is not popped again within this time
export const WALL_H = 200; // the back wall (with the door) fills the top of each floor
export const DOOR_X = GAME_WIDTH / 2;
export const T = combatRules.transition;
export const M = combatRules.attackMotion; // how walking looks (hop) and arrows
export const FX = combatRules.skillFx; // how skills look when they go off
export const itemDefs = loadItems(rawItems);
// Effect settings from the Studio (speed and colour swaps per effect, data/effects.json).
export const TUNE = makeTuner(effectsData);
// Skill name -> its own cast effect (skillFx.json; a rotation spell is 'skillId:SHORT').
export const DASH_BY_NAME = {}; // skill name -> its dash (combat.json skillFx.dash)
export const WAVE_BY_NAME = {}; // skill name -> its per-wave look (combat.json skillFx.wave)
export const SKILL_FX_BY_NAME = {};
export const LOOK_BY_NAME = {}; // skill (or rotation spell) name -> how its v2 look plays (combat.json skillFx.look), with its id
for (const [id, sk] of Object.entries(rawSkills)) {
  if (id.startsWith('_')) continue;
  if (sk.rotation) for (const r of sk.rotation) SKILL_FX_BY_NAME[r.name] = skillFxData[`${id}:${r.short}`];
  else SKILL_FX_BY_NAME[sk.name] = skillFxData[id];
  if (sk.rotation) for (const r of sk.rotation) { const L = combatRules.skillFx.look[`${id}:${r.short}`]; if (L) LOOK_BY_NAME[r.name] = { ...L, id, area: r.area }; }
  else if (combatRules.skillFx.look[id]) LOOK_BY_NAME[sk.name] = { ...combatRules.skillFx.look[id], id, area: sk.area, landSplash: sk.landSplash, holyNova: sk.holyNova };
  if (combatRules.skillFx.dash[id]) DASH_BY_NAME[sk.name] = combatRules.skillFx.dash[id];
  if (combatRules.skillFx.wave[id]) WAVE_BY_NAME[sk.name] = combatRules.skillFx.wave[id];
}
export const skillDefs = rawSkills;
// A skill's per-wave look (combat.json skillFx.wave), by the wave's skill (a copy of the skill def, so by name).
export const waveLook = (skill) => WAVE_BY_NAME[skill.name];
export const SKILL_Y = 772; // centre of the skill squares
export const SKILL_W = 40;
export const SKILL_H = 44;

// Depth order: floor < slots < hero < hero bars < popups < banner/HUD
// How big one character pixel is on screen (bosses use finer pixels: `drawScale` in enemies.json).
export const BANNER_Y = 520; // the big banner text (rooms); 'Floor N cleared!' goes higher (combat.json transition.clearBannerY)
export const charScale = (def) => def.drawScale ?? CHAR_SCALE;

export const DEPTH = { floor: 0, slot: 1, marker: 2, hero: 5, heroBar: 6, doorFront: 7, popup: 10, hud: 20 };
