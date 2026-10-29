import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config.js';
import { drawWindow, uiText, comingSoonWindow, drawGear, pixelDisc, uiShift } from '../entities/uiKit.js';
import camp from '../data/camp.json';
import { openFloor, darkLayer, lightTint, fireLayers, propLayer } from '../systems/campArt.js';
import floorArt from '../data/floorArt.json';
import dungeons from '../data/dungeons.json';
import { layerTexture } from '../entities/pixelLayer.js';
import Character from '../entities/Character.js';
import heroes from '../data/heroes.json';
import unlocks from '../data/unlocks.json';
import { loadProgress, unlockedIds } from '../systems/progress.js';
import profileData from '../data/profile.json';
import * as sfx from '../audio/sfx.js';

// The Base: a campfire camp on the dungeon's flagstones (docs/systems/title-base.md). Pixel art: systems/campArt.js,
// camp.json. A mobile-game hub (user's sketch, 2026-10-21): 3 heroes idle round the fire in the middle, settings and
// profile at the top, TO EXPEDITION (slides up into the squad screen) and a row of menu buttons ('Coming soon') below.
const P = camp.pixel;
const U = camp.ui;
const DEPTH = { ui: 2000, modal: 3000 };

export default class BaseScene extends Phaser.Scene {
  constructor() {
    super('Base');
  }

  init(data) {
    this.fromTitle = !!(data && data.fromTitle); // from the title screen: the camp fades in
    this.fromSquad = !!(data && data.fromSquad); // back from the squad screen: the buttons come in after the slide
    this.modal = null;
    this.leaving = false;
  }

  create() {
    const width = Math.ceil(GAME_WIDTH / P), height = Math.ceil(GAME_HEIGHT / P);
    // The same stone floor as the battle rooms, with no wall: the top stays open, the way deeper.
    const floor = openFloor(floorArt, camp, { width, height, tint: dungeons.A.tileColors[0] });
    this.add.image(0, 0, layerTexture(this, 'camp-floor', floor)).setOrigin(0).setScale(P).setDepth(0);
    this.add.image(0, 0, layerTexture(this, 'camp-dark', darkLayer(camp, { width, height }))).setOrigin(0).setScale(P).setDepth(0.5);
    this.drawProps();
    this.drawFire();
    this.drawHeroes();
    this.drawUi();
    if (this.fromTitle) this.cameras.main.fadeIn(camp.hero.fadeMs, 0, 0, 0);
    if (this.fromSquad) { // the buttons come in once the slide down has ended; no taps before that
      this.leaving = true;
      this.time.delayedCall(U.slideMs, () => uiShift(this, this.uiParts, true, { ms: U.uiShiftMs, onDone: () => { this.leaving = false; } }));
    }
  }

  // Up to 3 random unlocked heroes round the fire, each idly wandering near its spot (camp.json hero).
  drawHeroes() {
    const H = camp.hero, open = Phaser.Utils.Array.Shuffle(unlockedIds(heroes, loadProgress(), unlocks).slice());
    const defs = open.map((id) => heroes.find((h) => h.id === id)).filter(Boolean).slice(0, H.spots.length);
    this.heroes = defs.map((def, i) => {
      const [x, y] = H.spots[i];
      const ch = this.add.existing(new Character(this, x, y, def).setDepth(y));
      ch.face(x <= camp.fire.x ? 1 : -1);
      this.time.delayedCall(Phaser.Math.Between(...H.pauseMs) * (0.3 + 0.4 * i), () => this.wander(ch, x, y));
      return ch;
    });
  }

  // One idle stroll: a few steps to a random spot near home, a look at the fire, a pause, then again.
  wander(ch, homeX, homeY) {
    if (!ch.active) return;
    const H = camp.hero, a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
    const to = { x: homeX + Math.cos(a) * r * H.radiusPx[0], y: homeY + Math.sin(a) * r * H.radiusPx[1] };
    const dist = Math.hypot(to.x - ch.x, to.y - ch.y);
    const next = () => this.time.delayedCall(Phaser.Math.Between(...H.pauseMs), () => this.wander(ch, homeX, homeY));
    if (dist < 4) return next();
    ch.face(to.x < ch.x ? -1 : 1);
    ch.setWalking(true);
    const from = { x: ch.x, y: ch.y };
    this.tweens.addCounter({ from: 0, to: 1, duration: (dist / H.speed) * 1000, onUpdate: (tw) => {
      const t = tw.getValue();
      ch.setPosition(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t).setDepth(ch.y);
    }, onComplete: () => {
      ch.setWalking(false);
      ch.face(ch.x <= camp.fire.x ? 1 : -1); // back to watching the fire
      next();
    } });
  }

