import Phaser from 'phaser';
import { CHAR_SCALE } from '../config.js';
import { partArt, artSize, partAnchor, artPixels, mixColor, artKey } from '../systems/pixelArt.js';
import { samplePose } from '../systems/animClips.js';
import { iceColor } from '../systems/statusFx.js';

// A character built from separate parts (body, head, weapon...), described by JSON data.
// Each part is a small pixel picture (`art`, drawn in the Character Studio) or, until it is drawn,
// a plain block. Position (0, 0) is the character's feet; negative y goes up.
//
// `this.parts[name]` is a light "pose" object (x, y, angle) that the tweens move; the part's image
// copies it every frame just before drawing (smooth animation; the pixels themselves stay crisp).
//
// KEYFRAME CLIPS (`def.anims`, made on the studio timeline) are added on top of that pose. Each action
// uses its clip when the character has one, else the built-in motion: idle, attack (swing), windup /
// skillAttack / skillSupport (skills), walk (while moving), hurt (when hit), death. Only the most
// important clip running plays: death > hurt > action (attack, skill, victory) > stunned > walk > idle.
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
    this.anims = def.anims || {};
    this.action = null; // { id, start, dur, hold } an attack or skill clip running
    this.hurtAt = null;
    this.deathAt = null;
    this.walking = false;
    this.idleStart = 0;
    this.idleFrozenAt = null;
    this.override = null; // studio: { clip, t } shows one clip at one time

    for (const [name, p] of Object.entries(def.parts)) {
      const art = partArt(p);
      const { w, h } = artSize(art);
      const [ax, ay] = partAnchor(p, art);
      // The pose: x / y = the turning point (anchor), in character pixels.
      const x = p.x - w / 2 + ax;
      const y = p.y - h / 2 + ay;
      const image = scene.add.image(x, y, '__DEFAULT');
      if (def.alpha) image.setAlpha(def.alpha); // see-through characters (Ghost)
      const part = {
        name, x, y, angle: 0, restX: x, restY: y, restAngle: 0,
        width: w, height: h, originX: ax / w, originY: ay / h,
        pixels: artPixels(art), anchor: [ax, ay], key: artKey(art), image,
        wash: null, look: null, shown: null, top0: p.y - h / 2,
      };
      this.parts[name] = part;
      this.add(image);
    }

    this.setScale(def.drawScale ?? CHAR_SCALE); // bosses are drawn with finer pixels (drawScale 2)
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
    }
    const pose = this.clipPose();
    for (const part of Object.values(this.parts)) {
      const o = pose[part.name];
      part.image.x = part.x + (o ? o.x : 0);
      part.image.y = part.y + (o ? o.y : 0);
      part.image.angle = part.angle + (o ? o.angle : 0);
    }
  }

  // ---- keyframe clips ---------------------------------------------------------------------------

  // The offsets of the clip that is playing right now (see the top of this file).
  clipPose() {
    if (this.override) return samplePose(this.override.clip, this.override.t);
    const now = this.now();
    const A = this.anims;
    // A one-shot clip `dur` ms long: time inside the clip, or null when it is over.
    const shot = (id, start, dur, hold) => {
      const clip = A[id];
      if (!clip || start === null) return null;
      const p = (now - start) / Math.max(1, dur);
      if (p >= 1 && !hold) return null;
      return samplePose(clip, Math.min(1, p) * clip.length);
    };
    if (this.deathAt !== null && A.death) return shot('death', this.deathAt, A.death.length, true);
    if (this.heldPose) return this.heldPose; // stuck inside an icicle (encase)
    const hurt = A.hurt && shot('hurt', this.hurtAt, A.hurt.length, false);
    if (hurt) return hurt;
    if (this.action) {
      const pose = shot(this.action.id, this.action.start, this.action.dur, this.action.hold);
      if (pose) return pose;
      this.action = null;
    }
    const loop = (clip, start) => samplePose(clip, (((now - start) % clip.length) + clip.length) % clip.length);
    if (this.stunned && A.stunned) return loop(A.stunned, 0);
    if (this.walking && A.walk) return loop(A.walk, 0);
    if (A.idle) return samplePose(A.idle, ((this.idleFrozenAt ?? now) - this.idleStart) % A.idle.length);
    return {};
  }

  // The clock clips run on. A scene can give its own (the studio's slow motion: scene.clipNow()).
  now() {
    return this.scene.clipNow ? this.scene.clipNow() : this.scene.time.now;
  }

  // Starts an action clip (if the character has it). dur = how long it should take (ms), stretched.
  playClip(id, dur, hold = false) {
    const clip = this.anims[id];
    if (!clip) return false;
    this.action = { id, start: this.now(), dur: dur ?? clip.length, hold };
    return true;
  }

  // Studio: show `clip` frozen at time t (null = back to normal).
  showClip(clip, t) {
    this.override = clip ? { clip, t } : null;
    this.syncParts();
  }

  // Took a hit: a short flinch (only with a hurt clip).
  hurt() {
    if (this.anims.hurt && this.deathAt === null) this.hurtAt = this.now();
  }

  // Fell: plays the death clip and keeps its last pose (without one: just stops moving).
  die() {
    this.freeze();
    this.action = null;
    if (this.anims.death) this.deathAt = this.now();
  }

  // Walking (the battle tells it each frame): plays the walk clip on top of the hop.
  setWalking(on) {
    this.walking = on;
  }

  // Stunned or frozen (the battle tells it each frame): plays the stunned clip (dizzy loop).
  setStunned(on) {
    this.stunned = on;
  }

  // Frozen Demon Head: stuck inside an icicle, the character holds its current pose (no idle, no dizzy loop).
  encase(on) {
    this.heldPose = on ? this.clipPose() : null;
    for (const t of this.idleTweens) (on ? t.pause() : t.resume());
  }

  // A floor was won: the victory clip (if it has one).
  cheer() {
    this.playClip('victory');
  }

  // The texture of a part's picture (washed in a colour if needed), made once and shared.
  texture(part) {
    const wash = part.wash ? `${part.wash.color.toString(16)}-${Math.round(part.wash.amount * 100)}` : '';
    const look = part.look ? `-${part.look.tint ? part.look.tint[0].toString(16) + '-' + Math.round(part.look.tint[1] * 100) : ''}-i${Math.round(part.look.ice * 100)}` : '';
    const key = `px-${part.key}-${wash}${look}`;
    const iceCut = part.look && part.look.ice > 0 ? -part.look.ice * ((this.def.height || 24) + 2) : Infinity;
    const textures = this.scene.textures;
    if (!textures.exists(key)) {
      const tex = textures.createCanvas(key, part.width, part.height);
      const ctx = tex.context;
      part.pixels.forEach((row, y) =>
        row.forEach((c, x) => {
          if (c === null) return;
          let col = part.top0 + y + 1 > iceCut ? iceColor(c) : c; // Freeze: ice climbs up from the feet
          if (part.look && part.look.tint) col = mixColor(col, part.look.tint[0], part.look.tint[1]);
          if (part.wash) col = mixColor(col, part.wash.color, part.wash.amount);
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
    this.idleStart = this.now();
    this.idleFrozenAt = null;
    if (this.anims.idle) return; // the idle clip does it
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
    this.stopAttack();
    this.castReset();
    if (this.playClip('windup', ms, true)) return; // held at its end until the release
    const w = this.parts.weapon;
    this.castTweens = [this.scene.tweens.add({ targets: this, castLift: -4, duration: ms, ease: 'Quad.easeOut' })];
    if (w) this.castTweens.push(this.scene.tweens.add({ targets: w, angle: w.restAngle - 55, duration: ms, ease: 'Quad.easeOut' })); // cocked back
  }

  // The skill goes off. Attack skill: a big overhead slash with a leap forward. Support skill: it
  // jumps up with the weapon held high, then settles.
  castRelease(kind) {
    this.stopAttack();
    this.castReset(true);
    if (this.playClip(kind === 'attack' ? 'skillAttack' : 'skillSupport')) {
      // The clip starts from its own crouch / cocked pose: drop the built-in wind-up pose.
      if (this.parts.weapon) this.parts.weapon.angle = this.parts.weapon.restAngle;
      this.castLift = 0;
      return;
    }
    if (this.action && this.action.id === 'windup') this.action = null;
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
    if (this.action && this.action.id === 'windup') this.action = null;
    const w = this.parts.weapon;
    if (w) this.scene.tweens.add({ targets: w, angle: w.restAngle, duration: 150 });
    this.scene.tweens.add({ targets: this, castLift: 0, duration: 150 });
  }

  // A skill cuts the normal attack short (user: the hero stops its swing and starts the skill at once).
  stopAttack() {
    if (this.action && this.action.id === 'attack') this.action = null;
    if (this.swingTween) {
      this.swingTween.stop();
      this.swingTween = null;
      if (this.parts.weapon) this.parts.weapon.angle = this.parts.weapon.restAngle;
    }
    if (this.lungeTween) {
      this.lungeTween.stop();
      this.lungeTween = null;
      this.lunging = false;
      this.x = this.homeX;
      this.y = this.homeY;
    }
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

  // What its statuses do to the whole sprite: tint = [colour, amount] (mixed over every pixel) and
  // ice = 0..1 (Freeze: how far up from the feet the sprite has turned to ice). See systems/statusFx.js.
  setStatusLook(tint, ice = 0) {
    // Tint strength in 10% steps: every step is its own cached texture per part, finer steps only made more of them.
    if (tint) { const amount = Math.round(tint[1] * 10) / 10; tint = amount > 0 ? [tint[0], amount] : null; }
    const look = tint || ice > 0 ? { tint, ice } : null;
    const sig = look ? `${tint ? tint.join('-') : ''}-${ice}` : '';
    if (sig === this.lookSig) return;
    this.lookSig = sig;
    for (const part of Object.values(this.parts)) part.look = look;
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
    if (this.idleFrozenAt === null) this.idleFrozenAt = this.now(); // the idle clip holds too
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
    this.walking = true;
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
        this.walking = false;
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
    this.walking = false;
    this.y += this.hopOffset; // stopped mid-hop: land
    this.hopOffset = 0;
  }

  // Swings the weapon part (if there is one) down and back up again.
  swing(duration) {
    // An attack clip with a "hit" marker (`hitAt`) is stretched so the marker lands as the hit lands
    // (the part after it plays as follow-through); without one the whole clip fits the swing time.
    const atk = this.anims.attack;
    if (atk && atk.hitAt) duration = (duration * atk.length) / atk.hitAt;
    if (this.playClip('attack', duration)) return;
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
