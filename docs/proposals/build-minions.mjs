// Builds docs/proposals/minion-proposal.html (the minion sprite proposal page) from minion-designs.mjs,
// the current minions.json (old blocks) and two heroes for scale. Usage: node docs/proposals/build-minions.mjs
import fs from 'node:fs';
import { DESIGNS, toGame } from './minion-designs.mjs';
const data = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url), 'utf8'));
const minions = data('minions.json'), heroes = data('heroes.json');
const pick = (id) => { const h = heroes.find((x) => x.id === id); return { name: h.name, height: h.height, parts: h.parts }; };
const items = data('items.json');
const source = {}; // which item / hero brings each minion
for (const [id, it] of Object.entries(items)) for (const e of it.effects || []) { const m = e.greaterMinion || (e.minionSpawner && e.minionSpawner.minion) || (e.minionOnHit && e.minionOnHit.minion); if (m) source[m] = (source[m] ? source[m] + ', ' : '') + it.name; }
source.skeleton = 'Necromancer' + (source.skeleton ? ', ' + source.skeleton : '');
const list = Object.keys(DESIGNS).map((id) => {
  const m = minions[id];
  const g = toGame(DESIGNS[id]);
  const colours = new Set(Object.values(DESIGNS[id].parts).flatMap((p) => Object.values(p.pal))).size;
  return { id, name: m.name, kind: m.kind || 'weak', damageType: m.damageType, flying: !!m.flying, hover: m.hover || 0, from: source[id] || '', idea: DESIGNS[id].idea, colours, old: { height: m.height, parts: m.parts }, now: g };
});
const DATA = { minions: list, knight: pick('knight'), necro: pick('necromancer') };
const tpl = fs.readFileSync(new URL('./minion-template.html', import.meta.url), 'utf8');
fs.writeFileSync(new URL('./minion-proposal.html', import.meta.url), tpl.replace('/*DATA*/', 'const DATA = ' + JSON.stringify(DATA) + ';'));
console.log('wrote docs/proposals/minion-proposal.html');
