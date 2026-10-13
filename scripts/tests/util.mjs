// Item/skill tests check one mechanic at a time, so they use heroes without party perks or passives.
// The Knight is also given the old Shield Bash / Guard skills (still in skills.json as plain test skills)
// so those tests don't change when a hero is redesigned (the real Knight: knight.test.mjs).
export const noPerks = (defs) => defs.map((h) => ({ ...h, perk: undefined, passive: undefined, ...(h.id === 'knight' ? { skills: { attack: 'shield_bash', support: 'guard' } } : {}) }));
