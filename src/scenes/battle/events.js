// Part of BattleScene (mixed into its prototype at the bottom of ../BattleScene.js; `this` is the scene).
// Turning BattleState events into pictures and sounds: showEvents() / showEvent() and skill book events.
import Phaser from 'phaser';
import { GAME_WIDTH, CHAR_SCALE } from '../../config.js';
import damageTypes from '../../data/damageTypes.json';
import statusInfo from '../../data/statuses.json';
import * as sfx from '../../audio/sfx.js';
import * as itemFx from '../../systems/itemFx.js';
import { ELEMENT_SLASH, MOMENT_MS } from '../../systems/hitFx.js';
import { countEvents } from '../../systems/runStats.js';
import { noteEvents } from '../../systems/glossary.js';
import { SLOT_Y, FX, itemDefs, TUNE, DASH_BY_NAME, LOOK_BY_NAME, waveLook, charScale, DEPTH } from './shared.js';

export const eventsMethods = {
  // A held event can still be drawn: its fighters still have their views.
  lateOk(e) {
    const ids = e.type === 'attack' ? [e.attacker, e.target] : e.type === 'death' || e.type === 'heal' ? [e.unit] : [];
    return this.mode === 'fighting' || this.mode === 'won' ? ids.every((u) => !u || this.views.get(u.uid)) : false;
  },

  // One batch of events. A v2 skill look (combat.json skillFx.look / wave / flask / counter) HOLDS the hits it draws:
  // that caster's damage numbers, the heals and the enemy deaths of the same batch wait until the look lands (hitMs,
  // + staggerMs per target in the look's target order), and projectiles the look already draws are not drawn again.
  // Only the drawing waits: the fight itself (BattleState) has already done it all.
  showEvents(events) {
    if (this.runStats) countEvents(this.runStats, events, { floor: this.floor, floorMs: this.state.floorMs }); // for the game-over summary
    if (this.seenBuf) noteEvents(this.seenBuf, events); // for the Glossary
    let hold = null;
    for (const e of events) {
      if (hold && e.type === 'projectile' && e.from === hold.unit && (hold.swallow || []).includes(e.kind)) continue;
      const opened = this.holdFor(e);
      if (opened !== undefined) { hold = opened; this.showEvent(e); continue; }
      const late = hold && this.heldMs(hold, e);
      if (late) this.time.delayedCall(late, () => this.showEvent(e, true));
      else this.showEvent(e);
    }
  },

  // Does this event start a hold? Returns the hold, null (it ends the last one) or undefined (not a look's event).
  holdFor(e) {
    if (e.type === 'cast' && e.unit.side === 'hero') {
      const L = LOOK_BY_NAME[e.skill.name];
      return L && L.hitMs ? { unit: e.unit, ms: L.hitMs, stagger: L.staggerMs || 0, order: e.targets, swallow: L.swallow } : null;
    }
    if (e.type === 'wave' && e.unit.side === 'hero') {
      const W = waveLook(e.skill);
      return W && W.hitMs ? { unit: e.unit, ms: W.hitMs, stagger: W.staggerMs || 0, order: e.targets, swallow: W.swallow } : undefined;
    }
    if (e.type === 'flask' && e.flask && e.flask.name) return { unit: e.unit, ms: FX.flask.hitMs, stagger: 0, order: [e.target] };
    // A crescent that is not part of a Wind Cutter (those are swallowed by its cast hold) is a Counter Stance counter-cut.
    if (e.type === 'projectile' && e.kind === 'crescent' && e.from.side === 'hero') return { unit: e.from, ms: FX.counter.hitMs, stagger: 0, order: [e.to] };
    // A bomb (Fire Bombs...): its hit shows when the lobbed bomb lands (user, session 40: slower bombs), not at the throw.
    if (e.type === 'projectile' && itemFx.BOMB_KINDS[e.kind]) return { unit: e.from, ms: TUNE.ms('item', 'bomb', itemFx.ITEM_MS.bomb) * itemFx.BOMB_LAND, stagger: 0, order: [e.to], attacksOnly: true };
    return undefined;
  },

  // How long an event waits under a hold (0 = now).
  heldMs(hold, e) {
    const at = (u) => hold.ms + hold.stagger * Math.max(0, hold.order.indexOf(u));
    if (hold.attacksOnly && e.type === 'attack') { // a bomb: only ITS hit waits (the next hit by the thrower on that enemy)
      if (hold.done || e.attacker !== hold.unit || e.basic || !hold.order.includes(e.target)) return 0;
      hold.done = true;
      return hold.ms;
    }
    if (e.type === 'attack' && e.attacker === hold.unit && !e.basic) return at(e.target);
    if (e.type === 'heal') return hold.attacksOnly ? 0 : hold.ms;
    if (e.type === 'death' && e.unit.side === 'enemy') return hold.attacksOnly && !hold.order.includes(e.unit) ? 0 : at(e.unit) + 1;
    return 0;
  },

  showEvent(e, late = false) {
    if (late && !this.lateOk(e)) return; // a held event whose fighter is already gone
    if (e.type === 'attackStart') {
      const a = this.views.get(e.attacker.uid);
      const t = this.views.get(e.target.uid);
      if (!a || !t) return;
      a.lookAt = e.target; // it turns to face what it attacks
      // Melee: it already walked up (the fight rules move it), now it swings. Ranged: an arrow.
      const lob = e.attacker.def.passive && e.attacker.def.passive.lobbed;
      if (lob) this.lobFlask(a, t, e.hitInMs, Number(lob.color)); // Alchemist: his shots are flasks
      else if (e.attacker.damageType !== 'melee') this.shootArrow(a, t, e.hitInMs);
      else { a.ch.swing(e.hitInMs); this.stepIn(a, t, e.hitInMs); }
    } else if (e.type === 'attackRetarget') {
      // Its target died while the arrow was flying: the arrow bends towards the new target.
      const a = this.views.get(e.attacker.uid);
      const t = this.views.get(e.target.uid);
      if (a && t && a.arrow && a.arrow.active) this.flyArrow(a, a.arrow, t, e.hitInMs);
    } else if (e.type === 'attackCancel') {
      const c = this.views.get(e.unit.uid);
      if (c) this.landArrow(c); // a cancelled shot vanishes
    } else if (e.type === 'attack') {
      const a = this.views.get(e.attacker.uid);
      const t = this.views.get(e.target.uid);
      if (!t) return;
      // `a` can be gone: a Kobold Sapper's bomb goes off after the Sapper's body has faded (user bug: the game froze).
      if (e.basic) {
        // The walk/swing or the arrow already showed this attack. Melee fighters STAY where they are.
        if (a) this.landArrow(a); // the arrow reaches its target exactly as the damage lands
      } else if (a && !a.ch.moveTween) {
        a.ch.lunge(t.ch.x, t.ch.y); // skills and item hits: a small jab (only from its own spot)
      }
      if (e.result.invulnerable) {
        this.popText(t, 'Immune!', '#ffe08a', true);
        sfx.play('block');
        return;
      }
      if (e.result.dodged) {
        if (e.result.blocked) { this.popText(t, 'Blocked!', '#9fc4ff', true); this.addMoment('block', t, a); sfx.play('block'); }
        else { this.popText(t, 'Miss', '#aaaaaa'); this.addMoment('dodge', t, a); sfx.play('miss'); }
        return;
      }
      this.hitSound(e);
      this.setBar(t);
      if (t.unit.side === 'hero' && e.result.amount > 0) this.buzz();
      this.drawChips(t); // the shield tag shows what is left
      if (e.result.absorbed > 0) {
        sfx.play('shieldSoak');
        this.popText(t, `Shield -${e.result.absorbed}`, '#6fd0ff');
        this.addMoment('soak', t, a);
        if (e.result.fullyAbsorbed) return;
        e.result = { ...e.result, amount: e.result.amount - e.result.absorbed };
      }
      const { amount, crit, mult } = e.result;
      const mark = mult > 1 ? '!' : mult < 1 ? '…' : '';
      // A MELEE basic hit carrying an element charm (user, session 40): ONE slash in the charm's element colour instead
      // of the plain slash plus the charm's shot-style splash on top. Shooters keep the splash (it suits a shot).
      const slashRider = e.basic && e.attacker.damageType === 'melee' && (e.result.riders || []).find((r) => ELEMENT_SLASH[r.damageType]);
      if (!e.skill && t && !e.ghastly && !e.noImpact) this.addImpact(slashRider ? { ...e, damageType: slashRider.damageType } : e, a, t); // the hit's own look, per damage type (systems/hitFx.js)
      // Element charms ride inside the hit (one number): their element's hit look and sound play with it.
      for (const r of e.result.riders || []) {
        if (t && !slashRider) this.addImpact({ ...e, rider: true, damageType: r.damageType, result: { ...e.result, crit: false } }, a, t);
        this.hitSound({ ...e, damageType: r.damageType, result: { crit: false } });
      }
      if (e.skill) {
        // A skill hit: flashes in the skill colour and shows a big coloured number that pops.
        t.ch.flash(Phaser.Display.Color.HexStringToColor(FX.attackColor).color, FX.flashMs);
        t.ch.hurt();
        this.popText(t, `${amount}${mark}`, crit ? '#ffd24d' : FX.attackColor, true, FX.numberSizePx);
        return;
      }
      t.ch.flash();
      t.ch.hurt();
      const color = e.attacker.side === 'hero' ? damageTypes[e.damageType || e.attacker.damageType].color : '#ff6b6b';
      this.popText(t, `${amount}${mark}`, crit ? '#ffd24d' : color, crit);
    } else if (e.type === 'projectile') {
      if (e.kind === 'crescent' && e.from.side === 'hero') this.playCounterLook(this.views.get(e.from.uid), this.views.get(e.to.uid)); // Counter Stance
      else this.showProjectile(this.views.get(e.from.uid), this.views.get(e.to.uid), e.kind, e.ms);
    } else if (e.type === 'castStart' && e.boss) {
      // A boss winds up a move: its name in red over it, and a red bar fills (drawCastBars).
      sfx.play('bossWarn');
      const bv = this.views.get(e.unit.uid);
      if (bv) { this.popText(bv, e.skill.name, '#ff7a6a', true); bv.ch.flash(0xff4a3a, 140); }
      // A slam move (Grukk's Quake Jump): it rises into the air during the wind-up (it crashes down in 'bossAbility').
      if (bv && e.ability && e.ability.slam) this.tweens.add({ targets: Object.assign(bv, { leapLift: bv.leapLift || 0 }), leapLift: e.ability.slam.liftPx, duration: e.castMs, ease: 'Quad.easeOut' });
    } else if (e.type === 'castStart') {
      // The hero winds up and a charge bar fills (see drawCastBars); its name shows when it goes off (skillName).
      this.stopStep(this.views.get(e.unit.uid)); // the skill cuts the attack short (Character.stopAttack: the swing)
      this.views.get(e.unit.uid).ch.castWindUp(e.castMs);
      this.playCharge(this.views.get(e.unit.uid), e); // crouch and raise the weapon
    } else if (e.type === 'castCancel') {
      const cv = this.views.get(e.unit.uid);
      if (!cv) return;
      cv.ch.castCancel();
      if (cv.leapLift && e.unit.side === 'enemy' && !e.unit.statuses.some((st) => st.type === 'airborne')) this.tweens.add({ targets: cv, leapLift: 0, duration: 200, ease: 'Quad.easeIn' }); // a stopped slam drops
      if (e.reason === 'interrupted') { this.popText(this.views.get(e.unit.uid), 'Interrupted!', '#ff8a5c', true); sfx.play('interrupted'); }
    } else if (e.type === 'cast') {
      const caster = this.views.get(e.unit.uid);
      this.stopStep(caster); // an instant skill also cuts the attack short
      if (e.unit.side === 'hero' && !e.unit.minion) sfx.play(sfx.has(`skill_${e.skillId}`) ? `skill_${e.skillId}` : 'skillCast'); // each skill its own sound
      if (e.zone) this.showZone(e.zone, FX.areaMs);
      const look = e.unit.side === 'hero' ? LOOK_BY_NAME[e.skill.name] : null;
      if (look) this.lookMoves(caster, e, look); // before the burst: the look wants to know where he lands
      this.skillBurst(caster, e);
      if (e.skill.leap && e.targets[0] && !(look && look.leap)) this.leapAt(caster, this.views.get(e.targets[0].uid), null, e.moved); // Savage Leap
      const dash = DASH_BY_NAME[e.skill.name];
      if (dash && e.targets[0]) this.dashAt(caster, this.views.get(e.targets[0].uid), dash, e.moved); // Defense Bash, Multistrike
      caster.ch.castRelease(e.skill.kind); // the skill's own animation (not the normal swing)
      if ((e.skill.target === 'enemy' || e.skill.target === 'allEnemies') && e.targets[0] && !e.skill.leap && !dash && !look) {
        const t = this.views.get(e.targets[0].uid);
        caster.ch.lunge(t.ch.x, t.ch.y);
      }
    } else if (e.type === 'status') {
      const v = this.views.get(e.unit.uid);
      this.drawChips(v);
      if (e.change === 'expire' && e.status.type === 'freeze' && v && !e.unit.statuses.some((st) => st.type === 'freeze')) {
        (this.iceBreaks = this.iceBreaks || []).push({ view: v, start: this.time.now }); // the ice breaks off
      }
      if (e.change === 'apply' && (e.status.type === 'stun' || e.status.type === 'freeze')) sfx.play(e.status.type);
      if (e.change === 'apply' && e.status.type !== 'buff' && statusInfo[e.status.type].popup !== false) {
        this.popText(v, statusInfo[e.status.type].label + '!', statusInfo[e.status.type].color);
      }
      if (e.status.type === 'buff') this.drawAllBars();
      if (e.status.type === 'shield') this.setBar(v);
    } else if (e.type === 'itemUsed') {
      this.drawDots(this.views.get(e.unit.uid)); // a consumable was used up: one dot less
    } else if (e.type === 'wave') {
      if (e.zone) this.showZone(e.zone, FX.areaMs * 0.7);
      // One wave of a channel (Rain of Arrows, Crescendo): a ring on the caster that grows with the wave.
      // A skill with its own wave look (combat.json skillFx.wave, e.g. Multistrike slashes) plays that instead.
      const v = this.views.get(e.unit.uid);
      const own = waveLook(e.skill);
      if (own && own.none) { /* its cast look draws it (Holy Nova's smite) */ } else if (own) this.playWaveFx(own, v, e);
      else if (v) {
        const c = this.center(v);
        const ring = this.add.circle(c.x, c.y, 10).setStrokeStyle(2 + e.wave, 0xffd84d).setDepth(DEPTH.popup - 1);
        this.tweens.add({ targets: ring, radius: 24 + e.wave * 10, alpha: 0, duration: 400, onComplete: () => ring.destroy() });
      }
    } else if (e.type === 'flask') {
      if (e.grace) { // Cleric's Grace: she raises her staff and the hurt hero shines (a buff, not a shot: user, session 40)
        const cv = this.views.get(e.unit.uid); if (cv) cv.ch.bless();
        sfx.play('grace');
        this.addMoment('grace', this.views.get(e.target.uid));
        return;
      }
      if (e.flask.name && e.unit.side === 'hero') this.playFlaskLook(this.views.get(e.unit.uid), this.views.get(e.target.uid), e.flask); // Alchemist v2 look
      else this.showFlask(this.views.get(e.unit.uid), this.views.get(e.target.uid), Number(e.flask.color), e.flask.look);
    } else if (e.type === 'minionSpawn') {
      this.showMinion(e.unit);
    } else if (e.type === 'tornadoSpawn') {
      this.tornadoViews = this.tornadoViews || new Map();
      // It appears ON the enemy it was made on (then glides from enemy to enemy). The container only carries
      // the position: drawHitFx() draws the pixel funnel there.
      const at = this.views.get((e.target || e.tornado.target).uid);
      const g = this.add.container(at ? at.ch.x : GAME_WIDTH / 2, at ? at.ch.y : SLOT_Y - 200).setDepth(DEPTH.popup - 2);
      this.tornadoViews.set(e.tornado.id, { g, t: e.tornado });
      this.puff(g.x, g.y, 0xcfe8ff, 4);
    } else if (e.type === 'thunderstruck') {
      // Thunderstruck: a giant bolt from the top of the screen onto the marked enemy, with a small shake.
      const tv = this.views.get(e.target.uid);
      if (tv) {
        const seed = (this.impactSeed = (this.impactSeed || 0) + 1);
        this.addFx(itemFx.ITEM_MS.thunderstruck, (q, now) => (tv.ch.active ? itemFx.thunderstruckFx(q, this.fxBody(tv), now, seed) : []), ['item', 'thunderstruck']);
        this.cameras.main.shake(120, 0.004);
      }
    } else if (e.type === 'bombFizzle') {
      this.puff(e.bomb.x, e.bomb.y, 0x4a4a52, 4); // a Sapper bomb goes out with the floor: a little grey smoke
    } else if (e.type === 'tornadoEnd') {
      const tv = this.tornadoViews && this.tornadoViews.get(e.tornado.id);
      if (tv) {
        this.tornadoViews.delete(e.tornado.id);
        this.tweens.add({ targets: tv.g, alpha: 0, duration: 250, onComplete: () => tv.g.destroy() });
      }
    } else if (e.type === 'minionExplode') {
      const v = this.views.get(e.unit.uid);
      if (v) {
        this.puff(v.ch.x, v.ch.y - 8, 0xff8a3d, 8);
        const ring = this.add.circle(v.ch.x, v.ch.y - 8, 10).setStrokeStyle(3, 0xffb84d).setDepth(DEPTH.popup - 1);
        this.tweens.add({ targets: ring, radius: e.radius * 0.6, alpha: 0, duration: 350, onComplete: () => ring.destroy() });
      }
    } else if (e.type === 'minionVanish') {
      const v = this.views.get(e.unit.uid);
      if (!v) return;
      v.ch.stopMove();
      this.puff(v.ch.x, v.ch.y, 0x6a5a8a, 4);
      this.tweens.add({ targets: [v.ch, v.bg, v.fill, v.shieldFill, v.chipBox], alpha: 0, duration: 300, onComplete: () => this.removeView(e.unit.uid) });
    } else if (e.type === 'beat') {
      // The holder's weapon shines once charged (drawChips). When the Nth attack goes off: a flash on the attacker
      // and a big burst (rings, rays, sparks) on its target (or around the attacker for a heal beat).
      this.drawChips(this.views.get(e.holder.uid));
      if (!e.fired) return;
      const v = this.views.get(e.unit.uid);
      const color = Phaser.Display.Color.HexStringToColor(e.color || e.counter.color || '#c8a0ff').color;
      v.ch.flash(color, 160);
      const tv = e.counter.effect === 'empower' && e.target ? this.views.get(e.target.uid) : null;
      const c = this.center(tv || v);
      for (let i = 0; i < 2; i++) {
        const ring = this.add.circle(c.x, c.y, 8).setStrokeStyle(4 - i, i ? 0xffffff : color).setDepth(DEPTH.popup - 1);
        this.tweens.add({ targets: ring, radius: 60 - i * 20, alpha: 0, duration: 450, delay: i * 80, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
      }
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const ray = this.add.rectangle(c.x, c.y, 14, 3, color).setRotation(ang).setDepth(DEPTH.popup - 1);
        this.tweens.add({ targets: ray, x: c.x + Math.cos(ang) * 46, y: c.y + Math.sin(ang) * 46, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => ray.destroy() });
      }
      this.puff(c.x, c.y + 10, color, 6);
      this.cameras.main.shake(70, 0.002);
    } else if (e.type === 'deathBurst') {
      // An enemy bursts when it dies (Puffshroom poison cloud): a cloud that spreads to its radius.
      const v = this.views.get(e.unit.uid);
      const c = v ? this.center(v) : { x: e.unit.x, y: e.unit.y };
      const color = Phaser.Display.Color.HexStringToColor(e.color || '#6de07a').color;
      const cloud = this.add.circle(c.x, c.y, 10, color, 0.45).setDepth(DEPTH.popup - 2);
      this.tweens.add({ targets: cloud, radius: e.radius || 80, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => cloud.destroy() });
      this.puff(c.x, c.y + 8, color, 8);
      if (e.explosive) this.cameras.main.shake(120, 0.004); // an Explosive elite
    } else if (e.type === 'iceSpikes') {
      // Frozen Demon Head: a giant icicle bursts up round the enemy; the enemy holds still inside while it is frozen,
      // then the icicle shatters (freeze over, or the enemy died). itemFx.iceSpikeFx.
      // One icicle per enemy (bug: two holders, or a second burst while still frozen, stacked two icicles on it): a
      // burst on an enemy already inside one keeps that icicle (its freeze was refreshed, so it stands longer).
      const v = this.views.get(e.target.uid);
      if (v) this.encaseIcicle(v);
      this.cameras.main.shake(140, 0.005);
    } else if (e.type === 'sweep') { // Sweeping Strap: one Sven-style cleave crescent bursts out of the target on every strap hit
      const hv = this.views.get(e.unit.uid), tv = this.views.get(e.target.uid);
      if (hv && tv) {
        const h = this.fxPoint(hv), t = this.fxPoint(tv);
        this.addFx(itemFx.ITEM_MS.cleave, (q) => itemFx.cleaveFx(q, h, t, (e.radius || 60) / CHAR_SCALE), ['item', 'cleave']);
      }
    } else if (e.type === 'lifeOrb') {
      // Life Crystal: a green orb pops out of the dead enemy, then a small orb flies to every hero it heals.
      const v = this.views.get(e.at.uid);
      const c = v ? this.center(v) : { x: e.at.x, y: e.at.y };
      const orb = this.add.circle(c.x, c.y, 6, 0x5ddf6a).setDepth(DEPTH.popup - 1);
      this.tweens.add({ targets: orb, y: c.y - 18, scale: 1.4, duration: 220, yoyo: true, onComplete: () => orb.destroy() });
      for (const t of e.targets) {
        const tv = this.views.get(t.uid);
        if (!tv) continue;
        const to = this.center(tv);
        const bit = this.add.circle(c.x, c.y - 18, 4, 0x9dffa8).setDepth(DEPTH.popup - 1);
        this.tweens.add({ targets: bit, x: to.x, y: to.y, delay: 220, duration: 320, ease: 'Quad.easeIn', onComplete: () => { bit.destroy(); this.puff(to.x, to.y, 0x5ddf6a, 4); } });
      }
    } else if (e.type === 'shieldBreak') {
      sfx.play('shieldBreak');
      const v = this.views.get(e.unit.uid);
      this.drawChips(v);
      this.setBar(v);
      this.popText(v, 'Shield broken!', '#6fd0ff', true);
      this.addMoment('shieldBreak', v);
      this.cameras.main.shake(90, 0.003);
    } else if (e.type === 'soulFeed') { // Soul Lantern: every kill, glowing green lines swirl round the holder
      const hv = this.views.get(e.unit.uid);
      if (hv) this.addFx(itemFx.ITEM_MS.soulLantern, (q, now) => (hv.ch.active ? itemFx.soulLanternFx(q, this.fxBody(hv), now) : []), ['item', 'soulLantern']);
    } else if (e.type === 'proc') {
      const v = this.views.get(e.unit.uid);
      if (e.itemId && itemDefs[e.itemId]) this.itemProc(e, v); // an item: its icon pops + its own effect
      else this.popText(v, e.label, '#ffd24d', true); // passives and other moments keep their text
    } else if (e.type === 'lifesteal') {
      const v = this.views.get(e.unit.uid), fv = this.views.get(e.from.uid);
      if (v && fv) { const a = this.fxPoint(fv); this.addFx(itemFx.ITEM_MS.lifesteal, (q) => itemFx.lifestealFx(q, a, v.ch.active ? this.fxPoint(v) : a), ['item', 'lifesteal']); }
    } else if (e.type === 'heal') {
      const v = this.views.get(e.unit.uid);
      this.setBar(v);
      this.popText(v, `+${Math.round(e.amount)}`, '#6dff8f');
      if (!v.selfFrozen && (!v.healFxAt || this.time.now - v.healFxAt > 450)) { v.healFxAt = this.time.now; this.addMoment('heal', v); } // not on every tiny heal; not inside Frozen Rest's ice
    } else if (e.type === 'thorns') {
      const v = this.views.get(e.unit.uid);
      v.ch.flash();
      this.setBar(v);
      this.popText(v, `${e.amount} thorns`, '#e8a0ff');
      const hv = e.holder ? this.views.get(e.holder.uid) : null;
      if (hv) this.addFx(itemFx.ITEM_MS.thorns, (q) => (hv.ch.active ? itemFx.thornsFx(q, this.fxBody(hv)) : []), ['item', 'thorns']); // spikes jab out of the holder
    } else if (e.type === 'dot') {
      const v = this.views.get(e.unit.uid);
      this.setBar(v);
      this.drawChips(v);
      if (e.immune) {
        this.popText(v, 'Immune!', '#ffe08a');
        return;
      }
      if (e.absorbed > 0) this.popText(v, `Shield -${e.absorbed}`, '#6fd0ff');
      if (e.amount > 0) {
        v.ch.flash();
        this.popText(v, e.crit ? `${e.amount}!` : String(e.amount), e.crit ? '#ffd24d' : damageTypes[e.damageType].color, e.crit); // Catalyst Vial: a crit tick is big and gold
      }
    } else if (e.type === 'morale') {
      this.drawMoraleWash();
      for (const h of this.state.heroes) this.setBar(this.views.get(h.uid));
    } else if (e.type === 'intercept') {
      // Knight's Intercept: he jumps in to guard a hurt ally.
      const kv = this.views.get(e.unit.uid), av = this.views.get(e.ally.uid);
      if (kv) { this.popText(kv, 'Intercept!', '#6fa8ff', true); kv.ch.flash(0x6fa8ff, 160); }
      if (av) av.ch.flash(0x6fa8ff, 160);
    } else if (e.type === 'intercepted') {
      const kv = this.views.get(e.unit.uid);
      if (kv) { this.setBar(kv); if (e.amount > 0) this.popText(kv, `-${e.amount}`, '#9cc4ff'); }
    } else if (e.type === 'selfCost') {
      const v = this.views.get(e.unit.uid);
      if (v) { this.setBar(v); this.popText(v, `-${e.amount}`, '#ff5a5a'); }
    } else if (e.type === 'reaction') {
      // Mage's reactions: a big coloured word over the enemy.
      const v = this.views.get(e.unit.uid);
      const look = { steam: ['Steam!', '#e8e8f0'], shatter: ['Shatter!', '#8fe0ff'], overload: ['Overload!', '#ffa040'] }[e.kind];
      if (v && look) { this.popText(v, look[0], look[1], true); v.ch.flash(Number('0x' + look[1].slice(1)), 140); }
    } else if (e.type === 'song') {
      const v = this.views.get(e.unit.uid);
      if (v && e.song) this.popText(v, e.song === 'ballad' ? 'Ballad!' : 'March!', e.song === 'ballad' ? '#6dff8f' : '#ffb84d', true); // song: null = it stopped
      this.drawAllBars();
    } else if (e.type === 'lute') {
      // Bard's lute: the boost's name over him, a ring in its colour on every hero.
      const v = this.views.get(e.unit.uid), col = Number(e.color);
      if (v) this.popText(v, `${e.boost}!`, '#' + col.toString(16).padStart(6, '0'), true);
      for (const h of this.state.heroes) { const hv = this.views.get(h.uid); if (h.alive && hv) this.ring(hv, col); }
    } else if (e.type === 'combo') {
      // drawn every frame by drawHeroHud()
    } else if (this.showBookEvent(e)) {
      // skill book modifier moments (Titan, Roar, Ricochet, Aftershock)
    } else if (this.showBossEvent(e)) {
      // boss moves (systems/bosses.js): handled in showBossEvent()
    } else if (e.type === 'levelup') {
      sfx.play('levelUp');
      const v = this.views.get(e.unit.uid);
      this.setBar(v);
      if (v.lvl) v.lvl.setText(`Lv${e.unit.level}`);
      this.popText(v, `LEVEL UP\nLv${e.unit.level}`, '#ffd24d', true, 8); // two short lines: three heroes levelling at once don't print over each other
    } else if (e.type === 'death') {
      const v = this.views.get(e.unit.uid);
      this.setBar(v);
      sfx.play(e.unit.side === 'enemy' || e.unit.minion ? 'enemyDeath' : 'heroFall');
      if (e.unit.side === 'hero' && !e.unit.minion) this.lastKiller = e.killer && e.killer.side === 'enemy' ? e.killer.def.name : null; // named on the defeat screen
      if (e.unit.side === 'enemy' || e.unit.minion) {
        v.ch.stopMove(); // it fades out where it fell
        v.ch.castCancel();
        v.ch.die(); // death clip (if it has one)
        this.drawChips(v);
        // A last white flash, it squashes flat into the floor, then a grey puff of smoke and it is gone.
        v.ch.flash(0xffffff, 120);
        this.tweens.add({ targets: [v.bg, v.fill, v.shieldFill, v.chipBox], alpha: 0, duration: 250 });
        this.tweens.add({ targets: v.ch, scaleY: v.ch.scaleY * 0.1, alpha: 0.6, delay: 120, duration: 300, ease: 'Quad.easeIn' });
        this.time.delayedCall(380, () => {
          if (v.ch.active) (this.impacts = this.impacts || []).push({ kind: 'puff', start: this.time.now, ms: TUNE.ms('hit', 'puff', MOMENT_MS.puff), x: v.ch.x / CHAR_SCALE, y: v.ch.y / CHAR_SCALE });
          this.removeView(e.unit.uid);
        });
      } else {
        // A hero who falls while away at an enemy is put back in its slot.
        v.ch.stopMove();
        v.ch.setPosition(v.ch.homeX, v.ch.homeY).setDepth(DEPTH.hero);
        this.syncBar(v);
        v.ch.die(); // death clip if it has one, then it stops moving
        this.heroFell(v);
        v.skillButtons.forEach((b) => [b.g, b.code, b.cd].forEach((o) => o.setAlpha(0)));
        if (v.passiveIcon) v.passiveIcon.setAlpha(0);
        v.bg.setAlpha(0.4);
        v.fill.setAlpha(0.4);
        if (v.lvl) v.lvl.setAlpha(0.4);
        if (v.dots) v.dots.setAlpha(0.3); // its items stop working
        this.drawChips(v);
        this.drawAllBars(); // squad items from this hero stop working, so max health may change
      }
    }
  },

  // A hit's sound: one per damage type (sounds.json hitMelee, hitFire...), plus a crack on top for a crit.
  hitSound(e) {
    const type = e.damageType || e.attacker.damageType;
    const cue = { melee: 'hitMelee', ranged: 'hitRanged', fire: 'hitFire', ice: 'hitIce', electric: 'hitElectric', dark: 'hitDark', holy: 'hitHoly' }[type] || 'hitMelee';
    sfx.play(cue);
    if (e.result.crit) sfx.play('crit');
  },

  // Skill book modifier moments. Returns false for other events.
  showBookEvent(e) {
    const v = e.unit && this.views.get(e.unit.uid);
    switch (e.type) {
      case 'grow': {
        if (!v) return true;
        const base = charScale(e.unit.def);
        const set = (k) => { if (v.ch.active) v.ch.setScale((Math.sign(v.ch.scaleX) || 1) * base * k, base * k); };
        const g = { k: 1 };
        this.tweens.add({ targets: g, k: e.scale, duration: 200, ease: 'Back.easeOut', onUpdate: () => set(g.k) });
        this.tweens.add({ targets: g, k: 1, delay: e.durationMs, duration: 250, onUpdate: () => set(g.k) });
        this.popText(v, 'Titan!', '#ffd24d', true);
        return true;
      }
      case 'roar':
        if (v) { this.popText(v, 'Roar!', '#ff7a6a', true); this.ring(v, 0xff7a6a); this.cameras.main.shake(90, 0.002); }
        return true;
      case 'ricochet':
        this.ring(this.views.get(e.to.uid), 0xc8a0ff);
        return true;
      case 'aftershock':
        for (const t of e.targets) this.ring(this.views.get(t.uid), 0xc8a0ff, 0.7);
        return true;
      default: return false;
    }
  },
};
