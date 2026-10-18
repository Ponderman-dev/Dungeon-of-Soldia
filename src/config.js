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
// corners, white Press Start 2P text, colour only where it means something. Drawing helpers: src/entities/uiKit.js.
export const UI = {
  font: "'Press Start 2P', monospace", // the font file is packed into the game (src/assets/fonts), so it works offline
  // Press Start 2P is drawn on an 8-pixel grid: keep text sizes to multiples of 8 so every pixel stays even.
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
