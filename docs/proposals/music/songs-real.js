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

// ---------- ROUND 4 (user: 'simpler, 16-bit, more ZELDA-ish, less gothic; battle: no slow starts; boss: not cyber') ----------
// Bright heroic adventure songs. Rendered on the samples, then made to sound 16-bit by make16bit() in make-board4.py.
const MARCH = (b, extra = {}) => ({ snare: 'x . o o x . o . x . o o x . x .', kick: 'x . . . . . . . x . . . . . . .', ...(b === 0 ? { crash: 'x . . . . . . . . . . . . . . .' } : {}), ...extra });
const FIGHT = (b, extra = {}) => ({ kick: 'x . . . x . . . x . . . x . . .', snare: '. . . . x . . . . . . . x . x x', timp: 'x . . . . . . . x . . . . . . .', ...(b === 0 ? { crash: 'x . . . . . . . . . . . . . . .' } : {}), ...extra });
REAL.heros_dawn = {
  title: "Hero's Dawn", screen: 'title', bpm: 92,
  desc: 'NEW (16-bit adventure). A bright, hopeful opening: rippling harp, soft strings, a flute melody, then a horn answer. Like the first screen of an old adventure game. C major.',
  inst: { harp: { sample: 'harp', vol: 0.55, pan: -0.25 }, pad: { sample: 'strings', vol: 0.3 }, fl: { sample: 'flute', vol: 1.2, pan: 0.15 },
    horn: { sample: 'horns', vol: 1.3, pan: 0.15 }, glock: { sample: 'glock', vol: 0.77, pan: 0.3 }, bass: { sample: 'celli', vol: 0.45 } },
  sections: {
    A: { prog: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F G', 'C'], parts: [
      { type: 'arp', inst: 'harp', oct: 3, every: 1, pat: [0, 1, 2, 3, 4, 3, 2, 1] },
      { type: 'chord', inst: 'pad', oct: 3 },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R - - - - - - -' },
      { type: 'mel', inst: 'fl', bars: ['E5 - - - G5 - C6 -', 'B5 - A5 - - - E5 -', 'F5 - A5 - C6 - A5 -', 'G5 - - - - - D5 -',
        'E5 - - - G5 - C6 -', 'D6 - C6 - B5 - A5 -', 'A5 - G5 F5 G5 - D5 -', 'C5 - - - - - . .'] }] },
    B: { prog: ['F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'G'], parts: [
      { type: 'arp', inst: 'harp', oct: 3, every: 1, pat: [0, 1, 2, 3, 4, 3, 2, 1] },
      { type: 'chord', inst: 'pad', oct: 3 },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R - - - 5 - - -' },
      { type: 'mel', inst: 'horn', shift: -12, bars: ['A4 - - - C5 - F5 -', 'D5 - - - B4 - G4 -', 'G4 - B4 - E5 - - -', 'C5 - - - A4 - - -',
        'F5 - - - D5 - A4 -', 'B4 - - - D5 - G5 -', 'E5 - - - G5 - C6 -', 'D5 - - - B4 - G4 -'] },
      { type: 'mel', inst: 'glock', bars: ['A5 - - - - - - -', 'B5 - - - - - - -', 'G5 - - - - - - -', 'A5 - - - - - - -', 'F5 - - - - - - -', 'G5 - - - - - - -', 'E5 - - - - - - -', 'D5 - - - - - - -'] },
      { type: 'drums', kit: (b) => (b === 0 ? { timp: 'x . . . . . . . . . . . . . . .' } : {}), vel: 0.6 }] },
  },
  order: ['A', 'B'],
};
REAL.into_the_wilds = {
  title: 'Into the Wilds', screen: 'squad', bpm: 120,
  desc: 'NEW (16-bit adventure). A cheerful march: snare drum, plucked bass, a trumpet tune doubled by glockenspiel, then flute and harp. Packing up for the journey. D major.',
  inst: { tpt: { sample: 'trumpets', vol: 1.4, pan: 0.1 }, glock: { sample: 'glock', vol: 0.88, pan: 0.3 }, bass: { sample: 'pizz', vol: 0.6 },
    pad: { sample: 'strings', vol: 0.25 }, fl: { sample: 'flute', vol: 1.2, pan: 0.15 }, harp: { sample: 'harp', vol: 0.45, pan: -0.3 } },
  sections: {
    A: { prog: ['D', 'G', 'D', 'A', 'D', 'G', 'A', 'D'], parts: [
      { type: 'chord', inst: 'pad', oct: 3 },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R . 5 . R . 5 .' },
      { type: 'mel', inst: 'tpt', bars: ['D5 - - A4 D5 - F#5 -', 'G5 - F#5 - E5 - D5 -', 'F#5 - - - A5 - F#5 -', 'E5 - - - - - A4 -',
        'D5 - - A4 D5 - F#5 -', 'B5 - A5 - G5 - B5 -', 'A5 - G5 - F#5 - E5 -', 'D5 - - - - - . .'] },
      { type: 'mel', inst: 'glock', bars: ['D6 - - A5 D6 - F#6 -', 'G6 - F#6 - E6 - D6 -', 'F#6 - - - A6 - F#6 -', 'E6 - - - - - A5 -',
        'D6 - - A5 D6 - F#6 -', 'B6 - A6 - G6 - B6 -', 'A6 - G6 - F#6 - E6 -', 'D6 - - - - - . .'] },
      { type: 'drums', kit: (b) => MARCH(b), vel: 0.85 }] },
    B: { prog: ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'A'], parts: [
      { type: 'arp', inst: 'harp', oct: 4, every: 1, pat: [0, 1, 2, 1] },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R . 5 . R . 5 .' },
      { type: 'mel', inst: 'fl', bars: ['F#5 - - - D5 - B4 -', 'G5 - - - B5 - - -', 'A5 - - - F#5 - D5 -', 'E5 - - - C#5 - A4 -',
        'B4 - D5 - F#5 - B5 -', 'A5 - G5 - F#5 - G5 -', 'E5 - - - G5 - B5 -', 'A5 - - - C#5 - E5 -'] },
      { type: 'drums', kit: (b) => MARCH(b, { snare: 'x . o . x . o . x . o . x . o o' }), vel: 0.8 }] },
  },
  order: ['A', 'B'],
};
REAL.sword_and_spark = {
  title: 'Sword and Spark', screen: 'battle', bpm: 152,
  desc: 'NEW (16-bit adventure). Full energy from the first beat: racing strings, a brave horn tune, snare and timpani, then trumpets soar. A minor, heroic not gloomy.',
  inst: { str: { sample: 'stacc', vol: 0.5, pan: -0.25 }, bass: { sample: 'pizz', vol: 0.55 }, horn: { sample: 'horns', vol: 1.7, pan: 0.15 },
    tpt: { sample: 'trumpets', vol: 1.5, pan: 0.15 }, glock: { sample: 'glock', vol: 0.66, pan: 0.3 } },
  sections: {
    A: { prog: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'F', 'E'], parts: [
      { type: 'arp', inst: 'str', oct: 4, every: 1, pat: [0, 2, 1, 2] },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R R R R R R 5 R' },
      { type: 'mel', inst: 'horn', bars: ['A4 - - - C5 - E5 -', 'D5 - C5 - B4 - C5 -', 'A4 - - - F4 - A4 -', 'B4 - - - D5 - G5 -',
        'E5 - - - A5 - E5 -', 'G5 - F5 - E5 - D5 -', 'C5 - D5 - E5 - F5 -', 'E5 - - - G#4 - B4 -'] },
      { type: 'drums', kit: (b) => FIGHT(b), vel: 0.9 }] },
    B: { prog: ['F', 'G', 'Em', 'Am', 'F', 'G', 'E', 'E'], parts: [
      { type: 'arp', inst: 'str', oct: 4, every: 1, pat: [0, 1, 2, 3] },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R R R R R R R R' },
      { type: 'mel', inst: 'tpt', bars: ['C6 - - - A5 - F5 -', 'D6 - - - B5 - G5 -', 'B5 - - - G5 - E5 -', 'C6 - - - A5 - - -',
        'A5 - C6 - A5 - F5 -', 'B5 - D6 - B5 - G5 -', 'G#5 - - - B5 - - -', 'E6 - D6 - B5 - G#5 -'] },
      { type: 'mel', inst: 'glock', bars: ['C6 - - - - - - -', 'D6 - - - - - - -', 'B5 - - - - - - -', 'C6 - - - - - - -', 'A5 - - - - - - -', 'B5 - - - - - - -', 'G#5 - - - - - - -', 'E6 - - - - - - -'] },
      { type: 'drums', kit: (b) => FIGHT(b, { kick: 'x . . x x . . . x . . x x . . .', ...(b === 7 ? { snare: '. . . . x . . . x . x x x x x x' } : {}) }), vel: 0.9 }] },
  },
  order: ['A', 'B'],
};
REAL.moss_cavern = {
  title: 'Moss Cavern Clash', screen: 'battle', bpm: 144,
  desc: 'NEW (16-bit adventure). Bouncy and lively from beat one: a flute and glockenspiel tune over off-beat strings and a hopping bass, then trumpets. A cave fight, but fun. E (Dorian).',
  inst: { fl: { sample: 'flute', vol: 1.3, pan: 0.1 }, glock: { sample: 'glock', vol: 0.88, pan: 0.3 }, str: { sample: 'stacc', vol: 0.45, pan: -0.3 },
    bass: { sample: 'pizz', vol: 0.6 }, tpt: { sample: 'trumpets', vol: 1.5, pan: 0.15 } },
  sections: {
    A: { prog: ['Em', 'A', 'Em', 'A', 'C', 'D', 'Em', 'B'], parts: [
      { type: 'arp', inst: 'str', oct: 4, every: 2, pat: [null, 2, null, 1, null, 2, null, 1] },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R . R 8 R . R 8' },
      { type: 'mel', inst: 'fl', bars: ['E5 - G5 - B5 - A5 G5', 'F#5 - E5 - C#5 - E5 -', 'G5 - B5 - E6 - D6 B5', 'C#6 - - - A5 - - -',
        'G5 - - - E5 - G5 -', 'F#5 - - - D5 - F#5 -', 'E5 - G5 - B5 - G5 -', 'F#5 - - - D#5 - B4 -'] },
      { type: 'mel', inst: 'glock', bars: ['E6 - - - - - - -', 'C#6 - - - - - - -', 'B6 - - - - - - -', 'A6 - - - - - - -', 'G6 - - - - - - -', 'F#6 - - - - - - -', 'E6 - - - - - - -', 'D#6 - - - - - - -'] },
      { type: 'drums', kit: (b) => ({ kick: 'x . . x . . x . x . . x . . x .', snare: '. . . . x . . . . . . . x . . .', shaker: 'x . x . x . x . x . x . x . x .', ...(b === 0 ? { crash: 'x . . . . . . . . . . . . . . .' } : {}) }), vel: 0.85 }] },
    B: { prog: ['C', 'D', 'Bm', 'Em', 'C', 'D', 'B', 'B'], parts: [
      { type: 'arp', inst: 'str', oct: 4, every: 2, pat: [null, 2, null, 1, null, 2, null, 1] },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R . R 8 R . R 8' },
      { type: 'mel', inst: 'tpt', bars: ['E5 - - - G5 - C6 -', 'D6 - - - A5 - F#5 -', 'F#5 - - - B5 - D6 -', 'E6 - - - - - B5 -',
        'C6 - - - E6 - G6 -', 'F#6 - - - A6 - F#6 -', 'D#6 - - - F#6 - - -', 'B6 - A6 - F#6 - D#6 -'] },
      { type: 'drums', kit: (b) => ({ kick: 'x . . x . . x . x . . x . . x .', snare: '. . . . x . . . . . . . x . . .', shaker: 'x x x x x x x x x x x x x x x x', ...(b === 7 ? { snare: '. . . . x . . . x . x . x x x x' } : {}) }), vel: 0.85 }] },
  },
  order: ['A', 'B'],
};
REAL.guardian_deep = {
  title: 'Guardian of the Deep', screen: 'boss', bpm: 136,
  desc: 'NEW (16-bit adventure boss). A giant guardian, not a cyber machine: pounding timpani, low trombones, racing strings and a heroic trumpet theme, then the horns. C minor.',
  inst: { tbn: { sample: 'trombones', vol: 1.0 }, str: { sample: 'stacc', vol: 0.5, pan: -0.25 }, tpt: { sample: 'trumpets', vol: 1.6, pan: 0.15 },
    horn: { sample: 'horns', vol: 1.7, pan: 0.15 }, pad: { sample: 'strings', vol: 0.25 } },
  sections: {
    A: { prog: ['Cm', 'Cm', 'Ab', 'Bb', 'Cm', 'Cm', 'Ab', 'G'], parts: [
      { type: 'bass', inst: 'tbn', oct: 2, pat: 'R . . R . . R . R . . R . . 5 .' },
      { type: 'arp', inst: 'str', oct: 4, every: 1, pat: [0, 1, 2, 1] },
      { type: 'mel', inst: 'tpt', bars: ['C5 - - - G4 - C5 -', 'Eb5 - D5 - C5 - G4 -', 'Ab4 - C5 - Eb5 - Ab5 -', 'G5 - F5 - D5 - Bb4 -',
        'C5 - - - Eb5 - G5 -', 'C6 - Bb5 - G5 - Eb5 -', 'F5 - Eb5 - D5 - C5 -', 'B4 - - - D5 - G5 -'] },
      { type: 'drums', kit: (b) => ({ timp: 'x . x . x . x . x . x . x . x .', kick: 'x . . x . . x . x . . x . . x .', snare: '. . . . x . . . . . . . x . . .', ...(b === 0 ? { crash: 'x . . . . . . . . . . . . . . .' } : {}) }), vel: 0.85 }] },
    B: { prog: ['Fm', 'Fm', 'Cm', 'Cm', 'Ab', 'Bb', 'G', 'G'], parts: [
      { type: 'chord', inst: 'pad', oct: 3 },
      { type: 'bass', inst: 'tbn', oct: 2, pat: 'R . . R . . R . R . . R . . 5 .' },
      { type: 'arp', inst: 'str', oct: 4, every: 1, pat: [0, 1, 2, 3] },
      { type: 'mel', inst: 'horn', bars: ['F4 - - - Ab4 - C5 -', 'Db5 - C5 - Ab4 - F4 -', 'G4 - - - C5 - Eb5 -', 'D5 - C5 - Bb4 - G4 -',
        'Ab4 - - - C5 - Eb5 -', 'D5 - - - F5 - Bb4 -', 'B4 - - - D5 - - -', 'G4 - B4 - D5 - F5 -'] },
      { type: 'drums', kit: (b) => ({ timp: 'x . x . x . x . x . x . x . x .', kick: 'x . . x . . x . x . . x . . x .', snare: '. . . . x . . . . . . . x . . .', ...(b === 7 ? { snare: 'x . x . x . x . x x x x x x x x' } : {}) }), vel: 0.85 }] },
  },
  order: ['A', 'B'],
};

