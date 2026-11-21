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
    gems: 0, // Shop currency (paid packs later)
    looks: [], // looks bought in the Shop (shop.json ids)
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
  try {
    const raw = storage && storage.getItem(SAVE_KEY);
    return raw ? cleanProgress(JSON.parse(raw)) : emptyProgress();
  } catch {
    return emptyProgress(); // damaged save: start over instead of crashing
  }
}

// A save read back from storage can be old, damaged or edited by hand: keep every field the right type and in range
// (wrong ones fall back to the new-player value), so no screen can crash on it. NOTE for a future server / wallet:
// anyone can still edit their own numbers (gems, best floor, unlocks), so a server must re-check those itself.
const MAX_COUNT = 1e12; // no saved counter goes above this
const count = (v) => (Number.isFinite(v) && v > 0 ? Math.min(Math.floor(v), MAX_COUNT) : 0);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string'))] : []);
const counts = (v) => Object.fromEntries(Object.entries(isObj(v) ? v : {}).map(([k, n]) => [k, count(n)]));

export function cleanProgress(data) {
  const fresh = emptyProgress();
  if (!isObj(data)) return fresh;
  const st = isObj(data.stats) ? data.stats : {};
  const stats = { ...fresh.stats };
  for (const k of Object.keys(fresh.stats)) if (typeof fresh.stats[k] === 'number') stats[k] = count(st[k]);
  stats.bossIds = strings(st.bossIds);
  stats.heroRuns = counts(st.heroRuns);
  stats.heroRecords = {};
  for (const [id, r] of Object.entries(isObj(st.heroRecords) ? st.heroRecords : {})) if (isObj(r)) stats.heroRecords[id] = counts(r);
  const seen = isObj(data.seen) ? data.seen : {};
  const profile = {};
  for (const [k, v] of Object.entries(isObj(data.profile) ? data.profile : {})) if (typeof v === 'string') profile[k] = v.slice(0, 40);
  const settings = { ...fresh.settings };
  for (const [k, v] of Object.entries(isObj(data.settings) ? data.settings : {})) if (['number', 'boolean', 'string'].includes(typeof v)) settings[k] = v;
  if (typeof settings.muted !== 'boolean') settings.muted = false;
  const squad = strings(data.lastSquad);
  return {
    ...fresh,
    stats,
    profile,
    achievements: strings(data.achievements),
    seen: { met: strings(seen.met), beaten: counts(seen.beaten), statuses: strings(seen.statuses), items: strings(seen.items) },
    gems: count(data.gems),
    looks: strings(data.looks),
    seenUnlocked: strings(data.seenUnlocked),
    unlockAll: data.unlockAll === true,
    lastSquad: squad.length ? squad.slice(0, 3) : null,
    settings,
  };
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

// A locked hero's goal in two short lines (unlocks.json short): ['FLOOR', '5'], ['100', 'KILLS'].
export function shortGoal(req, unlocks) {
  return unlocks.short[req.type].map((t) => t.replace('{value}', req.value));
}
// The locked hero closest to unlocking (the biggest share of its goal done; ties: the earlier hero). null = none locked.
export function nextUnlock(heroDefs, progress, unlocks) {
  let best = null, bestShare = -1;
  for (const h of heroDefs) {
    const req = unlocks.requirements[h.id];
    if (!req || isUnlocked(h.id, progress, unlocks)) continue;
    const p = requirementProgress(req, progress), share = p.have / p.need;
    if (share > bestShare) { best = h.id; bestShare = share; }
  }
  return best;
}

// Three different random heroes from the given ids (the RANDOM button).
export function randomSquad(ids, count = 3, rng = Math.random) {
  const pool = [...ids];
  const out = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}
