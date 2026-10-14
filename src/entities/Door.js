import Phaser from 'phaser';

// The door in the back wall of every floor (and of the squad screen's entrance room): a simple purple
// door in a purple arch (user's choice: nothing fancy). It is CLOSED during the fight; when the floor
// is cleared its two halves swing open and the doorway lights up just a little (a soft lavender glow).
// Built inside a container (the floor's) so it slides with the floor. x = the door's middle,
// baseY = the floor line under it.
const FRAME = 0x7a3fb8;
const DOOR = 0x4e2a80;
const DOOR_EDGE = 0x351c5a;
const LIGHT = 0xb89cff;
const LIGHT_ALPHA = 0.38; // how much the doorway lights up when open
const HALF_W = 18; // half the opening
const OPEN_H = 52; // straight part of the opening
const ARCH_H = 14; // the round top

export default class Door {
  constructor(scene, container, x, baseY) {
    this.scene = scene;
    this.isOpen = false;
    const top = baseY - OPEN_H;

    const frame = scene.add.graphics();
    frame.fillStyle(FRAME, 1).fillRect(x - 26, baseY - 56, 52, 56).fillEllipse(x, baseY - 56, 52, 36);
    const hole = scene.add.graphics();
    hole.fillStyle(0x120b1f, 1).fillRect(x - HALF_W, top, HALF_W * 2, OPEN_H).fillEllipse(x, top, HALF_W * 2, ARCH_H * 2);
    this.light = scene.add.graphics();
    this.light.fillStyle(LIGHT, 1).fillRect(x - HALF_W, top, HALF_W * 2, OPEN_H).fillEllipse(x, top, HALF_W * 2, ARCH_H * 2);
    this.light.setAlpha(0);

    // Two plain door halves, each turning on its outer hinge (scaleX shrinks it towards the wall).
    this.leaves = [-1, 1].map((side) => {
      const leaf = scene.add.container(x + side * HALF_W, baseY);
      const g = scene.add.graphics();
      // Drawn as the LEFT half, hinge at x = 0, the middle of the doorway at x = HALF_W.
      const pts = [new Phaser.Math.Vector2(HALF_W, 0), new Phaser.Math.Vector2(0, 0), new Phaser.Math.Vector2(0, -OPEN_H)];
      for (let a = 180; a <= 270; a += 10) {
        const r = Phaser.Math.DegToRad(a);
        pts.push(new Phaser.Math.Vector2(HALF_W + Math.cos(r) * HALF_W, -OPEN_H + Math.sin(r) * ARCH_H));
      }
      g.fillStyle(DOOR, 1).fillPoints(pts, true);
      g.lineStyle(1, DOOR_EDGE, 1).strokePoints(pts, true);
      g.fillStyle(0xc9a8ff, 1).fillRect(HALF_W - 4, -27, 2, 3); // handle
      leaf.add(g);
      leaf.setScale(-side, 1); // the right half (side 1) is the left one mirrored
      leaf.side = side;
      return leaf;
    });

    container.add([frame, hole, this.light, ...this.leaves]);
  }

  // The halves swing open (ms) and the doorway lights up a little.
  open(ms = 600) {
    if (this.isOpen) return;
    this.isOpen = true;
    for (const leaf of this.leaves) this.scene.tweens.add({ targets: leaf, scaleX: -leaf.side * 0.12, duration: ms, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: this.light, alpha: LIGHT_ALPHA, duration: ms });
  }

  // Shut again at once (no animation).
  close() {
    this.isOpen = false;
    for (const leaf of this.leaves) leaf.setScale(-leaf.side, 1);
    this.light.setAlpha(0);
  }
}
