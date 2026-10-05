// Every hero has one attack skill (slot 0) and one support skill (slot 1).
import fs from 'fs';
import { noPerks } from './util.mjs';
import BattleState, { SKILL_SLOTS } from '../../src/systems/BattleState.js';
import { validateHeroSkills } from '../../src/systems/validate.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);

const heroDefs = r('heroes.json'), skillDefs = r('skills.json');
const problems = validateHeroSkills(heroDefs, skillDefs);
ok('every hero has a valid attack + support skill', problems.length === 0, problems.join('; '));
ok('every skill has a kind', Object.values(skillDefs).every((s) => s.kind === 'attack' || s.kind === 'support'));

const s = new BattleState({ heroDefs: noPerks(heroDefs), enemyDefs: r('enemies.json'), itemDefs: {}, skillDefs, rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
ok('slot order is attack, support', SKILL_SLOTS.join() === 'attack,support');
ok('each hero gets 2 slots in that order', s.heroes.every((h) => h.skills.length === 2 && h.skills[0].kind === 'attack' && h.skills[1].kind === 'support'));
ok('slot ids come from heroes.json', s.heroes.every((h, i) => h.skills[0].id === heroDefs[i].skills.attack && h.skills[1].id === heroDefs[i].skills.support));

// The checker catches mistakes.
const bad = [{ name: 'Bad', skills: { attack: 'guard', support: 'nope' } }];
ok('checker spots wrong kind and unknown skill', validateHeroSkills(bad, skillDefs).length === 2);
