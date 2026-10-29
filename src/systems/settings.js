// Player settings (no Phaser): what the Settings screen shows and changes. The list of settings, their defaults and
// their choices live in src/data/settings.json (`defs`); the chosen values are kept in the save (progress.settings).

// Every setting with its current value: the saved one when it is still a valid choice, else the default.
export function readSettings(progress, defs) {
  const saved = (progress && progress.settings) || {};
  const out = {};
  for (const [id, def] of Object.entries(defs.defaults)) out[id] = isValid(defs, id, saved[id]) ? saved[id] : def;
  return out;
}

// The card that shows setting `id` (null if none).
export function cardOf(defs, id) {
  for (const tab of defs.tabs) for (const c of tab.cards) if (c.id === id) return c;
  return null;
}

function isValid(defs, id, v) {
  const c = cardOf(defs, id);
  if (v === undefined || !c) return false;
  if (c.type === 'bar') return Number.isInteger(v) && v >= 0 && v <= c.max;
  if (c.type === 'choice') return c.options.some((o) => o.value === v);
  return false;
}

// Sets one setting in the save copy (not written to storage: the caller saves). A value that is not one of the
// setting's choices is ignored. Returns true when something changed.
export function changeSetting(progress, defs, id, value) {
  if (!isValid(defs, id, value)) return false;
  const now = readSettings(progress, defs)[id];
  progress.settings = { ...(progress.settings || {}), [id]: value };
  return now !== value;
}

// A bar setting one step up (+1) or down (-1), kept between 0 and its max.
export function stepSetting(progress, defs, id, dir) {
  const c = cardOf(defs, id);
  if (!c || c.type !== 'bar') return false;
  const v = Math.max(0, Math.min(c.max, readSettings(progress, defs)[id] + dir));
  return changeSetting(progress, defs, id, v);
}
