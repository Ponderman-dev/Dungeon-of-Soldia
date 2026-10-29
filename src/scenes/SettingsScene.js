import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config.js';
import { drawWindow, uiText, comingSoonWindow } from '../entities/uiKit.js';
import defs from '../data/settings.json';
import pkg from '../../package.json';
import { loadProgress, saveProgress, deleteProgress } from '../systems/progress.js';
import { readSettings, changeSetting, stepSetting } from '../systems/settings.js';
import * as sfx from '../audio/sfx.js';

// The Settings screen (docs/systems/title-base.md section 5, user's pick D): tabs SOUND / GAME / MORE, each setting a
// card (gold name, small hint, big buttons under it; the chosen one FILLED gold). Opened over the camp or the title
// (that scene is paused, `from`); '< CAMP' resumes it. Data: settings.json, logic: systems/settings.js.
const L = defs.layout;
const GOLD = Phaser.Display.Color.HexStringToColor(UI.gold).color;
const RED = Phaser.Display.Color.HexStringToColor(UI.red).color;
const DIM = Number(L.dim);
const DIM_TEXT = '#' + DIM.toString(16).padStart(6, '0');
const DEPTH = { modal: 100 };
let lastTab = 'sound'; // the tab shown last time (for this play session)

export default class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings');
  }

  init(data) {
    this.from = (data && data.from) || 'Base';
    this.modal = null;
  }

  create() {
    this.scene.bringToTop();
    this.progress = loadProgress();
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Number(L.bg)).setOrigin(0).setInteractive(); // blocks taps below
    const B = L.back;
    this.button(B.x, B.y, B.w, B.h, L.backLabels[this.from] || L.backLabels.Base, { onTap: () => this.close() });
    uiText(this, GAME_WIDTH / 2, L.titleY, 'SETTINGS', 'big').setOrigin(0.5, 0);
    uiText(this, GAME_WIDTH / 2, L.versionY, `v${pkg.version}`, 'small', UI.dim).setOrigin(0.5);
    this.page = null;
    this.showTab(lastTab);
    this.cameras.main.fadeIn(120, 0, 0, 0);
  }

  // A window button: `look` = 'plain' (white), 'gold' (gold line), 'filled' (gold, black text), 'dim', 'red'.
  // Added to `into` (a container) when given. Returns the tap zone.
  button(x, y, w, h, label, { look = 'plain', size = 'normal', onTap = null, into = null } = {}) {
    const line = { plain: UI.line, gold: GOLD, filled: GOLD, dim: DIM, red: RED }[look];
    const ink = { plain: UI.text, gold: UI.gold, filled: '#000000', dim: DIM_TEXT, red: UI.red }[look];
    const g = drawWindow(this.add.graphics(), x, y, w, h, { line, fill: look === 'filled' ? GOLD : UI.window });
    const t = uiText(this, x + w / 2, y + h / 2, label, size, ink).setOrigin(0.5);
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    if (onTap) zone.on('pointerup', () => { if (!this.modal) onTap(); });
    if (into) into.add([g, t, zone]);
    return zone;
  }

  // Draws one tab's cards (the old page is thrown away: every change simply redraws the tab).
  showTab(id) {
    lastTab = id;
    if (this.page) this.page.destroy();
    const page = (this.page = this.add.container(0, 0));
    const tabs = defs.tabs, T = L.tabs, W = GAME_WIDTH - L.side * 2;
    const tw = (W - T.gap * (tabs.length - 1)) / tabs.length;
    tabs.forEach((tab, i) => {
      this.button(Math.round(L.side + i * (tw + T.gap)), T.y, Math.round(tw), T.h, tab.label, {
        look: tab.id === id ? 'gold' : 'dim', into: page,
        onTap: () => { if (tab.id !== id) { sfx.play('tap'); this.showTab(tab.id); } },
      });
    });
    const set = readSettings(this.progress, defs);
    let y = L.cardsY;
    for (const card of tabs.find((t) => t.id === id).cards) y = this.drawCard(page, card, y, set) + L.cardGap;
  }

  // One card at height y; returns its bottom.
  drawCard(page, c, y, set) {
    const x = L.side, W = GAME_WIDTH - L.side * 2, P = L.pad, inner = W - P * 2;
    if (c.type === 'pair') { // two plain buttons side by side, no card
      const w = (W - L.rowGap) / 2;
      c.buttons.forEach((b, i) => this.button(x + i * (w + L.rowGap), y, w, L.plainH, b.label, { into: page, onTap: () => this.soon(b.label, b.soon) }));
      return y + L.plainH;
    }
    if (c.type === 'danger') {
      this.button(x, y, W, L.plainH, c.label, { look: 'red', into: page, onTap: () => this.confirmDelete(c) });
      return y + L.plainH;
    }
    page.add(drawWindow(this.add.graphics(), x, y, W, L.cardH));
    page.add(uiText(this, x + P, y + L.nameY, c.name, 'normal', UI.gold).setOrigin(0, 0));
    page.add(uiText(this, x + P, y + L.hintY, c.hint, 'small', UI.dim).setOrigin(0, 0));
    const ry = y + L.rowY, h = L.rowH;
    if (c.type === 'bar') {
      const v = set[c.id];
      page.add(uiText(this, x + W - P, y + L.nameY, String(v), 'normal').setOrigin(1, 0));
      const step = (dir) => { if (stepSetting(this.progress, defs, c.id, dir)) this.save(); };
      this.button(x + P, ry, h + 8, h, '-', { into: page, onTap: () => step(-1) });
      this.button(x + W - P - h - 8, ry, h + 8, h, '+', { into: page, onTap: () => step(1) });
      // The level: max cells between the buttons, the first v filled gold.
      const left = x + P + h + 8 + L.rowGap, room = inner - (h + 8 + L.rowGap) * 2;
      const cw = Math.floor((room - L.barGap * (c.max - 1)) / c.max), x0 = left + Math.floor((room - (cw * c.max + L.barGap * (c.max - 1))) / 2);
      const g = this.add.graphics();
      for (let i = 0; i < c.max; i++) g.fillStyle(i < v ? GOLD : 0x26262f, 1).fillRect(x0 + i * (cw + L.barGap), ry + (h - L.barCellH) / 2, cw, L.barCellH);
      page.add(g);
    } else if (c.type === 'choice') {
      const n = c.options.length, w = (inner - L.rowGap * (n - 1)) / n;
      c.options.forEach((o, i) => this.button(Math.round(x + P + i * (w + L.rowGap)), ry, Math.round(w), h, o.label, {
        look: set[c.id] === o.value ? 'filled' : 'dim', into: page,
        onTap: () => { if (changeSetting(this.progress, defs, c.id, o.value)) this.save(); },
      }));
    } else if (c.type === 'action') {
      this.button(x + P, ry, inner, h, c.button, { look: c.gold ? 'gold' : c.dim ? 'dim' : 'plain', into: page, onTap: () => this.soon(c.name, c.soon) });
    }
    return y + L.cardH;
  }

  // A setting changed: write the save, let the sounds pick it up, redraw the tab.
  save() {
    saveProgress(this.progress);
    sfx.refresh();
    sfx.play('tap');
    this.showTab(lastTab);
  }

  soon(title, who) {
    if (this.modal) return;
    this.modal = comingSoonWindow(this, title, who, { depth: DEPTH.modal, onClose: () => this.time.delayedCall(0, () => { this.modal = null; }) });
  }

  // DELETE SAVE: a red window asks first (KEEP / DELETE). DELETE wipes the save and starts over at the title.
  confirmDelete(c) {
    if (this.modal) return;
    sfx.play('cardOpen');
    const w = GAME_WIDTH - L.side * 2, h = 200, x = L.side, y = (GAME_HEIGHT - h) / 2;
    const box = (this.modal = this.add.container(0, 0).setDepth(DEPTH.modal));
    box.add(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setOrigin(0).setInteractive());
    box.add(drawWindow(this.add.graphics(), x, y, w, h, { line: RED }));
    box.add(uiText(this, GAME_WIDTH / 2, y + 20, c.label, 'normal', UI.red).setOrigin(0.5, 0));
    box.add(uiText(this, GAME_WIDTH / 2, y + 56, c.confirm, 'small', UI.text, { align: 'center', wordWrap: { width: w - L.pad * 2 }, lineSpacing: 8 }).setOrigin(0.5, 0));
    const bw = (w - L.pad * 2 - L.rowGap) / 2, by = y + h - L.pad - L.plainH;
    const keep = () => { sfx.play('cardClose'); box.destroy(); this.modal = null; };
    const wipe = () => {
      deleteProgress();
      sfx.refresh();
      this.scene.stop(this.from);
      this.scene.start('Title');
    };
    for (const [i, label, look, fn] of [[0, c.no, 'plain', keep], [1, c.yes, 'red', wipe]]) {
      const bx = x + L.pad + i * (bw + L.rowGap);
      box.add(drawWindow(this.add.graphics(), bx, by, bw, L.plainH, { line: look === 'red' ? RED : UI.line }));
      box.add(uiText(this, bx + bw / 2, by + L.plainH / 2, label, 'normal', look === 'red' ? UI.red : UI.text).setOrigin(0.5));
      box.add(this.add.zone(bx, by, bw, L.plainH).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', fn));
    }
  }

  // Back to the screen that opened Settings.
  close() {
    sfx.play('tap');
    this.scene.resume(this.from);
    this.scene.stop();
  }
}
