// Keyframe animation clips, made on the Character Studio timeline. No Phaser here.
// A character's `anims` (in heroes.json / enemies.json / minions.json) holds clips by id:
//   anims.attack = { length: 400, tracks: { weapon: { angle: [{ t: 0, v: 0, ease: "ease" }, { t: 200, v: 90 }] } } }
// Each track moves one part's x, y (pixels, added to where the part is drawn) or angle (degrees, turns
// around the part's anchor). `ease` is how the value travels to the NEXT keyframe:
// "linear", "ease" (slow-fast-slow), "back" (overshoots, settles), "bounce" or "hold" (stays, then jumps).
// The game stretches attack to the swing time (or, with `hitAt`, so that moment lands as the hit lands)
// and wind-up to the skill's charge time.

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
export const EASES = ['linear', 'ease', 'back', 'bounce', 'hold'];

export function easeValue(name, p) {
  if (name === 'hold') return 0;
  if (name === 'back') {
    // Overshoots a little past the next key, then settles on it.
    const c = 1.70158;
    return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2;
  }
  if (name === 'bounce') {
    // Lands on the next key and bounces a few times, like a dropped ball.
    const n = 7.5625;
    const d = 2.75;
    if (p < 1 / d) return n * p * p;
    if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
    if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
    return n * (p -= 2.625 / d) * p + 0.984375;
  }
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

// The game's BUILT-IN motion for a clip, written as keyframes (so the studio timeline starts from it
// instead of from nothing). Mirrors Character.js: idle = each part's `idle` wiggle (yoyo, Sine),
// attack = weapon swings +75° and back, windup = crouch (castLift -4 screen px = 4/3 pixel) and the
// weapon cocked back -55°, skill releases = the hop / jump and the slash or raised weapon.
// Walk, hurt and death have no part motion built in (only the hop, a flash, a freeze): empty clips.
export function defaultClip(id, parts) {
  const info = CLIP_INFO[id];
  const names = Object.keys(parts);
  const weapon = parts.weapon ? 'weapon' : null;
  const tracks = {};
  const put = (part, prop, keys) => {
    tracks[part] = tracks[part] || {};
    tracks[part][prop] = keys.map(([t, v, ease = 'ease']) => ({ t, v, ease }));
  };
  const allY = (keys) => names.forEach((n) => put(n, 'y', keys));
  let length = info.length;
  if (id === 'idle') {
    const moving = names.filter((n) => parts[n].idle && (parts[n].idle.dy || parts[n].idle.angle));
    const longest = Math.max(0, ...moving.map((n) => parts[n].idle.duration || 500));
    if (longest) length = Math.max(400, Math.round((longest * 2) / 10) * 10);
    for (const n of moving) {
      const { dy = 0, angle = 0, duration = 500, delay = 0 } = parts[n].idle;
      for (const [prop, to] of [['y', dy], ['angle', angle]]) {
        if (!to) continue;
        const keys = delay ? [[0, 0, 'hold']] : [];
        for (let t = delay, i = 0; t <= length; t += duration, i++) keys.push([Math.round(t), i % 2 ? to : 0]);
        put(n, prop, keys);
      }
    }
  } else if (id === 'attack') {
    if (weapon) put(weapon, 'angle', [[0, 0], [200, 75], [400, 0]]);
  } else if (id === 'windup') {
    allY([[0, 0], [500, 1.5]]);
    if (weapon) put(weapon, 'angle', [[0, 0], [500, -55]]);
  } else if (id === 'skillAttack') {
    allY([[0, 1.5], [90, -2.5], [180, 0]]);
    if (weapon) put(weapon, 'angle', [[0, -55], [110, 105], [250, 105], [360, 0]]);
  } else if (id === 'skillSupport') {
    allY([[0, 1.5], [160, -6], [320, 0]]);
    if (weapon) put(weapon, 'angle', [[0, -55, 'hold'], [300, -25], [500, 0]]);
  }
  return { length, tracks };
}
