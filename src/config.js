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
  smallFont: { family: "'SoldiaSmall', monospace", maxPx: 8, px: 8, snap: 110, letterSpacing: 0.01 },
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
    // Quiet tiles + boxes (squad screen hero tiles and hero card boxes): fill, edge, locked edge, a picked tile's edge,
    // the card's body text. BAND = the gold band round BEGIN DESCENT (light outer line, dark inner line; *P = held).
    tileFill: 0x16110f, tileEdge: 0x3a2a22, tileLocked: 0x2e2a30, picked: 0xd8a640, body: '#cfc6b4',
    band: 0xd8a640, bandLight: 0xffe39a, bandDark: 0x8a6420, bandP: 0xb08530, bandLightP: 0xd8a640, bandDarkP: 0x6a4818,
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
  // BUTTON PRESS (uiKit pressable / drawButton pressed, user session 47: 'look like it's being pushed'): while held,
  // the button face sinks in (dark inset band on top, no shine) and the label drops sinkPx; the action runs on
  // RELEASE, after the press has shown for at least holdMs (a very quick tap still shows the push).
  press: { sinkPx: 2, holdMs: 90 },
  // FLAT BUTTON (uiKit drawFlatButton; the camp's look, session 44 'cleaner and sleeker', shared with the squad screen
  // session 47): gold line px, darker foot px, the gold band px of a banded main button (EXPEDITION, BEGIN DESCENT).
  flat: { line: 2, foot: 6, band: 8 },
  motion: {
    fast: 140, normal: 220, slow: 450, story: 1100,
    easeIn: 'Cubic.easeIn', easeOut: 'Cubic.easeOut', easeMove: 'Sine.easeInOut', easeDrop: 'Back.easeOut',
    popDropPx: 48, slidePx: 40,
  },
};

