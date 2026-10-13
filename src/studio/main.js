// Character Studio: draw how heroes, enemies and minions look (pixel-art parts) and save the designs.
// The live preview uses the game's own Character class, so it moves exactly like the game (pixel steps).
// Saved designs go to the page's online store (collection "designs"); Claude copies them into
// heroes.json / enemies.json / minions.json with scripts/apply-designs.mjs. Without the store
// (local dev) they are kept in this browser only.
import Phaser from 'phaser';
import Character from '../entities/Character.js';
import Board, { partBox } from './board.js';
import Timeline, { mainColor } from './timeline.js';
import { partArt, artPixels } from '../systems/pixelArt.js';
import heroes from '../data/heroes.json';
import enemies from '../data/enemies.json';
import minions from '../data/minions.json';
import combat from '../data/combat.json';

const STAGE = 360; // preview canvas size in pixels
const FEET_Y = 290; // where the character's feet are on the preview
const LOCAL_KEY = 'soldia-studio-designs';
// Starter colours: outlines, stone, steel, skin, leather, fire, gold, leaf, sky, magic.
const STARTER = [
  0x1a1020, 0x3d3460, 0x6f6890, 0xc8ccd6, 0xffffff, 0xf2c9a0, 0xc68a5e, 0x7a4a2e,
  0xb8402a, 0xe0773f, 0xf2b33d, 0xffe08a, 0x57c26a, 0x2f6b3a, 0x3b6fd4, 0x7a5cb8,
];

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
  if (def.anims) look.anims = clone(def.anims);
  return look;
}

const gameLook = Object.fromEntries(characters.map((c) => [c.key, lookOf(c.def)]));
const savedLook = {}; // key -> look saved in the store
const working = {}; // key -> look being edited
const history = {}; // key -> { undo: [], redo: [] } (looks as JSON text)

let current = characters[0].key;
let selected = null; // selected part name
let store = null; // { save(key, doc) } once known
let tool = 'pencil';
let color = 0x3b6fd4;

const look = () => working[current];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const baseline = (key) => savedLook[key] || gameLook[key];
const hist = () => (history[current] = history[current] || { undo: [], redo: [] });

for (const c of characters) working[c.key] = clone(gameLook[c.key]);

// ---- Live preview (Phaser) ----------------------------------------------------------------------

