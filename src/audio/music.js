// Music (browser Web Audio, no Phaser). Data: src/data/music.json (which song each screen plays, loop points, volume).
// Scenes only say WHERE we are: music.play('title' | 'camp' | 'squad' | 'battle' | 'boss' | 'gameOver').
// - The same song keeps playing when the next screen uses it too (title -> camp, battle floor -> battle floor).
// - A new song crossfades in (fadeSec). Each file = an intro, then a part that repeats (loopStart .. end of file).
// - A screen with a LIST of songs (battle floors: RPG 8, RPG 10): they take turns; each repeats a random number of
//   times (music.json turnRepeats), fades out, a short silence (turnGapSec), then the next one.
// - MUSIC volume (Settings) and the mute button: refresh(). Browsers only allow sound after the first tap: until then
//   the wanted song waits and starts on the first tap.
// Files are packed into the game code (Vite `?inline`) and unpacked by hand (NOT fetch: the claude.ai preview frame
// blocks fetch, see sfx.js).
import musicData from '../data/music.json';
import settingsDefs from '../data/settings.json';
import { loadProgress } from '../systems/progress.js';
import { readSettings, cardOf } from '../systems/settings.js';

const files = import.meta.glob('../assets/music/*.mp3', { eager: true, query: '?inline', import: 'default' });

import * as rules from '../systems/music.js';
const trackFor = (screen, turn = 0) => rules.trackFor(screen, turn, musicData);
const isTurnTrack = (screen) => rules.isTurnTrack(screen, musicData);
const musicGain = (progress) => rules.musicGain(progress, musicData, settingsDefs, readSettings, cardOf);

// ---------- the player ----------
let ctx = null;
let master = null;
let unlocked = false;
let wanted = null; // the screen the game is on now
let current = null; // { id, screen, src, gain, timer }
const turns = {}; // per list screen: how many songs have had their turn
const buffers = {};
let token = 0; // bumps on every change: an old, slow decode never starts a stale song

function audioContext() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = musicGain(loadProgress());
  master.connect(ctx.destination);
  return ctx;
}

function bytesOf(url) {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function bufferFor(id) {
  if (buffers[id]) return buffers[id];
  const t = musicData.tracks[id];
  const url = t && files[`../assets/music/${t.file}.mp3`];
  if (!url || !ctx) return Promise.resolve(null);
  buffers[id] = ctx.decodeAudioData(bytesOf(url)).catch(() => null);
  return buffers[id];
}

function fadeOut(v, sec) {
  if (!v) return;
  clearTimeout(v.timer);
  const now = ctx.currentTime;
  v.gain.gain.cancelScheduledValues(now);
  v.gain.gain.setValueAtTime(v.gain.gain.value, now);
  v.gain.gain.linearRampToValueAtTime(0, now + sec);
  try { v.src.stop(now + sec + 0.05); } catch { /* already stopped */ }
}

async function start(id, screen, fadeSec) {
  const my = ++token;
  const buf = await bufferFor(id);
  if (my !== token || !buf) return;
  const t = musicData.tracks[id];
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true; // a turn song loops too, so a late timer never leaves silence
  src.loopStart = Math.min(t.loopStart || 0, buf.duration - 0.1);
  src.loopEnd = buf.duration;
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + fadeSec);
  src.connect(gain).connect(master);
  src.start(now);
  fadeOut(current, fadeSec);
  current = { id, screen, src, gain, timer: null };
  // A list screen's song (battle floors): it repeats a random number of times (rules.turnSeconds), fades out at the
  // end of its last repeat, a short silence (turnGapSec: breathing room), then the next song starts at full energy.
  // During the silence `current` is still this song, so a new floor does not restart anything.
  if (isTurnTrack(screen)) {
    const endFade = musicData.turnEndFadeSec ?? 1.5;
    const gap = musicData.turnGapSec ?? 3;
    const playSec = rules.turnSeconds({ ...t, seconds: buf.duration }, musicData);
    const v = current;
    v.timer = setTimeout(() => {
      if (current !== v || wanted !== screen) return;
      fadeOut(v, endFade);
      v.timer = setTimeout(() => {
        if (current !== v || wanted !== screen) return;
        turns[screen] = (turns[screen] || 0) + 1;
        start(trackFor(screen, turns[screen]), screen, 0.05);
      }, (endFade + gap) * 1000);
    }, Math.max(1, playSec - endFade) * 1000);
  }
}

function apply() {
  if (!unlocked || !audioContext()) return;
  const id = wanted ? trackFor(wanted, turns[wanted] || 0) : null;
  if (!id) { token++; fadeOut(current, musicData.fadeSec ?? 1); current = null; return; }
  // Same song already on (title -> camp), or the list screen is still playing one of its songs (floor -> floor).
  if (current && (current.id === id || (current.screen === wanted && isTurnTrack(wanted)))) { current.screen = wanted; return; }
  // Leaving a list screen and coming back later: the next song in the list plays (not the same one again).
  if (current && isTurnTrack(current.screen) && current.screen !== wanted) turns[current.screen] = (turns[current.screen] || 0) + 1;
  start(id, wanted, musicData.fadeSec ?? 1);
}

// The game is now on this screen (see music.json screens). Never throws: music can never break the game.
export function play(screen) {
  try {
    wanted = screen;
    apply();
  } catch { /* ignore */ }
}

// Reads the MUSIC bar and mute from the save again (Settings changed them, the mute button, a deleted save).
export function refresh() {
  try {
    if (master) master.gain.setTargetAtTime(musicGain(loadProgress()), ctx.currentTime, 0.05);
  } catch { /* ignore */ }
}

// The first tap anywhere unlocks sound, then the waiting song starts. The app hidden (phone home button, other tab):
// the music pauses; back: it goes on.
if (typeof window !== 'undefined') {
  // PHONE FIX (user: no music on the phone): a finger's pointerdown does NOT count as a 'tap' for the browser's
  // sound rule (only pointerup / touchend / click do), and the old code tried once on pointerdown, then gave up for
  // good. Now every tap kind tries, and keeps trying until the sound really runs. The listeners stay: when the phone
  // pauses the sound (app hidden, a call) and it can't resume by itself, the next tap brings it back.
  const unlock = () => {
    const a = audioContext();
    if (!a || document.hidden) return;
    const go = () => {
      if (a.state !== 'running') return;
      if (!unlocked) { unlocked = true; apply(); }
    };
    if (a.state === 'running') go(); else a.resume().then(go, () => {});
  };
  for (const kind of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(kind, unlock, true);
  // Try at once too: the Android app lets sound start without a tap (its web view is set up with
  // mediaPlaybackRequiresUserGesture = false), so the title song plays as the game opens. A browser says no
  // (the context stays 'suspended') and the first tap starts it instead.
  try {
    const a = audioContext();
    if (a) a.resume().then(() => { if (a.state === 'running' && !unlocked) unlock(); }, () => {});
  } catch { /* ignore */ }
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !unlocked) return;
    if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {});
  });
}

// What is playing (for browser checks): the track id, or null.
export function nowPlaying() {
  return current ? current.id : null;
}
