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
  // THE THEME (user's pick F, session 40; ember brown panels session 41): dark panels with a gold frame + corner
  // studs, crimson primary buttons with cream text, calm dark secondary buttons, title strips. Drawn by uiKit.
  goldTheme: {
    outline: 0x0d0b12, frame: 0xd8a640, frameDark: 0x4a2e22, stud: 0xffe39a, fill: 0x1a1412, strip: 0x2a201c,
    stripLine: 0x0c0908, slot: 0x14100e, chosen: 0xfff0b0, dim: 0x4e4640, pressedFill: 0x32261f,
    // PRIMARY button (only THE main action of a screen, e.g. BEGIN DESCENT): crimson with cream text.
    button: 0xc8423a, buttonDark: 0x8e2824, buttonLight: 0xff8a7a, buttonText: '#fff0d8', title: '#ffe7a8',
    // SECONDARY buttons (every other button, calmer): a dark raised button with cream text.
    second: 0x382a24, secondDark: 0x261c18, secondLight: 0x56443a, secondText: '#ffe7a8',
  },
  // How a menu page (Glossary, Heroes, Leaders, Shop, Settings, Profile) comes and goes (uiKit pageEnter / pageLeave):
  // it slides in over the screen behind and back out the same side, motion.normal both ways (user, session 41: 'slides
  // from the side instead of appearing', then 'variationize, not all from one side'). from = the side each page comes
  // from, matching where its camp button sits ('left' | 'right' | 'top' | 'bottom'); a page opened over another page
  // (Glossary -> Heroes) comes from `overPage`; any other page from `fallback`.
  page: {
    from: { Glossary: 'left', Heroes: 'bottom', Leaders: 'bottom', Shop: 'right', Settings: 'top', Profile: 'top' },
    overPage: 'right', fallback: 'right',
  },
  // ONE MOTION LANGUAGE (docs/transition-plan.md; user, session 41: QUICK and snappy, tab content slides SIDEWAYS,
  // pop-ups DROP from above, sounds later). Every transition takes its time from here (systems/motion.js):
  // fast = tabs, buttons, pop-ups; normal = menu pages, sheets, scene fades; slow = big moves (camp <-> squad, into the
  // camp); story = the title's fly to the tower (only story moments may run past ~0.6s). Arriving things ease OUT,
  // leaving things ease IN, big camera moves ease in-out. popDropPx = how far a pop-up drops in from; slidePx = how
  // far tab content slides sideways.
  // Reward / book page cards (uiKit drawRarityFrame, rarityShine): the frame's dark outline, and the legendary shine
  // (a glint glintPx long runs round the frame in loopMs, then waits pauseMs; corner sparkles twinkle).
  cardOutline: 0x0e0a0c,
  cardShine: { glintPx: 28, loopMs: 1600, pauseMs: 900, twinkleMs: 700, twinkleGapMs: 1300 },
  motion: {
    fast: 140, normal: 220, slow: 450, story: 1100,
    easeIn: 'Cubic.easeIn', easeOut: 'Cubic.easeOut', easeMove: 'Sine.easeInOut', easeDrop: 'Back.easeOut',
    popDropPx: 48, slidePx: 40,
  },
};
