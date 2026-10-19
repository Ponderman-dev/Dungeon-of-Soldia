// SKILL EFFECTS DEMO (proposal page, not game code): the Knight's two skills played on a slice of the fight screen at
// game size (390 px wide, characters x3), in four ways:
//   look 'now' = what the game shows today (name pops over him, then a 24px banner that grows 0.5 -> 1, small effect)
//   look 'new' = the proposed 3 beats in the Knight's colour/shape language (steel blue, squares):
//     CHARGE (aura + particles gather during the wind-up), RELEASE (flash, camera kick/zoom, speed lines, hit-stop),
//     IMPACT (big square shockwave, debris, a floor mark that lingers)
//   name 'A' = a CUT-IN BAR (user: no), kept only so the code still runs
//   name 'B' = a FLOATING NAME (fixed pixel size over the hero, slides up and fades, never scaled)
// Everything is drawn in CHARACTER pixels (1 = 3 screen px), like src/systems/skillFx.js; the page only picks what to play.
import heroes from '../../../src/data/heroes.json';
import enemies from '../../../src/data/enemies.json';
import minionDefs from '../../../src/data/minions.json';
import skills from '../../../src/data/skills.json';
import icons from '../../../src/data/skillIcons.json';
import combat from '../../../src/data/combat.json';
import { artPixels, partArt, mixColor } from '../../../src/systems/pixelArt.js';
import { bodyBox, pen, FX_COLORS as C } from '../../../src/systems/statusFx.js';
import { castFx, CAST_MS } from '../../../src/systems/skillFx.js';
import { RECIPES, CAST_MS_NEW, SPECS, NAME_COLORS } from './heroes.js';
// A recipe by name: a proposed one (heroes.js) or the game's own (skillFx.js). Always { draws, tints }.
// A skill's data; a rotation spell is 'skillId:SHORT' (the spell's own name/cast, the skill's kind); 'change_song:march'
// (no rotation) = a variant row of the same skill.
const skillDef = (id) => { const [b, sh] = id.split(':'); const base = skills[b]; if (!sh || !base.rotation) return base; const sp = base.rotation.find((r) => r.short === sh); return { ...sp, kind: base.kind }; };
const runFx = (name, q, c, t) => { const f = RECIPES[name]; if (!f) return castFx(name, q, c, t); const o = f(q, c, t); return Array.isArray(o) ? { draws: o, tints: [] } : { draws: o.draws || [], tints: o.tints || [] }; };
const fxMs = (name) => CAST_MS_NEW[name] ?? CAST_MS[name] ?? 800;

export const Z = 3, W = 130, H = 96; // scene in character pixels; 390 x 288 on screen
const FLOOR = 54; // where the wall meets the floor
const FX = combat.skillFx;
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const heroColor = (id) => FX.name.heroColors[id] || NAME_COLORS[id]; // the hero's name colour (game data, or the demo's own for heroes not built yet)
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ph = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = (p) => 1 - (1 - p) * (1 - p);
const easeOut3 = (p) => 1 - Math.pow(1 - p, 3);
const rnd = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

// The Knight's colour language (steel blue) and the taunt red.
export const KNIGHT = { white: 0xffffff, light: 0xcfe4ff, mid: 0x6fa8ff, deep: 0x3b6fd4, dark: 0x1d3a7a, text: '#9cc8ff' };
const RED = 0xff4a4a, STAR = 0xffe14a;

// ---- actors ---------------------------------------------------------------------------------------
function actor(def, fx, fy, faceLeft) {
  const box = bodyBox(def.parts, def.height);
  const parts = Object.values(def.parts).map((p) => {
    const px = artPixels(partArt(p)); const h = px.length, w = Math.max(...px.map((r) => r.length));
    return { px, left: p.x - w / 2, top: p.y - h / 2, w };
  });
  const a = { def, fx, fy, faceLeft, parts, box };
  // Silhouette (relative to the feet) for the charge aura: the outline ring 1 px outside the body.
  const set = new Set();
  forPixels(a, 0, 0, (gx, gy) => set.add(gx + ',' + gy));
  const ring = new Set();
  for (const k of set) { const [x, y] = k.split(',').map(Number); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (x + dx) + ',' + (y + dy); if (!set.has(n)) ring.add(n); } }
  a.outline = [...ring].map((k) => k.split(',').map(Number)).map(([x, y]) => [x - fx, y - fy]);
  return a;
}
function forPixels(a, dx, dy, fn, flip = false) {
  const left = a.faceLeft !== flip; // flip: turned around (a charmed enemy faces its friends)
  for (const p of a.parts) p.px.forEach((row, y) => row.forEach((c, x) => {
    if (c === null) return;
    const relX = p.left + x;
    fn(Math.round((left ? a.fx - relX - 1 : a.fx + relX) + dx), Math.round(a.fy + p.top + y + dy), c);
  }));
}
// Where an actor's body is when moved by (dx, dy).
function body(a, dx = 0, dy = 0) {
  const x = a.fx + dx + (a.faceLeft ? -a.box.cx : a.box.cx), y = a.fy + dy;
  return { x, y, top: y + a.box.top, mid: y + a.box.mid, bot: y + a.box.bot, hw: a.box.hw };
}
function drawActor(ctx, a, s = {}) {
  forPixels(a, s.dx || 0, s.dy || 0, (gx, gy, c) => {
    let col = c;
    if (s.tint) col = mixColor(col, s.tint[0], s.tint[1]);
    ctx.globalAlpha = s.alpha ?? 1;
    ctx.fillStyle = hex(col); ctx.fillRect(gx * Z, gy * Z, Z, Z);
  }, s.flip);
  ctx.globalAlpha = 1;
}

