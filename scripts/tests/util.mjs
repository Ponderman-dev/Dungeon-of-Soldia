// Item/skill tests check one mechanic at a time, so they use the ORIGINAL four heroes (Knight,
// Berserker, Rogue, Archer) without party perks or passives, each with its old plain test skills
// (Shield Bash / Guard, Cleave / Rage, Venom Strike / Smoke, Power Shot / Eagle Focus, all still in
// skills.json) so these tests don't change when a hero is redesigned. Real heroes are tested in
// their own files (knight, rogue, ... .test.mjs).
const TEST_SKILLS = {
  knight: { attack: 'shield_bash', support: 'guard' },
  berserker: { attack: 'cleave', support: 'rage' },
  rogue: { attack: 'venom_strike', support: 'smoke' },
  archer: { attack: 'power_shot', support: 'eagle_focus' },
};
export const noPerks = (defs) => defs.filter((h) => TEST_SKILLS[h.id]).map((h) => ({ ...h, perk: undefined, passive: undefined, skills: TEST_SKILLS[h.id] }));

// The FIRST hero kits (passive + skills, before the v2 rework) are frozen in fixtures/heroes-v1-kits.json.
// Mechanic tests that were written with them (channels, cleanse, knockback, counters...) keep using them.
import fs from 'fs';
const V1 = JSON.parse(fs.readFileSync(new URL('./fixtures/heroes-v1-kits.json', import.meta.url), 'utf8'));
export const kitsV1 = (defs) => defs.map((h) => (V1[h.id] ? { ...h, passive: V1[h.id].passive, skills: V1[h.id].skills } : h));

// Item MECHANIC tests use a FROZEN copy of items.json (fixtures/items-frozen.json, taken in session 5), so tuning
// item numbers in src/data/items.json never breaks them. Copy an item into the fixture only when it is NEW or its
// effect SHAPE changes (then test the new mechanic). Data checks (icons, texts, drop odds) read the real file.
export const frozenItems = () => JSON.parse(fs.readFileSync(new URL('./fixtures/items-frozen.json', import.meta.url), 'utf8'));
// combat.json without the hero toughness tuning (heroDefense bonus, deathSave), for tests that check exact
// defense numbers or killing blows of other mechanics.
export const plainRules = (rules) => ({ ...rules, heroDefense: { percent: 0 }, heroAttack: { percent: 0 }, deathSave: null });
