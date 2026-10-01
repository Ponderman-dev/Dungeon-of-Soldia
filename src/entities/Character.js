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
    if (this.lunging) return;
    this.lunging = true;
    const dx = toX - this.homeX;
    const dy = toY - this.homeY;
    const len = Math.hypot(dx, dy) || 1;
    this.scene.tweens.add({
      targets: this,
      x: this.homeX + (dx / len) * 26,
      y: this.homeY + (dy / len) * 26,
      duration: 90,
      yoyo: true,
      onComplete: () => {
        this.x = this.homeX;
        this.y = this.homeY;
        this.lunging = false;
      },
    });
  }

  // Turn every part white for a moment (hit feedback).
  flash() {
    for (const block of Object.values(this.parts)) block.setFillStyle(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (!this.active) return;
      for (const block of Object.values(this.parts)) block.setFillStyle(block.baseColor);
    });
  }
}
