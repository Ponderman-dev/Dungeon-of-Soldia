import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config.js';
import { drawWindow, uiText, comingSoonWindow, drawGear, pixelDisc, uiShift, buttonTextColor, drawFlatButton, prepareScreen, dropScreen, slideToScreen, whenScreenReady } from '../entities/uiKit.js';
import { nextBossFloor } from '../systems/dungeon.js';
import camp from '../data/camp.json';
import { openFloor, darkLayer, lightTint, fireLayers, propLayer, blendProp } from '../systems/campArt.js';
import floorArt from '../data/floorArt.json';
import dungeons from '../data/dungeons.json';
import { layerTexture } from '../entities/pixelLayer.js';
import Character from '../entities/Character.js';
import heroes from '../data/heroes.json';
import unlocks from '../data/unlocks.json';
import { loadProgress, unlockedIds } from '../systems/progress.js';
import profileData from '../data/profile.json';
import * as sfx from '../audio/sfx.js';
import * as music from '../audio/music.js';

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
    this.heroesGone = false;
  }

  create() {
    music.play('camp');
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
    this.nextScreen = null; // the squad screen built early (uiKit prepareScreen)
    if (this.fromSquad) this.leaving = true; // the buttons come in when the slide down has ended (arrive); no taps before that
  }

  // The slide from the squad screen has ended (uiKit slideToScreen): the heroes walk down from the top to their spots
  // and the buttons come in at once, not waiting for them (user, session 55; camp.json toSquad).
  arrive() {
    this.heroesWalk(false, () => {
      for (const ch of this.heroes) ch.wanderTimer = this.time.delayedCall(Phaser.Math.Between(...camp.hero.pauseMs) * 0.5, () => this.wander(ch, ch.home.x, ch.home.y));
    });
    uiShift(this, this.uiParts, true, { onDone: () => { this.leaving = false; } });
  }

  // The camp's heroes walk straight up off the top of the screen (out = true; one after another), or come back down
  // from there to their spots (out = false). done runs when the last one has arrived.
  heroesWalk(out, done) {
    const C = camp.toSquad, top = -C.offTopPx;
    if (!this.heroes.length) { done(); return; }
    let left = this.heroes.length;
    this.heroes.forEach((ch, i) => {
      this.stopWander(ch);
      const from = { x: ch.x, y: out ? ch.y : top }, to = { x: out ? ch.x : ch.home.x, y: out ? top : ch.home.y };
      ch.setPosition(from.x, from.y).setVisible(true).setWalking(true);
      ch.wanderTween = this.tweens.addCounter({ from: 0, to: 1, delay: i * C.staggerMs, // (stopWander stops it: EXPEDITION mid-walk) duration: (Math.abs(to.y - from.y) / C.upSpeed) * 1000,
        onUpdate: (tw) => { const t = tw.getValue(); ch.setPosition(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t).setDepth(ch.y); },
        onComplete: () => {
          ch.setWalking(false);
          if (out) ch.setVisible(false); else ch.face(ch.x <= camp.fire.x ? 1 : -1);
          if (--left === 0) done();
        } });
    });
  }

  stopWander(ch) {
    if (ch.wanderTween) { ch.wanderTween.stop(); ch.wanderTween = null; }
    if (ch.wanderTimer) { ch.wanderTimer.remove(false); ch.wanderTimer = null; }
  }

  // Up to 3 random unlocked heroes round the fire, each idly wandering near its spot (camp.json hero).
  drawHeroes() {
    const H = camp.hero, open = Phaser.Utils.Array.Shuffle(unlockedIds(heroes, loadProgress(), unlocks).slice());
    const defs = open.map((id) => heroes.find((h) => h.id === id)).filter(Boolean).slice(0, H.spots.length);
    this.heroes = defs.map((def, i) => {
      const [x, y] = H.spots[i];
      const ch = this.add.existing(new Character(this, x, y, def).setDepth(y));
      ch.home = { x, y };
      ch.face(x <= camp.fire.x ? 1 : -1);
      if (this.fromSquad) ch.setVisible(false); // they walk down from the top after the slide (arrive)
      else ch.wanderTimer = this.time.delayedCall(Phaser.Math.Between(...H.pauseMs) * (0.3 + 0.4 * i), () => this.wander(ch, x, y));
      return ch;
    });
  }

  // One idle stroll: a few steps to a random spot near home, a look at the fire, a pause, then again.
  wander(ch, homeX, homeY) {
    if (!ch.active || this.heroesGone) return; // walking off to the squad screen
    const H = camp.hero, a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
    const to = { x: homeX + Math.cos(a) * r * H.radiusPx[0], y: homeY + Math.sin(a) * r * H.radiusPx[1] };
    const dist = Math.hypot(to.x - ch.x, to.y - ch.y);
    const next = () => { ch.wanderTween = null; ch.wanderTimer = this.time.delayedCall(Phaser.Math.Between(...H.pauseMs), () => this.wander(ch, homeX, homeY)); };
    if (dist < 4) return next();
    ch.face(to.x < ch.x ? -1 : 1);
    ch.setWalking(true);
    const from = { x: ch.x, y: ch.y };
    ch.wanderTween = this.tweens.addCounter({ from: 0, to: 1, duration: (dist / H.speed) * 1000, onUpdate: (tw) => {
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
  // Flat camp buttons: uiKit drawFlatButton (shared with the squad screen).
  flatButton(g, x, y, w, h, opts = {}) { return drawFlatButton(g, x, y, w, h, opts); }

  drawUi() {
    const ui = [];
    const n0 = this.children.list.length; // what drawUi adds: the bottom part first, then the top (for uiShift)
    const W = GAME_WIDTH, S = U.side, T = UI.goldTheme, cx = W / 2;
    const progress = loadProgress();

    // EXPEDITION: the camp's main action. The red flat button with gold bands, big words, the next boss floor.
    const E = U.expedition, ew = W - 2 * S, ey = E.y + E.h / 2;
    const box = this.add.container(cx, ey).setDepth(DEPTH.ui);
    box.add(this.flatButton(this.add.graphics(), -ew / 2, -E.h / 2, ew, E.h, { primary: true, bands: true }));
    const color = buttonTextColor(true, false, true), boss = nextBossFloor(dungeons.A, progress.stats.bestFloor);
    box.add(uiText(this, 0, E.textY, E.text, E.size, color).setOrigin(0.5));
    box.add(uiText(this, 0, E.subY, boss ? E.sub.replace('{n}', boss) : E.subDone, 'small', color).setOrigin(0.5));
    this.add.zone(cx, ey, ew, E.h).setInteractive().onPress(() => this.toExpedition(), { // the squad screen is built while the finger holds (no hitch in the slide)
      onDown: () => { if (!this.leaving && !this.modal) prepareScreen(this, 'Squad', { fromCamp: true }, GAME_HEIGHT); },
      onCancel: () => dropScreen(this) });

    // The tab bar: a gold line, a dark band, 4 buttons (icon + name) that open their screen over the camp.
    const B = U.tabs, n = B.buttons.length, tw = (W - 2 * S - B.gap * (n - 1)) / n, ty = B.y + B.pad;
    ui.push(this.add.graphics().fillStyle(T.frame, 1).fillRect(0, B.y, W, 2).fillStyle(T.outline, 0.9).fillRect(0, B.y + 2, W, GAME_HEIGHT - B.y));
    B.buttons.forEach((b, i) => {
      const x = S + i * (tw + B.gap);
      ui.push(this.flatButton(this.add.graphics(), x, ty, tw, B.h));
      ui.push(this.add.image(x + tw / 2, ty + B.iconY, layerTexture(this, `camp-icon-${b.id}`, propLayer(b.icon, false))).setScale(B.iconPx));
      ui.push(uiText(this, x + tw / 2, ty + B.labelY, b.label, B.labelSize, buttonTextColor()).setOrigin(0.5));
      this.add.zone(x + tw / 2, ty + B.h / 2, tw, B.h).setInteractive().onPress(() => (b.scene ? this.openOver(b.scene) : this.comingSoon(b.label, b.who)));
    });

    const n1 = this.children.list.length;
    // The header: ONE gold panel. Portrait + name + best floor (tap = Profile) | gems | settings gear.
    const H = U.header, hy = H.y, mid = hy + H.h / 2, g = this.add.graphics();
    drawWindow(g, S, hy, W - 2 * S, H.h, { quiet: true });
    const r = H.portraitR, px = S + 14 + r;
    pixelDisc(g, px, mid, r + 2, T.outline); pixelDisc(g, px, mid, r, T.frame); pixelDisc(g, px, mid, r - 4, T.fill);
    g.fillStyle(T.stud, 1).fillRect(px - 4, mid - 11, 8, 8).fillRect(px - 9, mid, 18, 4).fillRect(px - 11, mid + 4, 22, 5); // a little person (for now)
    const gearL = W - S - H.gearW, gemsL = gearL - H.gemsW;
    g.fillStyle(T.frameDark, 1).fillRect(gemsL, hy + H.divider, 2, H.h - 2 * H.divider).fillRect(gearL, hy + H.divider, 2, H.h - 2 * H.divider);
    drawGear(g, (gearL + W - S) / 2 + 1, mid);
    const playerName = () => (loadProgress().profile.name || profileData.defaults.name);
    const nameText = uiText(this, S + H.textX, hy + H.nameY, playerName(), 'small');
    const onResume = () => nameText.setText(playerName()); // renamed on the Profile
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.RESUME, onResume)); // scene events outlive a restart: no pile-up
    const best = uiText(this, S + H.textX, hy + H.bestY, H.best.replace('{n}', progress.stats.bestFloor), 'small', UI.gold);
    const gem = this.add.image(gemsL + 20, mid, layerTexture(this, 'camp-gem', propLayer(H.gem, false))).setScale(3);
    const gems = uiText(this, gemsL + 36, mid + 1, String(progress.gems || 0), 'small').setOrigin(0, 0.5);
    ui.push(g, nameText, best, gem, gems);
    this.add.zone((S + gemsL) / 2, mid, gemsL - S, H.h).setInteractive().onPress(() => this.openOver('Profile'));
    this.add.zone((gearL + W - S) / 2, mid, W - S - gearL, H.h).setInteractive().onPress(() => this.openOver('Settings'));

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

  // TO EXPEDITION (user, session 55): the buttons leave while the heroes walk up off the top, then the screen slides up
  // into the squad screen (where the squad walks in from the sides, SquadScene.arrive).
  toExpedition() {
    if (this.leaving || this.modal) return;
    this.leaving = true;
    sfx.play('tap');
    whenScreenReady(this, 'Squad', { fromCamp: true }, GAME_HEIGHT, () => { // the squad screen is built, then the camp empties
      let left = 2; // the slide starts while the heroes are still walking up (camp.json toSquad.slideAfterMs)
      const both = () => { if (--left === 0) this.slideToSquad(); };
      this.heroesGone = true;
      uiShift(this, this.uiParts, false, { onDone: both });
      this.heroesWalk(true, () => {});
      this.time.delayedCall(camp.toSquad.slideAfterMs, both);
    });
  }

  slideToSquad() { // the squad screen comes down from above (built early: uiKit slideToScreen)
    slideToScreen(this, 'Squad', { fromCamp: true }, GAME_HEIGHT);
  }

  // A pixel layer as an image at screen (x, y), placed by its anchor.
  layer(key, lay, x, y) {
    return this.add.image(x, y, layerTexture(this, key, lay)).setOrigin(lay.ax / lay.w, lay.ay / lay.h).setScale(P);
  }

  // Tents, banner, weapon rack, cooking pot, dog...: each stands on a soft shadow, under the floor's darkness (camp.json
  // propLook), its colours leaning toward the floor stone; a `lit` prop (the brazier) keeps its colours and glows.
  drawProps() {
    const L = camp.propLook; // props sit UNDER the floor's darkness (same light as the floor) and lean toward its colour
    for (const [name, x, y, flip] of camp.place) {
      const def = blendProp(camp.props[name], L.toward, L.mix), under = L.underDark && !def.lit;
      const lay = propLayer(def, flip, { noOutline: !camp.propOutline, style: L.style });
      const depth = under ? 0.1 + (y / GAME_HEIGHT) * 0.3 : y; // under the dark layer (0.5), still lower = in front
      this.add.ellipse(x, y - 1, lay.w * P * 0.9, 8, 0x000000, 0.3).setDepth(depth - 0.001);
      const img = this.layer(`camp-${name}${flip ? '-flip' : ''}`, lay, x, y).setDepth(depth);
      if (!def.lit && !under) img.setTint(lightTint(camp, x, y));
      if (def.glow) { // its own soft light (the brazier), flickering a little
        const G = def.glow, gx = x + ((flip ? lay.w - 1 - G.x : G.x) - lay.ax) * P, gy = y + (G.y - lay.ay) * P;
        const glow = this.add.graphics().setDepth(1).setAlpha(G.alpha);
        for (let i = G.steps; i >= 1; i--) pixelDisc(glow, gx, gy, Math.round((G.r * P * i) / G.steps / 2) * 2, Number(G.color));
        this.tweens.add({ targets: glow, alpha: G.alpha * 1.6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
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
