import Phaser from 'phaser';
import { CHAR_SCALE } from '../config.js';
import { partArt, artSize, partAnchor, artPixels, mixColor, artKey } from '../systems/pixelArt.js';

// A character built from separate parts (body, head, weapon...), described by JSON data.
// Each part is a small pixel picture (`art`, drawn in the Character Studio) or, until it is drawn,
// a plain block. Position (0, 0) is the character's feet; negative y goes up.
//
// `this.parts[name]` is a light "pose" object (x, y, angle) that the tweens move; the part's image
// copies it every frame just before drawing (smooth animation; the pixels themselves stay crisp).
export default class Character extends Phaser.GameObjects.Container {
  constructor(scene, x, y, def) {
    super(scene, x, y);
    this.def = def;
    this.parts = {};
    this.homeX = x;
    this.homeY = y;
    this.lunging = false;
    this.hopOffset = 0; // how far up the current walking hop has lifted it (so things can follow its feet)
    this.castLift = 0; // skill animation: how far it is lifted (+) or crouched (-), in pixels (the scene adds it)
    this.idleTweens = [];

    for (const [name, p] of Object.entries(def.parts)) {
      const art = partArt(p);
      const { w, h } = artSize(art);
      const [ax, ay] = partAnchor(p, art);
      // The pose: x / y = the turning point (anchor), in character pixels.
      const x = p.x - w / 2 + ax;
      const y = p.y - h / 2 + ay;
      const image = scene.add.image(x, y, '__DEFAULT');
      const part = {
        name, x, y, angle: 0, restX: x, restY: y, restAngle: 0,
        width: w, height: h, originX: ax / w, originY: ay / h,
        pixels: artPixels(art), anchor: [ax, ay], key: artKey(art), image,
        wash: null, shown: null,
      };
      this.parts[name] = part;
      this.add(image);
    }

    this.setScale(CHAR_SCALE);
    scene.add.existing(this);
    this.followPose = () => this.syncParts();
    this.homeScene = scene; // kept so destroy() can unhook even after Phaser clears this.scene
    scene.events.on('prerender', this.followPose);
    this.syncParts();
    this.playIdle();
  }

  // Puts each part's image on its pose (position and turn), with the right picture.
  syncParts() {
    if (!this.scene) return; // destroyed
    for (const part of Object.values(this.parts)) {
      const key = this.texture(part);
      if (part.shown !== key) {
        part.image.setTexture(key);
        part.image.setOrigin(part.originX, part.originY); // turns around the anchor
        part.shown = key;
      }
      part.image.x = part.x;
      part.image.y = part.y;
      part.image.angle = part.angle;
    }
  }

  // The texture of a part's picture (washed in a colour if needed), made once and shared.
  texture(part) {
    const wash = part.wash ? `${part.wash.color.toString(16)}-${Math.round(part.wash.amount * 100)}` : '';
    const key = `px-${part.key}-${wash}`;
    const textures = this.scene.textures;
    if (!textures.exists(key)) {
      const tex = textures.createCanvas(key, part.width, part.height);
      const ctx = tex.context;
      part.pixels.forEach((row, y) =>
        row.forEach((c, x) => {
          if (c === null) return;
          const col = part.wash ? mixColor(c, part.wash.color, part.wash.amount) : c;
          ctx.fillStyle = '#' + col.toString(16).padStart(6, '0');
          ctx.fillRect(x, y, 1, 1);
        }),
      );
      tex.refresh();
    }
    return key;
  }

  // Gentle idle motion for each part, as described in the part's "idle" data.
  playIdle() {
    for (const [name, p] of Object.entries(this.def.parts)) {
      const idle = p.idle;
      if (!idle) continue;
      const block = this.parts[name];
      const tween = {
        targets: block,
        duration: idle.duration,
        delay: idle.delay || 0,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      };
      if (idle.dy) tween.y = block.y + idle.dy;
      if (idle.angle) tween.angle = idle.angle;
      this.idleTweens.push(this.scene.tweens.add(tween));
    }
  }

