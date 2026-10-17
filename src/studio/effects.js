// Studio: EFFECTS section. Plays every effect of the game live, with the game's own recipe code
// (the effect stage, fxStage.js: Knight against a Goblin and a Slime). Each effect can get its own speed and colour
// swaps; saved to the page's store (collection "effects", doc "<group>-<name>"), and Claude copies them into
// src/data/effects.json with scripts/apply-designs.mjs. The game applies them through systems/fxTune.js.
import effectsData from '../data/effects.json';
import { makeTuner } from '../systems/fxTune.js';
import { FxStage, catalog, GROUPS, W, H, hex } from './fxStage.js';

const Z = 3; // drawn at game size
const key0x = (n) => '0x' + n.toString(16).padStart(6, '0');

export default class EffectsEditor extends FxStage {
  constructor(root) {
    super();
    this.root = root;
    this.list = catalog();
    this.sel = this.list[0];
    this.work = JSON.parse(JSON.stringify(effectsData));
    this.saved = JSON.parse(JSON.stringify(effectsData));
    this.store = null;
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

  draw(now) {
    const cv = this.root.querySelector('#fx-stage'); if (!cv) return;
    const e = this.sel;
    const ms = this.tuner.ms(e.group, e.name, e.ms);
    const loop = ms + 450; // a short pause between plays
    this.drawScene(cv.getContext('2d'), e, (now - this.start) % loop, this.tuner, Z);
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
