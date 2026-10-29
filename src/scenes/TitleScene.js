import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config.js';
import title from '../data/title.json';
import pkg from '../../package.json';
import { skyLayer, twinkleSpots, moonLayers, cloudLayer, canopyLayer } from '../systems/titleArt.js';
import { layerTexture } from '../entities/pixelLayer.js';
import { drawWindow, uiText, drawGear } from '../entities/uiKit.js';
import { loadProgress } from '../systems/progress.js';
import * as sfx from '../audio/sfx.js';

// The title screen (docs/systems/title-base.md): a thick night forest seen from above with the dungeon tower far away,
// full moon, drifting clouds, twinkling stars, the logo (stand-in text), TAP TO START, best floor, settings, version.
// Tap: the camera flies to the tower and fades into the camp (Base), the hub with 3 heroes by the fire. Pixel art: systems/titleArt.js, title.json.
const P = title.pixel;
const DEPTH = { sky: 0, moon: 1, clouds: 2, forest: 3, ui: 10, modal: 20 };

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.busy = false;
    this.modal = null; // (the scene is reused: a Settings flag from last time must not stick)
    const width = Math.ceil(GAME_WIDTH / P), height = Math.ceil(GAME_HEIGHT / P);
    const img = (key, lay, x, y, depth) => this.add.image(x, y, layerTexture(this, key, lay)).setOrigin(lay.ax / lay.w, lay.ay / lay.h).setScale(P).setDepth(depth);

    img('title-sky', skyLayer(title, { width, height }), 0, 0, DEPTH.sky);
    // Stars that softly blink, each at its own pace.
    const T = title.twinkle;
    for (const s of twinkleSpots(title, width)) {
      const star = this.add.rectangle(s.x * P, s.y * P, P, P, Number(T.color)).setOrigin(0).setDepth(DEPTH.sky);
      if (s.big) this.add.rectangle(s.x * P - P, s.y * P, P * 3, P, Number(T.color), 0.25).setOrigin(0).setDepth(DEPTH.sky);
      this.tweens.add({ targets: star, alpha: T.minAlpha, duration: Phaser.Math.Between(...T.ms), yoyo: true, repeat: -1, delay: Math.random() * 2000, ease: 'Sine.easeInOut' });
    }
    const M = title.moon, moon = moonLayers(title);
    img('title-moon-glow', moon.glow, M.x * P, M.y * P, DEPTH.moon);
    img('title-moon', moon.moon, M.x * P, M.y * P, DEPTH.moon);

    // Clouds drift slowly to the right and come back in on the left.
    this.clouds = title.clouds.list.map((cl, i) => {
      const lay = cloudLayer(title, cl, title.seed + 11 + i);
      const c = img(`title-cloud-${i}`, lay, cl.x * P, cl.y * P, DEPTH.clouds).setAlpha(title.clouds.alpha);
      return { c, speed: cl.speed };
    });

    // The forest from above, the dungeon tower far away (the tap flies to it).
    const forest = canopyLayer(title, { width, height });
    img('title-forest', forest.layer, 0, 0, DEPTH.forest);
    this.door = { x: forest.tower.x * P, y: forest.tower.y * P };

    this.drawUi();
    this.input.on('pointerup', () => this.start());
  }

  update(time, delta) {
    for (const k of this.clouds) {
      k.c.x += (k.speed * delta) / 1000;
      if (k.c.x > GAME_WIDTH) k.c.x = -k.c.displayWidth;
    }
  }

  drawUi() {
    const L = title.logo, cx = GAME_WIDTH / 2, outline = { stroke: '#000000', strokeThickness: 6 };
    // Stand-in logo (the user will draw the real one): two lines of the pixel font, the name twice as big.
    const ui = [
      uiText(this, cx, L.smallY, L.small, 'big', UI.text, outline).setOrigin(0.5),
      uiText(this, cx, L.bigY, L.big, 'big', UI.gold, { stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setScale(L.bigScale),
    ];
    const S = title.start, box = this.add.graphics();
    drawWindow(box, cx - S.w / 2, S.y - S.h / 2, S.w, S.h);
    const tap = uiText(this, cx, S.y, S.text, 'big').setOrigin(0.5);
    this.tweens.add({ targets: tap, alpha: S.blinkAlpha, duration: S.blinkMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); // a soft blink
    ui.push(box, tap);
    const best = loadProgress().stats.bestFloor;
    if (best > 0) ui.push(uiText(this, cx, title.best.y, title.best.text.replace('{n}', best), 'small', UI.text, outline).setOrigin(0.5));
    ui.push(uiText(this, GAME_WIDTH - 8, GAME_HEIGHT - 8, `v${pkg.version}`, 'small', UI.dim).setOrigin(1, 1));
    // Settings (top left): a small gear in a window; opens the Settings screen over the title (paused till it closes).
    const G = title.settings, g = this.add.graphics();
    drawWindow(g, G.x, G.y, G.size, G.size);
    const m = G.x + G.size / 2, n = G.y + G.size / 2;
    drawGear(g, m, n);
    ui.push(g);
    this.add.zone(G.x + G.size / 2, G.y + G.size / 2, G.size + 10, G.size + 10).setInteractive().on('pointerup', (p, x, y, ev) => {
      ev.stopPropagation();
      if (this.busy || this.modal) return;
      sfx.play('tap');
      this.modal = true; // no TAP TO START while Settings is open, nor from the tap that closes it
      this.events.once(Phaser.Scenes.Events.RESUME, () => this.time.delayedCall(150, () => { this.modal = null; }));
      this.scene.launch('Settings', { from: 'Title' });
      this.scene.pause();
    });
    this.ui = ui.map((o) => o.setDepth(DEPTH.ui));
  }

  // Tap to start: the interface fades, the camera flies to the dungeon tower, then fades into the camp.
  start() {
    if (this.busy || this.modal) return;
    this.busy = true;
    sfx.play('tap');
    const Z = title.zoom, cam = this.cameras.main;
    this.tweens.killTweensOf(this.ui); // stop the blink, so the fade wins
    this.tweens.add({ targets: this.ui, alpha: 0, duration: 250 });
    cam.pan(this.door.x, this.door.y, Z.ms, 'Sine.easeIn');
    cam.zoomTo(Z.scale, Z.ms, 'Sine.easeIn');
    this.time.delayedCall(Z.ms - Z.fadeMs, () => cam.fadeOut(Z.fadeMs, 0, 0, 0));
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Base', { fromTitle: true }));
  }
}
