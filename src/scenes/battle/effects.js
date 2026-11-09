// Part of BattleScene (mixed into its prototype at the bottom of ../BattleScene.js; `this` is the scene).
// Drawn effects: status body effects, elites, bombs, hit / item effects, pop-up words, deaths and graves (docs/systems/effects.md, statuses.md).
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CHAR_SCALE, UI } from '../../config.js';
import combatRules from '../../data/combat.json';
import damageTypes from '../../data/damageTypes.json';
import * as sfx from '../../audio/sfx.js';
import { itemIconKey } from '../../entities/itemIconTexture.js';
import itemFxData from '../../data/itemFx.json';
import * as itemFx from '../../systems/itemFx.js';
import { statusLook, iceBreak, bodyBox } from '../../systems/statusFx.js';
import { eliteGlow, crownPixels } from '../../systems/eliteFx.js';
import * as bossFx from '../../systems/bossFx.js';
import { projectileFx, impactFx, critFx, IMPACT_MS, ELEMENT_SLASH, CRIT_MS, MOMENT_MS, dodgeFx, blockFx, soakFx, shieldBreakFx, healFx, graceFx, deathPuffFx } from '../../systems/hitFx.js';
import { BAR_WIDTH, POP_REPEAT_MS, FX, itemDefs, TUNE, charScale, DEPTH } from './shared.js';

