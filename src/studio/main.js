// Character Studio: edit how heroes and enemies look (their colored-block parts) and save the designs.
// The preview uses the game's own Character class, so what you see here is what the game draws.
// Saved designs go to the page's online store (collection "designs"); Claude copies them into
// heroes.json / enemies.json with scripts/apply-designs.mjs. Without the store (local dev) they
// are kept in this browser only.
import Phaser from 'phaser';
import Character from '../entities/Character.js';
import heroes from '../data/heroes.json';
import enemies from '../data/enemies.json';
import minions from '../data/minions.json';
import combat from '../data/combat.json';

const STAGE = 360; // preview canvas size in pixels
const FEET_Y = 290; // where the character's feet are on the canvas
const LOCAL_KEY = 'soldia-studio-designs';

// ---- Data ---------------------------------------------------------------------------------------

const clone = (o) => JSON.parse(JSON.stringify(o));

// Every character the studio can edit, with its game version (from the JSON files).
const characters = [
  ...heroes.map((h) => ({ key: `hero-${h.id}`, kind: 'hero', id: h.id, name: h.name, def: h })),
  ...Object.entries(enemies).map(([id, e]) => ({ key: `enemy-${id}`, kind: 'enemy', id, name: e.name, def: e })),
  ...Object.entries(minions)
    .filter(([, m]) => m && m.parts)
    .map(([id, m]) => ({ key: `minion-${id}`, kind: 'minion', id, name: m.name, def: m })),
];
const byKey = Object.fromEntries(characters.map((c) => [c.key, c]));

// The look-only fields of a character (what the studio edits and saves).
function lookOf(def) {
  const look = { height: def.height, parts: clone(def.parts) };
  if (def.flying) look.hover = def.hover || 0;
  return look;
}

const gameLook = Object.fromEntries(characters.map((c) => [c.key, lookOf(c.def)]));
const savedLook = {}; // key -> look saved in the store
const working = {}; // key -> look being edited

let current = characters[0].key;
let selected = null; // selected part name
let store = null; // { save(key, doc) } once known

const look = () => working[current];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const baseline = (key) => savedLook[key] || gameLook[key];

for (const c of characters) working[c.key] = clone(gameLook[c.key]);

// ---- Preview (Phaser) ---------------------------------------------------------------------------

let zoom = 9;
let anim = 'idle';
let mirror = false; // looking the other way (the game mirrors fighters to face their target)

class StudioScene extends Phaser.Scene {
  constructor() {
    super('studio');
  }

  create() {
    this.grid = this.add.graphics();
    this.marks = this.add.graphics().setDepth(5);
    this.sel = this.add.graphics().setDepth(10);
    this.ch = null;
    this.rebuild();

    // Tap picks the front-most part under the finger; dragging moves it (whole pixels).
    this.input.on('pointerdown', (p) => {
      const pt = this.toChar(p.x, p.y);
      const names = Object.keys(look().parts).reverse();
      const hit = names.find((n) => {
        const q = look().parts[n];
        return Math.abs(pt.x - q.x) <= q.w / 2 + 0.5 && Math.abs(pt.y - q.y) <= q.h / 2 + 0.5;
      });
      if (!hit) return;
      select(hit);
      const q = look().parts[hit];
      this.drag = { name: hit, sx: p.x, sy: p.y, x: q.x, y: q.y };
    });
    this.input.on('pointermove', (p) => {
      if (!this.drag || !p.isDown) return;
      const q = look().parts[this.drag.name];
      const nx = this.drag.x + Math.round((p.x - this.drag.sx) / zoom) * (mirror ? -1 : 1);
      const ny = this.drag.y + Math.round((p.y - this.drag.sy) / zoom);
      if (nx === q.x && ny === q.y) return;
      q.x = nx;
      q.y = ny;
      changed({ keepEditor: true });
      renderEditor();
    });
    this.input.on('pointerup', () => (this.drag = null));
  }

