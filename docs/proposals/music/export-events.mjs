// Prints a REAL song's notes as JSON for render-real.py: node export-events.mjs <songId>
import { compile } from './synth.js';
import { REAL } from './songs-real.js';
const s = REAL[process.argv[2]];
if (!s) { console.error('unknown song', process.argv[2], Object.keys(REAL)); process.exit(1); }
const c = compile({ ...s, intro: undefined }), barLen = c.stepDur * c.stepsPerBar, ev = [];
c.bars.forEach((bar, i) => { for (const e of bar) ev.push({ t: i * barLen + e.t * c.stepDur, dur: e.len * c.stepDur, inst: e.inst, midi: e.midi, vel: e.vel, drum: e.drum }); });
console.log(JSON.stringify({ id: process.argv[2], loop: c.bars.length * barLen, inst: s.inst, events: ev }));