// LOOK TRIAL (session 49, TEMPORARY; user: 'I kinda want this vibe', docs/references/ui-vibe-pick-a-class.png): cool
// navy takes on the whole interface. Only the trial build (VITE_LOOK_TRIAL=1, the squad demo page) reads them: a switch
// row above the game (src/lookTrial.js) saves the pick in localStorage and reloads. Each look overwrites the keys it
// names (goldTheme keys + the UI text colours) before any scene loads, so module-level copies (const GOLD = UI.gold)
// see them too. studs false = no corner studs; flatEdge = no dark inner edge (frame line straight onto the fill);
// pageBg + dither = the menu pages' background (a 2-colour checker, cell px). Delete the losers after the pick.
export const LOOK_TRIAL = (import.meta.env && import.meta.env.VITE_LOOK_TRIAL) === '1';
export const LOOKS = {
  gold: {},
  // A STEEL: closest to the reference: flat navy panels, a pale steel-blue line, salmon titles, green main button.
  steel: {
    theme: {
      stud: 0xa8bad8, tileFill: 0x0f1626, tileEdge: 0x2c3a58, tileLocked: 0x222838, picked: 0x5fd4a4, body: '#c8cee4',
      band: 0x6f86ad, bandLight: 0xa8bad8, bandDark: 0x3a4a6c, bandP: 0x5a6e92, bandLightP: 0x6f86ad, bandDarkP: 0x2c3a58,
      outline: 0x070b14, frame: 0x6f86ad, frameDark: 0x121a2c, fill: 0x121a2c, strip: 0x1a2540, stripLine: 0x6f86ad,
      slot: 0x0d1424, chosen: 0x5fd4a4, dim: 0x363e52, pressedFill: 0x1f2b46, studs: false, square: true, flatEdge: true,
      button: 0x58772f, buttonDark: 0x3f5822, buttonLight: 0x7c9c4a, buttonText: '#eef4dc', title: '#f2916c',
      second: 0x2b3a5c, secondDark: 0x1d2843, secondLight: 0x435680, secondText: '#d4daee',
    },
    text: '#dfe3f4', dim: '#7c86a0', gold: '#f4ac6e', pageBg: 0x0a0f1c, dither: [0x0a0f1c, 0x0f1628, 4],
  },
  // B DUSK: a purple-slate cousin: lavender lines, MAROON secondary buttons (the reference's 'Cancel'), green main.
  dusk: {
    theme: {
      stud: 0xbab6dc, tileFill: 0x14132a, tileEdge: 0x34324e, tileLocked: 0x262434, picked: 0x6edc9c, body: '#cac6dc',
      band: 0x8c88b6, bandLight: 0xbab6dc, bandDark: 0x4a4670, bandP: 0x747098, bandLightP: 0x8c88b6, bandDarkP: 0x36345a,
      outline: 0x0a0812, frame: 0x8c88b6, frameDark: 0x1a1930, fill: 0x1a1930, strip: 0x24223e, stripLine: 0x8c88b6,
      slot: 0x13121f, chosen: 0x6edc9c, dim: 0x3e3a50, pressedFill: 0x2a2846, studs: false, square: true, flatEdge: true,
      button: 0x55752e, buttonDark: 0x3c5520, buttonLight: 0x7a9a48, buttonText: '#eef4dc', title: '#f08a6a',
      second: 0x6a2236, secondDark: 0x4a1626, secondLight: 0x8e3a52, secondText: '#f2dce2',
    },
    text: '#dcd8ec', dim: '#8480a0', gold: '#f2b86c', pageBg: 0x0e0c18, dither: [0x0e0c18, 0x15132a, 4],
  },
  // C DEEP: near-black navy, a crisp pale double line (light line + dark gap), maroon secondary, brighter green main.
  deep: {
    theme: {
      stud: 0xd8e2f4, tileFill: 0x0b111f, tileEdge: 0x26324c, tileLocked: 0x1c2232, picked: 0x58e0b0, body: '#ccd2e6',
      band: 0xa6b6d6, bandLight: 0xd8e2f4, bandDark: 0x4a5a7c, bandP: 0x8696b6, bandLightP: 0xa6b6d6, bandDarkP: 0x3a4a6c,
      outline: 0x04070e, frame: 0xa6b6d6, frameDark: 0x1a2640, fill: 0x0b111f, strip: 0x131c30, stripLine: 0x5a6c90,
      slot: 0x080d18, chosen: 0x58e0b0, dim: 0x2e3546, pressedFill: 0x18223a, studs: false, square: true, flatEdge: false,
      button: 0x4f8a3a, buttonDark: 0x366427, buttonLight: 0x74b05a, buttonText: '#f0f8e4', title: '#ff9a72',
      second: 0x5e1e30, secondDark: 0x401420, secondLight: 0x84344a, secondText: '#f4dee4',
    },
    text: '#e2e6f6', dim: '#76809a', gold: '#ffb070', pageBg: 0x060a14, dither: [0x060a14, 0x0c1424, 4],
  },
};
export const LOOK_NAMES = Object.keys(LOOKS);
const readPick = (key, list) => {
  try { const v = localStorage.getItem(key); return list.includes(v) ? v : list[0]; } catch { return list[0]; }
};
export const LOOK_PICK = LOOK_TRIAL ? readPick('soldia.lookTrial.look', LOOK_NAMES) : 'gold';
// FONT: soldia = today; thin = small text in Soldia Thin; thin+ = also the normal-size text (asked up to 16px; over 12
// = Soldia Thin at 2x), big titles stay Ironslab.
export const FONT_NAMES = ['soldia', 'thin', 'thin+'];
export const FONT_PICK = LOOK_TRIAL ? readPick('soldia.lookTrial.font', FONT_NAMES) : 'soldia';
// The gold look's own values, so a live switch back to gold (lookTrial.js) restores them.
const BASE = { theme: { ...UI.goldTheme }, text: UI.text, dim: UI.dim, gold: UI.gold, small: { ...UI.smallFont } };
export const LOOK_NOW = { look: LOOK_PICK, font: FONT_PICK }; // what is applied right now
export function applyLook(look, font) {
  const L = LOOKS[look];
  for (const k of Object.keys(UI.goldTheme)) if (!(k in BASE.theme)) delete UI.goldTheme[k]; // flags like square
  Object.assign(UI.goldTheme, BASE.theme, L.theme || {});
  for (const k of ['text', 'dim', 'gold']) UI[k] = L[k] || BASE[k];
  UI.pageBg = L.pageBg ?? null; // null = each page's own bg
  UI.dither = L.dither ?? null;
  for (const k of Object.keys(UI.smallFont)) if (!(k in BASE.small)) delete UI.smallFont[k];
  Object.assign(UI.smallFont, BASE.small, font === 'thin+' ? { maxPx: 16, px2From: 12 } : {});
  LOOK_NOW.look = look; LOOK_NOW.font = font;
}
applyLook(LOOK_PICK, FONT_PICK);
