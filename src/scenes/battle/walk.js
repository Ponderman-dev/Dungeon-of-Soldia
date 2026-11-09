// Part of BattleScene (mixed into its prototype at the bottom of ../BattleScene.js; `this` is the scene).
// Walking between floors: heroes walk in, walk to the door, the floor slides (docs/systems/floors-rooms.md).
import Phaser from 'phaser';
import { GAME_HEIGHT, CHAR_SCALE } from '../../config.js';
import { DEMO } from '../demoMode.js';
import * as sfx from '../../audio/sfx.js';
import { SLOT_Y, WALL_H, DOOR_X, T, DEPTH } from './shared.js';

export const walkMethods = {
  // Who walks through the door with the squad: the living heroes, then any greater minions.
  livingHeroViews() {
    const heroes = this.state.heroes.filter((h) => h.alive).map((h) => this.views.get(h.uid));
    const greater = this.state.minions.filter((m) => m.greater && m.alive).map((m) => this.views.get(m.uid)).filter(Boolean);
    return [...heroes, ...greater];
  },

  // One hero walks along a path of points at a steady pace, hopping with each step.
  // The further up the screen, the smaller the hero (perspective). Heroes lower on the
  // screen are drawn in front of heroes higher up.
  walkPath(view, points, { delay, onDone, fadeLastPx = 0 }) {
    const ch = view.ch;
    const lengths = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const len = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      lengths.push(len);
      total += len;
    }
    const doorY = WALL_H - 10;
    const scaleAt = (y) => Phaser.Math.Clamp(CHAR_SCALE * (0.5 + 0.5 * ((y - doorY) / (SLOT_Y - doorY))), CHAR_SCALE * 0.5, CHAR_SCALE * 1.3);

    this.tweens.addCounter({
      from: 0,
      to: 1,
      delay,
      duration: (total / T.walkSpeedPxPerSec) * 1000,
      ease: 'Linear',
      onStart: () => this.setBarsVisible(view, false), // bars and dots would clutter the line
      onUpdate: (tween) => {
        let d = tween.getValue() * total;
        let i = 0;
        while (i < lengths.length - 1 && d > lengths[i]) d -= lengths[i++];
        const t = lengths[i] ? d / lengths[i] : 1;
        const x = points[i].x + (points[i + 1].x - points[i].x) * t;
        const y = points[i].y + (points[i + 1].y - points[i].y) * t;
        const walked = tween.getValue() * total;
        ch.x = x;
        ch.y = y - Math.abs(Math.sin((walked / T.stepLenPx) * Math.PI)) * T.stepHeight; // the hop
        const step = Math.floor(walked / T.stepLenPx);
        if (step !== view.lastStep) { view.lastStep = step; if (step > 0 && ch.alpha > 0.3) sfx.play('step'); } // a footstep each landing
        ch.setScale(scaleAt(y));
        ch.setDepth(DEPTH.hero + y / 10000);
        if (fadeLastPx) { // stepping through the door: the hero goes dark in the doorway's shadow, then fades out
          const k = Phaser.Math.Clamp((total - walked) / fadeLastPx, 0, 1);
          ch.setWash(0x000000, Math.round((1 - k) * T.doorDarken * 10) / 10);
          ch.setAlpha(Phaser.Math.Clamp(k * T.doorFadeLate, 0, 1));
        }
      },
      onComplete: () => {
        const last = points[points.length - 1];
        ch.setPosition(last.x, last.y);
        ch.setScale(scaleAt(last.y));
        onDone();
      },
    });
  },

  // Delay before the nth hero starts, so the heroes keep a gap of lineGapPx in the line.
  lineDelay(i) {
    return (i * T.lineGapPx * 1000) / T.walkSpeedPxPerSec;
  },

  // Heroes come up from below the screen in a line at the centre, then fan out to their slots.
  enterHeroes(done) {
    const living = this.livingHeroViews();
    let left = living.length;
    if (!left) return done();
    living.forEach((v, i) => {
      v.ch.setScale(CHAR_SCALE).setAlpha(1).setVisible(true).setPosition(DOOR_X, GAME_HEIGHT + 90);
      v.ch.setWash(0x000000, 0); // out of the last doorway's shadow
      this.drawMoraleWash(); // (and the morale wash back on)
      this.setBarsVisible(v, false);
      this.walkPath(
        v,
        [
          { x: DOOR_X, y: GAME_HEIGHT + 90 },
          { x: DOOR_X, y: (v.slotY ?? SLOT_Y) + 70 },
          { x: v.slotX, y: v.slotY ?? SLOT_Y },
        ],
        {
          delay: this.lineDelay(i),
          onDone: () => {
            v.ch.setScale(CHAR_SCALE).setDepth(DEPTH.hero);
            v.ch.homeX = v.slotX;
            v.ch.homeY = v.slotY ?? SLOT_Y;
            this.setBarsVisible(v, true);
            this.syncBar(v);
            if (--left === 0) done();
          },
        },
      );
    });
  },

  // Heroes gather into a line at the centre and walk into the door one after another.
  // Heroes in the outer slots have further to walk to reach the line, so each start delay is
  // worked out from when that hero reaches the line. That keeps the gaps in the line equal.
  heroesWalkToDoor(done) {
    const living = this.livingHeroViews();
    let left = living.length;
    if (!left) return done();
    const gather = { x: DOOR_X, y: SLOT_Y - 120 };
    const toLine = living.map((v) => Math.hypot(gather.x - v.slotX, gather.y - (v.slotY ?? SLOT_Y)));
    const base = Math.max(...toLine.map((len, i) => len - i * T.lineGapPx));
    living.forEach((v, i) => {
      this.walkPath(
        v,
        [{ x: v.slotX, y: v.slotY ?? SLOT_Y }, gather, { x: DOOR_X, y: WALL_H - 10 }],
        {
          fadeLastPx: T.doorFadePx,
          delay: ((base - toLine[i] + i * T.lineGapPx) * 1000) / T.walkSpeedPxPerSec,
          onDone: () => {
            v.ch.setVisible(false);
            if (--left === 0) done();
          },
        },
      );
    });
  },

  // The camera slides up: the old floor drops away and the new floor comes in from above.
  slideToNextFloor(done) {
    const old = this.layer;
    if (DEMO !== 'brood') this.floor += 1; // the Brood Mother demo page: floor 40 again and again
    const next = this.buildFloor(this.floor, -GAME_HEIGHT);
    this.tweens.add({ targets: [old.container, old.front], y: GAME_HEIGHT, duration: T.slideMs, ease: 'Sine.easeInOut' });
    this.tweens.add({
      targets: [next.container, next.front],
      y: 0,
      duration: T.slideMs,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        old.container.destroy();
        old.front.destroy();
        this.layer = next;
        this.floorText.setText(`Floor ${this.floor}`);
        done();
      },
    });
  },
};
