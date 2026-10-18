// SKILL EFFECTS DEMO (proposal page, not game code): the Knight's two skills played on a slice of the fight screen at
// game size (390 px wide, characters x3), in four ways:
//   look 'now' = what the game shows today (name pops over him, then a 24px banner that grows 0.5 -> 1, small effect)
//   look 'new' = the proposed 3 beats in the Knight's colour/shape language (steel blue, squares):
//     CHARGE (aura + particles gather during the wind-up), RELEASE (flash, camera kick/zoom, speed lines, hit-stop),
//     IMPACT (big square shockwave, debris, a floor mark that lingers)
//   name 'A' = a CUT-IN BAR (dark band slides across: skill icon + name in the hero colour, never scaled)
//   name 'B' = a FLOATING NAME (fixed pixel size over the hero, slides up and fades, never scaled)
// Everything is drawn in CHARACTER pixels (1 = 3 screen px), like src/systems/skillFx.js; the page only picks what to play.
import heroes from '../../../src/data/heroes.json';
import enemies from '../../../src/data/enemies.json';
import skills from '../../../src/data/skills.json';
import icons from '../../../src/data/skillIcons.json';
import combat from '../../../src/data/combat.json';
import { artPixels, partArt, mixColor } from '../../../src/systems/pixelArt.js';
import { bodyBox, pen, FX_COLORS as C } from '../../../src/systems/statusFx.js';
import { castFx } from '../../../src/systems/skillFx.js';

