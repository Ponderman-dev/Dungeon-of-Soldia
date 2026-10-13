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
