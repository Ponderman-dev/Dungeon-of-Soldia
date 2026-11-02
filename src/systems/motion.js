// ONE MOTION LANGUAGE (docs/transition-plan.md): the timing and direction of every screen / page / window change, with
// no Phaser, so tests can check it. uiKit's helpers (popIn/popOut, slideSwap, sceneFade, pageEnter/pageLeave, uiShift)
// turn these plans into tweens. Tokens live in config.js `UI.motion`.
import { UI, GAME_WIDTH, GAME_HEIGHT } from '../config.js';

const M = () => UI.motion;

// A token's length in ms: 'fast' | 'normal' | 'slow' | 'story'.
export function motionMs(kind) {
  const ms = M()[kind];
  if (typeof ms !== 'number') throw new Error(`unknown motion token '${kind}'`);
  return ms;
}

// Arriving things ease out (fast start, soft stop), leaving things ease in.
export const easeFor = (show) => (show ? M().easeOut : M().easeIn);

// Pop-up window (user, session 41: DROP from above). The window starts popDropPx above its home, invisible, and drops
// in with a small settle; closing lifts it back up while fading. The dark shade only fades.
export function popPlan(show) {
  const m = M();
  return {
    ms: m.fast,
    box: show ? { fromDy: -m.popDropPx, toDy: 0, fromAlpha: 0, toAlpha: 1, ease: m.easeDrop }
      : { fromDy: 0, toDy: -m.popDropPx, fromAlpha: 1, toAlpha: 0, ease: m.easeIn },
    shade: show ? { fromAlpha: 0, toAlpha: 1, ease: m.easeOut } : { fromAlpha: 1, toAlpha: 0, ease: m.easeIn },
  };
}

// Tab / chapter content swap (user: slides SIDEWAYS like a page turn; the frame stays still). dir = +1 for the next
// tab (content moves left: the old one leaves to the left, the new one comes from the right), -1 = back (the reverse).
export function slidePlan(dir = 1) {
  const m = M(), d = dir < 0 ? -1 : 1;
  return {
    ms: m.fast,
    out: { toDx: -d * m.slidePx, toAlpha: 0, ease: m.easeIn },
    in: { fromDx: d * m.slidePx, fromAlpha: 0, toAlpha: 1, ease: m.easeOut },
  };
}

// Scene to scene: fade to black, then the next scene fades in (both 'normal' unless a token is named).
export function fadePlan(kind = 'normal') {
  return { outMs: motionMs(kind), inMs: motionMs(kind) };
}

// Which side a menu page comes from: its own side (UI.page.from), or overPage when opened over another menu page.
export function pageSide(key, from) {
  const P = UI.page;
  if (from && P.from[from]) return P.overPage;
  return P.from[key] || P.fallback;
}

// Menu page: slides in from `side` over the screen behind, and back out the same side. The camera scrolls one screen
// away: scrollX -W = page to the right, +W = to the left; scrollY -H = page below, +H = above.
export function pagePlan(show, side = 'right', width = GAME_WIDTH, height = GAME_HEIGHT) {
  const m = M();
  const axis = side === 'top' || side === 'bottom' ? 'scrollY' : 'scrollX';
  const off = { right: -width, left: width, bottom: -height, top: height }[side];
  if (off === undefined) throw new Error(`unknown page side '${side}'`);
  return show ? { ms: m.normal, axis, from: off, to: 0, ease: m.easeOut } : { ms: m.normal, axis, from: 0, to: off, ease: m.easeIn };
}
