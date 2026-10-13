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