  // Turns the character to look left (-1) or right (1) by mirroring it. The art itself looks the way
  // its weapon points (weapon part on the right = looks right). Keeps the current size.
  face(dir) {
    const weapon = this.def.parts.weapon;
    const artDir = weapon && weapon.x < 0 ? -1 : 1;
    const size = Math.abs(this.scaleY);
    this.setScale(size * dir * artDir, size);
  }

  // ---- skill animation (different from a normal attack) ---------------------------------------
  // Wind-up: the hero crouches and raises its weapon high over `ms`.
  castWindUp(ms) {
    this.castReset();
    const w = this.parts.weapon;
    this.castTweens = [this.scene.tweens.add({ targets: this, castLift: -4, duration: ms, ease: 'Quad.easeOut' })];
    if (w) this.castTweens.push(this.scene.tweens.add({ targets: w, angle: w.restAngle - 55, duration: ms, ease: 'Quad.easeOut' })); // cocked back
  }

  // The skill goes off. Attack skill: a big overhead slash with a leap forward. Support skill: it
  // jumps up with the weapon held high, then settles.
  castRelease(kind) {
    this.castReset(true);
    const w = this.parts.weapon;
    const tw = this.scene.tweens;
    if (kind === 'attack') {
      this.castTweens = [
        tw.add({ targets: this, castLift: 8, duration: 90, yoyo: true, ease: 'Quad.easeOut' }),
      ];
      if (w) this.castTweens.push(tw.add({ targets: w, angle: w.restAngle + 105, duration: 110, ease: 'Quad.easeIn', yoyo: true, hold: 140, onComplete: () => (w.angle = w.restAngle) }));
    } else {
      this.castTweens = [
        tw.add({ targets: this, castLift: 18, duration: 160, yoyo: true, ease: 'Quad.easeOut' }),
      ];
      if (w) this.castTweens.push(tw.add({ targets: w, angle: w.restAngle, delay: 300, duration: 200, ease: 'Quad.easeInOut', onStart: () => (w.angle = w.restAngle - 25) })); // held up a little, then back
    }
  }

  // Wind-up interrupted (stun...) or over: back to the normal pose.
  castCancel() {
    this.castReset(true);
    const w = this.parts.weapon;
    if (w) this.scene.tweens.add({ targets: w, angle: w.restAngle, duration: 150 });
    this.scene.tweens.add({ targets: this, castLift: 0, duration: 150 });
  }

  castReset(keepWeapon = false) {
    for (const t of this.castTweens || []) t.stop();
    this.castTweens = [];
    if (!keepWeapon && this.swingTween) this.swingTween.stop();
  }

  // A faint colour wash over the whole character (morale): every part is mixed `amount` (0 to 1)
  // of the way towards `color`. amount 0 = the normal colours.
  setWash(color, amount) {
    for (const part of Object.values(this.parts)) part.wash = amount > 0 ? { color, amount } : null;
    this.syncParts();
  }

  // A shine on the weapon (an "every Nth attack" is charged): a pulsing glow in `color`, or none (null).
  setGlow(color) {
    if (!color) {
      if (this.glow) { this.glowTween.stop(); this.glow.destroy(); this.glow = null; this.scene.events.off('update', this.glowFollow); }
      this.glowColor = null;
      return;
    }
    if (this.glow && this.glowColor === color) return;
    this.setGlow(null);
    const w = this.parts.weapon || Object.values(this.parts)[0];
    const size = Math.max(w.width, w.height) * 0.22 + 2;
    this.glowColor = color;
    const mid = () => w.y + (0.5 - (w.originY ?? 0.5)) * w.height; // the weapon's middle (it can turn around a handle)
    this.glow = this.scene.add.container(w.x, mid());
    this.glow.add([this.scene.add.circle(0, 0, size, color, 0.6), this.scene.add.circle(0, 0, size * 0.4, 0xffffff, 0.7)]);
    this.glow.list.forEach((c) => c.setBlendMode(Phaser.BlendModes.ADD));
    this.add(this.glow);
    this.glowTween = this.scene.tweens.add({ targets: this.glow, scale: { from: 0.8, to: 1.5 }, alpha: { from: 0.55, to: 1 }, duration: 240, yoyo: true, repeat: -1 });
    // the glow follows the weapon as it swings
    this.glowFollow = () => { if (this.glow) { this.glow.x = w.x; this.glow.y = mid(); } };
    this.scene.events.on('update', this.glowFollow);
  }

