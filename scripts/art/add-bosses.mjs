// One-off: writes the 8 bosses (and their helpers) into enemies.json, the boss floors into dungeons.json and
// the boss statuses into statuses.json. Sprites come from scripts/art/boss-sprites.mjs.
import fs from 'fs';
import { designToParts } from './boss-sprites.mjs';
const read = (f) => JSON.parse(fs.readFileSync(`src/data/${f}.json`, 'utf8'));
const write = (f, d) => fs.writeFileSync(`src/data/${f}.json`, JSON.stringify(d, null, 2) + '\n');
const E = read('enemies');
const M = read('minions');
const look = (key) => designToParts(key);
const boss = (name, key, rest) => ({ name, boss: true, statusDurationScale: 0.5, weak: [], resists: [], flying: false, ...look(key), ...rest });
const burn = (ms, mult) => ({ status: 'burn', durationMs: ms, damageMultiplier: mult, damageType: 'fire' });

// ---- helpers
E.war_drum = { name: 'War Drum', object: true, damageType: 'melee', weak: [], resists: [], xp: 20, ...look('drum'),
  stats: { health: 380, attack: 0, defense: 4, attackEfficiency: 100 },
  aura: { ids: ['goblin', 'grukk'], attackSpeedPercent: 30 },
  abilities: [{ id: 'beat', name: 'War Beat', everyMs: 8000, firstMs: 3000, castMs: 0, summon: { id: 'goblin', count: 1, max: 3 } }] };
E.egg_sac = { name: 'Egg Sac', object: true, damageType: 'melee', weak: ['fire'], resists: [], xp: 2, ...look('egg'),
  stats: { health: 45, attack: 0, defense: 0, attackEfficiency: 100 }, hatch: { afterMs: 6000, into: 'spiderling', count: 3 } };
E.spiderling = { ...E.spider, name: 'Spiderling', xp: 3, drawScale: 2, stats: { health: 40, attack: 3, defense: 0, attackEfficiency: 140 } };
E.phylactery = { name: 'Phylactery', object: true, damageType: 'melee', weak: ['physical'], resists: ['magical'], xp: 0, ...look('phylactery'),
  stats: { health: 100, attack: 0, defense: 0, attackEfficiency: 100 } };
E.risen_skeleton = { name: 'Risen Skeleton', damageType: 'melee', flying: false, weak: ['holy'], resists: [], xp: 4, height: M.skeleton.height, parts: M.skeleton.parts,
  stats: { health: 90, attack: 5, defense: 2, attackEfficiency: 100 } };

// ---- bosses
E.grukk = boss('Grukk the War Drum', 'grukk', { damageType: 'melee', xp: 150,
  stats: { health: 1300, attack: 9, defense: 8, attackEfficiency: 80 },
  abilities: [
    { id: 'cleaver_charge', name: 'Cleaver Charge', everyMs: 9000, firstMs: 5000, castMs: 1200, target: 'backHero', damageMultiplier: 1.8, apply: [{ status: 'knockback' }] },
    { id: 'rally_shout', name: 'Rally Shout', hpBelow: 50, castMs: 800, target: 'allies', healAllies: 20 },
  ] });
E.brood_mother = boss('The Brood Mother', 'brood', { damageType: 'melee', xp: 180, weak: ['fire'],
  stats: { health: 1500, attack: 8, defense: 4, attackEfficiency: 90 },
  onHit: [{ status: 'poison', chance: 100, durationMs: 5000, damageMultiplier: 0.2, damageType: 'dark', stacks: 2 }],
  abilities: [
    { id: 'lay_eggs', name: 'Lay Eggs', everyMs: 10000, firstMs: 4000, castMs: 600, summon: { id: 'egg_sac', count: 2, max: 4, near: true } },
    { id: 'web_spit', name: 'Web Spit', everyMs: 8000, firstMs: 6500, castMs: 800, target: 'randomHero', apply: [{ status: 'webbed', durationMs: 3000 }] },
  ] });
E.frost_warden = boss('The Frost Warden', 'warden', { damageType: 'melee', xp: 200, weak: ['fire'], resists: ['ice'],
  stats: { health: 2000, attack: 9, defense: 15, resist: 10, attackEfficiency: 70 },
  statusImmune: ['chill', 'freeze'],
  plates: { count: 3, cutPercent: 70, plateHpPercent: 10, fireMultiplier: 3 },
  abilities: [
    { id: 'blizzard', name: 'Blizzard', everyMs: 14000, firstMs: 7000, castMs: 900, channel: { intervalMs: 500, ticks: 6, target: 'allHeroes', apply: [{ status: 'chill', durationMs: 5000, stacks: 1 }] } },
    { id: 'ice_slam', name: 'Ice Slam', everyMs: 7000, firstMs: 3500, castMs: 600, target: 'frontHero', damageMultiplier: 1.5, damageType: 'ice', apply: [{ status: 'chill', durationMs: 5000, stacks: 2 }] },
  ] });
const enrage = [{ stat: 'attack', percent: 60 }, { stat: 'attackEfficiency', percent: 40 }];
E.rask = boss('Rask the Bandit King', 'rask', { damageType: 'melee', xp: 120,
  stats: { health: 1500, attack: 10, defense: 10, attackEfficiency: 85 },
  link: { partner: 'vesh', enrage, reviveMs: 8000, revivePercent: 30 },
  abilities: [
    { id: 'shoulder_bash', name: 'Shoulder Bash', everyMs: 8000, firstMs: 4000, castMs: 600, target: 'frontHero', damageMultiplier: 1.2, apply: [{ status: 'stun', durationMs: 1000 }] },
    { id: 'switch', name: 'Switch!', everyMs: 15000, firstMs: 12000, castMs: 0, swap: 'vesh' },
  ] });
