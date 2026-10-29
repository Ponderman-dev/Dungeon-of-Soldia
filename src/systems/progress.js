// Saved progress and hero unlocks (no Phaser here). Stored in the browser's localStorage, which also
// works inside Capacitor. Every storage call is wrapped, so a blocked/full storage never breaks the game.

export const SAVE_KEY = 'dungeon-of-soldia-save-v1';

export function emptyProgress() {
  return {
    version: 1,
    stats: { bestFloor: 0, totalKills: 0, totalFloors: 0, runs: 0, bossesBeaten: 0, bossIds: [], playMs: 0, itemsFound: 0, heroRuns: {}, deaths: 0, heroRecords: {} },
    profile: {}, // name, profile hero, banner (ProfileScene; defaults in profile.json)
    achievements: [], // ids earned (systems/achievements.js)
    seen: { met: [], beaten: {}, statuses: [], items: [] }, // the Glossary's memory (systems/glossary.js)
    seenUnlocked: [], // heroes the player has already seen unlocked on the squad screen (for the NEW badge)
    unlockAll: false, // the "unlock every hero" toggle
    lastSquad: null,
    settings: { muted: false }, // player settings: sound on/off + the Settings screen's (systems/settings.js)
  };
}

// The browser storage, or null if there is none / it is blocked.
function defaultStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadProgress(storage = defaultStorage()) {
  const fresh = emptyProgress();
  try {
    const raw = storage && storage.getItem(SAVE_KEY);
    if (!raw) return fresh;
    const data = JSON.parse(raw);
    return {
      ...fresh,
      ...data,
      stats: { ...fresh.stats, ...(data && data.stats) },
      seenUnlocked: Array.isArray(data && data.seenUnlocked) ? data.seenUnlocked : [],
      profile: { ...((data && data.profile) || {}) },
      achievements: Array.isArray(data && data.achievements) ? data.achievements : [],
      seen: { ...fresh.seen, ...((data && data.seen) || {}) },
      settings: { ...fresh.settings, ...(data && data.settings) },
    };
  } catch {
    return fresh; // damaged save: start over instead of crashing
  }
}

export function saveProgress(progress, storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(SAVE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

// DELETE SAVE (Settings): the save is wiped; the next load is a new player.
export function deleteProgress(storage = defaultStorage()) {
  try {
    if (!storage) return false;
    if (storage.removeItem) storage.removeItem(SAVE_KEY);
    else storage.setItem(SAVE_KEY, '');
    return true;
  } catch {
    return false;
  }
}

// A run is over: add its results to the saved stats. `floor` is the floor the squad died on (reaching a
// floor counts), `kills` the enemies killed in the run. Optional (the Profile's stats): `ms` run time, `bosses` the
// boss ids beaten, `items` item copies held at the end, `heroes` the squad's hero ids (each fell = one death).
export function recordRun(progress, { floor, kills, ms = 0, bosses = [], items = 0, heroes = [], heroStats = [] }) {
  const s = progress.stats;
  s.runs += 1;
  s.totalKills += kills || 0;
  s.totalFloors += Math.max(0, floor - 1); // floors CLEARED (the last one was lost)
  s.bestFloor = Math.max(s.bestFloor, floor);
  s.playMs = (s.playMs || 0) + ms;
  s.bossesBeaten = (s.bossesBeaten || 0) + bosses.length;
  s.bossIds = [...new Set([...(s.bossIds || []), ...bosses])];
  s.itemsFound = (s.itemsFound || 0) + items;
  s.deaths = (s.deaths || 0) + heroes.length;
  s.heroRuns = { ...(s.heroRuns || {}) };
  for (const id of heroes) s.heroRuns[id] = (s.heroRuns[id] || 0) + 1;
  // Per-hero records (Heroes page STATS): heroStats = the run summary's heroes (runStats.js finishRun).
  s.heroRecords = { ...(s.heroRecords || {}) };
  for (const h of heroStats) {
    const r = { runs: 0, bestFloor: 0, kills: 0, damage: 0, healing: 0, deaths: 0, ...s.heroRecords[h.id] };
    r.runs += 1;
    r.bestFloor = Math.max(r.bestFloor, h.fellFloor || 0);
    r.kills += h.kills || 0;
    r.damage += h.damage || 0;
    r.healing += h.healing || 0;
    r.deaths += 1;
    s.heroRecords[h.id] = r;
  }
  return progress;
}

// The hero played in the most runs (null before the first run).
export function topHero(progress) {
  const runs = progress.stats.heroRuns || {};
  return Object.keys(runs).sort((a, b) => runs[b] - runs[a])[0] || null;
}

// How far along a requirement is: { have, need, done }.
export function requirementProgress(req, progress) {
  const have = {
    bestFloor: progress.stats.bestFloor,
    totalKills: progress.stats.totalKills,
    totalFloors: progress.stats.totalFloors,
    runs: progress.stats.runs,
  }[req.type] || 0;
  return { have, need: req.value, done: have >= req.value };
}

export function isUnlocked(heroId, progress, unlocks) {
  if (progress.unlockAll) return true;
  if (unlocks.start.includes(heroId)) return true;
  const req = unlocks.requirements[heroId];
  return req ? requirementProgress(req, progress).done : true; // a hero with no requirement is never locked away
}

export function unlockedIds(heroDefs, progress, unlocks) {
  return heroDefs.filter((h) => isUnlocked(h.id, progress, unlocks)).map((h) => h.id);
}

// Heroes that are unlocked but the player has not seen unlocked yet (for the NEW badge). Starting heroes never count.
export function newHeroes(heroDefs, progress, unlocks) {
  return unlockedIds(heroDefs, progress, unlocks).filter((id) => !unlocks.start.includes(id) && !progress.seenUnlocked.includes(id));
}

// "Reach floor 15" and "best floor 9 / 15".
export function describeRequirement(req, unlocks) {
  return unlocks.labels[req.type].replace('{value}', req.value);
}
export function describeProgress(req, progress, unlocks) {
  const p = requirementProgress(req, progress);
  return `${Math.min(p.have, p.need)} / ${p.need} ${unlocks.statNames[req.type]}`;
}

// Three different random heroes from the given ids (the RANDOM button).
export function randomSquad(ids, count = 3, rng = Math.random) {
  const pool = [...ids];
  const out = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}