export const effectsMethods = {
  // A little cloud of puffs at a spot (spawn / vanish cue).
  puff(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      const dx = (i - (count - 1) / 2) * 7;
      const c = this.add.circle(x + dx, y - 2, 5 + (i % 3) * 2, color, 0.8).setDepth(DEPTH.popup - 2);
      this.tweens.add({ targets: c, y: y - 22 - (i % 3) * 8, x: x + dx * 1.6, alpha: 0, scale: 1.6, duration: 520 + (i % 3) * 90, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
    }
  },

  drawStatusFx() {
    this.drawHeroHud();
    this.drawHitFx(); // hits first: a hit's colour flash wins over the status tint this frame
    if (!this.statusG) this.statusG = this.add.graphics().setDepth(DEPTH.heroBar - 0.05);
    const g = this.statusG;
    g.clear();
    const now = this.time.now;
    for (const v of this.views.values()) {
      const u = v.unit;
      if (!u.alive || !v.ch.active) { if (v.ch.active) v.ch.setStatusLook(null, 0); continue; }
      const kinds = {};
      for (const st of u.statuses) {
        const age = isFinite(st.total) && isFinite(st.remaining) ? st.total - st.remaining : 1e9;
        const k = kinds[st.type] || (kinds[st.type] = { stacks: 0, age: Infinity });
        k.stacks += 1;
        k.age = Math.min(k.age, age);
      }
      if (kinds.shield && u.statuses.some((st) => st.key === 'shield:fireheart')) { // Fire Heart: a red, fiery shield
        kinds.fireShield = kinds.shield;
        if (!u.statuses.some((st) => st.type === 'shield' && st.key !== 'shield:fireheart')) delete kinds.shield;
      }
      if (u.side === 'hero' && u.items && u.items.includes('heart_of_the_beast') && this.state.enemies.some((en) => en.alive)) { // Heart of the Beast: orange regen wins
        kinds.beastRegen = kinds.regenBoost || { stacks: 1, age: 1e9 };
        delete kinds.regenBoost;
      }
      // Frost Warden's Frozen Rest: he looks frozen while he heals (a `selfFreeze` channel), and the ice breaks off after.
      const c = u.bossCast, selfFrozen = !!(c && c.channel && c.channel.spec.selfFreeze);
      if (selfFrozen) kinds.freeze = { stacks: 1, age: c.total - c.remaining };
      if (v.selfFrozen && !selfFrozen) {
        this.iceBreaks.push({ view: v, start: now });
        this.cameras.main.shake(160, 0.004);
        if (u.alive) this.popText(v, 'The ice breaks!', '#bfe0ff', true);
      }
      v.selfFrozen = selfFrozen;
      if (!v.box) v.box = bodyBox(u.def.parts, u.def.height);
      let look;
      try { look = statusLook(kinds, v.box, now + (u.uid % 7) * 137, TUNE); } // each fighter a little out of step
      catch (err) { console.error(err); continue; } // a broken effect must never stop the fight
      v.ch.setStatusLook((!selfFrozen && v.hitTint) || look.tint, look.ice); // frozen: the ice wins over the green heal glow
      // Still sliding in with its floor (an elite's shield at the start): the screen-space effects wait until it
      // has arrived, or they were drawn at its final spot before the enemy got there.
      if (v.ch.parentContainer) continue;
      this.nudge(v, look.dx * Math.abs(v.ch.scaleY));
      this.paintFx(g, v, look.draws);
      if (u.def.plates && u.plates > 0 && u.alive) { // Frost Warden: his ice armor plates, one per plate left
        const S = CHAR_SCALE;
        for (const [x, y, w, h, col, a] of bossFx.platesFx(this.fxBody(v), u.plates, now)) { g.fillStyle(col, a); g.fillRect(x * S - S / 2, y * S, w * S, h * S); }
      }
      if (selfFrozen) { // Frozen Rest: frost motes rise off him while he heals (char pixels, like the hit effects)
        const S = CHAR_SCALE;
        for (const [x, y, w, h, col, a] of bossFx.frostHealFx(this.fxBody(v), now)) { g.fillStyle(col, a); g.fillRect(x * S - S / 2, y * S, w * S, h * S); }
      }
    }
    this.drawElites(now);
    this.drawBombs(now);
    this.drawThunders(now);
    // Assault Breastplate's ARMOR DOWN icon comes and goes with its holder (item given, holder fell): redraw enemy icons.
    const shred = this.assaultCopies();
    for (const e of this.state.enemies) {
      const ev = this.views.get(e.uid);
      if (ev && e.alive && ev.shredShown !== shred) { ev.shredShown = shred; this.drawChips(ev); } // new enemies get it too
    }
    this.drawOrders();
    // Ice breaking off a fighter whose Freeze just ended.
    this.iceBreaks = (this.iceBreaks || []).filter((b) => now - b.start < 400 && b.view.ch.active);
    for (const b of this.iceBreaks) this.paintFx(g, b.view, iceBreak(b.view.box || bodyBox(b.view.unit.def.parts, b.view.unit.def.height), (now - b.start) / 400));
  },

  // ELITES (systems/eliteFx.js): a glow in the element colour, drawn BEHIND every fighter (a halo on the floor and
  // motes rising along the body), and a small gold crown just left of the health bar. Only once the enemy has left
  // its floor container (the fight has started).
  drawElites(now) {
    if (!this.eliteG) this.eliteG = this.add.graphics().setDepth(DEPTH.hero - 0.001);
    if (!this.crownG) this.crownG = this.add.graphics().setDepth(DEPTH.heroBar);
    const g = this.eliteG, cg = this.crownG;
    g.clear();
    cg.clear();
    const crown = (this.crown = this.crown || crownPixels());
    for (const v of this.views.values()) {
      const u = v.unit;
      if (u.adapt && u.alive && v.ch.active && !v.ch.parentContainer) { // Crystal Sentinel: a glow in the colour of what it resists
        if (!v.box) v.box = bodyBox(u.def.parts, u.def.height);
        this.paintFx(g, v, eliteGlow(v.box, Phaser.Display.Color.HexStringToColor(damageTypes[u.adapt.type].color).color, now + u.uid * 97));
      }
      if (!u.elite || !u.alive || u.burrowed || !v.ch.active || v.ch.parentContainer) continue;
      if (!v.box) v.box = bodyBox(u.def.parts, u.def.height);
      const color = (u.elite.colorInt ??= Phaser.Display.Color.HexStringToColor(u.elite.color).color);
      this.paintFx(g, v, eliteGlow(v.box, color, now + u.uid * 97));
      if (!v.bg.visible) continue;
      const P = 2; // crown pixel size
      const x0 = v.bg.x - BAR_WIDTH / 2 - 1 - 6 * P, y0 = v.bg.y - 2 * P;
      for (const [c, r, col] of crown) cg.fillStyle(col, v.bg.alpha).fillRect(x0 + c * P, y0 + r * P, P, P);
    }
  },

  // Kobold Sapper bombs (BattleState.bombs): a red danger ring on the floor that fills up, and a black pixel bomb with a
  // spark on its fuse that blinks faster as it gets close. The blast itself is the `deathBurst` event.
  drawBombs(now) {
    if (!this.bombG) this.bombG = this.add.graphics().setDepth(DEPTH.hero - 0.002); // the ring: on the floor, behind fighters
    if (!this.bombTopG) this.bombTopG = this.add.graphics().setDepth(DEPTH.heroBar - 0.06); // the bomb: in front of them
    const g = this.bombG, top = this.bombTopG;
    g.clear();
    top.clear();
    const P = CHAR_SCALE;
    for (const b of this.state.bombs || []) {
      const p = 1 - b.remaining / b.total; // 0 when dropped, 1 when it goes off
      g.lineStyle(2, 0xff4a3a, 0.35 + 0.4 * p).strokeEllipse(b.x, b.y, b.radius * 2, b.radius * 1.4);
      g.fillStyle(0xff4a3a, 0.08 + 0.16 * p).fillEllipse(b.x, b.y, b.radius * 2 * p, b.radius * 1.4 * p);
      const x = Math.round(b.x / P) * P, y = Math.round((b.y - 4) / P) * P;
      const rows = ['..ooo..', '.oxhxo.', 'oxhxxxo', 'oxxxxxo', 'oxxxxxo', '.oxxxo.', '..ooo..'];
      const col = { o: 0x0a0610, x: 0x3e3e4e, h: 0x9a9ab4 };
      rows.forEach((r, ry) => [...r].forEach((c, rx) => { if (c !== '.') top.fillStyle(col[c], 1).fillRect(x + (rx - 3) * P, y + (ry - 7) * P, P, P); }));
      top.fillStyle(0x9a6b3a, 1).fillRect(x + 1 * P, y - 8 * P, P, P).fillRect(x + 2 * P, y - 9 * P, P, P); // the fuse
      const blink = Math.sin(now / (120 - 90 * p)) > 0; // the spark blinks faster near the end
      top.fillStyle(blink ? 0xffffff : 0xffe066, 1).fillRect(x + 3 * P, y - 10 * P, P, P);
      if (blink) top.fillStyle(0xff7a2a, 1).fillRect(x + 4 * P, y - 10 * P, P, P).fillRect(x + 3 * P, y - 11 * P, P, P).fillRect(x + 2 * P, y - 10 * P, P, P);
    }
  },

  // Thunderstruck (BattleState.thunders): an electric circle grows on the floor under the marked enemy and follows it;
  // the bolt itself is the `thunderstruck` event (itemFx.thunderstruckFx).
  drawThunders(now) {
    if (!this.thunderG) this.thunderG = this.add.graphics().setDepth(DEPTH.hero - 0.001); // on the floor, behind fighters
    const g = this.thunderG, P = CHAR_SCALE;
    g.clear();
    for (const t of this.state.thunders || []) {
      const v = this.views.get(t.target.uid);
      if (!v || !v.ch.active) continue;
      const f = { x: v.ch.x / P, y: (v.ch.y + v.ch.hopOffset + (v.groundY - v.ch.homeY) + 2) / P };
      const draws = itemFx.thunderMarkFx(1 - t.remaining / t.total, f, t.target.def.boss ? 24 : 15, now, t.uid);
      for (const [x, y, w, h, c, a] of draws) g.fillStyle(c, a).fillRect(x * P, y * P, w * P, h * P);
    }
  },

  // An elite's name pops up over it when the fight starts ("Burning Vampiric" / "Bandit"), in its element colour.
  eliteName(v) {
    const u = v.unit;
    const base = u.def.eliteOf ? u.def.eliteOf.name : '';
    const head = base && u.name.endsWith(base) ? u.name.slice(0, -base.length).trim() : u.name;
    const t = this.add
      .text(v.ch.x, 0, base ? `${head}\n${base}` : head, { fontFamily: UI.font, fontSize: '8px', color: u.elite.color, stroke: '#000000', strokeThickness: 3, align: 'center' })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.popup);
    // The tag FOLLOWS the elite while it walks (screen review), rising a little as it fades.
    const rise = { d: 0 };
    const follow = () => {
      if (!v.ch.active) return;
      t.x = Phaser.Math.Clamp(Math.round(v.ch.x), t.width / 2 + 4, GAME_WIDTH - t.width / 2 - 4);
      t.y = Math.round(v.ch.y - u.def.height * charScale(u.def) - 30 - rise.d);
    };
    follow();
    this.events.on('update', follow);
    t.once('destroy', () => this.events.off('update', follow));
    t.setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: rise, d: 16, delay: 1900, duration: 600 });
    this.tweens.add({ targets: t, alpha: 0, delay: 1900, duration: 600, onComplete: () => t.destroy() });
    this.ring(v, Phaser.Display.Color.HexStringToColor(u.elite.color).color);
  },

  // HITS (systems/hitFx.js): shots in the air (arrow, fire bolt, ice shard, lightning, dark orb, holy mote)
  // and what happens where they land, per damage type, plus the crit layer. Drawn every frame in
  // character pixels (world / CHAR_SCALE) so everything stays on the pixel grid.
  drawHitFx() {
    if (!this.hitG) this.hitG = this.add.graphics().setDepth(DEPTH.popup - 1);
    const g = this.hitG;
    g.clear();
    const now = this.time.now, S = CHAR_SCALE;
    for (const v of this.views.values()) { v.hitTint = null; }
    const draw = (draws) => { for (const [x, y, w, h, c, a] of draws) { g.fillStyle(c, a); g.fillRect(x * S - S / 2, y * S, w * S, h * S); } };
    const at = (v) => { const c = this.center(v); return { x: c.x / S, y: c.y / S }; };
    // Shots in the air.
    for (const v of this.views.values()) {
      const arrow = v.arrow;
      if (!arrow || !arrow.active) continue;
      const head = { x: arrow.x / S, y: arrow.y / S };
      const start = arrow.kind === 'electric' && v.ch.active ? at(v) : { x: arrow.startX / S, y: arrow.startY / S };
      draw(TUNE.paint('shot', arrow.kind, projectileFx(arrow.kind, start, head, now * TUNE.speed('shot', arrow.kind), v.unit.uid)));
    }
    // Item effects and other timed recipes (addFx): each returns its pixels for its progress q.
    this.fxList = (this.fxList || []).filter((f) => now - f.start < f.ms);
    for (const f of this.fxList) {
      try {
        const out = f.fn((now - f.start) / f.ms, now);
        if (Array.isArray(out)) { draw(out); continue; }
        draw(out.draws || []);
        for (const [v, tint] of out.tints || []) if (v && tint && (!v.hitTint || tint[1] > v.hitTint[1])) v.hitTint = tint; // a skill colours fighters for a moment
      } catch (err) { console.error(err); f.ms = 0; }
    }
    // Excalibur tornadoes: a swirling pixel funnel where each one is.
    if (this.tornadoViews) for (const tv of this.tornadoViews.values()) if (tv.g.active) draw(TUNE.paint('item', 'tornado', itemFx.tornadoFx(tv.g.x / S, tv.g.y / S, now * TUNE.speed('item', 'tornado'))));
    // Impacts and other hit moments (they follow the fighter while they play). A death puff stays put.
    this.impacts = (this.impacts || []).filter((h) => now - h.start < h.ms && (h.kind === 'puff' || h.view.ch.active));
    for (const h of this.impacts) {
      const paint = (name, draws) => draw(TUNE.paint('hit', name, draws));
      if (h.kind === 'puff') { paint('puff', deathPuffFx((now - h.start) / h.ms, h.x, h.y)); continue; }
      const v = h.view, ch = v.ch;
      if (h.attacker && h.attacker.ch.active) h.side = h.attacker.ch.x < ch.x ? -1 : 1;
      const u = { ...this.fxBody(v), side: h.side };
      const { x, y } = u;
      const q = (now - h.start) / h.ms;
      if (h.crit) { paint('crit', critFx(q, u, now)); continue; }
      if (h.kind) {
        if (h.kind === 'dodge') { const o = dodgeFx(q, u); paint('dodge', o.draws); this.nudge(v, o.dx * S); }
        else if (h.kind === 'block') paint('block', blockFx(q, u));
        else if (h.kind === 'soak') paint('soak', soakFx(q, u));
        else if (h.kind === 'shieldBreak') paint('shieldBreak', shieldBreakFx(q, u));
        else if (h.kind === 'grace') { const o = graceFx(q, u, now); paint('grace', o.draws); if (o.tint) v.hitTint = [TUNE.color('hit', 'grace', o.tint[0]), o.tint[1]]; }
        else if (h.kind === 'heal') { const o = healFx(q, u, h.seed); paint('heal', o.draws); if (o.tint && !v.hitTint) v.hitTint = [TUNE.color('hit', 'heal', o.tint[0]), o.tint[1]]; }
        continue;
      }
      const out = impactFx(h.type, q, u, now, h.seed, h.attacker && h.attacker.ch.active ? at(h.attacker) : null, h.melee);
      if (h.ghastly) { draw(TUNE.paint('item', 'ghastlyFire', itemFx.ghastlyDraws(out.draws, u))); continue; } // Ghastly Fire: the fire hit, bigger and purple
      paint(h.type, out.draws);
      if (out.tint && (!v.hitTint || out.tint[1] > v.hitTint[1])) v.hitTint = [TUNE.color('hit', h.type, out.tint[0]), out.tint[1]];
      this.nudge(v, out.dx * S);
    }
  },

  // Effects may nudge a figure sideways for one frame (a twitch, a side-step). That only works for
  // figures that followPositions() puts back on their spot every frame: living, placed and not
  // mid-jab. Anything else (a dead enemy squashing into the floor) would keep the nudges and slide away.
  // A one-frame sideways nudge (twitch, side-step, shake). Several in the same frame do NOT pile up:
  // the total never goes past the biggest single one (so a fighter missed by three heroes at once doesn't
  // jump far away), and nudges from opposite sides cancel out (no flicker).
  nudge(v, px) {
    if (!px || !this.shakeable(v)) return;
    const frame = this.game.loop.frame;
    if (v.nudgeFrame !== frame) { v.nudgeFrame = frame; v.nudgeSum = 0; v.nudgeMax = 0; v.nudgeX = 0; }
    v.nudgeSum += px;
    v.nudgeMax = Math.max(v.nudgeMax, Math.abs(px));
    const want = Math.max(-v.nudgeMax, Math.min(v.nudgeMax, v.nudgeSum));
    v.ch.x += want - v.nudgeX;
    v.nudgeX = want;
  },

  shakeable(v) {
    return this.mode === 'fighting' && v.unit.alive && v.unit.x !== undefined && !v.ch.lunging;
  },

  // A timed effect: fn(q, now) returns pixel draws (character pixels) while q goes 0..1 over ms.
  // tag = [group, name]: the effect's Studio settings (data/effects.json) change its speed and colours.
  addFx(ms, fn, tag = null) {
    let run = fn;
    if (tag) {
      const [group, name] = tag;
      ms = TUNE.ms(group, name, ms);
      run = (q, now) => {
        const out = fn(q, now);
        if (Array.isArray(out)) return TUNE.paint(group, name, out);
        return { ...out, draws: TUNE.paint(group, name, out.draws || []), tints: (out.tints || []).map(([v, t]) => [v, t && [TUNE.color(group, name, t[0]), t[1]]]) };
      };
    }
    (this.fxList = this.fxList || []).push({ start: this.time.now, ms, fn: run });
  },

  // Where a fighter is, in character pixels: its middle (pt) and its body (body, as the fx recipes want it).
  fxPoint(v) {
    const c = this.center(v);
    return { x: c.x / CHAR_SCALE, y: c.y / CHAR_SCALE };
  },

  // A giant icicle bursts up round a fighter (Frozen Demon Head, Frost Warden's Ice Spikes); it holds still inside while
  // it is frozen, then the icicle shatters (freeze over, or it died). itemFx.iceSpikeFx. A fighter already inside one
  // keeps that icicle (its freeze was refreshed, so it stands longer).
  encaseIcicle(v) {
    if (v.icicle) return;
    let body = this.fxBody(v), shatterAt = null;
    const start = this.time.now;
    v.ch.encase(true);
    v.icicle = true;
    this.addFx(itemFx.ITEM_MS.iceSpike * 20, (q, now) => {
      const ms = now - start;
      // (it also shatters near the effect's end, a very long refreshed freeze: else the fighter stayed stuck in its pose)
      if (shatterAt === null && ms > itemFx.ICE_SPIKE.growMs && (q > 0.9 || !v.ch.active || !v.unit.alive || !v.unit.statuses.some((st) => st.type === 'freeze'))) {
        shatterAt = ms;
        v.icicle = false;
        if (v.ch.active) v.ch.encase(false);
        this.cameras.main.shake(110, 0.003);
      }
      if (v.ch.active && shatterAt === null) body = this.fxBody(v);
      return shatterAt !== null && ms - shatterAt > itemFx.ICE_SPIKE.shatterMs ? [] : itemFx.iceSpikeFx(ms, body, now, shatterAt);
    }, ['item', 'iceSpike']);
  },

  fxBody(v) {
    if (!v.box) v.box = bodyBox(v.unit.def.parts, v.unit.def.height);
    const k = charScale(v.unit.def) / CHAR_SCALE; // a boss's body box is in its own (finer) pixels
    const x = (v.ch.x + v.box.cx * v.ch.scaleX) / CHAR_SCALE, y = v.ch.y / CHAR_SCALE;
    const b = { x, y, top: y + v.box.top * k, mid: y + v.box.mid * k, bot: y + v.box.bot * k, hw: v.box.hw * k };
    // The weapon part (staff, bow, lute, flask, sword): the skill looks anchor on it, so they follow a redesigned hero.
    const w = v.unit.def.parts && v.unit.def.parts.weapon;
    if (w) { b.wx = (v.ch.x + w.x * v.ch.scaleX) / CHAR_SCALE; b.wy = y + w.y * k; b.wtop = y + (w.y - w.h / 2) * k; b.wbot = y + (w.y + w.h / 2) * k; }
    return b;
  },

  // An item went off: its icon pops over the holder (instead of a text label) and its own effect plays
  // (src/data/itemFx.json says which; systems/itemFx.js draws it).
  itemProc(e, v) {
    const spec = itemFxData[e.itemId];
    if (!(spec && spec.noPop)) { // frequent simple procs (Quiver, Metronome) stay quiet: no icon, no sound
      sfx.play('itemProc');
      this.iconPop(v, e.itemId);
    }
    if (spec && spec.text) this.popText(v, spec.text, spec.textColor || '#cfe8ff'); // e.g. Mirror Buckler: 'Reflected!'
    if (!spec || !spec.effect) return;
    const ms = itemFx.ITEM_MS[spec.effect];
    const tag = ['item', spec.effect];
    const tv = e.target ? this.views.get(e.target.uid) : null;
    if (spec.effect === 'battleCry') {
      const color = spec.color ? Number(spec.color) : undefined;
      const squad = this.state.heroes.filter((h) => h.alive).map((h) => this.views.get(h.uid)).filter(Boolean);
      this.addFx(ms, (q, now) => [...itemFx.battleCryFx(q, this.fxBody(v), color), ...squad.flatMap((h) => (h.ch.active ? itemFx.speedLinesFx(q, this.fxBody(h), now, color) : []))], tag);
    } else if (spec.effect === 'shatter' && tv) {
      const at = this.fxBody(tv);
      this.addFx(ms, (q) => itemFx.shatterFx(q, tv.ch.active ? this.fxBody(tv) : at), tag);
      this.cameras.main.shake(110, 0.004);
    } else if (spec.effect === 'knifeBurst' && e.at) {
      const dv = this.views.get(e.at.uid);
      if (!dv) return;
      const b = this.fxBody(dv); // where the enemy died (it is gone soon)
      this.addFx(ms, (q) => itemFx.knifeBurstFx(q, b.x, b.mid), tag);
    } else if (spec.effect === 'plague' && e.from && e.to) {
      const fv = this.views.get(e.from.uid);
      if (!fv) return;
      const a = this.fxPoint(fv);
      for (const o of e.to) {
        const ov = this.views.get(o.uid);
        if (ov) this.addFx(ms, (q, now) => itemFx.plagueFx(q, a, ov.ch.active ? this.fxPoint(ov) : a, now), tag);
      }
    } else if (spec.effect === 'thunderbolt' && tv) {
      this.addFx(ms, (q) => (tv.ch.active ? itemFx.thunderboltFx(q, this.fxBody(tv)) : []), tag);
    } else if (spec.effect === 'suckerPunch' && tv) {
      const side = v.ch.x < tv.ch.x ? -1 : 1;
      this.addFx(ms, (q) => (tv.ch.active ? itemFx.suckerPunchFx(q, this.fxBody(tv), side) : []), tag);
    } else if (spec.effect === 'euclid' && tv && v) { // Euclid of Elements: one projectile per extra cast, landing as it hits
      const els = e.elements && e.elements.length ? e.elements : ['fire', 'ice', 'electric'];
      let from = this.fxPoint(v), to = this.fxPoint(tv);
      this.addFx(ms, (q, now) => {
        if (v.ch.active) from = this.fxPoint(v);
        if (tv.ch.active) to = this.fxPoint(tv);
        return itemFx.euclidFx(q, from, to, now, els, e.staggerMs, e.count);
      }, tag);
    } else if (spec.effect === 'heartSlash' && tv) { // Sharpest Blade: a huge yellow slash through the enemy
      const at = this.fxBody(tv), side = v && v.ch.x < tv.ch.x ? -1 : 1;
      this.addFx(ms, (q) => itemFx.heartSlashFx(q, tv.ch.active ? this.fxBody(tv) : at, side), tag);
      this.cameras.main.shake(120, 0.004);
    } else if (spec.effect === 'executioner' && tv) {
      const at = this.fxBody(tv); // the enemy may die from this very hit
      this.addFx(ms, (q) => itemFx.executionerFx(q, tv.ch.active ? this.fxBody(tv) : at), tag);
    } else if (spec.effect === 'dice' && tv) {
      const at = this.fxBody(tv);
      this.addFx(ms, (q, now) => itemFx.diceFx(q, tv.ch.active ? this.fxBody(tv) : at, now), tag);
    } else if (spec.effect === 'mimic') {
      const b = this.fxBody(v);
      this.addFx(ms, (q, now) => itemFx.mimicFx(q, b.x + b.hw + 6, b.y, now), tag); // beside the holder
    } else if (spec.effect === 'aegisBlast') {
      this.addFx(ms, (q) => (v.ch.active ? itemFx.aegisBlastFx(q, this.fxBody(v)) : []), tag);
    } else if (spec.effect === 'spiritAxe') {
      this.addFx(ms, (q, now) => (v.ch.active ? itemFx.spiritAxeFx(q, this.fxBody(v), now) : []), tag);
    }
  },

  // The item's framed icon jumps up over the holder, holds, then floats up and fades. itemFx.json iconPop.stack
  // decides what happens when many fire at once (user, session 26: the row of 5 moons over the Archer):
  // 'count' = the same item again bumps its icon and shows x2, x3...; 'bounce' = the same, no number;
  // 'queue' = one icon at a time, the others wait their turn; 'deck' = dealt like cards onto one pile, deckGapMs
  // apart, each card fading on its own; 'row' = the old way, all side by side.
  // Different items stand side by side, at most maxSide (more are skipped).
  iconPop(v, itemId) {
    const def = itemDefs[itemId];
    if (!v || !def || !v.ch.active) return;
    const cfg = itemFxData.iconPop;
    const stack = cfg.stack || 'row';
    if (stack === 'deck') return this.dealPop(v, itemId);
    v.pops = (v.pops || []).filter((o) => o.active);
    if (stack === 'queue' && v.pops.length) {
      v.popQueue = v.popQueue || [];
      if (v.popQueue.length < (cfg.queueMax || 3) && !v.popQueue.includes(itemId)) v.popQueue.push(itemId);
      return;
    }
    if (stack === 'count' || stack === 'bounce') {
      const same = v.pops.find((o) => o.itemId === itemId);
      if (same) return this.bumpPop(same, stack === 'count');
      if (v.pops.length >= (cfg.maxSide || 3)) return;
    }
    const n = v.pops.length;
    // Extra pops stand side by side; near a side of the screen they line up towards the middle
    // instead, so none is cut off by the edge.
    const half = (20 * cfg.scale) / 2 + 4;
    const nearEdge = v.ch.x < GAME_WIDTH * 0.3 ? 1 : v.ch.x > GAME_WIDTH * 0.7 ? -1 : 0;
    const offset = nearEdge ? nearEdge * n * cfg.gapPx : (n ? (n % 2 ? 1 : -1) * Math.ceil(n / 2) * cfg.gapPx : 0);
    // It FOLLOWS the hero (user): placed every frame just above the bar, however big the icon is.
    const spot = () => ({ x: Phaser.Math.Clamp(v.ch.x + offset, half, GAME_WIDTH - half), y: v.bg.y - (10 * cfg.scale + 4) });
    const lift = { d: 12 };
    const img = this.add.image(spot().x, spot().y + lift.d, itemIconKey(this, itemId, def.rarity)).setScale(cfg.scale).setDepth(DEPTH.popup);
    Object.assign(img, { itemId, lift, count: 1, label: null });
    const follow = () => {
      if (!v.ch.active) return;
      const p = spot();
      img.setPosition(Math.round(p.x), Math.round(p.y + lift.d));
      if (img.label) img.label.setPosition(img.x + 10 * cfg.scale, img.y + 9 * cfg.scale).setAlpha(img.alpha);
    };
    this.events.on('update', follow);
    img.once('destroy', () => {
      this.events.off('update', follow);
      if (img.label) img.label.destroy();
      // The queue: the next waiting item pops (a little quicker) once this one is gone.
      const next = v.popQueue && v.popQueue.shift();
      if (next && v.ch.active) this.iconPop(v, next);
    });
    v.pops.push(img);
    const ms = cfg.ms * (stack === 'queue' && v.popQueue && v.popQueue.length ? cfg.queueMsShare || 1 : 1);
    this.tweens.add({ targets: lift, d: 0, duration: ms * 0.25, ease: 'Back.easeOut' });
    this.fadePop(img, ms);
    // a white ring flashes out from the icon as it appears (and moves with it)
    this.addFx(ms * 0.25, (q) => { const out = []; const c = { x: img.x / CHAR_SCALE, y: img.y / CHAR_SCALE }; const r = (9 + q * 16) * (cfg.scale / CHAR_SCALE); for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; out.push([Math.round(c.x + Math.cos(a) * r), Math.round(c.y + Math.sin(a) * r), 1, 1, 0xffffff, 1 - q]); } return out; });
  },

  // 'deck': the icon is dealt onto a pile over the hero like a card: deckGapMs after the last one, a little up and
  // right of it (deckStepPx), slapping down from big. Each card rises and fades on its own like a normal pop (user);
  // the cards above slide down into the gap. More than deckMax cards: the bottom card goes.
  dealPop(v, itemId) {
    const def = itemDefs[itemId];
    const cfg = itemFxData.iconPop;
    const d = (v.deck = v.deck || { cards: [], nextAt: 0 });
    const now = this.time.now;
    const at = Math.max(now, d.nextAt);
    // A full backlog drops the card (many procs a second: the waiting cards were dealt long after, even on the next floor).
    if (at - now >= (cfg.deckGapMs || 50) * (cfg.deckMax || 6)) return;
    d.nextAt = at + (cfg.deckGapMs || 50);
    this.time.delayedCall(at - now, () => {
      if (!v.ch.active) return;
      d.cards = d.cards.filter((c) => c.active);
      while (d.cards.length >= (cfg.deckMax || 6)) d.cards.shift().destroy();
      const half = (20 * cfg.scale) / 2 + 4;
      const step = cfg.deckStepPx || 4;
      const img = this.add.image(0, 0, itemIconKey(this, itemId, def.rarity)).setScale(cfg.scale * 1.4).setDepth(DEPTH.popup + d.cards.length * 0.001);
      Object.assign(img, { slot: d.cards.length, lift: { d: 0 } });
      const place = () => {
        if (!v.ch.active || !img.active) return;
        const k = img.slot;
        img.setPosition(Math.round(Phaser.Math.Clamp(v.ch.x - step + k * step, half, GAME_WIDTH - half - 24)), Math.round(v.bg.y - (10 * cfg.scale + 4) - k * step + img.lift.d));
      };
      place();
      this.events.on('update', place);
      img.once('destroy', () => {
        this.events.off('update', place);
        d.cards = d.cards.filter((c) => c !== img && c.active);
        d.cards.forEach((c, i) => (c.slot = i));
      });
      d.cards.push(img);
      d.cards.forEach((c, i) => (c.slot = i));
      this.tweens.add({ targets: img, scale: cfg.scale, duration: 90, ease: 'Quad.easeIn' });
      this.fadePop(img, cfg.ms);
    });
  },

  // The hold, then the icon floats up and fades (started again when the same item fires again).
  fadePop(img, ms) {
    const cfg = itemFxData.iconPop;
    if (img.fade) img.fade.forEach((t) => t.remove());
    img.setAlpha(1);
    img.fade = [
      this.tweens.add({ targets: img.lift, d: -cfg.riseCharPx * CHAR_SCALE, delay: ms * 0.7, duration: ms * 0.3 }),
      this.tweens.add({ targets: img, alpha: 0, delay: ms * 0.7, duration: ms * 0.3, onComplete: () => img.destroy() }),
    ];
  },

  // The same item fired again while its icon is up: the icon jumps a little, stays longer, and (count) shows x2, x3...
  bumpPop(img, showCount) {
    const cfg = itemFxData.iconPop;
    img.count += 1;
    this.tweens.killTweensOf(img.lift);
    img.lift.d = Math.min(img.lift.d, 0) + 6;
    this.tweens.add({ targets: img.lift, d: 0, duration: cfg.ms * 0.2, ease: 'Back.easeOut' });
    this.fadePop(img, cfg.ms);
    if (!showCount) return;
    if (!img.label) img.label = this.add.text(img.x, img.y, '', { fontFamily: UI.font, fontSize: '8px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(DEPTH.popup + 0.1);
    img.label.setText(`x${img.count}`).setScale(1.5);
    this.tweens.add({ targets: img.label, scale: 1, duration: 160, ease: 'Back.easeOut' });
  },

  // Where an AREA skill lands: a faint ring (circle), wedge (cone) or strip (band) on the floor that
  // flashes and fades, so you can see who is inside (BattleState.areaHit).
  showZone(z, ms) {
    const g = this.add.graphics().setDepth(DEPTH.marker);
    const color = Number(FX.areaColor);
    const draw = (q) => {
      g.clear();
      const a = 0.5 * (1 - q);
      g.fillStyle(color, a * 0.35).lineStyle(2, color, a);
      if (z.shape === 'band') {
        g.fillRect(0, z.y - z.halfHeight, GAME_WIDTH, z.halfHeight * 2).lineBetween(0, z.y - z.halfHeight, GAME_WIDTH, z.y - z.halfHeight).lineBetween(0, z.y + z.halfHeight, GAME_WIDTH, z.y + z.halfHeight);
      } else if (z.shape === 'cone') {
        g.slice(z.x, z.y, z.range, z.dir - z.half, z.dir + z.half, false).fillPath().strokePath();
      } else {
        const grow = 0.85 + 0.15 * Math.min(1, q * 4);
        g.fillEllipse(z.x, z.y, z.radius * 2 * grow, z.radius * 2 * z.ySquash * grow).strokeEllipse(z.x, z.y, z.radius * 2 * grow, z.radius * 2 * z.ySquash * grow);
      }
    };
    draw(0);
    this.tweens.addCounter({ from: 0, to: 1, duration: ms, onUpdate: (tw) => draw(tw.getValue()), onComplete: () => g.destroy() });
  },

  // Starts one of the other hit moments on a fighter: 'dodge', 'block', 'soak', 'shieldBreak', 'heal'.
  addMoment(kind, v, attacker = null) {
    if (!v || !v.ch || !v.ch.active) return;
    const side = attacker && attacker.ch && attacker.ch.x < v.ch.x ? -1 : 1;
    const seed = (this.impactSeed = (this.impactSeed || 0) + 1);
    (this.impacts = this.impacts || []).push({ kind, start: this.time.now, ms: TUNE.ms('hit', kind, MOMENT_MS[kind]), view: v, attacker, side, seed });
  },

  // A hit landed: start its impact effect (and the crit layer) on the target.
  addImpact(e, a, t) {
    const type = IMPACT_MS[e.damageType] ? e.damageType : IMPACT_MS[e.attacker.damageType] ? e.attacker.damageType : 'melee';
    const side = a && a.ch.x < t.ch.x ? -1 : 1;
    const seed = (this.impactSeed = (this.impactSeed || 0) + 1);
    const ghastly = type === 'fire' && e.attacker.side === 'hero' && !e.attacker.minion && e.attacker.specials && e.attacker.specials.ghastly > 0;
    // An elemental MELEE basic hit (a fire elite's sword, Ice Spirit Knight): the slash in the element's colour.
    const melee = !!e.basic && !e.rider && !ghastly && e.attacker.damageType === 'melee' && !!ELEMENT_SLASH[type];
    const ms = melee ? TUNE.ms('hit', 'melee', IMPACT_MS.melee) : TUNE.ms('hit', type, IMPACT_MS[type]);
    (this.impacts = this.impacts || []).push({ type, start: this.time.now, ms, view: t, attacker: a, side, seed, ghastly, melee });
    if (e.result.crit) {
      this.impacts.push({ crit: true, start: this.time.now, ms: TUNE.ms('hit', 'crit', CRIT_MS), view: t, attacker: a, side, seed });
      this.cameras.main.shake(90, 0.003); // a tiny shake for crits
    }
  },

  // Draws effect pixels (character pixels around the feet, x = 0 at the body's middle) on a fighter.
  paintFx(g, v, draws) {
    if (!draws.length || !v.ch.visible || v.ch.alpha <= 0) return;
    const S = Math.abs(v.ch.scaleY);
    const box = v.box || { cx: 0 };
    const X = v.ch.x + box.cx * v.ch.scaleX, Y = v.ch.y;
    for (const [x, y, w, h, c, a] of draws) {
      g.fillStyle(c, a * v.ch.alpha);
      g.fillRect(X + x * S - S / 2, Y + y * S, w * S, h * S);
    }
  },

  // A thin red line from every taunted enemy to the one who taunted it, so you can see who it is forced to hit.
  drawTauntLines() {
    if (!this.tauntLines) this.tauntLines = this.add.graphics().setDepth(DEPTH.marker + 1);
    const g = this.tauntLines;
    g.clear();
    for (const e of this.state.enemies) {
      if (!e.alive) continue;
      const taunter = this.state.tauntedBy(e);
      if (!taunter) continue;
      const a = this.center(this.views.get(e.uid));
      const b = this.center(this.views.get(taunter.uid));
      g.lineStyle(2, 0xe05a2a, 0.55);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
  },

  // Draws every living fighter where the fight rules say it stands, hopping while it walks.
  // Lower on the screen = drawn in front.
  // Excalibur tornadoes glide to the enemy they are on.
  drawTornados() {
    if (!this.tornadoViews) return;
    for (const [id, tv] of this.tornadoViews) {
      if (!this.state.tornados.includes(tv.t)) { tv.g.destroy(); this.tornadoViews.delete(id); continue; }
      const v = this.views.get(tv.t.target.uid);
      if (!v) continue;
      tv.g.x += (v.ch.x - tv.g.x) * 0.15;
      tv.g.y += (v.ch.y - tv.g.y) * 0.15;
    }
  },

  // The big smoke cloud a fallen hero turns into (combat.json heroDanger poof*): puffs burst out in a ring and up.
  heroPoof(x, y) {
    const D = combatRules.heroDanger, n = D.poofCount, color = Phaser.Display.Color.HexStringToColor(D.poofColor).color;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, r = 6 + (i % 3) * 3;
      const c = this.add.circle(x + Math.cos(a) * 6, y + Math.sin(a) * 4, r, i % 4 === 0 ? 0xb8b8c4 : color, 0.95).setDepth(DEPTH.popup - 2).setScale(0.4);
      this.tweens.add({ targets: c, x: x + Math.cos(a) * 30, y: y + Math.sin(a) * 18 - 12, scale: 1.5, alpha: 0, duration: D.poofMs + (i % 3) * 80, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
    }
    const core = this.add.circle(x, y, 12, 0xffffff, 1).setDepth(DEPTH.popup - 2).setScale(0.5); // the bright middle
    this.tweens.add({ targets: core, scale: 2, alpha: 0, duration: D.poofMs * 0.6, ease: 'Quad.easeOut', onComplete: () => core.destroy() });
  },

  // A pixel tombstone (grey stone, dark cross) standing at x, y (its foot); it pops up out of the smoke.
  makeGrave(x, y) {
    const P = CHAR_SCALE, w = 8, hgt = 10;
    const grave = this.add.graphics().setDepth(DEPTH.hero - 0.5);
    grave.fillStyle(0x1a1a1a).fillRect(-w / 2 * P - P, -hgt * P - P, (w + 2) * P, (hgt + 1) * P); // outline
    grave.fillStyle(0x8a8a96).fillRect(-w / 2 * P, -hgt * P, w * P, hgt * P);
    grave.fillStyle(0x1a1a1a).fillRect(-w / 2 * P - P, -hgt * P - P, P, P).fillRect((w / 2) * P, -hgt * P - P, P, P); // round top corners
    grave.fillStyle(0xb4b4c0).fillRect(-w / 2 * P, -hgt * P, w * P, P); // light top edge
    grave.fillStyle(0x3a3a44).fillRect(-P, -8 * P, P, 6 * P).fillRect(-2 * P, -6 * P, 4 * P, P); // the cross
    grave.fillStyle(0x2a2a30, 0.6).fillRect(-w / 2 * P - 2 * P, 0, (w + 4) * P, P); // a little dirt at its foot
    grave.setPosition(x, y).setScale(0.3, 0.3);
    this.tweens.add({ targets: grave, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.easeOut' });
    return grave;
  },

  // The whole screen pulses red when a hero falls (combat.json heroDanger deathFlash*): in fast, out slower.
  deathFlash() {
    const D = combatRules.heroDanger;
    const color = Phaser.Display.Color.HexStringToColor(D.deathFlashColor).color;
    const r = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, color).setAlpha(0).setDepth(DEPTH.popup - 1);
    this.tweens.chain({
      targets: r,
      tweens: [
        { alpha: D.deathFlashAlpha, duration: D.deathFlashInMs, ease: 'Quad.easeOut' },
        { alpha: 0, duration: D.deathFlashOutMs, ease: 'Quad.easeIn' },
      ],
      onComplete: () => r.destroy(),
    });
  },

  // A hero fell (combat.json heroDanger): a white flash, it tips over (towards the middle of the screen), lies still a
  // moment, then POOF: a cloud of smoke bursts over the body and it is replaced by a tombstone. '<NAME> FELL' shows
  // over it and its column of the danger glow flares.
  heroFell(v) {
    const D = combatRules.heroDanger;
    v.fellAt = this.time.now;
    v.ch.flash(0xffffff, 160);
    this.deathFlash();
    sfx.play('heroDeath'); // a low bell toll, over the fall thud
    const back = v.ch.homeX < GAME_WIDTH / 2 ? -1 : 1; // its body falls towards the middle of the screen, never off the edge
    this.tweens.add({ targets: v.ch, angle: -90 * back, duration: D.fallMs, ease: 'Bounce.easeOut' });
    // Where the lying body is: half its height along the floor from its feet.
    const bodyX = v.ch.homeX - back * (v.unit.def.height * charScale(v.unit.def)) / 2, bodyY = v.ch.homeY - 6;
    this.time.delayedCall(D.fallMs + D.lieMs, () => {
      if (!v.ch.active) return;
      this.heroPoof(bodyX, bodyY);
      this.time.delayedCall(D.poofMs * 0.2, () => {
        if (!v.ch.active) return;
        v.ch.setVisible(false); // gone under the smoke
        v.grave = this.makeGrave(bodyX, v.ch.homeY);
      });
    });
    // '<NAME> FELL' over the hero.
    const y = v.ch.homeY - v.unit.def.height * charScale(v.unit.def) - 34;
    const t = this.add.text(v.ch.homeX, y, `${v.unit.name.toUpperCase()}\nFELL`, { fontFamily: UI.font, fontSize: `${D.textSizePx}px`, color: D.textColor, stroke: '#000000', strokeThickness: 4, align: 'center' })
      .setOrigin(0.5).setDepth(DEPTH.popup).setScale(1.6).setAlpha(0);
    t.x = Phaser.Math.Clamp(t.x, t.width / 2 + 4, GAME_WIDTH - t.width / 2 - 4);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: y - 16, delay: 200 + D.textHoldMs, duration: D.textOutMs, onComplete: () => t.destroy() });
  },

  popText(view, text, color, big = false, sizePx = null) {
    // The same WORD (Counter!, Blocked!) already floating over this fighter is not shown again: a Samurai
    // countering a lot made an unreadable pile. Numbers always show.
    if (!this.showNumbers && !/[a-z]/i.test(text)) return; // Settings: DAMAGE NUMBERS off
    const now = this.time.now;
    view.recentPops = view.recentPops || {};
    if (/[a-z]/i.test(text)) {
      const last = view.recentPops[text];
      if (last && now - last < POP_REPEAT_MS) return;
      view.recentPops[text] = now;
    }
    // Pop-ups that appear together stack upwards instead of overlapping.
    view.popSlot = ((view.popSlot ?? -1) + 1) % 4;
    // Above where the fighter is right now (a hero may be away at an enemy).
    const y = view.ch.y + view.ch.hopOffset - view.unit.def.height * charScale(view.unit.def) - 22 - view.popSlot * 15;
    const t = this.add
      .text(view.ch.x, y, text, {
        fontFamily: UI.font,
        fontSize: sizePx ? `${sizePx}px` : big ? '20px' : '14px',
        color,
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.popup);
    t.x = Phaser.Math.Clamp(t.x, t.width / 2 + 4, GAME_WIDTH - t.width / 2 - 4); // keep it on screen
    if (sizePx) {
      t.setScale(1.5); // skill numbers pop in big, then settle
      this.tweens.add({ targets: t, scale: 1, duration: 150, ease: 'Back.easeOut' });
    }
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: sizePx ? 1000 : 800, onComplete: () => t.destroy() });
  },

  // A new item or book page on a hero (user: the old 20px '+Name' popup looked 'stretchy and big'): its name at one
  // fixed small size (combat.json gainText), never scaled, slides up a little and fades, like the skill names.
  gainText(view, text, color) {
    if (!view || !view.ch.active) return;
    const G = combatRules.gainText;
    const t = this.add.text(view.ch.x, view.bg.y, text, { fontFamily: UI.font, fontSize: `${G.sizePx}px`, color, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(DEPTH.popup + 1).setAlpha(0);
    // Names still showing on this hero (an item, then a boss's golden book page) stack upwards instead of piling up.
    view.gains = (view.gains || []).filter((o) => o.active);
    const row = view.gains.length;
    view.gains.push(t);
    // It FOLLOWS the hero (the squad may walk off to the door), above the health bar and the item's icon pop.
    const rise = { d: G.risePx };
    const follow = () => {
      if (!view.ch.active) return;
      t.x = Math.round(Phaser.Math.Clamp(view.ch.x, t.width / 2 + 6, GAME_WIDTH - t.width / 2 - 6));
      t.y = Math.round(view.bg.y - G.abovePx - row * (G.sizePx + 6) + rise.d);
    };
    follow();
    this.events.on('update', follow);
    t.once('destroy', () => this.events.off('update', follow));
    this.tweens.add({ targets: rise, d: 0, duration: G.inMs, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: t, alpha: 1, duration: G.inMs });
    this.tweens.add({ targets: rise, d: -G.risePx, delay: G.inMs + G.holdMs, duration: G.outMs });
    this.tweens.add({ targets: t, alpha: 0, delay: G.inMs + G.holdMs, duration: G.outMs, onComplete: () => t.destroy() });
  },
};