let zoom = 9;
let anim = 'idle';
let tlShow = null; // { clip, t }: the timeline is showing this clip in the preview (null = play like the game)
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
    this.play(anim);
    // Tapping the preview picks the front-most part there. With a timeline clip showing, dragging the
    // part moves it at the playhead (adds X / Y keyframes).
    this.input.on('pointerdown', (p) => {
      const cx = Math.floor(((p.x - STAGE / 2) / zoom) * (mirror ? -1 : 1));
      const cy = Math.floor((p.y - this.feetY()) / zoom);
      const hit = board.pixelAt(cx, cy);
      if (!hit) return;
      select(hit.name);
      if (tlShow && tlShow.clip) {
        beginEdit();
        this.drag = { name: hit.name, sx: p.x, sy: p.y, x: timeline.value(hit.name, 'x'), y: timeline.value(hit.name, 'y') };
      }
    });
    this.input.on('pointermove', (p) => {
      const d = this.drag;
      if (!d || !p.isDown) return;
      const nx = Math.round(((p.x - d.sx) / zoom) * (mirror ? -1 : 1) * 2) / 2 + d.x;
      const ny = Math.round(((p.y - d.sy) / zoom) * 2) / 2 + d.y;
      if (nx !== timeline.value(d.name, 'x')) timeline.setValue(d.name, 'x', nx);
      if (ny !== timeline.value(d.name, 'y')) timeline.setValue(d.name, 'y', ny);
    });
    this.input.on('pointerup', () => {
      if (this.drag) endEdit();
      this.drag = null;
    });
  }

  feetY() {
    return FEET_Y - ((look().hover || 0) * zoom) / 3; // hover is in game pixels (3x)
  }

  // Throws the old figure away and builds a new one from the current data.
  rebuild() {
    if (this.ch) this.ch.destroy();
    this.tweens.killAll();
    if (this.loop) this.loop.remove();
    this.loop = null;
    this.ch = new Character(this, STAGE / 2, this.feetY(), { parts: look().parts, anims: look().anims });
    this.ch.setScale(mirror ? -zoom : zoom, zoom);
    if (anim !== 'idle' || tlShow) this.ch.freeze();
    if (tlShow) this.ch.showClip(tlShow.clip, tlShow.t);
    this.drawGrid();
  }

  drawGrid() {
    const g = this.grid.clear();
    const cx = STAGE / 2;
    const fy = this.feetY();
    if (zoom >= 6) {
      g.lineStyle(1, 0x221c33, 1);
      for (let x = cx % zoom; x < STAGE; x += zoom) g.lineBetween(x, 0, x, STAGE);
      for (let y = fy % zoom; y < STAGE; y += zoom) g.lineBetween(0, y, STAGE, y);
    }
    const m = this.marks.clear();
    m.lineStyle(2, 0xf2b33d, 0.9);
    m.lineBetween(0, fy, STAGE, fy);
    if (look().hover) {
      // Flyers: the floor they hover over.
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
    const part = selected && this.ch && this.ch.parts[selected];
    if (!part) return;
    const b = part.image.getBounds();
    g.lineStyle(1, 0xf2b33d, 0.8);
    g.strokeRect(b.x - 2, b.y - 2, b.width + 4, b.height + 4);
  }

  play(name) {
    anim = name;
    this.rebuild();
    const ch = this.ch;
    if (tlShow) return; // the timeline decides what is shown
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
    } else if (name === 'hurt') {
      const go = () => ch.active && anim === 'hurt' && (ch.hurt(), ch.flash());
      go();
      this.loop = this.time.addEvent({ delay: 800, loop: true, callback: go });
    } else if (name === 'death') {
      // Falls, stays down a moment, gets up (rebuilt) and falls again.
      ch.die();
      this.loop = this.time.addEvent({ delay: 1800, callback: () => anim === 'death' && redraw() });
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

// Rebuilds the preview at most once per frame (drawing calls this for every pixel).
let redrawQueued = false;
function redraw() {
  if (redrawQueued) return;
  redrawQueued = true;
  requestAnimationFrame(() => {
    redrawQueued = false;
    if (scene && scene.grid) scene.play(anim);
  });
}

// ---- Drawing board ------------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const toHex = (c) => '#' + String(c).replace(/^0x/, '').padStart(6, '0');
const fromHex = (h) => '0x' + h.replace('#', '');

const board = new Board($('board'), {
  look,
  selected: () => selected,
  select: (name) => select(name),
  color: () => color,
  pickColor: (c) => {
    setColor(c);
    setTool('pencil');
  },
  tool: () => tool,
  filled: () => $('filled').checked,
  dim: () => $('dim').checked,
  mirror: () => mirrorOn,
  begin: () => beginEdit(),
  end: () => endEdit(),
  changed: () => changed({ keepEditor: true }),
  cancel: () => cancelEdit(),
  holdPick: (c) => {
    setColor(c);
    toast('Colour picked');
  },
});

const timeline = new Timeline($('timeline'), {
  look,
  name: () => byKey[current].name,
  selected: () => selected,
  select: (name) => select(name),
  begin: () => beginEdit(),
  end: () => endEdit(),
  changed: () => changed({ keepEditor: true, fromTimeline: true }),
  partColor: mainColor,
  show: (clip, t) => {
    // The timeline takes over the preview; the Play buttons give it back.
    tlShow = { clip, t };
    document.querySelectorAll('[data-anim]').forEach((b) => b.classList.remove('on'));
    if (scene && scene.ch && scene.ch.active) {
      if (!scene.ch.override) scene.play(anim);
      scene.ch.showClip(clip, t);
    }
  },
});

// Mirror drawing (symmetry): whatever is drawn on one side of the middle line is drawn on the other too.
let mirrorOn = false;
try {
  mirrorOn = localStorage.getItem('soldia-studio-mirror') === '1';
} catch {
  /* storage blocked */
}
function toggleMirrorDraw() {
  mirrorOn = !mirrorOn;
  try {
    localStorage.setItem('soldia-studio-mirror', mirrorOn ? '1' : '0');
  } catch {
    /* fine */
  }
  $('mirror-draw').classList.toggle('on', mirrorOn);
  $('mirror-draw').setAttribute('aria-pressed', String(mirrorOn));
  board.render();
  toast(mirrorOn ? 'Mirror drawing on' : 'Mirror drawing off');
}

function setTool(name) {
  tool = name;
  document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === name));
  renderBoardHint();
}

function setColor(c) {
  color = c;
  $('color').value = hex(c);
  renderSwatches();
}

