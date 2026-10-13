// Keyframe animation clips, made on the Character Studio timeline. No Phaser here.
// A character's `anims` (in heroes.json / enemies.json / minions.json) holds clips by id:
//   anims.attack = { length: 400, tracks: { weapon: { angle: [{ t: 0, v: 0, ease: "ease" }, { t: 200, v: 90 }] } } }
// Each track moves one part's x, y (pixels, added to where the part is drawn) or angle (degrees, turns
// around the part's anchor). `ease` is how the value travels to the NEXT keyframe:
// "linear", "ease" (slow-fast-slow) or "hold" (stays, then jumps).
// The game stretches attack to the swing time and wind-up to the skill's charge time.

export const CLIPS = [
  { id: 'idle', label: 'Idle', length: 1000, loop: true },
  { id: 'attack', label: 'Attack', length: 400 },
  { id: 'windup', label: 'Wind-up', length: 500 },
  { id: 'skillAttack', label: 'Skill (attack)', length: 400 },
  { id: 'skillSupport', label: 'Skill (support)', length: 500 },
  { id: 'walk', label: 'Walk', length: 600, loop: true },
  { id: 'hurt', label: 'Hurt', length: 250 },
  { id: 'death', label: 'Death', length: 700 },
];
export const CLIP_INFO = Object.fromEntries(CLIPS.map((c) => [c.id, c]));
export const PROPS = ['x', 'y', 'angle'];
export const EASES = ['linear', 'ease', 'hold'];

export function easeValue(name, p) {
  if (name === 'hold') return 0;
  if (name === 'ease') return 0.5 - Math.cos(p * Math.PI) / 2;
  return p;
}

// The value of one track at time t (ms). No keys = 0; before the first / after the last key = that key.
export function sampleTrack(keys, t) {
  if (!keys || !keys.length) return 0;
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t < b.t) {
      const p = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
      return a.v + (b.v - a.v) * easeValue(a.ease || 'linear', p);
    }
  }
  return keys[keys.length - 1].v;
}

// Every part's offsets at time t: { partName: { x, y, angle } } (only parts the clip moves).
export function samplePose(clip, t) {
  const pose = {};
  if (!clip || !clip.tracks) return pose;
  for (const [part, tracks] of Object.entries(clip.tracks)) {
    pose[part] = { x: sampleTrack(tracks.x, t), y: sampleTrack(tracks.y, t), angle: sampleTrack(tracks.angle, t) };
  }
  return pose;
}

// Puts a key at time t (replacing one already there) and keeps the keys in time order.
export function setKey(keys, t, v, ease) {
  const i = keys.findIndex((k) => k.t === t);
  if (i >= 0) {
    keys[i].v = v;
    if (ease) keys[i].ease = ease;
  } else {
    keys.push({ t, v, ease: ease || 'ease' });
    keys.sort((a, b) => a.t - b.t);
  }
  return keys;
}

// A clip with no keys left in a track / part is tidied away.
export function tidyClip(clip) {
  for (const [part, tracks] of Object.entries(clip.tracks)) {
    for (const prop of Object.keys(tracks)) if (!tracks[prop].length) delete tracks[prop];
    if (!Object.keys(tracks).length) delete clip.tracks[part];
  }
  return clip;
}
