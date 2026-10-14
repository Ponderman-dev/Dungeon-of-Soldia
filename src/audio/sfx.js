// Sound effects (browser Web Audio, no Phaser). The sound files are packed into the game code (Vite
// `?inline`), so the one-file preview page has them too. Data: src/data/sounds.json.
// Browsers only allow sound after the first tap, so the sounds are decoded on the first play() after
// a tap; before that, play() does nothing.
import soundData from '../data/sounds.json';
import { loadProgress, saveProgress } from '../systems/progress.js';

const files = import.meta.glob('../assets/sounds/*/*.mp3', { eager: true, query: '?inline', import: 'default' });

let ctx = null;
let master = null;
const buffers = {};
const lastPlayed = {};
let muted = !!(loadProgress().settings || {}).muted;

function audioContext() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = soundData.masterVolume ?? 1;
  master.connect(ctx.destination);
  return ctx;
}

function fileUrl(name) {
  return files[`../assets/sounds/${soundData.pack}/${name}.mp3`];
}

async function bufferFor(name) {
  if (buffers[name]) return buffers[name];
  const url = fileUrl(name);
  if (!url || !ctx) return null;
  buffers[name] = (async () => {
    const res = await fetch(url);
    return ctx.decodeAudioData(await res.arrayBuffer());
  })().catch(() => null);
  return buffers[name];
}

// Plays a cue from sounds.json (e.g. 'tap', 'levelUp'). Never throws: a sound can never break the game.
export async function play(cue) {
  try {
    if (muted) return;
    const c = soundData.cues[cue];
    if (!c) return;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (lastPlayed[cue] && now - lastPlayed[cue] < (soundData.minGapMs || 0)) return; // the same sound many times at once = one
    lastPlayed[cue] = now;
    const a = audioContext();
    if (!a) return;
    if (a.state === 'suspended') await a.resume();
    const buf = await bufferFor(c.file);
    if (!buf) return;
    const src = a.createBufferSource();
    src.buffer = buf;
    if (c.pitchJitter) src.playbackRate.value = 1 + (Math.random() * 2 - 1) * c.pitchJitter;
    const g = a.createGain();
    g.gain.value = c.volume ?? 1;
    src.connect(g).connect(master);
    src.start();
  } catch {
    // ignore
  }
}

export function isMuted() {
  return muted;
}

// Turns sound on/off and remembers it in the save.
export function setMuted(on) {
  muted = !!on;
  const p = loadProgress();
  p.settings = { ...(p.settings || {}), muted };
  saveProgress(p);
}
