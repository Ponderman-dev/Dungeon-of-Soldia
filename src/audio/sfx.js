// Sound effects (browser Web Audio, no Phaser). The sound files are packed into the game code (Vite
// `?inline`), so the one-file preview page has them too. Data: src/data/sounds.json.
// Browsers only allow sound after the first tap, so the sounds are decoded on the first play() after
// a tap; before that, play() does nothing.
import soundData from '../data/sounds.json';
import { loadProgress, saveProgress } from '../systems/progress.js';

const files = import.meta.glob('../assets/sounds/**/*.mp3', { eager: true, query: '?inline', import: 'default' });

let ctx = null;
let master = null;
const buffers = {};
const lastPlayed = {};
let voices = 0; // busy fight sounds playing right now (never more than maxVoices at once)
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

// A file name is in the menu pack folder (sounds.json `pack`), unless it names its own folder ('kenney/chop').
function fileUrl(name) {
  return files[`../assets/sounds/${name.includes('/') ? name : `${soundData.pack}/${name}`}.mp3`];
}

// The packed sound files are data: URLs. They are unpacked here by hand, NOT with fetch(): the claude.ai
// preview frame blocks fetch() (even of data: URLs), which left the game silent there.
function bytesOf(url) {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function bufferFor(name) {
  if (buffers[name]) return buffers[name];
  const url = fileUrl(name);
  if (!url || !ctx) return null;
  buffers[name] = ctx.decodeAudioData(bytesOf(url)).catch(() => null);
  return buffers[name];
}

// Plays a cue from sounds.json (e.g. 'tap', 'levelUp'). Never throws: a sound can never break the game.
export async function play(cue) {
  try {
    if (muted) return;
    const c = soundData.cues[cue];
    if (!c) return;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (lastPlayed[cue] && now - lastPlayed[cue] < (c.minGapMs ?? soundData.minGapMs ?? 0)) return; // the same sound many times at once = one
    // Only BUSY sounds (a cue with its own minGapMs: hits, procs, steps...) share the maxVoices slots; one-off moments
    // (floor clear, level up, rewards, boss roar...) always play (user: at high floors they went silent: slots full).
    const busy = c.minGapMs !== undefined && !c.always; // `always`: a tapped skill's own sound
    if (busy && voices >= (soundData.maxVoices || 8)) return;
    lastPlayed[cue] = now;
    const a = audioContext();
    if (!a) return;
    if (a.state === 'suspended') await a.resume();
    // `files`: several takes of the same sound, one picked at random each time (50 hits never sound the same).
    const file = c.files ? c.files[Math.floor(Math.random() * c.files.length)] : c.file;
    const buf = await bufferFor(file);
    if (!buf) return;
    const src = a.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = (c.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * (c.pitchJitter || 0));
    const g = a.createGain();
    g.gain.value = c.volume ?? 1;
    src.connect(g).connect(master);
    if (busy) {
      voices++;
      src.onended = () => { voices = Math.max(0, voices - 1); };
    }
    src.start();
  } catch {
    // ignore
  }
}

// True when sounds.json has this cue (e.g. a skill's own 'skill_<id>' sound).
export function has(cue) {
  return !!soundData.cues[cue];
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
