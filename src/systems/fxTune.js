// Effect settings from the Character Studio (src/data/effects.json): per effect a `speed` and colour swaps.
// The effect recipes stay code (systems/statusFx, hitFx, itemFx, skillFx); this layer changes how fast they
// play and recolours their pixels. No Phaser here.
//   const tune = makeTuner(effectsData)
//   tune.speed(group, name)        -> 1 = normal (2 = twice as fast)
//   tune.ms(group, name, baseMs)   -> how long it plays now
//   tune.paint(group, name, draws) -> the same pixels with swapped colours
//   tune.color(group, name, c)     -> one colour swapped (for body tints)
export function makeTuner(data = {}) {
  const maps = {};
  const entry = (group, name) => (data[group] && data[group][name]) || null;
  const mapOf = (group, name) => {
    const key = group + ':' + name;
    if (!(key in maps)) {
      const e = entry(group, name);
      const m = new Map();
      if (e && e.colors) for (const [from, to] of Object.entries(e.colors)) m.set(Number(from), Number(to));
      maps[key] = m.size ? m : null;
    }
    return maps[key];
  };
  const speed = (group, name) => { const e = entry(group, name); const s = e && Number(e.speed); return s > 0 ? s : 1; };
  return {
    speed,
    ms: (group, name, base) => base / speed(group, name),
    color: (group, name, c) => { const m = mapOf(group, name); return m && m.has(c) ? m.get(c) : c; },
    paint(group, name, draws) {
      const m = mapOf(group, name);
      if (!m) return draws;
      return draws.map((d) => (m.has(d[4]) ? [d[0], d[1], d[2], d[3], m.get(d[4]), d[5]] : d));
    },
  };
}
export const NO_TUNE = makeTuner({});
