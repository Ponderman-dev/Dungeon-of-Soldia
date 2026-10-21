// Speech bubbles (purely for show, no effect on the fight): which hero says which line at the start of a run and after
// a cleared floor. Lines live in data/dialogue.json; the scene only draws the bubble (BattleScene.sayLine).

// Picks a speaker and a line. kind = 'start' | 'clear' | 'boss' | 'fallen' | 'hurt' | 'close'. `heroes` = the squad
// (living ones speak), `memory` = an object kept for the whole run (last speaker, lines already said) so lines and speakers don't repeat.
// Returns { uid, text } or null (nobody alive, the chance roll missed, or no lines).
export function pickSpeech(data, heroes, kind, rng = Math.random, memory = {}) {
  const chance = data.rules.chance[kind] ?? 1;
  if (rng() >= chance) return null;
  const linesOf = (h) => {
    const set = data.heroes[h.def.id] || {};
    return set[kind] && set[kind].length ? set[kind] : set.clear || [];
  };
  const speakers = heroes.filter((h) => h.alive && linesOf(h).length);
  if (!speakers.length) return null;
  // A different hero than last time when there is one.
  const pool = speakers.length > 1 ? speakers.filter((h) => h.uid !== memory.lastUid) : speakers;
  const hero = pool[Math.floor(rng() * pool.length)];
  // Each hero goes through all its lines of a kind before one comes back.
  const lines = linesOf(hero);
  memory.said = memory.said || {};
  const key = `${hero.def.id}:${kind}`;
  let said = memory.said[key] || [];
  if (said.length >= lines.length) said = [];
  const fresh = lines.filter((l) => !said.includes(l));
  const text = fresh[Math.floor(rng() * fresh.length)];
  memory.said[key] = [...said, text];
  memory.lastUid = hero.uid;
  return { uid: hero.uid, text };
}

// The line after a cleared floor: { kind, heroes } (the heroes who may speak). A boss beats a fallen friend, a fallen
// friend beats a close call. A close call (a hero at or below rules.closePercent health) or a hurt hero (at or below
// rules.hurtPercent) says it themselves; the lowest one speaks. Health is read BEFORE the win heal.
export function clearSpeech(data, heroes, { bossFloor, someoneFell }) {
  const alive = heroes.filter((h) => h.alive);
  if (bossFloor) return { kind: 'boss', heroes: alive };
  if (someoneFell) return { kind: 'fallen', heroes: alive };
  const pct = (h) => (100 * h.hp) / h.maxHp;
  const lowest = alive.slice().sort((a, b) => pct(a) - pct(b))[0];
  if (lowest && pct(lowest) <= data.rules.closePercent) return { kind: 'close', heroes: [lowest] };
  if (lowest && pct(lowest) <= data.rules.hurtPercent) return { kind: 'hurt', heroes: [lowest] };
  return { kind: 'clear', heroes: alive };
}
