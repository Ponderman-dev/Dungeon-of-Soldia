// Run stats for the game-over summary (no Phaser): per hero damage dealt, healing, damage taken, kills, the floor
// they fell on and who felled them; every boss beaten (floor, time to beat). Counted from BattleState's events
// (countEvents, once per update), then packed into a plain summary when the run ends (finishRun).
// Minions count for their holder. Healing = heals that name a healer (skills, items) or land on the hero themself
// (lifesteal, item heals); slow regen over time is not counted.

export function newRunStats(heroUnits) {
  const heroes = {};
  for (const h of heroUnits) heroes[h.uid] = { uid: h.uid, id: h.def.id, name: h.def.name, damage: 0, healing: 0, taken: 0, kills: 0, fellFloor: null, killer: null, lastHitBy: null };
  return { heroes, bosses: [] };
}

// The hero record a unit counts for (a minion: its holder's), or null for enemies.
function heroOf(rs, unit) {
  if (!unit) return null;
  return rs.heroes[unit.minion ? unit.holderUid : unit.uid] || null;
}
const isHero = (u) => u && u.side === 'hero' && !u.minion;
const isEnemy = (u) => u && u.side === 'enemy';
const who = (u) => ({ id: u.def.id, name: u.def.name });

// Adds one update's events. `floor` = the floor being fought, `floorMs` = time into it (a boss's beat time).
export function countEvents(rs, events, { floor = 0, floorMs = 0 } = {}) {
  for (const e of events) {
    if (e.type === 'attack') {
      const r = e.result;
      if (!r || r.dodged || r.invulnerable || !(r.amount > 0)) continue;
      if (isEnemy(e.target)) { const h = heroOf(rs, e.attacker); if (h) h.damage += r.amount; }
      if (isHero(e.target)) {
        rs.heroes[e.target.uid].taken += Math.max(0, r.amount - (r.absorbed || 0));
        if (isEnemy(e.attacker)) rs.heroes[e.target.uid].lastHitBy = who(e.attacker);
      }
    } else if (e.type === 'dot') {
      if (!(e.amount > 0)) continue;
      if (isEnemy(e.unit)) for (const [uid, part] of Object.entries(e.shares || {})) { const h = rs.heroes[uid]; if (h) h.damage += e.amount * part; }
      if (isHero(e.unit)) rs.heroes[e.unit.uid].taken += e.amount;
    } else if (e.type === 'thorns') {
      if (!(e.amount > 0)) continue;
      if (isEnemy(e.unit)) { const h = heroOf(rs, e.holder); if (h) h.damage += e.amount; }
      if (isHero(e.unit)) rs.heroes[e.unit.uid].taken += e.amount;
    } else if (e.type === 'heal') {
      if (!(e.amount > 0) || !e.unit || e.unit.side !== 'hero') continue;
      const h = heroOf(rs, e.by || e.unit);
      if (h) h.healing += e.amount;
    } else if (e.type === 'death') {
      if (e.vanish) continue;
      if (isEnemy(e.unit)) {
        const h = heroOf(rs, e.killer);
        if (h) h.kills += 1;
        if (e.unit.def.boss) rs.bosses.push({ id: e.unit.def.id, name: e.unit.def.name, floor, ms: Math.round(floorMs) });
      } else if (isHero(e.unit)) {
        const h = rs.heroes[e.unit.uid];
        h.fellFloor = floor;
        h.killer = isEnemy(e.killer) ? who(e.killer) : h.lastHitBy;
      }
    }
  }
  return rs;
}

// The summary the game-over screen shows (plain data). heroUnits = the run's heroes (their items at the end);
// bossFloors = the dungeon's boss floors (the next one after `floor` is shown); bestBefore = best floor before this run.
export function finishRun(rs, heroUnits, { floor, kills, ms, bestBefore = 0, bossFloors = [] }) {
  const heroes = heroUnits.map((u) => {
    const h = rs.heroes[u.uid];
    return {
      id: h.id, name: h.name,
      damage: Math.round(h.damage), healing: Math.round(h.healing), taken: Math.round(h.taken), kills: h.kills,
      fellFloor: h.fellFloor ?? floor, killer: h.killer,
      items: [...new Set(u.items || [])],
    };
  });
  const items = [];
  for (const h of heroes) for (const id of h.items) {
    const it = items.find((x) => x.id === id);
    if (it) it.heldBy.push(h.name);
    else items.push({ id, heldBy: [h.name] });
  }
  const next = bossFloors.map(Number).filter((f) => f > floor).sort((a, b) => a - b)[0] || null;
  return {
    floor, kills, ms: Math.round(ms),
    newBest: floor > bestBefore, oldBest: bestBefore,
    heroes, bosses: rs.bosses.slice(), items, nextBoss: next,
  };
}

// 24:13 / 1:02:09 (a run's or a boss fight's time).
export function clockText(ms) {
  const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const two = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}