  // Canvas point -> character pixel (0,0 = feet).
  toChar(x, y) {
    return { x: ((x - STAGE / 2) / zoom) * (mirror ? -1 : 1), y: (y - this.feetY()) / zoom };
  }

  feetY() {
    return FEET_Y - ((look().hover || 0) * zoom) / 3; // hover is in game pixels (3x)
  }

  // Throws the old figure away and builds a new one from the current data.
  rebuild() {
    if (this.ch) this.ch.destroy();
    this.tweens.killAll();
    const def = { parts: look().parts };
    this.ch = new Character(this, STAGE / 2, this.feetY(), def);
    this.ch.setScale(mirror ? -zoom : zoom, zoom);
    if (anim !== 'idle') this.ch.freeze();
    this.drawGrid();
  }

  drawGrid() {
    const g = this.grid.clear();
    const cx = STAGE / 2;
    const fy = this.feetY();
    if (zoom >= 6) {
      g.lineStyle(1, 0x2a2340, 1);
      for (let x = cx % zoom; x < STAGE; x += zoom) g.lineBetween(x, 0, x, STAGE);
      for (let y = fy % zoom; y < STAGE; y += zoom) g.lineBetween(0, y, STAGE, y);
    }
    g.lineStyle(1, 0x3d3460, 1);
    g.lineBetween(cx, 0, cx, STAGE);
    const m = this.marks.clear();
    m.lineStyle(2, 0xf2b33d, 0.9);
    m.lineBetween(0, fy, STAGE, fy);
    if (look().hover) {
      // Flyers: the floor they hover over (faint).
      m.lineStyle(2, 0x6b5a2a, 0.9);
      m.lineBetween(0, FEET_Y, STAGE, FEET_Y);
    }
    // Health bar height (dashed).
    const hy = fy - look().height * zoom;
    m.lineStyle(2, 0xd65b5b, 0.9);
    for (let x = 0; x < STAGE; x += 12) m.lineBetween(x, hy, x + 6, hy);
  }

  update() {
    // Skill animation: the scene lifts/crouches the figure by castLift (game pixels, like the battle).
    if (this.ch && anim === 'skill') this.ch.y = this.feetY() - (this.ch.castLift * zoom) / 3;
    const g = this.sel.clear();
    const block = selected && this.ch && this.ch.parts[selected];
    if (!block) return;
    const b = block.getBounds();
    g.lineStyle(2, 0xf2b33d, 1);
    g.strokeRect(b.x - 2, b.y - 2, b.width + 4, b.height + 4);
  }

  play(name) {
    anim = name;
    this.rebuild();
    const ch = this.ch;
    if (name === 'idle') return;
    if (name === 'swing') {
      const go = () => ch.active && anim === 'swing' && ch.swing(combat.attackTiming.hero.swingMs);
      go();
      this.loop = this.time.addEvent({ delay: 900, loop: true, callback: go });
    } else if (name === 'walk') {
      const M = combat.attackMotion;
      const hop = { height: M.hopHeight * (zoom / 3), length: M.hopLengthPx * (zoom / 3) };
      const far = Math.min(STAGE / 2 - 40, 34 * zoom);
      const leg = (dir) => {
        if (!ch.active || anim !== 'walk') return;
        ch.moveTo(STAGE / 2 + dir * far, ch.homeY, 900, { hop, onDone: () => leg(-dir) });
      };
      leg(1);
    } else if (name === 'skill') {
      // Wind-up (crouch, weapon cocked back), then the release; attack and support skills alternate.
      let kind = 'attack';
      const go = () => {
        if (!ch.active || anim !== 'skill') return;
        ch.castWindUp(500);
        this.time.delayedCall(500, () => ch.active && anim === 'skill' && ch.castRelease(kind));
        kind = kind === 'attack' ? 'support' : 'attack';
      };
      go();
      this.loop = this.time.addEvent({ delay: 1500, loop: true, callback: go });
    } else if (name === 'flash') {
      const go = () => ch.active && anim === 'flash' && ch.flash();
      go();
      this.loop = this.time.addEvent({ delay: 600, loop: true, callback: go });
    }
  }
}

