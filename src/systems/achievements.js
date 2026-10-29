// Achievements (no Phaser): checked when a run ends, after its results are saved (progress.recordRun).
// The list is data (profile.json achievements); each `when` is one of:
//   { stat, value }  a lifetime number (progress.stats, or heroesUnlocked) reaches value
//   { boss: [ids] }  every listed boss was beaten at least once
//   { run, value }   something in THIS run (summary from systems/runStats.js finishRun): legendaryItem, itemKinds,
//                    heroDamage, heroHealing (one hero), allReach (every hero lived to floor value)

// True when achievement `a` is met. ctx = { heroesUnlocked, summary (this run, or null), itemDefs }.
export function isMet(a, progress, ctx = {}) {
  const w = a.when, s = progress.stats;
  if (w.stat) return (w.stat === 'heroesUnlocked' ? ctx.heroesUnlocked || 0 : s[w.stat] || 0) >= w.value;
  if (w.boss) return w.boss.every((id) => (s.bossIds || []).includes(id));
  const run = ctx.summary;
  if (!w.run || !run) return false;
  const heroes = run.heroes || [];
  if (w.run === 'legendaryItem') return (run.items || []).some((it) => ctx.itemDefs && ctx.itemDefs[it.id] && ctx.itemDefs[it.id].rarity === 'legendary');
  if (w.run === 'itemKinds') return (run.items || []).length >= w.value;
  if (w.run === 'heroDamage') return heroes.some((h) => h.damage >= w.value);
  if (w.run === 'heroHealing') return heroes.some((h) => h.healing >= w.value);
  if (w.run === 'allReach') return heroes.length > 0 && heroes.every((h) => h.fellFloor >= w.value);
  return false;
}

// Marks every newly met achievement as earned (progress.achievements) and returns their ids.
export function checkAchievements(progress, list, ctx = {}) {
  progress.achievements = progress.achievements || [];
  const fresh = list.filter((a) => !progress.achievements.includes(a.id) && isMet(a, progress, ctx)).map((a) => a.id);
  progress.achievements.push(...fresh);
  return fresh;
}

// Banners the player may pick: those with no unlock, or whose achievement is earned.
export function openBanners(progress, banners) {
  return banners.filter((b) => !b.unlock || (progress.achievements || []).includes(b.unlock)).map((b) => b.id);
}
