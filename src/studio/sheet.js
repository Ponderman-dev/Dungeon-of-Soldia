// The Character Studio's SHEET tab: 6 drawing canvases side by side (3 x 2). Each canvas shows any
// sprite (picked with its own drop-down) with its parts as small thumbnails on the right, or, in ITEM
// MODE, 3 x 3 small item-icon canvases, each with its own drop-down. Tapping a canvas makes it the
// active one (gold border): the shared tools, colours, undo and Save then work on that sprite.
// Plain DOM + Board (board.js); the edit/undo/save logic stays in main.js (hooks below).
import Board, { VIEW } from './board.js';

// Item icons are 16 x 16, standing on the floor: show just that square (+1 pixel around it).
const ICON_VIEW = { minX: -9, minY: -17, cols: 18, rows: 18, cell: 12 };
const STORE_KEY = 'soldia-studio-sheet';

export default class Sheet {
  // hooks: characters ([{ key, kind, name }]), look(key), boardHooks(ref) (Board hooks for a canvas
  // showing ref.key with ref.sel as its selected part), activate(key, sel) (this canvas is now the one
  // being edited), drawThumb(canvas, part)
  constructor(root, hooks) {
    this.root = root;
    this.h = hooks;
    this.keys = new Set(hooks.characters.map((c) => c.key));
    const itemKeys = hooks.characters.filter((c) => c.kind === 'item').map((c) => c.key);
    this.itemKeys = itemKeys;
    const ok = (k, fallback) => (this.keys.has(k) ? k : fallback);
    const first = hooks.characters[0].key;
    const defaults = ['hero-knight', 'enemy-goblin', 'hero-mage', null, 'enemy-skeletonArcher', 'enemy-slime'];
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    } catch {
      /* storage blocked */
    }
    // One entry per canvas: { key, sel, items: null | [{ key, sel }] x 9 }.
    this.cells = defaults.map((k, i) => {
      const s = saved && saved[i];
      const items = (s ? s.items : k ? null : itemKeys.slice(0, 9))?.map((ik, j) => ({ key: ok(ik, itemKeys[j] || itemKeys[0]), sel: 'icon' }));
      return { key: ok(s ? s.key : k || first, first), sel: null, items: items || null };
    });
    this.active = { cell: 0, mini: null };
    root.addEventListener('pointerdown', (e) => this.pointerDown(e), true);
    root.addEventListener('change', (e) => this.change(e));
    root.addEventListener('click', (e) => this.click(e));
    this.build();
  }

  persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.cells.map((c) => ({ key: c.key, items: c.items && c.items.map((m) => m.key) }))));
    } catch {
      /* fine */
    }
  }

  // The canvas being edited: { key, sel } (a unit cell or one item square).
  ref() {
    const c = this.cells[this.active.cell];
    return c.items ? c.items[this.active.mini || 0] : c;
  }

  options(keys, sel) {
    const byKind = {};
    for (const c of this.h.characters) if (keys.includes(c.key)) (byKind[c.kind] = byKind[c.kind] || []).push(c);
    const labels = { hero: 'Heroes', enemy: 'Enemies', minion: 'Minions', item: 'Item icons' };
    return Object.entries(labels)
      .filter(([k]) => byKind[k])
      .map(([k, label]) => `<optgroup label="${label}">${byKind[k].map((c) => `<option value="${c.key}"${c.key === sel ? ' selected' : ''}>${c.name}</option>`).join('')}</optgroup>`)
      .join('');
  }

  // Builds every canvas (and a Board for each) from this.cells.
  build() {
    const all = [...this.keys];
    this.boards = [];
    this.root.querySelector('.sheet').innerHTML = this.cells
      .map((c, i) => {
        const act = this.active.cell === i;
        const modeBtn = `<button class="btn sm${c.items ? ' on' : ''}" data-itemmode="${i}" title="${c.items ? 'Back to one sprite' : 'Item mode: 9 item icons'}" aria-pressed="${!!c.items}">▦</button>`;
        if (c.items)
          return `<div class="scell${act ? ' act' : ''}" data-cell="${i}">
            <div class="row"><span class="label">Item icons</span><span class="grow"></span>${modeBtn}</div>
            <div class="sitems">${c.items
              .map(
                (m, j) => `<div class="sitem${act && (this.active.mini || 0) === j ? ' act' : ''}" data-mini="${j}">
                  <select data-minipick="${i}:${j}" aria-label="Item icon ${j + 1}">${this.options(this.itemKeys, m.key)}</select>
                  <canvas data-board="${i}:${j}"></canvas></div>`,
              )
              .join('')}</div></div>`;
        return `<div class="scell${act ? ' act' : ''}" data-cell="${i}">
          <div class="row"><select data-cellpick="${i}" aria-label="Sprite on canvas ${i + 1}">${this.options(all, c.key)}</select>${modeBtn}</div>
          <div class="sbody"><canvas class="sboard" data-board="${i}"></canvas><div class="sparts" data-parts="${i}"></div></div></div>`;
      })
      .join('');
    for (const cv of this.root.querySelectorAll('[data-board]')) {
      const [i, j] = cv.dataset.board.split(':').map(Number);
      const ref = Number.isNaN(j) || j === undefined ? this.cells[i] : this.cells[i].items[j];
      const icon = this.h.characters.find((c) => c.key === ref.key).kind === 'item';
      this.boards.push(new Board(cv, this.h.boardHooks(ref), { view: icon ? ICON_VIEW : VIEW, plain: icon }));
    }
    this.refresh();
  }

  // Redraws every canvas and the part thumbnails (after any change).
  refresh() {
    for (const b of this.boards) b.render();
    this.root.querySelectorAll('[data-parts]').forEach((el) => {
      const c = this.cells[Number(el.dataset.parts)];
      const parts = this.h.look(c.key).parts;
      el.innerHTML = Object.keys(parts)
        .map((n) => `<button class="spart${n === c.sel ? ' on' : ''}" data-spart="${el.dataset.parts}:${n}" title="${n}" aria-label="Part ${n}"><canvas width="28" height="28"></canvas></button>`)
        .join('');
      el.querySelectorAll('[data-spart]').forEach((b) => this.h.drawThumb(b.firstChild, parts[b.dataset.spart.split(':')[1]]));
    });
  }

  // Makes canvas i (item square j) the active one; tells main.js.
  setActive(i, j = null) {
    const same = this.active.cell === i && this.active.mini === j;
    this.active = { cell: i, mini: j };
    if (!same) {
      this.root.querySelectorAll('[data-cell]').forEach((el) => el.classList.toggle('act', Number(el.dataset.cell) === i));
      this.root.querySelectorAll('.sitem').forEach((el) =>
        el.classList.toggle('act', Number(el.closest('[data-cell]').dataset.cell) === i && Number(el.dataset.mini) === j),
      );
    }
    const r = this.ref();
    this.h.activate(r.key, r.sel);
  }

  pointerDown(e) {
    const cell = e.target.closest('[data-cell]');
    if (!cell) return;
    const mini = e.target.closest('[data-mini]');
    this.setActive(Number(cell.dataset.cell), mini ? Number(mini.dataset.mini) : null);
  }

  change(e) {
    const t = e.target;
    if (t.dataset.cellpick) {
      const c = this.cells[Number(t.dataset.cellpick)];
      c.key = t.value;
      c.sel = null;
    } else if (t.dataset.minipick) {
      const [i, j] = t.dataset.minipick.split(':').map(Number);
      this.cells[i].items[j].key = t.value;
    } else return;
    this.persist();
    this.build();
    const r = this.ref();
    this.h.activate(r.key, r.sel);
  }

  click(e) {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.itemmode) {
      const c = this.cells[Number(t.dataset.itemmode)];
      c.items = c.items ? null : this.itemKeys.slice(0, 9).map((key) => ({ key, sel: 'icon' }));
      this.active.mini = c.items ? 0 : null;
      this.persist();
      this.build();
      const r = this.ref();
      this.h.activate(r.key, r.sel);
    } else if (t.dataset.spart) {
      const [i, name] = t.dataset.spart.split(':');
      const c = this.cells[Number(i)];
      c.sel = name;
      this.h.activate(c.key, name);
      this.refresh();
    }
  }
}