let scene = null;
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'stage',
  width: STAGE,
  height: STAGE,
  backgroundColor: '#0e0b17',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT },
  scene: [StudioScene],
  callbacks: {
    postBoot: (game) => {
      scene = game.scene.getScene('studio');
    },
  },
});

function redraw() {
  if (!scene || !scene.grid) return;
  if (scene.loop) scene.loop.remove();
  scene.loop = null;
  scene.play(anim);
}

// ---- Page UI ------------------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const toHex = (c) => '#' + String(c).replace(/^0x/, '').padStart(6, '0');
const fromHex = (h) => '0x' + h.replace('#', '');

function fillPicker() {
  const pick = $('pick');
  const opt = (c) => {
    const dirty = !same(working[c.key], baseline(c.key));
    const tag = dirty ? ' •' : savedLook[c.key] ? ' (saved)' : '';
    return `<option value="${c.key}"${c.key === current ? ' selected' : ''}>${c.name}${tag}</option>`;
  };
  pick.innerHTML =
    `<optgroup label="Heroes">${characters.filter((c) => c.kind === 'hero').map(opt).join('')}</optgroup>` +
    `<optgroup label="Enemies">${characters.filter((c) => c.kind === 'enemy').map(opt).join('')}</optgroup>` +
    `<optgroup label="Minions">${characters.filter((c) => c.kind === 'minion').map(opt).join('')}</optgroup>`;
}

function renderStatus() {
  const s = $('status');
  const dirty = !same(look(), baseline(current));
  s.className = 'status' + (dirty ? ' dirty' : savedLook[current] ? ' saved' : '');
  s.textContent = dirty ? 'Unsaved changes' : savedLook[current] ? 'Saved design' : 'Game version';
  $('save').disabled = !dirty || !store;
}

function renderParts() {
  $('parts').innerHTML = Object.entries(look().parts)
    .map(
      ([n, p]) =>
        `<button class="chip${n === selected ? ' sel' : ''}" data-part="${n}"><i style="background:${toHex(p.color)}"></i>${n}</button>`,
    )
    .join('');
}

