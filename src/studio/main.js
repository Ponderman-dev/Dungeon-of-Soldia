// Character Studio: draw how heroes, enemies and minions look (pixel-art parts) and save the designs.
// The live preview uses the game's own Character class, so it moves exactly like the game (pixel steps).
// Saved designs go to the page's online store (collection "designs"); Claude copies them into
// heroes.json / enemies.json / minions.json with scripts/apply-designs.mjs. Without the store
// (local dev) they are kept in this browser only.
import Phaser from 'phaser';
import Character from '../entities/Character.js';
import Board, { partBox, transformPart } from './board.js';
import Timeline, { mainColor } from './timeline.js';
import EffectsEditor from './effects.js';
import { partArt, artPixels, flipGridH, flipGridV, rotateGrid90, outlineGrid, replaceColorGrid, pixelsToArt, OUTLINE } from '../systems/pixelArt.js';
import heroes from '../data/heroes.json';
import enemies from '../data/enemies.json';
import minions from '../data/minions.json';
import items from '../data/items.json';
import itemIcons from '../data/itemIcons.json';
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

// An item icon as a one-part "character": the 16x16 picture sits on the floor (feet = bottom edge).
function iconDef(art) {
  return { height: 16, parts: { icon: { x: 0, y: -8, w: 16, h: 16, art: clone(art), anchor: [8, 8] } } };
}

