// Flask Barrage's glass-break sound plays when each flask LANDS, not at the cast (user, session 51).
// The cast skips a sound marked `atHit` in sounds.json; every flask event carries its skill id so the scene can play it at the hit.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { loadItems } from '../../src/systems/items.js';
import { frozenItems } from './util.mjs';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log(cond ? 'PASS' : 'FAIL', name, extra); };
const rules = { ...r('combat.json'), skillWindUp: { defaultCastMs: 0 } };
const heroes = r('heroes.json');
const skills = Object.fromEntries(Object.entries(r('skills.json')).map(([k, v]) => [k, { ...v, castMs: 0 }]));
const sounds = r('sounds.json');

ok('Flask Barrage sound is marked atHit', !!sounds.cues.skill_alch_barrage?.atHit);

const s = new BattleState({ heroDefs: [{ ...heroes.find((h) => h.id === 'alchemist'), perk: undefined }], enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs: loadItems(frozenItems()), skillDefs: skills, statusDefs: r('statuses.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng: () => 0.5 });
const es = s.spawnEnemies(['goblin', 'goblin'], 1);
for (const u of [...s.heroes, ...es]) u.hp = u.maxHp = 100000;
s.placeLines();
const a = s.heroes[0];
const ev = s.castSkill(a.uid, a.skills.findIndex((x) => x.kind === 'attack')) || [];
const all = [...ev];
for (let i = 0; i < 40; i++) all.push(...(s.update(100) || []));
const flasks = all.filter((e) => e.type === 'flask' && e.unit === a);
ok('Flask Barrage throws flasks', flasks.length > 0, `(${flasks.length})`);
ok('every flask event carries skillId alch_barrage', flasks.length > 0 && flasks.every((e) => e.skillId === 'alch_barrage'));
const cast = all.find((e) => e.type === 'cast' && e.unit === a);
ok('the cast event names the skill', cast && cast.skillId === 'alch_barrage');
if (fails) process.exit(1);