function renderBoardHint() {
  const hints = {
    pencil: 'Pencil: draw pixels on the selected part.',
    eraser: 'Eraser: remove pixels.',
    line: 'Line: drag from one end to the other.',
    rect: 'Rectangle: drag from corner to corner.',
    fill: 'Fill: colours the area of one colour you tap.',
    picker: 'Pick: tap any pixel to take its colour.',
    anchor: 'Anchor: tap the pixel the part should turn around.',
    move: 'Move: tap a part to pick it, drag to move it.',
  };
  $('board-hint').textContent = selected ? hints[tool] : 'Tap a part to pick it, then draw.';
}

// Colours used in this character first, then the starter colours.
function renderSwatches() {
  const used = [];
  for (const p of Object.values(look().parts)) {
    for (const row of artPixels(partArt(p))) for (const c of row) if (c !== null && !used.includes(c)) used.push(c);
  }
  const sw = (c) =>
    `<button class="sw${c === color ? ' sel' : ''}" data-color="${c}" style="background:${hex(c)}" aria-label="Colour ${hex(c)}"></button>`;
  $('swatches').innerHTML =
    `<span class="label">This character</span>${used.map(sw).join('')}` +
    `<span class="label">Starter colours</span>${STARTER.map(sw).join('')}`;
}

// ---- Undo / redo ----------------------------------------------------------------------------------
// One undo step = one stroke, one button press, or one slider drag.

let editOpen = false;
let editTimer = null;
let redoBefore = []; // the redo list from before the edit in progress (a cancelled edit gives it back)

function beginEdit() {
  clearTimeout(editTimer);
  if (editOpen) return;
  const h = hist();
  h.undo.push(JSON.stringify(look()));
  if (h.undo.length > 100) h.undo.shift();
  redoBefore = h.redo;
  h.redo = [];
  editOpen = true;
  renderUndo();
}

function endEdit() {
  editOpen = false;
}

// For sliders and text: the step closes after a short pause.
function softEdit() {
  beginEdit();
  editTimer = setTimeout(endEdit, 600);
}

// Throws away the edit in progress (e.g. the first finger of a two-finger tap had started a stroke).
function cancelEdit() {
  clearTimeout(editTimer);
  if (!editOpen) return;
  editOpen = false;
  const h = hist();
  working[current] = JSON.parse(h.undo.pop());
  h.redo = redoBefore;
  if (selected && !look().parts[selected]) selected = null;
  timeline.selKey = null;
  renderAll();
  redraw();
  persistDraft();
}

function undoRedo(from, to) {
  endEdit();
  const h = hist();
  if (!h[from].length) return;
  h[to].push(JSON.stringify(look()));
  working[current] = JSON.parse(h[from].pop());
  if (selected && !look().parts[selected]) selected = null;
  timeline.selKey = null;
  renderAll();
  redraw();
  persistDraft();
}

function renderUndo() {
  const h = hist();
  $('undo').disabled = !h.undo.length;
  $('redo').disabled = !h.redo.length;
}

// ---- Page UI ------------------------------------------------------------------------------------

function fillPicker() {
  const pick = $('pick');
  const opt = (c) => {
    const dirty = !same(working[c.key], baseline(c.key));
    const tag = dirty ? ' •' : savedLook[c.key] ? ' (saved)' : '';
    return `<option value="${c.key}"${c.key === current ? ' selected' : ''}>${c.name}${tag}</option>`;
  };
  const group = (kind, label) =>
    `<optgroup label="${label}">${characters.filter((c) => c.kind === kind).map(opt).join('')}</optgroup>`;
  pick.innerHTML = group('hero', 'Heroes') + group('enemy', 'Enemies') + group('minion', 'Minions');
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
        `<button class="chip${n === selected ? ' sel' : ''}" data-part="${n}"><i style="background:${mainColor(p)}"></i>${n}</button>`,
    )
    .join('');
}

