// Hit effects (systems/hitFx.js): every damage type has its own shot and its own impact; crits add a layer.
import fs from 'fs';
import { projectileFx, impactFx, critFx, IMPACT_MS, HIT_TYPES } from '../../src/systems/hitFx.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const types = Object.keys(r('damageTypes.json'));
ok('every damage type has its own impact', types.every((k) => IMPACT_MS[k] > 0), types.filter((k) => !IMPACT_MS[k]).join());
const clean = (d) => Array.isArray(d) && d.every((p) => p.length === 6 && p.every((v) => typeof v === 'number' && !Number.isNaN(v)));
const u = { x: 60, y: 50, top: 28, mid: 39, hw: 6, side: -1 };
const bad = [];
for (const k of HIT_TYPES) for (const q of [0, 0.1, 0.3, 0.5, 0.8, 0.99, 1]) for (const t of [0, 70, 333]) {
  try { const o = impactFx(k, q, u, t, 3, { x: 20, y: 40 }); if (!clean(o.draws) || (o.tint && !(o.tint[1] > 0 && o.tint[1] <= 1))) bad.push(k); } catch (e) { bad.push(k + ': ' + e.message); }
  try { if (!clean(projectileFx(k, { x: 10, y: 40 }, { x: 10 + q * 40, y: 40 - q * 5 }, t, 2))) bad.push('shot ' + k); } catch (e) { bad.push('shot ' + k + ': ' + e.message); }
}
ok('impacts and shots draw clean pixels at any moment', bad.length === 0, [...new Set(bad)].join('; '));
ok('every impact shows something while it plays', HIT_TYPES.every((k) => [0.1, 0.3, 0.5].some((q) => impactFx(k, q, u, 0, 1, { x: 20, y: 40 }).draws.length > 0)));
ok('every ranged-type shot shows something', ['ranged', 'fire', 'ice', 'electric', 'dark', 'holy'].every((k) => projectileFx(k, { x: 0, y: 0 }, { x: 20, y: 0 }, 0, 1).length > 0));
ok('impacts are over when they end', HIT_TYPES.every((k) => impactFx(k, 1, u, 0, 1, null).draws.length === 0));
const types2 = HIT_TYPES.map((k) => JSON.stringify(impactFx(k, 0.3, u, 0, 1, { x: 20, y: 40 }).draws));
ok('each damage type looks different', new Set(types2).size === HIT_TYPES.length);
ok('fire, ice and dark colour the target for a moment', ['fire', 'ice', 'dark'].every((k) => impactFx(k, 0.2, u, 0).tint) && !impactFx('melee', 0.2, u, 0).tint);
ok('the hit lands on the side facing the attacker', impactFx('melee', 0.3, u, 0).draws.every((p) => p[0] <= u.x) && impactFx('melee', 0.3, { ...u, side: 1 }, 0).draws.every((p) => p[0] >= u.x));
ok('crits add slashes and rays', critFx(0.3, u, 0).length > 20 && critFx(1, u, 0).length === 0);
// The other hit moments: miss, block, shield soak, shield break, heal, death puff.
import { MOMENT_MS, dodgeFx, blockFx, soakFx, shieldBreakFx, healFx, deathPuffFx } from '../../src/systems/hitFx.js';
const ub = { ...u, bot: 50 };
const mom = { dodge: (q) => dodgeFx(q, ub).draws, block: (q) => blockFx(q, ub), soak: (q) => soakFx(q, ub), shieldBreak: (q) => shieldBreakFx(q, ub), heal: (q) => healFx(q, ub, 2).draws, puff: (q) => deathPuffFx(q, 60, 50) };
ok('every moment has a duration', Object.keys(mom).every((k) => MOMENT_MS[k] > 0));
const bad2 = [];
for (const [k, fn] of Object.entries(mom)) for (const q of [0, 0.05, 0.2, 0.5, 0.9, 1]) { try { if (!clean(fn(q))) bad2.push(k); } catch (e) { bad2.push(k + ': ' + e.message); } }
ok('moments draw clean pixels', bad2.length === 0, [...new Set(bad2)].join('; '));
ok('every moment shows something', Object.values(mom).every((fn) => [0.1, 0.3, 0.5].some((q) => fn(q).length > 0)));
ok('a dodge steps AWAY from the attacker and comes back', dodgeFx(0.3, ub).dx > 0 && dodgeFx(0.3, { ...ub, side: 1 }).dx < 0 && dodgeFx(1, ub).dx === 0);
ok('a heal glows green for a moment', healFx(0.35, ub).tint && healFx(0.95, ub).tint === null);
ok('the death puff is gone at the end', deathPuffFx(1, 60, 50).length === 0);
