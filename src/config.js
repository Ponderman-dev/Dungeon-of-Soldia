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

// The interface look (user's pick, session 6: "Classic RPG Window"): black windows with a white 2px line and stepped
// corners, white Ironslab text (the game's own pixel font), colour only where it means something. Drawing helpers: src/entities/uiKit.js.
export const UI = {
  font: "'Ironslab', monospace", // the game's own pixel font, packed into the game (src/assets/fonts), so it works offline
  // Scenes ask for 8 / 16 / 24px (the old Press Start 2P sizes); entities/uiKit.js gridPx() turns them into Ironslab's
  // crisp sizes: x scale, rounded to the px grid (8 -> 10, 16 -> 20, 24 -> 30).
  fontGrid: { px: 10, scale: 1.25 },
  // Small text (asked for at maxPx or less) uses Press Start 2P instead (user, session 21: Ironslab is hard to read
  // small; Pixelify Sans and Tiny5 were tried). Press Start 2P is drawn on an 8px grid: crisp at 8 / 16 / 24px. Letters
  // are drawn one by one on whole pixels and every edge pixel is snapped (alpha >= snap), so nothing blurs.
  smallFont: { family: "'PressStart2P', monospace", maxPx: 8, px: 8, snap: 110, letterSpacing: 0.01 },
  size: { small: 8, normal: 16, big: 24, huge: 32 },
  window: 0x000000, // window fill
  line: 0xffffff, // window line
  text: '#ffffff',
  dim: '#8a8a9a', // disabled / hints
  gold: '#ffd84a', // rarity, stacks, important numbers
  red: '#ff7a5a', // attack skills, damage
  green: '#6ee07a', // support skills, heals
  pressed: 0xffffff, // a pressed button flips to white with black text
};
