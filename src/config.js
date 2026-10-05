// Game-wide constants. Gameplay data (heroes, items...) goes in src/data/*.json, not here.
export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 844;
export const BG_COLOR = '#14101f';

// Characters are designed on a ~32x32 pixel grid, then scaled up by this whole number.
export const CHAR_SCALE = 3;

// Skill squares: attack skills are red, support skills are green (fill when ready / not ready).
export const SKILL_COLORS = {
  attack: { ready: 0xb8402a, idle: 0x47201b },
  support: { ready: 0x2f9a55, idle: 0x1b3d27 },
};