  // Stops the idle animation (the character holds its current pose). Used when a hero dies.
  freeze() {
    for (const t of this.idleTweens) t.stop();
    this.idleTweens = [];
  }

  destroy(fromScene) {
    this.homeScene.events.off('prerender', this.followPose);
    if (this.glowFollow) this.scene.events.off('update', this.glowFollow);
    for (const t of this.idleTweens) t.remove();
    super.destroy(fromScene);
  }

  // Quick jab towards a point and back.
  lunge(toX, toY) {
    // Only from its home spot (not while running or standing at an enemy).
    if (this.lunging || this.moveTween || this.x !== this.homeX || this.y !== this.homeY) return;
    this.lunging = true;
    const dx = toX - this.homeX;
    const dy = toY - this.homeY;
    const len = Math.hypot(dx, dy) || 1;
    this.lungeTween = this.scene.tweens.add({
      targets: this,
      x: this.homeX + (dx / len) * 26,
      y: this.homeY + (dy / len) * 26,
      duration: 90,
      yoyo: true,
      onComplete: () => {
        this.x = this.homeX;
        this.y = this.homeY;
        this.lunging = false;
        this.lungeTween = null;
      },
    });
  }

  // Moves to (x, y) in `duration` ms, then calls onDone. Any move already running is stopped first.
  moveTo(x, y, duration, opts = {}) {
    this.chase(() => ({ x, y }), duration, opts);
  }

  // Walks towards a spot that may move (getSpot() is asked every frame, e.g. a target that is itself
  // walking), arriving after `duration` ms, then calls onDone.
  // opts.ease: 'Linear' by default (constant speed, not floaty). opts.hop: { height, length } makes it
  // hop with every step like the door walk. opts.onUpdate runs every frame (to keep bars attached).
  chase(getSpot, duration, { onDone, onUpdate, ease = 'Linear', hop = null } = {}) {
    this.stopMove();
    const fromX = this.x;
    const fromY = this.y;
    const first = getSpot();
    const steps = hop ? Math.hypot(first.x - fromX, first.y - fromY) / hop.length : 0;
    this.moveTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: Math.max(1, duration),
      ease,
      onUpdate: (tween) => {
        const p = tween.getValue();
        const spot = getSpot();
        this.x = fromX + (spot.x - fromX) * p;
        // Each step is one little hop: up and down, landing exactly at the end.
        this.hopOffset = hop ? Math.abs(Math.sin(p * steps * Math.PI)) * hop.height : 0;
        this.y = fromY + (spot.y - fromY) * p - this.hopOffset;
        if (onUpdate) onUpdate();
      },
      onComplete: () => {
        const spot = getSpot();
        this.x = spot.x;
        this.y = spot.y;
        this.hopOffset = 0;
        this.moveTween = null;
        if (onDone) onDone();
      },
    });
  }

  // Stops a run (moveTo) or a jab (lunge) where it is.
  stopMove() {
    if (this.moveTween) this.moveTween.stop();
    this.moveTween = null;
    if (this.lungeTween) this.lungeTween.stop();
    this.lungeTween = null;
    this.lunging = false;
    this.y += this.hopOffset; // stopped mid-hop: land
    this.hopOffset = 0;
  }

  // Swings the weapon part (if there is one) down and back up again.
  swing(duration) {
    const weapon = this.parts.weapon;
    if (!weapon) return;
    if (this.swingTween) this.swingTween.stop();
    const start = weapon.angle;
    this.swingTween = this.scene.tweens.add({
      targets: weapon,
      angle: start + 75,
      duration: duration / 2,
      yoyo: true,
      ease: 'Quad.easeIn',
      onComplete: () => {
        weapon.angle = start;
        this.swingTween = null;
      },
    });
  }

  // Lights up all parts in one colour for a moment (white = a normal hit).
  flash(color = 0xffffff, ms = 80) {
    for (const part of Object.values(this.parts)) part.image.setTint(color).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(ms, () => {
      if (!this.active) return;
      for (const part of Object.values(this.parts)) part.image.clearTint();
    });
  }
}
