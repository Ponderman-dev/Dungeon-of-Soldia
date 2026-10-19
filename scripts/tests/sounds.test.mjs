// Every sound cue in sounds.json points at a real file (menu pack folder, or its own folder like 'kenney/').
import fs from 'fs';
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const data = JSON.parse(fs.readFileSync(new URL('../../src/data/sounds.json', import.meta.url)));
const path = (name) => new URL(`../../src/assets/sounds/${name.includes('/') ? name : `${data.pack}/${name}`}.mp3`, import.meta.url);
const missing = [];
for (const [cue, c] of Object.entries(data.cues)) for (const f of c.files || [c.file]) if (!f || !fs.existsSync(path(f))) missing.push(`${cue}:${f}`);
ok('every sound cue has its file(s)', missing.length === 0, missing.join(' '));
const bad = Object.entries(data.cues).filter(([, c]) => !(c.volume > 0 && c.volume <= 1) || (c.pitch !== undefined && !(c.pitch > 0)));
ok('volumes are 0-1 and pitches positive', bad.length === 0, bad.map(([k]) => k).join());
const cues = new Set(Object.keys(data.cues));
const src = ['src/scenes/BattleScene.js', 'src/scenes/SquadScene.js', 'src/scenes/RewardScene.js'].map((f) => fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8')).join('\n');
const used = [...src.matchAll(/sfx\.play\('([a-zA-Z]+)'\)/g)].map((m) => m[1]);
ok('every cue the scenes play exists in sounds.json', used.every((u) => cues.has(u)), used.filter((u) => !cues.has(u)).join());
// Hero skills have their own sound (user: 'every skill sounds different'); BattleScene plays skill_<id> on a cast,
// or the shared skillCast when the skill has none.
const heroes = JSON.parse(fs.readFileSync(new URL('../../src/data/heroes.json', import.meta.url)));
const skillIds = (Array.isArray(heroes) ? heroes : heroes.heroes).flatMap((h) => Object.values(h.skills));
const stray = [...cues].filter((c) => c.startsWith('skill_') && !skillIds.includes(c.slice(6)));
ok('every skill_<id> sound belongs to a real hero skill', stray.length === 0, stray.join());
const shared = skillIds.filter((id) => !cues.has(`skill_${id}`));
if (shared.length) console.log('INFO skills still on the shared skillCast sound:', shared.join());
const bs = fs.readFileSync(new URL('../../src/systems/BattleState.js', import.meta.url), 'utf8');
ok('the cast event names its skill (skillId) for the sound', /type: 'cast',[^}]*skillId: slot\.id/.test(bs));
