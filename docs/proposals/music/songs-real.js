// ROUND 2 (user: 'the code songs feel cyber, not western RPG'): songs played on REAL recorded instruments.
// Same note format as songs.js (compiled by synth.js compile()); each inst names a SAMPLE instrument that
// render-real.py plays: lute (strumstick), folkharp, harp, recorder, flute, strings, violins, violas, celli,
// pizz, stacc, horns, hornstc, trombones, trumpets, choir. Drums: kick, snare, timp, crash, tamtam, frame, shaker, tamb.
import { SONGS } from './songs.js';

export const REAL = {
  // ---------- TITLE + CAMP ----------
  hearthfire: {
    title: 'Hearthfire', screen: 'title', bpm: 66, stepsPerBar: 6, stepsPerBeat: 2,
    desc: 'NEW. Slow and wistful, Nordic folk feel: a lute picking chords, a low cello, a wooden recorder tune, then a flute and harp. D minor, 3/4.',
    inst: { lute: { sample: 'lute', vol: 0.6, pan: -0.25 }, cello: { sample: 'celli', vol: 0.45 }, rec: { sample: 'recorder', vol: 1.0, pan: 0.15 },
      fl: { sample: 'flute', vol: 0.95, pan: 0.15 }, pad: { sample: 'violas', vol: 0.25, pan: 0.3 }, harp: { sample: 'harp', vol: 0.45, pan: 0.35 } },
    sections: {
      A: { prog: ['Dm', 'C', 'Bb', 'C', 'Dm', 'F', 'Gm', 'A'], parts: [
        { type: 'arp', inst: 'lute', oct: 3, every: 1, pat: [0, 2, 3, 4, 3, 2] },
        { type: 'bass', inst: 'cello', oct: 2, pat: 'R - - - - -' },
        { type: 'mel', inst: 'rec', bars: ['D5 - - - C5 A4', 'G4 - - - E4 -', 'F4 - G4 A4 - Bb4', 'A4 - - - G4 -',
          'D5 - - - E5 F5', 'E5 - - - C5 -', 'D5 - - Bb4 - G4', 'A4 - - - - .'] }] },
      B: { prog: ['Bb', 'F', 'C', 'Dm', 'Gm', 'Dm', 'C', 'Dm'], parts: [
        { type: 'arp', inst: 'lute', oct: 3, every: 1, pat: [0, 2, 3, 4, 3, 2] },
        { type: 'bass', inst: 'cello', oct: 2, pat: 'R - - - - -' },
        { type: 'chord', inst: 'pad', oct: 3 },
        { type: 'arp', inst: 'harp', oct: 5, every: 3, pat: [0, 2] },
        { type: 'mel', inst: 'fl', bars: ['F5 - - - D5 -', 'C5 - - - A4 -', 'E5 - - - G5 -', 'F5 - - - E5 D5',
          'Bb4 - - - D5 -', 'A4 - - - F4 -', 'G4 - - - E4 -', 'D4 - - - - .'] },
        { type: 'drums', kit: (b) => (b === 0 ? { timp: 'x . . . . .' } : {}), vel: 0.5 }] },
    },
    order: ['A', 'B'],
  },

  // ---------- SQUAD ----------
  road_to_the_gate: {
    title: 'Road to the Gate', screen: 'squad', bpm: 116, stepsPerBar: 6, stepsPerBeat: 2,
    desc: 'NEW. A lively tavern jig: lute, folk harp, recorder tune, frame drum and tambourine. Cheerful heroes getting ready. D major, 6/8.',
    inst: { lute: { sample: 'lute', vol: 0.6, pan: -0.3 }, fh: { sample: 'folkharp', vol: 0.55, pan: 0.3 }, rec: { sample: 'recorder', vol: 1.05 },
      cello: { sample: 'pizz', vol: 0.8 } },
    sections: {
      A: { prog: ['D', 'G', 'D', 'A', 'D', 'G', 'A', 'D'], parts: [
        { type: 'arp', inst: 'lute', oct: 3, every: 1, pat: [0, 2, 3, 2, 1, 2] },
        { type: 'bass', inst: 'cello', oct: 2, pat: 'R . . 5 . .' },
        { type: 'mel', inst: 'rec', bars: ['F#5 - E5 D5 - A4', 'B4 - D5 G5 - F#5', 'E5 - D5 F#5 - A5', 'E5 - - C#5 - A4',
          'F#5 - E5 D5 - A4', 'B4 - D5 G5 - B5', 'A5 - G5 E5 - C#5', 'D5 - - - - .'] },
        { type: 'drums', kit: { frame: 'x . . o . .', tamb: '. . o . . o' }, vel: 0.8 }] },
      B: { prog: ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'A', 'A'], parts: [
        { type: 'chord', inst: 'fh', oct: 4 },
        { type: 'arp', inst: 'lute', oct: 3, every: 1, pat: [0, 2, 3, 2, 1, 2] },
        { type: 'bass', inst: 'cello', oct: 2, pat: 'R . . 5 . .' },
        { type: 'mel', inst: 'rec', bars: ['B4 - C#5 D5 - F#5', 'G5 - F#5 E5 - D5', 'F#5 - E5 D5 - A4', 'C#5 - - E5 - -',
          'D5 - - B4 - D5', 'G5 - - B5 - G5', 'A5 - G5 F#5 - E5', 'E5 - - C#5 - E5'] },
        { type: 'drums', kit: { frame: 'x . o x . o', tamb: '. o o . o o' }, vel: 0.8 }] },
    },
    order: ['A', 'B'],
  },

  // ---------- BATTLE ----------
  iron_stair: {
    title: 'Iron Stair', screen: 'battle', bpm: 138,
    desc: 'NEW. Orchestral fight: fast rushing violins, punchy low strings, a horn theme, timpani and snare. Tense, adventurous, not tiring. D minor.',
    inst: { vln: { sample: 'stacc', vol: 0.45, pan: -0.3 }, low: { sample: 'pizz', vol: 0.6 }, horn: { sample: 'horns', vol: 1.3, pan: 0.2 },
      pad: { sample: 'violas', vol: 0.35, pan: 0.3 }, hi: { sample: 'violins', vol: 1.15, pan: -0.2 }, hch: { sample: 'horns', vol: 0.45, pan: 0.25 } },
    sections: {
      A: { prog: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'A'], parts: [
        { type: 'arp', inst: 'vln', oct: 4, every: 1, pat: [0, 0, 2, 0, 3, 0, 2, 0] },
        { type: 'bass', inst: 'low', oct: 2, pat: 'R . R . R . R . R . R . 5 . R .' },
        { type: 'chord', inst: 'pad', oct: 3, vel: 0.6 },
        { type: 'mel', inst: 'horn', bars: ['D4 - - - A4 - - -', 'F4 - E4 - D4 - E4 -', 'F4 - - - D4 - Bb3 -', 'C4 - - - E4 - G4 -',
          'A4 - - - D5 - - -', 'C5 - Bb4 - A4 - G4 -', 'F4 - G4 - A4 - Bb4 -', 'A4 - - - - - . .'] },
        { type: 'drums', kit: (b) => ({ timp: 'x . . . . . . . x . . . . . . .', kick: 'x . . . . . . . . . . . . . . .', snare: '. . . . o . . . . . . . o . o .', ...(b === 0 ? { crash: 'x . . . . . . . . . . . . . . .' } : {}) }), vel: 0.9 }] },
      B: { prog: ['Gm', 'Gm', 'Dm', 'Dm', 'Bb', 'C', 'A', 'A'], parts: [
        { type: 'arp', inst: 'vln', oct: 4, every: 1, pat: [0, 1, 2, 1] },
        { type: 'bass', inst: 'low', oct: 2, pat: 'R . R . R . R . R . R . R . R .' },
        { type: 'chord', inst: 'hch', oct: 3, voices: [0, 2] },
        { type: 'mel', inst: 'hi', bars: ['D5 - - - Bb4 - G4 -', 'A4 - Bb4 - C5 - D5 -', 'F5 - - - E5 - D5 -', 'A4 - - - - - . .',
          'Bb4 - C5 - D5 - F5 -', 'E5 - D5 - C5 - E5 -', 'C#5 - - - E5 - - -', 'A5 - G5 - F5 - E5 -'] },
        { type: 'drums', kit: (b) => ({ timp: 'x . . x . . x . x . . x . . x .', snare: '. . . . x . . . . . . . x . . .', ...(b === 7 ? { snare: '. . . . x . . . x . x . x x x x' } : {}) }), vel: 0.9 }] },
    },
    order: ['A', 'B'],
  },

  // ---------- BOSS ----------
  crown_of_bones: {
    title: 'Crown of Bones', screen: 'boss', bpm: 112,
    desc: 'NEW. Dark and epic: a big choir, low trombones, galloping timpani, nervous strings and a horn theme, a gong on each round. C minor.',
    inst: { choir: { sample: 'choir', vol: 0.75 }, tbn: { sample: 'trombones', vol: 0.9 }, vln: { sample: 'stacc', vol: 0.5, pan: -0.3 },
      horn: { sample: 'horns', vol: 1.25, pan: 0.2 }, chm: { sample: 'choir', vol: 1.1 }, low: { sample: 'pizz', vol: 0.7 } },
    sections: {
      A: { prog: ['Cm', 'Cm', 'Ab', 'Ab', 'Fm', 'Fm', 'G', 'G'], parts: [
        { type: 'chord', inst: 'choir', oct: 3, vel: 0.7 },
        { type: 'bass', inst: 'tbn', oct: 2, pat: 'R - - - - - - - R - - - 5 - - -' },
        { type: 'arp', inst: 'vln', oct: 4, every: 1, pat: [0, 1, 0, 2, 0, 1, 0, 3] },
        { type: 'mel', inst: 'horn', bars: ['C4 - - - - - - -', 'Eb4 - - - D4 - C4 -', 'Ab4 - - - - - - -', 'G4 - - - F4 - Eb4 -',
          'F4 - - - - - Ab4 -', 'C5 - - - Bb4 - Ab4 -', 'B3 - - - - - - -', 'D4 - - - F4 - G4 -'] },
        { type: 'drums', kit: (b) => ({ timp: 'x . . x . . x . x . . x . . x .', kick: 'x . . . . . . . x . . . . . . .', ...(b === 0 ? { tamtam: 'x . . . . . . . . . . . . . . .' } : {}) }), vel: 0.9 }] },
      B: { prog: ['Cm', 'Db', 'Cm', 'Db', 'Ab', 'Bb', 'G', 'G'], parts: [
        { type: 'mel', inst: 'chm', bars: ['C5 - - - - - - -', 'Db5 - - - - - - -', 'Eb5 - - - D5 - C5 -', 'Db5 - - - - - - -',
          'C5 - - - Eb5 - - -', 'D5 - - - F5 - - -', 'D5 - - - - - - -', 'B4 - - - G4 - - -'] },
        { type: 'chord', inst: 'choir', oct: 3, vel: 0.6 },
        { type: 'bass', inst: 'low', oct: 2, pat: 'R . R . R . R . R . R . R . R .' },
        { type: 'arp', inst: 'vln', oct: 4, every: 1, pat: [0, 1, 2, 1] },
        { type: 'drums', kit: (b) => ({ timp: 'x . x . x . x . x . x . x . x .', snare: '. . . . x . . . . . . . x . . .', ...(b === 0 ? { tamtam: 'x . . . . . . . . . . . . . . .' } : {}), ...(b === 7 ? { snare: 'x . x . x . x . x x x x x x x x' } : {}) }), vel: 0.9 }] },
    },
    order: ['A', 'B'],
  },
};