// ---- drawing helpers (char pixels, on a statusFx pen) ---------------------------------------------
function sqRing(g, cx, cy, r, ry, c, a, th = 1) {
  if (a <= 0) return;
  for (let k = 0; k < th; k++) {
    const R = Math.round(r) - k, RY = Math.round(ry) - k; if (R < 1 || RY < 0) break;
    g.rect(cx - R, cy - RY, 2 * R + 1, 1, c, a); g.rect(cx - R, cy + RY, 2 * R + 1, 1, c, a);
    g.rect(cx - R, cy - RY, 1, 2 * RY + 1, c, a); g.rect(cx + R, cy - RY, 1, 2 * RY + 1, c, a);
  }
}
function diamond(g, cx, cy, r, ry, c, a, th = 1, dotted = false) {
  if (a <= 0) return;
  for (let k = 0; k < th; k++) {
    const R = Math.round(r) - k; if (R < 1) break;
    const seen = new Set();
    for (let x = -R; x <= R; x++) {
      if (dotted && ((x + R) >> 1) % 2) continue;
      const y = Math.round((ry - k * ry / r) * (1 - Math.abs(x) / R));
      for (const yy of [y, -y]) { const key = x + ',' + yy; if (!seen.has(key)) { seen.add(key); g.px(cx + x, cy + yy, c, a); } }
    }
  }
}
// A little pixel shield (the Knight's own sign), s = pixel size. Rim in `rim`, face in `face`, a white glint.
const SHIELD = ['.#####.', '#xxxxx#', '#xx+xx#', '#x+++x#', '.#x+x#.', '.#xxx#.', '..#x#..', '...#...'];
function shield(g, cx, cy, s, rim, face, a) {
  if (a <= 0) return;
  SHIELD.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '.') return; g.rect(cx + (x - 3) * s, cy + (y - 4) * s, s, s, ch === '#' ? rim : ch === '+' ? 0xffffff : face, a); }));
}
// Dust kicked up at someone's feet (the floor's colour).
function dust(g, x, y, p, n = 8, seed = 1) {
  if (p <= 0 || p >= 1) return;
  for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1, d = (3 + rnd(seed + i) * 7) * easeOut(p); g.rect(x + side * d, y - 1 - rnd(seed + i * 5) * 3 * p, i % 3 ? 1 : 2, 1, i % 3 ? 0x8a7a68 : 0x6a5d50, 1 - p); }
}
// A shout: curved sound waves going out to the right of the mouth.
function shout(g, x, y, r, c, a) {
  if (a <= 0) return;
  for (let k = -10; k <= 10; k++) { const ang = k * 0.06; for (const rr of [r, r + 1]) g.px(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 1.3, c, a); }
}
function bigBang(g, x, y, n, c) { // a little pixel exclamation mark, n px tall
  g.rect(x - 1, y, 2, n - 3, c, 1); g.rect(x - 1, y + n - 2, 2, 2, c, 1);
}

// ---- timelines ----------------------------------------------------------------------------------
// Each skill: { ms (loop), stopAt, stopMs (hit-stop), cast (release moment) }. `et` = effect time (frozen in the hit-stop).
export const SKILLS = {
  defense_bash: { id: 'defense_bash', name: skills.defense_bash.name, castMs: skills.defense_bash.castMs },
  challenge: { id: 'challenge', name: skills.challenge.name, castMs: skills.challenge.castMs },
};
for (const [id, sp] of Object.entries(SPECS)) SKILLS[id] = { id, name: skillDef(id).name, castMs: skillDef(id).castMs, hero: sp.hero };
// The Rogue's skills play the GAME'S OWN recipes (src/systems/skillFx.js: rogueCharge, rogueDash, rogueSlash, smokeBomb)
// with the game's dash / wave numbers (combat.json skillFx.dash / wave), so what the page shows is what the game does.
const RDASH = FX.dash.multistrike, RWAVE = FX.wave.multistrike;
const MS_WAVES = skills.multistrike.channel.waves.length, MS_EVERY = skills.multistrike.channel.intervalMs;
const DASH = 80; // ms from release to contact (Defense Bash)
function plan(skillId, look) {
  const cast = SKILLS[skillId].castMs;
  const sp = SPECS[skillId];
  if (sp) {
    const attack = skillDef(skillId).kind === 'attack';
    if (look === 'now') return { cast, impact: cast, stopMs: attack ? FX.hitStopMs : 0, end: cast + Math.max(1700, fxMs(sp.now.recipe) + 300) };
    const hit = sp.new.hit || { at: 0, stopMs: 0 };
    return { cast, impact: cast + hit.at, stopMs: hit.stopMs || 0, end: cast + Math.max(1700, fxMs(sp.new.recipe) + 300) };
  }
  if (look === 'now') return { cast, impact: cast, stopMs: skillId === 'defense_bash' ? FX.hitStopMs : 0, end: cast + 1500 };
  if (skillId === 'defense_bash') return { cast, impact: cast + DASH, stopMs: 80, end: cast + DASH + 1700 };
  return { cast, impact: cast + 130, stopMs: 40, end: cast + 130 + 3300 };
}
export function loopMs(skillId, look) { const p = plan(skillId, look); return p.end + p.stopMs + 500; }

export class Demo {
  constructor() {
    const knight = heroes.find((h) => h.id === 'knight');
    this.knight = this.hero = actor(knight, 34, 82, false);
    this.minionActors = [actor(minionDefs.skeleton, 50, 90, false), actor(minionDefs.skeleton, 58, 78, false)]; // a necromancer's skeletons (spec `minions`)
    this.allyActor = actor(knight, 74, 84, false); // the hurt hero a healer's skill lands on (heroes.js spec `ally`)
    this.actors = { knight: this.knight };
    for (const sp of Object.values(SPECS)) if (!this.actors[sp.hero]) this.actors[sp.hero] = actor(heroes.find((h) => h.id === sp.hero), 34, 82, false);
    this.foe = actor(enemies.goblin, 90, 82, true);
    this.foe2 = actor(enemies.slime, 112, 86, true);
    this.icon = {};
    for (const id of Object.keys(SKILLS)) this.icon[id] = icons[id];
  }

