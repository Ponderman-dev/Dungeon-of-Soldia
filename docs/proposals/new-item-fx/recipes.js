// PROPOSED effects for the new items (docs/proposals/new-item-fx). Same recipe format as src/systems/itemFx.js, so a
// picked option can be moved into the game as it is: fn(q, t, s) -> draws (or { draws, tint, on }), character pixels,
// q = 0..1 over `ms`, s = { hero, foe, foe2 } bodies { x, y (feet), top, mid, bot, hw } on the effect stage.
// `when` = the moment in a fight that plays it.
import { pen, rnd, FX_COLORS as C } from '../../../src/systems/statusFx.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ph = (q, a, b) => clamp((q - a) / (b - a));
const easeOut = (p) => 1 - (1 - p) * (1 - p);
const easeIn = (p) => p * p;
const lerp = (a, b, p) => a + (b - a) * p;
const fly = (a, b, p, arc = 0) => [lerp(a.x, b.x, p), lerp(a.y, b.y, p) - Math.sin(p * Math.PI) * arc];
const front = (u, side = 1) => ({ x: u.x + side * (u.hw + 2), y: u.mid });

function burst(g, x, y, n, cols, p, dist = 12, seed = 1, grav = 0) {
  if (p <= 0 || p >= 1) return;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd(seed + i) * 0.6; const d = dist * easeOut(p) * (0.5 + rnd(seed + i * 3) * 0.6);
    g.px(x + Math.cos(a) * d, y + Math.sin(a) * d + grav * p * p * 10, cols[i % cols.length], 1 - p);
  }
}
// A flame tongue standing on (x, y), h tall, in the given colours (low, mid, tip).
function flame(g, x, y, h, t, seed, cols, a = 1) {
  for (let j = 0; j < h; j++) {
    const w = j < h * 0.4 ? 1 : 0; const sway = Math.round(Math.sin(t / 90 + seed + j) * (j / h) * 1.2);
    for (let k = -w; k <= w; k++) g.px(x + k + sway, y - j, j >= h - 1 ? cols[2] : j > h * 0.5 ? cols[1] : cols[0], a);
  }
}
// A small sprite from rows of letters (pal maps letter -> colour), its middle at (x, y).
function sprite(g, rows, pal, x, y, a = 1) {
  const h = rows.length, w = rows[0].length;
  rows.forEach((r, ry) => [...r].forEach((ch, rx) => { if (ch !== '.') g.px(x - Math.floor(w / 2) + rx, y - Math.floor(h / 2) + ry, pal[ch], a); }));
}

