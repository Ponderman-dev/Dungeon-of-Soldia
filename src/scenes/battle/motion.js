// Part of BattleScene (mixed into its prototype at the bottom of ../BattleScene.js; `this` is the scene).
// How attacks and skills move: run-ups, arrows, flasks, projectiles, leaps, dashes, skill looks (docs/systems/skills.md, effects.md).
import Phaser from 'phaser';
import { GAME_WIDTH, CHAR_SCALE, UI } from '../../config.js';
import combatRules from '../../data/combat.json';
import * as sfx from '../../audio/sfx.js';
import * as itemFx from '../../systems/itemFx.js';
import { castFx, shotFx, CAST_MS, SHOT_MS } from '../../systems/skillFx.js';
import { M, FX, DASH_BY_NAME, SKILL_FX_BY_NAME, LOOK_BY_NAME, charScale, DEPTH } from './shared.js';

export const motionMethods = {
  // ---- hero attack motion (melee run-up, arrows) --------------------------------------------

  // A hero walks back to its slot after a win, at the normal walking speed.
  runHome(v) {
    if (!v) return;
    v.ch.y += v.ch.hopOffset; // land first if it was mid-hop
    v.ch.hopOffset = 0;
    const dist = Math.hypot(v.ch.homeX - v.ch.x, v.ch.homeY - v.ch.y);
    if (dist < 1) return;
    v.ch.moveTo(v.ch.homeX, v.ch.homeY, (dist / combatRules.movement.walkSpeedPxPerSec) * 1000, {
      hop: { height: M.hopHeight, length: M.hopLengthPx },
      onUpdate: () => this.syncBar(v),
      onDone: () => {
        if (v.unit.side === 'hero') v.ch.setDepth(DEPTH.hero);
        this.syncBar(v);
      },
    });
  },

  // A ranged fighter's basic attack: an arrow that flies to the target and arrives as the hit lands.
  // The middle of a fighter's body right now (where shots aim): above its feet, wherever it stands.
  center(v) {
    return { x: v.ch.x, y: v.ch.y + v.ch.hopOffset - (v.unit.def.height * v.ch.scaleY) / 2 };
  },

  shootArrow(a, t, hitInMs) {
    const from = this.center(a);
    // A new shot before the last one landed (fast attacks): the old one goes (bug: it was never removed, piling up
    // floor after floor, and its landing removed the NEW shot mid-flight).
    this.landArrow(a);
    // The shot itself is drawn in pixels by drawHitFx() (its look per damage type: systems/hitFx.js);
    // this empty container only carries its position along the flight.
    const arrow = this.add.container(from.x, from.y);
    arrow.kind = a.unit.hitType || a.unit.damageType; // an elite archer shoots its element
    if (a.unit.specials && a.unit.specials.demonHead && ['fire', 'electric', 'dark'].includes(arrow.kind)) arrow.kind = 'ice'; // Frozen Demon Head: its shots are ice
    a.arrow = arrow;
    this.flyArrow(a, arrow, t, hitInMs);
    a.ch.shoot(); // weapon kick + lean back (works wherever it stands)
  },

  // Flies an arrow from where it is now to a target (which may move), arriving after `ms`.
  // Called again with a new target if the old one dies while the arrow is in the air.
  flyArrow(a, arrow, t, ms) {
    if (arrow.flight) arrow.flight.stop();
    const fromX = arrow.x;
    const fromY = arrow.y;
    arrow.startX = fromX; // the trail points back along the flight
    arrow.startY = fromY;
    arrow.flight = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: Math.max(1, ms),
      onUpdate: (tween) => {
        const p = tween.getValue();
        const to = this.center(t); // aims at where the target is NOW, so it always hits
        arrow.setPosition(fromX + (to.x - fromX) * p, fromY + (to.y - fromY) * p);
        arrow.rotation = Math.atan2(to.y - fromY, to.x - fromX);
      },
      onComplete: () => { if (a.arrow === arrow) this.landArrow(a); },
    });
  },

  // The arrow is used up (it hit, or it was cancelled).
  landArrow(a) {
    if (!a.arrow) return;
    if (a.arrow.flight) a.arrow.flight.stop();
    a.arrow.destroy();
    a.arrow = null;
  },

  // Placeholder projectiles: a fire bomb flies to its target (and follows it), lightning is a zig-zag
  // line between the two fighters (drawn where they stand now) that fades.
  // A flask lobbed in an arc from the thrower to the target, in the flask's colour.
  showFlask(from, to, color, look = null) {
    if (!from || !to) return;
    // A pixel flask lobbed over that splashes in its colour (systems/skillFx.js); it aims at where the target is NOW.
    const a = this.fxPoint(from);
    let b = this.fxPoint(to);
    const seed = (this.impactSeed = (this.impactSeed || 0) + 1);
    const kind = look && SHOT_MS[look] ? look : 'flask'; // a bandage roll / aid kit has its own look (lands as a heal)
    this.addFx(SHOT_MS[kind], (q, now) => { if (to.ch.active) b = this.fxPoint(to); return shotFx(kind, q, a, b, now, seed, color); }, ['shot', kind]);
    if (kind === 'flask') this.time.delayedCall(SHOT_MS.flask / 2, () => sfx.play('flaskBreak')); // the glass breaks as it lands (half-way)
  },


  // Alchemist's basic attack (Lobbed Shots): the flask recipe lobs over in the first half, so it runs twice the
  // flight time and lands as the hit does.
  lobFlask(from, to, hitInMs, color) {
    const a = this.fxPoint(from);
    let b = this.fxPoint(to);
    const seed = (this.impactSeed = (this.impactSeed || 0) + 1);
    this.addFx(Math.max(200, hitInMs * 2), (q, now) => { if (to.ch.active) b = this.fxPoint(to); return shotFx('flask', q, a, b, now, seed, color); }, ['shot', 'flask']);
    this.time.delayedCall(Math.max(100, hitInMs), () => sfx.play('flaskBreak'));
    from.ch.shoot();
  },

  showProjectile(from, to, kind, ms) {
    if (!from || !to) return;
    if (kind === 'arrow') return this.shootArrow(from, to, ms || 200); // Quiver of Plenty's extra arrow: a normal shot (it lands with its hit)
    const start = this.center(from);
    // Skill shots in pixels (systems/skillFx.js); they aim at where the target is NOW.
    if (SHOT_MS[kind] || kind === 'crescent') {
      if (kind === 'crescent') return; // Wind Cutter: the cast effect sweeps one crescent over the whole line
      const a = this.fxPoint(from);
      let b = this.fxPoint(to);
      const seed = (this.impactSeed = (this.impactSeed || 0) + 1);
      this.addFx(SHOT_MS[kind], (q, now) => { if (to.ch.active) b = this.fxPoint(to); return shotFx(kind, q, a, b, now, seed); }, ['shot', kind]);
      return;
    }
    // Pixel looks from systems/itemFx.js: Fire Bombs' bomb, lightning bolts (Static Crystal, Chain Lightning),
    // the Grimoire's green ghost fire. They aim at where the target is NOW.
    if (itemFx.BOMB_KINDS[kind]) { // Fire / Ice / Electric / Dark / Poison bombs: the same bomb in their element's colours
      const a = this.fxPoint(from);
      let b = this.fxPoint(to);
      const seed = (this.impactSeed = (this.impactSeed || 0) + 1);
      this.addFx(itemFx.ITEM_MS.bomb, (q, now) => { if (to.ch.active) b = this.fxPoint(to); return itemFx.bombFx(q, a, b, now, seed, itemFx.BOMB_KINDS[kind]); }, ['item', 'bomb']);
      return;
    }
    if (kind === 'lightning' || kind === 'greenfire' || kind === 'moon' || kind === 'spiritfire') {
      const a = this.fxPoint(from);
      let b = this.fxPoint(to);
      const seed = (this.impactSeed = (this.impactSeed || 0) + 1);
      const fn = { lightning: itemFx.lightningFx, greenfire: itemFx.greenfireFx, moon: itemFx.moonFx, spiritfire: itemFx.spiritFireFx }[kind];
      this.addFx(itemFx.ITEM_MS[kind], (q, now) => { if (to.ch.active) b = this.fxPoint(to); return fn(q, a, b, now, seed); }, ['item', kind]);
      return;
    }
    const b = this.add.circle(start.x, start.y, 5, 0xff7a3d).setStrokeStyle(2, 0xffd24d).setDepth(DEPTH.popup);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 280,
      onUpdate: (tween) => {
        const p = tween.getValue();
        const now = this.center(to); // follows the target, so the bomb always lands on it
        b.setPosition(start.x + (now.x - start.x) * p, start.y + (now.y - start.y) * p - Math.sin(p * Math.PI) * 24);
      },
      onComplete: () => b.destroy(),
    }); // any other kind: a plain orange ball (fallback)
  },

  // Floating number above a fighter.
  // Savage Leap: the hero jumps at the target in an arc and lands back in his spot.
  // With `S` (combat.json skillFx.look.brawl_leap.leap) it is the v2 SLAM: up fast and high (liftPx), hangs, slams down
  // at upMs, holds holdMs, comes back in backMs.
  leapAt(caster, target, S = null, from = null) {
    if (!target) return;
    if (from) { // the rules already put him where he lands (skills.json staysAtImpact): fly over from where he was, stay there
      const u = caster.unit, ox = from.x - u.x, oy = from.y - u.y, lift = S ? S.liftPx : 26, j = { p: 0 };
      const setF = () => {
        caster.leapX = ox * (1 - j.p);
        caster.leapY = oy * (1 - j.p);
        caster.leapLift = S ? Math.sin(Math.pow(j.p, 0.6) * Math.PI) * lift : Math.sin(j.p * Math.PI) * 26;
      };
      setF();
      this.tweens.add({ targets: j, p: 1, duration: S ? S.upMs : 230, ease: S ? 'Linear' : 'Quad.easeOut', onUpdate: setF, onComplete: () => { caster.leapX = caster.leapY = caster.leapLift = 0; } });
      return;
    }
    const share = S ? S.share : 0.8;
    const dx = (target.ch.x - caster.ch.x) * share;
    const dy = (target.ch.y - caster.ch.y) * share;
    const jump = { p: 0 }, lift = S ? S.liftPx : 26;
    let going = true;
    const set = () => {
      caster.leapX = dx * jump.p;
      caster.leapY = dy * jump.p;
      // the slam: the peak comes early and the fall is quick; no lift on the way back
      caster.leapLift = S ? (going ? Math.sin(Math.pow(jump.p, 0.6) * Math.PI) * lift : 0) : Math.sin(jump.p * Math.PI) * 26;
    };
    const back = () => { going = false; this.tweens.add({ targets: jump, p: 0, duration: S ? S.backMs : 300, delay: S ? S.holdMs : 120, ease: 'Quad.easeInOut', onUpdate: set, onComplete: () => { caster.leapX = caster.leapY = caster.leapLift = 0; } }); };
    this.tweens.add({ targets: jump, p: 1, duration: S ? S.upMs : 230, ease: S ? 'Linear' : 'Quad.easeOut', onUpdate: set, onComplete: back });
  },

  // How a v2 skill look moves the scene (combat.json skillFx.look): the leap slam or a recoil, then at the hit (hitMs)
  // the shake, the hit-stop and the hit enemies jittering. Also notes where Savage Leap lands (for its look).
  lookMoves(caster, e, L) {
    const t0 = e.targets[0] && this.views.get(e.targets[0].uid);
    if (L.leap && t0) {
      const a = this.fxBody(caster), b = this.fxBody(t0); // before the leap: he is still drawn where he takes off
      this.leapAt(caster, t0, L.leap, e.moved);
      e.land = e.moved ? { x: a.x + (e.unit.x - e.moved.x) / CHAR_SCALE, y: a.y + (e.unit.y - e.moved.y) / CHAR_SCALE } // where the rules put him
        : { x: a.x + (b.x - a.x) * L.leap.share, y: a.y + (b.y - a.y) * L.leap.share }; // where he lands: it never moves
    }
    if (L.move && L.move.type === 'recoil') {
      const to = t0 ? t0.ch : { x: caster.ch.x, y: caster.ch.y - 100 }; // no target: rock back down (enemies are above)
      const dx = caster.ch.x - to.x, dy = caster.ch.y - to.y, len = Math.hypot(dx, dy) || 1, r = { p: 0 };
      const set = () => { caster.leapX = (dx / len) * L.move.px * r.p; caster.leapY = (dy / len) * L.move.px * r.p; };
      this.tweens.add({ targets: r, p: 1, duration: 50, ease: 'Quad.easeOut', onUpdate: set,
        onComplete: () => this.tweens.add({ targets: r, p: 0, duration: 270, ease: 'Quad.easeOut', onUpdate: set, onComplete: () => { caster.leapX = caster.leapY = 0; } }) });
    }
    const hitViews = e.targets.filter((u) => u.side === 'enemy').map((u) => this.views.get(u.uid)).filter(Boolean);
    const radius = (L.leap ? L.landSplash && L.landSplash.radius : 0) || 0;
    if (L.leap && radius && e.land) for (const en of this.state.enemies) { // everyone in the landing area is thrown back too
      const v = en.alive && this.views.get(en.uid); if (!v || hitViews.includes(v)) continue;
      const b = this.fxBody(v); if (Math.hypot(b.x - e.land.x, (b.y - e.land.y) * 1.4) * CHAR_SCALE <= radius) hitViews.push(v);
    }
    this.time.delayedCall(L.hitMs || 0, () => {
      if (L.shakeMs) this.cameras.main.shake(L.shakeMs, L.shakeIntensity);
      if (L.stopMs) this.hitStop = Math.max(this.hitStop || 0, L.stopMs);
      hitViews.forEach((v, i) => {
        if (L.leap && L.leap.knockPx && e.land) this.knockFrom(v, e.land, L.leap.knockPx);
        else if (L.jitterPx) this.time.delayedCall((L.staggerMs || 0) * i, () => this.jitter(v, L.jitterPx, L.jitterMs));
      });
    });
  },

  // A melee basic attack steps in to the target (combat.json attackMotion.meleeStep): the fighter stands at reach, so
  // its view moves towards the target, arrives as the hit lands, holds, then steps back. Rules position unchanged.
  stepIn(a, t, hitInMs) {
    const S = combatRules.attackMotion.meleeStep;
    const u = a.unit, o = t.unit;
    if (!S || !S.sides.includes(u.side) || u.x == null || o.x == null) return;
    const dx = o.x - u.x, dy = o.y - u.y, len = Math.hypot(dx, dy) || 1;
    const k = ((u.size || 1) + (o.size || 1)) / 2;
    const px = Phaser.Math.Clamp(len - S.contactPx * k, 0, S.maxPx);
    if (px < 2) return;
    if (a.stepTween) a.stepTween.stop();
    const st = { p: 0 };
    const set = () => { if (a.ch.active) { a.stepX = (dx / len) * px * st.p; a.stepY = (dy / len) * px * st.p; } };
    a.stepTween = this.tweens.add({ targets: st, p: 1, duration: Math.max(60, hitInMs), ease: 'Quad.easeIn', onUpdate: set,
      onComplete: () => { a.stepTween = this.tweens.add({ targets: st, p: 0, delay: S.holdMs, duration: S.backMs, ease: 'Quad.easeOut', onUpdate: set,
        onComplete: () => { a.stepX = a.stepY = 0; a.stepTween = null; } }); } });
  },

  // A skill starts: a melee step-in that is still going stops, and the fighter is back on its spot at once.
  stopStep(a) {
    if (!a || !a.stepTween) return;
    a.stepTween.stop();
    a.stepTween = null;
    a.stepX = a.stepY = 0;
  },

  // A fighter jitters side to side (a hard hit); uses the leap offset.
  jitter(v, px, ms) {
    if (!v || !v.ch.active) return;
    const j = { p: 0 };
    this.tweens.add({ targets: j, p: 1, duration: ms, onUpdate: () => { if (v.ch.active) v.leapX = Math.round(Math.sin(j.p * Math.PI * 6) * px * (1 - j.p)); }, onComplete: () => { v.leapX = 0; } });
  },

  // A fighter is thrown back away from a point (character pixels), then settles back.
  knockFrom(v, at, px) {
    if (!v || !v.ch.active) return;
    const b = this.fxBody(v), dx = b.x - at.x, dy = b.y - at.y, len = Math.hypot(dx, dy) || 1, k = { p: 0 };
    const set = () => { if (v.ch.active) { v.leapX = (dx / len) * px * k.p; v.leapY = (dy / len) * px * k.p; } };
    this.tweens.add({ targets: k, p: 1, duration: 90, ease: 'Quad.easeOut', onUpdate: set,
      onComplete: () => this.tweens.add({ targets: k, p: 0, delay: 110, duration: 400, ease: 'Quad.easeInOut', onUpdate: set, onComplete: () => { v.leapX = v.leapY = 0; } }) });
  },

  // Alchemist v2: one named flask (Flask Barrage / Mystery Brew) spins over and shatters (combat.json skillFx.flask).
  playFlaskLook(from, to, flask) {
    if (!from || !to) return;
    const F = FX.flask, seed = (this.impactSeed = (this.impactSeed || 0) + 1);
    let a = this.fxBody(from), b = this.fxBody(to);
    const enemies = () => this.state.enemies.filter((u) => u.alive).map((u) => this.views.get(u.uid)).filter((v) => v && v.ch.active);
    this.addFx(CAST_MS[F.recipe], (q, now) => {
      if (from.ch.active) a = this.fxBody(from); if (to.ch.active) b = this.fxBody(to);
      const out = castFx(F.recipe, q, { caster: a, targets: [b], squad: [], enemies: enemies().map((v) => this.fxBody(v)), flask, hitMs: F.hitMs, seed }, now);
      return { draws: out.draws, tints: out.tints.map(([list, , tint]) => [list === 'targets' ? to : from, tint]) };
    }, ['skill', F.recipe]);
    this.time.delayedCall(F.hitMs, () => {
      sfx.play('flaskBreak');
      if (to.unit.side === 'enemy') { this.cameras.main.shake(F.shakeMs, F.shakeIntensity); this.jitter(to, F.jitterPx, F.jitterMs); }
    });
  },

  // Samurai v2: a counter-cut thrown back from far away (Counter Stance): clang, crescent, cut (combat.json skillFx.counter).
  playCounterLook(from, to) {
    if (!from || !to) return;
    const K = FX.counter;
    let a = this.fxBody(from), b = this.fxBody(to);
    this.addFx(CAST_MS[K.recipe], (q, now) => {
      if (from.ch.active) a = this.fxBody(from); if (to.ch.active) b = this.fxBody(to);
      const out = castFx(K.recipe, q, { caster: a, targets: [b], squad: [], enemies: [], hitMs: K.hitMs }, now);
      return { draws: out.draws, tints: out.tints.map(([list, , tint]) => [list === 'targets' ? to : from, tint]) };
    }, ['skill', K.recipe]);
    this.time.delayedCall(K.hitMs, () => {
      this.cameras.main.shake(K.shakeMs, K.shakeIntensity);
      if (K.stopMs) this.hitStop = Math.max(this.hitStop || 0, K.stopMs);
      this.jitter(to, K.jitterPx, K.jitterMs);
    });
  },

  // An aggressive skill dash (combat.json skillFx.dash): the hero shoots at its target from wherever it stands, the
  // target is knocked back at the hit with a small shake, then both settle back. Uses the same view offsets as leapAt.
  dashAt(caster, target, D, from = null) {
    if (!target || !target.ch.active) return;
    if (from) { // the rules already put him at the hit (skills.json staysAtImpact): shoot over from where he was, stay there
      const u = caster.unit, ox = from.x - u.x, oy = from.y - u.y, olen = Math.hypot(ox, oy) || 1, go = { p: 0 };
      const setF = () => { caster.leapX = ox * (1 - go.p); caster.leapY = oy * (1 - go.p); };
      setF();
      this.tweens.add({ targets: go, p: 1, duration: D.inMs, ease: 'Quad.easeIn', onUpdate: setF,
        onComplete: () => {
          caster.leapX = caster.leapY = 0;
          if (D.shakeMs) this.cameras.main.shake(D.shakeMs, D.shakeIntensity);
          if (!D.knockPx || !target.ch.active) return;
          const ux = -ox / olen, uy = -oy / olen, kb = { p: 0 };
          const setK = () => { target.leapX = ux * D.knockPx * kb.p; target.leapY = uy * D.knockPx * kb.p; };
          this.tweens.add({ targets: kb, p: 1, duration: D.knockMs, ease: 'Quad.easeOut', onUpdate: setK,
            onComplete: () => this.tweens.add({ targets: kb, p: 0, duration: D.knockBackMs, ease: 'Quad.easeInOut', onUpdate: setK, onComplete: () => { target.leapX = target.leapY = 0; } }) });
        } });
      return;
    }
    const dx = target.ch.x - caster.ch.x, dy = target.ch.y - caster.ch.y, len = Math.hypot(dx, dy) || 1;
    const reach = Phaser.Math.Clamp(len - D.stopPx, D.minPx, D.maxPx);
    const ux = dx / len, uy = dy / len;
    const go = { p: 0 };
    const set = () => { caster.leapX = ux * reach * go.p; caster.leapY = uy * reach * go.p; };
    this.tweens.add({ targets: go, p: 1, duration: D.inMs, ease: 'Quad.easeIn', onUpdate: set,
      onComplete: () => {
        this.tweens.add({ targets: go, p: 0, delay: D.holdMs, duration: D.outMs, ease: 'Quad.easeOut', onUpdate: set, onComplete: () => { caster.leapX = caster.leapY = 0; } });
        if (D.shakeMs) this.cameras.main.shake(D.shakeMs, D.shakeIntensity);
        if (!D.knockPx || !target.ch.active) return;
        const kb = { p: 0 };
        const setK = () => { target.leapX = ux * D.knockPx * kb.p; target.leapY = uy * D.knockPx * kb.p; };
        this.tweens.add({ targets: kb, p: 1, duration: D.knockMs, ease: 'Quad.easeOut', onUpdate: setK,
          onComplete: () => this.tweens.add({ targets: kb, p: 0, duration: D.knockBackMs, ease: 'Quad.easeInOut', onUpdate: setK, onComplete: () => { target.leapX = target.leapY = 0; } }) });
      } });
  },

  // A skill goes off: the caster flashes in the skill colour, a ring bursts (on each target for an
  // attack skill, around the caster for a support skill) and the skill's name shows as a banner.
  // Attack skills also shake the screen and freeze the fight for a split second (hit-stop).
  skillBurst(caster, e) {
    const attack = e.skill.kind === 'attack';
    const colorText = attack ? FX.attackColor : FX.supportColor;
    const color = Phaser.Display.Color.HexStringToColor(colorText).color;
    const heroColor = caster.unit.side === 'hero' && FX.name.heroColors[caster.unit.def.id]; // a hero with its own look flashes in its colour
    caster.ch.flash(heroColor ? Phaser.Display.Color.HexStringToColor(heroColor).color : color, FX.flashMs);
    const own = SKILL_FX_BY_NAME[e.skill.name];
    if (own) this.playSkillFx(own, caster, e); // the skill's own effect (systems/skillFx.js) instead of the plain rings
    const spots = own ? [] : attack || e.skill.target === 'squad' || e.skill.target === 'enemy' || e.skill.target === 'lowestAlly' ? e.targets.map((t) => this.views.get(t.uid)).filter(Boolean) : [caster];
    for (const v of spots) {
      const c = this.center(v);
      const ring = this.add.circle(c.x, c.y, 10).setStrokeStyle(4, color).setDepth(DEPTH.popup - 1);
      this.tweens.add({ targets: ring, radius: FX.ringRadius, alpha: 0, duration: FX.ringMs, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    }
    this.skillName(caster, e.skill.name);
    // A skill that puts statuses on every enemy (Smoke Bomb) also shows a grey cloud on each of them.
    if (e.skill.applyEnemies && !own) for (const en of this.state.enemies) if (en.alive && this.views.get(en.uid)) this.puff(this.views.get(en.uid).ch.x, this.views.get(en.uid).ch.y, 0x9a9aa8, 6);
    if (attack && !(caster.unit.side === 'hero' && LOOK_BY_NAME[e.skill.name])) { // a v2 look shakes / freezes at its own hit (lookMoves)
      this.cameras.main.shake(FX.shakeMs, FX.shakeIntensity);
      this.hitStop = FX.hitStopMs;
    }
  },

  // The skill's NAME (user's pick B): once, in capitals, over the hero at one fixed pixel size (never scaled). It slides
  // up a little while it fades in, holds, then rises and fades (combat.json skillFx.name).
  skillName(caster, name) {
    const N = FX.name;
    const hero = caster.unit.def && caster.unit.def.id;
    const color = (caster.unit.side === 'hero' && N.heroColors[hero]) || N.defaultColor;
    let y = Math.round(caster.ch.y + caster.ch.hopOffset - caster.unit.def.height * charScale(caster.unit.def) - N.abovePx);
    // Never on top of another skill name or the 'Floor cleared!' banner: it goes above them instead.
    this.nameLabels = (this.nameLabels || []).filter((o) => o.t.active);
    const blocks = this.nameLabels.map((o) => o.box);
    if (this.banner.text) blocks.push(this.banner.getBounds());
    const w = name.length * N.sizePx + 12, h = N.sizePx + 8, x0 = Phaser.Math.Clamp(caster.ch.x, w / 2 + 6, GAME_WIDTH - w / 2 - 6);
    for (let i = 0; i < 6; i++) {
      const hit = blocks.find((b) => Math.abs(b.centerX - x0) < (b.width + w) / 2 && Math.abs(b.centerY - y) < (b.height + h) / 2);
      if (!hit) break;
      y = Math.round(hit.y - h / 2 - 2);
    }
    const t = this.add
      .text(caster.ch.x, y + N.risePx, name.toUpperCase(), { fontFamily: UI.font, fontSize: `${N.sizePx}px`, color, stroke: '#000000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(DEPTH.popup + 1)
      .setAlpha(0);
    t.x = Math.round(Phaser.Math.Clamp(t.x, t.width / 2 + 6, GAME_WIDTH - t.width / 2 - 6)); // keep it on screen
    this.nameLabels.push({ t, box: new Phaser.Geom.Rectangle(t.x - t.width / 2, y - t.height / 2, t.width, t.height) });
    this.tweens.add({ targets: t, y, alpha: 1, duration: N.inMs, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: t, y: y - N.risePx, alpha: 0, delay: N.inMs + N.holdMs, duration: N.outMs, onComplete: () => t.destroy() });
  },

  // One wave of a channel with its own look: the recipe plays on the wave's targets, with a small shake per wave.
  playWaveFx(W, v, e) {
    const tv = e.targets.map((u) => this.views.get(u.uid)).filter((x) => x && x.ch.active);
    if (!v || !tv.length) return;
    const last = e.wave === e.waves - 1;
    // The shake and the jitter come when the wave lands (hitMs: Arrow Rain's arrows fall first).
    this.time.delayedCall(W.hitMs || 0, () => {
      this.cameras.main.shake(last ? W.lastShakeMs : W.shakeMs, last ? W.lastShakeIntensity : W.shakeIntensity);
      if (W.targetShakePx) for (const x of tv) this.jitter(x, last ? W.lastTargetShakePx : W.targetShakePx, W.targetShakeMs); // the hit enemy jitters side to side
    });
    const frozen = tv.map((x) => this.fxBody(x));
    const z = e.zone, center = z && z.x != null ? { x: z.x / CHAR_SCALE, y: z.y / CHAR_SCALE } : null; // the area the wave falls on
    this.addFx(CAST_MS[W.recipe], (q, now) => {
      const c = { caster: v.ch.active ? this.fxBody(v) : null, targets: tv.map((x, i) => (x.ch.active ? (frozen[i] = this.fxBody(x)) : frozen[i])), squad: [], enemies: [], wave: e.wave, waves: e.waves, hitMs: W.hitMs, center, radius: z && z.radius ? z.radius / CHAR_SCALE : undefined };
      const out = castFx(W.recipe, q, c, now);
      return { draws: out.draws, tints: out.tints.map(([list, i, tint]) => [list === 'targets' ? tv[i] : v, tint]) };
    }, ['skill', W.recipe]);
  },

  // The CHARGE beat (combat.json skillFx.charge): the skill's wind-up look on the hero, for the whole wind-up. Stops
  // early when the wind-up is cut (castCancel) or the hero is gone.
  // A rotation spell has its own charge ('skillId:SHORT'); { recipe, tremble } also trembles the hero (Berserker,
  // Alchemist). The recipe gets the song that comes next (Bard) and where the enemies are (c.aim, the Archer's aim).
  playCharge(v, e) {
    const slot = e.unit.skills && e.unit.skills[e.index];
    const spec = slot && ((e.skill && e.skill.short && FX.charge[`${slot.id}:${e.skill.short}`]) || FX.charge[slot.id]);
    if (!v || !spec || !e.castMs) return;
    const name = spec.recipe || spec, tremble = spec.tremble || 0;
    const cast = e.unit.casting;
    const aim = () => { const en = this.state.enemies.filter((u) => u.alive).map((u) => this.views.get(u.uid)).filter((x) => x && x.ch.active).map((x) => this.fxBody(x)); return en.length ? { x: en.reduce((s2, b) => s2 + b.x, 0) / en.length, y: en.reduce((s2, b) => s2 + b.mid, 0) / en.length } : null; };
    this.addFx(e.castMs, (q, now) => {
      if (!v.ch.active || (cast && e.unit.casting !== cast)) { if (tremble) v.leapX = 0; return []; }
      if (tremble) v.leapX = v.trembleX = q >= 0.999 ? 0 : Math.round(Math.sin(now / 23) * q * tremble); // shaking with rage / shaking the flask
      const out = castFx(name, q, { caster: this.fxBody(v), targets: [], squad: [], enemies: [], song: e.unit.nextSong || 'march', aim: aim() }, now);
      return { draws: out.draws, tints: out.tints.map(([, , tint]) => [v, tint]) };
    }, ['skill', name]);
    // The effect's last frame is rarely exactly the end: settle him back in place unless a leap/dash took over.
    if (tremble) this.time.delayedCall(e.castMs + 30, () => { if (v.ch.active && v.leapX === v.trembleX) v.leapX = 0; });
  },

  // A skill's own cast effect: the recipe gets where the caster, its targets, the squad and the enemies are
  // NOW (every frame), and may colour some of them for a moment.
  playSkillFx(name, caster, e) {
    const views = (units) => units.map((u) => this.views.get(u.uid)).filter((v) => v && v.ch.active);
    const L = caster.unit.side === 'hero' ? LOOK_BY_NAME[e.skill.name] : null; // a v2 look (combat.json skillFx.look)
    const squad = views(this.state.heroes.filter((h) => h.alive));
    // Bone Sacrifice: his skeletons are already dead in the fight, their views still stand for a moment.
    const minions = L && L.minions ? this.state.minions.filter((m) => m.holderUid === caster.unit.uid).map((m) => this.views.get(m.uid)).filter((v) => v && v.ch.active) : [];
    const lists = { caster: [caster], targets: L && L.targets === 'squad' ? squad : views(e.targets), squad, enemies: views(this.state.enemies.filter((u) => u.alive)), minions };
    const frozen = {}; // last known bodies, for fighters that are gone mid-effect
    const bodies = (k) => lists[k].map((v, i) => (v.ch.active ? (frozen[k + i] = this.fxBody(v)) : frozen[k + i] || this.fxBody(v)));
    const area = L && (L.radius === 'area' ? L.area && L.area.radius : L.radius === 'landSplash' ? L.landSplash && L.landSplash.radius : L.radius === 'holyNova' ? L.holyNova && L.holyNova.radius : 0);
    const enemyAim = () => { const en = bodies('enemies'); return en.length ? { x: en.reduce((s2, b) => s2 + b.x, 0) / en.length, y: en.reduce((s2, b) => s2 + b.mid, 0) / en.length } : null; };
    this.addFx(CAST_MS[name], (q, now) => {
      const c = { caster: bodies('caster')[0], targets: bodies('targets'), squad: bodies('squad'), enemies: bodies('enemies'), minions: bodies('minions'), hitMs: L ? L.hitMs || 0 : (DASH_BY_NAME[e.skill.name] || {}).inMs || 0 };
      if (L) Object.assign(c, { radius: area ? area / CHAR_SCALE : undefined, land: e.land, song: caster.unit.song, allHit: !!L.allHit, aim: enemyAim() });
      const out = castFx(name, q, c, now);
      return { draws: out.draws, tints: out.tints.map(([list, i, tint]) => [lists[list] && lists[list][i], tint]) };
    }, ['skill', name]);
  },
};
