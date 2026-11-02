// One motion language (systems/motion.js + config.js UI.motion, docs/transition-plan.md): timings and directions.
import { UI } from '../../src/config.js';
import { motionMs, easeFor, popPlan, slidePlan, fadePlan, pagePlan, pageSide } from '../../src/systems/motion.js';
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const M = UI.motion;

ok('tokens run fast < normal < slow < story', M.fast < M.normal && M.normal < M.slow && M.slow < M.story);
ok('quick feel: every token but story is at most 0.6s', ['fast', 'normal', 'slow'].every((k) => motionMs(k) <= 600));
let threw = false; try { motionMs('nope'); } catch { threw = true; }
ok('an unknown token is an error, not a silent 0', threw);
ok('arriving eases out, leaving eases in', easeFor(true) === M.easeOut && easeFor(false) === M.easeIn && /Out/.test(M.easeOut) && /In$/.test(M.easeIn));

const pin = popPlan(true), pout = popPlan(false);
ok('pop-up drops in from ABOVE and lands home', pin.box.fromDy < 0 && pin.box.toDy === 0 && pin.box.fromAlpha === 0 && pin.box.toAlpha === 1);
ok('pop-up closes the reverse way (lifts up, fades)', pout.box.toDy === pin.box.fromDy && pout.box.toAlpha === 0 && pout.box.ease === M.easeIn);
ok('pop-ups are fast and the shade only fades', pin.ms === M.fast && pout.ms === M.fast && !('fromDy' in pin.shade));

const next = slidePlan(1), back = slidePlan(-1);
ok('next tab: old content leaves left, new comes from the right', next.out.toDx < 0 && next.in.fromDx > 0);
ok('back is the exact mirror', back.out.toDx === -next.out.toDx && back.in.fromDx === -next.in.fromDx);
ok('tab slides are fast and ease right', next.ms === M.fast && next.in.ease === M.easeOut && next.out.ease === M.easeIn);

ok('scene fade uses the normal token by default', fadePlan().outMs === M.normal && fadePlan('slow').inMs === M.slow);
for (const side of ['left', 'right', 'top', 'bottom']) {
  const pe = pagePlan(true, side), pl = pagePlan(false, side);
  ok(`page from ${side}: one screen away, lands home, leaves the same way`, Math.abs(pe.from) === (pe.axis === 'scrollX' ? 390 : 844) && pe.to === 0 && pl.to === pe.from && pe.ease === M.easeOut && pl.ease === M.easeIn);
}
ok('camera offsets point the right way (right/bottom = negative scroll)', pagePlan(true, 'right').from < 0 && pagePlan(true, 'left').from > 0 && pagePlan(true, 'bottom').axis === 'scrollY' && pagePlan(true, 'bottom').from < 0 && pagePlan(true, 'top').from > 0);
ok('pages do not all come from one side', new Set(Object.values(UI.page.from)).size >= 3);
ok('a page over another page comes from overPage; unknown pages from fallback', pageSide('Heroes', 'Glossary') === UI.page.overPage && pageSide('Heroes', 'Base') === UI.page.from.Heroes && pageSide('Nope', 'Base') === UI.page.fallback);