  // Draw one moment. opts = { skill, look: 'now'|'new', name: 'A'|'B'|'now', t (ms in the loop) }
  draw(ctx, opts) {
    const P = plan(opts.skill, opts.look);
    const T = opts.t;
    this.hero = this.actors[SKILLS[opts.skill].hero || 'knight'];
    this.ally = SPECS[opts.skill] && SPECS[opts.skill].ally ? this.allyActor : null;
    this.minions = SPECS[opts.skill] && SPECS[opts.skill].minions ? this.minionActors : [];
    // Effect time: freezes for the hit-stop at the impact.
    const et = T < P.impact ? T : T < P.impact + P.stopMs ? P.impact : T - P.stopMs;
    const st = { hero: { dx: 0, dy: 0 }, ally: { dx: 0, dy: 0, hp: 13 }, mins: [{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }], foe: { dx: 0, dy: 0 }, foe2: { dx: 0, dy: 0 }, cam: { zoom: 1, fx: 195, fy: 200, kx: 0, ky: 0, shake: 0 }, flash: null, lines: null, under: pen(), over: pen(), numbers: [] };
    if (SPECS[opts.skill]) this.specLook(st, opts.skill, opts.look, et, P, T);
    else if (opts.look === 'now') this.nowLook(st, opts.skill, et, P, T);
    else if (opts.skill === 'defense_bash') this.newBash(st, et, P, T);
    else this.newChallenge(st, et, P, T);

    // camera: zoom about a focus point, a kick offset, and a shake (wall time, it keeps going through the hit-stop)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W * Z, H * Z);
    const c = st.cam;
    const sh = c.shake > 0 ? [Math.round((rnd(Math.floor(T / 30)) - 0.5) * 2 * c.shake), Math.round((rnd(Math.floor(T / 30) + 7) - 0.5) * 2 * c.shake)] : [0, 0];
    ctx.setTransform(c.zoom, 0, 0, c.zoom, c.fx - c.fx * c.zoom + c.kx + sh[0], c.fy - c.fy * c.zoom + c.ky + sh[1]);
    this.room(ctx);
    blit(ctx, st.under.out);
    for (const [a, s] of [[this.foe2, st.foe2], [this.foe, st.foe], ...this.minions.map((m, i) => [m, st.mins[i]]).filter(([, s]) => !s.gone), ...(this.ally ? [[this.ally, st.ally]] : []), [this.hero, st.hero]]) {
      if (s.ghosts) for (const gh of s.ghosts) drawActor(ctx, a, gh);
      if (s.aura) this.aura(ctx, a, s);
      drawActor(ctx, a, s);
    }
    this.bars(ctx, st, et, P, opts.look);
    blit(ctx, st.over.out);
    for (const n of st.numbers) text(ctx, n.text, n.x, n.y, n.size, n.color, n.alpha, 3, n.scale);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // screen space: speed lines, flash, the name
    if (st.lines) this.speedLines(ctx, st.lines, T);
    if (st.flash) { ctx.globalAlpha = st.flash[1]; ctx.fillStyle = hex(st.flash[0]); ctx.fillRect(0, 0, W * Z, H * Z); ctx.globalAlpha = 1; }
    this.skillName(ctx, opts, et, P);
  }

  room(ctx) {
    ctx.fillStyle = '#1b1629'; ctx.fillRect(-60, -60, W * Z + 120, FLOOR * Z + 60);
    ctx.fillStyle = '#251d38'; for (let y = 6; y < FLOOR; y += 8) for (let x = ((y / 8) % 2) * 8 - 20; x < W + 20; x += 16) ctx.fillRect(x * Z, y * Z, 15 * Z, 7 * Z);
    ctx.fillStyle = '#2b2236'; ctx.fillRect(-60, FLOOR * Z, W * Z + 120, (H - FLOOR) * Z + 60);
    ctx.fillStyle = '#332941'; for (let y = FLOOR + 4; y < H + 20; y += 9) for (let x = ((y / 9) % 2) * 10 - 20; x < W + 20; x += 20) ctx.fillRect(x * Z, y * Z, 19 * Z, 8 * Z);
    ctx.fillStyle = '#3f3452'; ctx.fillRect(-60, FLOOR * Z, W * Z + 120, Z);
  }