function field(id, label, value, { min, max, step = 1 }) {
  return `<div class="field"><label for="${id}">${label}</label>
    <input type="range" id="${id}-r" data-f="${id}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}">
    <input type="number" id="${id}" data-f="${id}" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
}

function renderEditor() {
  const ed = $('editor');
  const p = selected && look().parts[selected];
  if (!p) {
    ed.innerHTML = '<h2>Part</h2><p class="hint">Tap a part on the drawing board, in the preview or in the list above.</p>';
    return;
  }
  const idle = p.idle || {};
  const b = partBox(p);
  const block = !p.art
    ? `<p class="hint">This part is still a plain block. Draw on it to turn it into pixels, or set its block size and colour here.</p>
       <div class="field wide"><label for="f-color">Colour</label><input type="color" id="f-color" value="${toHex(p.color)}"></div>
       ${field('f-w', 'Width', p.w, { min: 1, max: 32 })}
       ${field('f-h', 'Height', p.h, { min: 1, max: 32 })}`
    : `<p class="hint">${b.w} x ${b.h} pixels. Anchor at pixel ${Math.floor(b.anchor[0])}, ${Math.floor(b.anchor[1])} (from its top-left).</p>`;
  ed.innerHTML = `<h2>Part: ${selected}</h2>
    <div class="field wide"><label for="f-name">Name</label><input type="text" id="f-name" value="${selected}"></div>
    ${block}
    ${field('f-x', 'Left / right', p.x, { min: -20, max: 20, step: 0.5 })}
    ${field('f-y', 'Up / down', p.y, { min: -38, max: 6, step: 0.5 })}
    <div class="row"><button id="anchor-mid" class="btn">Anchor to middle</button><button id="anchor-bottom" class="btn">Anchor to bottom</button><button id="clear-part" class="btn danger">Clear pixels</button></div>
    <div class="sub">Idle wiggle${look().anims && look().anims.idle ? ' (not used: this character has an Idle clip)' : ''}</div>
    ${field('f-dy', 'Bob up/down', idle.dy || 0, { min: -6, max: 6, step: 0.5 })}
    ${field('f-angle', 'Tilt (deg)', idle.angle || 0, { min: -45, max: 45 })}
    ${field('f-dur', 'Speed (ms)', idle.duration || 500, { min: 100, max: 2000, step: 10 })}
    ${field('f-delay', 'Delay (ms)', idle.delay || 0, { min: 0, max: 1000, step: 10 })}
    <p id="name-err" class="note" hidden></p>`;
}

function renderWhole() {
  const l = look();
  let html = field('w-height', 'Health bar at', l.height, { min: 4, max: 44 });
  if (l.hover !== undefined) html += field('w-hover', 'Flies at', l.hover, { min: 0, max: 80 });
  $('whole').innerHTML = html;
}

function renderAll() {
  fillPicker();
  renderStatus();
  renderParts();
  renderEditor();
  renderWhole();
  renderSwatches();
  renderUndo();
  renderBoardHint();
  board.render();
  timeline.render();
}

function select(name) {
  selected = name;
  renderParts();
  renderEditor();
  renderBoardHint();
  board.render();
  timeline.render();
}

// Something in the data changed: redraw the preview, the board and the labels.
function changed({ keepEditor = false, fromTimeline = false } = {}) {
  redraw();
  board.render();
  if (!fromTimeline) {
    timeline.resetDrafts(); // the built-in motion follows the parts (e.g. idle wiggle sliders)
    timeline.render();
  }
  fillPicker();
  renderStatus();
  renderParts();
  renderUndo();
  if (!keepEditor) renderEditor();
  else updateEditorNumbers();
  persistDraft();
}

// Keeps the position numbers in the editor up to date while drawing/moving (without rebuilding it).
function updateEditorNumbers() {
  const p = selected && look().parts[selected];
  if (!p) return;
  if (p.art && $('f-w')) return renderEditor(); // it just became pixels: drop the block fields
  for (const [id, v] of [['f-x', p.x], ['f-y', p.y]]) {
    if ($(id) && document.activeElement !== $(id)) $(id).value = v;
    if ($(id + '-r')) $(id + '-r').value = v;
  }
  const info = document.querySelector('#editor .hint');
  if (p.art && info) {
    const b = partBox(p);
    info.textContent = `${b.w} x ${b.h} pixels. Anchor at pixel ${Math.floor(b.anchor[0])}, ${Math.floor(b.anchor[1])} (from its top-left).`;
  }
}

// Reads one editor input back into the data.
function applyField(id, raw) {
  const v = Number(raw);
  if (Number.isNaN(v)) return;
  if (id === 'w-height') return (look().height = v);
  if (id === 'w-hover') return (look().hover = v);
  const p = look().parts[selected];
  if (!p) return;
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
  }
  // Tidy idle: drop zero values; no movement at all = no idle.
  if (p.idle) {
    for (const k of ['dy', 'angle', 'delay']) if (!p.idle[k]) delete p.idle[k];
    if (!p.idle.dy && !p.idle.angle) delete p.idle;
  }
}

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.f) {
    softEdit();
    applyField(t.dataset.f, t.value);
    const twin = t.type === 'range' ? $(t.dataset.f) : $(t.dataset.f + '-r');
    if (twin) twin.value = t.value;
    changed({ keepEditor: true });
  } else if (t.id === 'f-color' && selected) {
    softEdit();
    look().parts[selected].color = fromHex(t.value);
    changed({ keepEditor: true });
  } else if (t.id === 'color') {
    color = parseInt(t.value.slice(1), 16);
    renderSwatches();
  } else if (t.id === 'dim') {
    board.render();
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'pick') {
    endEdit();
    current = t.value;
    selected = null;
    timeline.selKey = null;
    renderAll();
    redraw();
  } else if (t.id === 'f-name' && selected) {
    const name = t.value.trim();
    const err = $('name-err');
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name) || (name !== selected && look().parts[name])) {
      err.hidden = false;
      err.textContent = 'Use letters and digits only, and a name no other part has.';
      return;
    }
    if (name === selected) return;
    beginEdit();
    const next = {};
    for (const [n, p] of Object.entries(look().parts)) next[n === selected ? name : n] = p;
    look().parts = next;
    // Its keyframes follow it.
    for (const clip of Object.values(look().anims || {})) {
      if (clip.tracks[selected]) {
        clip.tracks[name] = clip.tracks[selected];
        delete clip.tracks[selected];
      }
    }
    timeline.collapsed.delete(selected);
    selected = name;
    endEdit();
    changed();
  }
});

// Moves the selected part earlier (-1, drawn behind) or later (+1, drawn in front).
function reorder(dir) {
  if (!selected) return;
  const entries = Object.entries(look().parts);
  const i = entries.findIndex(([n]) => n === selected);
  const j = i + dir;
  if (j < 0 || j >= entries.length) return;
  beginEdit();
  [entries[i], entries[j]] = [entries[j], entries[i]];
  look().parts = Object.fromEntries(entries);
  endEdit();
  changed();
}

function freeName(base) {
  let n = base;
  for (let i = 2; look().parts[n]; i++) n = base + i;
  return n;
}

// A button that changes the data: one undo step.
function act(fn) {
  beginEdit();
  fn();
  endEdit();
  changed();
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.part) return select(t.dataset.part);
  if (t.dataset.mode) return setMode(t.dataset.mode);
  if (t.dataset.tool) return setTool(t.dataset.tool);
  if (t.id === 'mirror-draw') return toggleMirrorDraw();
  if (t.dataset.color) return setColor(Number(t.dataset.color));
  if (t.dataset.anim) {
    anim = t.dataset.anim;
    tlShow = null; // back to playing like the game
    if (timeline.playing) timeline.togglePlay();
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
  const p = selected && look().parts[selected];
  switch (t.id) {
    case 'add':
      // A new part starts as one pixel in the current colour; draw from there.
      return act(() => {
        const name = freeName('part');
        look().parts[name] = { w: 1, h: 1, x: 0.5, y: -11.5, art: { palette: ['0x' + color.toString(16).padStart(6, '0')], rows: ['0'] }, anchor: [0.5, 0.5] };
        selected = name;
        setTool('pencil');
      });
    case 'dupe':
      if (!p) return;
      return act(() => {
        const name = freeName(selected);
        const copy = clone(p);
        copy.x += 2;
        look().parts[name] = copy;
        selected = name;
      });
    case 'remove':
      if (!p || Object.keys(look().parts).length <= 1) return;
      return act(() => {
        delete look().parts[selected];
        for (const clip of Object.values(look().anims || {})) delete clip.tracks[selected];
        timeline.selKey = null;
        selected = null;
      });
    case 'up':
      return reorder(-1);
    case 'down':
      return reorder(1);
    case 'anchor-mid':
    case 'anchor-bottom':
      if (!p) return;
      return act(() => {
        const b = partBox(p);
        if (p.art) p.anchor = [b.w / 2, t.id === 'anchor-mid' ? b.h / 2 : b.h - 0.5];
        else p.pivotY = t.id === 'anchor-mid' ? 0.5 : 1;
        if (!p.art && t.id === 'anchor-mid') delete p.pivotY;
      });
    case 'clear-part':
      if (!p) return;
      return act(() => {
        const b = partBox(p);
        Object.assign(p, { w: 1, h: 1, x: Math.floor(b.left + b.anchor[0]) + 0.5, y: Math.floor(b.top + b.anchor[1]) + 0.5, art: { palette: [], rows: ['.'] }, anchor: [0.5, 0.5] });
        delete p.color;
        delete p.pivotY;
      });
    case 'undo':
      return undoRedo('undo', 'redo');
    case 'redo':
      return undoRedo('redo', 'undo');
    case 'revert':
      return act(() => {
        working[current] = clone(baseline(current));
        selected = null;
        renderAll();
      });
    case 'reset':
      return act(() => {
        working[current] = clone(gameLook[current]);
        selected = null;
        renderAll();
      });
    case 'save':
      return save();
  }
});

// Draw mode: drawing board + part settings. Animate mode: the timeline, and the preview shows the clip
// being edited. The preview stays pinned on the left in both.
function setMode(m) {
  document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  $('mode-draw').hidden = m !== 'draw';
  $('mode-anim').hidden = m !== 'anim';
  $('play-row').hidden = m === 'anim';
  if (m === 'anim') {
    $('stage-hint').textContent = 'Drag a part in the preview to move it at the playhead (adds X / Y keyframes).';
    timeline.render();
    timeline.show();
  } else {
    $('stage-hint').textContent = 'Tap a part in the preview to pick it.';
    if (timeline.playing) timeline.togglePlay();
    tlShow = null;
    anim = 'idle';
    document.querySelectorAll('[data-anim]').forEach((b) => b.classList.toggle('on', b.dataset.anim === 'idle'));
    redraw();
  }
}

// ---- iPad gestures (like Procreate) ---------------------------------------------------------------
// Two-finger tap = undo, three-finger tap = redo (a quick tap without sliding). The first finger may
// already have started a stroke or a drag: that is thrown away as soon as the second finger lands.

let gesture = null;

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  t.classList.remove('show');
  void t.offsetWidth; // restart the fade
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 900);
}

function stopDrags() {
  board.cancel();
  timeline.drag = null;
  if (scene) scene.drag = null;
  cancelEdit();
}

document.addEventListener(
  'touchstart',
  (e) => {
    if (!gesture) gesture = { start: performance.now(), max: 0, moved: false, from: new Map() };
    for (const t of e.changedTouches) gesture.from.set(t.identifier, [t.clientX, t.clientY]);
    gesture.max = Math.max(gesture.max, e.touches.length);
    if (e.touches.length >= 2) stopDrags();
  },
  { passive: true },
);
document.addEventListener(
  'touchmove',
  (e) => {
    if (!gesture) return;
    for (const t of e.changedTouches) {
      const f = gesture.from.get(t.identifier);
      if (f && Math.hypot(t.clientX - f[0], t.clientY - f[1]) > 14) gesture.moved = true;
    }
  },
  { passive: true },
);
const touchEnd = (e) => {
  if (!gesture || e.touches.length) return;
  const g = gesture;
  gesture = null;
  if (g.moved || performance.now() - g.start > 400 || g.max < 2) return;
  if (g.max === 2) {
    const can = hist().undo.length;
    undoRedo('undo', 'redo');
    toast(can ? 'Undo' : 'Nothing to undo');
  } else if (g.max === 3) {
    const can = hist().redo.length;
    undoRedo('redo', 'undo');
    toast(can ? 'Redo' : 'Nothing to redo');
  }
};
document.addEventListener('touchend', touchEnd, { passive: true });
document.addEventListener('touchcancel', touchEnd, { passive: true });

// Keyboard shortcuts (not while typing in a box).
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input[type=text], input[type=number]')) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') {
    e.preventDefault();
    return e.shiftKey ? undoRedo('redo', 'undo') : undoRedo('undo', 'redo');
  }
  if ((e.ctrlKey || e.metaKey) && k === 'y') {
    e.preventDefault();
    return undoRedo('redo', 'undo');
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const keys = { b: 'pencil', e: 'eraser', l: 'line', r: 'rect', g: 'fill', i: 'picker', a: 'anchor', m: 'move' };
  if (k === 's') return toggleMirrorDraw();
  if (keys[k]) setTool(keys[k]);
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
    if (d.anims) l.anims = d.anims;
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

$('mirror-draw').classList.toggle('on', mirrorOn);
$('mirror-draw').setAttribute('aria-pressed', String(mirrorOn));
loadDraft();
renderAll();
connect();
