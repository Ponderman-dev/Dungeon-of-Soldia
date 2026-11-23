// The 'code' songs: original music written as notes for synth.js. 2 per screen.
// Melody bars: one token per note slot ('A4' note, '-' hold, '.' rest). Bass: R root, 3 third, 5 fifth, 8 octave.
// Arp pat: chord-tone numbers (0 root, 1 third, 2 fifth, 3 root up an octave...). Drums: x loud, o soft, . nothing.

const KIT_NONE = {};

export const SONGS = {
  // ---------------- TITLE + CAMP ----------------
  ember_gate: {
    title: 'Ember Gate', screen: 'title', bpm: 68,
    desc: 'Slow and mysterious. A soft choir-like pad, a harp rolling chords and a bell melody far away, like standing at the dungeon gate at night. D minor.',
    inst: { pad: { kind: 'pad', cut: 800, vol: 1.1 }, harp: { kind: 'pluck', bright: 2600, decay: 0.9, vol: 0.8, rev: 0.6 },
      bell: { kind: 'bell', vol: 0.9 }, low: { kind: 'bass', wave: 'triangle', cut: 400, vol: 0.7, gate: 1, rev: 0.4 }, flute: { kind: 'lead', wave: 'triangle', cut: 2200, vib: 14, attack: 0.08, vol: 1.2, rev: 0.6 } },
    sections: {
      A: { prog: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A'], parts: [
        { type: 'chord', inst: 'pad', oct: 3, voices: [0, 1, 2, 3] },
        { type: 'arp', inst: 'harp', oct: 3, every: 2, pat: [0, 1, 2, 3, 4, 3, 2, 1] },
        { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' },
        { type: 'mel', inst: 'bell', bars: ['A4 - - - F5 - E5 -', 'D5 - - - - - . .', 'C5 - - - A4 - C5 -', 'G4 - - - - - . .',
          'A4 - - - F5 - G5 -', 'A5 - - - F5 - D5 -', 'E5 - - - D5 - Bb4 -', 'C#5 - - - - - . .'] }] },
      B: { prog: ['Dm', 'Bb', 'F', 'C', 'Gm', 'Bb', 'Gm', 'A'], parts: [
        { type: 'chord', inst: 'pad', oct: 3, voices: [0, 1, 2, 3] },
        { type: 'arp', inst: 'harp', oct: 4, every: 2, pat: [0, 2, 1, 3, 2, 4, 3, 2] },
        { type: 'bass', inst: 'low', oct: 1, pat: 'R - - - - - - -' },
        { type: 'mel', inst: 'flute', bars: ['D5 - - - - - - -', 'F5 - - - E5 - D5 -', 'C5 - - - - - - -', 'E5 - - - - - . .',
          'D5 - - - Bb4 - G4 -', 'F5 - - - - - D5 -', 'G5 - - - F5 - E5 -', 'E5 - - - - - . .'] },
        { type: 'drums', kit: { timp: 'x . . . . . . . . . . . . . . .' }, vel: 0.6 }] },
    },
    order: ['A', 'B'],
  },
  hearth: {
    title: 'Hearth', screen: 'title', bpm: 104, stepsPerBar: 6, stepsPerBeat: 2,
    desc: 'Warm and calm, a lute and a little flute by the campfire, gently swaying (6/8). A minor but cosy. Good for the camp.',
    inst: { lute: { kind: 'pluck', wave: 'sawtooth', bright: 2200, decay: 0.45, vol: 0.9, rev: 0.35 },
      flute: { kind: 'lead', wave: 'triangle', cut: 3000, vib: 12, attack: 0.05, vol: 1.4, rev: 0.45 },
      bassl: { kind: 'bass', wave: 'triangle', cut: 500, vol: 0.8, rev: 0.2 }, pad: { kind: 'pad', cut: 600, vol: 0.6 } },
    sections: {
      A: { prog: ['Am', 'G', 'F', 'E', 'Am', 'G', 'F E', 'Am'], parts: [
        { type: 'arp', inst: 'lute', oct: 3, every: 1, pat: [0, 2, 3, 4, 3, 2] },
        { type: 'bass', inst: 'bassl', oct: 2, pat: 'R - - 5 - -' },
        { type: 'mel', inst: 'flute', bars: ['E5 - - C5 - D5', 'B4 - - G4 - -', 'A4 - C5 F5 - E5', 'E5 - - - - .',
          'E5 - - A5 - G5', 'D5 - - B4 - G4', 'A4 - C5 B4 - G#4', 'A4 - - - - .'] },
        { type: 'drums', kit: { frame: 'x . . o . .', shaker: '. o o . o o' }, vel: 0.7 }] },
      B: { prog: ['F', 'C', 'G', 'Am', 'F', 'C', 'E', 'E'], parts: [
        { type: 'chord', inst: 'pad', oct: 3 },
        { type: 'arp', inst: 'lute', oct: 3, every: 1, pat: [0, 2, 3, 4, 3, 2] },
        { type: 'bass', inst: 'bassl', oct: 2, pat: 'R - - 5 - -' },
        { type: 'mel', inst: 'flute', bars: ['A5 - - - - F5', 'G5 - - E5 - C5', 'D5 - - B4 - D5', 'C5 - - - - .',
          'A4 - C5 F5 - A5', 'G5 - E5 C5 - E5', 'G#5 - - E5 - D5', 'B4 - - - - .'] },
        { type: 'drums', kit: { frame: 'x . . o . .', shaker: '. o o . o o' }, vel: 0.7 }] },
    },
    order: ['A', 'B'],
  },

  // ---------------- SQUAD / HERO SELECT ----------------
  muster: {
    title: 'Muster', screen: 'squad', bpm: 100,
    desc: 'Heroes gathering: a soft marching snare, plucked strings and a brass tune. Getting ready, a bit brave. E minor.',
    inst: { brass: { kind: 'lead', wave: 'sawtooth', brass: true, cut: 1800, vol: 1.1, rev: 0.45, double: 7 },
      pizz: { kind: 'pluck', bright: 1800, decay: 0.25, vol: 0.9, rev: 0.3 }, bassp: { kind: 'bass', cut: 500, gate: 0.4, vol: 0.9 },
      pad: { kind: 'pad', cut: 700, vol: 0.7 }, harp: { kind: 'pluck', bright: 3000, decay: 0.6, vol: 0.6, rev: 0.5 } },
    sections: {
      A: { prog: ['Em', 'C', 'D', 'Bm', 'Em', 'C', 'Am', 'B'], parts: [
        { type: 'chord', inst: 'pad', oct: 3 },
        { type: 'bass', inst: 'bassp', oct: 2, pat: 'R . R . 5 . R . R . R . 5 . 8 .' },
        { type: 'arp', inst: 'pizz', oct: 4, every: 2, pat: [0, 2, 1, 2, 0, 2, 1, 2] },
        { type: 'mel', inst: 'brass', bars: ['E4 - - - G4 - B4 -', 'C5 - - - B4 - G4 -', 'A4 - - - F#4 - D4 -', 'F#4 - - - - - . .',
          'E4 - - - G4 - B4 -', 'E5 - - - D5 - C5 -', 'C5 - B4 - A4 - C5 -', 'B4 - - - - - . .'] },
        { type: 'drums', kit: { snare: 'o . . o x . o . o . . o x . o .', kick: 'x . . . . . . . x . . . . . . .' }, vel: 0.6 }] },
      B: { prog: ['C', 'D', 'Em', 'Em', 'C', 'D', 'B', 'B'], parts: [
        { type: 'chord', inst: 'pad', oct: 3 },
        { type: 'bass', inst: 'bassp', oct: 2, pat: 'R . . . 5 . . . R . . . 5 . . .' },
        { type: 'arp', inst: 'harp', oct: 4, every: 1, pat: [0, 1, 2, 3, 4, 3, 2, 1] },
        { type: 'mel', inst: 'brass', bars: ['G4 - - - - - E4 -', 'A4 - - - - - F#4 -', 'B4 - - - - - - -', '. . B4 - C5 - D5 -',
          'E5 - - - - - C5 -', 'D5 - - - - - A4 -', 'B4 - - - - - - -', 'D#5 - - - F#5 - - -'] },
        { type: 'drums', kit: { snare: 'o . . . o . . . o . . . o o o o' }, vel: 0.5 }] },
    },
    order: ['A', 'B'],
  },
  roll_call: {
    title: 'Roll Call', screen: 'squad', bpm: 112,
    desc: 'Retro chiptune (old game console sound): quick bubbly arpeggios and a catchy tune. Upbeat, playful, a bit heroic. A minor.',
    inst: { arp: { kind: 'lead', wave: 'pulse25', cut: 5000, vol: 0.55, rev: 0.2, release: 0.03 },
      chip: { kind: 'lead', wave: 'square', cut: 4500, vib: 10, vol: 0.9, rev: 0.25 },
      tri: { kind: 'bass', wave: 'triangle', cut: 2000, q: 0.5, sub: false, vol: 1.4, gate: 0.7 } },
    sections: {
      A: { prog: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E'], parts: [
        { type: 'arp', inst: 'arp', oct: 4, every: 1, pat: [0, 1, 2, 1] },
        { type: 'bass', inst: 'tri', oct: 2, pat: 'R . 8 . R . 8 . R . 8 . 5 . 8 .' },
        { type: 'mel', inst: 'chip', bars: ['A4 - C5 - E5 - D5 C5', 'A4 - - - F4 - . .', 'G4 - C5 - E5 - G5 -', 'D5 - - - B4 - . .',
          'A4 - C5 - E5 - A5 -', 'G5 - F5 - E5 - C5 -', 'D5 - B4 - G4 - B4 -', 'G#4 - - - B4 - E5 -'] },
        { type: 'drums', kit: { kick: 'x . . . x . . . x . . . x . . .', snare: '. . . . x . . . . . . . x . . .', hat: '. . x . . . x . . . x . . . x .' }, vel: 0.7 }] },
      B: { prog: ['F', 'G', 'Em', 'Am', 'F', 'G', 'E', 'E'], parts: [
        { type: 'arp', inst: 'arp', oct: 4, every: 1, pat: [0, 2, 1, 3] },
        { type: 'bass', inst: 'tri', oct: 2, pat: 'R . R . 8 . R . R . R . 8 . 5 .' },
        { type: 'mel', inst: 'chip', bars: ['C5 - - - A4 - C5 -', 'D5 - - - B4 - D5 -', 'E5 - - - G5 - E5 -', 'A5 - - - - - . .',
          'F5 - E5 - C5 - A4 -', 'D5 - E5 - F5 - G5 -', 'G#5 - - - E5 - - -', 'B5 - - - G#5 - E5 -'] },
        { type: 'drums', kit: { kick: 'x . . . x . . . x . . . x . x .', snare: '. . . . x . . . . . . . x . . x', hat: 'o . x . o . x . o . x . o . x .' }, vel: 0.7 }] },
    },
    order: ['A', 'B'],
  },

  // ---------------- BATTLE FLOORS ----------------
  descent: {
    title: 'Descent', screen: 'battle', bpm: 132,
    desc: 'Driving fight music: a galloping bass, steady drums, a brass-like lead and fast plucked strings in part 2. Tense but not tiring. D minor.',
    inst: { lead: { kind: 'lead', wave: 'sawtooth', brass: true, cut: 2400, vol: 0.95, rev: 0.3, double: 6 },
      gallop: { kind: 'bass', cut: 600, gate: 0.6, vol: 1 }, pad: { kind: 'pad', cut: 900, vol: 0.6 },
      str: { kind: 'pluck', bright: 2600, decay: 0.2, vol: 0.7, rev: 0.25 } },
    sections: {
      A: { prog: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A'], parts: [
        { type: 'chord', inst: 'pad', oct: 3 },
        { type: 'bass', inst: 'gallop', oct: 2, pat: 'R . R R R . R R R . R R 5 . 8 .' },
        { type: 'mel', inst: 'lead', bars: ['D5 - - - A4 - D5 -', 'F5 - E5 - D5 - C5 -', 'D5 - - - Bb4 - F4 -', 'G4 - A4 - C5 - E5 -',
          'D5 - - - A4 - D5 -', 'F5 - G5 - A5 - F5 -', 'G5 - F5 - D5 - Bb4 -', 'A4 - C#5 - E5 - A5 -'] },
        { type: 'drums', kit: (b) => ({ kick: 'x . . . x . . . x . . . x . . .', snare: '. . . . x . . . . . . . x . . .', hat: 'x . o . x . o . x . o . x . o .', ...(b === 0 ? { crash: 'x . . . . . . . . . . . . . . .' } : {}) }), vel: 0.8 }] },
      B: { prog: ['Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'A', 'A'], parts: [
        { type: 'chord', inst: 'pad', oct: 3 },
        { type: 'arp', inst: 'str', oct: 4, every: 1, pat: [0, 1, 2, 3, 2, 1] },
        { type: 'bass', inst: 'gallop', oct: 2, pat: 'R . R R R . R R R . R R R . R R' },
        { type: 'mel', inst: 'lead', bars: ['F5 - - - - - D5 -', 'E5 - - - - - C5 -', 'D5 - - - - - - -', '. . . . A4 - D5 -',
          'F5 - - - - - G5 -', 'A5 - - - G5 - E5 -', 'C#5 - - - - - - -', 'E5 - D5 - C#5 - A4 -'] },
        { type: 'drums', kit: (b) => ({ kick: 'x . . x x . . . x . . x x . . .', snare: '. . . . x . . . . . . . x . . .', hat: 'x x x x x x x x x x x x x x x x'.replace(/x/g, (m, i) => (i % 4 ? 'o' : 'x')), ...(b === 7 ? { tom: '. . . . . . . . x . x . x x x x' } : {}) }), vel: 0.8 }] },
    },
    order: ['A', 'B'],
  },
  steel_stone: {
    title: 'Steel and Stone', screen: 'battle', bpm: 144,
    desc: 'Fast retro chiptune battle: buzzing arpeggios, a bouncing bass and a hero tune. Old-console dungeon crawler feel. E minor.',
    inst: { arp: { kind: 'lead', wave: 'pulse12', cut: 5000, vol: 0.5, rev: 0.15, release: 0.02 },
      chip: { kind: 'lead', wave: 'pulse25', cut: 5000, vib: 12, vol: 0.85, rev: 0.25 },
      tri: { kind: 'bass', wave: 'triangle', cut: 2000, q: 0.5, sub: false, vol: 1.5, gate: 0.6 } },
    sections: {
      A: { prog: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'Am', 'B'], parts: [
        { type: 'arp', inst: 'arp', oct: 4, every: 1, pat: [0, 1, 2, 3] },
        { type: 'bass', inst: 'tri', oct: 2, pat: 'R . 8 . R . 8 . R . 8 . R . 8 .' },
        { type: 'mel', inst: 'chip', bars: ['E5 - B4 - E5 - F#5 -', 'G5 - F#5 - E5 - B4 -', 'C5 - E5 - G5 - E5 -', 'F#5 - - - D5 - - -',
          'E5 - B4 - E5 - G5 -', 'B5 - A5 - G5 - F#5 -', 'E5 - C5 - A4 - C5 -', 'D#5 - - - F#5 - B5 -'] },
        { type: 'drums', kit: { kick: 'x . . . . . x . x . . . . . . .', snare: '. . . . x . . . . . . . x . . .', hat: 'o o x o o o x o o o x o o o x o' }, vel: 0.7 }] },
      B: { prog: ['Am', 'Am', 'C', 'D', 'Am', 'Am', 'B', 'B'], parts: [
        { type: 'arp', inst: 'arp', oct: 4, every: 1, pat: [0, 2, 1, 3] },
        { type: 'bass', inst: 'tri', oct: 2, pat: 'R R 8 . R R 8 . R R 8 . 5 . 8 .' },
        { type: 'mel', inst: 'chip', bars: ['A5 - - - E5 - - -', 'C6 - B5 - A5 - E5 -', 'G5 - - - E5 - C5 -', 'D5 - E5 - F#5 - A5 -',
          'A5 - - - E5 - - -', 'C6 - B5 - A5 - G5 -', 'F#5 - - - D#5 - B4 -', 'D#5 - F#5 - A5 - B5 -'] },
        { type: 'drums', kit: (b) => ({ kick: 'x . . . x . x . x . . . x . . .', snare: '. . . . x . . . . . . . x . . .', hat: 'x o x o x o x o x o x o x o x o', ...(b === 7 ? { snare: '. . . . x . . . x . x x x x x x' } : {}) }), vel: 0.7 }] },
    },
    order: ['A', 'B'],
  },

  // ---------------- BOSS ----------------
  brood: {
    title: 'The Brood', screen: 'boss', bpm: 150,
    desc: 'Big and scary: fast string ostinato, heavy timpani and drums, a choir and a low brass theme with a menacing turn in part 2. C minor.',
    inst: { brass: { kind: 'lead', wave: 'sawtooth', brass: true, cut: 1500, vol: 1.2, rev: 0.45, double: 9, attack: 0.03 },
      ost: { kind: 'pluck', bright: 2200, decay: 0.16, vol: 0.85, rev: 0.25 }, choir: { kind: 'choir', vol: 0.9 },
      low: { kind: 'bass', cut: 500, gate: 0.5, vol: 1.1 } },
    sections: {
      A: { prog: ['Cm', 'Cm', 'Ab', 'Ab', 'Fm', 'Fm', 'G', 'G7'], parts: [
        { type: 'chord', inst: 'choir', oct: 3 },
        { type: 'arp', inst: 'ost', oct: 3, every: 1, pat: [0, 0, 1, 0, 2, 0, 1, 0] },
        { type: 'bass', inst: 'low', oct: 1, pat: 'R . . R . . R . R . . R . . R .' },
        { type: 'mel', inst: 'brass', bars: ['C5 - - - - - - -', 'Eb5 - - - D5 - C5 -', 'Ab4 - - - - - - -', 'G4 - - - Ab4 - Bb4 -',
          'C5 - - - - - Ab4 -', 'F4 - - - Ab4 - C5 -', 'B4 - - - - - - -', 'D5 - - - F5 - B4 -'] },
        { type: 'drums', kit: (b) => ({ kick: 'x . . x . . x . . . x . . x . .', snare: '. . . . x . . . . . . . x . . .', timp: b % 4 === 0 ? 'x . . . . . . . x . . . . . . .' : '. . . . . . . . . . . . . . . .', ...(b === 0 ? { crash: 'x . . . . . . . . . . . . . . .' } : {}), ...(b === 7 ? { tom: '. . . . . . . . x . x . x x x x' } : {}) }), vel: 0.9 }] },
      B: { prog: ['Cm', 'Db', 'Cm', 'Db', 'Ab', 'Bb', 'G', 'G'], parts: [
        { type: 'chord', inst: 'choir', oct: 3 },
        { type: 'arp', inst: 'ost', oct: 4, every: 1, pat: [0, 1, 2, 1] },
        { type: 'bass', inst: 'low', oct: 1, pat: 'R R R R R R R R R R R R R R R R' },
        { type: 'mel', inst: 'brass', bars: ['G5 - - - - - Eb5 -', 'F5 - - - - - Ab5 -', 'G5 - - - - - C6 -', 'Bb5 - Ab5 - F5 - Db5 -',
          'C5 - - - Eb5 - Ab5 -', 'D5 - - - F5 - Bb5 -', 'B5 - - - - - - -', 'D6 - C6 - B5 - G5 -'] },
        { type: 'drums', kit: (b) => ({ kick: 'x . x . x . x . x . x . x . x .', snare: '. . . . x . . . . . . . x . . .', timp: 'x . . . . . . . . . . . . . . .', ...(b === 0 ? { crash: 'x . . . . . . . . . . . . . . .' } : {}), ...(b === 7 ? { snare: 'x . x . x . x . x x x x x x x x' } : {}) }), vel: 0.9 }] },
    },
    order: ['A', 'B'],
  },
  twentieth_floor: {
    title: 'The Twentieth Floor', screen: 'boss', bpm: 96,
    desc: 'Slow and HEAVY: huge drum booms, a dark church organ, a choir singing long notes and a pulsing low synth. Doom, ritual, ancient evil. D minor (Phrygian).',
    intro: ['I'],
    inst: { organ: { kind: 'lead', wave: 'organ', cut: 3000, vol: 0.6, rev: 0.6, attack: 0.03, sus: 1 }, choir: { kind: 'choir', vol: 1.1 },
      pulse: { kind: 'bass', cut: 380, gate: 0.5, q: 6, vol: 1.1 }, bell: { kind: 'bell', vol: 1, rev: 0.8 } },
    sections: {
      I: { prog: ['Dm', 'Eb'], parts: [
        { type: 'chord', inst: 'organ', oct: 3, voices: [0, 1, 2, 3] },
        { type: 'drums', kit: { boom: 'x . . . . . . . . . . . . . . .' } }] },
      A: { prog: ['Dm', 'Eb', 'Dm', 'Eb', 'Bb', 'A', 'Dm', 'A'], parts: [
        { type: 'chord', inst: 'organ', oct: 3, voices: [0, 1, 2, 3] },
        { type: 'bass', inst: 'pulse', oct: 1, pat: 'R . R . R . R . R . R . R . R .' },
        { type: 'mel', inst: 'choir', bars: ['A4 - - - - - - -', 'Bb4 - - - - - G4 -', 'A4 - - - - - F4 -', 'G4 - - - - - - -',
          'F4 - - - D5 - - -', 'C#5 - - - E5 - - -', 'D5 - - - F5 - - -', 'E5 - - - C#5 - A4 -'] },
        { type: 'drums', kit: (b) => ({ boom: 'x . . . . . . . . . . . . . . .', kick: '. . . . . . x . . . . . . . . .', snare: '. . . . . . . . x . . . . . . .', ...(b % 4 === 3 ? { tom: '. . . . . . . . . . x . x x x x' } : {}) }), vel: 0.9 }] },
      B: { prog: ['Dm', 'Eb', 'Dm', 'Eb', 'Gm', 'A', 'Bb', 'A'], parts: [
        { type: 'chord', inst: 'choir', oct: 3 },
        { type: 'arp', inst: 'organ', oct: 4, every: 2, pat: [0, 1, 2, 3, 2, 1, 0, 1] },
        { type: 'bass', inst: 'pulse', oct: 1, pat: 'R R R R R R R R R R R R R R R R' },
        { type: 'mel', inst: 'bell', bars: ['D6 - - - A5 - - -', 'G5 - - - - - Bb5 -', 'A5 - - - F5 - D5 -', 'Eb5 - - - - - - -',
          'D5 - G5 - Bb5 - D6 -', 'C#6 - - - A5 - E5 -', 'F5 - - - D5 - Bb4 -', 'A4 - C#5 - E5 - A5 -'] },
        { type: 'drums', kit: (b) => ({ boom: 'x . . . . . . . x . . . . . . .', kick: 'x . . . . . x . x . . . . . x .', snare: '. . . . x . . . . . . . x . . .', timp: b % 2 ? '. . . . . . . . . . . . x . x .' : '. . . . . . . . . . . . . . . .' }), vel: 0.9 }] },
    },
    order: ['A', 'B'],
  },
};
