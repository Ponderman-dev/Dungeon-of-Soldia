// Glossary memory (no Phaser): what the player has met. During a run the scene keeps a buffer (newSeenBuffer), fills
// it from BattleState's events (noteEvents) and folds it into the save (mergeSeen) at every floor clear and at the
// end of a run. Saved as progress.seen = { met: [enemy ids], beaten: { id: count }, statuses: [ids], items: [ids] }.

export function emptySeen() {
  return { met: [], beaten: {}, statuses: [], items: [] };
}

export function newSeenBuffer() {
  return { met: new Set(), beaten: {}, statuses: new Set(), items: new Set() };
}

// Enemies beaten (death events) and statuses put on anyone (status apply events).
export function noteEvents(buf, events) {
  for (const e of events) {
    if (e.type === 'death' && e.unit && e.unit.side === 'enemy' && !e.vanish && e.unit.def.id) {
      buf.beaten[e.unit.def.id] = (buf.beaten[e.unit.def.id] || 0) + 1;
      buf.met.add(e.unit.def.id);
    } else if (e.type === 'status' && e.change === 'apply' && e.status && e.status.type) {
      buf.statuses.add(e.status.type);
    }
  }
  return buf;
}

// Folds the buffer into progress.seen, plus the enemies on the floor (met) and the items the heroes hold; empties
// the buffer. Returns progress.
export function mergeSeen(progress, buf, { enemies = [], heroes = [] } = {}) {
  const s = { ...emptySeen(), ...(progress.seen || {}) };
  for (const u of enemies) if (u.def && u.def.id && !u.minion) buf.met.add(u.def.id);
  for (const h of heroes) for (const id of h.items || []) buf.items.add(id);
  s.met = [...new Set([...s.met, ...buf.met])];
  s.statuses = [...new Set([...s.statuses, ...buf.statuses])];
  s.items = [...new Set([...s.items, ...buf.items])];
  s.beaten = { ...s.beaten };
  for (const [id, n] of Object.entries(buf.beaten)) s.beaten[id] = (s.beaten[id] || 0) + n;
  progress.seen = s;
  buf.met.clear(); buf.statuses.clear(); buf.items.clear(); buf.beaten = {};
  return progress;
}
