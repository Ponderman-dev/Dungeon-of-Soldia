import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config.js';
import { drawWindow, uiText } from '../entities/uiKit.js';
import camp from '../data/camp.json';
import { openFloor, darkLayer, lightTint, fireLayers, propLayer } from '../systems/campArt.js';
import floorArt from '../data/floorArt.json';
import dungeons from '../data/dungeons.json';
import { layerTexture } from '../entities/pixelLayer.js';
import Character from '../entities/Character.js';
import heroes from '../data/heroes.json';

// The Base: a campfire camp on the dungeon's flagstones (docs/systems/title-base.md). Pixel art: systems/campArt.js,
// camp.json. NPCs and the profile open 'Coming soon' for now; 'To dungeon' walks the hero out and slides up into the
// squad screen. Not reached from the game yet (Boot still opens 'Squad'); the walk-in comes next.
const P = camp.pixel;
const U = camp.ui;
const DEPTH = { ui: 2000, modal: 3000 };

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
    this.drawNpcs();
    this.drawUi();
  }

  // The camp's NPCs (camp.json npcs): each faces the fire, has its name under it and opens its window when tapped.
  drawNpcs() {
    for (const n of camp.npcs) {
      const ch = this.add.existing(new Character(this, n.x, n.y, n.def).setDepth(n.y));
      ch.face(n.face);
      // The name floats over the head in a small black window (its bottom tagUp px above the feet).
      const tag = uiText(this, n.x, 0, n.name, U.tagSize).setOrigin(0.5, 0).setDepth(DEPTH.ui + 1);
      const boxH = tag.height + U.tagPad[1] * 2, top = n.y - U.tagUp - boxH;
      tag.setY(top + U.tagPad[1]);
      drawWindow(this.add.graphics().setDepth(DEPTH.ui), n.x - tag.width / 2 - U.tagPad[0], top, tag.width + U.tagPad[0] * 2, boxH);
      this.add.zone(n.x, n.y - U.hit[1] / 2, U.hit[0], U.hit[1]).setInteractive().on('pointerup', () => this.comingSoon(n.name, n.who));
    }
  }

  // 'To dungeon' (a bobbing arrow at the top) and the profile button (top right).
  drawUi() {
    // 'To dungeon': the biggest thing on screen. A black window with the words in big letters and a white pixel
    // up-arrow on each side, bobbing.
    const T = U.toDungeon, cx = GAME_WIDTH / 2;
    const box = this.add.container(cx, T.y).setDepth(DEPTH.ui);
    box.add(drawWindow(this.add.graphics(), -T.w / 2, -T.h / 2, T.w, T.h));
    box.add(uiText(this, 0, 0, T.text, 'big').setOrigin(0.5));
    const cell = T.cell;
    for (const side of [-1, 1]) {
      const arrow = this.add.graphics().fillStyle(0xffffff, 1);
      for (let i = 0; i < 3; i++) arrow.fillRect(-(i + 0.5) * cell, i * cell, (2 * i + 1) * cell, cell);
      arrow.fillRect(-cell / 2, 3 * cell, cell, cell * 2);
      arrow.setPosition(side * (T.w / 2 - T.arrowInset), -2.5 * cell);
      box.add(arrow);
      this.tweens.add({ targets: arrow, y: arrow.y - T.bob, duration: T.bobMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.add.zone(cx, T.y, T.w + 20, T.h + 20).setInteractive().on('pointerup', () => this.toDungeon());
    this.exitMark = box;

    const Pr = U.profile, g = this.add.graphics().setDepth(DEPTH.ui);
    drawWindow(g, Pr.x, Pr.y, Pr.size, Pr.size);
    // A little person: head and shoulders in white pixels.
    const m = Pr.x + Pr.size / 2, t = Pr.y + 9;
    g.fillStyle(0xffffff, 1).fillRect(m - 5, t, 10, 10).fillRect(m - 11, t + 13, 22, 4).fillRect(m - 13, t + 17, 26, 6);
    this.add.zone(Pr.x + Pr.size / 2, Pr.y + Pr.size / 2, Pr.size + 8, Pr.size + 8).setInteractive().on('pointerup', () => this.comingSoon(Pr.name, Pr.who));
  }

  // A black window in the middle: the name, who it is, 'Coming soon'. Tap anywhere to close.
  comingSoon(title, who) {
    if (this.modal || this.leaving) return;
    const W = U.soon, x = (GAME_WIDTH - W.w) / 2, y = (GAME_HEIGHT - W.h) / 2;
    const shade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0).setInteractive();
    const g = drawWindow(this.add.graphics(), x, y, W.w, W.h);
    const cx = GAME_WIDTH / 2;
    const texts = [
      uiText(this, cx, y + 26, title, 'normal').setOrigin(0.5, 0),
      uiText(this, cx, y + 56, who, 'small', UI.dim, { align: 'center', wordWrap: { width: W.w - 40 } }).setOrigin(0.5, 0),
      uiText(this, cx, y + 92, 'Coming soon', 'normal', UI.gold).setOrigin(0.5, 0),
      uiText(this, cx, y + W.h - 22, 'Tap to close', 'small', UI.dim).setOrigin(0.5, 0),
    ];
    this.modal = this.add.container(0, 0, [shade, g, ...texts]).setDepth(DEPTH.modal);
    this.time.delayedCall(150, () => shade.once('pointerup', () => { this.modal.destroy(); this.modal = null; }));
  }

  // To dungeon: the hero walks round the fire and out of the top, then the screen slides up into the squad screen.
  toDungeon() {
    if (this.leaving || this.modal) return;
    this.tweens.add({ targets: this.exitMark, alpha: 0, duration: 200 });
    this.walkOut(() => {
      const squad = this.scene.get('Squad');
      squad.events.once(Phaser.Scenes.Events.CREATE, () => {
        const cam = squad.cameras.main, mine = this.cameras.main;
        cam.scrollY = GAME_HEIGHT; // the squad screen starts just above this one
        this.tweens.add({ targets: cam, scrollY: 0, duration: U.slideMs, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: mine, scrollY: -GAME_HEIGHT, duration: U.slideMs, ease: 'Sine.easeInOut', onComplete: () => this.scene.stop() });
      });
      this.scene.launch('Squad');
    });
  }

  // The hero walks the exit path (camp.json exit): round the fire, then up and off the top of the screen.
  walkOut(done) {
    const E = camp.exit, ch = this.hero;
    this.leaving = true;
    const points = [{ x: ch.x, y: ch.y }, ...E.path.map(([x, y]) => ({ x, y }))];
    let walked = 0;
    const leg = (i) => {
      if (i >= points.length - 1) { ch.setWalking(false); if (done) done(); return; }
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