// Round-1 songs the user did NOT reject, re-played on real instruments (same notes, new sound).
const remap = (id, title, desc, map) => ({ ...SONGS[id], title, desc, inst: map, intro: undefined });
REAL.ember_gate_real = remap('ember_gate', 'Ember Gate (real instruments)', 'Your MAYBE, now on real instruments: soft strings, harp rolling chords, a flute tune, then a recorder. Slow and mysterious. D minor.',
  { pad: { sample: 'strings', vol: 0.22 }, harp: { sample: 'harp', vol: 0.5, pan: -0.25 }, bell: { sample: 'flute', vol: 0.95, pan: 0.15 },
    low: { sample: 'celli', vol: 0.45 }, flute: { sample: 'recorder', vol: 0.8, pan: 0.15 } });
REAL.ember_gate_real.screen = 'title';
REAL.hearth_real = remap('hearth', 'Hearth (real instruments)', 'Round 1 Hearth (you did not mark it) on real instruments: lute, recorder, cello, frame drum. Calm campfire sway, A minor 6/8.',
  { lute: { sample: 'lute', vol: 0.6, pan: -0.25 }, flute: { sample: 'recorder', vol: 1.0, pan: 0.15 }, bassl: { sample: 'celli', vol: 0.5 }, pad: { sample: 'violas', vol: 0.25 } });
