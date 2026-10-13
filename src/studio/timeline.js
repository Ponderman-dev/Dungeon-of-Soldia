// The Character Studio's timeline: one clip at a time (tabs), one layer per part, and for each layer
// keyframe rows for X, Y and Rotation, like After Effects. Drag the playhead, add keys with the
// diamond buttons, drag a value label to scrub it, drag diamonds to move keys in time.
// Clip data shape: see src/systems/animClips.js. Plain DOM, no Phaser.
import { CLIPS, CLIP_INFO, PROPS, EASES, sampleTrack, setKey, tidyClip } from '../systems/animClips.js';
import { partArt, artPixels } from '../systems/pixelArt.js';

const SNAP = 10; // keys and the playhead snap to 10 ms
const LABELS = { x: 'Position X', y: 'Position Y', angle: 'Rotation' };
const UNITS = { x: 'px', y: 'px', angle: '°' };
const EASE_LABELS = { linear: 'Linear', ease: 'Ease in/out', hold: 'Hold (jump)' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const round = (v, step) => Math.round(v / step) * step;
const fmt = (v) => String(Math.round(v * 100) / 100);

export default class Timeline {
  // hooks: look(), selected(), select(name), begin(), end(), soft(), changed() (data changed),
  // show(clip | null, t) (preview this clip at time t), partColor(part)
  constructor(root, hooks) {
    this.root = root;
    this.h = hooks;
    this.clipId = 'idle';
    this.t = 0;
    this.playing = false;
    this.collapsed = new Set();
    this.selKey = null; // { part, prop, key } (key = the keyframe object)
    this.drag = null;
    root.addEventListener('click', (e) => this.click(e));
    root.addEventListener('change', (e) => this.change(e));
    root.addEventListener('pointerdown', (e) => this.down(e));
    document.addEventListener('pointermove', (e) => this.move(e));
    document.addEventListener('pointerup', () => this.up());
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, select, button')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selKey) {
        e.preventDefault();
        this.deleteKey();
      } else if (e.key === ' ' && this.clip()) {
        e.preventDefault();
        this.togglePlay();
      }
    });
  }

  clip() {
    const a = this.h.look().anims;
    return a ? a[this.clipId] : null;
  }

  length() {
    const c = this.clip();
    return c ? c.length : CLIP_INFO[this.clipId].length;
  }

  keys(part, prop, make = false) {
    const clip = this.clip();
    if (!clip) return [];
    if (!make) return (clip.tracks[part] && clip.tracks[part][prop]) || [];
    clip.tracks[part] = clip.tracks[part] || {};
    return (clip.tracks[part][prop] = clip.tracks[part][prop] || []);
  }

  value(part, prop) {
    return sampleTrack(this.keys(part, prop), this.t);
  }

  // Sets a part's value at the playhead (adds or changes a key there). Used by the preview drag too.
  setValue(part, prop, v) {
    if (!this.clip()) return;
    setKey(this.keys(part, prop, true), this.t, v);
    this.h.changed();
    this.render();
  }

  // Tell the preview what to show.
  show() {
    this.h.show(this.clip() || null, this.t);
  }

  setTime(t) {
    this.t = Math.max(0, Math.min(this.length(), round(t, SNAP)));
    this.show();
    this.renderPlayhead();
  }

  togglePlay() {
    this.playing = !this.playing;
    if (this.playing) {
      let last = performance.now();
      const step = (now) => {
        if (!this.playing) return;
        const len = this.length();
        this.t = (this.t + (now - last)) % len;
        last = now;
        this.show();
        this.renderPlayhead();
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } else {
      this.t = round(this.t, SNAP);
      this.show();
    }
    this.render();
  }

  // ---- input ----------------------------------------------------------------------------------

  timeAt(e) {
    const r = this.root.querySelector('.tl-right').getBoundingClientRect();
    const lane = this.root.querySelector('.tl-lane');
    const lr = lane ? lane.getBoundingClientRect() : r;
    return ((e.clientX - lr.left) / lr.width) * this.length();
  }

  click(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.clip) {
      this.clipId = b.dataset.clip;
      this.t = Math.min(this.t, this.length());
      this.selKey = null;
      this.show();
      return this.render();
    }
    if (b.dataset.caret) {
      const n = b.dataset.caret;
      if (this.collapsed.has(n)) this.collapsed.delete(n);
      else this.collapsed.add(n);
      return this.render();
    }
    if (b.dataset.layer) {
      this.h.select(b.dataset.layer);
      return this.render();
    }
    if (b.dataset.keybtn) {
      // The diamond button: a key here? remove it. None? add one with the current value.
      const [part, prop] = b.dataset.keybtn.split('|');
      const keys = this.keys(part, prop, true);
      const i = keys.findIndex((k) => k.t === this.t);
      this.h.begin();
      if (i >= 0) keys.splice(i, 1);
      else setKey(keys, this.t, round(sampleTrack(keys, this.t), 0.5));
      tidyClip(this.clip());
      this.h.end();
      this.selKey = null;
      this.h.changed();
      return this.render();
    }
    switch (b.id) {
      case 'tl-create': {
        this.h.begin();
        const look = this.h.look();
        look.anims = look.anims || {};
        look.anims[this.clipId] = { length: CLIP_INFO[this.clipId].length, tracks: {} };
        this.h.end();
        this.h.changed();
        this.show();
        return this.render();
      }
      case 'tl-delete': {
        const look = this.h.look();
        this.h.begin();
        delete look.anims[this.clipId];
        if (!Object.keys(look.anims).length) delete look.anims;
        this.h.end();
        this.selKey = null;
        this.playing = false;
        this.h.changed();
        this.show();
        return this.render();
      }
      case 'tl-play':
        return this.togglePlay();
      case 'tl-start':
        return this.setTime(0);
      case 'tl-prev':
      case 'tl-next': {
        // Jump to the previous / next keyframe of any layer.
        const times = new Set([0, this.length()]);
        for (const tracks of Object.values((this.clip() || { tracks: {} }).tracks))
          for (const keys of Object.values(tracks)) for (const k of keys) times.add(k.t);
        const sorted = [...times].sort((a, b) => a - b);
        const t = b.id === 'tl-prev' ? [...sorted].reverse().find((x) => x < this.t) : sorted.find((x) => x > this.t);
        if (t !== undefined) this.setTime(t);
        return;
      }
      case 'tl-key-delete':
        return this.deleteKey();
    }
  }

  change(e) {
    const t = e.target;
    if (t.id === 'tl-length') {
      const v = Math.max(50, Math.min(5000, round(Number(t.value) || 0, SNAP)));
      this.h.begin();
      this.clip().length = v;
      this.h.end();
      this.t = Math.min(this.t, v);
      this.h.changed();
      return this.render();
    }
    if (t.dataset.val) {
      const [part, prop] = t.dataset.val.split('|');
      const v = Number(t.value);
      if (Number.isNaN(v)) return;
      this.h.begin();
      this.setValue(part, prop, v);
      this.h.end();
      return;
    }
    if (this.selKey && (t.id === 'tl-key-ease' || t.id === 'tl-key-value' || t.id === 'tl-key-time')) {
      const k = this.selKey.key;
      this.h.begin();
      if (t.id === 'tl-key-ease') k.ease = t.value;
      if (t.id === 'tl-key-value') k.v = Number(t.value) || 0;
      if (t.id === 'tl-key-time') {
        const keys = this.keys(this.selKey.part, this.selKey.prop);
        const nt = Math.max(0, Math.min(this.length(), round(Number(t.value) || 0, SNAP)));
        if (!keys.some((o) => o !== k && o.t === nt)) k.t = nt;
        keys.sort((a, b) => a.t - b.t);
      }
      this.h.end();
      this.h.changed();
      this.show();
      this.render();
    }
  }

  down(e) {
    // Playhead: drag on the ruler.
    if (e.target.closest('.tl-ruler')) {
      if (this.playing) this.togglePlay();
      this.drag = { kind: 'time' };
      this.setTime(this.timeAt(e));
      return;
    }
    // A keyframe diamond: select it, drag it along the time line.
    const d = e.target.closest('.tl-key');
    if (d && d.dataset.k) {
      const [part, prop, i] = d.dataset.k.split('|');
      const key = this.keys(part, prop)[Number(i)];
      if (!key) return;
      e.preventDefault();
      this.selKey = { part, prop, key };
      this.h.select(part);
      this.h.begin();
      this.drag = { kind: 'key', part, prop, key, moved: false };
      this.render();
      return;
    }
    // A value label: drag left/right to change the value (like After Effects).
    const lab = e.target.closest('[data-scrub]');
    if (lab && this.clip()) {
      e.preventDefault();
      const [part, prop] = lab.dataset.scrub.split('|');
      this.h.begin();
      this.drag = { kind: 'scrub', part, prop, x: e.clientX, v: this.value(part, prop) };
      return;
    }
    // Empty track space: move the playhead there.
    if (e.target.closest('.tl-lane')) {
      if (this.playing) this.togglePlay();
      this.drag = { kind: 'time' };
      this.setTime(this.timeAt(e));
    }
  }

  move(e) {
    const d = this.drag;
    if (!d) return;
    if (d.kind === 'time') this.setTime(this.timeAt(e));
    else if (d.kind === 'key') {
      const keys = this.keys(d.part, d.prop);
      const t = Math.max(0, Math.min(this.length(), round(this.timeAt(e), SNAP)));
      if (t !== d.key.t && !keys.some((k) => k !== d.key && k.t === t)) {
        d.key.t = t;
        keys.sort((a, b) => a.t - b.t);
        d.moved = true;
        this.h.changed();
        this.setTime(t);
        this.render();
      }
    } else if (d.kind === 'scrub') {
      const per = d.prop === 'angle' ? 1 : 0.25; // per screen pixel dragged
      const step = d.prop === 'angle' ? 1 : 0.5;
      const v = round(d.v + (e.clientX - d.x) * per, step);
      if (v !== this.value(d.part, d.prop)) this.setValue(d.part, d.prop, v);
    }
  }

  up() {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (d.kind === 'key' || d.kind === 'scrub') this.h.end();
  }

  deleteKey() {
    const s = this.selKey;
    if (!s) return;
    const keys = this.keys(s.part, s.prop);
    const i = keys.indexOf(s.key);
    if (i < 0) return;
    this.h.begin();
    keys.splice(i, 1);
    tidyClip(this.clip());
    this.h.end();
    this.selKey = null;
    this.h.changed();
    this.show();
    this.render();
  }

  // ---- drawing ----------------------------------------------------------------------------------

  renderPlayhead() {
    const len = this.length();
    const ph = this.root.querySelector('.tl-playhead');
    if (ph) ph.style.left = (this.t / len) * 100 + '%';
    const tm = this.root.querySelector('#tl-time');
    if (tm) tm.textContent = `${Math.round(this.t)} / ${len} ms`;
    // Values and key buttons follow the playhead.
    this.root.querySelectorAll('[data-val]').forEach((inp) => {
      if (document.activeElement === inp) return;
      const [part, prop] = inp.dataset.val.split('|');
      inp.value = fmt(this.value(part, prop));
    });
    this.root.querySelectorAll('[data-keybtn]').forEach((b) => {
      const [part, prop] = b.dataset.keybtn.split('|');
      b.classList.toggle('on', this.keys(part, prop).some((k) => k.t === Math.round(this.t)));
    });
  }

  render() {
    const look = this.h.look();
    const clip = this.clip();
    const len = this.length();
    const info = CLIP_INFO[this.clipId];
    const has = (id) => look.anims && look.anims[id];
    const tabs = CLIPS.map(
      (c) =>
        `<button class="tab${c.id === this.clipId ? ' on' : ''}${has(c.id) ? ' has' : ''}" data-clip="${c.id}">${c.label}</button>`,
    ).join('');
    const notes = {
      idle: 'Loops while standing. Replaces the Idle wiggle sliders.',
      attack: 'A normal hit. The game stretches it to the attack time (the hit lands at the end).',
      windup: 'Charging a skill. Stretched to the skill’s charge time, then holds its last frame.',
      skillAttack: 'Plays when an attack skill goes off.',
      skillSupport: 'Plays when a support skill goes off.',
      walk: 'Loops while walking (the hop is added on top).',
      hurt: 'A short flinch when hit.',
      death: 'Plays when it falls, then holds the last frame.',
    };
    let body;
    if (!clip) {
      body = `<div class="tl-empty"><p class="hint">No <b>${info.label}</b> clip yet. The game uses its built-in motion for it.</p>
        <button id="tl-create" class="btn primary">Create ${info.label} clip</button></div>`;
    } else {
      const parts = Object.keys(look.parts).reverse(); // front-most layer on top, like After Effects
      const sel = this.h.selected();
      const left = [];
      const right = [];
      const ticks = [];
      const stepMs = len <= 600 ? 50 : len <= 1500 ? 100 : 250;
      for (let t = 0; t <= len + 0.1; t += stepMs) {
        const major = t % (stepMs * 2) === 0;
        ticks.push(`<i class="tick${major ? ' major' : ''}" style="left:${(t / len) * 100}%">${major ? `<span${t > len * 0.9 ? ' class="end"' : ''}>${t}</span>` : ''}</i>`);
      }
      for (const name of parts) {
        const open = !this.collapsed.has(name);
        const all = PROPS.flatMap((prop) => this.keys(name, prop).map((k) => k.t));
        left.push(`<div class="tl-row layer${name === sel ? ' sel' : ''}">
            <button class="caret" data-caret="${esc(name)}" aria-label="${open ? 'Close' : 'Open'} ${esc(name)}">${open ? '▾' : '▸'}</button>
            <button class="lname" data-layer="${esc(name)}"><i style="background:${this.h.partColor(look.parts[name])}"></i>${esc(name)}</button></div>`);
        right.push(`<div class="tl-row layer${name === sel ? ' sel' : ''}"><div class="tl-lane">${[...new Set(all)]
          .map((t) => `<i class="tl-key sum" style="left:${(t / len) * 100}%"></i>`)
          .join('')}</div></div>`);
        if (!open) continue;
        for (const prop of PROPS) {
          const keys = this.keys(name, prop);
          const here = keys.some((k) => k.t === this.t);
          left.push(`<div class="tl-row prop">
              <button class="keybtn${here ? ' on' : ''}" data-keybtn="${esc(name)}|${prop}" title="Add / remove a keyframe here" aria-label="Keyframe ${LABELS[prop]}">◆</button>
              <span class="scrub" data-scrub="${esc(name)}|${prop}" title="Drag left/right to change">${LABELS[prop]}</span>
              <input type="number" class="val" data-val="${esc(name)}|${prop}" step="${prop === 'angle' ? 1 : 0.5}" value="${fmt(this.value(name, prop))}" aria-label="${esc(name)} ${LABELS[prop]} (${UNITS[prop]})"></div>`);
          right.push(`<div class="tl-row prop"><div class="tl-lane">${keys
            .map((k, i) => {
              const on = this.selKey && this.selKey.key === k;
              return `<i class="tl-key ${k.ease || 'ease'}${on ? ' on' : ''}" data-k="${esc(name)}|${prop}|${i}" style="left:${(k.t / len) * 100}%" title="${k.t} ms: ${fmt(k.v)}${UNITS[prop]}"></i>`;
            })
            .join('')}</div></div>`);
        }
      }
      const s = this.selKey;
      const keyInfo = s
        ? `<div class="tl-keyinfo"><span class="label">Keyframe</span><b>${esc(s.part)} · ${LABELS[s.prop]}</b>
            <label>at <input type="number" id="tl-key-time" step="10" value="${s.key.t}"> ms</label>
            <label>value <input type="number" id="tl-key-value" step="${s.prop === 'angle' ? 1 : 0.5}" value="${fmt(s.key.v)}"> ${UNITS[s.prop]}</label>
            <label>then <select id="tl-key-ease">${EASES.map((x) => `<option value="${x}"${(s.key.ease || 'ease') === x ? ' selected' : ''}>${EASE_LABELS[x]}</option>`).join('')}</select></label>
            <button id="tl-key-delete" class="btn danger">Delete key</button></div>`
        : `<p class="hint">Tap a diamond to edit it. Drag diamonds to move them in time. Drag a property name left/right to change its value, or drag the part in the preview.</p>`;
      body = `<div class="tl-controls">
          <button id="tl-start" class="btn tool" title="Go to start" aria-label="Go to start">⏮</button>
          <button id="tl-prev" class="btn tool" title="Previous keyframe" aria-label="Previous keyframe">◂◆</button>
          <button id="tl-play" class="btn tool${this.playing ? ' on' : ''}" title="Play / pause (Space)" aria-label="Play or pause">${this.playing ? '❚❚' : '▶'}</button>
          <button id="tl-next" class="btn tool" title="Next keyframe" aria-label="Next keyframe">◆▸</button>
          <span id="tl-time" class="tl-time">${Math.round(this.t)} / ${len} ms</span>
          <label class="tl-len">Length <input type="number" id="tl-length" min="50" max="5000" step="10" value="${len}"> ms</label>
          <button id="tl-delete" class="btn danger">Delete clip</button>
        </div>
        <div class="tl-grid">
          <div class="tl-left"><div class="tl-row ruler-left"><span class="label">Layers</span></div>${left.join('')}</div>
          <div class="tl-right"><div class="tl-row tl-ruler"><div class="tl-lane">${ticks.join('')}</div></div>${right.join('')}
            <div class="tl-playhead-wrap"><div class="tl-playhead" style="left:${(this.t / len) * 100}%"></div></div></div>
        </div>
        ${keyInfo}`;
    }
    this.root.innerHTML = `<div class="head"><h2>Timeline</h2><span class="hint">${notes[this.clipId]}${info.loop ? ' Loops.' : ''}</span></div>
      <div class="tabs" role="tablist">${tabs}</div>${body}`;
  }
}

// The colour most used in a part (for its layer swatch).
export function mainColor(p) {
  const counts = new Map();
  for (const row of artPixels(partArt(p))) for (const c of row) if (c !== null && c !== 0x1a1020) counts.set(c, (counts.get(c) || 0) + 1);
  let best = 0x1a1020;
  let n = 0;
  for (const [c, k] of counts) if (k > n) [best, n] = [c, k];
  return '#' + best.toString(16).padStart(6, '0');
}
