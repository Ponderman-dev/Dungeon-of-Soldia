// Achievements, banners and the Profile's lifetime stats (systems/achievements.js, progress.js recordRun, profile.json).
import fs from 'fs';
import { isMet, checkAchievements, openBanners } from '../../src/systems/achievements.js';
import { emptyProgress, recordRun, topHero, loadProgress, saveProgress } from '../../src/systems/progress.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const D = r('profile.json'), items = r('items.json'), heroes = r('heroes.json'), enemies = r('enemies.json'), title = r('title.json');
const ach = (id) => D.achievements.find((a) => a.id === id);

ok('achievement ids are unique', new Set(D.achievements.map((a) => a.id)).size === D.achievements.length);
ok('every medal icon is a real item icon', D.achievements.every((a) => items[a.icon]), D.achievements.filter((a) => !items[a.icon]).map((a) => a.icon).join());
ok('every boss achievement names real bosses', D.achievements.filter((a) => a.when.boss).every((a) => a.when.boss.every((id) => enemies[id] && enemies[id].boss)));
ok('medal labels fit their box (9 letters at most)', D.achievements.every((a) => a.label.length <= 9));
ok('every banner unlock is an achievement', D.banners.every((b) => !b.unlock || ach(b.unlock)));
ok('the default banner and hero are free from the start', !D.banners.find((b) => b.id === D.defaults.banner).unlock && r('unlocks.json').start.includes(D.defaults.hero));
ok('every banner crop stays inside the title art', D.banners.every((b) => b.crop[0] >= 0 && b.crop[0] + D.layout.card.artW <= Math.ceil(390 / title.pixel) && b.crop[1] + D.layout.card.artH <= Math.ceil(844 / title.pixel)));
{ const p = emptyProgress();
  recordRun(p, { floor: 23, kills: 400, ms: 600000, bosses: ['grukk', 'war_drum'], items: 12, heroes: ['knight', 'cleric', 'mage'] });
  recordRun(p, { floor: 12, kills: 100, ms: 300000, bosses: [], items: 5, heroes: ['knight', 'rogue', 'archer'] });
  const s = p.stats;
  ok('a run adds play time, bosses, items found and deaths', s.playMs === 900000 && s.bossesBeaten === 2 && s.itemsFound === 17 && s.deaths === 6);
  ok('the bosses beaten are remembered once each', s.bossIds.join() === 'grukk,war_drum');
  ok('top hero = the hero played in the most runs', topHero(p) === 'knight');
  ok('old saves without the new stats still work', recordRun({ stats: { bestFloor: 3, totalKills: 1, totalFloors: 2, runs: 1 } }, { floor: 2, kills: 0 }).stats.runs === 2);
  const got = checkAchievements(p, D.achievements, { heroesUnlocked: 4 });
  ok('stat + boss achievements are earned at once', ['floor_10', 'first_boss', 'grukk'].every((id) => got.includes(id)) && !got.includes('floor_25'), got.join());
  ok('...and only once', checkAchievements(p, D.achievements, { heroesUnlocked: 4 }).length === 0);
  ok('a banner unlocks with its achievement', openBanners(p, D.banners).includes('moon') && !openBanners(p, D.banners).includes('stars'));
  const store = (() => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; })();
  saveProgress(p, store);
  ok('achievements and stats survive a save and load', loadProgress(store).achievements.length === p.achievements.length && loadProgress(store).stats.bossIds.length === 2); }
ok('Bandits needs BOTH Rask and Vesh', !isMet(ach('bandits'), { stats: { bossIds: ['rask'] } }) && isMet(ach('bandits'), { stats: { bossIds: ['vesh', 'rask'] } }));
{ const legendary = Object.keys(items).find((id) => items[id].rarity === 'legendary'), common = Object.keys(items).find((id) => items[id].rarity === 'common');
  const run = (over) => ({ heroes: [{ damage: 10, healing: 0, fellFloor: 25 }, { damage: 60000, healing: 25000, fellFloor: 21 }, { damage: 0, healing: 0, fellFloor: 30 }], items: [{ id: common }], ...over });
  const p = { stats: {} };
  ok('run: a legendary item held', isMet(ach('legendary'), p, { summary: run({ items: [{ id: legendary }] }), itemDefs: items }) && !isMet(ach('legendary'), p, { summary: run(), itemDefs: items }));
  ok('run: one hero 50 000 damage / 20 000 healing', isMet(ach('heavy_hitter'), p, { summary: run() }) && isMet(ach('medic'), p, { summary: run() }));
  ok('run: all 3 heroes reach floor 20 (lowest counts)', isMet(ach('together'), p, { summary: run() }) && !isMet(ach('together'), p, { summary: run({ heroes: [{ fellFloor: 19 }, { fellFloor: 40 }] }) }));
  ok('run achievements need a run', !isMet(ach('medic'), p, {})); }
ok('ROSTER = every hero unlocked', ach('all_heroes').when.value === heroes.length);
// Heroes page: per-hero records (progress.recordRun heroStats) and the page's data.
{ const p = emptyProgress(), hp = r('heroPage.json');
  recordRun(p, { floor: 30, kills: 50, heroes: ['knight', 'mage'], heroStats: [{ id: 'knight', fellFloor: 28, kills: 20, damage: 5000, healing: 10 }, { id: 'mage', fellFloor: 30, kills: 30, damage: 9000, healing: 0 }] });
  recordRun(p, { floor: 12, kills: 5, heroes: ['knight'], heroStats: [{ id: 'knight', fellFloor: 12, kills: 5, damage: 700, healing: 0 }] });
  const k = p.stats.heroRecords.knight;
  ok('hero records add up per hero; best floor = the best floor they lived to', k.runs === 2 && k.bestFloor === 28 && k.kills === 25 && k.damage === 5700 && k.deaths === 2 && p.stats.heroRecords.mage.runs === 1);
  ok('every hero has lore', heroes.every((h) => hp.lore[h.id]));
  ok('every unlock goal type has a short goal', Object.values(r('unlocks.json').requirements).every((q) => hp.shortGoals[q.type])); }