export const Z = 3, W = 130, H = 96; // scene in character pixels; 390 x 288 on screen
const FLOOR = 54; // where the wall meets the floor
const FX = combat.skillFx;
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
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
function forPixels(a, dx, dy, fn) {
  for (const p of a.parts) p.px.forEach((row, y) => row.forEach((c, x) => {
    if (c === null) return;
    const relX = p.left + x;
    fn(Math.round((a.faceLeft ? a.fx - relX - 1 : a.fx + relX) + dx), Math.round(a.fy + p.top + y + dy), c);
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
  });
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
function bigBang(g, x, y, n, c) { // a little pixel exclamation mark, n px tall
  g.rect(x - 1, y, 2, n - 3, c, 1); g.rect(x - 1, y + n - 2, 2, 2, c, 1);
}

// ---- timelines ----------------------------------------------------------------------------------
// Each skill: { ms (loop), stopAt, stopMs (hit-stop), cast (release moment) }. `et` = effect time (frozen in the hit-stop).
export const SKILLS = {
  defense_bash: { id: 'defense_bash', name: skills.defense_bash.name, castMs: skills.defense_bash.castMs },
  challenge: { id: 'challenge', name: skills.challenge.name, castMs: skills.challenge.castMs },
};
const DASH = 80; // ms from release to contact (Defense Bash)
function plan(skillId, look) {
  const cast = SKILLS[skillId].castMs;
  if (look === 'now') return { cast, impact: cast, stopMs: skillId === 'defense_bash' ? FX.hitStopMs : 0, end: cast + 1500 };
  if (skillId === 'defense_bash') return { cast, impact: cast + DASH, stopMs: 140, end: cast + DASH + 2000 };
  return { cast, impact: cast + 130, stopMs: 90, end: cast + 130 + 3300 };
}
export function loopMs(skillId, look) { const p = plan(skillId, look); return p.end + p.stopMs + 500; }

export class Demo {
  constructor() {
    const knight = heroes.find((h) => h.id === 'knight');
    this.hero = actor(knight, 34, 82, false);
    this.foe = actor(enemies.goblin, 90, 82, true);
    this.foe2 = actor(enemies.slime, 112, 86, true);
    this.icon = {};
    for (const id of Object.keys(SKILLS)) this.icon[id] = icons[id];
  }

  // Draw one moment. opts = { skill, look: 'now'|'new', name: 'A'|'B'|'now', t (ms in the loop) }
  draw(ctx, opts) {
    const P = plan(opts.skill, opts.look);
    const T = opts.t;
    // Effect time: freezes for the hit-stop at the impact.
    const et = T < P.impact ? T : T < P.impact + P.stopMs ? P.impact : T - P.stopMs;
    const st = { hero: { dx: 0, dy: 0 }, foe: { dx: 0, dy: 0 }, foe2: { dx: 0, dy: 0 }, cam: { zoom: 1, fx: 195, fy: 200, kx: 0, ky: 0, shake: 0 }, flash: null, lines: null, under: pen(), over: pen(), numbers: [] };
    if (opts.look === 'now') this.nowLook(st, opts.skill, et, P, T);
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
    for (const [a, s] of [[this.foe2, st.foe2], [this.foe, st.foe], [this.hero, st.hero]]) {
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
    for (const [a, s, col] of [[this.hero, st.hero, '#5dd06a'], [this.foe, st.foe, '#e0503a'], [this.foe2, st.foe2, '#e0503a']]) {
      const u = body(a, s.dx, s.dy);
      const x = Math.round(u.x * Z - 15), y = Math.round(u.top * Z - 12);
      ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, 32, 6);
      ctx.fillStyle = col; ctx.fillRect(x, y, a === this.hero ? 30 : s.hp ?? 30, 4);
      if (a === this.hero && et < P.cast) {
        ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y + 5, 32, 5);
        ctx.fillStyle = look === 'now' ? FX.attackColor : KNIGHT.text; ctx.fillRect(x, y + 6, Math.round(30 * et / P.cast), 3);
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

  // ---- NEW: Defense Bash ------------------------------------------------------------------------
  newBash(st, et, P, T) {
    const h = st.hero, K = KNIGHT;
    const H0 = body(this.hero), E0 = body(this.foe);
    const contactDx = E0.x - E0.hw - (H0.x + H0.hw) - 1;
    this.charge(st, et, P);
    const since = et - P.cast;
    if (since >= 0) {
      // RELEASE: white flash then a blue wash, the camera kicks in towards the hit, speed lines, he dashes in.
      st.flash = since < 70 ? [0xffffff, 0.55 * (1 - since / 70)] : since < 220 ? [K.deep, 0.22 * (1 - (since - 70) / 150)] : null;
      const kick = since < 60 ? easeOut(since / 60) : 1 - easeOut3(ph(since, 60 + P.stopMs * 0, 420));
      st.cam = { ...st.cam, zoom: 1 + 0.1 * kick, fx: (H0.x + E0.x) / 2 * Z, fy: E0.mid * Z, kx: 8 * kick, ky: 0 };
      if (since < 260) st.lines = { kind: 'side', a: since < 200 ? 0.8 : 0.8 * (1 - (since - 200) / 60) };
      const dash = since < DASH ? easeOut(since / DASH) : 1 - easeOut(ph(since, DASH + 260, DASH + 560));
      h.dx = -2 + (contactDx + 2) * dash; h.dy = since < DASH ? -1 : 0;
      if (since < DASH + 200) h.ghosts = [0.35, 0.65].map((k) => ({ dx: -2 + (contactDx + 2) * (since < DASH ? easeOut(since / DASH) * k : k), dy: 0, tint: [K.deep, 0.7], alpha: 0.45 * (1 - ph(since, DASH, DASH + 200)) }));
      h.tint = since < 90 ? [K.light, 0.55] : null;
    }
    const hit = et - P.impact;
    if (hit >= 0 || T >= P.impact) {
      if (T >= P.impact && T < P.impact + P.stopMs + 220) st.cam.shake = 5 * (1 - (T - P.impact) / (P.stopMs + 220));
      const px = E0.x - E0.hw, py = E0.mid; // the contact point
      const g = st.over, u = st.under;
      // the enemy: white, then knocked back and squashed a little
      st.foe.tint = hit < 70 ? [0xffffff, 0.85] : hit < 160 ? [K.light, 0.4] : null;
      st.foe.dx = hit < 60 ? 0 : 7 * (1 - easeOut(ph(hit, 60, 520))) * easeOut(ph(hit, 0, 90));
      st.foe.hp = 18;
      // core block of light, then three square shockwaves (square, diamond, square)
      if (hit < 90) { const s = Math.round(4 - hit / 30); g.rect(px - s, py - s, 2 * s + 1, 2 * s + 1, K.white, 1); }
      [[0, 'sq', K.white], [45, 'dia', K.light], [95, 'sq', K.mid]].forEach(([d, kind, col], k) => {
        const p = ph(hit, d, d + 380); if (p <= 0 || p >= 1) return;
        const r = 4 + 30 * easeOut3(p), a = 1 - p * p;
        if (kind === 'sq') sqRing(g, px, py, r, r * 0.8, col, a, k === 0 ? 2 : 1); else diamond(g, px, py, r * 1.15, r, col, a, 2);
      });
      // straight rays (the 4 sides and 4 corners of a square)
      const rp = ph(hit, 0, 170);
      if (rp > 0 && rp < 1) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r0 = 6 + 12 * rp, r1 = r0 + (i % 2 ? 6 : 12); g.line(px + Math.cos(a) * r0, py + Math.sin(a) * r0, px + Math.cos(a) * r1, py + Math.sin(a) * r1, i % 2 ? K.light : K.white, 1 - rp); }
      // square debris chunks flying out (mostly away from him), falling
      for (let i = 0; i < 14; i++) {
        const p = ph(hit, 0, 520 + rnd(i) * 200); if (p <= 0 || p >= 1) continue;
        const a = -Math.PI / 2 + (rnd(i * 3) - 0.35) * 2.6, d = (14 + rnd(i * 7) * 22) * easeOut(p);
        const x = px + Math.cos(a) * d, y = py + Math.sin(a) * d * 0.8 + p * p * 18, s = i % 3 === 0 ? 2 : 1;
        g.rect(x, y, s, s, [K.light, K.mid, K.deep, C.grey][i % 4], 1 - p * 0.7);
      }
      // the floor mark: a cracked steel plate under the enemy that lingers, then fades
      const fm = 1 - ph(hit, 1300, 1900);
      if (fm > 0) {
        const fx = E0.x, fy = E0.y + 1, grow = easeOut(ph(hit, 0, 120));
        u.rect(fx - 9 * grow, fy - 2, 18 * grow + 1, 5, K.dark, 0.55 * fm);
        sqRing(u, fx, fy, 10 * grow, 3, K.deep, 0.9 * fm);
        if (grow >= 1) for (const [x0, y0, x1, y1] of [[-10, -3, -14, -5], [10, 3, 15, 5], [10, -3, 13, -5], [-10, 3, -13, 5], [-4, 3, -6, 6], [5, -3, 7, -5]]) u.line(fx + x0, fy + y0, fx + x1, fy + y1, K.deep, 0.8 * fm);
        u.rect(fx - 2, fy - 1, 5, 3, K.mid, 0.5 * fm * (0.6 + 0.4 * Math.sin(et / 90)));
      }
      this.number(st, '128', E0, hit, true);
      if (hit > 80 && hit < 1900) for (let i = 0; i < 3; i++) { const a = et / 150 + (i * Math.PI * 2) / 3; g.px(E0.x + st.foe.dx + Math.cos(a) * 5, E0.top - 2 + Math.sin(a) * 2, STAR, 1); }
    }
  }

  // ---- NEW: Challenge ---------------------------------------------------------------------------
  newChallenge(st, et, P, T) {
    const h = st.hero, K = KNIGHT;
    const H0 = body(this.hero);
    this.charge(st, et, P);
    const since = et - P.cast;
    if (since >= 0) {
      st.flash = since < 60 ? [0xffffff, 0.4 * (1 - since / 60)] : since < 200 ? [K.deep, 0.18 * (1 - (since - 60) / 140)] : null;
      const z = since < 130 ? easeOut(since / 130) : 1 - easeOut3(ph(since, 130, 520));
      st.cam = { ...st.cam, zoom: 1 + 0.08 * z, fx: H0.x * Z, fy: H0.mid * Z };
      if (since < 300) st.lines = { kind: 'focus', x: H0.x * Z, y: H0.mid * Z, a: since < 220 ? 0.75 : 0.75 * (1 - (since - 220) / 80) };
      h.dy = since < 130 ? -6 * Math.sin((since / 130) * Math.PI / 2) : -6 * (1 - easeOut(ph(since, 130, 175)));
      h.dx = 0;
      h.tint = since < 90 ? [K.light, 0.55] : null;
    }
    const hit = et - P.impact;
    if (hit >= 0) {
      if (T >= P.impact && T < P.impact + P.stopMs + 200) st.cam.shake = 3.5 * (1 - (T - P.impact) / (P.stopMs + 200));
      const g = st.over, u = st.under, fx = H0.x, fy = H0.y;
      // landing: a big diamond shockwave rolls over the floor to the edge of the taunt zone (150 px = 50)
      const R = skills.challenge.area.radius / Z;
      [[0, K.white, 2], [70, K.mid, 1]].forEach(([d, col, th]) => { const p = ph(hit, d, d + 460); if (p > 0 && p < 1) diamond(u, fx, fy, 4 + R * easeOut3(p), (4 + R * easeOut3(p)) * 0.38, col, 1 - p * p, th); });
      const sp = ph(hit, 0, 260); if (sp > 0 && sp < 1) sqRing(g, fx, H0.mid, 6 + 18 * easeOut(sp), 6 + 18 * easeOut(sp), K.light, 1 - sp, 2);
      // the taunt zone stays on the floor while the taunt lasts (3s), dotted inner edge, fades out
      const life = skills.challenge.apply[0].durationMs;
      const zf = ph(hit, 0, 160) * (1 - ph(hit, life - 400, life));
      if (zf > 0) { diamond(u, fx, fy, R, R * 0.38, K.deep, 0.75 * zf, 1); diamond(u, fx, fy, R - 4, (R - 4) * 0.38, K.dark, 0.6 * zf, 1, true); }
      // every enemy inside: a red "!" drops in, a red flash, a red line yanks it one step towards him
      [[this.foe, st.foe], [this.foe2, st.foe2]].forEach(([a, s], i) => {
        const e = body(a); const d = 60 + i * 50;
        const p = ph(hit, d, d + 200);
        s.dx = -4 * easeOut(p); s.tint = hit > d && hit < d + 140 ? [RED, 0.5] : null;
        if (hit > d && hit < d + 200) { const lp = (hit - d) / 200; for (let x = fx + 6; x < e.x - e.hw; x += 3) g.px(x, e.mid + Math.round(((x - fx) * (e.mid - H0.mid)) / (e.x - fx)) - 1, RED, 1 - lp); }
        if (hit > d && hit < life) { const drop = Math.round(6 * (1 - easeOut3(ph(hit, d, d + 140)))); bigBang(g, e.x + s.dx, e.top - 12 - drop, 7, RED); }
      });
      // +30 defense: four steel corner plates slam onto him and stay (faint pulse) while the buff lasts
      const bp = easeOut3(ph(hit, 40, 220)), bf = 1 - ph(hit, life - 400, life);
      if (bp > 0 && bf > 0) {
        const pad = 2 + 10 * (1 - bp), a = bf * (0.75 + 0.25 * Math.sin(et / 120));
        const x0 = H0.x - H0.hw - pad, x1 = H0.x + H0.hw + pad, y0 = H0.top - pad + st.hero.dy, y1 = H0.bot + pad - 1 + st.hero.dy;
        for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
          g.rect(sx > 0 ? x : x - 3, y, 4, 1, K.light, a); g.rect(x, sy > 0 ? y : y - 3, 1, 4, K.light, a);
          g.px(x + sx, y + sy, K.deep, a);
        }
        st.hero.tint = st.hero.tint || [K.mid, 0.18 * bf];
      }
      if (hit < 900) st.numbers.push({ text: '+30 DEF', x: (H0.x + H0.hw + 16) * Z, y: H0.mid * Z - Math.round(ph(hit, 100, 900) * 24), size: 14, color: KNIGHT.text, alpha: 1 - ph(hit, 600, 900) });
    }
  }

  // CHARGE (both new skills): crouch, the outline lights up, square specks are pulled in, a square glows on the floor.
  charge(st, et, P) {
    if (et >= P.cast) return;
    const p = et / P.cast, K = KNIGHT, h = st.hero;
    h.dy = 1; h.dx = -Math.round(2 * easeOut(p));
    h.aura = { a: 0.35 + 0.65 * p, t: et };
    const u = body(this.hero, h.dx, h.dy);
    for (let i = 0; i < 12; i++) {
      const s = (p * 1.7 + i / 12) % 1, a = rnd(i * 13) * Math.PI * 2, r = 22 * (1 - easeOut(s));
      st.over.rect(u.x + Math.cos(a) * r, u.mid + Math.sin(a) * r * 0.8, i % 3 ? 1 : 2, i % 3 ? 1 : 2, i % 2 ? K.light : K.mid, s * 0.9);
    }
    sqRing(st.under, u.x, u.y, 4 + 9 * p, 2 + 2 * p, K.mid, 0.3 + 0.5 * p);
    if (p > 0.6) { const b = Math.sin(et / 30) > 0 ? 1 : 0.4, x = u.x + u.hw + 2, y = u.mid - 4; st.over.px(x, y, K.white, b); st.over.px(x - 1, y, K.light, b); st.over.px(x + 1, y, K.light, b); st.over.px(x, y - 1, K.light, b); st.over.px(x, y + 1, K.light, b); }
  }

  number(st, txt, E0, since, skill) {
    if (since < 0 || since > 1000) return;
    const pop = since < 150 ? 1.5 - 0.5 * easeOut(since / 150) : 1; // the game's skill number pop (unchanged: user is fine with it)
    st.numbers.push({ text: txt, x: E0.x * Z, y: (E0.top - 8) * Z - Math.round((since / 1000) * 30), size: FX.numberSizePx, color: FX.attackColor, alpha: 1 - since / 1000, scale: skill ? pop : 1 });
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
    text(ctx, name, clampX(H0.x * Z, name, 16), y, 16, KNIGHT.text, a, 4);
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
