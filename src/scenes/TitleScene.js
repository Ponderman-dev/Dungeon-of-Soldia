import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config.js';
import title from '../data/title.json';
import pkg from '../../package.json';
import { skyLayer, twinkleSpots, moonLayers, cloudLayer, canopyLayer } from '../systems/titleArt.js';
import { layerTexture } from '../entities/pixelLayer.js';
import { drawWindow, uiText, drawGear } from '../entities/uiKit.js';
import { warmUpSteps, drawAllOnce } from '../entities/warmUp.js';
import { loadProgress } from '../systems/progress.js';
import * as sfx from '../audio/sfx.js';
import * as music from '../audio/music.js';

// The title screen (docs/systems/title-base.md): a thick night forest seen from above with the dungeon tower far away,
// full moon, drifting clouds, twinkling stars, the logo (stand-in text), TAP TO START, best floor, settings, version.
// Tap: the camera flies to the tower and fades into the camp (Base), the hub with 3 heroes by the fire. Pixel art: systems/titleArt.js, title.json.
const P = title.pixel;
const DEPTH = { sky: 0, moon: 1, clouds: 2, forest: 3, ui: 10, modal: 20 };

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(data) {
    music.play('title');
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
    if (data && data.intro) this.intro();
  }

  // INTRO (session 58, user: 'logo, then the sky goes down to the current screen'): the game opens up in the night sky
  // with the logo and the LOADING bar while every picture is made once (entities/warmUp.js: no first-visit stutter on
  // the pages), then the bar fades, the camera glides down to the forest (the logo stays put) and the rest of the
  // title fades in. Numbers: title.json intro.
  intro() {
    const I = title.intro, cam = this.cameras.main, cx = GAME_WIDTH / 2, t0 = performance.now();
    this.busy = true; // no TAP TO START (or Settings) until the title is in
    cam.scrollY = -I.rise;
    // More night sky above the title's sky: its darkest colour and some dim stars.
    this.add.rectangle(0, -I.rise, GAME_WIDTH, I.rise, Number(title.sky.colors[0])).setOrigin(0).setDepth(DEPTH.sky);
    let seed = title.seed * 7919;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < I.stars; i++) {
      const col = title.stars.colors[Math.floor(rnd() * title.stars.colors.length)];
      this.add.rectangle(Math.floor(rnd() * GAME_WIDTH / P) * P, -I.rise + Math.floor(rnd() * I.rise / P) * P, P, P, Number(col)).setOrigin(0).setDepth(DEPTH.sky);
    }
    // The logo stays on the screen while the world moves; everything else waits.
    for (const o of this.logo) o.setScrollFactor(0);
    const rest = this.ui.filter((o) => !this.logo.includes(o));
    this.tweens.killTweensOf(this.tap); // its blink starts again once the title is in
    for (const o of rest) o.setAlpha(0);
    // The LOADING bar under the logo.
    const gold = Phaser.Display.Color.HexStringToColor(UI.gold).color, bx = Math.round(cx - I.barW / 2);
    const frame = drawWindow(this.add.graphics(), bx, I.barY, I.barW, I.barH).setScrollFactor(0).setDepth(DEPTH.ui);
    const fill = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.ui);
    const steps = warmUpSteps(this), total = steps.length;
    const show = () => fill.clear().fillStyle(gold, 1).fillRect(bx + 4, I.barY + 4, Math.round((I.barW - 8) * (1 - steps.length / total)), I.barH - 8);
    show();
    const glide = () => {
      this.tweens.add({ targets: [frame, fill], alpha: 0, duration: I.barFadeMs, onComplete: () => { frame.destroy(); fill.destroy(); } });
      this.tweens.add({ targets: cam, scrollY: 0, duration: I.glideMs, ease: I.ease, onComplete: () => {
        for (const o of this.logo) o.setScrollFactor(1); // the camera is home: same spot
        this.tweens.add({ targets: rest, alpha: 1, duration: I.uiFadeMs, onComplete: () => { this.blinkTap(); this.busy = false; } });
      } });
    };
    const next = async () => {
      const t = performance.now();
      while (steps.length && performance.now() - t < I.stepMs) {
        try { await steps.shift()(); } catch (e) { console.warn('warm-up step failed', e); }
      }
      show();
      if (steps.length) return this.time.delayedCall(0, next);
      // Every picture drawn once, hidden behind the sky above (the graphics card gets them now), then the glide.
      const imgs = drawAllOnce(this).map((o) => o.setPosition(0, -I.rise / 2).setDepth(DEPTH.sky - 1));
      this.events.once(Phaser.Scenes.Events.RENDER, () => this.time.delayedCall(0, () => {
        imgs.forEach((o) => o.destroy());
        this.time.delayedCall(Math.max(0, I.minMs - (performance.now() - t0)), glide);
      }));
    };
    this.time.delayedCall(0, next);
  }

  // TAP TO START blinks softly.
  blinkTap() {
    const S = title.start;
    this.tweens.add({ targets: this.tap, alpha: S.blinkAlpha, duration: S.blinkMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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
      uiText(this, cx, L.smallY, L.small, 'big', '#ffffff', outline).setOrigin(0.5),
      uiText(this, cx, L.bigY, L.big, 'big', UI.gold, { stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setScale(L.bigScale),
    ];
    // TAP TO START (user, session 40): no button box (a tap ANYWHERE starts), just the words, smaller, blinking softly.
    const S = title.start;
    const tap = (this.tap = uiText(this, cx, S.y, S.text, S.size, '#ffffff', outline).setOrigin(0.5)); // white: the title keeps its own colours (user: salmon looked weird)
    this.blinkTap(); // a soft blink
    this.logo = ui.slice(); // the two logo lines (the intro keeps them on the screen)
    ui.push(tap);
    // Best floor (user: unreadable small): the big pixel font in gold on a dark strip.
    const best = loadProgress().stats.bestFloor;
    if (best > 0) {
      const B = title.best, label = uiText(this, cx, B.y, B.text.replace('{n}', best), B.size, UI.gold, { stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5);
      const strip = this.add.graphics().fillStyle(0x000000, B.stripAlpha).fillRect(Math.round(cx - label.width / 2 - 12), Math.round(B.y - label.height / 2 - 4), Math.round(label.width + 24), Math.round(label.height + 8));
      this.bestStrip = strip; // drawn one layer under the text (set below)
      ui.push(strip, label);
    }
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
    if (this.bestStrip) this.bestStrip.setDepth(DEPTH.ui - 1); // the best floor's dark strip stays UNDER its text
  }

  // Tap to start: the interface fades, the camera flies to the dungeon tower, then fades into the camp.
  start() {
    if (this.busy || this.modal) return;
    this.busy = true;
    sfx.play('tap');
    const Z = title.zoom, M = UI.motion, cam = this.cameras.main;
    this.tweens.killTweensOf(this.ui); // stop the blink, so the fade wins
    this.tweens.add({ targets: this.ui, alpha: 0, duration: M.normal, ease: M.easeIn });
    cam.pan(this.door.x, this.door.y, M.story, 'Sine.easeIn');
    cam.zoomTo(Z.scale, M.story, 'Sine.easeIn');
    this.time.delayedCall(M.story - M.slow, () => cam.fadeOut(M.slow, 0, 0, 0));
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Base', { fromTitle: true }));
  }
}
