import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import camp from '../data/camp.json';
import { openFloor, darkLayer, lightTint, fireLayers, propLayer } from '../systems/campArt.js';
import floorArt from '../data/floorArt.json';
import dungeons from '../data/dungeons.json';
import { layerTexture } from '../entities/pixelLayer.js';
import Character from '../entities/Character.js';
import heroes from '../data/heroes.json';

// The Base: a campfire camp on the dungeon's flagstones (docs/systems/title-base.md). Pixel art: systems/campArt.js,
// camp.json. Not reached from the game yet (Boot still opens 'Squad'); NPCs, buttons and the walk-in come next.
const P = camp.pixel;

export default class BaseScene extends Phaser.Scene {
  constructor() {
    super('Base');
  }

  create() {
    const width = Math.ceil(GAME_WIDTH / P), height = Math.ceil(GAME_HEIGHT / P);
    // The same stone floor as the battle rooms, with no wall: the top stays open, the way deeper ('To dungeon').
    const floor = openFloor(floorArt, camp, { width, height, tint: dungeons.A.tileColors[0] });
    this.add.image(0, 0, layerTexture(this, 'camp-floor', floor)).setOrigin(0).setScale(P).setDepth(0);
    this.add.image(0, 0, layerTexture(this, 'camp-dark', darkLayer(camp, { width, height }))).setOrigin(0).setScale(P).setDepth(0.5);
    this.drawProps();
    this.drawFire();
    // Placeholder until step 3 (the walk-in): one hero by the fire, so the camp can be judged at the right size.
    const H = camp.previewHero;
    this.hero = this.add.existing(new Character(this, H.x, H.y, heroes[0]).setDepth(H.y));
    // Preview only: tap anywhere and the hero walks round the fire and out of the top (then comes back).
    this.input.on('pointerdown', () => this.walkOut(() => this.hero.setPosition(H.x, H.y).setDepth(H.y)));
  }

  // The hero walks the exit path (camp.json exit): round the fire, then up and off the top of the screen.
  walkOut(done) {
    const E = camp.exit, ch = this.hero;
    if (this.leaving) return;
    this.leaving = true;
    const points = [{ x: ch.x, y: ch.y }, ...E.path.map(([x, y]) => ({ x, y }))];
    let walked = 0;
    const leg = (i) => {
      if (i >= points.length - 1) { ch.setWalking(false); this.leaving = false; if (done) done(); return; }
      const a = points[i], b = points[i + 1], dist = Math.hypot(b.x - a.x, b.y - a.y);
      if (b.x !== a.x) ch.face(b.x < a.x ? -1 : 1);
      ch.setWalking(true);
      this.tweens.addCounter({ from: 0, to: 1, duration: (dist / E.speed) * 1000, onUpdate: (tw) => {
        const t = tw.getValue(), hop = Math.abs(Math.sin(((walked + t * dist) / E.stepLenPx) * Math.PI)) * E.stepHeight;
        ch.setPosition(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - hop).setDepth(a.y + (b.y - a.y) * t);
      }, onComplete: () => { walked += dist; leg(i + 1); } });
    };
    leg(0);
  }

  // A pixel layer as an image at screen (x, y), placed by its anchor.
  layer(key, lay, x, y) {
    return this.add.image(x, y, layerTexture(this, key, lay)).setOrigin(lay.ax / lay.w, lay.ay / lay.h).setScale(P);
  }

  // Tents, logs, crates...: each stands on a soft shadow and takes the firelight where it stands; lower = in front.
  drawProps() {
    for (const [name, x, y, flip] of camp.place) {
      const lay = propLayer(camp.props[name], flip);
      this.add.ellipse(x, y - 1, lay.w * P * 0.9, 8, 0x000000, 0.3).setDepth(y - 0.5);
      this.layer(`camp-${name}${flip ? '-flip' : ''}`, lay, x, y).setTint(lightTint(camp, x, y)).setDepth(y);
    }
  }

  // The campfire: ring of stones and logs, flickering flames (frames), a pulsing glow and rising sparks.
  drawFire() {
    const F = camp.fire, L = fireLayers(camp), { x, y } = F;
    const glow = this.layer('camp-glow', L.glow, x, y - 6).setDepth(1);
    this.tweens.add({ targets: glow, alpha: 0.7, duration: F.glow.pulseMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.layer('camp-pit-back', L.back, x, y).setDepth(y - 2);
    const keys = L.flames.map((f, i) => layerTexture(this, `camp-flame-${i}`, f));
    const flame = this.layer('camp-flame-0', L.flames[0], x, y - P).setDepth(y - 1);
    let f = 0;
    this.time.addEvent({ delay: F.flame.frameMs, loop: true, callback: () => {
      f = (f + 1 + Math.floor(Math.random() * (keys.length - 1))) % keys.length;
      flame.setTexture(keys[f]);
    } });
    this.layer('camp-pit-front', L.front, x, y).setDepth(y);
    const S = F.sparks;
    const rand = ([a, b]) => a + Math.random() * (b - a);
    this.time.addEvent({ delay: S.everyMs, loop: true, callback: () => {
      const sx = Math.round((x + (Math.random() * 2 - 1) * 12) / P) * P;
      const spark = this.add.rectangle(sx, y - 30, P, P, Number(S.colors[Math.floor(Math.random() * S.colors.length)])).setDepth(GAME_HEIGHT);
      this.tweens.add({ targets: spark, y: spark.y - rand(S.rise), x: sx + (Math.random() * 2 - 1) * S.drift, alpha: 0,
        duration: rand(S.ms), ease: 'Sine.easeOut', onComplete: () => spark.destroy() });
    } });
  }
}
