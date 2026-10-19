import Phaser from 'phaser';
import floorArt from '../data/floorArt.json';
import * as sfx from '../audio/sfx.js';
import { doorArtLayers } from '../systems/doorArt.js';
import { layerTexture } from './pixelLayer.js';

const P = floorArt.pixel;


// The door in the back wall of every floor, drawn to match the stone wall (screen review, user): a stone arch of
// blocks with a keystone, and a dark wooden door of planks with iron bands. It is CLOSED during the fight; when the
// floor is cleared its two halves swing open onto a black doorway. `{ big: true }` = the squad screen's dungeon
// ENTRANCE: the same door much bigger, with a skull keystone, portcullis spikes, chains, claw marks, bones and red
// eyes in the dark when it opens. Built inside a container (the floor's) so it slides with the floor.
// x = the door's middle, baseY = the floor line under it. Sizes and colours: floorArt.json `door`.
const D = floorArt.door;
const C = Object.fromEntries(['stone', 'stoneLight', 'mortar', 'hole', 'wood', 'woodDark', 'woodLight', 'iron', 'rivet', 'dust', 'bone', 'eyes'].map((k) => [k, Number(D[k])]));
const A = D.anim;

export default class Door {
  constructor(scene, container, x, baseY, { big = false } = {}) {
    // The art is pixel art at the floor's pixel size (systems/doorArt.js); sizes here are screen pixels for the
    // animation (dust, rattle) = art pixels x P.
    const L = doorArtLayers(D, big);
    const S = (this.size = { ...(big ? D.big : D.small), halfW: L.size.halfW * P, openH: L.size.openH * P, archH: L.size.archH * P, frameW: L.size.frameW * P });
    this.big = big;
    this.scene = scene;
    this.container = container;
    this.x = x;
    this.baseY = baseY;
    this.isOpen = false;
    this.fx = []; // dust bits still flying (gone on close)
    const kind = big ? 'big' : 'small';
    const image = (lay, name) => scene.add.image(x, baseY, layerTexture(scene, `door-${kind}-${name}`, lay)).setOrigin(lay.ax / lay.w, lay.ay / lay.h).setScale(P);
    const frame = image(L.frame, 'frame');
    const hole = image(L.hole, 'hole');
    // (kept so open/close work as before; the open doorway stays black)
    this.light = scene.add.graphics();
    // Red eyes that look out of the dark when the big door opens (pixel-sized).
    this.eyes = scene.add.graphics().setAlpha(0);
    if (big) this.eyes.fillStyle(C.eyes, 1).fillRect(x - 5 * P, baseY + (8 - L.size.openH) * P, 2 * P, P).fillRect(x + 3 * P, baseY + (8 - L.size.openH) * P, 2 * P, P);

    // Two wooden door halves, each turning on its outer hinge (scaleX shrinks it towards the wall).
    const leafKey = layerTexture(scene, `door-${kind}-leaf`, L.leaf);
    this.leaves = [-1, 1].map((side) => {
      const leaf = scene.add.container(x + side * S.halfW, baseY);
      const g = scene.add.image(0, 0, leafKey).setOrigin(0, 1).setScale(P);
      // A shadow over the half that grows as it turns away from the room's light.
      const shadow = scene.add.image(0, 0, leafKey).setOrigin(0, 1).setScale(P).setTint(0x000000).setTintMode(Phaser.TintModes.FILL).setAlpha(0);
      leaf.add([g, shadow]);
      leaf.shadow = shadow;
      leaf.setScale(-side, 1); // the right half (side 1) is the left one mirrored
      leaf.side = side;
      return leaf;
    });

    container.add([frame, hole, this.light, this.eyes, ...this.leaves]);
    if (big) container.add(image(L.extras, 'extras')); // skull keystone, chains, bones
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
      sfx.play('gateSlam'); // a deep THUMP when the entrance slams open
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
