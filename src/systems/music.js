// Music rules (no Phaser, no browser): which song a screen plays and how loud. The player is src/audio/music.js;
// the data is src/data/music.json (passed in, so the tests can use it too).

// The song a screen wants. turn = how many songs of a list screen have played so far (they take turns).
export function trackFor(screen, turn, data) {
  const s = data.screens[screen];
  if (Array.isArray(s)) return s.length ? s[((turn % s.length) + s.length) % s.length] : null;
  return s || null;
}

// A list screen (battle floors): its songs take turns; each plays once, then the next one.
export function isTurnTrack(screen, data) {
  return Array.isArray(data.screens[screen]);
}

// Loudness 0..1 from the save: the MUSIC bar (0..max) times music.json volume; 0 when muted.
export function musicGain(progress, data, defs, readSettings, cardOf) {
  if (((progress && progress.settings) || {}).muted) return 0;
  const card = cardOf(defs, 'music');
  return (data.volume ?? 1) * (readSettings(progress, defs).music / (card ? card.max : 10));
}