const LANTERN = ['.k.', 'kyk', 'kwk', 'kkk'];
const HEART = ['.rr.rr.', 'rhrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
const PAGE = ['ww', 'wg', 'ww'];
const RUNE = ['.y.y.', 'yyyyy', '.yoy.', 'yyyyy', '.y.y.'];
const SPIRIT = ['..v..', '.vvv.', 'vVwVv', 'vVwVv', '.vvv.', 'v.v.v'];
const MIRROR = ['.ggg.', 'gwwcg', 'gwccg', 'gcccg', '.ggg.'];
const pal = { k: C.outline, y: C.gold, w: C.white, r: C.blood, h: 0xff8a8a, g: C.grey, o: C.fire, v: C.dark, V: C.dark2, c: C.ice };

export const PROPOSALS = [
  // ---- Soul Lantern: every kill feeds it ----
  { item: 'soul_lantern', when: 'An enemy dies', options: [
    { id: 'A', name: 'Soul Drift', desc: 'A pale soul wisp rises from the fallen enemy, drifts over in an arc and sinks into the holder with a soft glow.', ms: 1100, on: 'hero',
      fn: (q, t, s) => { const g = pen(); const p = ph(q, 0.1, 0.85); const [x, y] = fly({ x: s.foe.x, y: s.foe.mid }, { x: s.hero.x, y: s.hero.mid }, easeIn(p), 16);
        if (q < 0.9) { for (let k = 0; k < 4; k++) g.px(x + Math.sin(t / 80 + k) , y + k, k ? C.ice2 : C.white, 1 - k * 0.22); g.px(x - 1, y, C.ice2, 0.6); g.px(x + 1, y, C.ice2, 0.6); }
        if (q > 0.8) g.ring(s.hero.x, s.hero.mid, 2 + ph(q, 0.8, 1) * 7, C.ice2, 1 - ph(q, 0.8, 1));
        return g.out; } },
    { id: 'B', name: 'Lantern Flare', desc: 'A tiny lantern appears over the holder\'s shoulder; a streak of soul light shoots into it and its flame flares up white-green.', ms: 1000, on: 'hero',
      fn: (q, t, s) => { const g = pen(); const lx = s.hero.x + s.hero.hw + 3, ly = s.hero.top + 1; const a = q < 0.85 ? 1 : 1 - ph(q, 0.85, 1);
        sprite(g, LANTERN, pal, lx, ly, a);
        const p = ph(q, 0.05, 0.5); if (p > 0 && p < 1) { const [x, y] = fly({ x: s.foe.x, y: s.foe.mid }, { x: lx, y: ly }, p, 8); g.line(x, y, x + 3, y + 1, C.heal, 0.7); g.px(x, y, C.white); }
        const f = ph(q, 0.5, 0.75); if (f > 0) { flame(g, lx, ly - 2, 2 + Math.round(3 * Math.sin(f * Math.PI)), t, 1, [C.heal, C.gold2, C.white], a); if (f < 1) g.ring(lx, ly, 2 + f * 5, C.heal, 1 - f); }
        return g.out; } },
  ] },
  // ---- Phoenix Feather: saves the holder from death ----
  { item: 'phoenix_feather', when: 'The holder would die and is saved', options: [
    { id: 'A', name: 'Rebirth Flames', desc: 'A column of fire bursts up from the feet, feathers flutter down around the hero and a gold ring flashes.', ms: 1300, on: 'hero',
      fn: (q, t, s) => { const g = pen(); const u = s.hero; const up = Math.sin(ph(q, 0, 0.7) * Math.PI);
        for (let i = -u.hw - 1; i <= u.hw + 1; i += 2) flame(g, u.x + i, u.y, Math.round((4 + rnd(i) * 8) * up), t, i, [C.fire, C.fire2, C.white]);
        for (let k = 0; k < 6; k++) { const p = ph(q, 0.2 + k * 0.05, 1); if (p <= 0 || p >= 1) continue; const x = u.x + (rnd(k) - 0.5) * 16 + Math.sin(t / 150 + k) * 2, y = u.top - 6 + p * 22; g.px(x, y, C.fire2, 1 - p); g.px(x + 1, y + 1, C.fire, 1 - p); }
        const r = ph(q, 0.05, 0.4); if (r > 0 && r < 1) g.ring(u.x, u.mid, 3 + r * 12, C.gold, 1 - r, (3 + r * 12) * 0.7);
        return { draws: g.out, tint: q < 0.5 ? [C.fire2, 0.5 * (1 - q * 2)] : null, on: 'hero' }; } },
    { id: 'B', name: 'Wings of Fire', desc: 'Two fiery wings spread wide from the hero\'s back, beat once and fold away in embers.', ms: 1200, on: 'hero',
      fn: (q, t, s) => { const g = pen(); const u = s.hero; const open = Math.sin(ph(q, 0, 0.8) * Math.PI);
        for (const side of [-1, 1]) for (let i = 0; i < 9; i++) { const len = Math.round((3 + i * 0.8) * open); const bx = u.x + side * (2 + i), by = u.mid - 4 + Math.round(i * 0.4) - Math.round(Math.sin(t / 120) * open);
          for (let j = 0; j < len; j++) g.px(bx, by - j + i * 0.2, j > len * 0.6 ? C.fire2 : C.fire, 0.9 * open); }
        burst(g, u.x, u.mid, 10, [C.fire, C.fire2], ph(q, 0.6, 1), 14, 5, 0.4);
        return g.out; } },
  ] },
  // ---- Mirror Buckler: bounces a hit back ----
  { item: 'mirror_buckler', when: 'A ranged or magic hit bounces back', options: [
    { id: 'A', name: 'Mirror Flash', desc: 'A silver mirror pane flashes in front of the hero and a bright streak flies straight back at the attacker.', ms: 700, on: 'enemy',
      fn: (q, t, s) => { const g = pen(); const m = front(s.hero, 1); const a = q < 0.4 ? 1 : 1 - ph(q, 0.4, 0.7);
        sprite(g, MIRROR, pal, m.x + 1, m.y, a); if (q < 0.25) g.line(m.x - 1, m.y - 2, m.x + 3, m.y + 2, C.white);
        const p = ph(q, 0.2, 0.8); if (p > 0 && p < 1) { const [x, y] = fly(m, { x: s.foe.x, y: s.foe.mid }, p); g.line(x - 4, y, x, y, C.ice2); g.px(x + 1, y, C.white); }
        if (q > 0.8) burst(g, s.foe.x - s.foe.hw, s.foe.mid, 6, [C.white, C.ice], ph(q, 0.8, 1), 6, 2);
        return g.out; } },
    { id: 'B', name: 'Glass Ripple', desc: 'The hit splashes on an invisible glass wall: a round ripple spreads, a white glint runs across, and the shot spins back.', ms: 800, on: 'enemy',
      fn: (q, t, s) => { const g = pen(); const m = front(s.hero, 1); const r = ph(q, 0, 0.5);
        if (r < 1) { g.ring(m.x, m.y, 2 + r * 6, C.ice2, 1 - r, (2 + r * 6) * 1.4); g.ring(m.x, m.y, 1 + r * 3, C.white, 1 - r, (1 + r * 3) * 1.4); }
        const p = ph(q, 0.3, 0.9); if (p > 0 && p < 1) { const [x, y] = fly(m, { x: s.foe.x, y: s.foe.mid }, p, 6); const k = (t / 40) % 4; g.px(x, y, C.white); g.px(x + (k < 2 ? 1 : -1), y + (k % 2 ? 1 : -1), C.ice); }
        return g.out; } },
  ] },
  // ---- Flame Spirit: 3-5 dark fireballs ----
  { item: 'flame_spirit', when: 'It goes off (then it throws its dark fireballs)', options: [
    { id: 'A', name: 'Little Spirit', desc: 'A small purple fire spirit with white eyes pops up over the hero, bobs, and spits the fireballs (they stay the dark skull bolts).', ms: 1300, on: 'enemy',
      fn: (q, t, s) => { const g = pen(); const x = s.hero.x + 4, y = s.hero.top - 6 + Math.round(Math.sin(t / 150)); const a = q < 0.15 ? q / 0.15 : q > 0.85 ? 1 - ph(q, 0.85, 1) : 1;
        sprite(g, SPIRIT, pal, x, y, a); flame(g, x, y - 3, 3, t, 2, [C.dark, C.dark2, C.white], a);
        for (let k = 0; k < 3; k++) { const p = ph(q, 0.25 + k * 0.18, 0.55 + k * 0.18); if (p <= 0 || p >= 1) continue; const [bx, by] = fly({ x, y }, { x: s.foe.x, y: s.foe.mid }, p, 10); g.disc(bx, by, 1.2, C.dark); g.px(bx, by, C.white); }
        return g.out; } },
    { id: 'B', name: 'Ring of Ghost Fire', desc: 'A ring of purple flames runs once around the hero\'s feet, then the fireballs rise out of it one by one.', ms: 1200, on: 'enemy',
      fn: (q, t, s) => { const g = pen(); const u = s.hero; const p = ph(q, 0, 0.5); const n = 12;
        for (let i = 0; i < n; i++) { if (i / n > p * 1.2) continue; const a = (i / n) * Math.PI * 2; flame(g, u.x + Math.cos(a) * (u.hw + 4), u.y + Math.sin(a) * 2, 3 + Math.round(rnd(i) * 2), t, i, [C.dark2, C.dark, C.white], q > 0.8 ? 1 - ph(q, 0.8, 1) : 1); }
        for (let k = 0; k < 3; k++) { const f = ph(q, 0.4 + k * 0.15, 0.7 + k * 0.1); if (f <= 0 || f >= 1) continue; const [bx, by] = fly({ x: u.x + (k - 1) * 5, y: u.y }, { x: s.foe.x, y: s.foe.mid }, f, 14); g.disc(bx, by, 1.2, C.dark); g.px(bx, by, C.white); }
        return g.out; } },
  ] },
  // ---- Last Stand Banner: a hero falls, the survivors rally ----
  { item: 'last_stand_banner', when: 'A hero falls (the survivors rally)', options: [
    { id: 'A', name: 'Banner Raised', desc: 'A torn red banner plants itself beside the survivor and waves; a red-gold glow pulses over the hero.', ms: 1400, on: 'hero',
      fn: (q, t, s) => { const g = pen(); const u = s.hero; const bx = u.x - u.hw - 4; const rise = easeOut(ph(q, 0, 0.3)); const a = q > 0.85 ? 1 - ph(q, 0.85, 1) : 1;
        const top = Math.round(u.y - 22 * rise); for (let y = top; y <= u.y; y++) g.px(bx, y, C.brown, a);
        for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) { const wave = Math.round(Math.sin(t / 110 + i * 0.8)); if (i === 6 && j % 2) continue; g.px(bx + 1 + i, top + 1 + j + wave * (i / 7), j === 0 ? C.gold : C.red, a * rise); }
        return { draws: g.out, tint: [C.red, 0.25 * Math.sin(ph(q, 0.2, 1) * Math.PI)], on: 'hero' }; } },
    { id: 'B', name: 'Rally Roar', desc: 'Red shock rings burst from the survivor and gold arrows (chevrons) climb up over its head.', ms: 1100, on: 'hero',
      fn: (q, t, s) => { const g = pen(); const u = s.hero;
        for (let k = 0; k < 2; k++) { const r = ph(q, k * 0.15, 0.6 + k * 0.15); if (r > 0 && r < 1) g.ring(u.x, u.mid, 3 + r * 14, C.red, 1 - r, (3 + r * 14) * 0.6); }
        for (let k = 0; k < 3; k++) { const p = ph(q, 0.2 + k * 0.15, 0.7 + k * 0.15); if (p <= 0 || p >= 1) continue; const y = u.top - 2 - p * 10, x = u.x; for (let i = -2; i <= 2; i++) g.px(x + i, y + Math.abs(i), C.gold, 1 - p); }
        return g.out; } },
  ] },
  // ---- Spotter's Lens: the tapped enemy takes more ----
  { item: 'spotters_lens', when: 'While you have an enemy tapped (loops)', options: [
    { id: 'A', name: 'Lens Glint', desc: 'A thin gold lens ring circles the tapped enemy, with a glint that slides round it.', ms: 1600, on: 'enemy',
      fn: (q, t, s) => { const g = pen(); const u = s.foe; const r = u.hw + 4; g.ring(u.x, u.mid, r, C.gold, 0.55, r * 1.1);
        const a = q * Math.PI * 2; g.px(u.x + Math.cos(a) * r, u.mid + Math.sin(a) * r * 1.1, C.white); g.px(u.x + Math.cos(a - 0.15) * r, u.mid + Math.sin(a - 0.15) * r * 1.1, C.gold2);
        return g.out; } },
    { id: 'B', name: 'Spotlight', desc: 'A soft beam of light shines down on the tapped enemy from above, with a bright spot on the floor.', ms: 1600, on: 'enemy',
      fn: (q, t, s) => { const g = pen(); const u = s.foe; const a = 0.26 + 0.08 * Math.sin(q * Math.PI * 2);
        for (let y = u.top - 18; y <= u.y; y++) { const w = Math.round(2 + (y - (u.top - 18)) * 0.25); for (let x = -w; x <= w; x++) g.px(u.x + x, y, C.holy, a); }
        g.ring(u.x, u.y, u.hw + 3, C.holy, 0.5, 1.5);
        return g.out; } },
  ] },
  // ---- Giantslayer's Brand: +30% vs bosses ----
  { item: 'giantslayers_brand', when: 'The holder hits a boss', options: [
    { id: 'A', name: 'Giant Cleave', desc: 'A big gold slash cuts across the boss, longer and brighter than a normal hit.', ms: 450, on: 'enemy',
      fn: (q, t, s) => { const g = pen(); const u = s.foe; const p = ph(q, 0, 0.5); const a = 1 - ph(q, 0.5, 1); const n = Math.round(18 * easeOut(p));
        for (let i = 0; i < n; i++) { const x = u.x - 9 + i, y = u.top - 3 + Math.round(i * 1.2); g.px(x, y, C.gold, a); g.px(x, y + 1, C.white, a); }
        return { draws: g.out, tint: q < 0.3 ? [C.gold2, 0.5] : null, on: 'enemy' }; } },
    { id: 'B', name: 'Brand Mark', desc: 'A glowing gold rune is burned onto the boss and fades slowly.', ms: 900, on: 'enemy',
      fn: (q, t, s) => { const g = pen(); const u = s.foe; const a = q < 0.2 ? q / 0.2 : 1 - ph(q, 0.5, 1); sprite(g, RUNE, pal, u.x, u.mid - 2, a);
        burst(g, u.x, u.mid - 2, 6, [C.fire2, C.gold], ph(q, 0, 0.4), 6, 3); return g.out; } },
  ] },
  // ---- Catalyst Vial: different damage over time boost each other ----
  { item: 'catalyst_vial', when: 'A damage-over-time tick on an enemy with 2+ kinds', options: [
    { id: 'A', name: 'Bubbling Mix', desc: 'Bubbles in the colours of each damage over time (fire, poison, blood) swirl together above the enemy.', ms: 1000, on: 'enemy',
      fn: (q, t, s) => { const g = pen(); const u = s.foe; const cols = [C.fire, C.poison, C.blood];
        for (let k = 0; k < 9; k++) { const a = q * Math.PI * 3 + (k / 9) * Math.PI * 2; const r = 6 * (1 - q * 0.6); const y = u.top - 3 - q * 4 + Math.sin(a) * 2; g.px(u.x + Math.cos(a) * r, y, cols[k % 3], 1 - ph(q, 0.7, 1)); }
        if (q > 0.7) burst(g, u.x, u.top - 6, 6, [C.white, C.poison], ph(q, 0.7, 1), 6, 4); return g.out; } },
    { id: 'B', name: 'Catalyst Spark', desc: 'Three coloured sparks spiral in from around the enemy and meet in a small white pop.', ms: 700, on: 'enemy',
      fn: (q, t, s) => { const g = pen(); const u = s.foe; const cols = [C.fire, C.poison, C.blood]; const p = ph(q, 0, 0.7);
        for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + p * 4; const r = 10 * (1 - easeIn(p)); g.px(u.x + Math.cos(a) * r, u.mid + Math.sin(a) * r * 0.7, cols[k]); g.px(u.x + Math.cos(a - 0.3) * r, u.mid + Math.sin(a - 0.3) * r * 0.7, cols[k], 0.5); }
        if (q > 0.7) { g.ring(u.x, u.mid, 1 + ph(q, 0.7, 1) * 5, C.white, 1 - ph(q, 0.7, 1)); } return g.out; } },
  ] },
  // ---- Scholar's Bookmark: skill damage from pages ----
  { item: 'scholars_bookmark', when: 'The holder casts a skill', options: [
    { id: 'A', name: 'Fluttering Pages', desc: 'A few small pages flutter up around the hero as the skill goes off.', ms: 1000, on: 'hero',
      fn: (q, t, s) => { const g = pen(); const u = s.hero;
        for (let k = 0; k < 5; k++) { const p = ph(q, k * 0.08, 0.7 + k * 0.06); if (p <= 0 || p >= 1) continue; const x = u.x + (k - 2) * 4 + Math.sin(t / 100 + k) * 2, y = u.mid - p * 16; sprite(g, PAGE, pal, x, y, 1 - p); }
        return g.out; } },
    { id: 'B', name: 'Ribbon Swirl', desc: 'A red bookmark ribbon spirals up around the hero and vanishes over its head.', ms: 900, on: 'hero',
      fn: (q, t, s) => { const g = pen(); const u = s.hero;
        for (let i = 0; i < 14; i++) { const p = ph(q, 0, 0.8) - i * 0.03; if (p <= 0 || p >= 1) continue; const a = p * Math.PI * 4; const y = u.bot - p * (u.bot - u.top + 8); g.px(u.x + Math.cos(a) * (u.hw + 2), y, i < 2 ? C.gold : C.red, 1 - ph(q, 0.75, 1)); }
        return g.out; } },
  ] },
  // ---- Iron Will Talisman: control lasts shorter ----
  { item: 'iron_will_talisman', when: 'A stun, freeze or fear lands on the holder (it is shortened)', options: [
    { id: 'A', name: 'Steel Glint', desc: 'A blue-steel ring snaps tight around the hero\'s head and a glint flashes: the hero shrugs it off faster.', ms: 700, on: 'hero',
      fn: (q, t, s) => { const g = pen(); const u = s.hero; const r = 10 * (1 - easeOut(ph(q, 0, 0.5))) + 4; g.ring(u.x, u.top + 3, r, C.shield, q < 0.6 ? 1 : 1 - ph(q, 0.6, 1), r * 0.5);
        if (q > 0.4 && q < 0.7) { g.line(u.x + 3, u.top - 2, u.x + 5, u.top - 4, C.white); g.px(u.x + 4, u.top - 1, C.white); } return g.out; } },
    { id: 'B', name: 'Chains Snap', desc: 'Grey chain links wrap the hero for a moment, then snap and fly off.', ms: 800, on: 'hero',
      fn: (q, t, s) => { const g = pen(); const u = s.hero;
        if (q < 0.4) for (let i = -u.hw - 1; i <= u.hw + 1; i += 2) { g.px(u.x + i, u.mid, C.grey); g.px(u.x + i + 1, u.mid - 1, C.grey2); }
        burst(g, u.x, u.mid, 10, [C.grey, C.grey2, C.white], ph(q, 0.35, 1), 12, 6, 0.6); return g.out; } },
  ] },
  // ---- Heart of the Beast: regen + stronger healing ----
  { item: 'heart_of_the_beast', when: 'The holder is healed', options: [
    { id: 'A', name: 'Beating Heart', desc: 'A red pixel heart beats twice over the hero and gives off red motes.', ms: 1000, on: 'hero',
      fn: (q, t, s) => { const g = pen(); const u = s.hero; const beat = q < 0.2 || (q > 0.35 && q < 0.5); const a = q > 0.8 ? 1 - ph(q, 0.8, 1) : 1;
        sprite(g, HEART, pal, u.x, u.top - 6 - (beat ? 1 : 0), a); if (beat) g.ring(u.x, u.top - 6, 5, C.blood, 0.5);
        burst(g, u.x, u.top - 6, 6, [C.blood, 0xff8a8a], ph(q, 0.4, 1), 9, 2, -0.3); return g.out; } },
    { id: 'B', name: 'Beast Aura', desc: 'A dark red glow wells up on the hero with three claw-mark streaks that fade out.', ms: 900, on: 'hero',
      fn: (q, t, s) => { const g = pen(); const u = s.hero; const a = Math.sin(ph(q, 0, 1) * Math.PI);
        for (let k = 0; k < 3; k++) for (let i = 0; i < 6; i++) g.px(u.x - 3 + k * 3 + Math.round(i * 0.4), u.top + 4 + i, C.blood, a * 0.9);
        return { draws: g.out, tint: [C.blood2, 0.35 * a], on: 'hero' }; } },
  ] },
  // ---- Ghastly Fire: fire hits also deal dark ----
  { item: 'ghastly_fire', when: 'A fire hit or burn tick from the holder', options: [
    { id: 'A', name: 'Ghost Flames', desc: 'Purple ghost flames lick up beside the orange fire on the enemy.', ms: 700, on: 'enemy',
      fn: (q, t, s) => { const g = pen(); const u = s.foe; const h = Math.round(6 * Math.sin(ph(q, 0, 1) * Math.PI));
        flame(g, u.x - 3, u.mid + 4, h, t, 1, [C.fire, C.fire2, C.white]); flame(g, u.x + 2, u.mid + 4, h + 1, t, 3, [C.dark2, C.dark, C.white]); flame(g, u.x + 5, u.mid + 5, h - 1, t, 5, [C.dark2, C.dark, 0xe0c8ff]);
        return g.out; } },
    { id: 'B', name: 'Skull Wisps', desc: 'Tiny purple skull wisps float up out of the fire and fade.', ms: 900, on: 'enemy',
      fn: (q, t, s) => { const g = pen(); const u = s.foe;
        for (let k = 0; k < 3; k++) { const p = ph(q, k * 0.15, 0.7 + k * 0.1); if (p <= 0 || p >= 1) continue; const x = u.x + (k - 1) * 4 + Math.sin(t / 120 + k) * 1.5, y = u.mid - p * 14;
          sprite(g, ['vvv', 'wvw', '.v.'], pal, x, y, 1 - p); }
        return g.out; } },
  ] },
  // ---- Quiver of Plenty: an extra arrow ----
  { item: 'quiver_of_plenty', when: 'It shoots its extra arrow', options: [
    { id: 'A', name: 'Feather Trail', desc: 'The extra arrow leaves a trail of little green feathers, and a puff of feathers bursts at the bow.', ms: 600, on: 'enemy',
      fn: (q, t, s) => { const g = pen(); const a = front(s.hero, 1), b = { x: s.foe2.x, y: s.foe2.mid }; const p = ph(q, 0, 0.7);
        if (p < 1) { const [x, y] = fly(a, b, p, 4); g.line(x - 4, y, x, y, C.brown); g.px(x + 1, y, C.white); for (let k = 1; k < 4; k++) { const [fx, fy] = fly(a, b, Math.max(0, p - k * 0.08), 4); g.px(fx, fy + (k % 2 ? 1 : -1), C.heal, 0.8 - k * 0.2); } }
        burst(g, a.x, a.y, 6, [C.heal, C.white], ph(q, 0, 0.4), 6, 2); return g.out; } },
    { id: 'B', name: 'Golden Arrow', desc: 'The extra arrow flies in gold with a sparkling tail, so you can tell it from the normal shot.', ms: 600, on: 'enemy',
      fn: (q, t, s) => { const g = pen(); const a = front(s.hero, 1), b = { x: s.foe2.x, y: s.foe2.mid }; const p = ph(q, 0, 0.75);
        if (p < 1) { const [x, y] = fly(a, b, p, 4); g.line(x - 4, y, x, y, C.gold); g.px(x + 1, y, C.white); for (let k = 0; k < 4; k++) g.px(x - 5 - k * 2 + (k % 2), y + (k % 2 ? 1 : -1), C.gold2, 0.8 - k * 0.18); }
        else burst(g, b.x - 3, b.y, 6, [C.gold, C.white], ph(q, 0.75, 1), 6, 3); return g.out; } },
  ] },
];