// One slider row. get/set read and write the value on the data.
function field(id, label, value, { min, max, step = 1 }) {
  return `<div class="field"><label for="${id}">${label}</label>
    <input type="range" id="${id}-r" data-f="${id}" min="${min}" max="${max}" step="${step}" value="${value}">
    <input type="number" id="${id}" data-f="${id}" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
}

function renderEditor() {
  const ed = $('editor');
  const p = selected && look().parts[selected];
  if (!p) {
    ed.innerHTML = '<h2>Part</h2><p class="hint">Tap a part in the preview or in the list above.</p>';
    return;
  }
  const idle = p.idle || {};
  const pivot = p.pivotY !== undefined;
  ed.innerHTML = `<h2>Part: ${selected}</h2>
    <div class="field wide"><label for="f-name">Name</label><input type="text" id="f-name" value="${selected}"></div>
    <div class="field wide"><label for="f-color">Colour</label><input type="color" id="f-color" value="${toHex(p.color)}"></div>
    ${field('f-w', 'Width', p.w, { min: 1, max: 32 })}
    ${field('f-h', 'Height', p.h, { min: 1, max: 32 })}
    ${field('f-x', 'Left / right', p.x, { min: -20, max: 20 })}
    ${field('f-y', 'Up / down', p.y, { min: -40, max: 8 })}
    <div class="sub">Turning</div>
    <div class="field wide"><label for="f-pivot">Turns from</label>
      <select id="f-pivot"><option value="">its middle</option><option value="1"${pivot && p.pivotY === 1 ? ' selected' : ''}>its bottom (handle)</option><option value="0"${pivot && p.pivotY === 0 ? ' selected' : ''}>its top</option></select></div>
    <div class="sub">Idle wiggle</div>
    ${field('f-dy', 'Bob up/down', idle.dy || 0, { min: -6, max: 6, step: 0.5 })}
    ${field('f-angle', 'Tilt (deg)', idle.angle || 0, { min: -45, max: 45 })}
    ${field('f-dur', 'Speed (ms)', idle.duration || 500, { min: 100, max: 2000, step: 10 })}
    ${field('f-delay', 'Delay (ms)', idle.delay || 0, { min: 0, max: 1000, step: 10 })}
    <p id="name-err" class="note" hidden></p>`;
}

function renderWhole() {
  const l = look();
  let html = field('w-height', 'Health bar at', l.height, { min: 4, max: 40 });
  if (l.hover !== undefined) html += field('w-hover', 'Flies at', l.hover, { min: 0, max: 80 });
  $('whole').innerHTML = html;
}

function renderAll() {
  fillPicker();
  renderStatus();
  renderParts();
  renderEditor();
  renderWhole();
}

function select(name) {
  selected = name;
  renderParts();
  renderEditor();
}

// Something in the data changed: redraw the preview and the labels.
function changed({ keepEditor = false } = {}) {
  redraw();
  fillPicker();
  renderStatus();
  renderParts();
  if (!keepEditor) renderEditor();
  persistDraft();
}

// Reads one editor input back into the data.
function applyField(id, raw) {
  const p = look().parts[selected];
  const v = Number(raw);
  if (Number.isNaN(v)) return;
  const idle = () => (p.idle = p.idle || { duration: 500 });
  switch (id) {
    case 'f-w': p.w = v; break;
    case 'f-h': p.h = v; break;
    case 'f-x': p.x = v; break;
    case 'f-y': p.y = v; break;
    case 'f-dy': idle().dy = v; break;
    case 'f-angle': idle().angle = v; break;
    case 'f-dur': idle().duration = v; break;
    case 'f-delay': idle().delay = v; break;
    case 'w-height': look().height = v; break;
    case 'w-hover': look().hover = v; break;
  }
  // Tidy idle: drop zero values; no movement at all = no idle.
  if (p && p.idle) {
    for (const k of ['dy', 'angle', 'delay']) if (!p.idle[k]) delete p.idle[k];
    if (!p.idle.dy && !p.idle.angle) delete p.idle;
  }
}

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.f) {
    const id = t.dataset.f;
    if (id.startsWith('w-')) {
      applyField(id, t.value);
    } else if (selected) {
      applyField(id, t.value);
    }
    const twin = t.type === 'range' ? $(id) : $(id + '-r');
    if (twin) twin.value = t.value;
    changed({ keepEditor: true });
  } else if (t.id === 'f-color' && selected) {
    look().parts[selected].color = fromHex(t.value);
    changed({ keepEditor: true });
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'pick') {
    current = t.value;
    selected = null;
    renderAll();
    redraw();
  } else if (t.id === 'f-pivot' && selected) {
    const p = look().parts[selected];
    if (t.value === '') delete p.pivotY;
    else p.pivotY = Number(t.value);
    changed({ keepEditor: true });
  } else if (t.id === 'f-name' && selected) {
    const name = t.value.trim();
    const err = $('name-err');
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name) || (name !== selected && look().parts[name])) {
      err.hidden = false;
      err.textContent = 'Use letters and digits only, and a name no other part has.';
      return;
    }
    renameSelected(name);
  }
});

function renameSelected(name) {
  const parts = look().parts;
  const next = {};
  for (const [n, p] of Object.entries(parts)) next[n === selected ? name : n] = p;
  look().parts = next;
  selected = name;
  changed();
}

// Moves the selected part earlier (-1, drawn behind) or later (+1, drawn in front).
function reorder(dir) {
  if (!selected) return;
  const entries = Object.entries(look().parts);
  const i = entries.findIndex(([n]) => n === selected);
  const j = i + dir;
  if (j < 0 || j >= entries.length) return;
  [entries[i], entries[j]] = [entries[j], entries[i]];
  look().parts = Object.fromEntries(entries);
  changed();
}

function freeName(base) {
  let n = base;
  for (let i = 2; look().parts[n]; i++) n = base + i;
  return n;
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.part) return select(t.dataset.part);
  if (t.dataset.anim) {
    anim = t.dataset.anim;
    document.querySelectorAll('[data-anim]').forEach((b) => b.classList.toggle('on', b === t));
    return redraw();
  }
  if (t.id === 'mirror') {
    mirror = !mirror;
    t.classList.toggle('on', mirror);
    return redraw();
  }
  if (t.dataset.zoom) {
    zoom = Number(t.dataset.zoom);
    document.querySelectorAll('[data-zoom]').forEach((b) => b.classList.toggle('on', b === t));
    return redraw();
  }
  switch (t.id) {
    case 'add': {
      const name = freeName('part');
      look().parts[name] = { w: 6, h: 6, x: 0, y: -12, color: '0xd6a2e8' };
      selected = name;
      return changed();
    }
    case 'dupe': {
      if (!selected) return;
      const name = freeName(selected);
      const copy = clone(look().parts[selected]);
      copy.x += 2;
      look().parts[name] = copy;
      selected = name;
      return changed();
    }
    case 'remove': {
      if (!selected || Object.keys(look().parts).length <= 1) return;
      delete look().parts[selected];
      selected = null;
      return changed();
    }
    case 'up': return reorder(-1);
    case 'down': return reorder(1);
    case 'revert':
      working[current] = clone(baseline(current));
      selected = null;
      renderAll();
      redraw();
      return persistDraft();
    case 'reset':
      working[current] = clone(gameLook[current]);
      selected = null;
      renderAll();
      redraw();
      return persistDraft();
    case 'save':
      return save();
  }
});

// ---- Saving -------------------------------------------------------------------------------------

async function save() {
  const c = byKey[current];
  const doc = { kind: c.kind, id: c.id, name: c.name, ...clone(look()), savedAt: new Date().toISOString() };
  const btn = $('save');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    await store.save(current, doc);
    savedLook[current] = clone(look());
    btn.textContent = 'Save design';
    renderAll();
  } catch (err) {
    btn.textContent = 'Save design';
    btn.disabled = false;
    const note = $('dbnote');
    note.hidden = false;
    note.textContent = 'Could not save (' + (err && err.code ? err.code : 'error') + '). Try again in a moment.';
  }
}

// Unsaved edits are also kept in this browser, so a reload does not lose them.
function persistDraft() {
  try {
    localStorage.setItem(LOCAL_KEY + '-draft', JSON.stringify(working));
  } catch {
    /* storage blocked: fine */
  }
}

function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(LOCAL_KEY + '-draft') || 'null');
    if (d) for (const k of Object.keys(d)) if (working[k]) working[k] = d[k];
  } catch {
    /* nothing */
  }
}

function useSaved(docs) {
  for (const d of docs) {
    const key = `${d.kind}-${d.id}`;
    if (!byKey[key]) continue;
    const l = { height: d.height, parts: d.parts };
    if (d.hover !== undefined) l.hover = d.hover;
    // An untouched character follows the saved design.
    if (same(working[key], baseline(key))) working[key] = clone(l);
    savedLook[key] = l;
  }
}

async function connect() {
  const db = window.claude && window.claude.use ? await window.claude.use('db').catch(() => null) : null;
  if (db) {
    const col = db.collection('designs');
    try {
      const snap = await col.get();
      useSaved(snap.docs.map((d) => d.data()));
    } catch {
      /* empty or not reachable yet: start from the game versions */
    }
    store = { save: (key, doc) => col.doc(key).set(doc) };
  } else {
    // No online store (running locally): keep saves in this browser.
    let local = {};
    try {
      local = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    } catch {
      /* nothing */
    }
    useSaved(Object.values(local));
    store = {
      save: async (key, doc) => {
        local[key] = doc;
        localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
      },
    };
    const note = $('dbnote');
    note.hidden = false;
    note.textContent = 'Saving works in this browser only here. Open the studio page on claude.ai to save for Claude.';
  }
  renderAll();
  redraw();
}

loadDraft();
renderAll();
connect();
