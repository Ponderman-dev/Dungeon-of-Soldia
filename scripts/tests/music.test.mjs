// Music (session 53): music.json is complete (every screen's songs exist, every song has its file and a loop point
// inside it), the rules pick the right song, and the scenes tell the player where we are.
import fs from 'fs';
import { trackFor, isTurnTrack, musicGain } from '../../src/systems/music.js';
import { readSettings, cardOf } from '../../src/systems/settings.js';
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const read = (p) => JSON.parse(fs.readFileSync(new URL('../../' + p, import.meta.url)));
const data = read('src/data/music.json'), defs = read('src/data/settings.json');
const used = Object.values(data.screens).flatMap((s) => (s === null ? [] : Array.isArray(s) ? s : [s]));
ok('every screen plays songs that exist in tracks', used.every((id) => data.tracks[id]), used.filter((id) => !data.tracks[id]).join());
const noFile = Object.entries(data.tracks).filter(([, t]) => !fs.existsSync(new URL(`../../src/assets/music/${t.file}.mp3`, import.meta.url)));
ok('every track has its mp3', noFile.length === 0, noFile.map(([k]) => k).join());
const badLoop = Object.entries(data.tracks).filter(([, t]) => !(t.loopStart >= 0 && t.seconds > 0 && t.loopStart < t.seconds - 5));
ok('every loop point is inside its song (and leaves a real loop)', badLoop.length === 0, badLoop.map(([k]) => k).join());
ok('every track names its composer + licence (credits screen)', Object.values(data.tracks).every((t) => /CC0|CC BY/.test(t.credit || '')));
const files = fs.readdirSync(new URL('../../src/assets/music/', import.meta.url)).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4));
const dead = files.filter((f) => !Object.values(data.tracks).some((t) => t.file === f) || !used.includes(Object.keys(data.tracks).find((k) => data.tracks[k].file === f)));
ok('every music file is played by some screen (no dead weight in the page)', dead.length === 0, dead.join());
// rules
ok('title and camp share the title song (it keeps playing between them)', trackFor('title', 0, data) === trackFor('camp', 0, data));
const fake = { screens: { floors: ['a', 'b', 'c'] } };
ok('a LIST screen takes turns and wraps around (rule kept for later)', isTurnTrack('floors', fake) && ['a', 'b', 'c', 'a'].every((id, i) => trackFor('floors', i, fake) === id));
ok('battle floors are silent (user removed the battle songs)', trackFor('battle', 0, data) === null);
ok('boss floors play one song, not a list', !isTurnTrack('boss', data) && !!trackFor('boss', 0, data));
ok('game over and BEGIN DESCENT are silent', trackFor('gameOver', 0, data) === null && trackFor('descent', 0, data) === null);
ok('music sits under the sound effects (volume at most 0.3, user: 0.5 drowned them)', data.volume > 0 && data.volume <= 0.3);
const full = musicGain({ settings: { music: cardOf(defs, 'music').max } }, data, defs, readSettings, cardOf);
ok('MUSIC 10 = music.json volume, MUSIC 0 = silent, muted = silent',
  Math.abs(full - data.volume) < 1e-9 && musicGain({ settings: { music: 0 } }, data, defs, readSettings, cardOf) === 0 && musicGain({ settings: { music: 10, muted: true } }, data, defs, readSettings, cardOf) === 0);
// scenes say where we are
const src = (f) => fs.readFileSync(new URL('../../src/scenes/' + f, import.meta.url), 'utf8');
const plays = ['TitleScene.js', 'BaseScene.js', 'SquadScene.js', 'BattleScene.js', 'GameOverScene.js'].map(src).join('\n');
const screens = new Set([...plays.matchAll(/music\.play\('([a-zA-Z]+)'/g)].map((m) => m[1]));
ok('every music.json screen is played by a scene', Object.keys(data.screens).every((s) => screens.has(s)), Object.keys(data.screens).filter((s) => !screens.has(s)).join());
ok('the boss song starts only after the roar (in startFighting, past the roar wait)', /bossIntroDone = false;\n\s*if \(this\.state\.enemies\.some\(\(u\) => u\.def\.boss\)\) music\.play\('boss'\)/.test(src('BattleScene.js')));
ok('the MUSIC bar and mute button update the music', /music\.refresh\(\)/.test(src('SettingsScene.js')) && /music\.refresh\(\)/.test(src('SquadScene.js')));