  // Health bars over everyone, and the hero's charge bar while he winds up (like the game).
  bars(ctx, st, et, P, look) {
    for (const [a, s, col] of [[this.hero, st.hero, '#5dd06a'], ...(this.ally ? [[this.ally, st.ally, '#5dd06a']] : []), [this.foe, st.foe, '#e0503a'], [this.foe2, st.foe2, '#e0503a']]) {
      const u = body(a, s.dx, s.dy);
      const x = Math.round(u.x * Z - 15), y = Math.round(u.top * Z - 12);
      ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, 32, 6);
      ctx.fillStyle = col; ctx.fillRect(x, y, a === this.hero ? 30 : s.hp ?? 30, 4);
      if (s.shield) { ctx.fillStyle = '#ffe08a'; ctx.fillRect(x, y - 3, Math.round(30 * s.shield), 2); }
      if (a === this.hero && et < P.cast) {
        ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y + 5, 32, 5);
        ctx.fillStyle = look === 'now' ? FX.attackColor : heroColor(this.hero.def.id) || KNIGHT.text; ctx.fillRect(x, y + 6, Math.round(30 * et / P.cast), 3);
      }
    }
  }

  // The charge aura: the hero's outline lit in steel blue, flickering, plus a soft second ring.
  aura(ctx, a, s) {
    const { a: al, t } = s.aura;
    for (const [x, y] of a.outline) {
      const f = 0.6 + 0.4 * Math.sin(t / 40 + x * 0.9 + y * 0.7);
      ctx.globalAlpha = clamp(al * f); ctx.fillStyle = hex(f > 0.85 ? KNIGHT.white : KNIGHT.mid);
      ctx.fillRect((a.fx + x + s.dx) * Z, (a.fy + y + (s.dy || 0)) * Z, Z, Z);
    }
    ctx.globalAlpha = 1;
  }

  speedLines(ctx, L, T) {
    ctx.globalAlpha = L.a;
    if (L.kind === 'side') {
      for (let i = 0; i < 14; i++) {
        const y = Math.round((40 + rnd(i * 5 + Math.floor(T / 50)) * 220) / Z) * Z;
        const len = 60 + rnd(i * 3) * 140, x = ((T * 2.2 + rnd(i) * 600) % 700) - 200;
        ctx.fillStyle = i % 3 ? hex(KNIGHT.light) : '#ffffff'; ctx.fillRect(Math.round(x / Z) * Z, y, Math.round(len / Z) * Z, i % 4 ? Z : 2 * Z);
      }
    } else { // focus lines from the screen edges towards the hero
      const cx = L.x, cy = L.y;
      for (let i = 0; i < 20; i++) {
        const ang = (i / 28) * Math.PI * 2 + rnd(i + Math.floor(T / 60)) * 0.2;
        const r0 = 110 + rnd(i * 7 + Math.floor(T / 60)) * 60, r1 = 300;
        for (let r = r0; r < r1; r += Z) {
          const w = r - r0 > 90 ? 2 : 1;
          ctx.fillStyle = i % 2 ? '#ffffff' : hex(KNIGHT.light);
          ctx.fillRect(Math.round((cx + Math.cos(ang) * r) / Z) * Z, Math.round((cy + Math.sin(ang) * r) / Z) * Z, w * Z, w * Z);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- TODAY'S LOOK (BattleScene.skillBurst + playSkillFx + castWindUp) ----------------------------
  nowLook(st, id, et, P, T) {
    const h = st.hero;
    if (et < P.cast) { h.dy = 1; h.dx = -1; }
    const since = et - P.cast;
    if (since >= 0) {
      if (since < FX.flashMs) h.tint = [0xff7a3d, 0.6];
      const q = Math.min(1, since / (id === 'defense_bash' ? 600 : 900));
      const H0 = body(this.hero, h.dx, h.dy), E0 = body(this.foe), E1 = body(this.foe2);
      if (id === 'defense_bash') {
        const lunge = since < 120 ? easeOut(since / 120) : 1 - ph(since, 120, 320);
        h.dx = lunge * 14; h.dy = -Math.sin(Math.min(1, since / 240) * Math.PI) * 3;
        if (q < 1) st.over.out.push(...castFx('shieldBash', q, { caster: H0, targets: [E0], squad: [H0], enemies: [E0, E1] }, et).draws);
        if (T >= P.impact && T < P.impact + FX.shakeMs) st.cam.shake = FX.shakeIntensity * 390;
        st.foe.tint = since < 120 ? [0xffffff, 0.6] : null;
        st.foe.hp = 18;
        this.number(st, '128', E0, since, true);
        if (since < 2000) for (let i = 0; i < 3; i++) { const a = et / 150 + (i * Math.PI * 2) / 3; st.over.px(E0.x + Math.cos(a) * 5, E0.top - 2 + Math.sin(a) * 2, STAR, 1); }
      } else {
        h.dy = -Math.sin(Math.min(1, since / 400) * Math.PI) * 6;
        const o = castFx('challenge', q, { caster: H0, targets: [E0, E1], squad: [H0], enemies: [E0, E1] }, et);
        if (q < 1) st.over.out.push(...o.draws);
        if (q < 0.8) h.tint = [C.shield, 0.25];
      }
    }
  }

  // ---- ROGUE (today vs the game's new recipes) -----------------------------------------------------
  specLook(st, id, look, et, P, T) {
    const SP = SPECS[id], L = SP[look] || SP.new, sk = skillDef(id), h = st.hero, since = et - P.cast, hero = this.hero;
    const A0 = this.ally ? body(this.ally) : null;
    const E0 = body(this.foe), E1 = body(this.foe2), foes = [[this.foe, st.foe], [this.foe2, st.foe2]];
    const tintOn = (s, tint) => { if (tint && (!s.tint || tint[1] > s.tint[1])) s.tint = tint; };
    const support = sk.kind !== 'attack';
    const self = support && sk.target !== 'enemy'; // a support skill on herself / the squad (Hunter's Mark targets an enemy)
    const play = (name, q, c) => {
      const o = runFx(name, q, c, et); st.over.out.push(...o.draws);
      for (const [l, i, tint] of o.tints) {
        if (l === 'minions') { tintOn(st.mins[i] || {}, tint); continue; }
        if (SP.squadTargets && (l === 'targets' || l === 'squad')) { tintOn(i === 0 ? h : st.ally, tint); continue; }
        if (A0 && (l === 'targets' || (l === 'squad' && i === 1))) { tintOn(st.ally, tint); continue; }
        if (l === 'caster') tintOn(h, tint);
        else if (l === 'enemies') tintOn((foes[i] || [])[1] || {}, tint);
        else if (l === 'targets') tintOn(self ? h : (foes[i] || [])[1] || {}, tint);
        else if (l === 'squad') tintOn(h, tint);
      }
    };
    const ch = sk.channel, ch0 = () => !!ch;
    const radius = L.radius === 'landSplash' && sk.landSplash ? sk.landSplash.radius / Z : L.radius === 'holyNova' && sk.holyNova ? sk.holyNova.radius / Z : L.radius === 'area' && sk.area ? sk.area.radius / Z : 30;
    if (et < P.cast) { // the wind-up
      h.dy = 1; h.dx = -1;
      if (look === 'new') {
        if (L.tremble) h.dx += Math.round(Math.sin(et / 23) * (et / P.cast) * 1.4);
        play(L.charge, et / P.cast, { caster: body(hero, h.dx, h.dy), targets: [], squad: [], enemies: [], song: SP.song });
      }
      return;
    }
    // movement
    const mv = look === 'now' ? { type: L.move } : L.move || {};
    const dist = Math.hypot(E0.x - body(hero).x, E0.mid - body(hero).mid);
    if (mv.type === 'lunge') { const l = since < 90 ? easeOut(since / 90) : 1 - ph(since, 90, 180); h.dx = l * 9; }
    if (mv.type === 'hop') h.dy = -Math.sin(Math.min(1, since / 320) * Math.PI) * ((mv.liftPx || 18) / Z);
    if (mv.type === 'recoil') { const r = since < 50 ? easeOut(since / 50) : 1 - easeOut(ph(since, 50, 320)); h.dx = -((mv.px || 6) / Z) * r; } // the bow's kick: she rocks back
    if (mv.type === 'leap') { // like BattleScene.leapAt: up and over to 80% of the way, then back
      const up = mv.upMs || 230, hold = mv.holdMs ?? 120, back = mv.backMs || 300, share = mv.share || 0.8;
      const p = since < up ? (mv.slam ? since / up : easeOut(since / up)) : since < up + hold ? 1 : 1 - ph(since, up + hold, up + hold + back);
      h.dx = (E0.x - body(hero).x) * share * p;
      // slam: shoots up fast, hangs, then SLAMS down (the peak comes early, the fall is quick)
      const a = Math.min(1, since / up), arc = mv.slam ? Math.sin(Math.pow(a, 0.6) * Math.PI) : Math.sin(a * Math.PI);
      h.dy = -arc * ((mv.liftPx || 26) / Z) * (since < up ? 1 : 0);
      if (mv.slam && since >= up && since < up + 90) h.dy = 1; // squash on landing
    }
    if (mv.type === 'dash') {
      const D = FX.dash[mv.config], reachPx = Math.max(D.minPx, dist * Z - D.stopPx);
      const go = since < D.inMs ? (since / D.inMs) ** 2 : since < D.inMs + D.holdMs ? 1 : 1 - easeOut(ph(since, D.inMs + D.holdMs, D.inMs + D.holdMs + D.outMs));
      h.dx = (reachPx / Z) * go;
    }
    if (look === 'now' && since < FX.flashMs) h.tint = [support ? 0x5dff96 : 0xff7a3d, 0.6];
    if (look === 'new' && since < 80) tintOn(h, [Number('0x' + (heroColor(hero.def.id) || '#ffffff').slice(1)), 0.5]);
    const C0 = body(hero, h.dx, h.dy);
    const land = mv.type === 'leap' ? { x: body(hero).x + (E0.x - body(hero).x) * (mv.share || 0.8), y: body(hero).y } : null; // where he lands: fixed
    const M0 = this.minions.map((m, i) => body(m, st.mins[i].dx, st.mins[i].dy));
    if (L.minionsGone != null) st.mins.forEach((m, i) => { const gt = since - L.minionsGone; if (gt >= 0 && (!L.minionsFade || gt > 300)) m.gone = true; else if (gt >= 0) m.alpha = 1 - gt / 300; if (!m.gone && L.minionsShake && since >= 0) m.dx = Math.round(Math.sin(et / 25 + i) * 0.8); });
    const c = { caster: C0, targets: SP.squadTargets ? [C0, ...(A0 ? [A0] : [])] : A0 ? [A0] : self ? [C0] : [E0], squad: A0 ? [C0, A0] : [C0], enemies: [E0, E1], minions: M0, hitMs: L.hit ? L.hit.at : (mv.config ? FX.dash[mv.config].inMs : 0), radius, land, song: SP.song, ...(L.rain && sk.channel ? { every: L.rain.every, waves: sk.channel.waves.length } : {}) };
    if (L.hit && L.hit.knockPx && land) { // enemies inside the landing area are thrown back, away from where he lands
      const ht = et - P.impact;
      if (ht >= 0) for (const [a, s] of foes) { const e = body(a); if (Math.hypot(e.x - land.x, (e.y - land.y) * 1.4) > radius) continue; const k = (L.hit.knockPx / Z) * easeOut(ph(ht, 0, 90)) * (1 - easeOut(ph(ht, 200, 600))); s.dx = Math.sign(e.x - land.x || 1) * k; }
    }
    const ms = fxMs(L.recipe);
    if (since < ms) play(L.recipe, since / ms, c);
    if (look === 'now' && !support && T >= P.impact && T < P.impact + FX.shakeMs) st.cam.shake = FX.shakeIntensity * 390;
    if (L.hit && T >= P.impact && T < P.impact + P.stopMs + L.hit.shakeMs) st.cam.shake = L.hit.shake * (1 - (T - P.impact) / (P.stopMs + L.hit.shakeMs));
    if (L.hit && L.hit.jitterPx) { // the hit enemies jitter side to side (user: enemies shake when hit hard)
      foes.forEach(([a, s], i) => {
        if (i > 0 && !L.hit.jitterAll) return; const e = body(a); if (L.radius === 'area' && Math.hypot(e.x - E0.x, (e.y - E0.y) * 1.4) > radius) return;
        const jt = et - P.impact - i * (L.hit.jitterStagger || 0); if (jt < 0 || jt >= L.hit.jitterMs) return;
        const j = jt / L.hit.jitterMs; s.dx = Math.round((Math.sin(j * Math.PI * 6) * L.hit.jitterPx * (1 - j)) / Z);
      });
    }
    if (L.charmed && since >= L.charmed.from) { // charmed: the goblin turns round, they take turns bumping into each other
      const ct = since - L.charmed.from, n = Math.floor(ct / L.charmed.every), f = (ct % L.charmed.every) / L.charmed.every;
      st.foe.flip = true;
      const [att, vic, dir] = n % 2 ? [st.foe2, st.foe, -1] : [st.foe, st.foe2, 1];
      const lunge = f < 0.25 ? easeOut(f / 0.25) : 1 - ph(f, 0.25, 0.6); att.dx = dir * 3 * lunge;
      if (f > 0.22 && f < 0.5) { const j = (f - 0.22) / 0.28; vic.dx = Math.round(Math.sin(j * Math.PI * 4) * 1.5 * (1 - j)); }
      if (f > 0.22 && f < 0.36) { const mx = (E0.x + E1.x) / 2, my = (E0.mid + E1.mid) / 2; for (let i = 0; i < 6; i++) { const an = (i / 6) * Math.PI * 2, d = 2 + 5 * (f - 0.22) / 0.14; st.over.px(mx + Math.cos(an) * d, my + Math.sin(an) * d, i % 2 ? 0xffffff : 0xff7ac8, 1); } }
    }
    if (L.foeLunge) { const ft = since - L.foeLunge.at; if (ft >= 0 && ft < L.foeLunge.ms) { const f = ft / L.foeLunge.ms; st.foe.dx = -(L.foeLunge.px / Z) * (f < 0.4 ? easeOut(f / 0.4) : 1 - ph(f, 0.4, 1)); } } // an enemy swings at the hero
    if (L.squadShield) { const at = since - (L.hit ? L.hit.at : 0); if (at >= 0) { const v = easeOut(ph(at, 0, 200)) * (1 - ph(at, 2500, 3000)); h.shield = v; if (A0) st.ally.shield = v; } }
    if (L.text) { const tt = since - L.text.at, E = L.text.self ? C0 : c.targets[0]; if (tt >= 0 && tt < 1100) st.numbers.push({ text: L.text.s, x: clampX(E.x * Z, L.text.s, 14), y: (E.top - 10) * Z - Math.round(ph(tt, 0, 1100) * 24), size: 14, color: L.text.color, alpha: ph(tt, 0, 100) * (1 - ph(tt, 800, 1100)) }); }
    // rain waves (Arrow Rain): every wave lands on all enemies inside the area: a small shake, they jitter, a number each
    if (L.rain && ch0()) {
      const R = L.rain, n = sk.channel.waves.length;
      for (let w = 0; w < n; w++) {
        const wt = since - L.hit.at - w * R.every; if (wt < 0) continue;
        const last = w === n - 1;
        if (wt < R.shakeMs) st.cam.shake = Math.max(st.cam.shake, (last ? R.lastShake : R.shake) * (1 - wt / R.shakeMs));
        foes.forEach(([a, s], i) => {
          const e = body(a); if (Math.hypot(e.x - E0.x, (e.y - E0.y) * 1.4) > radius) return;
          const jt = wt - i * 12;
          if (jt >= 0 && jt < R.jitterMs) { const j = jt / R.jitterMs; s.dx = Math.round((Math.sin(j * Math.PI * 6) * (last ? R.lastJitterPx : R.jitterPx) * (1 - j)) / Z); }
          this.number(st, L.number, { ...e, top: e.top - w * 3 }, jt, true);
        });
      }
      return;
    }
    // channel waves (Multistrike)
    if (ch && L.waves) {
      const W = FX.wave[L.waves], D = FX.dash[L.waves], n = ch.waves.length;
      for (let w = 0; w < n; w++) {
        const wt = since - (D ? D.inMs : 0) - w * ch.intervalMs; if (wt < 0) continue;
        const last = w === n - 1;
        if (wt < fxMs(W.recipe)) play(W.recipe, wt / fxMs(W.recipe), { ...c, wave: w, waves: n });
        const sm = last ? W.lastShakeMs : W.shakeMs; if (wt < sm) st.cam.shake = (last ? W.lastShakeIntensity : W.shakeIntensity) * 390 * (1 - wt / sm);
        if (wt < W.targetShakeMs) { const j = wt / W.targetShakeMs; st.foe.dx = Math.round((Math.sin(j * Math.PI * 6) * (last ? W.lastTargetShakePx : W.targetShakePx) * (1 - j)) / Z); }
        this.number(st, L.number, { ...E0, top: E0.top - w * 3 }, wt, true);
      }
    } else if (ch && L.rings) {
      for (let w = 0; w < ch.waves.length; w++) {
        const wt = since - w * ch.intervalMs; if (wt < 0 || wt > 400) continue;
        st.over.ring(C0.x, C0.mid, (10 + (14 + w * 10) * (wt / 400)) / Z, 0xffd84d, 1 - wt / 400);
        if (wt < 120) st.foe.tint = [0xffffff, 0.5];
        this.number(st, L.number, { ...E0, top: E0.top - w * 3 }, wt, true);
      }
    } else if (L.heal && A0) { // a heal on the ally: green number, its bar fills; damage numbers on the enemies around it
      const at = since - (L.hit ? L.hit.at : 0);
      if (at >= 0) { st.ally.hp = 13 + Math.round(11 * easeOut(ph(at, 0, 300))); this.number(st, L.heal, A0, at, false, '#6dff8f'); }
      if (L.shield && at >= 0) st.ally.shield = 1 - ph(at, 2500, 3000);
      if (L.number) for (const [a, E] of [[this.foe, E0], [this.foe2, E1]]) if (Math.hypot(E.x - A0.x, (E.y - A0.y) * 1.4) <= radius) this.number(st, L.number, E, at - 60, true);
    } else if (L.number) {
      const at = since - (L.hit ? L.hit.at : L.numberAt || 0);
      this.number(st, L.number, E0, at, true, L.numberColor);
      if (L.numberAll) this.number(st, L.number2 || L.number, E1, at - (L.number2At ?? 40), true, L.numberColor);
    }
  }

  // ---- NEW: Defense Bash (calm v3, user: 'impact too flashy' then 'I don't understand the geometric effects') ---------
  // No screen flash, no speed lines, a tiny camera nudge, a short freeze; the shield's print flashes where it hits,
  // a few chips fly, the enemy skids back in a little dust.
  newBash(st, et, P, T) {
    const h = st.hero, K = KNIGHT;
    const H0 = body(this.hero), E0 = body(this.foe);
    const contactDx = E0.x - E0.hw - (H0.x + H0.hw) - 1;
    this.charge(st, et, P);
    const since = et - P.cast;
    if (since >= 0) {
      const kick = since < 60 ? easeOut(since / 60) : 1 - easeOut3(ph(since, 60, 300));
      st.cam = { ...st.cam, zoom: 1 + 0.03 * kick, fx: (H0.x + E0.x) / 2 * Z, fy: E0.mid * Z, kx: 2 * kick, ky: 0 };
      const dash = since < DASH ? easeOut(since / DASH) : 1 - easeOut(ph(since, DASH + 200, DASH + 480));
      h.dx = -2 + (contactDx + 2) * dash; h.dy = since < DASH ? -1 : 0;
      if (since < DASH + 120) h.ghosts = [{ dx: -2 + (contactDx + 2) * (since < DASH ? easeOut(since / DASH) * 0.5 : 0.5), dy: 0, tint: [K.deep, 0.7], alpha: 0.3 * (1 - ph(since, DASH, DASH + 120)) }];
      h.tint = since < 80 ? [K.light, 0.4] : null;
    }
    const hit = et - P.impact;
    if (hit >= 0 || T >= P.impact) {
      if (T >= P.impact && T < P.impact + P.stopMs + 120) st.cam.shake = 2 * (1 - (T - P.impact) / (P.stopMs + 120));
      const px = E0.x - E0.hw, py = E0.mid; // the contact point
      const g = st.over, u = st.under;
      st.foe.tint = hit < 60 ? [0xffffff, 0.7] : null;
      st.foe.dx = hit < 40 ? 0 : 4 * (1 - easeOut(ph(hit, 40, 360))) * easeOut(ph(hit, 0, 80));
      st.foe.hp = 18;
      // the shield's print flashes on the enemy where it hit: white, then steel blue, fading
      const sp = ph(hit, 0, 420);
      if (sp < 1) shield(g, px + 1, py, 3, hit < 70 ? K.white : K.light, hit < 70 ? K.white : K.mid, sp < 0.35 ? 1 : 1 - (sp - 0.35) / 0.65); // 3x (user: 'should be bigger!'), same as the game
      for (let i = 0; i < 6; i++) {
        const p = ph(hit, 0, 380 + rnd(i) * 120); if (p <= 0 || p >= 1) continue;
        const a = -Math.PI / 2 + (rnd(i * 3) - 0.3) * 2.4, d = (6 + rnd(i * 7) * 10) * easeOut(p);
        g.px(px + Math.cos(a) * d, py + Math.sin(a) * d * 0.8 + p * p * 10, [K.light, K.mid, K.deep][i % 3], 1 - p);
      }
      dust(g, E0.x + st.foe.dx, E0.y, ph(hit, 0, 450), 8, 3); // he skids back: a little dust at his feet
      this.number(st, '128', E0, hit, true);
      if (hit > 60 && hit < 1600) for (let i = 0; i < 3; i++) { const a = et / 150 + (i * Math.PI * 2) / 3; g.px(E0.x + st.foe.dx + Math.cos(a) * 5, E0.top - 2 + Math.sin(a) * 2, STAR, 1); }
    }
  }

  // ---- NEW: Challenge (calm version) ------------------------------------------------------------
  // A small hop, he SHOUTS (sound waves roll out towards the enemies), a red "!" over each taunted enemy (they step
  // towards him), a little blue shield pops over his head for the +30 defense.
  newChallenge(st, et, P, T) {
    const h = st.hero, K = KNIGHT;
    const H0 = body(this.hero);
    this.charge(st, et, P);
    const since = et - P.cast;
    if (since >= 0) {
      const z = since < 130 ? easeOut(since / 130) : 1 - easeOut3(ph(since, 130, 400));
      st.cam = { ...st.cam, zoom: 1 + 0.025 * z, fx: H0.x * Z, fy: H0.mid * Z };
      h.dy = since < 130 ? -4 * Math.sin((since / 130) * Math.PI / 2) : -4 * (1 - easeOut(ph(since, 130, 170)));
      h.dx = 0;
      h.tint = since < 80 ? [K.light, 0.4] : null;
    }
    const hit = et - P.impact;
    if (hit >= 0) {
      if (T >= P.impact && T < P.impact + P.stopMs + 100) st.cam.shake = 1.5 * (1 - (T - P.impact) / (P.stopMs + 100));
      const g = st.over, u = st.under, fx = H0.x, fy = H0.y;
      const life = skills.challenge.apply[0].durationMs;
      // he shouts: three sound waves roll out from his head towards the enemies; dust where he lands
      for (let k = 0; k < 3; k++) { const p = ph(hit, k * 70, k * 70 + 380); if (p > 0 && p < 1) shout(g, H0.x + H0.hw, H0.top + 4, 4 + 30 * easeOut(p), k === 0 ? K.white : K.light, 1 - p); }
      dust(g, fx, fy, ph(hit, 0, 400), 8, 9);
      [[this.foe, st.foe], [this.foe2, st.foe2]].forEach(([a, s], i) => {
        const e = body(a); const d = 80 + i * 60;
        s.dx = -3 * easeOut(ph(hit, d, d + 200)); s.tint = hit > d && hit < d + 100 ? [RED, 0.4] : null;
        if (hit > d && hit < life) { const drop = Math.round(4 * (1 - easeOut3(ph(hit, d, d + 140)))); bigBang(g, e.x + s.dx, e.top - 12 - drop, 7, RED); }
      });
      // +30 defense: a little blue shield pops up beside him and he shines blue for a moment
      const bp = ph(hit, 60, 900);
      if (bp > 0 && bp < 1) shield(g, H0.x - H0.hw - 7, H0.mid - 2 - Math.round(easeOut(bp) * 4), 1, K.light, K.mid, bp < 0.7 ? 1 : 1 - (bp - 0.7) / 0.3);
      if (hit > 60 && hit < 360) st.hero.tint = [K.mid, 0.3 * (1 - (hit - 60) / 300)];
      if (hit > 420 && hit < 1300) st.numbers.push({ text: '+30 DEF', x: (H0.x + H0.hw + 22) * Z, y: H0.mid * Z - Math.round(ph(hit, 420, 1300) * 24), size: 14, color: KNIGHT.text, alpha: ph(hit, 420, 520) * (1 - ph(hit, 1000, 1300)) }); // after the shout
    }
  }

  // CHARGE (both new skills): crouch, the outline lights up, specks are pulled in, a soft glow on the floor.
  charge(st, et, P) {
    if (et >= P.cast) return;
    const p = et / P.cast, K = KNIGHT, h = st.hero;
    h.dy = 1; h.dx = -Math.round(2 * easeOut(p));
    h.aura = { a: 0.35 + 0.65 * p, t: et };
    const u = body(this.hero, h.dx, h.dy);
    for (let i = 0; i < 8; i++) {
      const s = (p * 1.7 + i / 12) % 1, a = rnd(i * 13) * Math.PI * 2, r = 22 * (1 - easeOut(s));
      st.over.rect(u.x + Math.cos(a) * r, u.mid + Math.sin(a) * r * 0.8, i % 3 ? 1 : 2, i % 3 ? 1 : 2, i % 2 ? K.light : K.mid, s * 0.9);
    }
    st.under.ring(u.x, u.y, 4 + 5 * p, 1.5 + 1 * p, K.mid, 0.3 + 0.5 * p);
    if (p > 0.6) { const b = Math.sin(et / 30) > 0 ? 1 : 0.4, x = u.x + u.hw + 2, y = u.mid - 4; st.over.px(x, y, K.white, b); st.over.px(x - 1, y, K.light, b); st.over.px(x + 1, y, K.light, b); st.over.px(x, y - 1, K.light, b); st.over.px(x, y + 1, K.light, b); }
  }

  number(st, txt, E0, since, skill, color = FX.attackColor) {
    if (since < 0 || since > 1000) return;
    const pop = since < 150 ? 1.5 - 0.5 * easeOut(since / 150) : 1; // the game's skill number pop (unchanged: user is fine with it)
    st.numbers.push({ text: txt, x: E0.x * Z, y: (E0.top - 8) * Z - Math.round((since / 1000) * 30), size: FX.numberSizePx, color, alpha: 1 - since / 1000, scale: skill ? pop : 1 });
  }

  // ---- THE SKILL NAME -----------------------------------------------------------------------------
  skillName(ctx, opts, et, P) {
    const name = SKILLS[opts.skill].name;
    if (opts.name === 'now') {
      // today: the name pops over him at the wind-up (14px, rises, fades) AND a 24px banner grows 0.5 -> 1 at the cast
      const H0 = body(this.hero);
      if (et < 800) text(ctx, name, clampX(H0.x * Z, name, 14), (H0.top * Z - 22) - (et / 800) * 30, 14, '#9fc4ff', 1 - et / 800, 3);
      const s = et - P.cast;
      if (s >= 0 && s < FX.bannerMs) {
        const sc = s < 160 ? 0.5 + 0.5 * backOut(s / 160) : 1;
        const fade = ph(s, FX.bannerMs * 0.6, FX.bannerMs);
        text(ctx, name, 195, 60 - fade * 16, 24, FX.attackColor, 1 - fade, 5, sc);
      }
      return;
    }
    const s = et - P.cast;
    if (s < 0) return;
    if (opts.name === 'A') this.cutIn(ctx, opts.skill, name, s);
    else this.floatName(ctx, name, s);
  }

  // A: a dark band slides in from the left, holds, slides out to the right. Icon x2 + name 16px in the hero colour.
  cutIn(ctx, id, name, s) {
    const IN = 110, HOLD = 760, OUT = 140; if (s > IN + HOLD + OUT) return;
    const bx = s < IN ? -390 * (1 - easeOut3(s / IN)) : s < IN + HOLD ? 0 : 390 * easeOut(ph(s, IN + HOLD, IN + HOLD + OUT));
    const lag = s < IN + 60 ? -40 * (1 - easeOut3(clamp(s / (IN + 60)))) : 0; // the icon and name arrive a beat later
    const y = 24, hgt = 48, x0 = Math.round(bx / 3) * 3;
    ctx.fillStyle = 'rgba(0,0,0,0.88)'; ctx.fillRect(x0, y, 390, hgt);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x0, y, 390, 3); ctx.fillRect(x0, y + hgt - 3, 390, 3);
    ctx.fillStyle = hex(KNIGHT.deep); ctx.fillRect(x0, y + 3, 390, 3); // hero-colour line under the top edge
    // diagonal hero-colour slashes at the right end (motion)
    ctx.fillStyle = hex(KNIGHT.deep);
    for (let k = 0; k < 3; k++) for (let j = 0; j < hgt - 12; j += 3) ctx.fillRect(x0 + 306 + k * 24 + Math.round((hgt - 12 - j) / 6) * 3, y + 6 + j, 9, 3);
    const ix = Math.round((x0 + 18 + lag) / 3) * 3;
    drawIcon(ctx, this.icon[id], ix, y + 8, 2);
    text(ctx, name.toUpperCase(), ix + 44, y + hgt / 2 + 1, 16, KNIGHT.text, 1, 4, 1, 'left');
    text(ctx, 'KNIGHT', ix + 44, y + hgt / 2 + 15, 8, '#ffffff', 0.7, 0, 1, 'left');
  }

  // B: the name over the hero, fixed 16px, slides up 9px while it fades in, holds, then rises and fades.
  floatName(ctx, name, s) {
    const IN = 120, HOLD = 700, OUT = 300; if (s > IN + HOLD + OUT) return;
    const H0 = body(this.hero);
    const rise = s < IN ? 9 * (1 - easeOut(s / IN)) : s < IN + HOLD ? 0 : -9 * ph(s, IN + HOLD, IN + HOLD + OUT);
    const a = s < IN ? s / IN : 1 - ph(s, IN + HOLD, IN + HOLD + OUT);
    const y = Math.round((H0.top * Z - 50 + rise) / 3) * 3;
    const up = name.toUpperCase(); // user: all caps
    text(ctx, up, clampX(H0.x * Z, up, 16), y, 16, heroColor(this.hero.def.id) || KNIGHT.text, a, 4);
  }
}

const backOut = (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
function clampX(x, s, size) { const w = s.length * size; return Math.max(w / 2 + 6, Math.min(390 - w / 2 - 6, x)); }
export const FONT = '"Press Start 2P", "Courier New", monospace';
function text(ctx, s, x, y, size, color, alpha = 1, stroke = 3, scale = 1, align = 'center') {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  ctx.translate(Math.round(x), Math.round(y)); if (scale !== 1) ctx.scale(scale, scale);
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = stroke * 2 * 0.5 + 2; ctx.strokeStyle = '#000'; ctx.strokeText(s, 0, 0); }
  ctx.fillStyle = color; ctx.fillText(s, 0, 0);
  ctx.restore();
}
function blit(ctx, draws) {
  for (const [x, y, w, h, c, a] of draws) { ctx.globalAlpha = clamp(a); ctx.fillStyle = hex(c); ctx.fillRect(Math.round(x) * Z, Math.round(y) * Z, w * Z, h * Z); }
  ctx.globalAlpha = 1;
}
export function drawIcon(ctx, icon, x, y, s) {
  const pal = icon.palette.map((c) => hex(Number(c)));
  icon.rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') { ctx.fillStyle = pal[parseInt(ch, 36)]; ctx.fillRect(x + i * s, y + j * s, s, s); } }));
}
