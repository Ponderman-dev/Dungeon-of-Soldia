// Keyframe clips from the studio timeline: sampling, easing, hold, keys in order.
import { sampleTrack, samplePose, setKey, tidyClip, easeValue } from '../../src/systems/animClips.js';
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);

const keys = [{ t: 0, v: 0, ease: 'linear' }, { t: 100, v: 10, ease: 'hold' }, { t: 200, v: 50 }];
ok('no keys = 0', sampleTrack([], 50) === 0 && sampleTrack(undefined, 50) === 0);
ok('linear halfway', sampleTrack(keys, 50) === 5);
ok('hold keeps the value until the next key', sampleTrack(keys, 199) === 10 && sampleTrack(keys, 200) === 50);
ok('before the first / after the last key', sampleTrack([{ t: 100, v: 3 }], 0) === 3 && sampleTrack(keys, 999) === 50);
ok('ease is slow at the ends, half at the middle', Math.abs(easeValue('ease', 0.5) - 0.5) < 1e-9 && easeValue('ease', 0.1) < 0.1);

const k2 = [];
setKey(k2, 200, 1);
setKey(k2, 0, 2);
setKey(k2, 200, 5);
ok('setKey keeps time order and replaces a key at the same time', k2.length === 2 && k2[0].t === 0 && k2[1].v === 5);

const clip = { length: 400, tracks: { weapon: { angle: [{ t: 0, v: 0, ease: 'linear' }, { t: 200, v: 90 }], x: [] }, body: { y: [] } } };
const pose = samplePose(clip, 100);
ok('samplePose gives every moved part x, y, angle', pose.weapon.angle === 45 && pose.weapon.x === 0 && pose.weapon.y === 0);
tidyClip(clip);
ok('tidyClip drops empty tracks and parts', !clip.tracks.body && !clip.tracks.weapon.x && clip.tracks.weapon.angle);

// The timeline starts from the game's built-in motion.
import { defaultClip } from '../../src/systems/animClips.js';
const parts = {
  body: { idle: { dy: -1, duration: 500 } },
  head: { idle: { dy: -1.5, duration: 500, delay: 120 } },
  weapon: { idle: { angle: 8, duration: 700 } },
};
const idle = defaultClip('idle', parts);
ok('idle default: one loop of the slowest wiggle', idle.length === 1400, String(idle.length));
ok('idle default: body bobs 0 > -1 > 0', sampleTrack(idle.tracks.body.y, 0) === 0 && sampleTrack(idle.tracks.body.y, 500) === -1 && sampleTrack(idle.tracks.body.y, 1000) === 0);
ok('idle default: head waits for its delay', sampleTrack(idle.tracks.head.y, 100) === 0 && sampleTrack(idle.tracks.head.y, 620) === -1.5);
ok('idle default: weapon tilts to 8 degrees', sampleTrack(idle.tracks.weapon.angle, 700) === 8);
const atk = defaultClip('attack', parts);
ok('attack default: weapon swings 75 degrees and back', sampleTrack(atk.tracks.weapon.angle, 200) === 75 && sampleTrack(atk.tracks.weapon.angle, 400) === 0);
ok('wind-up default: crouch and weapon cocked back', sampleTrack(defaultClip('windup', parts).tracks.body.y, 500) === 1.5 && sampleTrack(defaultClip('windup', parts).tracks.weapon.angle, 500) === -55);
ok('walk / hurt / death defaults are empty', ['walk', 'hurt', 'death'].every((id) => !Object.keys(defaultClip(id, parts).tracks).length));
ok('no weapon: no weapon tracks', !defaultClip('attack', { body: {} }).tracks.weapon);
