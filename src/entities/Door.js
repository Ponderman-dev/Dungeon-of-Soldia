import Phaser from 'phaser';

// The door in the back wall of every floor (and of the squad screen's entrance room): a stone arch
// with two wooden doors that are CLOSED until the floor is cleared, then swing open and show a warm
// light behind them. Built inside a container (the floor's) so it slides with the floor.
// x = the door's middle, baseY = the floor line under it.
const FRAME = 0x7a3fb8;
const FRAME_DARK = 0x4e2580;
const WOOD = 0x6b4226;
const WOOD_DARK = 0x4a2c18;
const IRON = 0x2a2233;
const LIGHT = 0xffd98a;
const HALF_W = 18; // half the opening
const OPEN_H = 52; // straight part of the opening
const ARCH_H = 14; // the round top

export default class Door {
  constructor(scene, container, x, baseY) {
    this.scene = scene;
    this.x = x;
    this.baseY = baseY;
    this.isOpen = false;
    const top = baseY - OPEN_H;

    // Stone arch around the opening.
    const frame = scene.add.graphics();
    frame.fillStyle(FRAME, 1).fillRect(x - 26, baseY - 56, 52, 56).fillEllipse(x, baseY - 56, 52, 36);
    frame.fillStyle(FRAME_DARK, 1).fillRect(x - 26, baseY - 4, 52, 4); // threshold step
    // The opening: dark, with the light behind it (shown as the doors open).
    const hole = scene.add.graphics();
    hole.fillStyle(0x120b1f, 1).fillRect(x - HALF_W, top, HALF_W * 2, OPEN_H).fillEllipse(x, top, HALF_W * 2, ARCH_H * 2);
    this.light = scene.add.graphics();
    this.light.fillStyle(LIGHT, 1).fillRect(x - HALF_W, top, HALF_W * 2, OPEN_H).fillEllipse(x, top, HALF_W * 2, ARCH_H * 2);
    this.light.setAlpha(0);
    // A soft glow spilling onto the floor in front of the door when it is open.
    this.glow = scene.add.ellipse(x, baseY + 6, 90, 22, LIGHT, 0.0);

    // Two wooden doors, each turning on its outer hinge (scaleX shrinks it towards the wall = swings in).
    this.leaves = [-1, 1].map((side) => {
      const leaf = scene.add.container(x + side * HALF_W, baseY);
      const g = scene.add.graphics();
      // Drawn as the LEFT leaf, hinge at x = 0, the middle of the door at x = HALF_W.
      const pts = [new Phaser.Math.Vector2(HALF_W, 0), new Phaser.Math.Vector2(0, 0), new Phaser.Math.Vector2(0, -OPEN_H)];
      for (let a = 180; a <= 270; a += 10) {
        const r = Phaser.Math.DegToRad(a);
        pts.push(new Phaser.Math.Vector2(HALF_W + Math.cos(r) * HALF_W, -OPEN_H + Math.sin(r) * ARCH_H));
      }
      g.fillStyle(WOOD, 1).fillPoints(pts, true);
      g.lineStyle(1, WOOD_DARK, 1);
      for (const px of [5, 11]) g.lineBetween(px, -2, px, -OPEN_H - 6); // planks
      g.fillStyle(IRON, 1).fillRect(0, -14, HALF_W, 3).fillRect(0, -40, HALF_W, 3); // iron bands
      g.fillStyle(0xd9b44a, 1).fillRect(HALF_W - 4, -27, 2, 3); // handle
      g.lineStyle(1, WOOD_DARK, 1).strokePoints(pts, true);
      leaf.add(g);
      leaf.setScale(-side, 1); // drawn as the left leaf; the right leaf (side 1) is it mirrored
      leaf.side = side;
      return leaf;
    });

    container.add([frame, hole, this.light, this.glow, ...this.leaves]);
  }

  // The doors swing open (ms), the light inside fades up and spills on the floor.
  open(ms = 650) {
    if (this.isOpen) return;
    this.isOpen = true;
    const tweens = this.scene.tweens;
    for (const leaf of this.leaves) tweens.add({ targets: leaf, scaleX: -leaf.side * 0.12, duration: ms, ease: 'Back.easeOut' });
    tweens.add({ targets: this.light, alpha: 1, duration: ms * 0.8 });
    tweens.add({ targets: this.glow, fillAlpha: 0.28, duration: ms });
    this.flicker = tweens.add({ targets: this.light, alpha: 0.82, duration: 420, yoyo: true, repeat: -1, delay: ms });
  }

  // Shut again at once (no animation).
  close() {
    this.isOpen = false;
    if (this.flicker) this.flicker.stop();
    for (const leaf of this.leaves) leaf.setScale(-leaf.side, 1);
    this.light.setAlpha(0);
    this.glow.setFillStyle(LIGHT, 0);
  }
}
