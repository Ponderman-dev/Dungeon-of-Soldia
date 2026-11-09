// Part of BattleScene (mixed into its prototype at the bottom of ../BattleScene.js; `this` is the scene).
// Bosses and spawns on screen: boss events, roar, banners, Monster House banner (docs/systems/bosses.md).
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CHAR_SCALE, UI } from '../../config.js';
import damageTypes from '../../data/damageTypes.json';
import * as sfx from '../../audio/sfx.js';
import * as itemFx from '../../systems/itemFx.js';
import * as bossFx from '../../systems/bossFx.js';
import { IMPACT_MS } from '../../systems/hitFx.js';
import { ENEMY_Y, T, FX, DEPTH } from './shared.js';

export const bossViewMethods = {
  // The boss's roar before a boss fight: a hard shake, a white flash, manga action lines bursting from the
  // boss over the whole screen and a huge ROAR!! that slams in (numbers: combat.json transition.bossIntro).
  bossRoar(view) {
    const B = T.bossIntro;
    const L = B.lines;
    sfx.play('bossRoar');
    this.cameras.main.shake(B.shakeMs, B.shakeIntensity);
    this.cameras.main.flash(B.flashMs, 255, 255, 255);
    const c = this.center(view);
    const fp = view.ch.parentContainer; // before the fight the boss still stands in its floor container
    if (fp) { c.x += fp.x; c.y += fp.y; }
    const far = Math.hypot(GAME_WIDTH, GAME_HEIGHT); // every line runs off the screen
    const g = this.add.graphics().setDepth(DEPTH.popup + 1);
    // Thin wedges from a ring round the boss out to the screen edge, a new random set each flicker.
    const drawLines = () => {
      g.clear().fillStyle(Number(L.color), 1);
      for (let i = 0; i < L.count; i++) {
        const a = ((i + Math.random() * 0.8) / L.count) * Math.PI * 2;
        const half = (L.widthPx * (0.35 + Math.random() * 0.65)) / 2 / far; // the angle half the wide end covers
        const r0 = L.innerPx * (1 + Math.random() * 0.6);
        g.fillTriangle(
          c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0,
          c.x + Math.cos(a - half) * far, c.y + Math.sin(a - half) * far,
          c.x + Math.cos(a + half) * far, c.y + Math.sin(a + half) * far,
        );
      }
    };
    drawLines();
    g.setAlpha(L.alpha);
    const flicker = this.time.addEvent({ delay: L.flickerMs, loop: true, callback: drawLines });
    this.tweens.add({ targets: g, alpha: 0, delay: B.roarMs * 0.7, duration: B.roarMs * 0.3, onComplete: () => { flicker.remove(); g.destroy(); } });
    // ROAR!! slams in huge over the boss (kept on screen), shakes, then fades.
    const t = this.add.text(GAME_WIDTH / 2, Phaser.Math.Clamp(c.y, 140, GAME_HEIGHT / 2), 'ROAR!!', {
      fontFamily: UI.font, fontSize: `${B.textPx}px`, color: '#ff3a2a', stroke: '#000000', strokeThickness: 10, align: 'center',
    }).setOrigin(0.5).setDepth(DEPTH.popup + 2);
    if (t.width > GAME_WIDTH - 12) t.setScale((GAME_WIDTH - 12) / t.width);
    const end = t.scale;
    t.setScale(end * 3).setAlpha(0);
    this.tweens.add({ targets: t, scale: end, alpha: 1, duration: 180, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, angle: { from: -4, to: 4 }, delay: 180, duration: 70, yoyo: true, repeat: Math.max(0, Math.floor((B.roarMs - 400) / 140)) });
    this.tweens.add({ targets: t, alpha: 0, scale: end * 1.3, delay: B.roarMs, duration: 300, onComplete: () => t.destroy() });
  },

  // ---- bosses (systems/bosses.js) -------------------------------------------------------------
  // Draws the boss moves. Returns false for events that are not boss events.
  showBossEvent(e) {
    const v = e.unit && this.views.get(e.unit.uid);
    switch (e.type) {
      case 'enemySpawn': this.showEnemySpawn(e.unit); return true;
      // ---- the new enemies, batch 2 ----
      case 'burrow': // Cave Worm digs in: a dirt puff, it sinks into the floor (its bars fade with it)
        if (!v) return true;
        this.puff(v.ch.x, v.ch.y, 0x8a6a4a, 9);
        this.tweens.add({ targets: v.ch, alpha: 0, duration: 260 });
        return true;
      case 'surface': // ...and bursts out next to a hero
        if (!v) return true;
        this.time.delayedCall(20, () => { // after followPositions has moved it to its new spot
          this.puff(v.ch.x, v.ch.y, 0x8a6a4a, 12);
          this.tweens.add({ targets: v.ch, alpha: e.unit.def.alpha ?? 1, duration: 120 });
          this.cameras.main.shake(90, 0.003);
        });
        return true;
      case 'blink': { // Blink Imp: a purple flash where it was and where it lands
        const c1 = this.add.circle(e.from.x, e.from.y - 20, 14, 0xd04a8a, 0.7).setDepth(DEPTH.popup - 1);
        this.tweens.add({ targets: c1, scale: 0.1, alpha: 0, duration: 260, onComplete: () => c1.destroy() });
        this.puff(e.from.x, e.from.y, 0xd04a8a, 6);
        this.time.delayedCall(20, () => { if (v) { this.ring(v, 0xd04a8a); this.puff(v.ch.x, v.ch.y, 0xd04a8a, 6); } });
        return true;
      }
      case 'raiseDead': // Bone Acolyte: a green-black puff where the enemy fell, a popup over the acolyte
        if (v) this.popText(v, 'Rise!', '#9fe07a', true);
        return true;
      case 'adapt': // Crystal Sentinel: says what it resists now (its glow in that colour is drawn in drawElites)
        if (v && e.damageType) this.popText(v, `Resists ${e.damageType}!`, damageTypes[e.damageType].color);
        return true;
      case 'revive':
        this.removeView(e.unit.uid); // its old figure may still be fading
        this.showEnemySpawn(e.unit, 0xffd24d);
        this.popText(this.views.get(e.unit.uid), 'Revived!', '#ffd24d', true);
        return true;
      case 'minionRevive': if (v) { this.puff(v.ch.x, v.ch.y, 0xffd24d, 8); this.popText(v, 'Reborn!', '#ffd24d', true); } return true; // Phoenix rises again
      case 'hatch': if (v) { this.puff(v.ch.x, v.ch.y, 0xd8d0a0, 6); this.popText(v, 'Hatched!', '#e8e0b0'); } return true;
      case 'dust':
        if (!v) return true;
        this.setBar(v);
        this.drawChips(v);
        this.puff(v.ch.x, v.ch.y, 0x8a8a9a, 9);
        this.tweens.add({ targets: v.ch, alpha: 0.2, duration: 400 });
        this.popText(v, 'Break the crystal!', '#c8a0ff', true);
        return true;
      case 'reform':
        if (!v) return true;
        this.setBar(v);
        this.tweens.add({ targets: v.ch, alpha: e.unit.def.alpha ?? 1, duration: 400 });
        this.popText(v, 'He rises again!', '#c070ff', true);
        this.cameras.main.shake(160, 0.004);
        return true;
      case 'bossAbility': {
        if (e.minor) {
          // A normal enemy's small move (Shaman's Mend, Shieldbearer's Guard, Golem's Enrage, Hound's Howl): its name pops
          // up over it and a ring in the move's colour bursts on each target. No banner, no shake.
          const a = e.ability;
          const color = a.healAllies ? 0x6dff8f : a.shield ? 0x6fd0ff : 0xff8a3a;
          if (v) { this.popText(v, a.name, `#${color.toString(16).padStart(6, '0')}`); v.ch.flash(color, 140); }
          for (const t of e.targets) this.ring(this.views.get(t.uid), color, 0.8);
          return true;
        }
        if (e.quiet) {
          for (const t of e.targets) { const tv = this.views.get(t.uid); if (tv && v) this.showProjectile(v, tv, 'lightning'); }
          return true;
        }
        if (v) v.ch.flash(0xff4a3a, 160);
        const slam = e.ability.slam;
        if (v && slam) {
          // Quake Jump: it crashes down from the air, the ground shakes hard and dust bursts out round its feet.
          this.tweens.add({ targets: v, leapLift: 0, duration: slam.dropMs, ease: 'Quad.easeIn', onComplete: () => {
            this.cameras.main.shake(slam.shakeMs, slam.shakeIntensity);
            if (e.ability.look === 'iceSlam') { // Ice Slam: a frost crack runs to each target and ice shards burst up round it
              for (const t of e.targets) {
                const tv = this.views.get(t.uid);
                if (!tv) continue;
                const from = this.fxBody(v), to = this.fxBody(tv);
                this.addFx(bossFx.ICE_SLAM_MS, (q) => bossFx.iceSlamFx(q, from, to), ['boss', 'iceSlam']);
              }
            } else this.puff(v.ch.x, v.ch.y, 0x8a7a6a, 14);
          } });
        }
        sfx.play('bossMove');
        this.bossBanner(e.ability.name);
        for (const t of e.targets) this.ring(this.views.get(t.uid), 0xff4a3a);
        const sp = e.ability.spikes; // Ice Spikes: the ground shakes for the whole barrage
        if (sp) this.cameras.main.shake(sp.warnMs + sp.count * (sp.gapMs || 0), 0.003);
        else if (!slam) this.cameras.main.shake(120, 0.003);
        return true;
      }
      case 'bossChannel':
        for (const t of e.targets) if (t !== e.unit) this.ring(this.views.get(t.uid), 0xc070ff, 0.6); // not on itself (Frozen Rest)
        return true;
      case 'drain': {
        const tv = this.views.get(e.unit.uid), fv = this.views.get(e.from.uid);
        if (tv) { this.setBar(tv); if (e.amount > 0) this.popText(tv, `-${e.amount}`, '#c070ff'); }
        if (fv) this.setBar(fv);
        return true;
      }
      case 'percentHit': { // Hailstorm, Ice Spikes: a share of the hero's own health
        const tv = this.views.get(e.unit.uid);
        if (tv) { this.setBar(tv); if (e.amount > 0) this.popText(tv, `-${e.amount}`, '#9fe8ff'); }
        return true;
      }
      case 'windSweep': { // Hailstorm: the icy wind crosses the fight left to right (the hits land as it passes, 'windHit')
        const S = CHAR_SCALE;
        const area = { x0: 0, x1: GAME_WIDTH / S, y0: 0, y1: GAME_HEIGHT / S }; // the whole screen (user)
        const ms = (e.ms || 900) / 0.8; // the front takes 80% of the effect to cross (bossFx HAIL_SWEEP_END)
        this.addFx(ms, (q) => bossFx.hailstormFx(q, area), ['boss', 'hailstorm']);
        return true;
      }
      case 'windHit': {
        if (!v) return true;
        (this.impacts = this.impacts || []).push({ type: 'ice', start: this.time.now, ms: IMPACT_MS.ice, view: v, attacker: null, side: -1, seed: (this.impactSeed = (this.impactSeed || 0) + 1) });
        v.ch.flash(0xbfefff, 140);
        return true;
      }
      case 'spikeWarn': { // Ice Spikes: a frost circle grows on the floor where a spike will burst up
        const S = CHAR_SCALE, sp = e.spike;
        this.addFx(sp.total, (q, now) => bossFx.spikeWarnFx(q, sp.x / S, sp.y / S, sp.spec.radius / S, now), ['boss', 'spikeWarn']);
        return true;
      }
      case 'spikeLand': { // the icicle bursts up: round each hero it caught (they stay inside while frozen), else on its own
        const S = CHAR_SCALE, sp = e.spike;
        const caught = e.targets.filter((t) => t.alive).map((t) => this.views.get(t.uid)).filter(Boolean);
        for (const tv of caught) this.encaseIcicle(tv);
        if (!caught.length) {
          const start = this.time.now, body = { x: sp.x / S, y: sp.y / S, top: sp.y / S - 11, hw: 4 };
          const standMs = bossFx.FREE_SPIKE_MS;
          this.addFx(standMs + itemFx.ICE_SPIKE.shatterMs, (q, now) => itemFx.iceSpikeFx(now - start, body, now, now - start > standMs ? standMs : null), ['item', 'iceSpike']);
        }
        return true;
      }
      case 'plateBreak':
        if (!v) return true;
        this.popText(v, e.left > 0 ? 'Armor cracked!' : 'Armor shattered!', '#bfe0ff', true);
        { const at = bossFx.plateSpots(this.fxBody(v))[e.left]; // the plate that just broke bursts into shards
          if (at) this.addFx(bossFx.PLATE_BREAK_MS, (q) => bossFx.plateBreakFx(q, at), ['boss', 'plateBreak']); }
        this.cameras.main.shake(140, 0.004);
        return true;
      case 'immuneStatus': if (v) this.popText(v, 'Immune', '#aaaaaa'); return true;
      case 'enrage':
        if (!v) return true;
        v.ch.flash(0xff2a2a, 300);
        this.popText(v, 'ENRAGED!', '#ff4a3a', true);
        this.drawChips(v);
        return true;
      case 'swap': {
        const w = this.views.get(e.with.uid);
        for (const x of [v, w]) if (x) this.puff(x.ch.x, x.ch.y, 0x4a3a6a, 6);
        if (v) this.popText(v, 'Swap!', '#c8a0ff');
        return true;
      }
      case 'skyPhase':
        if (!v) return true;
        this.bossBanner('TAKES TO THE SKY!');
        this.tweens.add({ targets: v, leapLift: 90, duration: 600, ease: 'Quad.easeOut' });
        return true;
      case 'grounded':
        if (!v) return true;
        this.tweens.add({ targets: v, leapLift: 0, duration: 220, ease: 'Quad.easeIn', onComplete: () => this.puff(v.ch.x, v.ch.y, 0x8a7a6a, 8) });
        this.popText(v, 'Grounded!', '#ffd24d', true);
        this.cameras.main.shake(200, 0.006);
        return true;
      case 'reflect': if (v) this.popText(v, 'Reflected!', '#bfe0ff', true); return true;
      default: return false;
    }
  },

  // A new enemy joins the fight (summon, hatchling, clone, a revived twin): it grows out of a dark puff.
  showEnemySpawn(unit, color = 0x4a3a6a) {
    if (this.views.has(unit.uid)) return;
    const v = this.makeView(unit, unit.x ?? GAME_WIDTH / 2, unit.y ?? ENEMY_Y);
    v.ch.setDepth(DEPTH.hero + v.ch.y / 10000); // sorted with everyone else (followPositions keeps it up to date)
    for (const part of [v.bg, v.fill, v.shieldFill, v.chipBox]) part.setDepth(DEPTH.heroBar);
    const target = v.ch.scaleY;
    v.ch.scaleY = 0.05;
    this.puff(v.ch.x, v.ch.y, color, 6);
    this.tweens.add({ targets: v.ch, scaleY: target, duration: 360, ease: 'Back.easeOut' });
    this.syncBar(v);
  },

  // A thin ring that bursts on a fighter (boss moves mark who they hit).
  ring(v, color, alpha = 0.9) {
    if (!v || !v.ch.active) return;
    const c = this.center(v);
    const r = this.add.circle(c.x, c.y, 10).setStrokeStyle(3, color, alpha).setDepth(DEPTH.popup - 1);
    this.tweens.add({ targets: r, scale: 3, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
  },

  // "IT'S A MONSTER HOUSE!": huge, it slams in with a shake and a red flash, wobbles, then fades. Then the elites' names.
  monsterHouseBanner() {
    sfx.play('bossIntro');
    this.cameras.main.flash(180, 120, 20, 20);
    this.cameras.main.shake(320, 0.008);
    const y = 300;
    const style = { fontFamily: UI.font, stroke: '#000000', strokeThickness: 7, align: 'center' };
    const top = this.add.text(GAME_WIDTH / 2, y - 30, "IT'S A", { ...style, fontSize: '24px', color: '#ffd24d' }).setOrigin(0.5).setDepth(DEPTH.popup + 2);
    const big = this.add.text(GAME_WIDTH / 2, y + 8, 'MONSTER HOUSE!', { ...style, fontSize: '24px', color: '#ff4a3a' }).setOrigin(0.5).setDepth(DEPTH.popup + 2);
    if (big.width > GAME_WIDTH - 12) big.setFontSize(Math.floor((34 * (GAME_WIDTH - 12)) / big.width));
    for (const [t, d] of [[top, 0], [big, 90]]) {
      t.setScale(2.6).setAlpha(0);
      this.tweens.add({ targets: t, scale: 1, alpha: 1, delay: d, duration: 260, ease: 'Back.easeOut' });
      this.tweens.add({ targets: t, angle: { from: -3, to: 3 }, delay: d + 260, duration: 140, yoyo: true, repeat: 4 });
      this.tweens.add({ targets: t, alpha: 0, y: t.y - 24, delay: 1900 + d, duration: 450, onComplete: () => t.destroy() });
    }
    this.time.delayedCall(2300, () => { for (const v of this.views.values()) if (v.unit.elite && v.unit.alive) this.eliteName(v); });
  },

  // A boss move's name, big and red, in the middle of the screen.
  bossBanner(text) {
    const b = this.add
      .text(GAME_WIDTH / 2, FX.bannerY - 40, text, { fontFamily: UI.font, fontSize: '16px', color: '#ff6a5a', stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(DEPTH.popup + 1)
      .setScale(1.4);
    b.x = Phaser.Math.Clamp(b.x, b.width / 2 + 4, GAME_WIDTH - b.width / 2 - 4);
    this.tweens.add({ targets: b, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: b, alpha: 0, y: b.y - 16, delay: 900, duration: 400, onComplete: () => b.destroy() });
  },
};