// Every character the studio can edit, with its game version (from the JSON files).
const characters = [
  ...heroes.map((h) => ({ key: `hero-${h.id}`, kind: 'hero', id: h.id, name: h.name, def: h })),
  ...Object.entries(enemies).map(([id, e]) => ({ key: `enemy-${id}`, kind: 'enemy', id, name: e.name, def: e })),
  ...Object.entries(minions)
    .filter(([, m]) => m && m.parts)
    .map(([id, m]) => ({ key: `minion-${id}`, kind: 'minion', id, name: m.name, def: m })),
  // Item icons (itemIcons.json): one 16x16 part called "icon", standing on the floor like a character.
  ...Object.entries(itemIcons)
    .filter(([id]) => items[id])
    .map(([id, art]) => ({ key: `item-${id}`, kind: 'item', id, name: items[id].name, def: iconDef(art) })),
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
let tlShow = null; // { clip, t, ghosts }: the timeline is showing this clip in the preview (null = play like the game)
let speed = 1; // preview speed (slow motion: 0.5, 0.25)
let mirror = false; // looking the other way (the game mirrors fighters to face their target)

class StudioScene extends Phaser.Scene {
  constructor() {
    super('studio');
  }

  create() {
    // Clips run on this clock, so slow motion slows them too (Character.now() asks for it).
    this.slowNow = 0;
    this.clipNow = () => this.slowNow;
    this.ghosts = [];
    this.grid = this.add.graphics();
    this.marks = this.add.graphics().setDepth(5);
    this.sel = this.add.graphics().setDepth(10);
    this.ch = null;
    this.play(anim);
    // Tapping the preview picks the front-most part there. With a timeline clip showing, dragging the
    // part moves it at the playhead (adds X / Y keyframes).
    this.input.on('pointerdown', (p) => {
      if (anim === 'arena' && !tlShow) return;
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
    for (const g of this.ghosts) g.destroy();
    this.ghosts = [];
    if (this.arenaFoe) this.arenaFoe.destroy();
    this.arenaFoe = null;
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.loop = null;
    const def = { parts: look().parts, anims: look().anims };
    // Onion skin: faint red / green ghosts of the pose a moment before / after the playhead.
    if (tlShow && tlShow.ghosts) {
      tlShow.ghosts.forEach((t, i) => {
        const g = new Character(this, STAGE / 2, this.feetY(), def);
        g.setScale(mirror ? -zoom : zoom, zoom).setAlpha(0.35).setDepth(-1);
        g.freeze();
        for (const part of Object.values(g.parts)) part.image.setTint(i ? 0x57e07a : 0xff5a5a).setTintMode(Phaser.TintModes.FILL);
        g.showClip(tlShow.clip, t);
        this.ghosts.push(g);
      });
    }
    this.ch = new Character(this, STAGE / 2, this.feetY(), def);
    this.ch.setScale(mirror ? -zoom : zoom, zoom);
    if (anim !== 'idle' || tlShow) this.ch.freeze();
    if (tlShow) this.ch.showClip(tlShow.clip, tlShow.t);
    this.drawGrid();
  }

  // Shows the timeline's clip at its playhead (and the onion-skin ghosts) without rebuilding.
  showTimeline() {
    const want = tlShow && tlShow.ghosts ? tlShow.ghosts.length : 0;
    if (!this.ch || !this.ch.active || !this.ch.override || this.ghosts.length !== want) return this.play(anim);
    this.ch.showClip(tlShow.clip, tlShow.t);
    this.ghosts.forEach((g, i) => g.showClip(tlShow.clip, tlShow.ghosts[i]));
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

  update(time, delta) {
    this.slowNow += delta * speed;
    if (anim === 'arena' && this.ch && !tlShow) {
      // Skills lift / crouch the hero (castLift), like followPositions() in the battle.
      if (!this.ch.moveTween) this.ch.y = this.arenaY - this.ch.castLift;
      return this.sel.clear();
    }
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
    if (name === 'arena') return this.arena();
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
    } else if (name === 'stunned') {
      ch.setStunned(true);
    } else if (name === 'victory') {
      const go = () => ch.active && anim === 'victory' && ch.cheer();
      go();
      this.loop = this.time.addEvent({ delay: 1600, loop: true, callback: go });
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

// ARENA TEST: a little fight at game size with the game's own Character class and the same timings:
// walk over (walk clip), 3 swings (attack clip, the hit lands at swingMs: flash, hurt clip, damage number),
// the enemy hits back, a skill (wind-up + release), walk home; every 2nd round the enemy falls (death clip).
StudioScene.prototype.arena = function () {
  const S = 3; // game size
  const me = this.ch;
  const ground = 292;
  this.arenaY = ground - (look().hover || 0);
  me.setScale(S).setPosition(95, this.arenaY);
  me.homeX = 95;
  me.homeY = this.arenaY;
  me.face(1);
  this.grid.clear();
  const m = this.marks.clear();
  m.fillStyle(0x1b1629, 1).fillRect(0, ground, STAGE, STAGE - ground);
  m.lineStyle(2, 0x3d3460, 1).lineBetween(0, ground, STAGE, ground);
  const foeKey = byKey[current].kind === 'hero' ? 'enemy-goblin' : 'hero-knight';
  const foeLook = working[foeKey];
  const foeY = ground - (foeLook.hover || 0);
  const makeFoe = () => {
    const f = new Character(this, 285, foeY, { parts: foeLook.parts, anims: foeLook.anims });
    f.setScale(S).face(-1);
    return f;
  };
  this.arenaFoe = makeFoe();
  const live = () => anim === 'arena' && !tlShow && me.active;
  const swingMs = combat.attackTiming.hero.swingMs;
  const M = combat.attackMotion;
  const hop = { height: M.hopHeight, length: M.hopLengthPx };
  const pop = (target, text, color, big) => {
    const t = this.add.text(target.x, target.y - 80, text, { fontFamily: 'monospace', fontSize: big ? '22px' : '15px', color, stroke: '#14101f', strokeThickness: 3 }).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: t, y: t.y - 26, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  };
  const hit = (target, n, color, big) => {
    if (!live() || !target.active) return;
    target.flash(color === '#ffffff' ? 0xffffff : 0xffa040, 90);
    target.hurt();
    pop(target, String(n), color, big);
  };
  const at = (ms, fn) => this.time.delayedCall(ms, () => live() && fn());
  let round = 0;
  const fight = () => {
    if (!live()) return;
    round++;
    const foe = this.arenaFoe;
    me.moveTo(foe.x - 62, me.homeY, 650, {
      hop,
      onDone: () => {
        if (!live()) return;
        let t = 0;
        for (let i = 0; i < 3; i++) {
          at(t, () => me.swing(swingMs));
          at(t + swingMs, () => hit(foe, 8 + Math.floor(Math.random() * 6), '#ffffff'));
          t += 650;
        }
        at(t, () => foe.swing(combat.attackTiming.enemy.swingMs));
        at(t + combat.attackTiming.enemy.swingMs, () => hit(me, 3 + Math.floor(Math.random() * 3), '#ff6b6b'));
        t += 700;
        at(t, () => me.castWindUp(700));
        at(t + 700, () => {
          me.castRelease('attack');
          hit(foe, 24 + Math.floor(Math.random() * 8), '#ffa040', true);
          this.cameras.main.shake(90, 0.006);
        });
        t += 1300;
        if (round % 2 === 0) {
          at(t, () => {
            foe.die();
            this.tweens.add({ targets: foe, alpha: 0, delay: 500, duration: 400 });
          });
          at(t + 1100, () => {
            foe.destroy();
            this.arenaFoe = makeFoe();
          });
          t += 1100;
        }
        at(t, () =>
          me.moveTo(me.homeX, me.homeY, 650, { hop, onDone: () => at(500, () => { me.face(1); fight(); }) }),
        );
      },
    });
  };
  at(400, fight);
};

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
  lighten: () => $('lighten').checked,
  dim: () => $('dim').checked,
  mirror: () => mirrorOn,
  trace: () => trace,
  copyMove: () => $('sel-copy').checked,
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
  show: (clip, t, ghosts) => {
    // The timeline takes over the preview; the Play buttons give it back.
    tlShow = { clip, t, ghosts };
    document.querySelectorAll('[data-anim]').forEach((b) => b.classList.remove('on'));
    if (scene && scene.grid) scene.showTimeline();
  },
  speed: () => speed,
  others: () => characters.filter((c) => c.key !== current).map((c) => ({ key: c.key, name: c.name })),
  copyClipTo: (key, id, clip) => {
    // Only the layers whose part names the other character also has come along.
    const other = working[key];
    const tracks = {};
    for (const [part, t] of Object.entries(clip.tracks)) if (other.parts[part]) tracks[part] = clone(t);
    const n = Object.keys(tracks).length;
    if (!n && Object.keys(clip.tracks).length) return toast(`${byKey[key].name} has none of these parts`);
    other.anims = other.anims || {};
    other.anims[id] = { length: clip.length, tracks };
    if (clip.hitAt) other.anims[id].hitAt = clip.hitAt;
    persistDraft();
    fillPicker();
    toast(`Copied to ${byKey[key].name}`);
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
  if (name !== tool) board.sel = null;
  tool = name;
  document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === name));
  // The row above the board shows only the picked tool's options.
  document.querySelectorAll('[data-opt]').forEach((el) => (el.hidden = !el.dataset.opt.split(' ').includes(name)));
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
    ellipse: 'Ellipse: drag from corner to corner (a square box makes a circle).',
    shade: 'Shade: rub over pixels to make them darker (Shift or "Shade lightens" = lighter).',
    fill: 'Fill: colours the area of one colour you tap.',
    picker: 'Pick: tap any pixel to take its colour.',
    anchor: 'Anchor: tap the pixel the part should turn around.',
    move: 'Move: tap a part to pick it, drag to move it.',
    select: 'Select: drag a box, then drag inside it to move those pixels. Delete clears them, Esc lets go.',
  };
  const names = { rect: 'Rectangle', picker: 'Pick colour' };
  $('tool-name').textContent = names[tool] || tool[0].toUpperCase() + tool.slice(1);
  $('board').title = selected ? hints[tool] : 'Tap a part to pick it, then draw.';
}

function usedColors() {
  const used = [];
  for (const p of Object.values(look().parts)) {
    for (const row of artPixels(partArt(p))) for (const c of row) if (c !== null && !used.includes(c)) used.push(c);
  }
  return used;
}

// Colours used in this character first, then the starter colours.
function renderSwatches() {
  const used = usedColors();
  const st = document.querySelector('.swapto');
  if (st) st.style.background = hex(color);
  const sw = (c) =>
    `<button class="sw${c === color ? ' sel' : ''}" data-color="${c}" style="background:${hex(c)}" aria-label="Colour ${hex(c)}"></button>`;
  $('swatches').innerHTML =
    `<span class="label sw-lbl">${byKey[current].name}</span>${used.map(sw).join('')}` +
    `<span class="label sw-lbl">Starter</span>${STARTER.map(sw).join('')}`;
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

// The studio has three sections: Units (heroes, enemies, minions), Items (item icons) and Effects.
let section = 'units';
let effectsEditor = null; // the Effects section (built the first time it is opened)
let effectsDb; // the page's store once connect() ran (null = none, saves stay in this browser)
const sectionOf = (c) => (c.kind === 'item' ? 'items' : 'units');
function setSection(s) {
  section = s;
  document.querySelectorAll('[data-sect]').forEach((b) => b.classList.toggle('on', b.dataset.sect === s));
  const fx = s === 'effects';
  $('effects-pane').hidden = !fx;
  if (fx && !effectsEditor) effectsEditor = new EffectsEditor($('effects-pane'));
  if (fx && effectsDb !== undefined && !effectsEditor.store) effectsEditor.connect(effectsDb, LOCAL_KEY);
  $('unit-pane').hidden = fx;
  $('pick').hidden = fx;
  $('mode-tabs').hidden = fx;
  $('status').hidden = fx;
  $('save').hidden = fx;
  if (fx) return;
  if (sectionOf(byKey[current]) !== s) {
    endEdit();
    current = characters.find((c) => sectionOf(c) === s).key;
    selected = null;
    timeline.selKey = null;
  }
  renderAll();
  redraw();
  if (!$('mode-lineup').hidden) drawLineup();
}

function fillPicker() {
  const pick = $('pick');
  const opt = (c) => {
    const dirty = !same(working[c.key], baseline(c.key));
    const tag = dirty ? ' •' : savedLook[c.key] ? ' (saved)' : '';
    return `<option value="${c.key}"${c.key === current ? ' selected' : ''}>${c.name}${tag}</option>`;
  };
  const group = (kind, label) =>
    `<optgroup label="${label}">${characters.filter((c) => c.kind === kind).map(opt).join('')}</optgroup>`;
  pick.innerHTML = section === 'items' ? group('item', 'Item icons') : group('hero', 'Heroes') + group('enemy', 'Enemies') + group('minion', 'Minions');
}

function renderStatus() {
  const s = $('status');
  const dirty = !same(look(), baseline(current));
  s.className = 'status' + (dirty ? ' dirty' : savedLook[current] ? ' saved' : '');
  s.textContent = dirty ? 'Unsaved changes' : savedLook[current] ? 'Saved design' : 'Game version';
  $('save').disabled = !dirty || !store;
}


// One row per part (drawn later = lower = in front): a small picture, up / down, and the '...' menu.
function renderParts() {
  const entries = Object.entries(look().parts);
  $('parts').innerHTML = entries
    .map(
      ([n], i) =>
        `<div class="prow${n === selected ? ' sel' : ''}">
          <button class="pname" data-part="${n}"><canvas width="28" height="28" data-thumb="${n}"></canvas>${n}</button>
          <button class="pbtn" data-move="-1" data-for="${n}" title="Draw earlier (behind)" aria-label="Move ${n} up"${i ? '' : ' disabled'}>↑</button>
          <button class="pbtn" data-move="1" data-for="${n}" title="Draw later (in front)" aria-label="Move ${n} down"${i < entries.length - 1 ? '' : ' disabled'}>↓</button>
          <button class="pbtn" data-menu="${n}" title="More: rename, flip, turn, outline, copy, delete…" aria-label="More for ${n}">⋯</button>
        </div>`,
    )
    .join('');
  for (const cv of $('parts').querySelectorAll('[data-thumb]')) drawThumb(cv, look().parts[cv.dataset.thumb]);
}

// A part's pixels, as big as fits, in the middle of a small canvas.
function drawThumb(cv, p) {
  const grid = artPixels(partArt(p));
  const h = grid.length;
  const w = grid[0] ? grid[0].length : 1;
  const s = Math.max(1, Math.floor(Math.min(cv.width / w, cv.height / h)));
  const ox = Math.floor((cv.width - w * s) / 2);
  const oy = Math.floor((cv.height - h * s) / 2);
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  grid.forEach((row, y) =>
    row.forEach((c, x) => {
      if (c === null) return;
      ctx.fillStyle = hex(c);
      ctx.fillRect(ox + x * s, oy + y * s, s, s);
    }),
  );
}

// The part '...' menu: a pop-up next to the button with everything about that part.
let menuFor = null;
function openPartMenu(name, btn) {
  if (menuFor === name && !$('part-menu').hidden) return closePops();
  closePops();
  const r = btn.getBoundingClientRect(); // before select() redraws the list
  select(name);
  menuFor = name;
  const m = $('part-menu');
  m.hidden = false;
  m.style.left = Math.min(r.right + 8, innerWidth - m.offsetWidth - 12) + 'px';
  m.style.top = Math.max(12, Math.min(r.top - 12, innerHeight - m.offsetHeight - 12)) + 'px';
}
function closePops() {
  menuFor = null;
  $('part-menu').hidden = true;
  $('help-pop').hidden = true;
  $('help').setAttribute('aria-expanded', 'false');
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
    ed.innerHTML = '<h2>Part</h2><p class="hint">Tap a part on the drawing board, in the preview or in the parts list.</p>';
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
    <div class="row">
      <button id="flip-h" class="btn" title="Flip left/right">Flip ↔</button>
      <button id="flip-v" class="btn" title="Flip upside down">Flip ↕</button>
      <button id="turn-90" class="btn" title="Turn a quarter turn clockwise">Turn 90°</button>
      <button id="outline" class="btn" title="Add a 1-pixel dark outline around the drawing">Add outline</button>
      <select id="copy-part-to" aria-label="Copy this part to another character"><option value="">Copy part to…</option>${characters
        .filter((c) => c.key !== current)
        .map((c) => `<option value="${c.key}">${c.name}</option>`)
        .join('')}</select>
    </div>
    <div class="sub">Idle wiggle${look().anims && look().anims.idle ? ' (not used: this character has an Idle clip)' : ''}</div>
    ${field('f-dy', 'Bob up/down', idle.dy || 0, { min: -6, max: 6, step: 0.5 })}
    ${field('f-angle', 'Tilt (deg)', idle.angle || 0, { min: -45, max: 45 })}
    ${field('f-dur', 'Speed (ms)', idle.duration || 500, { min: 100, max: 2000, step: 10 })}
    ${field('f-delay', 'Delay (ms)', idle.delay || 0, { min: 0, max: 1000, step: 10 })}
    <p id="name-err" class="note" hidden></p>
    <div class="row"><button id="dupe" class="btn">Copy part</button><button id="remove" class="btn danger">Delete part</button></div>`;
}

let swapOpen = false; // the "Swap colour" row is open

// Saved versions of each character (newest first), loaded when the character is opened.
const versions = {};
async function loadVersions(key) {
  if (!store || versions[key]) return;
  try {
    versions[key] = await store.versions(key);
  } catch {
    versions[key] = [];
  }
  if (key === current) renderWhole();
}

// Characters whose saved design is not in the game yet (Claude copies them in).
function waitingForGame() {
  return characters.filter((c) => savedLook[c.key] && !same(savedLook[c.key], gameLook[c.key])).map((c) => c.name);
}

function renderWhole() {
  const l = look();
  loadVersions(current);
  let html = field('w-height', 'Health bar', l.height, { min: 4, max: 44 });
  if (l.hover !== undefined) html += field('w-hover', 'Flies at', l.hover, { min: 0, max: 80 });
  // Colour swap: every pixel of one colour, in every part, becomes the current colour.
  const used = usedColors();
  const vs = versions[current] || [];
  html += `<div class="row">
      <button id="swap-open" class="btn sm${swapOpen ? ' on' : ''}" aria-expanded="${swapOpen}">Swap colour</button>
      <select id="version-pick" aria-label="Load a saved version" title="Load a saved version (as unsaved changes; Undo brings back what you had)"${
        vs.length ? '' : ' disabled'
      }><option value="">${vs.length ? `Versions (${vs.length})` : 'No versions yet'}</option>${vs
        .map((v, i) => `<option value="${i}">${new Date(v.savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</option>`)
        .join('')}</select>
      <label class="btn sm" for="trace-file" title="Put a picture behind the grid to trace over">Trace…</label></div>
    <div class="row"${swapOpen ? '' : ' hidden'}><select id="swap-from" aria-label="Colour to replace">${used
      .map((c) => `<option value="${c}" style="background:${hex(c)}">${hex(c)}</option>`)
      .join('')}</select>
      <span class="hint">→ the current colour</span>
      <i class="swapto" style="background:${hex(color)}"></i>
      <button id="swap-colour" class="btn">Swap everywhere</button></div>`;
  const waiting = waitingForGame();
  if (waiting.length)
    html += `<p class="tl-banner own">Saved, not in the game yet: <b>${waiting.join(', ')}</b>. Tell Claude “apply the studio designs”.</p>`;
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
  } else if (t.id === 'trace-alpha') {
    if (trace) trace.alpha = Number(t.value);
    board.render();
  } else if (t.id === 'dim') {
    board.render();
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'anim-pick') return playAnim(t.value);
  if (t.id === 'speed-pick') return setSpeed(Number(t.value));
  if (t.id === 'zoom-pick') {
    zoom = Number(t.value);
    return redraw();
  }
  if (t.id === 'pick') {
    endEdit();
    current = t.value;
    selected = null;
    timeline.selKey = null;
    renderAll();
    redraw();
  } else if (t.id === 'version-pick' && t.value !== '') {
    const v = (versions[current] || [])[Number(t.value)];
    if (!v) return;
    beginEdit();
    const l = { height: v.height, parts: clone(v.parts) };
    if (v.hover !== undefined) l.hover = v.hover;
    if (v.anims) l.anims = clone(v.anims);
    working[current] = l;
    endEdit();
    selected = null;
    timeline.selKey = null;
    renderAll();
    redraw();
    persistDraft();
    toast('Saved version loaded');
  } else if (t.id === 'copy-part-to' && t.value && selected) {
    // The other character gets this part (a part with the same name there is replaced).
    const other = working[t.value];
    other.parts[selected] = clone(look().parts[selected]);
    persistDraft();
    fillPicker();
    toast(`${selected} copied to ${byKey[t.value].name}`);
    t.value = '';
  } else if (t.id === 'trace-file' && t.files && t.files[0]) {
    const reader = new FileReader();
    reader.onload = () => setTrace(reader.result);
    reader.readAsDataURL(t.files[0]);
    t.value = '';
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

// Plays one of the preview's animations (or the Arena) like the game, taking the preview back from the timeline.
function playAnim(a) {
  anim = a;
  tlShow = null;
  if (timeline.playing) timeline.togglePlay();
  document.querySelectorAll('[data-anim]').forEach((b) => b.classList.toggle('on', b.dataset.anim === a));
  if (a !== 'arena') $('anim-pick').value = a;
  redraw();
}

function setSpeed(v) {
  speed = v;
  $('speed-pick').value = String(v);
  if (scene && scene.grid) {
    scene.tweens.timeScale = speed;
    scene.time.timeScale = speed;
  }
}

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
  // A tap outside a pop-up closes it.
  if (!e.target.closest('.pop, [data-menu], #help')) closePops();
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.menu) return openPartMenu(t.dataset.menu, t);
  if (t.dataset.move) {
    select(t.dataset.for);
    return reorder(Number(t.dataset.move));
  }
  if (t.dataset.part) return select(t.dataset.part);
  if (t.dataset.sect) return setSection(t.dataset.sect);
  if (t.dataset.mode) return setMode(t.dataset.mode);
  if (t.dataset.tool) return setTool(t.dataset.tool);
  if (t.id === 'mirror-draw') return toggleMirrorDraw();
  if (t.dataset.color) return setColor(Number(t.dataset.color));
  if (t.dataset.anim) return playAnim(t.dataset.anim);
  if (t.id === 'replay') return playAnim($('anim-pick').value);
  if (t.id === 'help') {
    const open = $('help-pop').hidden;
    closePops();
    $('help-pop').hidden = !open;
    return t.setAttribute('aria-expanded', String(open));
  }
  if (t.id === 'swap-open') {
    swapOpen = !swapOpen;
    return renderWhole();
  }
  if (t.id === 'mirror') {
    mirror = !mirror;
    t.classList.toggle('on', mirror);
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
      closePops();
      return act(() => {
        delete look().parts[selected];
        for (const clip of Object.values(look().anims || {})) delete clip.tracks[selected];
        timeline.selKey = null;
        selected = null;
      });
    case 'anchor-mid':
    case 'anchor-bottom':
      if (!p) return;
      return act(() => {
        const b = partBox(p);
        if (p.art) p.anchor = [b.w / 2, t.id === 'anchor-mid' ? b.h / 2 : b.h - 0.5];
        else p.pivotY = t.id === 'anchor-mid' ? 0.5 : 1;
        if (!p.art && t.id === 'anchor-mid') delete p.pivotY;
      });
    case 'flip-h':
    case 'flip-v':
    case 'turn-90':
    case 'outline':
      if (!p) return;
      return act(() => {
        const fn = { 'flip-h': flipGridH, 'flip-v': flipGridV, 'turn-90': rotateGrid90 }[t.id];
        transformPart(p, fn || ((g, a) => outlineGrid(g, a, Number(OUTLINE))));
      });
    case 'swap-colour': {
      const from = Number($('swap-from').value);
      if (!from && from !== 0) return;
      return act(() => {
        for (const part of Object.values(look().parts)) {
          if (part.art) part.art = pixelsToArt(replaceColorGrid(artPixels(part.art), from, color));
          else if (Number(part.color) === from) part.color = '0x' + color.toString(16).padStart(6, '0');
        }
        toast('Colour swapped');
      });
    }
    case 'trace-off':
      return setTrace(null);
    case 'sel-clear':
      return board.clearSelection();
    case 'board-in':
    case 'board-out':
    case 'board-fit':
      return setBoardZoom(t.id === 'board-fit' ? 1 : boardZoom * (t.id === 'board-in' ? 1.5 : 1 / 1.5));
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
  $('mode-lineup').hidden = m !== 'lineup';
  if (m === 'lineup') drawLineup();
  closePops();
  $('play-row').hidden = m === 'anim';
  // Parts and Whole character belong to drawing (the timeline has its own layer list).
  $('parts-card').hidden = m !== 'draw';
  $('whole-card').hidden = m !== 'draw';
  $('stage-hint').hidden = m !== 'anim';
  if (m === 'anim') {
    $('stage-hint').textContent = 'Drag a part in the preview to move it at the playhead (adds X / Y keyframes).';
    timeline.render();
    timeline.show();
  } else {
    if (timeline.playing) timeline.togglePlay();
    playAnim('idle');
  }
  if (m === 'draw') fitBoard();
}

// ---- Board zoom (buttons, or pinch with two fingers on the iPad) -------------------------------------

// 100% = the whole board fits its box (it fills the space next to the tool strip); more scrolls inside it.
let boardZoom = 1;
function setBoardZoom(z) {
  boardZoom = Math.max(1, Math.min(4, z));
  $('board-fit').textContent = Math.round(boardZoom * 100) + '%';
  fitBoard();
}
function fitBoard() {
  const wrap = document.querySelector('.boardwrap');
  const cv = $('board');
  if (!wrap.clientWidth) return; // hidden
  const fit = Math.min((wrap.clientWidth - 2) / cv.width, (wrap.clientHeight - 2) / cv.height);
  cv.style.width = Math.floor(cv.width * fit * boardZoom) + 'px';
}
new ResizeObserver(fitBoard).observe(document.querySelector('.boardwrap'));

// ---- Tracing picture (behind the drawing board) ------------------------------------------------------

let trace = null; // { img, alpha }
function setTrace(url) {
  try {
    if (url) localStorage.setItem('soldia-studio-trace', url);
    else localStorage.removeItem('soldia-studio-trace');
  } catch {
    /* too big or blocked: it still works until a reload */
  }
  if (!url) {
    trace = null;
    $('trace-controls').hidden = true;
    return board.render();
  }
  const img = new Image();
  img.onload = () => board.render();
  img.src = url;
  trace = { img, alpha: Number($('trace-alpha').value) };
  $('trace-controls').hidden = false;
  board.render();
}

// ---- Line-up: every character side by side at game size, on the dungeon floor -----------------------

function drawLineup() {
  const cv = $('lineup');
  const ctx = cv.getContext('2d');
  const S = 3; // game size
  const groups = (section === 'items'
    ? [['Item icons', characters.filter((c) => c.kind === 'item')]]
    : [
        ['Heroes', characters.filter((c) => c.kind === 'hero')],
        ['Enemies', characters.filter((c) => c.kind === 'enemy')],
        ['Minions', characters.filter((c) => c.kind === 'minion')],
      ]);
  const slot = 104;
  const perRow = Math.max(1, Math.floor((cv.clientWidth || 1000) / slot));
  const rows = groups.reduce((n, [, list]) => n + Math.ceil(list.length / perRow), 0);
  const rowH = 150;
  cv.width = perRow * slot;
  cv.height = rows * rowH + groups.length * 28;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#14101f';
  ctx.fillRect(0, 0, cv.width, cv.height);
  let y = 0;
  for (const [label, list] of groups) {
    ctx.fillStyle = '#9a90b3';
    ctx.font = '12px "IBM Plex Mono", monospace';
    ctx.fillText(label.toUpperCase(), 8, y + 18);
    y += 28;
    for (let i = 0; i < list.length; i += perRow) {
      const floorY = y + 110;
      ctx.fillStyle = '#1d1830';
      ctx.fillRect(0, floorY, cv.width, rowH - 110);
      ctx.fillStyle = '#342c4d';
      ctx.fillRect(0, floorY, cv.width, 2);
      list.slice(i, i + perRow).forEach((c, j) => {
        const l = working[c.key];
        const fx = j * slot + slot / 2;
        const fy = floorY - (l.hover || 0);
        for (const p of Object.values(l.parts)) {
          const b = partBox(p);
          b.grid.forEach((row, gy) =>
            row.forEach((col, gx) => {
              if (col === null) return;
              ctx.fillStyle = hex(col);
              ctx.fillRect(Math.round(fx + (b.left + gx) * S), Math.round(fy + (b.top + gy) * S), S, S);
            }),
          );
        }
        ctx.fillStyle = c.key === current ? '#f2b33d' : '#ece6f7';
        ctx.font = '12px "IBM Plex Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(c.name, fx, floorY + 24);
        ctx.textAlign = 'left';
      });
      y += rowH;
    }
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
    if (!gesture) gesture = { start: performance.now(), max: 0, moved: false, from: new Map(), onBoard: !!e.target.closest('.boardwrap') };
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
    // Two fingers spreading / pinching on the drawing board zoom it.
    if (gesture.onBoard && e.touches.length === 2 && gesture.moved) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (!gesture.pinch) gesture.pinch = { d, z: boardZoom };
      else setBoardZoom((gesture.pinch.z * d) / gesture.pinch.d);
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
  if ((k === 'delete' || k === 'backspace') && tool === 'select' && board.sel) {
    e.preventDefault();
    return board.clearSelection();
  }
  if (k === 'escape' && (!$('part-menu').hidden || !$('help-pop').hidden)) return closePops();
  if (k === 'escape' && board.sel) {
    board.sel = null;
    return board.render();
  }
  const keys = { b: 'pencil', e: 'eraser', l: 'line', r: 'rect', o: 'ellipse', d: 'shade', g: 'fill', i: 'picker', a: 'anchor', m: 'move', v: 'select' };
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
    // Every save is also kept as an older version (the newest 15 per character).
    store.keep(current, doc).catch(() => {});
    versions[current] = [doc, ...(versions[current] || [])].slice(0, 15);
    btn.textContent = 'Save';
    renderAll();
  } catch (err) {
    btn.textContent = 'Save';
    btn.disabled = false;
    const note = $('dbnote');
    note.hidden = false;
    note.textContent = 'Could not save (' + (err && err.code ? err.code : 'error') + '). Try again in a moment.';
  }
}

// Unsaved edits are also kept in this browser, so a reload does not lose them. Only characters that
// were actually changed are kept, each with a fingerprint of the game look it was drawn over: when the
// game look changes later (new sprites), an old draft no longer hides it (it is set aside instead).
const DRAFT_KEY = LOCAL_KEY + '-draft2';
const fingerprint = (o) => {
  const t = JSON.stringify(o);
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return h.toString(36);
};
function persistDraft() {
  try {
    const d = {};
    for (const [k, look] of Object.entries(working)) {
      if (!same(look, baseline(k))) d[k] = { look, base: fingerprint(gameLook[k]) };
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* storage blocked: fine */
  }
}

function loadDraft() {
  try {
    // Drafts from the old studio (every character, no fingerprint) were made over the old game looks:
    // keep them aside under '-draft-old' and start from the game.
    const old = localStorage.getItem(LOCAL_KEY + '-draft');
    if (old) {
      localStorage.setItem(LOCAL_KEY + '-draft-old', old);
      localStorage.removeItem(LOCAL_KEY + '-draft');
    }
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (d) for (const k of Object.keys(d)) if (working[k] && d[k].base === fingerprint(gameLook[k])) working[k] = d[k].look;
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
  effectsDb = db;
  if (effectsEditor && !effectsEditor.store) effectsEditor.connect(db, LOCAL_KEY);
  if (db) {
    const col = db.collection('designs');
    try {
      const snap = await col.get();
      useSaved(snap.docs.map((d) => d.data()));
    } catch {
      /* empty or not reachable yet: start from the game versions */
    }
    const hist = db.collection('history');
    store = {
      save: (key, doc) => col.doc(key).set(doc),
      keep: async (key, doc) => {
        await hist.doc(`${key}--${Date.parse(doc.savedAt)}`).set({ key, ...doc });
        const old = (await hist.where('key', '==', key).get()).docs
          .map((d) => d.data())
          .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1))
          .slice(15);
        for (const o of old) await hist.doc(`${key}--${Date.parse(o.savedAt)}`).delete();
      },
      versions: async (key) =>
        (await hist.where('key', '==', key).get()).docs.map((d) => d.data()).sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1)),
    };
  } else {
    // No online store (running locally): keep saves in this browser.
    let local = {};
    try {
      local = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    } catch {
      /* nothing */
    }
    useSaved(Object.values(local));
    const readHist = () => {
      try {
        return JSON.parse(localStorage.getItem(LOCAL_KEY + '-history') || '{}');
      } catch {
        return {};
      }
    };
    store = {
      save: async (key, doc) => {
        local[key] = doc;
        localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
      },
      keep: async (key, doc) => {
        const h = readHist();
        h[key] = [doc, ...(h[key] || [])].slice(0, 15);
        localStorage.setItem(LOCAL_KEY + '-history', JSON.stringify(h));
      },
      versions: async (key) => readHist()[key] || [],
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
try {
  const savedTrace = localStorage.getItem('soldia-studio-trace');
  if (savedTrace) setTrace(savedTrace);
} catch {
  /* none */
}
setTool(tool);
renderAll();
connect();
