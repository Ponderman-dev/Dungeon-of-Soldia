// Studio: EFFECTS section. Plays every effect of the game live, with the game's own recipe code
// (systems/statusFx, hitFx, itemFx, skillFx), on a small stage at game size (Knight against a Goblin and a
// Slime). Each effect can get its own speed and colour swaps; saved to the page's store (collection
// "effects", doc "<group>-<name>"), and Claude copies them into src/data/effects.json with
// scripts/apply-designs.mjs. The game applies them through systems/fxTune.js.
import heroes from '../data/heroes.json';
import enemies from '../data/enemies.json';
import statuses from '../data/statuses.json';
import effectsData from '../data/effects.json';
import { artPixels, partArt, mixColor } from '../systems/pixelArt.js';
import { statusLook, LOOPING, bodyBox, iceColor } from '../systems/statusFx.js';
import { projectileFx, impactFx, critFx, IMPACT_MS, CRIT_MS, MOMENT_MS, HIT_TYPES, dodgeFx, blockFx, soakFx, shieldBreakFx, healFx, deathPuffFx } from '../systems/hitFx.js';
import * as itemFx from '../systems/itemFx.js';
import { castFx, shotFx, CAST_MS, SHOT_MS, CAST_FX, SHOT_FX } from '../systems/skillFx.js';
import { makeTuner } from '../systems/fxTune.js';

const W = 120, H = 60, Z = 3; // the stage in character pixels, drawn at game size
const GROUPS = [['status', 'Status effects'], ['hit', 'Hits'], ['shot', 'Shots'], ['item', 'Item effects'], ['skill', 'Skill effects']];
const HERO_STATUSES = ['buff', 'regenBoost', 'shield', 'invulnerable', 'parry'];
const nice = (s) => s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const key0x = (n) => '0x' + n.toString(16).padStart(6, '0');

// Every effect the game has, with how to play it on the stage.
function catalog() {
  const list = [];
  for (const k of LOOPING) list.push({ group: 'status', name: k, label: (statuses[k] && statuses[k].label ? nice(k) : nice(k)), ms: 2400, on: HERO_STATUSES.includes(k) ? 'hero' : 'enemy' });
  for (const k of HIT_TYPES) list.push({ group: 'hit', name: k, label: `${nice(k)} hit`, ms: IMPACT_MS[k] });
  list.push({ group: 'hit', name: 'crit', label: 'Critical hit', ms: CRIT_MS });
  for (const [k, l] of [['dodge', 'Miss / dodge'], ['block', 'Block'], ['soak', 'Shield soaks a hit'], ['shieldBreak', 'Shield breaks'], ['heal', 'Heal'], ['puff', 'Enemy dies (smoke)']]) list.push({ group: 'hit', name: k, label: l, ms: MOMENT_MS[k] });
  for (const k of ['ranged', 'fire', 'ice', 'electric', 'dark', 'holy']) list.push({ group: 'shot', name: k, label: `${nice(k)} shot`, ms: 300 });
  for (const k of SHOT_FX) list.push({ group: 'shot', name: k, label: `${nice(k)} (skill)`, ms: SHOT_MS[k] });
  for (const k of itemFx.ITEM_FX) list.push({ group: 'item', name: k, label: nice(k), ms: itemFx.ITEM_MS[k] });
  list.push({ group: 'item', name: 'tornado', label: 'Excalibur tornado', ms: 2000 });
  for (const k of CAST_FX) list.push({ group: 'skill', name: k, label: nice(k), ms: CAST_MS[k] });
  return list;
}

// A character standing on the stage (feet at fx, fy), mirrored when it faces left.
function actor(def, fx, fy, faceLeft) {
  const box = bodyBox(def.parts, def.height);
  const parts = Object.values(def.parts).map((p) => {
    const px = artPixels(partArt(p)); const h = px.length, w = Math.max(...px.map((r) => r.length));
    return { px, left: p.x - w / 2, top: p.y - h / 2, w };
  });
  const cx = faceLeft ? -box.cx : box.cx;
  return { def, fx, fy, faceLeft, parts, body: () => ({ x: fx + cx, y: fy, top: fy + box.top, mid: fy + box.mid, bot: fy + box.bot, hw: box.hw }), box: { ...box, cx: 0 } };
}

