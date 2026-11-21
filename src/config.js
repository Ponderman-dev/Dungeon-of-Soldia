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
  // THE DUSK LOOK (session 49, user's pick 'Dusk + Soldia font + Salmon' from a live trial of 4 looks inspired by
  // docs/references/ui-vibe-pick-a-class.png). Was crimson + gold (session 40, `git show 4fc5724:src/config.js`).
  text: '#dcd8ec', // pale lavender-grey
  dim: '#8480a0', // disabled / hints
  gold: '#ffd84a', // rarity, stacks, important numbers, the title (yellow: user kept it outside fights)
  fightGold: '#f6b49a', // fight pop-ups: crits, Lv labels, LEVEL UP, passive words (soft peach)
  red: '#ff7a5a', // attack skills, damage
  green: '#6ee07a', // support skills, heals
  pressed: 0xffffff, // a pressed button flips to white with black text
  pageBg: 0x0e0c18, // every menu page's background (uiKit pageBackdrop) ...
  dither: [0x0e0c18, 0x15132a, 4], // ... with a 2-colour checker: [base, checker colour, cell px]
  // THE THEME (keeps its old name goldTheme): SQUARE windows with one thin lavender line on a flat dark purple-navy fill
  // (square: true, studs: false, flatEdge: true; the old framed drawing stays in uiKit for square: false), FLAT
  // one-colour buttons: SALMON main button, MAROON other buttons, salmon titles; picked / chosen outlines in light salmon.
  // Header boxes (quiet windows) and the squad name plates / hero tiles use the tile colours. Drawn by uiKit.
  goldTheme: {
    outline: 0x0a0812, frame: 0x8c88b6, frameDark: 0x1a1930, stud: 0xbab6dc, fill: 0x1a1930, strip: 0x24223e,
    stripLine: 0x8c88b6, slot: 0x13121f, chosen: 0xe08a72, dim: 0x3e3a50, pressedFill: 0x2a2846,
    studs: false, square: true, flatEdge: true,
    // PRIMARY button (only THE main action of a screen: EXPEDITION, BEGIN DESCENT): salmon with near-white text.
    button: 0xb85c48, buttonDark: 0x8a4234, buttonLight: 0xe08a72, buttonText: '#fff0e8', title: '#f08a6a',
    // SECONDARY buttons (every other button): maroon with pale pink text.
    second: 0x6a2236, secondDark: 0x4a1626, secondLight: 0x8e3a52, secondText: '#f2dce2',
    // Quiet tiles + boxes (squad hero tiles, hero card boxes, name plates, header boxes): fill, edge, locked edge, a
    // picked tile's edge, the card's body text. BAND = the band round BEGIN DESCENT (only drawn when square is false).
    tileFill: 0x14132a, tileEdge: 0x34324e, tileLocked: 0x262434, picked: 0xe08a72, body: '#cac6dc',
    band: 0x8c88b6, bandLight: 0xbab6dc, bandDark: 0x4a4670, bandP: 0x747098, bandLightP: 0x8c88b6, bandDarkP: 0x36345a,
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
  press: { sinkPx: 2, holdMs: 90, shade: 0x000000, shadeAlpha: 0.35 },
  // (shade = the dark cover any onPress() button gets while held, session 49: 'every button responsive on the clicks')
  // FLAT BUTTON (uiKit drawFlatButton; the camp's look, session 44 'cleaner and sleeker', shared with the squad screen
  // session 47): gold line px, darker foot px, the gold band px of a banded main button (EXPEDITION, BEGIN DESCENT).
  flat: { line: 2, foot: 6, band: 8 },
  motion: {
    fast: 140, normal: 220, slow: 450, story: 1100,
    easeIn: 'Cubic.easeIn', easeOut: 'Cubic.easeOut', easeMove: 'Sine.easeInOut', easeDrop: 'Back.easeOut',
    popDropPx: 48, slidePx: 40,
    // CAMP <-> SQUAD SCREEN slide (session 49, user: 'kind of slow, the ease is awkward'): screenMs long, starts fast
    // and settles (easeScreen); the leaving buttons go WHILE it slides, the new ones land as it ends. Was slow 450 +
    // Sine.easeInOut, after the buttons had left (~0.8s in all).
    screenMs: 300, easeScreen: 'Cubic.easeOut',
  },
};
