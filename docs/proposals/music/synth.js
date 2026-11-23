// Tiny music engine for the 'code' songs (Web Audio, no Phaser, no files).
// A song is DATA (see songs.js): tempo, sections of chords + parts (pad, arp, bass, melody, drums), and an order.
// The engine turns that into notes on its own little synth instruments, scheduled a moment ahead so it never stutters.
// Usage: const p = createMusicPlayer(audioCtx, destinationNode); p.play(song); p.stop(); p.setVolume(0..1)

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11], sus4: [0, 5, 7], sus2: [0, 2, 7], '5': [0, 7], m6: [0, 3, 7, 9], dim7: [0, 3, 6, 9] };

export function noteMidi(name) { // 'C#5' -> 73
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error('bad note ' + name);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
export function parseChord(name) { // 'Bbm7' -> { root: 10, tones: [0,3,7,10] }
  const m = /^([A-G])(#|b)?(.*)$/.exec(name);
  if (!m || !QUAL[m[3]]) throw new Error('bad chord ' + name);
  return { root: (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12, tones: QUAL[m[3]] };
}
const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
// chord tone i (0 = root, 1 = 3rd, 2 = 5th, 3 = root an octave up for a triad...) at octave oct
function chordTone(ch, i, oct) {
  const n = ch.tones.length, k = ((i % n) + n) % n;
  return 12 * (oct + 1) + ch.root + ch.tones[k] + 12 * Math.floor(i / n);
}
const toks = (s) => s.trim().split(/\s+/).filter(Boolean);

// ---- turn a song into a flat list of events per bar (pure, testable in node) ----
// returns { stepDur, stepsPerBar, bars: [[{t: step, len: steps, kind, inst, midi?, vel, drum?}]] , loopFrom }
export function compile(song) {
  const spb = song.stepsPerBar || 16, stepsPerBeat = song.stepsPerBeat || 4;
  const stepDur = 60 / song.bpm / stepsPerBeat;
  const bars = [];
  const order = [...(song.intro || []), ...song.order];
  for (const secName of order) {
    const sec = song.sections[secName];
    if (!sec) throw new Error('no section ' + secName);
    sec.prog.forEach((cell, bi) => {
      const chords = cell.split(/\s+/).map(parseChord); // 'F E' = two chords in one bar
      const chordAt = (step) => chords[Math.min(chords.length - 1, Math.floor(step / (spb / chords.length)))];
      const ev = [];
      for (const part of sec.parts) {
        const vel = part.vel ?? 1, inst = part.inst;
        if (part.type === 'chord') {
          chords.forEach((ch, ci) => {
            const len = spb / chords.length, notes = (part.voices || [0, 1, 2]).map((i) => chordTone(ch, i, part.oct ?? 3));
            for (const midi of notes) ev.push({ t: ci * len, len, inst, midi, vel });
          });
        } else if (part.type === 'arp') {
          const every = part.every || 2, pat = part.pat;
          for (let s = 0, k = 0; s < spb; s += every, k++) {
            const i = pat[k % pat.length];
            if (i === null || i === '.') continue;
            ev.push({ t: s, len: part.len || every, inst, midi: chordTone(chordAt(s), i, part.oct ?? 4), vel: vel * (k % 4 === 0 ? 1 : 0.8) });
          }
        } else if (part.type === 'bass') {
          const tk = toks(part.pat), res = spb / tk.length;
          tk.forEach((x, k) => {
            if (x === '.' || x === '-') return;
            let len = res; for (let j = k + 1; j < tk.length && tk[j] === '-'; j++) len += res;
            const ch = chordAt(k * res), base = 12 * ((part.oct ?? 2) + 1) + ch.root;
            const off = x === 'R' ? 0 : x === '8' ? 12 : x === '5' ? 7 : x === '3' ? ch.tones[1] : x === '7' ? 10 : x === '-5' ? -5 : 0;
            ev.push({ t: k * res, len, inst, midi: base + off, vel });
          });
        } else if (part.type === 'mel') {
          const line = part.bars[bi % part.bars.length];
          if (!line) continue;
          const tk = toks(line), res = spb / tk.length;
          tk.forEach((x, k) => {
            if (x === '.' || x === '-') return;
            let len = res; for (let j = k + 1; j < tk.length && tk[j] === '-'; j++) len += res;
            ev.push({ t: k * res, len, inst, midi: noteMidi(x) + (part.shift || 0), vel });
          });
        } else if (part.type === 'drums') {
          const kit = typeof part.kit === 'function' ? part.kit(bi) : part.kit;
          for (const [drum, pat] of Object.entries(kit)) {
            const tk = pat.replace(/\s+/g, '').split(''), res = spb / tk.length;
            tk.forEach((x, k) => { if (x === 'x' || x === 'o') ev.push({ t: k * res, len: res, drum, vel: vel * (x === 'x' ? 1 : 0.45) }); });
          }
        }
      }
      bars.push(ev);
    });
  }
  const introBars = (song.intro || []).reduce((n, s) => n + song.sections[s].prog.length, 0);
  return { stepDur, stepsPerBar: spb, bars, loopFrom: introBars };
}

// ---------------- the synth ----------------
export function createMusicPlayer(ctx, dest) {
  const master = ctx.createGain(); master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
  const dry = ctx.createGain(), wet = ctx.createGain(); wet.gain.value = 0.9;
  const verb = ctx.createConvolver(); verb.buffer = impulse(ctx, 2.6, 2.4);
  dry.connect(comp); verb.connect(wet); wet.connect(comp); comp.connect(master); master.connect(dest || ctx.destination);
  const noise = (() => { const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
  const waves = {
    pulse25: pulseWave(ctx, 0.25), pulse12: pulseWave(ctx, 0.125),
    organ: ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.7, 0.35, 0.5, 0, 0.2, 0, 0.15])),
  };
  let song = null, comp_ = null, timer = null, nextBarTime = 0, barIdx = 0, voiceGain = null, instCfg = {};

  function out(revAmount) { // a per-note output: dry + reverb send
    const g = ctx.createGain(); g.connect(voiceGain);
    if (revAmount > 0) { const s = ctx.createGain(); s.gain.value = revAmount; g.connect(s); s.connect(verb); }
    return g;
  }
  function osc(type, f, t, stop, detune = 0) {
    const o = ctx.createOscillator();
    if (waves[type]) o.setPeriodicWave(waves[type]); else o.type = type;
    o.frequency.setValueAtTime(f, t); o.detune.value = detune; o.start(t); o.stop(stop);
    return o;
  }
  // ---- instruments: (t, midi, dur seconds, vel) ----
  const INST = {
    pad(t, m, dur, v, c) { // two soft detuned saws through a low filter, slow swell
      const o = out(c.rev ?? 0.6), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = c.cut || 900; f.Q.value = 0.3;
      f.connect(o); const end = t + dur, stop = end + 1.6;
      for (const dt of [-8, 8]) osc(c.wave || 'sawtooth', freq(m), t, stop, dt).connect(f);
      o.gain.setValueAtTime(0.0001, t); o.gain.linearRampToValueAtTime(0.05 * v * (c.vol || 1), t + (c.attack || 0.7));
      o.gain.setValueAtTime(0.05 * v * (c.vol || 1), end); o.gain.linearRampToValueAtTime(0.0001, end + 1.4);
    },
    choir(t, m, dur, v, c) { // pad through two vowel-ish band filters
      const o = out(c.rev ?? 0.8), stop = t + dur + 1.8;
      for (const [fq, q, gn] of [[650, 4, 1], [1100, 5, 0.6]]) {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = q;
        const gg = ctx.createGain(); gg.gain.value = gn; bp.connect(gg); gg.connect(o);
        for (const dt of [-10, 0, 10]) { const ox = osc('sawtooth', freq(m), t, stop, dt); ox.connect(bp); }
      }
      o.gain.setValueAtTime(0.0001, t); o.gain.linearRampToValueAtTime(0.11 * v * (c.vol || 1), t + 0.5);
      o.gain.setValueAtTime(0.11 * v * (c.vol || 1), t + dur); o.gain.linearRampToValueAtTime(0.0001, t + dur + 1.5);
    },
    pluck(t, m, dur, v, c) { // harp / lute: bright saw that darkens fast
      const o = out(c.rev ?? 0.4), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
      f.frequency.setValueAtTime(c.bright || 3200, t); f.frequency.exponentialRampToValueAtTime(260, t + (c.decay || 0.5));
      f.connect(o); const stop = t + Math.max(dur, 0.2) + 0.9;
      osc(c.wave || 'sawtooth', freq(m), t, stop).connect(f);
      o.gain.setValueAtTime(0.0001, t); o.gain.linearRampToValueAtTime(0.09 * v * (c.vol || 1), t + 0.004);
      o.gain.setTargetAtTime(0.0001, t + 0.01, (c.decay || 0.5) / 2.2);
    },
    bell(t, m, dur, v, c) { // FM bell
      const o = out(c.rev ?? 0.7), stop = t + 2.6, car = osc('sine', freq(m), t, stop), mod = osc('sine', freq(m) * 3.5, t, stop);
      const mg = ctx.createGain(); mg.gain.setValueAtTime(freq(m) * 2.2, t); mg.gain.exponentialRampToValueAtTime(1, t + 1.6);
      mod.connect(mg); mg.connect(car.frequency); car.connect(o);
      o.gain.setValueAtTime(0.0001, t); o.gain.linearRampToValueAtTime(0.11 * v * (c.vol || 1), t + 0.005); o.gain.setTargetAtTime(0.0001, t + 0.01, 0.55);
    },
    lead(t, m, dur, v, c) { // chip / flute / brass depending on wave + filter
      const o = out(c.rev ?? 0.35), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = c.q || 0.7;
      const cut = c.cut || 2600, end = t + dur * 0.92, stop = end + 0.5;
      if (c.brass) { f.frequency.setValueAtTime(cut * 0.25, t); f.frequency.linearRampToValueAtTime(cut, t + 0.08); f.frequency.setTargetAtTime(cut * 0.6, t + 0.1, 0.2); }
      else f.frequency.value = cut;
      f.connect(o);
      const ox = osc(c.wave || 'square', freq(m), t, stop);
      if (c.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(c.vib, t + 0.35); l.connect(lg); lg.connect(ox.detune); l.start(t); l.stop(stop); }
      if (c.double) osc(c.wave || 'square', freq(m), t, stop, c.double).connect(f);
      ox.connect(f);
      const pk = 0.07 * v * (c.vol || 1);
      o.gain.setValueAtTime(0.0001, t); o.gain.linearRampToValueAtTime(pk, t + (c.attack || 0.012));
      o.gain.setTargetAtTime(pk * (c.sus ?? 0.75), t + 0.03, 0.15);
      o.gain.setValueAtTime(pk * (c.sus ?? 0.75), end); o.gain.linearRampToValueAtTime(0.0001, end + (c.release || 0.08));
    },
    bass(t, m, dur, v, c) {
      const o = out(c.rev ?? 0.1), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = c.q || 4;
      const cut = c.cut || 700, end = t + dur * (c.gate || 0.85);
      f.frequency.setValueAtTime(cut * 2, t); f.frequency.exponentialRampToValueAtTime(cut * 0.4, t + 0.25); f.connect(o);
      osc(c.wave || 'sawtooth', freq(m), t, end + 0.1).connect(f);
      if (c.sub !== false) { const s = osc('sine', freq(m), t, end + 0.1), sg = ctx.createGain(); sg.gain.value = 0.9; s.connect(sg); sg.connect(o); }
      const pk = 0.12 * v * (c.vol || 1);
      o.gain.setValueAtTime(0.0001, t); o.gain.linearRampToValueAtTime(pk, t + 0.008); o.gain.setTargetAtTime(pk * 0.7, t + 0.02, 0.1);
      o.gain.setValueAtTime(pk * 0.7, end); o.gain.linearRampToValueAtTime(0.0001, end + 0.06);
    },
  };
  const DRUM = {
    kick(t, v) { const o = out(0.05), s = osc('sine', 150, t, t + 0.45); s.frequency.exponentialRampToValueAtTime(42, t + 0.12); s.connect(o); o.gain.setValueAtTime(0.5 * v, t); o.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); },
    snare(t, v) { nz(t, v * 0.32, 0.18, 'bandpass', 1900, 0.25); const o = out(0.25), s = osc('triangle', 190, t, t + 0.15); s.frequency.exponentialRampToValueAtTime(120, t + 0.1); s.connect(o); o.gain.setValueAtTime(0.18 * v, t); o.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); },
    hat(t, v) { nz(t, v * 0.09, 0.045, 'highpass', 7500, 0.05); },
    ohat(t, v) { nz(t, v * 0.08, 0.25, 'highpass', 6500, 0.1); },
    crash(t, v) { nz(t, v * 0.12, 1.6, 'highpass', 4500, 0.6); },
    shaker(t, v) { nz(t, v * 0.06, 0.07, 'bandpass', 5200, 0.1); },
    frame(t, v) { const o = out(0.5), s = osc('sine', 110, t, t + 0.4); s.frequency.exponentialRampToValueAtTime(70, t + 0.2); s.connect(o); o.gain.setValueAtTime(0.25 * v, t); o.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); nz(t, v * 0.05, 0.05, 'bandpass', 900, 0.3); },
    tom(t, v) { const o = out(0.4), s = osc('sine', 130, t, t + 0.5); s.frequency.exponentialRampToValueAtTime(80, t + 0.3); s.connect(o); o.gain.setValueAtTime(0.35 * v, t); o.gain.exponentialRampToValueAtTime(0.0001, t + 0.45); },
    timp(t, v) { const o = out(0.7), s = osc('sine', 98, t, t + 1.6); s.frequency.exponentialRampToValueAtTime(86, t + 0.4); s.connect(o); o.gain.setValueAtTime(0.42 * v, t); o.gain.exponentialRampToValueAtTime(0.0001, t + 1.5); nz(t, v * 0.08, 0.08, 'lowpass', 600, 0.5); },
    boom(t, v) { const o = out(0.9), s = osc('sine', 70, t, t + 2.2); s.frequency.exponentialRampToValueAtTime(34, t + 0.9); s.connect(o); o.gain.setValueAtTime(0.55 * v, t); o.gain.exponentialRampToValueAtTime(0.0001, t + 2); nz(t, v * 0.12, 0.5, 'lowpass', 400, 0.8); },
  };
  function nz(t, vol, len, type, fq, rev) {
    const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = fq;
    const o = out(rev); s.connect(f); f.connect(o); o.gain.setValueAtTime(vol, t); o.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.start(t, Math.random() * 0.5); s.stop(t + len + 0.05);
  }

  function scheduleBar(i, t0) {
    const bar = comp_.bars[i], sd = comp_.stepDur;
    for (const e of bar) {
      const t = t0 + e.t * sd;
      if (e.drum) { DRUM[e.drum] && DRUM[e.drum](t, e.vel); continue; }
      const c = instCfg[e.inst] || {}, kind = c.kind || e.inst;
      if (INST[kind]) INST[kind](t, e.midi, e.len * sd, e.vel, c);
    }
  }
  function tick() {
    if (!comp_) return;
    const barLen = comp_.stepDur * comp_.stepsPerBar;
    while (nextBarTime < ctx.currentTime + 0.25) {
      scheduleBar(barIdx, nextBarTime);
      nextBarTime += barLen; barIdx++;
      if (barIdx >= comp_.bars.length) barIdx = comp_.loopFrom;
    }
  }
  return {
    play(s) {
      this.stop(0.25);
      song = s; comp_ = compile(s); instCfg = s.inst || {}; barIdx = 0;
      voiceGain = ctx.createGain(); voiceGain.gain.value = s.gain || 1; voiceGain.connect(dry);
      nextBarTime = ctx.currentTime + 0.08; tick(); timer = setInterval(tick, 50);
    },
    stop(fade = 0.6) {
      clearInterval(timer); timer = null; comp_ = null;
      if (voiceGain) { const g = voiceGain; g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setValueAtTime(g.gain.value, ctx.currentTime); g.gain.linearRampToValueAtTime(0, ctx.currentTime + fade); setTimeout(() => g.disconnect(), fade * 1000 + 3000); voiceGain = null; }
    },
    // schedule everything up to `secs` at once (for an OfflineAudioContext render / checks)
    renderAll(s, secs) {
      song = s; comp_ = compile(s); instCfg = s.inst || {}; barIdx = 0;
      voiceGain = ctx.createGain(); voiceGain.gain.value = s.gain || 1; voiceGain.connect(dry);
      nextBarTime = 0; const barLen = comp_.stepDur * comp_.stepsPerBar;
      while (nextBarTime < secs) { scheduleBar(barIdx, nextBarTime); nextBarTime += barLen; barIdx++; if (barIdx >= comp_.bars.length) barIdx = comp_.loopFrom; }
    },
    setVolume(v) { master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    get playing() { return !!comp_; },
  };
}

function pulseWave(ctx, d) {
  const N = 40, re = new Float32Array(N), im = new Float32Array(N);
  for (let n = 1; n < N; n++) { re[n] = (2 / (n * Math.PI)) * Math.sin(2 * Math.PI * n * d); im[n] = (2 / (n * Math.PI)) * (1 - Math.cos(2 * Math.PI * n * d)); }
  return ctx.createPeriodicWave(re, im);
}
function impulse(ctx, secs, decay) { // stone-room reverb tail made from noise
  const len = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * 0.5; }
  return b;
}
