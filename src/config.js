// Game-wide constants. Gameplay data (heroes, items...) goes in src/data/*.json, not here.
export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 844;
export const BG_COLOR = '#14101f';

// Characters are designed on a ~32x32 pixel grid, then scaled up by this whole number.
export const CHAR_SCALE = 3;

// A shooter's built-in attack motion (no attack clip drawn): the weapon kicks up and the body leans back.
// kick = degrees, lean = pixels back (art pixels), up/back = ms for the kick and the return.
export const SHOOT_MOTION = { kick: 30, lean: 2, up: 70, back: 170 };
// The Cleric's Grace heal (built-in, when she has no `bless` clip): she hops up `lift` px with her staff raised
// `raise` degrees, holds it `hold` ms, then lowers it; she glows `glow` colour for `glowMs`.
export const BLESS_MOTION = { lift: 6, raise: 70, up: 120, hold: 220, down: 200, glow: 0xfff2a0, glowMs: 160 };

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
  // Window frame style (uiKit drawWindow): 'single' = one 2px white line (today). Session 40 trials (dev url flag
  // ?frame=double|shadow|rivets): 'double' = classic RPG double line, 'shadow' = white line + grey inner line,
  // 'rivets' = white line + square corner plates.
  frame: 'single',
  frameShadow: 0x4a4a58, // the grey inner line of the 'shadow' frame
  // THEME TRIAL (session 40, user's reference pictures: framed panels, solid buttons, clearer navigation): dev url flag
  // ?theme=gold = dark slate panels with a gold frame + corner studs, solid gold buttons with dark text, title strips.
  theme: 'gold', // the framed theme is ON (user picked F, session 40); 'mono' = the old black and white
  palette: 'crimson', // user's pick F: gold frames, deep wine-red panels, crimson buttons with cream text
  goldTheme: {
    outline: 0x0d0b12, frame: 0xd8a640, frameDark: 0x7a5a22, stud: 0xffe39a, fill: 0x221f2b, strip: 0x34303f,
    stripLine: 0x15131b, slot: 0x18161f, chosen: 0xfff0b0, dim: 0x5a5666, pressedFill: 0x3a3446,
    button: 0xe8b444, buttonDark: 0xb98428, buttonLight: 0xffe08a, buttonText: '#2b1c0a', title: '#ffe7a8',
    // SECONDARY buttons (user, session 40: only BEGIN DESCENT is the bright one; every other button calmer): a dark
    // raised button with cream text.
    second: 0x3e3a4a, secondDark: 0x2c2936, secondLight: 0x5a5568, secondText: '#ffe7a8',
  },
  // How a menu page (Glossary, Heroes, Leaders, Shop, Settings, Profile) comes and goes (uiKit pageEnter / pageLeave):
  // it slides in from the side over the screen behind (user, session 41: 'slides from the side instead of appearing'),
  // and slides back out the same side. from = 'right' | 'left'; both ways take motion.normal.
  page: { from: 'right' },
  // ONE MOTION LANGUAGE (docs/transition-plan.md; user, session 41: QUICK and snappy, tab content slides SIDEWAYS,
  // pop-ups DROP from above, sounds later). Every transition takes its time from here (systems/motion.js):
  // fast = tabs, buttons, pop-ups; normal = menu pages, sheets, scene fades; slow = big moves (camp <-> squad, into the
  // camp); story = the title's fly to the tower (only story moments may run past ~0.6s). Arriving things ease OUT,
  // leaving things ease IN, big camera moves ease in-out. popDropPx = how far a pop-up drops in from; slidePx = how
  // far tab content slides sideways.
  motion: {
    fast: 140, normal: 220, slow: 450, story: 1100,
    easeIn: 'Cubic.easeIn', easeOut: 'Cubic.easeOut', easeMove: 'Sine.easeInOut', easeDrop: 'Back.easeOut',
    popDropPx: 48, slidePx: 40,
  },
  // Other palettes for the same framed theme (dev flag ?pal=silver|copper|jade|crimson): they replace these keys of
  // goldTheme (session 40 trial, user: 'more variations, other palettes').
  palettes: {
    silver: { frame: 0xc8ced8, frameDark: 0x5a6070, stud: 0xffffff, fill: 0x1b2130, strip: 0x2a3244, stripLine: 0x10141d, slot: 0x151a26, chosen: 0xffe08a, dim: 0x4e5466, pressedFill: 0x30384a, button: 0xc8ced8, buttonDark: 0x8e96a6, buttonLight: 0xffffff, buttonText: '#141a26', title: '#e8eef8' },
    copper: { frame: 0xd2834a, frameDark: 0x6e3a1e, stud: 0xffc89a, fill: 0x2a1f1a, strip: 0x3c2c24, stripLine: 0x170f0c, slot: 0x201814, chosen: 0xffe2a0, dim: 0x5e5048, pressedFill: 0x45352c, button: 0xe08a4c, buttonDark: 0xa85a2c, buttonLight: 0xffc89a, buttonText: '#2a1408', title: '#ffd6b0' },
    jade: { frame: 0x5fc4a0, frameDark: 0x245a4a, stud: 0xc8ffe8, fill: 0x142220, strip: 0x1f3430, stripLine: 0x0b1412, slot: 0x101b19, chosen: 0xffe08a, dim: 0x46585a, pressedFill: 0x2a403c, button: 0x6fd2ac, buttonDark: 0x3c9a7a, buttonLight: 0xc8ffe8, buttonText: '#0c231c', title: '#c8ffe8' },
    crimson: { frame: 0xd8a640, frameDark: 0x6a2028, stud: 0xffe39a, fill: 0x261418, strip: 0x3a1c22, stripLine: 0x140a0c, slot: 0x1e1013, chosen: 0xfff0b0, dim: 0x5a4448, pressedFill: 0x45262c, button: 0xc8423a, buttonDark: 0x8e2824, buttonLight: 0xff8a7a, buttonText: '#fff0d8', title: '#ffe7a8', second: 0x4a2a30, secondDark: 0x33191e, secondLight: 0x6e4048, secondText: '#ffe7a8' },
  },
};