  // Settings gear (top left), profile (top right), TO EXPEDITION and the row of menu buttons at the bottom.
  drawUi() {
    const ui = [];
    const n0 = this.children.list.length; // what drawUi adds: the bottom part first, then the top (for uiShift)
    // TO EXPEDITION: the biggest thing on screen. A black window with big letters and a white pixel up-arrow on each
    // side, bobbing.
    const T = U.expedition, cx = GAME_WIDTH / 2;
    const box = this.add.container(cx, T.y).setDepth(DEPTH.ui);
    box.add(drawWindow(this.add.graphics(), -T.w / 2, -T.h / 2, T.w, T.h));
    box.add(uiText(this, 0, 0, T.text, T.size).setOrigin(0.5)); // 'normal' (user: room between box and text)
    const cell = T.cell;
    for (const side of [-1, 1]) {
      const arrow = this.add.graphics().fillStyle(0xffffff, 1);
      // A real up-arrow (user: the old 3-row one read as a '+'): a wide head, then a thick stem.
      const A = T.arrow;
      for (let i = 0; i < A.head; i++) arrow.fillRect(-(i + 0.5) * cell, i * cell, (2 * i + 1) * cell, cell);
      arrow.fillRect(-(A.stemW / 2) * cell, A.head * cell, A.stemW * cell, A.stemH * cell);
      arrow.setPosition(side * (T.w / 2 - T.arrowInset), -((A.head + A.stemH) / 2) * cell);
      box.add(arrow);
      this.tweens.add({ targets: arrow, y: arrow.y - T.bob, duration: T.bobMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.add.zone(cx, T.y, T.w, T.h).setInteractive().on('pointerup', () => this.toExpedition());

    // The menu row: square buttons with a pixel icon and a name; each opens its 'Coming soon' window for now.
    const M = U.menu, n = M.buttons.length, w = Math.floor((GAME_WIDTH - M.side * 2 - M.gap * (n - 1)) / n);
    M.buttons.forEach((b, i) => {
      const x = M.side + i * (w + M.gap);
      ui.push(drawWindow(this.add.graphics(), x, M.y, w, M.h));
      const icon = propLayer(b.icon, false);
      ui.push(this.add.image(x + w / 2, M.y + M.iconY, layerTexture(this, `camp-icon-${b.id}`, icon)).setScale(M.iconPx));
      ui.push(uiText(this, x + w / 2, M.y + M.labelY, b.label, M.labelSize).setOrigin(0.5));
      this.add.zone(x + w / 2, M.y + M.h / 2, w, M.h).setInteractive().on('pointerup', () => (b.scene ? this.openOver(b.scene) : this.comingSoon(b.label, b.who)));
    });

    const n1 = this.children.list.length;
    // Settings (top left): a gear in a small window.
    const G = U.settings;
    ui.push(drawGear(drawWindow(this.add.graphics(), G.x, G.y, G.size, G.size), G.x + G.size / 2, G.y + G.size / 2));
    this.add.zone(G.x + G.size / 2, G.y + G.size / 2, G.size + 8, G.size + 8).setInteractive().on('pointerup', () => this.openOver('Settings'));

    // Profile (top right): a name box tucked under a round portrait (a little person for now).
    const Pr = U.profile, d = Pr.portrait, px = GAME_WIDTH - Pr.right - d, barX = px - Pr.barW + d / 2;
    const g = this.add.graphics();
    drawWindow(g, barX, Pr.y + (d - Pr.barH) / 2, Pr.barW, Pr.barH);
    const playerName = () => (loadProgress().profile.name || profileData.defaults.name);
    const nameText = uiText(this, barX + 12, Pr.y + d / 2, playerName(), 'small').setOrigin(0, 0.5);
    this.events.on(Phaser.Scenes.Events.RESUME, () => nameText.setText(playerName())); // renamed on the Profile
    ui.push(g, nameText);
    const c = this.add.graphics();
    pixelDisc(c, px + d / 2, Pr.y + d / 2, d / 2, 0xffffff);
    pixelDisc(c, px + d / 2, Pr.y + d / 2, d / 2 - 2, 0x000000);
    const m = px + d / 2, t = Pr.y + 13;
    c.fillStyle(0xffffff, 1).fillRect(m - 5, t, 10, 10).fillRect(m - 11, t + 13, 22, 4).fillRect(m - 13, t + 17, 26, 6);
    ui.push(c);
    this.add.zone(px + d / 2 - Pr.barW / 2 + d / 4, Pr.y + d / 2, Pr.barW + d / 2, d).setInteractive().on('pointerup', () => this.openOver('Profile'));
    for (const o of ui) o.setDepth(DEPTH.ui);
    const shown = (list) => list.filter((o) => !(o instanceof Phaser.GameObjects.Zone));
    this.uiParts = { down: shown(this.children.list.slice(n0, n1)), up: shown(this.children.list.slice(n1)) };
    if (this.fromSquad) uiShift(this, this.uiParts, false, { instant: true });
  }

  // A 'Coming soon' window (uiKit). Tap anywhere to close.
  comingSoon(title, who) {
    if (this.modal || this.leaving) return;
    this.modal = comingSoonWindow(this, title, who, { w: U.soon.w, h: U.soon.h, depth: DEPTH.modal, onClose: () => { this.modal = null; } });
  }

  // The gear (Settings) and the profile box (Profile) open their screen over the camp (the camp waits, paused). The
  // tap that closes it must not reach the camp's buttons, so taps stay off for a moment after it comes back.
  openOver(key) {
    if (this.modal || this.leaving) return;
    sfx.play('tap');
    this.leaving = true;
    this.events.once(Phaser.Scenes.Events.RESUME, () => this.time.delayedCall(150, () => { this.leaving = false; }));
    this.scene.launch(key, { from: 'Base' });
    this.scene.pause();
  }

  // TO EXPEDITION: the screen slides up into the squad screen.
  toExpedition() {
    if (this.leaving || this.modal) return;
    this.leaving = true;
    sfx.play('tap');
    uiShift(this, this.uiParts, false, { ms: U.uiShiftMs, onDone: () => this.slideToSquad() }); // the buttons leave first
  }

  slideToSquad() {
    const squad = this.scene.get('Squad');
    squad.events.once(Phaser.Scenes.Events.CREATE, () => {
      const cam = squad.cameras.main, mine = this.cameras.main;
      cam.scrollY = GAME_HEIGHT; // the squad screen starts just above this one
      this.tweens.add({ targets: cam, scrollY: 0, duration: U.slideMs, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: mine, scrollY: -GAME_HEIGHT, duration: U.slideMs, ease: 'Sine.easeInOut', onComplete: () => this.scene.stop() });
    });
    this.scene.launch('Squad', { fromCamp: true });
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