REAL.muster_real = remap('muster', 'Muster (real instruments)', 'Round 1 Muster (you did not mark it) on real instruments: horns, plucked strings, harp, marching snare. Brave, getting ready. E minor.',
  { brass: { sample: 'horns', vol: 1.15 }, pizz: { sample: 'pizz', vol: 0.6, pan: -0.2 }, bassp: { sample: 'pizz', vol: 0.55 },
    pad: { sample: 'strings', vol: 0.3 }, harp: { sample: 'harp', vol: 0.5, pan: 0.3 } });

// ---------- ROUND 3 (user: 'video-gamey, arcadey RPG music, like Castlevania / Risk of Rain 2'): GOTHIC ACTION ----------
// Our own songs in a dark, fast, catchy 'gothic action' style: harpsichord / organ riffs, rushing strings, rock kit.
const ROCK = (b, extra = {}) => ({ rkick: 'x . . . x . . x x . . . x . . .', rsnare: '. . . . x . . . . . . . x . . .', rhat: 'x . x . x . x . x . x . x . x .', ...(b === 0 ? { rcrash: 'x . . . . . . . . . . . . . . .' } : {}), ...extra });
REAL.blood_moon_stair = {
  title: 'Blood Moon Stair', screen: 'battle', bpm: 150,
  desc: 'NEW (gothic action). Fast harpsichord riff, a church-organ melody, rock drums and plucked bass, then soaring violins. Dark, catchy, driving. D minor.',
  inst: { hpsi: { sample: 'harpsichord', vol: 0.55, pan: -0.3 }, org: { sample: 'organ', vol: 1.5, pan: 0.1 }, bass: { sample: 'pizz', vol: 0.5 },
    vln: { sample: 'violins', vol: 1.9, pan: 0.2 }, str: { sample: 'stacc', vol: 0.35, pan: 0.3 } },
  sections: {
    A: { prog: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Dm', 'Gm A', 'Dm'], parts: [
      { type: 'arp', inst: 'hpsi', oct: 4, every: 1, pat: [0, 1, 2, 1, 3, 1, 2, 1] },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R R R R R R 5 8' },
      { type: 'mel', inst: 'org', bars: ['D5 - A4 - D5 - E5 F5', 'E5 - D5 - C#5 - D5 -', 'F5 - D5 - Bb4 - D5 F5', 'E5 - - - C#5 - A4 -',
        'D5 - A4 - D5 - F5 A5', 'G5 - F5 - E5 - F5 D5', 'Bb5 - A5 G5 A5 - E5 -', 'D5 - - - - - . .'] },
      { type: 'drums', kit: (b) => ROCK(b), vel: 0.9 }] },
    B: { prog: ['Bb', 'C', 'Am', 'Dm', 'Bb', 'C', 'A', 'A'], parts: [
      { type: 'arp', inst: 'hpsi', oct: 4, every: 1, pat: [0, 1, 2, 3] },
      { type: 'arp', inst: 'str', oct: 3, every: 2, pat: [0, 0, 2, 0] },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R R R R R R R R' },
      { type: 'mel', inst: 'vln', bars: ['F5 - - - D5 - F5 -', 'G5 - - - E5 - G5 -', 'A5 - G5 - F5 - E5 -', 'F5 - - - D5 - - -',
        'D6 - C6 - Bb5 - A5 -', 'G5 - A5 - Bb5 - G5 -', 'A5 - - - C#6 - - -', 'E6 - D6 - C#6 - A5 -'] },
      { type: 'drums', kit: (b) => ROCK(b, { rkick: 'x . . x x . . x x . . x x . x .', rhat: 'x o x o x o x o x o x o x o x o', ...(b === 7 ? { rsnare: '. . . . x . . . x . x . x x x x' } : {}) }), vel: 0.9 }] },
  },
  order: ['A', 'B'],
};
REAL.crimson_gallery = {
  title: 'Crimson Gallery', screen: 'battle', bpm: 138,
  desc: 'NEW (gothic action). Galloping strings, a heroic horn tune, rock beat, then a fast harpsichord with a high violin line. A minor.',
  inst: { gal: { sample: 'stacc', vol: 0.55, pan: -0.25 }, horn: { sample: 'horns', vol: 1.7, pan: 0.15 }, bass: { sample: 'pizz', vol: 0.5 },
    hpsi: { sample: 'harpsichord', vol: 0.5, pan: -0.3 }, vln: { sample: 'violins', vol: 1.8, pan: 0.2 }, pad: { sample: 'organ', vol: 0.3 } },
  sections: {
    A: { prog: ['Am', 'F', 'G', 'E', 'Am', 'F', 'Dm E', 'Am'], parts: [
      { type: 'arp', inst: 'gal', oct: 3, every: 1, pat: [0, null, 0, 0, 2, null, 2, 2] },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R . R R R . R R' },
      { type: 'chord', inst: 'pad', oct: 3, vel: 0.6 },
      { type: 'mel', inst: 'horn', bars: ['A4 - - - E5 - - -', 'F5 - E5 - D5 - C5 -', 'D5 - - - G4 - B4 D5', 'E5 - - - - - G#4 -',
        'A4 - - - E5 - A5 -', 'A5 - G5 - F5 - E5 -', 'F5 - E5 D5 E5 - B4 -', 'A4 - - - - - . .'] },
      { type: 'drums', kit: (b) => ROCK(b, { rkick: 'x . . . . . x . x . x . . . . .' }), vel: 0.9 }] },
    B: { prog: ['Dm', 'Am', 'E', 'Am', 'Dm', 'Am', 'E', 'E'], parts: [
      { type: 'arp', inst: 'hpsi', oct: 4, every: 1, pat: [0, 1, 2, 3] },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R R R R R R R R' },
      { type: 'mel', inst: 'vln', bars: ['D5 - F5 - A5 - D6 -', 'C6 - B5 - A5 - E5 -', 'G#5 - - - B5 - E6 -', 'C6 - - - A5 - - -',
        'F5 - A5 - D6 - C6 -', 'B5 - A5 - G5 - E5 -', 'G#5 - A5 - B5 - D6 -', 'C6 - B5 - G#5 - E5 -'] },
      { type: 'drums', kit: (b) => ROCK(b, { rhat: 'x o x o x o x o x o x o x o x o', ...(b === 7 ? { rsnare: 'x . x . x . x . x x x x x x x x' } : {}) }), vel: 0.9 }] },
  },
  order: ['A', 'B'],
};
REAL.bell_tower_duel = {
  title: 'Bell Tower Duel', screen: 'boss', bpm: 160,
  desc: 'NEW (gothic action). The fastest: double-time rock drums, church organ and choir, tower bells, a fanfare of trumpets, then a choir theme over racing harpsichord. E minor.',
  inst: { org: { sample: 'organ', vol: 0.5 }, choir: { sample: 'choir', vol: 0.55 }, bell: { sample: 'bells', vol: 1.2 }, bass: { sample: 'pizz', vol: 0.5 },
    tpt: { sample: 'trumpets', vol: 1.8, pan: 0.15 }, chm: { sample: 'choir', vol: 1.8 }, hpsi: { sample: 'harpsichord', vol: 0.5, pan: -0.3 } },
  sections: {
    A: { prog: ['Em', 'Em', 'C', 'C', 'Am', 'Am', 'B', 'B'], parts: [
      { type: 'chord', inst: 'org', oct: 3 },
      { type: 'chord', inst: 'choir', oct: 3, vel: 0.6 },
      { type: 'mel', inst: 'bell', bars: ['E5 - - - - - - -', null, 'C5 - - - - - - -', null, 'A4 - - - - - - -', null, 'B4 - - - - - - -', null] },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R R R R R R R R' },
      { type: 'mel', inst: 'tpt', bars: ['E5 - B4 - E5 - G5 -', 'F#5 - E5 - D#5 - B4 -', 'C5 - E5 - G5 - C6 -', 'B5 - A5 - G5 - E5 -',
        'A5 - E5 - C5 - A4 -', 'C5 - D5 - E5 - F#5 -', 'D#5 - - - F#5 - B5 -', 'A5 - G5 - F#5 - D#5 -'] },
      { type: 'drums', kit: (b) => ROCK(b, { rkick: 'x . x . x . x . x . x . x . x .', ...(b % 4 === 0 ? { timp: 'x . . . . . . . . . . . . . . .' } : {}) }), vel: 0.9 }] },
    B: { prog: ['Am', 'B', 'Em', 'C', 'Am', 'B', 'C', 'B'], parts: [
      { type: 'arp', inst: 'hpsi', oct: 4, every: 1, pat: [0, 1, 2, 3, 2, 1, 2, 1] },
      { type: 'chord', inst: 'org', oct: 3, vel: 0.7 },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R R R R R R R R' },
      { type: 'mel', inst: 'chm', bars: ['A4 - - - - - - -', 'B4 - - - - - - -', 'G4 - - - B4 - - -', 'C5 - - - - - - -',
        'E5 - - - - - D5 -', 'D#5 - - - - - B4 -', 'E5 - - - G5 - - -', 'F#5 - - - D#5 - - -'] },
      { type: 'drums', kit: (b) => ROCK(b, { rkick: 'x . x . x . x . x . x . x . x .', rhat: 'x o x o x o x o x o x o x o x o', ...(b === 7 ? { rsnare: 'x . x . x . x . x x x x x x x x' } : {}) }), vel: 0.9 }] },
  },
  order: ['A', 'B'],
};
REAL.night_gate = {
  title: 'Night Gate', screen: 'squad', bpm: 126,
  desc: 'NEW (gothic action, lighter). A harpsichord riff, violin tune, steady rock beat, then horns. Ready for the descent. G minor.',
  inst: { hpsi: { sample: 'harpsichord', vol: 0.55, pan: -0.3 }, bass: { sample: 'pizz', vol: 0.55 }, vln: { sample: 'violins', vol: 1.9, pan: 0.2 },
    horn: { sample: 'horns', vol: 1.4, pan: 0.15 }, pad: { sample: 'strings', vol: 0.25 } },
  sections: {
    A: { prog: ['Gm', 'Eb', 'F', 'D', 'Gm', 'Eb', 'Cm D', 'Gm'], parts: [
      { type: 'arp', inst: 'hpsi', oct: 4, every: 1, pat: [0, 1, 2, 3, 2, 1, 2, 1] },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R . R . 5 . R .' },
      { type: 'mel', inst: 'vln', bars: ['G4 - Bb4 - D5 - G5 -', 'G5 - F5 - Eb5 - D5 -', 'C5 - D5 - Eb5 - F5 -', 'F#5 - - - D5 - A4 -',
        'G4 - Bb4 - D5 - G5 -', 'Bb5 - A5 - G5 - F5 -', 'Eb5 - D5 C5 D5 - F#4 -', 'G4 - - - - - . .'] },
      { type: 'drums', kit: (b) => ROCK(b, { rkick: 'x . . . . . . . x . . . . . . .', rhat: 'o . o . o . o . o . o . o . o .' }), vel: 0.85 }] },
    B: { prog: ['Eb', 'F', 'Gm', 'Gm', 'Eb', 'F', 'D', 'D'], parts: [
      { type: 'arp', inst: 'hpsi', oct: 4, every: 1, pat: [0, 1, 2, 3] },
      { type: 'chord', inst: 'pad', oct: 3 },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R . R . R . R .' },
      { type: 'mel', inst: 'horn', bars: ['Bb4 - - - G4 - - -', 'C5 - - - A4 - - -', 'D5 - - - Bb4 - D5 -', 'G5 - - - - - . .',
        'Eb5 - - - G5 - - -', 'F5 - - - A5 - - -', 'F#5 - - - A5 - - -', 'D5 - - - F#4 - A4 -'] },
      { type: 'drums', kit: (b) => ROCK(b, { rkick: 'x . . . x . . . x . . . x . . .' }), vel: 0.85 }] },
  },
  order: ['A', 'B'],
};
