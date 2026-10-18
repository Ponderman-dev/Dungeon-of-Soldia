import Phaser from 'phaser';
import floorArt from '../data/floorArt.json';

// The door in the back wall of every floor, drawn to match the stone wall (screen review, user): a stone arch of
// blocks with a keystone, and a dark wooden door of planks with iron bands. It is CLOSED during the fight; when the
// floor is cleared its two halves swing open onto a black doorway. `{ big: true }` = the squad screen's dungeon
// ENTRANCE: the same door much bigger, with a skull keystone, portcullis spikes, chains, claw marks, bones and red
// eyes in the dark when it opens. Built inside a container (the floor's) so it slides with the floor.
// x = the door's middle, baseY = the floor line under it. Sizes and colours: floorArt.json `door`.
const D = floorArt.door;
const C = Object.fromEntries(['stone', 'stoneLight', 'mortar', 'hole', 'wood', 'woodDark', 'woodLight', 'iron', 'rivet', 'dust', 'bone', 'eyes'].map((k) => [k, Number(D[k])]));
const A = D.anim;
const SKULL = [' ##### ', '#######', '#..#..#', '#..#..#', '###.###', ' ##### ', ' #.#.# '];

export default class Door {
  constructor(scene, container, x, baseY, { big = false } = {}) {
    const S = (this.size = big ? D.big : D.small);
    this.big = big;
    this.scene = scene;
    this.container = container;
    this.x = x;
    this.baseY = baseY;
    this.isOpen = false;
    this.fx = []; // dust bits still flying (gone on close)
    const { halfW, openH, archH, frameW } = S;
    const top = baseY - openH;
    const outW = halfW + frameW;
    // Top of the opening at dx from the middle (the arch curve).
    const archAt = (dx) => top - archH * Math.sqrt(Math.max(0, 1 - (dx / halfW) ** 2));

    // The stone arch: two jambs of blocks and a ring of wedge blocks over the top, a lighter keystone.
    const frame = scene.add.graphics();
    frame.fillStyle(C.stone, 1).fillRect(x - outW, top, outW * 2, openH).fillEllipse(x, top, outW * 2, (archH + frameW) * 2);
    frame.lineStyle(1, C.mortar, 1);
    for (let y = baseY - S.block, row = 0; y > top; y -= S.block, row++) {
      frame.lineBetween(x - outW, y, x - halfW, y);
      frame.lineBetween(x + halfW, y, x + outW, y);
      if (big) { // big blocks are split in two, every other row offset
        const mid = row % 2 ? frameW / 3 : (frameW * 2) / 3;
        frame.lineBetween(x - outW + mid, y, x - outW + mid, y + S.block);
        frame.lineBetween(x + halfW + mid, y, x + halfW + mid, y + S.block);
      }
    }
    for (let a = 180; a <= 360; a += big ? 20 : 30) {
      const r = Phaser.Math.DegToRad(a);
      frame.lineBetween(x + Math.cos(r) * halfW, top + Math.sin(r) * archH, x + Math.cos(r) * outW, top + Math.sin(r) * (archH + frameW));
    }
    const keyW = big ? 28 : 8;
    frame.fillStyle(C.stoneLight, 1).fillRect(x - keyW / 2, top - archH - frameW + 1, keyW, frameW + (big ? 6 : 0)); // keystone
    frame.fillRect(x - outW, top - 1, frameW, 2).fillRect(x + halfW, top - 1, frameW, 2); // where the arch meets the jambs
    frame.strokeRect(x - outW, top, outW * 2, openH);
    const hole = scene.add.graphics();
    hole.fillStyle(C.hole, 1).fillRect(x - halfW, top, halfW * 2, openH).fillEllipse(x, top, halfW * 2, archH * 2);
    // (kept so open/close work as before; the open doorway stays black)
    this.light = scene.add.graphics();
    // Red eyes that look out of the dark when the big door opens.
    this.eyes = scene.add.graphics().setAlpha(0);
    if (big) this.eyes.fillStyle(C.eyes, 1).fillRect(x - 9, top + 6, 4, 2).fillRect(x + 5, top + 6, 4, 2);

    // Two wooden door halves, each turning on its outer hinge (scaleX shrinks it towards the wall).
    this.leaves = [-1, 1].map((side) => {
      const leaf = scene.add.container(x + side * halfW, baseY);
      const g = scene.add.graphics();
      // Drawn as the LEFT half, hinge at x = 0, the middle of the doorway at x = halfW.
      const pts = [new Phaser.Math.Vector2(halfW, 0), new Phaser.Math.Vector2(0, 0), new Phaser.Math.Vector2(0, -openH)];
      for (let a = 180; a <= 270; a += 10) {
        const r = Phaser.Math.DegToRad(a);
        pts.push(new Phaser.Math.Vector2(halfW + Math.cos(r) * halfW, -openH + Math.sin(r) * archH));
      }
      const edge = (px) => Math.ceil(archAt(halfW - px) - baseY); // the leaf's top at px from the hinge
      g.fillStyle(C.wood, 1).fillPoints(pts, true);
      // Planks: dark seams, each plank lit on its left edge.
      for (let px = 0; px < halfW; px += S.plank) {
        g.fillStyle(C.woodDark, 1).fillRect(px, edge(px), 1, -edge(px));
        g.fillStyle(C.woodLight, 1).fillRect(px + 1, edge(px + 1) + 1, 1, -edge(px + 1) - 1);
      }
      // Iron bands with rivets, and a ring handle by the middle.
      const bandH = big ? 6 : 4;
      for (const by of S.bands) {
        g.fillStyle(C.iron, 1).fillRect(0, by, halfW, bandH);
        g.fillStyle(C.rivet, 1);
        for (let rx = 2; rx < halfW; rx += S.plank) g.fillRect(rx, by + bandH / 2 - 1, 2, 2);
      }
      g.lineStyle(big ? 2 : 1, C.rivet, 1).strokeCircle(halfW - (big ? 8 : 4), S.ring, big ? 5 : 2.5);
      if (big) {
        // Claw marks raked across the wood.
        g.lineStyle(1, C.woodDark, 1);
        for (let k = 0; k < 3; k++) g.lineBetween(8 + k * 5, -50 - k * 2, 20 + k * 5, -80 - k * 2);
      }
      g.lineStyle(1, C.woodDark, 1).strokePoints(pts, true);
      // A shadow over the half that grows as it turns away from the room's light.
      const shadow = scene.add.graphics();
      shadow.fillStyle(0x000000, 1).fillPoints(pts, true);
      shadow.setAlpha(0);
      leaf.add([g, shadow]);
      leaf.shadow = shadow;
      leaf.setScale(-side, 1); // the right half (side 1) is the left one mirrored
      leaf.side = side;
      return leaf;
    });

    container.add([frame, hole, this.light, this.eyes, ...this.leaves]);
    if (big) container.add(this.drawEntrance(top, outW, archAt));
  }

