import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config.js';
import { loadUiFont, uiText, drawWindow, pageBackdrop } from '../entities/uiKit.js';
import { warmUpSteps, drawAllOnce } from '../entities/warmUp.js';

const STEP_MS = 12; // warm-up work per frame (the bar keeps moving)
const BAR_W = 240, BAR_H = 24;

// First scene: loads the interface font, then the LOADING bar while every picture is made once (entities/warmUp.js:
// pages no longer stutter the first time they open), then opens the title screen.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    // The interface font must be ready before any text is drawn (else the first screen shows the fallback font).
    loadUiFont().then(() => this.loading());
  }

  loading() {
    pageBackdrop(this, UI.pageBg).setDepth(1);
    const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2, gold = Phaser.Display.Color.HexStringToColor(UI.gold).color;
    uiText(this, cx, cy - 40, 'LOADING', 'big').setOrigin(0.5).setDepth(2);
    drawWindow(this.add.graphics().setDepth(2), cx - BAR_W / 2, cy, BAR_W, BAR_H);
    const fill = this.add.graphics().setDepth(3);
    const steps = warmUpSteps(this), total = steps.length;
    const show = () => fill.clear().fillStyle(gold, 1).fillRect(cx - BAR_W / 2 + 4, cy + 4, Math.round((BAR_W - 8) * (1 - steps.length / total)), BAR_H - 8);
    show();
    const next = async () => {
      const t = performance.now();
      while (steps.length && performance.now() - t < STEP_MS) {
        try { await steps.shift()(); } catch (e) { console.warn('warm-up step failed', e); }
      }
      show();
      if (steps.length) return this.time.delayedCall(0, next);
      // All pictures made: draw each once under the cover (depth 0 < backdrop), then go on after that frame.
      const imgs = drawAllOnce(this);
      this.events.once(Phaser.Scenes.Events.RENDER, () => this.time.delayedCall(0, () => { imgs.forEach((i) => i.destroy()); this.done(); }));
    };
    this.time.delayedCall(0, next);
  }

  done() {
    if (import.meta.env.VITE_SQUAD_DEMO === '1') return this.scene.start('Squad'); // the squad screen demo page: straight to it, no test buttons
    this.scene.start('Title');
    if (import.meta.env.VITE_TESTER !== '1') this.scene.launch('Debug'); // test buttons, always on top (not in the playtest build, npm run build:itch)
  }
}