export default class EffectsEditor {
  constructor(root) {
    this.root = root;
    this.list = catalog();
    this.sel = this.list[0];
    this.work = JSON.parse(JSON.stringify(effectsData));
    this.saved = JSON.parse(JSON.stringify(effectsData));
    this.store = null;
    const knight = heroes.find((h) => h.id === 'knight');
    this.hero = actor(knight, 30, 50, false);
    this.foe = actor(enemies.goblin, 82, 50, true);
    this.foe2 = actor(enemies.slime, 104, 51, true);
    this.build();
    this.tuner = makeTuner(this.work);
    this.start = performance.now();
    const loop = (now) => { if (!this.root.hidden) this.draw(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  entry(e = this.sel) { return (this.work[e.group] && this.work[e.group][e.name]) || null; }
  savedEntry(e = this.sel) { return (this.saved[e.group] && this.saved[e.group][e.name]) || null; }
  setEntry(patch) {
    const g = (this.work[this.sel.group] = this.work[this.sel.group] || {});
    const cur = g[this.sel.name] || { speed: 1, colors: {} };
    const next = { ...cur, ...patch };
    if ((!next.speed || next.speed === 1) && !Object.keys(next.colors || {}).length) delete g[this.sel.name];
    else g[this.sel.name] = next;
    this.tuner = makeTuner(this.work);
    this.renderPanel();
  }

  build() {
    this.root.innerHTML = `
      <aside class="col"><div class="card fxlist" id="fx-list"></div></aside>
      <section class="col"><div class="card">
        <div class="head"><h2 id="fx-title"></h2><span class="hint" id="fx-state"></span></div>
        <canvas id="fx-stage" class="fxstage" width="${W * Z}" height="${H * Z}" role="img" aria-label="The selected effect playing on the Knight and the Goblin"></canvas>
        <div class="row"><span class="label">Speed</span><input id="fx-speed" type="range" min="0.25" max="3" step="0.05" value="1" aria-label="Speed"><span id="fx-speed-v" class="hint"></span></div>
        <div><span class="label">Colours</span> <span class="hint">tap a colour to change it everywhere in this effect</span></div>
        <div class="fxswatches" id="fx-swatches"></div>
        <div class="row"><button id="fx-reset" class="btn">Reset to game</button><button id="fx-save" class="btn primary">Save effect</button><span id="fx-note" class="hint"></span></div>
      </div></section>`;
    const listEl = this.root.querySelector('#fx-list');
    for (const [g, label] of GROUPS) {
      const h = document.createElement('h3'); h.textContent = label; listEl.append(h);
      const wrap = document.createElement('div'); wrap.className = 'fxbtns';
      for (const e of this.list.filter((x) => x.group === g)) {
        const b = document.createElement('button'); b.className = 'btn fxbtn'; b.textContent = e.label; b.dataset.key = e.group + '-' + e.name;
        b.onclick = () => { this.sel = e; this.start = performance.now(); this.renderPanel(); };
        wrap.append(b);
      }
      listEl.append(wrap);
    }
    this.root.querySelector('#fx-speed').oninput = (ev) => this.setEntry({ speed: Number(ev.target.value) });
    this.root.querySelector('#fx-reset').onclick = () => { const g = this.work[this.sel.group]; if (g) delete g[this.sel.name]; this.tuner = makeTuner(this.work); this.renderPanel(); };
    this.root.querySelector('#fx-save').onclick = () => this.save();
    this.renderPanel();
  }

  // The colours the selected effect uses (sampled over its whole run), original colours.
  colours() {
    const seen = new Map();
    const plain = makeTuner({});
    for (let i = 0; i < 24; i++) {
      const q = (i + 0.5) / 24;
      const r = this.frame(this.sel, q, i * 97, plain);
      for (const d of r.draws) seen.set(d[4], (seen.get(d[4]) || 0) + 1);
      if (r.tint) seen.set(r.tint[0], (seen.get(r.tint[0]) || 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 12);
  }

  renderPanel() {
    const e = this.sel, cur = this.entry();
    this.root.querySelectorAll('.fxbtn').forEach((b) => {
      b.classList.toggle('on', b.dataset.key === e.group + '-' + e.name);
      const [g, ...n] = b.dataset.key.split('-'); const w = this.work[g] && this.work[g][n.join('-')];
      b.classList.toggle('changed', !!w);
    });
    this.root.querySelector('#fx-title').textContent = e.label;
    const same = JSON.stringify(cur) === JSON.stringify(this.savedEntry());
    this.root.querySelector('#fx-state').textContent = !cur && !this.savedEntry() ? 'Game version' : same ? 'Saved' : 'Changed (not saved yet)';
    const speed = (cur && cur.speed) || 1;
    this.root.querySelector('#fx-speed').value = speed;
    this.root.querySelector('#fx-speed-v').textContent = `${speed.toFixed(2)}x`;
    const sw = this.root.querySelector('#fx-swatches');
    sw.innerHTML = '';
    const colors = (cur && cur.colors) || {};
    for (const c of this.colours()) {
      const now = colors[key0x(c)] ? Number(colors[key0x(c)]) : c;
      const label = document.createElement('label'); label.className = 'fxswatch'; label.title = `${hex(c)}${now !== c ? ' → ' + hex(now) : ''}`;
      const input = document.createElement('input'); input.type = 'color'; input.value = hex(now); input.setAttribute('aria-label', `Colour ${hex(c)}`);
      input.oninput = () => { const next = { ...colors }; const v = parseInt(input.value.slice(1), 16); if (v === c) delete next[key0x(c)]; else next[key0x(c)] = key0x(v); this.setEntry({ colors: next }); };
      const was = document.createElement('span'); was.className = 'fxwas'; was.style.background = hex(c);
      label.append(was, input); sw.append(label);
    }
    if (!sw.children.length) sw.textContent = 'No colours to change.';
  }

  // One frame of an effect: { draws, tint (on its target), on ('hero'|'enemy'), ice, dx }.
  frame(e, q, t, tune) {
    const H0 = this.hero.body(), E0 = this.foe.body(), E1 = this.foe2.body();
    const at = (u) => ({ x: u.x, y: u.mid });
    const g = e.group, n = e.name;
    const tq = (fn) => tune.paint(g, n, fn);
    if (g === 'status') {
      const u = e.on === 'hero' ? H0 : E0;
      const look = statusLook({ [n]: { stacks: 3, age: t % 2400 } }, { ...u, x: 0, y: 0, top: u.top - u.y, mid: u.mid - u.y, bot: u.bot - u.y }, t, tune);
      return { draws: look.draws.map((d) => [d[0] + u.x, d[1] + u.y, d[2], d[3], d[4], d[5]]), tint: look.tint, on: e.on, ice: look.ice, dx: look.dx };
    }
    if (g === 'hit') {
      if (n === 'crit') return { draws: tq(critFx(q, { ...E0, side: -1 }, t)), on: 'enemy' };
      if (n === 'dodge') { const o = dodgeFx(q, { ...E0, side: -1 }); return { draws: tq(o.draws), on: 'enemy', dx: o.dx }; }
      if (n === 'block') return { draws: tq(blockFx(q, { ...H0, side: 1 })), on: 'hero' };
      if (n === 'soak') return { draws: tq(soakFx(q, { ...H0, side: 1 })), on: 'hero' };
      if (n === 'shieldBreak') return { draws: tq(shieldBreakFx(q, { ...H0, side: 1 })), on: 'hero' };
      if (n === 'heal') { const o = healFx(q, H0, 2); return { draws: tq(o.draws), tint: o.tint && [tune.color(g, n, o.tint[0]), o.tint[1]], on: 'hero' }; }
      if (n === 'puff') return { draws: tq(deathPuffFx(q, E0.x, E0.y)), on: 'enemy', gone: true };
      const o = impactFx(n, q, { ...E0, side: -1 }, t, 1, at(H0));
      return { draws: tq(o.draws), tint: o.tint && [tune.color(g, n, o.tint[0]), o.tint[1]], on: 'enemy', dx: o.dx };
    }
    if (g === 'shot') {
      const a = { x: H0.x + H0.hw + 2, y: H0.mid }, b = at(E0);
      if (SHOT_MS[n]) return { draws: tq(shotFx(n, q, a, b, t, 3, n === 'flask' ? 0x6de07a : undefined)), on: 'enemy' };
      const head = { x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q };
      return { draws: q < 1 ? tq(projectileFx(n, a, head, t, 2)) : [], on: 'enemy' };
    }
    if (g === 'item') {
      const a = { x: H0.x + H0.hw + 2, y: H0.mid }, b = at(E0);
      const map = {
        bomb: () => itemFx.bombFx(q, a, b, t), lightning: () => [...itemFx.lightningFx(q, a, b, t, 3), ...itemFx.lightningFx(q, b, at(E1), t, 9)], greenfire: () => itemFx.greenfireFx(q, a, b),
        battleCry: () => [...itemFx.battleCryFx(q, H0), ...itemFx.speedLinesFx(q, H0, t)], shatter: () => itemFx.shatterFx(q, E0), knifeBurst: () => itemFx.knifeBurstFx(q, E0.x, E0.mid),
        plague: () => itemFx.plagueFx(q, b, at(E1)), thunderbolt: () => itemFx.thunderboltFx(q, E0), aegisBlast: () => itemFx.aegisBlastFx(q, H0), thorns: () => itemFx.thornsFx(q, H0),
        lifesteal: () => itemFx.lifestealFx(q, b, at(H0)), suckerPunch: () => itemFx.suckerPunchFx(q, E0, -1), executioner: () => itemFx.executionerFx(q, E0), dice: () => itemFx.diceFx(q, E0, t),
        mimic: () => itemFx.mimicFx(q, H0.x + H0.hw + 6, H0.y, t), tornado: () => itemFx.tornadoFx(E0.x + Math.sin(t / 500) * 12, E0.y, t * tune.speed(g, n)),
      };
      return { draws: map[n] ? tq(map[n]()) : [], on: 'enemy' };
    }
    if (g === 'skill') {
      const support = ['rallyCry', 'arcaneWard', 'divineShield', 'boneWard', 'ballad', 'focusStance'].includes(n);
      const c = { caster: H0, targets: support ? [H0] : [E0, E1], squad: [H0], enemies: [E0, E1] };
      const o = castFx(n, q, c, t);
      const tint = (o.tints.find(([l, , tt]) => tt && (l === 'enemies' || l === 'targets')) || o.tints.find(([, , tt]) => tt) || [])[2];
      return { draws: tq(o.draws), tint: tint && [tune.color(g, n, tint[0]), tint[1]], on: support ? 'hero' : 'enemy' };
    }
    return { draws: [] };
  }

  drawActor(ctx, a, tint, ice, dx = 0, hide = false) {
    if (hide) return;
    const S = Z;
    for (const p of a.parts) {
      p.px.forEach((row, y) => row.forEach((c, x) => {
        if (c === null) return;
        const relX = p.left + x;
        const gx = a.faceLeft ? a.fx - relX - 1 : a.fx + relX;
        const gy = a.fy + p.top + y;
        let col = ice > 0 && gy > a.fy - ice * ((a.def.height || 24) + 2) ? iceColor(c) : c;
        if (tint) col = mixColor(col, tint[0], tint[1]);
        ctx.fillStyle = hex(col); ctx.fillRect((gx + dx) * S, gy * S, S, S);
      }));
    }
  }

  draw(now) {
    const cv = this.root.querySelector('#fx-stage'); if (!cv) return;
    const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1b1629'; ctx.fillRect(0, 0, W * Z, H * Z);
    ctx.fillStyle = '#221b33'; ctx.fillRect(0, 36 * Z, W * Z, (H - 36) * Z);
    ctx.fillStyle = '#2e2542'; for (let x = 0; x < W; x += 20) ctx.fillRect(x * Z, 36 * Z, Z, (H - 36) * Z); ctx.fillRect(0, 36 * Z, W * Z, Z);
    const e = this.sel;
    const ms = this.tuner.ms(e.group, e.name, e.ms);
    const loop = ms + 450; // a short pause between plays
    const t = now - this.start;
    const q = Math.min(1, (t % loop) / ms);
    let r;
    try { r = this.frame(e, q, t, this.tuner); } catch (err) { r = { draws: [] }; }
    const playing = q < 1 || e.group === 'status';
    this.drawActor(ctx, this.hero, r.on === 'hero' && playing ? r.tint : null, r.on === 'hero' ? r.ice : 0, r.on === 'hero' && playing ? r.dx || 0 : 0);
    this.drawActor(ctx, this.foe2, null, 0);
    this.drawActor(ctx, this.foe, r.on === 'enemy' && playing ? r.tint : null, r.on === 'enemy' ? r.ice : 0, r.on === 'enemy' && playing ? r.dx || 0 : 0, r.gone && q > 0 && q < 1);
    for (const [x, y, w, h, c, a] of r.draws) { ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.fillStyle = hex(c); ctx.fillRect(Math.round(x) * Z - Z / 2, Math.round(y) * Z, w * Z, h * Z); }
    ctx.globalAlpha = 1;
  }

  // The page's store (or this browser when there is none).
  connect(db, localKey) {
    this.localKey = localKey;
    const use = (docs) => {
      for (const d of docs) {
        if (!d || !d.group || !d.name) continue;
        const v = { speed: d.speed || 1, colors: d.colors || {} };
        (this.saved[d.group] = this.saved[d.group] || {})[d.name] = v;
        (this.work[d.group] = this.work[d.group] || {})[d.name] = JSON.parse(JSON.stringify(v));
      }
      this.tuner = makeTuner(this.work);
      this.renderPanel();
    };
    if (db) {
      const col = db.collection('effects');
      col.get().then((snap) => use(snap.docs.map((d) => d.data()))).catch(() => {});
      this.store = { save: (k, doc) => col.doc(k).set(doc) };
    } else {
      let local = {};
      try { local = JSON.parse(localStorage.getItem(localKey + '-effects') || '{}'); } catch { /* none */ }
      use(Object.values(local));
      this.store = { save: async (k, doc) => { local[k] = doc; try { localStorage.setItem(localKey + '-effects', JSON.stringify(local)); } catch { /* blocked */ } } };
    }
  }

  async save() {
    const e = this.sel, cur = this.entry() || { speed: 1, colors: {} };
    const doc = { kind: 'effect', group: e.group, name: e.name, speed: cur.speed || 1, colors: cur.colors || {}, savedAt: new Date().toISOString() };
    const note = this.root.querySelector('#fx-note');
    try {
      if (!this.store) throw new Error('not ready');
      await this.store.save(`${e.group}-${e.name}`, doc);
      (this.saved[e.group] = this.saved[e.group] || {})[e.name] = { speed: doc.speed, colors: doc.colors };
      note.textContent = 'Saved. Tell Claude "apply the studio designs" to put it in the game.';
    } catch (err) {
      note.textContent = 'Could not save. Try again in a moment.';
    }
    this.renderPanel();
  }
}
