// Item/skill tests check one mechanic at a time, so they use heroes without party perks.
export const noPerks = (defs) => defs.map((h) => ({ ...h, perk: undefined }));
