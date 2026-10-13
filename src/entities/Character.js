import Phaser from 'phaser';
import { CHAR_SCALE } from '../config.js';

// A character built from separate colored blocks (parts), described by JSON data.
// Each part is its own object, so real pixel-art parts can replace the blocks later.
// Position (0, 0) is the character's feet; negative y goes up.
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
      const block = scene.add.rectangle(p.x, p.y, p.w, p.h, Number(p.color));
      block.setStrokeStyle(1, 0x1a1020);
      block.baseColor = Number(p.color);
      if (p.pivotY !== undefined) {
        // Rotate around this point (e.g. a sword turns from its handle).
        block.setOrigin(0.5, p.pivotY);
        block.y = p.y + (p.pivotY - 0.5) * p.h;
      }
      block.origColor = Number(p.color);
      block.restAngle = block.angle; // where it rests (the skill animation returns here)
      this.parts[name] = block;
      this.add(block);
    }

    this.setScale(CHAR_SCALE);
    scene.add.existing(this);
    this.playIdle();
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
    const c = Phaser.Display.Color.IntegerToColor(color);
    for (const block of Object.values(this.parts)) {
      const o = Phaser.Display.Color.IntegerToColor(block.origColor);
      const mix = Phaser.Display.Color.Interpolate.ColorWithColor(o, c, 100, Math.round(amount * 100));
      block.baseColor = Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b);
      block.setFillStyle(block.baseColor);
    }
  }

  // Stops the idle animation (the character holds its current pose). Used when a hero dies.
  freeze() {
    for (const t of this.idleTweens) t.stop();
    this.idleTweens = [];
  }

  destroy(fromScene) {
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

  // Turn every part white for a moment (hit feedback).
  // Lights up all parts in one colour for a moment (white = a normal hit).
  flash(color = 0xffffff, ms = 80) {
    for (const block of Object.values(this.parts)) block.setFillStyle(color);
    this.scene.time.delayedCall(ms, () => {
      if (!this.active) return;
      for (const block of Object.values(this.parts)) block.setFillStyle(block.baseColor);
    });
  }
}
