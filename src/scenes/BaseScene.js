import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config.js';
import { drawWindow, uiText, comingSoonWindow, drawGear, pixelDisc, uiShift, drawButton, buttonTextColor } from '../entities/uiKit.js';
import { nextBossFloor } from '../systems/dungeon.js';
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
// camp.json. A mobile-game hub: a gold header (profile, gems, settings), 3 heroes idle round the fire in the middle,
// the gold-framed EXPEDITION button (slides up into the squad screen) and a bar of 4 tabs at the bottom.
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
    if (this.fromTitle) this.cameras.main.fadeIn(UI.motion.slow, 0, 0, 0);
    if (this.fromSquad) { // the buttons come in once the slide down has ended; no taps before that
      this.leaving = true;
      this.time.delayedCall(UI.motion.slow, () => uiShift(this, this.uiParts, true, { onDone: () => { this.leaving = false; } }));
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

  // The hub (user, session 42: 'more like a mobile game menu', picked A1 + header H1): one gold header panel at the top
  // (profile, gems, settings), the big gold-framed EXPEDITION button, and a bar of 4 tabs at the bottom.
  drawUi() {
    const ui = [];
    const n0 = this.children.list.length; // what drawUi adds: the bottom part first, then the top (for uiShift)
    const W = GAME_WIDTH, S = U.side, T = UI.goldTheme, cx = W / 2;
    const progress = loadProgress();

    // EXPEDITION: the camp's main action. A gold frame, the bright button inside, crossed swords, the next boss floor.
    const E = U.expedition, ew = W - 2 * S, ey = E.y + E.h / 2;
    const box = this.add.container(cx, ey).setDepth(DEPTH.ui);
    box.add(drawWindow(this.add.graphics(), -ew / 2, -E.h / 2, ew, E.h));
    box.add(drawButton(this.add.graphics(), -ew / 2 + E.frame, -E.h / 2 + E.frame, ew - 2 * E.frame, E.h - 2 * E.frame, { primary: true }));
    box.add(this.add.image(-ew / 2 + E.swordsX, 0, layerTexture(this, 'camp-swords', propLayer(E.swords, false))).setScale(E.swordsPx));
    const color = buttonTextColor(true, false, true), boss = nextBossFloor(dungeons.A, progress.stats.bestFloor);
    box.add(uiText(this, E.textX, -12, E.text, E.size, color).setOrigin(0.5));
    box.add(uiText(this, E.textX, 18, boss ? E.sub.replace('{n}', boss) : E.subDone, 'small', color).setOrigin(0.5));
    this.add.zone(cx, ey, ew, E.h).setInteractive().on('pointerup', () => this.toExpedition());

    // The tab bar: a gold line, a dark band, 4 buttons (icon + name) that open their screen over the camp.
    const B = U.tabs, n = B.buttons.length, tw = (W - 2 * S - B.gap * (n - 1)) / n, ty = B.y + B.pad;
    ui.push(this.add.graphics().fillStyle(T.frame, 1).fillRect(0, B.y, W, 2).fillStyle(T.outline, 0.9).fillRect(0, B.y + 2, W, GAME_HEIGHT - B.y));
    B.buttons.forEach((b, i) => {
      const x = S + i * (tw + B.gap);
      ui.push(drawButton(this.add.graphics(), x, ty, tw, B.h));
      ui.push(this.add.image(x + tw / 2, ty + B.iconY, layerTexture(this, `camp-icon-${b.id}`, propLayer(b.icon, false))).setScale(B.iconPx));
      ui.push(uiText(this, x + tw / 2, ty + B.labelY, b.label, B.labelSize, buttonTextColor()).setOrigin(0.5));
      this.add.zone(x + tw / 2, ty + B.h / 2, tw, B.h).setInteractive().on('pointerup', () => (b.scene ? this.openOver(b.scene) : this.comingSoon(b.label, b.who)));
    });

    const n1 = this.children.list.length;
    // The header: ONE gold panel. Portrait + name + best floor (tap = Profile) | gems | settings gear.
    const H = U.header, hy = H.y, mid = hy + H.h / 2, g = this.add.graphics();
    drawWindow(g, S, hy, W - 2 * S, H.h);
    const r = H.portraitR, px = S + 14 + r;
    pixelDisc(g, px, mid, r + 2, T.outline); pixelDisc(g, px, mid, r, T.frame); pixelDisc(g, px, mid, r - 4, T.fill);
    g.fillStyle(T.stud, 1).fillRect(px - 4, mid - 11, 8, 8).fillRect(px - 9, mid, 18, 4).fillRect(px - 11, mid + 4, 22, 5); // a little person (for now)
    const gearL = W - S - H.gearW, gemsL = gearL - H.gemsW;
    g.fillStyle(T.frameDark, 1).fillRect(gemsL, hy + H.divider, 2, H.h - 2 * H.divider).fillRect(gearL, hy + H.divider, 2, H.h - 2 * H.divider);
    drawGear(g, (gearL + W - S) / 2 + 1, mid);
    const playerName = () => (loadProgress().profile.name || profileData.defaults.name);
    const nameText = uiText(this, S + H.textX, hy + H.nameY, playerName(), 'small');
    this.events.on(Phaser.Scenes.Events.RESUME, () => nameText.setText(playerName())); // renamed on the Profile
    const best = uiText(this, S + H.textX, hy + H.bestY, H.best.replace('{n}', progress.stats.bestFloor), 'small', UI.gold);
    const gem = this.add.image(gemsL + 20, mid, layerTexture(this, 'camp-gem', propLayer(H.gem, false))).setScale(3);
    const gems = uiText(this, gemsL + 36, mid + 1, String(progress.gems || 0), 'small').setOrigin(0, 0.5);
    ui.push(g, nameText, best, gem, gems);
    this.add.zone((S + gemsL) / 2, mid, gemsL - S, H.h).setInteractive().on('pointerup', () => this.openOver('Profile'));
    this.add.zone((gearL + W - S) / 2, mid, W - S - gearL, H.h).setInteractive().on('pointerup', () => this.openOver('Settings'));

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
    // Like TO EXPEDITION (user, session 41): the camp's buttons leave first, then the page comes in; when it has gone
    // again the buttons come back in (taps stay off until they are home).
    this.events.once(Phaser.Scenes.Events.RESUME, () => uiShift(this, this.uiParts, true, { onDone: () => { this.leaving = false; } }));
    uiShift(this, this.uiParts, false, { onDone: () => { this.scene.launch(key, { from: 'Base' }); this.scene.pause(); } });
  }

  // TO EXPEDITION: the screen slides up into the squad screen.
  toExpedition() {
    if (this.leaving || this.modal) return;
    this.leaving = true;
    sfx.play('tap');
    uiShift(this, this.uiParts, false, { onDone: () => this.slideToSquad() }); // the buttons leave first
  }

  slideToSquad() {
    const squad = this.scene.get('Squad');
    squad.events.once(Phaser.Scenes.Events.CREATE, () => {
      const cam = squad.cameras.main, mine = this.cameras.main;
      cam.scrollY = GAME_HEIGHT; // the squad screen starts just above this one
      this.tweens.add({ targets: cam, scrollY: 0, duration: UI.motion.slow, ease: UI.motion.easeMove });
      this.tweens.add({ targets: mine, scrollY: -GAME_HEIGHT, duration: UI.motion.slow, ease: UI.motion.easeMove, onComplete: () => this.scene.stop() });
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