E.vesh = boss('Vesh the Bandit Queen', 'vesh', { damageType: 'ranged', xp: 120,
  stats: { health: 1100, attack: 9, defense: 5, evasion: 10, attackEfficiency: 100 },
  link: { partner: 'rask', enrage, reviveMs: 8000, revivePercent: 30 },
  abilities: [
    { id: 'smoke_daggers', name: 'Smoke & Daggers', everyMs: 11000, firstMs: 6000, castMs: 700, target: 'allHeroes', apply: [{ status: 'blind', durationMs: 3000 }], daggers: { count: 5, damageMultiplier: 0.5, apply: [{ status: 'bleed', durationMs: 4000, damageMultiplier: 0.2 }] } },
  ] });
E.morthul = boss('Morthul the Bone Archon', 'morthul', { damageType: 'dark', xp: 260, weak: ['holy'], resists: ['dark'],
  stats: { health: 2400, attack: 10, defense: 5, resist: 25, attackEfficiency: 80 },
  phylactery: { id: 'phylactery', hpPercent: 15, reformMs: 10000, reformPercent: 50, toughen: 1.5 },
  abilities: [
    { id: 'raise_dead', name: 'Raise Dead', everyMs: 12000, firstMs: 4000, castMs: 800, summon: { id: 'risen_skeleton', count: 2, max: 4 } },
    { id: 'soul_drain', name: 'Soul Drain', everyMs: 10000, firstMs: 7000, castMs: 600, channel: { intervalMs: 500, ticks: 6, target: 'lowestHero', drain: { percentMaxHp: 4 } } },
    { id: 'curse_wave', name: 'Curse Wave', everyMs: 13000, firstMs: 9500, castMs: 700, target: 'allHeroes', apply: [{ status: 'curse', durationMs: 6000 }] },
  ] });
E.ignatius = boss('Ignatius the Forge Heart', 'ignatius', { damageType: 'melee', xp: 300, weak: ['ice'], resists: ['fire'],
  stats: { health: 2800, attack: 11, defense: 12, resist: 10, attackEfficiency: 75 },
  heat: { max: 100, perSec: 5, perFireHit: 6, perIceHit: -8, freezeDrop: 30, chillDrop: 6, eruption: { damageMultiplier: 2.2, damageType: 'fire', apply: [burn(4000, 0.4)] } },
  abilities: [
    { id: 'slag_hammer', name: 'Slag Hammer', everyMs: 8000, firstMs: 4000, castMs: 600, target: 'frontHero', damageMultiplier: 1.3, apply: [{ status: 'armorBreak', durationMs: 6000 }] },
    { id: 'molten_ground', name: 'Molten Ground', everyMs: 6000, firstMs: 6000, castMs: 0, target: 'meleeNear', radius: 110, apply: [burn(4000, 0.3)] },
  ] });
E.sela = boss('Sela the Mirror Witch', 'sela', { damageType: 'ice', xp: 320, weak: ['electric'], resists: ['ice'],
  stats: { health: 2300, attack: 10, defense: 6, resist: 15, attackEfficiency: 85 },
  mirror: { atStart: true, atHp: [50], statPercent: 40 },
  abilities: [
    { id: 'mirror_ward', name: 'Mirror Ward', everyMs: 12000, firstMs: 5000, castMs: 0, target: 'self', apply: [{ status: 'reflect', durationMs: 3000 }] },
    { id: 'shatter', name: 'Shatter', everyMs: 16000, firstMs: 12000, castMs: 900, shatterClones: { multiplier: 1.5 } },
    { id: 'glass_prison', name: 'Glass Prison', everyMs: 10000, firstMs: 8000, castMs: 600, target: 'randomHero', apply: [{ status: 'silence', durationMs: 4000 }] },
  ] });
E.vharox = boss('Vharox the Storm Wyrm', 'vharox', { damageType: 'electric', xp: 400, flying: true, hover: 10, weak: ['ice'], resists: ['electric'],
  stats: { health: 3400, attack: 12, defense: 10, resist: 10, attackEfficiency: 80 },
  sky: { atHp: [75, 50, 25], durationMs: 8000, strikeEveryMs: 1000, strike: { damageMultiplier: 0.6, damageType: 'electric', apply: [{ status: 'shock', durationMs: 3000 }] }, summon: { id: 'stormSprite', count: 3 }, groundedMs: 3000, vulnerablePercent: 25 },
  abilities: [
    { id: 'thunder_breath', name: 'Thunder Breath', everyMs: 10000, firstMs: 5000, castMs: 900, target: 'allHeroes', damageMultiplier: 0.8, damageType: 'electric' },
    { id: 'static_field', name: 'Static Field', everyMs: 14000, firstMs: 9000, castMs: 600, target: 'allHeroes', apply: [{ status: 'shock', durationMs: 5000 }] },
  ] });
write('enemies', E);

const D = read('dungeons');
D.A.bosses = { 20: ['grukk', 'war_drum'], 40: ['brood_mother'], 60: ['frost_warden'], 80: ['rask', 'vesh'], 100: ['morthul'], 120: ['ignatius'], 140: ['sela'], 160: ['vharox'] };
D.A._bosses = 'A boss every 20 floors (user\'s choice). bosses: floor -> the fight (bosses.js reads their abilities from enemies.json).';
write('dungeons', D);

const S = read('statuses');
S.webbed = { label: 'WEBBED', color: '#e9e0f0', textColor: '#000000', control: true, debuff: true };
S.reflect = { popup: false, label: 'MIRROR', color: '#a8e8ff', textColor: '#000000' };
S.airborne = { popup: false, label: 'SKY', color: '#7ab0ff', textColor: '#000000' };
write('statuses', S);
console.log('done');
