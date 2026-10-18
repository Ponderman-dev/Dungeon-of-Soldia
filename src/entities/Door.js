import Phaser from 'phaser';
import floorArt from '../data/floorArt.json';

// The door in the back wall of every floor (and of the squad screen's entrance room), drawn to match the stone
// wall (screen review, user): a stone arch of blocks with a keystone, and a dark wooden door of planks with iron
// bands. It is CLOSED during the fight; when the floor is cleared its two halves swing open onto a black doorway.
// Built inside a container (the floor's) so it slides with the floor. x = the door's middle,
// baseY = the floor line under it. Colours: floorArt.json `door`.
const C = Object.fromEntries(Object.entries(floorArt.door).filter(([k]) => k !== '_about').map(([k, v]) => [k, Number(v)]));
const HALF_W = 18; // half the opening
const OPEN_H = 52; // straight part of the opening
const ARCH_H = 14; // the round top
const FRAME_W = 9; // the stone round the opening

export default class Door {
  constructor(scene, container, x, baseY) {
    this.scene = scene;
    this.isOpen = false;
    const top = baseY - OPEN_H;

    // The stone arch: two jambs of blocks and a ring of wedge blocks over the top, a lighter keystone.
    const frame = scene.add.graphics();
    const outW = HALF_W + FRAME_W;
    frame.fillStyle(C.stone, 1).fillRect(x - outW, top, outW * 2, OPEN_H).fillEllipse(x, top, outW * 2, (ARCH_H + FRAME_W) * 2);
    frame.lineStyle(1, C.mortar, 1);
    for (let y = baseY - 10; y > top; y -= 10) {
      frame.lineBetween(x - outW, y, x - HALF_W, y);
      frame.lineBetween(x + HALF_W, y, x + outW, y);
    }
    for (let a = 180; a <= 360; a += 30) {
      const r = Phaser.Math.DegToRad(a);
      frame.lineBetween(x + Math.cos(r) * HALF_W, top + Math.sin(r) * ARCH_H, x + Math.cos(r) * outW, top + Math.sin(r) * (ARCH_H + FRAME_W));
    }
    frame.fillStyle(C.stoneLight, 1).fillRect(x - 4, top - ARCH_H - FRAME_W + 1, 8, FRAME_W); // keystone
    frame.fillRect(x - outW, top - 1, FRAME_W, 2).fillRect(x + HALF_W, top - 1, FRAME_W, 2); // where the arch meets the jambs
    frame.strokeRect(x - outW, top, outW * 2, OPEN_H);
    const hole = scene.add.graphics();
    hole.fillStyle(C.hole, 1).fillRect(x - HALF_W, top, HALF_W * 2, OPEN_H).fillEllipse(x, top, HALF_W * 2, ARCH_H * 2);
    // (kept so open/close work as before; the open doorway stays black)
    this.light = scene.add.graphics();

    // Two wooden door halves, each turning on its outer hinge (scaleX shrinks it towards the wall).
    const archY = (dx) => -OPEN_H - ARCH_H * Math.sqrt(Math.max(0, 1 - (dx / HALF_W) ** 2)); // top of the door at dx from the middle
    this.leaves = [-1, 1].map((side) => {
      const leaf = scene.add.container(x + side * HALF_W, baseY);
      const g = scene.add.graphics();
      // Drawn as the LEFT half, hinge at x = 0, the middle of the doorway at x = HALF_W.
      const pts = [new Phaser.Math.Vector2(HALF_W, 0), new Phaser.Math.Vector2(0, 0), new Phaser.Math.Vector2(0, -OPEN_H)];
      for (let a = 180; a <= 270; a += 10) {
        const r = Phaser.Math.DegToRad(a);
        pts.push(new Phaser.Math.Vector2(HALF_W + Math.cos(r) * HALF_W, -OPEN_H + Math.sin(r) * ARCH_H));
      }
      g.fillStyle(C.wood, 1).fillPoints(pts, true);
      // Planks: dark seams, each plank lit on its left edge.
      for (let px = 0; px < HALF_W; px += 6) {
        g.fillStyle(C.woodDark, 1).fillRect(px, Math.ceil(archY(HALF_W - px)), 1, -Math.ceil(archY(HALF_W - px)));
        g.fillStyle(C.woodLight, 1).fillRect(px + 1, Math.ceil(archY(HALF_W - px - 1)) + 1, 1, -Math.ceil(archY(HALF_W - px - 1)) - 1);
      }
      // Two iron bands with rivets, and a ring handle by the middle.
      for (const by of [-14, -40]) {
        g.fillStyle(C.iron, 1).fillRect(0, by, HALF_W, 4);
        g.fillStyle(C.rivet, 1);
        for (let rx = 2; rx < HALF_W; rx += 6) g.fillRect(rx, by + 1, 2, 2);
      }
      g.lineStyle(1, C.rivet, 1).strokeCircle(HALF_W - 4, -27, 2.5);
      g.lineStyle(1, C.woodDark, 1).strokePoints(pts, true);
      leaf.add(g);
      leaf.setScale(-side, 1); // the right half (side 1) is the left one mirrored
      leaf.side = side;
      return leaf;
    });

    container.add([frame, hole, this.light, ...this.leaves]);
  }

  // The halves swing open (ms) onto the black doorway.
  open(ms = 600) {
    if (this.isOpen) return;
    this.isOpen = true;
    for (const leaf of this.leaves) this.scene.tweens.add({ targets: leaf, scaleX: -leaf.side * 0.12, duration: ms, ease: 'Quad.easeOut' });
  }

  // Shut again at once (no animation).
  close() {
    this.isOpen = false;
    for (const leaf of this.leaves) leaf.setScale(-leaf.side, 1);
  }
}