  // The big entrance's extras, in front of the door: portcullis spikes, a skull keystone, chains, bones.
  drawEntrance(top, outW, archAt) {
    const { x, baseY } = this;
    const S = this.size;
    const g = this.scene.add.graphics();
    // Portcullis spikes hanging under the arch (the gate itself is pulled up out of sight).
    for (let i = 0; i < S.teeth; i++) {
      const dx = -S.halfW + 8 + (i * (S.halfW * 2 - 16)) / (S.teeth - 1);
      const y0 = archAt(dx) - 2;
      g.fillStyle(C.iron, 1).fillRect(x + dx - 2, y0, 4, 10);
      g.fillTriangle(x + dx - 3, y0 + 10, x + dx + 3, y0 + 10, x + dx, y0 + 18);
      g.fillStyle(C.rivet, 1).fillRect(x + dx - 1, y0 + 1, 1, 8);
    }
    // The skull in the keystone.
    const p = S.skullPx;
    const sx = x - (SKULL[0].length * p) / 2;
    const sy = top - S.archH - S.frameW + 4;
    SKULL.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === ' ') return;
      g.fillStyle(ch === '#' ? C.bone : C.hole, 1).fillRect(sx + c * p, sy + r * p, p, p);
    }));
    // A chain on each side of the arch, ending in a shackle.
    for (const side of [-1, 1]) {
      const cx = x + side * (outW + 6);
      g.lineStyle(2, C.iron, 1);
      for (let k = 0; k < 7; k++) {
        const cy = top - 10 + k * 8;
        if (k % 2) g.strokeRect(cx - 1, cy, 2, 8);
        else g.strokeRect(cx - 3, cy, 6, 8);
      }
      g.lineStyle(2, C.rivet, 1).strokeCircle(cx, top + 52, 5);
    }
    // Bones on the floor at the foot of the gate.
    g.fillStyle(C.bone, 1);
    for (const [bx, by, w] of [[-outW - 20, 10, 14], [outW + 8, 16, 12], [outW + 14, 8, 10]]) {
      g.fillRect(x + bx, baseY + by, w, 2);
      g.fillRect(x + bx - 1, baseY + by - 1, 2, 4).fillRect(x + bx + w - 1, baseY + by - 1, 2, 4);
    }
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) if (!(r === 1 && (c === 1 || c === 3)) && !(r === 3 && c % 2 === 0)) g.fillRect(x - outW - 34 + c * 2, baseY + 2 + r * 2, 2, 2); // a little skull
    return g;
  }

  // It unlocks with a rattle, the heavy halves swing open (faster and faster, darker as they turn), slam into the
  // wall with a small bounce, a thud and dust. Timings: floorArt.json door.anim.
  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    const sc = this.scene;
    for (const leaf of this.leaves) {
      const home = leaf.x;
      sc.tweens.add({ targets: leaf, x: home + A.rattlePx * leaf.side, duration: A.rattleMs / (A.rattles * 2), yoyo: true, repeat: A.rattles - 1 });
      sc.tweens.add({
        targets: leaf,
        scaleX: -leaf.side * A.openScale,
        delay: A.rattleMs,
        duration: A.swingMs,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          leaf.x = home;
          sc.tweens.add({ targets: leaf, scaleX: -leaf.side * (A.openScale + A.bounce), duration: A.bounceMs / 2, yoyo: true, ease: 'Quad.easeOut' });
        },
      });
      sc.tweens.add({ targets: leaf.shadow, alpha: A.shadeAlpha, delay: A.rattleMs, duration: A.swingMs, ease: 'Cubic.easeIn' });
    }
    sc.time.delayedCall(A.rattleMs + A.swingMs, () => this.slam());
  }

  // The halves hit the wall: a thud shake, dust puffs at the foot of the door and dust falling from the arch.
  // The big entrance: a heavier thud, more dust, and red eyes blink in the dark and are gone.
  slam() {
    if (!this.isOpen || !this.container.active) return;
    const sc = this.scene;
    const S = this.size;
    const more = this.big ? S.dustMul : 1;
    sc.cameras.main.shake(A.shakeMs * (this.big ? 2 : 1), A.shakeIntensity * (this.big ? S.shakeMul : 1));
    const add = (o) => { this.container.add(o); this.fx.push(o); return o; };
    for (const side of [-1, 1]) {
      for (let i = 0; i < A.puffs * more; i++) {
        const c = add(sc.add.circle(this.x + side * (S.halfW + 2), this.baseY - 2, (3 + (i % 2) * 2) * (this.big ? 1.5 : 1), C.dust, 0.7));
        sc.tweens.add({ targets: c, x: c.x + side * (8 + i * 6), y: c.y - 4 - (i % 3) * 3, scale: 2, alpha: 0, duration: 450 + i * 60, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
      }
    }
    for (let i = 0; i < A.fallingDust * more; i++) {
      const top = this.baseY - S.openH - S.archH;
      const d = add(sc.add.rectangle(this.x + (Math.random() * 2 - 1) * (S.halfW + 6), top + Math.random() * 6, 2, 2, C.dust, 0.9));
      sc.tweens.add({ targets: d, y: d.y + 18 + Math.random() * 22 * more, alpha: 0, delay: Math.random() * 150, duration: 500 + Math.random() * 300, ease: 'Quad.easeIn', onComplete: () => d.destroy() });
    }
    if (this.big) {
      sc.tweens.add({ targets: this.eyes, alpha: 1, delay: 250, duration: 300 });
      sc.time.delayedCall(1000, () => this.isOpen && this.eyes.setAlpha(0)); // a blink
      sc.time.delayedCall(1090, () => this.isOpen && this.eyes.setAlpha(1));
      sc.tweens.add({ targets: this.eyes, alpha: 0, delay: 1500, duration: 400 });
    }
  }

  // Shut again at once (no animation).
  close() {
    this.isOpen = false;
    for (const leaf of this.leaves) {
      this.scene.tweens.killTweensOf([leaf, leaf.shadow]);
      leaf.setScale(-leaf.side, 1);
      leaf.shadow.setAlpha(0);
    }
    this.scene.tweens.killTweensOf(this.eyes);
    this.eyes.setAlpha(0);
    for (const o of this.fx) if (o.active) o.destroy();
    this.fx = [];
  }
}