// ---------- ROUND 5 (user: 'round 4 too cheery / town / open-land; more code music with MORE BASS AND TREBLE') ----------
// Dungeon action: minor keys, driving bass with a sine SUB under it (render-real.py `sub`) + string basses, and bright
// octave-up doubles (glock / xylo / harpsichord) + 16th hats for treble. Mastered with a bass + treble boost (make-board5.py).
const DRIVE = (b, extra = {}) => ({ kick: 'x . . x x . . . x . . x x . . .', snare: '. . . . x . . . . . . . x . . .', rhat: 'x o x o x o x o x o x o x o x o', ...(b === 0 ? { crash: 'x . . . . . . . . . . . . . . .' } : {}), ...extra });
REAL.deepdelve = {
  title: 'Deepdelve', screen: 'battle', bpm: 140,
  desc: 'NEW (round 5). Driving dungeon fight: a pounding bass line with deep sub, rushing strings, a trumpet tune doubled high by harpsichord, then violins with glockenspiel. D minor.',
  inst: { str: { sample: 'stacc', vol: 0.45, pan: -0.25 }, bass: { sample: 'pizz', vol: 0.6, sub: 0.6 }, low: { sample: 'basses', vol: 0.45 },
    tpt: { sample: 'trumpets', vol: 1.6, pan: 0.1 }, hi: { sample: 'harpsichord', vol: 0.4, pan: -0.2 }, vln: { sample: 'violins', vol: 1.8, pan: 0.15 }, glock: { sample: 'glock', vol: 0.7, pan: 0.3 } },
  sections: {
    A: { prog: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A'], parts: [
      { type: 'arp', inst: 'str', oct: 4, every: 1, pat: [0, 0, 2, 0, 3, 0, 2, 0] },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R R R R R R 5 R' },
      { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' },
      { type: 'mel', inst: 'tpt', bars: ['D5 - - - F5 - A5 -', 'G5 - F5 - E5 - F5 -', 'D5 - - - Bb4 - D5 -', 'E5 - - - G5 - C6 -', 'A5 - - - F5 - D5 -', 'E5 - F5 - G5 - A5 -', 'Bb5 - A5 - G5 - D5 -', 'C#5 - - - E5 - A5 -'] },
      { type: 'mel', inst: 'hi', shift: 12, bars: ['D5 - - - F5 - A5 -', 'G5 - F5 - E5 - F5 -', 'D5 - - - Bb4 - D5 -', 'E5 - - - G5 - C6 -', 'A5 - - - F5 - D5 -', 'E5 - F5 - G5 - A5 -', 'Bb5 - A5 - G5 - D5 -', 'C#5 - - - E5 - A5 -'] },
      { type: 'drums', kit: (b) => DRIVE(b), vel: 0.9 }] },
    B: { prog: ['Gm', 'Gm', 'Dm', 'Dm', 'Bb', 'C', 'A', 'A'], parts: [
      { type: 'arp', inst: 'str', oct: 4, every: 1, pat: [0, 1, 2, 1] },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R R R R R R R R' },
      { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' },
      { type: 'mel', inst: 'vln', bars: ['G5 - - - Bb5 - D6 -', 'C6 - Bb5 - A5 - G5 -', 'F5 - - - A5 - D6 -', 'E6 - D6 - C#6 - D6 -', 'F6 - - - D6 - Bb5 -', 'G6 - - - E6 - C6 -', 'C#6 - - - E6 - - -', 'A6 - G6 - F6 - E6 -'] },
      { type: 'mel', inst: 'glock', bars: ['G5 - - - - - - -', 'C6 - - - - - - -', 'F5 - - - - - - -', 'E6 - - - - - - -', 'F6 - - - - - - -', 'G6 - - - - - - -', 'C#6 - - - - - - -', 'A6 - - - - - - -'] },
      { type: 'drums', kit: (b) => DRIVE(b, { kick: 'x . x . x . x . x . x . x . x .', ...(b === 7 ? { snare: '. . . . x . . . x . x x x x x x' } : {}) }), vel: 0.9 }] },
  },
  order: ['A', 'B'],
};
REAL.rattling_bones = {
  title: 'Rattling Bones', screen: 'battle', bpm: 156,
  desc: 'NEW (round 5). A skeleton fight: a clacking xylophone tune and woodblock over a bouncing bass with deep sub, then trumpets. Fast, dark but playful. E minor.',
  inst: { xylo: { sample: 'xylo', vol: 1.3, pan: 0.15 }, bass: { sample: 'pizz', vol: 0.6, sub: 0.6 }, low: { sample: 'basses', vol: 0.4 },
    str: { sample: 'stacc', vol: 0.45, pan: -0.3 }, tpt: { sample: 'trumpets', vol: 1.6, pan: 0.1 }, xa: { sample: 'xylo', vol: 0.5, pan: 0.3 } },
  sections: {
    A: { prog: ['Em', 'Em', 'C', 'B', 'Em', 'Em', 'Am B', 'Em'], parts: [
      { type: 'arp', inst: 'str', oct: 4, every: 2, pat: [null, 2, null, 1, null, 2, null, 1] },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R . R R R . R R' },
      { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' },
      { type: 'mel', inst: 'xylo', bars: ['E5 - G5 E5 B4 - E5 -', 'F#5 - G5 - A5 - G5 F#5', 'E5 - - - C5 - E5 -', 'D#5 - - - F#5 - B4 -', 'E5 - G5 E5 B5 - G5 -', 'A5 - G5 - F#5 - E5 -', 'C5 - E5 - D#5 - F#5 -', 'E5 - - - - - . .'] },
      { type: 'drums', kit: (b) => ({ kick: 'x . . . x . . . x . . . x . . .', snare: '. . . . x . . . . . . . x . . x', wood: '. . x . . . x . . . x . . . x .', rhat: 'x . x . x . x . x . x . x . x .', ...(b === 0 ? { crash: 'x . . . . . . . . . . . . . . .' } : {}) }), vel: 0.9 }] },
    B: { prog: ['Am', 'Am', 'Em', 'Em', 'C', 'D', 'B', 'B'], parts: [
      { type: 'arp', inst: 'xa', oct: 5, every: 1, pat: [0, 1, 2, 1] },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R R R R R R R R' },
      { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' },
      { type: 'mel', inst: 'tpt', bars: ['A4 - - - C5 - E5 -', 'D5 - C5 - B4 - A4 -', 'G4 - - - B4 - E5 -', 'D#5 - E5 - F#5 - G5 -', 'E5 - - - G5 - C6 -', 'D6 - - - A5 - F#5 -', 'D#5 - - - F#5 - B5 -', 'A5 - G5 - F#5 - D#5 -'] },
      { type: 'drums', kit: (b) => ({ kick: 'x . . x x . . . x . . x x . . .', snare: '. . . . x . . . . . . . x . . .', wood: 'x . x . x . x . x . x . x . x .', rhat: 'x o x o x o x o x o x o x o x o', ...(b === 7 ? { snare: '. . . . x . . . x . x x x x x x' } : {}) }), vel: 0.9 }] },
  },
  order: ['A', 'B'],
};
REAL.torchlight_run = {
  title: 'Torchlight Run', screen: 'battle', bpm: 148,
  desc: 'NEW (round 5). Running through dark halls: galloping strings, a deep string-bass and sub, a high flute tune with glockenspiel sparkle, then horns. A minor.',
  inst: { gal: { sample: 'stacc', vol: 0.55, pan: -0.25 }, low: { sample: 'basses', vol: 0.5, sub: 0.5 }, bass: { sample: 'pizz', vol: 0.55, sub: 0.4 },
    fl: { sample: 'flute', vol: 1.5, pan: 0.15 }, glock: { sample: 'glock', vol: 0.6, pan: 0.3 }, horn: { sample: 'horns', vol: 1.7, pan: 0.15 } },
  sections: {
    A: { prog: ['Am', 'G', 'F', 'E', 'Am', 'G', 'F', 'E'], parts: [
      { type: 'arp', inst: 'gal', oct: 3, every: 1, pat: [0, null, 0, 0, 1, null, 1, 1] },
      { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R . R R R . R R' },
      { type: 'mel', inst: 'fl', bars: ['A5 - - - E5 - A5 -', 'B5 - A5 - G5 - D5 -', 'C6 - - - A5 - F5 -', 'E5 - - - G#5 - B5 -', 'C6 - B5 - A5 - E5 -', 'D5 - E5 - G5 - B5 -', 'A5 - C6 - F5 - A5 -', 'G#5 - - - - - E5 -'] },
      { type: 'mel', inst: 'glock', shift: 12, bars: ['A5 - - - - - - -', 'B5 - - - - - - -', 'C6 - - - - - - -', 'E5 - - - - - - -', 'C6 - - - - - - -', 'D5 - - - - - - -', 'A5 - - - - - - -', 'G#5 - - - - - - -'] },
      { type: 'drums', kit: (b) => ({ kick: 'x . . . x . . . x . . . x . . .', snare: '. . . . x . . . . . . . x . x x', shaker: 'x x x x x x x x x x x x x x x x', timp: 'x . . . . . . . x . . . . . . .', ...(b === 0 ? { crash: 'x . . . . . . . . . . . . . . .' } : {}) }), vel: 0.9 }] },
    B: { prog: ['F', 'G', 'Am', 'Am', 'F', 'G', 'E', 'E'], parts: [
      { type: 'arp', inst: 'gal', oct: 3, every: 1, pat: [0, null, 0, 0, 2, null, 2, 2] },
      { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R R R R R R R R' },
      { type: 'mel', inst: 'horn', bars: ['F4 - - - A4 - C5 -', 'D5 - - - B4 - G4 -', 'A4 - - - C5 - E5 -', 'D5 - C5 - B4 - A4 -', 'C5 - - - F5 - A4 -', 'B4 - - - D5 - G4 -', 'G#4 - - - B4 - E5 -', 'D5 - C5 - B4 - G#4 -'] },
      { type: 'mel', inst: 'fl', bars: [null, null, null, null, 'A5 - - - C6 - - -', 'B5 - - - D6 - - -', 'G#5 - - - B5 - - -', 'E6 - D6 - B5 - G#5 -'] },
      { type: 'drums', kit: (b) => ({ kick: 'x . . x x . . . x . . x x . . .', snare: '. . . . x . . . . . . . x . . .', shaker: 'x x x x x x x x x x x x x x x x', ...(b === 7 ? { snare: '. . . . x . . . x . x x x x x x' } : {}) }), vel: 0.9 }] },
  },
  order: ['A', 'B'],
};
REAL.warden_of_chains = {
  title: 'Warden of Chains', screen: 'boss', bpm: 132,
  desc: 'NEW (round 5). Heavy boss: a stomping low riff of trombones, string basses and deep sub, a choir, timpani and trumpets, with a glockenspiel and harpsichord shine on top. C minor.',
  inst: { riff: { sample: 'trombones', vol: 0.9, sub: 0.7 }, low: { sample: 'basses', vol: 0.5 }, choir: { sample: 'choir', vol: 0.5 }, str: { sample: 'stacc', vol: 0.45, pan: -0.25 },
    tpt: { sample: 'trumpets', vol: 1.6, pan: 0.15 }, glock: { sample: 'glock', vol: 0.55, pan: 0.3 }, chm: { sample: 'choir', vol: 1.6 }, hi: { sample: 'harpsichord', vol: 0.45, pan: -0.3 } },
  sections: {
    A: { prog: ['Cm', 'Cm', 'Db', 'Db', 'Cm', 'Cm', 'Ab', 'G'], parts: [
      { type: 'bass', inst: 'riff', oct: 2, pat: 'R . R . . R . R R . R . . 5 . .' },
      { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' },
      { type: 'chord', inst: 'choir', oct: 3, vel: 0.6 },
      { type: 'arp', inst: 'str', oct: 4, every: 1, pat: [0, 1, 0, 2] },
      { type: 'mel', inst: 'tpt', bars: ['C5 - - - - - Eb5 -', 'D5 - C5 - G4 - - -', 'Db5 - - - - - F5 -', 'Eb5 - Db5 - Ab4 - - -', 'C5 - - - G5 - - -', 'F5 - Eb5 - D5 - C5 -', 'Eb5 - - - C5 - Ab4 -', 'B4 - - - D5 - G5 -'] },
      { type: 'mel', inst: 'glock', shift: 12, bars: ['C5 - - - - - - -', 'D5 - - - - - - -', 'Db5 - - - - - - -', 'Eb5 - - - - - - -', 'C5 - - - - - - -', 'F5 - - - - - - -', 'Eb5 - - - - - - -', 'B4 - - - - - - -'] },
      { type: 'drums', kit: (b) => ({ kick: 'x . . x . . x . x . . x . . x .', snare: '. . . . x . . . . . . . x . . .', timp: 'x . x . x . x . x . x . x . x .', rhat: 'x o x o x o x o x o x o x o x o', ...(b === 0 ? { crash: 'x . . . . . . . . . . . . . . .', tamtam: 'x . . . . . . . . . . . . . . .' } : {}) }), vel: 0.85 }] },
    B: { prog: ['Ab', 'Bb', 'G', 'Cm', 'Ab', 'Bb', 'G', 'G'], parts: [
      { type: 'bass', inst: 'riff', oct: 2, pat: 'R . R . . R . R R . R . . 5 . .' },
      { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' },
      { type: 'arp', inst: 'hi', oct: 5, every: 1, pat: [0, 1, 2, 3] },
      { type: 'mel', inst: 'chm', bars: ['C5 - - - - - - -', 'D5 - - - - - - -', 'B4 - - - - - D5 -', 'Eb5 - - - - - - -', 'C5 - - - Eb5 - - -', 'F5 - - - D5 - - -', 'G5 - - - - - F5 -', 'D5 - - - B4 - - -'] },
      { type: 'drums', kit: (b) => ({ kick: 'x . x . x . x . x . x . x . x .', snare: '. . . . x . . . . . . . x . . .', timp: 'x . . . . . . . x . . . . . . .', rhat: 'x o x o x o x o x o x o x o x o', ...(b === 7 ? { snare: 'x . x . x . x . x x x x x x x x' } : {}) }), vel: 0.85 }] },
  },
  order: ['A', 'B'],
};
REAL.lair_gate = {
  title: 'Lair Gate', screen: 'squad', bpm: 116,
  desc: 'NEW (round 5). Before the descent: tense but steady. Harp arpeggios, a firm bass with sub, a horn theme doubled by glockenspiel, then high violins. G minor.',
  inst: { harp: { sample: 'harp', vol: 0.5, pan: -0.3 }, bass: { sample: 'pizz', vol: 0.6, sub: 0.6 }, low: { sample: 'basses', vol: 0.4 },
    horn: { sample: 'horns', vol: 1.7, pan: 0.1 }, glock: { sample: 'glock', vol: 0.5, pan: 0.3 }, vln: { sample: 'violins', vol: 1.8, pan: 0.15 } },
  sections: {
    A: { prog: ['Gm', 'Gm', 'Eb', 'D', 'Gm', 'Gm', 'Cm', 'D'], parts: [
      { type: 'arp', inst: 'harp', oct: 4, every: 1, pat: [0, 1, 2, 3, 2, 1, 2, 1] },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R . R . R . 5 .' },
      { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' },
      { type: 'mel', inst: 'horn', bars: ['G4 - - - D5 - - -', 'C5 - Bb4 - A4 - G4 -', 'Bb4 - - - G4 - Eb4 -', 'F#4 - - - A4 - D5 -', 'G4 - - - D5 - G5 -', 'F5 - D5 - C5 - Bb4 -', 'C5 - Eb5 - D5 - C5 -', 'A4 - - - F#4 - D4 -'] },
      { type: 'mel', inst: 'glock', shift: 12, bars: ['G4 - - - D5 - - -', 'C5 - Bb4 - A4 - G4 -', 'Bb4 - - - G4 - Eb4 -', 'F#4 - - - A4 - D5 -', 'G4 - - - D5 - G5 -', 'F5 - D5 - C5 - Bb4 -', 'C5 - Eb5 - D5 - C5 -', 'A4 - - - F#4 - D4 -'] },
      { type: 'drums', kit: (b) => ({ kick: 'x . . . . . x . x . . . . . . .', snare: '. . . . x . . . . . . . x . . .', rhat: 'x . x . x . x . x . x . x . x .', ...(b === 0 ? { crash: 'x . . . . . . . . . . . . . . .' } : {}) }), vel: 0.85 }] },
    B: { prog: ['Eb', 'F', 'Gm', 'Gm', 'Eb', 'F', 'D', 'D'], parts: [
      { type: 'arp', inst: 'harp', oct: 4, every: 1, pat: [0, 1, 2, 3] },
      { type: 'bass', inst: 'bass', oct: 2, pat: 'R . R . R . R .' },
      { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' },
      { type: 'mel', inst: 'vln', bars: ['G5 - - - Eb5 - - -', 'F5 - - - C5 - - -', 'D5 - - - G5 - Bb5 -', 'A5 - G5 - F5 - D5 -', 'Eb5 - - - G5 - Bb5 -', 'C6 - - - A5 - F5 -', 'F#5 - - - A5 - D6 -', 'C6 - Bb5 - A5 - F#5 -'] },
      { type: 'drums', kit: (b) => ({ kick: 'x . . . x . . . x . . . x . . .', snare: '. . . . x . . . . . . . x . . .', rhat: 'x o x o x o x o x o x o x o x o' }), vel: 0.85 }] },
  },
  order: ['A', 'B'],
};
REAL.ember_watch = {
  title: 'Ember Watch', screen: 'title', bpm: 84,
  desc: 'NEW (round 5). Title: dark and calm but not sleepy. Harp ripples over a deep string-bass drone with sub, a flute theme with glockenspiel sparkle, then a low cello answer. D minor.',
  inst: { harp: { sample: 'harp', vol: 0.55, pan: -0.25 }, low: { sample: 'basses', vol: 0.5, sub: 0.6 }, fl: { sample: 'flute', vol: 1.4, pan: 0.15 },
    glock: { sample: 'glock', vol: 0.5, pan: 0.3 }, cel: { sample: 'celli', vol: 1.3, pan: -0.1 }, choir: { sample: 'choir', vol: 0.35 } },
  sections: {
    A: { prog: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'C', 'A'], parts: [
      { type: 'arp', inst: 'harp', oct: 3, every: 1, pat: [0, 1, 2, 3, 4, 3, 2, 1] },
      { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' },
      { type: 'mel', inst: 'fl', bars: ['A5 - - - F5 - D5 -', 'D5 - - - F5 - - -', 'G5 - - - Bb5 - A5 G5', 'E5 - - - - - . .', 'A5 - - - D6 - C6 -', 'Bb5 - - - F5 - D5 -', 'E5 - G5 - C6 - Bb5 -', 'A5 - - - - - . .'] },
      { type: 'arp', inst: 'glock', oct: 5, every: 4, pat: [3, 4, 2, 4] }] },
    B: { prog: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'C', 'A'], parts: [
      { type: 'arp', inst: 'harp', oct: 3, every: 1, pat: [0, 1, 2, 3, 4, 3, 2, 1] },
      { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' },
      { type: 'chord', inst: 'choir', oct: 3, vel: 0.6 },
      { type: 'mel', inst: 'cel', bars: ['D3 - - - F3 - A3 -', 'Bb3 - - - D4 - - -', 'G3 - - - Bb3 - D4 -', 'C#4 - - - E4 - - -', 'D4 - - - F4 - A4 -', 'Bb3 - - - F3 - D3 -', 'E3 - G3 - C4 - E4 -', 'A3 - - - - - . .'] },
      { type: 'arp', inst: 'glock', oct: 5, every: 4, pat: [3, 4, 2, 4] },
      { type: 'drums', kit: (b) => (b === 0 ? { timp: 'x . . . . . . . . . . . . . . .' } : {}), vel: 0.6 }] },
  },
  order: ['A', 'B'],
};

// ---------- ROUND 6 (user: '16-bit again, NO gothic / dark; Risk-of-Rain energy but dungeon crawler / general RPG; at
// least 4 per screen'). A song BUILDER: each spec = chords, tempo, instruments, a melody MOTIF (rhythm + chord-tone
// contour); build6() writes the melody (sequenced over the chords, varied on bars 2/6, cadences on bars 4/8) and the
// whole arrangement for its screen style. No organ / harpsichord / choir (the 'gothic' sounds). Made 16-bit + mastered
// in make-board6.py.
const PCN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiName = (m) => PCN[m % 12] + (Math.floor(m / 12) - 1);
const CQ = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10] };
function chordAt(cell) {
  const m = /^([A-G])(#|b)?(m|7)?$/.exec(cell.split(' ')[0]);
  return { root: ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12, tones: CQ[m[3] || ''] };
}
const tone = (ch, i, oct) => { const n = ch.tones.length, k = ((i % n) + n) % n; return 12 * (oct + 1) + ch.root + ch.tones[k] + 12 * Math.floor(i / n); };
function genMel(prog, motif, oct) {
  return prog.map((cell, bi) => {
    const ch = chordAt(cell);
    let r = motif.r, c = motif.c;
    if (bi === 7) { r = 'x - - - - - . .'; c = [0]; }
    else if (bi === 3) { r = 'x - - - x - - -'; c = [2, 1]; }
    else { if (bi % 2 === 1) c = [...c].reverse(); if (bi === 4 || bi === 5) c = c.map((v) => v + 1); }
    let k = 0;
    return r.split(' ').map((t) => (t === 'x' ? midiName(tone(ch, c[k++ % c.length], oct)) : t)).join(' ');
  });
}
const KITS = {
  title: (b) => (b === 0 ? { timp: 'x . . . . . . . . . . . . . . .' } : {}),
  titleB: (b) => ({ kick: 'x . . . . . . . x . . . . . . .', shaker: '. . x . . . x . . . x . . . x .', ...(b === 0 ? { crash: 'x . . . . . . . . . . . . . . .' } : {}) }),
  squad: (b) => ({ rkick: 'x . . . . . x . x . . . . . . .', rsnare: '. . . . x . . . . . . . x . . .', rhat: 'x . x . x . x . x . x . x . x .', ...(b === 0 ? { rcrash: 'x . . . . . . . . . . . . . . .' } : {}) }),
  squadB: (b) => ({ rkick: 'x . . . x . . . x . . . x . . .', rsnare: '. . . . x . . . . . . . x . . .', rhat: 'x o x o x o x o x o x o x o x o', ...(b === 7 ? { rsnare: '. . . . x . . . x . x . x x x x' } : {}) }),
  battle: (b) => ({ rkick: 'x . . x . . x . . . x . . x . .', rsnare: '. . . . x . . . . . . . x . . .', rhat: 'x o x o x o x o x o x o x o x o', ...(b === 0 ? { rcrash: 'x . . . . . . . . . . . . . . .' } : {}) }),
  battleB: (b) => ({ rkick: 'x . . . x . . x x . . . x . . .', rsnare: '. . . . x . . . . . . . x . . .', rhat: 'x x x x x x x x x x x x x x x x', ...(b === 0 ? { rcrash: 'x . . . . . . . . . . . . . . .' } : {}), ...(b === 7 ? { rsnare: '. . . . x . . . x . x x x x x x' } : {}) }),
  boss: (b) => ({ rkick: 'x . . x . . x . x . . x . . x .', rsnare: '. . . . x . . . . . . . x . . .', rhat: 'x o x o x o x o x o x o x o x o', timp: 'x . . . x . . . x . . . x . . .', ...(b === 0 ? { rcrash: 'x . . . . . . . . . . . . . . .' } : {}) }),
  bossB: (b) => ({ rkick: 'x . x . x . x . x . x . x . x .', rsnare: '. . . . x . . . . . . . x . . .', rhat: 'x x x x x x x x x x x x x x x x', timp: 'x . . . . . . . x . . . . . . .', ...(b === 0 ? { rcrash: 'x . . . . . . . . . . . . . . .' } : {}), ...(b === 7 ? { rsnare: 'x . x . x . x . x x x x x x x x' } : {}) }),
};
const LEAD = { flute: ['flute', 1.4], horns: ['horns', 1.7], trumpets: ['trumpets', 1.6], violins: ['violins', 1.8], xylo: ['xylo', 1.4], glock: ['glock', 1.0], celli: ['celli', 1.4] };
function build6(sp) {
  const [la, lb] = sp.leads, A = sp.A, B = sp.B;
  const fight = sp.screen === 'battle' || sp.screen === 'boss', lv = fight ? 1.35 : 1;
  const inst = { leadA: { sample: LEAD[la][0], vol: LEAD[la][1] * lv, pan: 0.1 }, leadB: { sample: LEAD[lb][0], vol: LEAD[lb][1] * lv, pan: 0.15 },
    dbl: { sample: 'glock', vol: 0.45, pan: 0.3 }, bass: { sample: 'pizz', vol: fight ? 0.5 : 0.6, sub: 0.6 }, low: { sample: 'basses', vol: 0.4 },
    pad: { sample: 'strings', vol: 0.25 }, str: { sample: 'stacc', vol: 0.45, pan: -0.25 }, harp: { sample: 'harp', vol: 0.5, pan: -0.3 },
    arp: { sample: sp.arp || 'xylo', vol: 0.45, pan: 0.3 }, tbn: { sample: 'trombones', vol: 0.8, sub: 0.6 } };
  const melA = genMel(A, sp.mA, sp.oA), melB = genMel(B, sp.mB, sp.oB);
  const P = { title: [
      [{ type: 'arp', inst: 'harp', oct: 3, every: 1, pat: [0, 1, 2, 3, 4, 3, 2, 1] }, { type: 'chord', inst: 'pad', oct: 3 }, { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' },
       { type: 'mel', inst: 'leadA', bars: melA }, { type: 'arp', inst: 'dbl', oct: 5, every: 4, pat: [3, 4, 2, 4] }, { type: 'drums', kit: KITS.title, vel: 0.6 }],
      [{ type: 'arp', inst: 'harp', oct: 3, every: 1, pat: [0, 1, 2, 3, 4, 3, 2, 1] }, { type: 'bass', inst: 'bass', oct: 2, pat: 'R . . . R . . .' }, { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' },
       { type: 'mel', inst: 'leadB', bars: melB }, { type: 'mel', inst: 'dbl', shift: 12, bars: melB }, { type: 'drums', kit: KITS.titleB, vel: 0.7 }]],
    squad: [
      [{ type: 'arp', inst: 'harp', oct: 4, every: 1, pat: [0, 1, 2, 3, 2, 1, 2, 1] }, { type: 'chord', inst: 'pad', oct: 3 }, { type: 'bass', inst: 'bass', oct: 2, pat: 'R . R . R . 5 .' },
       { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' }, { type: 'mel', inst: 'leadA', bars: melA }, { type: 'drums', kit: KITS.squad, vel: 0.85 }],
      [{ type: 'arp', inst: 'arp', oct: 5, every: 1, pat: [0, 1, 2, 1] }, { type: 'bass', inst: 'bass', oct: 2, pat: 'R . R R R . R R' }, { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' },
       { type: 'mel', inst: 'leadB', bars: melB }, { type: 'mel', inst: 'dbl', shift: 12, bars: melB }, { type: 'drums', kit: KITS.squadB, vel: 0.85 }]],
    battle: [
      [{ type: 'arp', inst: 'str', oct: 4, every: 1, pat: [0, 1, 2, 1] }, { type: 'arp', inst: 'arp', oct: 5, every: 1, pat: [0, 2, 1, 3] },
       { type: 'bass', inst: 'bass', oct: 2, pat: 'R . . R . . R . R . . R . . 5 .' }, { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' },
       { type: 'mel', inst: 'leadA', bars: melA }, { type: 'drums', kit: KITS.battle, vel: 0.9 }],
      [{ type: 'arp', inst: 'str', oct: 4, every: 1, pat: [0, 2, 1, 3] }, { type: 'arp', inst: 'arp', oct: 5, every: 1, pat: [0, 1, 2, 3] },
       { type: 'bass', inst: 'bass', oct: 2, pat: 'R . R R . R R . R . R R . R 8 .' }, { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' },
       { type: 'mel', inst: 'leadB', bars: melB }, { type: 'mel', inst: 'dbl', shift: 12, bars: melB }, { type: 'drums', kit: KITS.battleB, vel: 0.9 }]],
    boss: [
      [{ type: 'arp', inst: 'str', oct: 4, every: 1, pat: [0, 1, 0, 2] }, { type: 'arp', inst: 'arp', oct: 5, every: 1, pat: [0, 2, 1, 3] },
       { type: 'bass', inst: 'bass', oct: 2, pat: 'R R R R R R R R' }, { type: 'bass', inst: 'tbn', oct: 2, pat: 'R - - - R - - - R - - - R - - -' },
       { type: 'mel', inst: 'leadA', bars: melA }, { type: 'drums', kit: KITS.boss, vel: 0.9 }],
      [{ type: 'arp', inst: 'str', oct: 4, every: 1, pat: [0, 1, 2, 3] }, { type: 'arp', inst: 'arp', oct: 5, every: 1, pat: [0, 1, 2, 3] },
       { type: 'bass', inst: 'bass', oct: 2, pat: 'R R R R R R R R' }, { type: 'bass', inst: 'tbn', oct: 2, pat: 'R - - - R - - - R - - - R - - -' },
       { type: 'mel', inst: 'leadB', bars: melB }, { type: 'mel', inst: 'dbl', shift: 12, bars: melB }, { type: 'drums', kit: KITS.bossB, vel: 0.9 }]] }[sp.screen];
  return { title: sp.title, screen: sp.screen, bpm: sp.bpm, desc: 'NEW (round 6, 16-bit). ' + sp.desc, inst,
    sections: { A: { prog: A, parts: P[0] }, B: { prog: B, parts: P[1] } }, order: ['A', 'B'] };
}
const R6 = [
  // ---- title (general RPG, uplifting, not town) ----
  { id: 'banner_of_dawn', title: 'Banner of Dawn', screen: 'title', bpm: 92, leads: ['flute', 'horns'], A: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'], B: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'G'],
    mA: { r: 'x - - - x - x -', c: [2, 3, 4] }, oA: 4, mB: { r: 'x - - x - - x -', c: [0, 1, 2] }, oB: 3, desc: 'A proud RPG opening: harp, flute theme, then horns with a glockenspiel shine and a light beat. C major.' },
  { id: 'hall_of_heroes', title: 'Hall of Heroes', screen: 'title', bpm: 96, leads: ['horns', 'violins'], A: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A'], B: ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'A'],
    mA: { r: 'x - - x - - x -', c: [0, 1, 2, 3] }, oA: 3, mB: { r: 'x - x - x - - -', c: [2, 3, 4, 3] }, oB: 4, desc: 'Heroic and warm: a horn theme over harp, then high violins. D major.' },
  { id: 'wayfarers_oath', title: "Wayfarer's Oath", screen: 'title', bpm: 88, leads: ['flute', 'violins'], A: ['Em', 'C', 'G', 'D', 'Em', 'C', 'D', 'D'], B: ['C', 'D', 'Em', 'Em', 'C', 'D', 'B', 'B'],
    mA: { r: 'x - - - x x x -', c: [4, 3, 2, 3] }, oA: 4, mB: { r: 'x - - - x - x -', c: [0, 2, 3] }, oB: 4, desc: 'An adventure about to begin, a little wistful but hopeful. E minor with bright chords.' },
  { id: 'starfall_gate', title: 'Starfall Gate', screen: 'title', bpm: 100, leads: ['glock', 'horns'], A: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C'], B: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'C'],
    mA: { r: 'x - x - x - x -', c: [2, 3, 4, 3] }, oA: 4, mB: { r: 'x - - x - - x -', c: [0, 1, 2] }, oB: 3, desc: 'Sparkly and magical: a glockenspiel tune over harp, then a broad horn theme. F major.' },
  // ---- squad (getting ready, steady drive) ----
  { id: 'gear_up', title: 'Gear Up', screen: 'squad', bpm: 118, leads: ['trumpets', 'flute'], arp: 'glock', A: ['G', 'F', 'C', 'G', 'G', 'F', 'C', 'D'], B: ['Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'D'],
    mA: { r: 'x - x x - x x -', c: [0, 1, 2, 1] }, oA: 4, mB: { r: 'x - - x - - x -', c: [2, 3, 4] }, oB: 4, desc: 'Strapping on the armour: a bright trumpet tune over a rolling beat, then flute. G (Mixolydian).' },
  { id: 'party_assemble', title: 'Party Assemble', screen: 'squad', bpm: 112, leads: ['horns', 'xylo'], A: ['A', 'E', 'F#m', 'D', 'A', 'E', 'D', 'E'], B: ['F#m', 'D', 'A', 'E', 'F#m', 'D', 'Bm', 'E'],
    mA: { r: 'x - - x - - x -', c: [0, 2, 3, 2] }, oA: 3, mB: { r: 'x x x - x - x -', c: [2, 1, 0, 1, 2] }, oB: 5, desc: 'Picking your team: confident horns, then a quick xylophone line. A major.' },
  { id: 'map_and_compass', title: 'Map and Compass', screen: 'squad', bpm: 120, leads: ['violins', 'trumpets'], arp: 'glock', A: ['Dm', 'G', 'Dm', 'C', 'Dm', 'G', 'Bb', 'C'], B: ['Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'A', 'A'],
    mA: { r: 'x - x - x x - x', c: [0, 1, 2, 3] }, oA: 4, mB: { r: 'x - - - x - x -', c: [2, 1, 3] }, oB: 4, desc: 'Planning the route: busy violins over a steady groove, then trumpets. D (Dorian).' },
  { id: 'last_supplies', title: 'Last Supplies', screen: 'squad', bpm: 124, leads: ['flute', 'horns'], A: ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'A', 'A'], B: ['G', 'A', 'Bm', 'Bm', 'G', 'A', 'F#', 'F#'],
    mA: { r: 'x x x - x - x -', c: [4, 3, 2, 3, 4] }, oA: 4, mB: { r: 'x - - x - - x -', c: [0, 1, 2] }, oB: 3, desc: 'Ready to go: a quick flute tune over drums, then horns. B minor, upbeat.' },
  // ---- battle (Risk-of-Rain drive, dungeon crawler) ----
  { id: 'stormvault', title: 'Stormvault', screen: 'battle', bpm: 148, leads: ['trumpets', 'violins'], A: ['Em', 'C', 'G', 'D', 'Em', 'C', 'D', 'B'], B: ['C', 'D', 'Em', 'C', 'Am', 'D', 'B', 'B'],
    mA: { r: 'x - - x - - x -', c: [0, 1, 2, 3] }, oA: 4, mB: { r: 'x - x x - x x -', c: [2, 3, 4, 3] }, oB: 4, desc: 'Syncopated driving bass, racing arpeggios, a trumpet hook, then soaring violins. E minor, epic not gloomy.' },
  { id: 'ore_and_ember', title: 'Ore and Ember', screen: 'battle', bpm: 152, leads: ['xylo', 'trumpets'], A: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E'], B: ['F', 'G', 'Am', 'Am', 'F', 'G', 'E', 'E'],
    mA: { r: 'x x x - x x x -', c: [0, 1, 2, 3, 2, 1] }, oA: 4, mB: { r: 'x - - x - - x -', c: [2, 3, 4] }, oB: 4, desc: 'A fast mining-tunnel fight: a busy xylophone hook over a punchy beat, then trumpets. A minor.' },
  { id: 'hivebreak', title: 'Hivebreak', screen: 'battle', bpm: 144, leads: ['horns', 'xylo'], A: ['F#m', 'D', 'A', 'E', 'F#m', 'D', 'E', 'E'], B: ['D', 'E', 'F#m', 'D', 'Bm', 'E', 'C#', 'C#'],
    mA: { r: 'x - x - x - - x', c: [0, 2, 3, 2] }, oA: 3, mB: { r: 'x x x x x - x -', c: [4, 3, 2, 1, 2, 3] }, oB: 4, desc: 'Swarms everywhere: pushing horns, then a frantic xylophone line. F-sharp minor, energetic.' },
  { id: 'runeshard_rush', title: 'Runeshard Rush', screen: 'battle', bpm: 156, leads: ['violins', 'trumpets'], arp: 'glock', A: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'C', 'A'], B: ['Bb', 'C', 'Dm', 'Dm', 'Gm', 'C', 'A', 'A'],
    mA: { r: 'x - x x x - x x', c: [0, 1, 2, 3, 2] }, oA: 4, mB: { r: 'x - - x - - x -', c: [2, 3, 4] }, oB: 4, desc: 'The fastest: rushing violins and glockenspiel arpeggios, then a trumpet charge. D minor, bright.' },
  { id: 'spire_climb', title: 'Spire Climb', screen: 'battle', bpm: 140, leads: ['trumpets', 'flute'], A: ['Gm', 'C', 'Gm', 'F', 'Gm', 'C', 'Eb', 'D'], B: ['Eb', 'F', 'Gm', 'Gm', 'Eb', 'F', 'D', 'D'],
    mA: { r: 'x - - x - - x -', c: [2, 3, 4, 3] }, oA: 4, mB: { r: 'x x x - x x x -', c: [0, 1, 2, 3] }, oB: 5, desc: 'Climbing floor after floor: a bold trumpet riff, then a quick high flute. G (Dorian).' },
  // ---- boss (big and driving, not gothic) ----
  { id: 'colossus', title: 'Colossus', screen: 'boss', bpm: 136, leads: ['horns', 'trumpets'], A: ['Cm', 'Ab', 'Eb', 'Bb', 'Cm', 'Ab', 'Bb', 'G'], B: ['Ab', 'Bb', 'Cm', 'Cm', 'Ab', 'Bb', 'G', 'G'],
    mA: { r: 'x - - - x - x -', c: [0, 2, 3] }, oA: 3, mB: { r: 'x - - x - - x -', c: [2, 3, 4, 3] }, oB: 4, desc: 'A giant wakes up: low trombones and sub, pounding drums, a big horn theme, then trumpets. C minor, heroic.' },
  { id: 'titan_core', title: 'Titan Core', screen: 'boss', bpm: 144, leads: ['trumpets', 'violins'], A: ['Em', 'C', 'D', 'B', 'Em', 'C', 'D', 'B'], B: ['Am', 'C', 'D', 'Em', 'Am', 'C', 'B', 'B'],
    mA: { r: 'x - x - x - - x', c: [0, 1, 2, 3] }, oA: 4, mB: { r: 'x - x x - x x -', c: [4, 3, 2, 3] }, oB: 4, desc: 'Fast and relentless: a trumpet riff over double-time drums, then violins. E minor.' },
  { id: 'warlords_arena', title: "Warlord's Arena", screen: 'boss', bpm: 150, leads: ['horns', 'xylo'], A: ['Bm', 'G', 'A', 'F#', 'Bm', 'G', 'A', 'F#'], B: ['G', 'A', 'Bm', 'Bm', 'Em', 'A', 'F#', 'F#'],
    mA: { r: 'x - - x - - x -', c: [0, 1, 2] }, oA: 3, mB: { r: 'x x x - x x x -', c: [2, 3, 4, 3, 2] }, oB: 4, desc: 'An arena showdown: horns over pounding drums and timpani, then a racing xylophone. B minor.' },
  { id: 'leviathan_rise', title: 'Leviathan Rise', screen: 'boss', bpm: 132, leads: ['trumpets', 'horns'], A: ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'C', 'A'], B: ['Gm', 'Bb', 'Dm', 'Dm', 'Gm', 'Bb', 'A', 'A'],
    mA: { r: 'x - - x - - x -', c: [2, 3, 4] }, oA: 4, mB: { r: 'x - - - x - x -', c: [0, 1, 2, 3] }, oB: 3, desc: 'Something huge rises from the deep: heavy and steady, a trumpet call, then horns. D minor, epic.' },
];
for (const sp of R6) REAL[sp.id] = build6(sp);
export const ROUND6 = R6.map((s) => [s.id, s.screen]);
