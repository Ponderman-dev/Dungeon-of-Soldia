// Boss rules (no Phaser). Added to BattleState.prototype (see the bottom of BattleState.js), so `this` is the
// fight. Everything a boss does is DATA in enemies.json:
//   boss: true               a boss (big health bar at the top, statusDurationScale 0.5 for control)
//   object: true             never attacks or moves (War Drum, Egg Sac, Phylactery): tap it to focus it
//   abilities: [ ... ]       timed moves, each with an optional wind-up (`castMs`, a red bar over the boss).
//                            A stun / freeze / fear / knockback during the wind-up INTERRUPTS it.
//     { id, name, everyMs, firstMs, castMs, hpBelow (once, at that health %), interruptible (default true),
//       target: 'frontHero' | 'backHero' | 'randomHero' | 'lowestHero' | 'allHeroes' | 'self' | 'allies' | 'meleeNear',
//       radius (meleeNear), damageMultiplier, damageType, apply: [status specs], healAllies (% of their max health),
//       summon: { id, count, max, near }, swap: 'partnerId', daggers: { count, damageMultiplier, apply },
//       channel: { intervalMs, ticks, target, damageMultiplier, damageType, apply, drain: { percentMaxHp } },
//       clones: { statPercent }, shatterClones: { multiplier } }
//     minor: true = a normal enemy's small move (a popup, no red banner); needsHurt: waits until an enemy is hurt;
//     target also 'lowestAlly' (most hurt enemy) / 'lowestOtherAlly' (not itself) / 'otherAllies'; shield: { percentOwnHp, durationMs } on the target
//     burrow: { ms, stunMs, damageMultiplier } (Cave Worm), blink: true (Blink Imp: appears next to its target first)
//   raise: { radius, into }                  Bone Acolyte: the first enemy dying near it comes back as `into`
//   adapt: { ms }                            Crystal Sentinel: resists the last damage type that hit it, weak to the rest
//   aura: { ids, attackSpeedPercent }        other enemies with these ids attack faster while it lives (War Drum)
//   hatch: { afterMs, into, count }          it turns into enemies after a while (Egg Sac)
//   plates: { count, cutPercent, plateHpPercent, fireMultiplier }   armor plates: less damage until broken (Frost Warden)
//   statusImmune: [status ids]
//   link: { partner, enrage: [mods], reviveMs, revivePercent }        twin bosses (Rask & Vesh)
//   phylactery: { id, hpPercent, reformMs, reformPercent, toughen, maxReforms }   a second life (Morthul; back at most maxReforms times)
//   heat: { max, perSec, perFireHit, perIceHit, freezeDrop, chillDrop, eruption: { damageMultiplier, damageType, apply } }
//   mirror: { atStart, atHp: [..], statPercent }                       glass clones of the heroes (Sela)
//   sky: { atHp: [..], durationMs, strikeEveryMs, strike, summon, groundedMs, vulnerable }   flies out of reach (Vharox)

export const bossMethods = {
  // Called for every new enemy (makeUnit): the boss's own state.
  initBoss(u) {
    const d = u.def;
    u.abilities = (d.abilities || []).map((a) => ({ def: a, timer: a.firstMs ?? a.everyMs ?? 0, done: false }));
    u.bossCast = null;
    if (d.plates) { u.plates = d.plates.count; u.plateHp = (u.maxHp * d.plates.plateHpPercent) / 100; }
    if (d.heat) u.heat = 0;
    if (d.hatch) u.hatchTimer = d.hatch.afterMs;
    if (d.sky) u.skyDone = [];
    if (d.mirror) u.mirrorDone = [];
    u.toughness = 1;
  },

  isBoss(u) {
    return !!(u && u.def && u.def.boss);
  },

  // Can heroes aim at it? (Morthul's dust and Vharox in the sky cannot be hit.)
  untargetable(u) {
    return !!(u.dust || u.burrowed || (u.statuses && u.statuses.some((s) => s.type === 'airborne'))); // Cave Worm underground
  },

  // Enemies that heroes can hit right now.
  targetableEnemies() {
    return this.enemies.filter((e) => e.alive && !this.untargetable(e));
  },

  // A new enemy joins the fight next to `near` (summons, hatchlings, clones). `def` may be a custom def (clones).
  spawnEnemyUnit(defOrId, near, events, spread = 60) {
    const def = typeof defOrId === 'string' ? this.enemyDefs[defOrId] : defOrId;
    if (!def) return null;
    const u = this.makeUnit(def, 'enemy', this.floorNo || 1, 1);
    if (near && this.hasPositions(near)) {
      const L = this.rules.movement.layout;
      const x = Math.min(L.width - L.marginX, Math.max(L.marginX, near.x + (this.rng() - 0.5) * spread * 2));
      this.place(u, x, near.y + (this.rng() - 0.5) * 30);
    }
    this.enemies.push(u);
    events.push({ type: 'enemySpawn', unit: u, from: near || null });
    return u;
  },

  // Extra attack speed an enemy gets from auras (War Drum).
  auraSpeed(unit) {
    let change = 0;
    for (const e of this.enemies) if (e.alive && e !== unit && e.def.aura && e.def.aura.ids.includes(unit.def.id)) change += e.def.aura.attackSpeedPercent;
    return change;
  },

  // ---- every update ------------------------------------------------------------------------------
  tickBosses(dt, events) {
    for (const u of [...this.enemies]) {
      if (!u.alive) continue;
      const d = u.def;
      if (d.hatch) {
        u.hatchTimer -= dt;
        if (u.hatchTimer <= 0) {
          for (let i = 0; i < d.hatch.count; i++) this.spawnEnemyUnit(d.hatch.into, u, events, 30);
          events.push({ type: 'hatch', unit: u });
          u.xpless = true;
          this.killUnit(u, events);
          continue;
        }
      }
      if (d.reformFor) this.tickPhylactery(u, dt, events);
      if (d.heat) this.tickHeat(u, dt, events);
      if (u.reviveTimer > 0) this.tickRevive(u, dt, events);
      if (d.sky) this.tickSky(u, dt, events);
      if (d.mirror) this.checkMirror(u, events);
      if (u.burrowed) this.tickBurrow(u, dt, events);
      if (u.adapt) this.tickAdapt(u, dt, events);
      if (u.abilities && u.abilities.length) this.tickAbilities(u, dt, events);
    }
  },

  // ---- the new enemies (step 5, batch 2) --------------------------------------------------------
  // Cave Worm (ability `burrow: { ms, stunMs, damageMultiplier }`): underground it can't be hit or attack; then it pops
  // up under a random hero (or minion), hits it and stuns it.
  startBurrow(u, spec, events) {
    u.burrowed = { remaining: spec.ms, spec };
    u.pending = null;
    for (const x of this.allUnits()) if (x.foe === u.uid) x.foe = null;
    if (this.focusUid === u.uid) this.focusUid = null;
    events.push({ type: 'burrow', unit: u });
  },

  tickBurrow(u, dt, events) {
    u.burrowed.remaining -= dt;
    if (u.burrowed.remaining > 0) return;
    const spec = u.burrowed.spec;
    u.burrowed = null;
    const pool = this.frontDefenders();
    const t = pool[Math.floor(this.rng() * pool.length)];
    if (t && this.hasPositions(t) && this.hasPositions(u)) {
      const L = this.rules.movement.layout;
      u.x = Math.min(L.width - L.marginX, Math.max(L.marginX, t.x + (this.rng() < 0.5 ? -1 : 1) * 30));
      u.y = Math.max(L.enemyY + L.topMarginY, t.y - 20);
    }
    events.push({ type: 'surface', unit: u, target: t || null });
    if (!t) return;
    u.foe = t.uid;
    if (spec.damageMultiplier) this.strike(u, t, events, { multiplier: spec.damageMultiplier, ability: true });
    if (t.alive && spec.stunMs) this.applyStatus(t, { status: 'stun', durationMs: spec.stunMs }, u, 'worm_surface', events);
  },

  // Bone Acolyte (`raise: { radius, into }`): the FIRST enemy that dies near it comes back as `into` (once per acolyte).
  acolyteRaise(victim, events) {
    if (victim.def.object || victim.def.boss || victim.def.raise) return;
    for (const a of this.enemies) {
      const r = a.def.raise;
      if (!r || !a.alive || a.raised || a === victim) continue;
      if (this.hasPositions(a) && this.hasPositions(victim) && Math.hypot(a.x - victim.x, a.y - victim.y) > r.radius) continue;
      a.raised = true;
      const risen = this.spawnEnemyUnit(r.into, victim, events, 10);
      events.push({ type: 'raiseDead', unit: a, from: victim, risen });
      return;
    }
  },

  // Crystal Sentinel (`adapt: { ms }`): a hit of a damage type makes it resist THAT type for `ms` and be weak to every
  // other type meanwhile. Before its first hit (and after it wears off) it is plain.
  adaptTo(u, type, events) {
    const ms = u.def.adapt.ms;
    if (u.adapt && u.adapt.type === type) { u.adapt.remaining = ms; return; }
    u.adapt = { type, remaining: ms };
    u.resists = [type];
    u.weak = Object.keys(this.damageTypes).filter((t) => t !== type && !t.startsWith('_'));
    events.push({ type: 'adapt', unit: u, damageType: type });
  },

  tickAdapt(u, dt, events) {
    u.adapt.remaining -= dt;
    if (u.adapt.remaining > 0) return;
    u.adapt = null;
    u.resists = u.def.resists || [];
    u.weak = u.def.weak || [];
    events.push({ type: 'adapt', unit: u, damageType: null });
  },

  // Interrupted: a stun, freeze, fear or knockback during a wind-up (or a channel) stops it.
  bossDisrupted(u) {
    return this.isStunned(u) || this.has(u, 'fear') || !!u.knock;
  },

  tickAbilities(u, dt, events) {
    if (u.dust || this.untargetable(u)) return;
    const c = u.bossCast;
    if (c) {
      if (c.def.interruptible !== false && this.bossDisrupted(u)) {
        u.bossCast = null;
        events.push({ type: 'castCancel', unit: u, skill: { name: c.def.name, kind: 'attack' }, reason: 'interrupted' });
        return;
      }
      c.remaining -= dt;
      if (c.channel) {
        c.channel.timer -= dt;
        while (c.channel.timer <= 0 && c.channel.tick < c.channel.spec.ticks) {
          this.channelTick(u, c, events);
          c.channel.timer += c.channel.spec.intervalMs;
        }
        if (c.channel.tick >= c.channel.spec.ticks) u.bossCast = null;
        return;
      }
      if (c.remaining > 0) return;
      u.bossCast = null;
      this.releaseAbility(u, c.def, events);
      return;
    }
    if (this.isStunned(u) || this.has(u, 'fear')) return;
    for (const ab of u.abilities) {
      const a = ab.def;
      // A heal with nobody hurt waits (it stays ready).
      if (a.needsHurt && !this.enemies.some((e) => e.alive && !e.def.object && e.hp < e.maxHp)) { if (ab.timer > 0) ab.timer -= dt; continue; }
      let ready = false;
      if (a.hpBelow !== undefined) ready = !ab.done && (u.hp / u.maxHp) * 100 < a.hpBelow;
      else {
        ab.timer -= dt;
        ready = ab.timer <= 0;
      }
      if (!ready) continue;
      if (a.hpBelow !== undefined) ab.done = true;
      else ab.timer += a.everyMs;
      this.startAbility(u, a, events);
      return; // one at a time
    }
  },

  startAbility(u, a, events) {
    if (u.pending) {
      u.pending = null;
      events.push({ type: 'attackCancel', unit: u, reason: 'ability' });
    }
    // Giantslayer's Brand: while a holder lives, boss wind-ups take `bossWindup`% longer (20 per copy).
    const slow = this.heroes.filter((h) => h.alive && h.specials).reduce((n, h) => n + (h.specials.bossWindup || 0), 0);
    const castMs = (a.castMs || 0) * (1 + slow / 100);
    if (castMs <= 0 && !a.channel) return this.releaseAbility(u, a, events);
    u.bossCast = { def: a, remaining: castMs, total: castMs, channel: null };
    events.push({ type: 'castStart', unit: u, skill: { name: a.name, kind: 'attack' }, castMs, boss: true });
  },

  // The heroes a move goes for.
  abilityTargets(u, target, radius) {
    const heroes = this.heroes.filter((h) => h.alive);
    const all = this.defenders();
    if (!heroes.length && target !== 'self' && target !== 'allies') return [];
    const dist = (h) => (this.hasPositions(u) && this.hasPositions(h) ? Math.hypot(h.x - u.x, h.y - u.y) : 0);
    switch (target) {
      case 'frontHero': return [heroes.reduce((a, b) => (dist(b) < dist(a) ? b : a))];
      case 'backHero': return [heroes.reduce((a, b) => (dist(b) > dist(a) ? b : a))];
      case 'randomHero': return [heroes[Math.floor(this.rng() * heroes.length)]];
      case 'lowestHero': return [heroes.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a))];
      case 'allHeroes': return all;
      case 'meleeNear': return all.filter((h) => h.damageType === 'melee' && (!this.hasPositions(h) || dist(h) <= (radius || 100)));
      case 'self': return [u];
      case 'allies': return this.enemies.filter((e) => e.alive);
      case 'otherAllies': return this.enemies.filter((e) => e.alive && e !== u && !e.def.object); // Lava Hound's howl
      case 'lowestAlly': // the most hurt enemy (by health %): Goblin Shaman heals
      case 'lowestOtherAlly': { // the same, never itself: Shieldbearer shields
        const live = this.enemies.filter((e) => e.alive && !e.def.object && !this.untargetable(e) && (target === 'lowestAlly' || e !== u));
        return live.length ? [live.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a))] : [];
      }
      default: return [];
    }
  },

  // A boss move goes off.
  releaseAbility(u, a, events) {
    if (a.channel) {
      u.bossCast = { def: a, remaining: a.channel.ticks * a.channel.intervalMs, total: a.channel.ticks * a.channel.intervalMs, channel: { spec: a.channel, timer: 0, tick: 0 } };
      events.push({ type: 'bossAbility', unit: u, ability: a, targets: [] });
      return;
    }
    if (a.burrow) return this.startBurrow(u, a.burrow, events); // Cave Worm
    const targets = this.abilityTargets(u, a.target, a.radius);
    if (a.target === 'lowestOtherAlly' && !targets.length) return; // a Shieldbearer alone: no one to guard, no popup
    // Blink Imp: it appears next to its target first (then the hit below).
    if (a.blink && targets[0] && this.hasPositions(u) && this.hasPositions(targets[0])) {
      const t = targets[0], L = this.rules.movement.layout;
      const from = { x: u.x, y: u.y };
      u.x = Math.min(L.width - L.marginX, Math.max(L.marginX, t.x + (t.x > L.width / 2 ? -34 : 34)));
      u.y = Math.max(L.enemyY + L.topMarginY, t.y - 10);
      u.foe = t.uid;
      events.push({ type: 'blink', unit: u, from, target: t });
    }
    events.push({ type: 'bossAbility', unit: u, ability: a, targets, minor: !!a.minor });
    for (const t of targets) {
      if (!t.alive) continue;
      if (a.damageMultiplier) this.strike(u, t, events, { multiplier: a.damageMultiplier, damageType: a.damageType, ability: true });
      if (!t.alive) continue;
      for (const spec of a.apply || []) this.applyStatus(t, spec, u, `boss_${a.id}`, events);
      if (a.healAllies) this.healUnit(t, (t.maxHp * a.healAllies) / 100, events, { aura: false });
      // Shieldbearer: a shield of `percentOwnHp` of ITS OWN max health on the target (the same move refills it).
      if (a.shield) this.applyStatus(t, { status: 'shield', amount: Math.round((u.maxHp * a.shield.percentOwnHp) / 100), durationMs: a.shield.durationMs }, u, `ability_${a.id}`, events);
    }
    if (a.summon) {
      const have = this.enemies.filter((e) => e.alive && e.def.id === a.summon.id).length;
      for (let i = 0; i < a.summon.count && have + i < (a.summon.max ?? Infinity); i++) this.spawnEnemyUnit(a.summon.id, u, events, a.summon.near ? 90 : 60);
    }
    if (a.swap) {
      const p = this.enemies.find((e) => e.alive && e.def.id === a.swap);
      if (p && this.hasPositions(u) && this.hasPositions(p)) {
        [u.x, p.x] = [p.x, u.x];
        [u.y, p.y] = [p.y, u.y];
        [u.homeX, p.homeX] = [p.homeX, u.homeX];
        [u.homeY, p.homeY] = [p.homeY, u.homeY];
        for (const h of this.heroes) if (h.foe === u.uid || h.foe === p.uid) h.foe = null; // melee heroes pick again
        events.push({ type: 'swap', unit: u, with: p });
      }
    }
    if (a.daggers) {
      const pool = this.frontDefenders();
      for (let i = 0; i < a.daggers.count && pool.length; i++) {
        const t = pool[Math.floor(this.rng() * pool.length)];
        if (!t.alive) continue;
        this.strike(u, t, events, { multiplier: a.daggers.damageMultiplier, projectile: 'knife', ability: true });
        if (t.alive) for (const spec of a.daggers.apply || []) this.applyStatus(t, spec, u, `boss_${a.id}_dagger`, events);
      }
    }
    if (a.clones) this.spawnClones(u, a.clones.statPercent, events);
    if (a.shatterClones) this.shatterClones(u, a.shatterClones.multiplier, events);
  },

  // One tick of a boss channel (Blizzard, Soul Drain).
  channelTick(u, c, events) {
    const s = c.channel.spec;
    c.channel.tick++;
    const targets = this.abilityTargets(u, s.target);
    events.push({ type: 'bossChannel', unit: u, ability: c.def, targets, tick: c.channel.tick });
    for (const t of targets) {
      if (!t.alive) continue;
      if (s.damageMultiplier) this.strike(u, t, events, { multiplier: s.damageMultiplier, damageType: s.damageType, ability: true });
      if (s.drain && t.alive) {
        const amount = Math.max(1, Math.round((t.maxHp * s.drain.percentMaxHp) / 100));
        const d = this.dealDamage(t, amount, events);
        events.push({ type: 'drain', unit: t, from: u, amount: d.immune ? 0 : amount - d.absorbed });
        this.breakEffects(t, d.broken, events);
        if (t.hp <= 0 && t.alive) this.killUnit(t, events, u);
        if (!d.immune) this.healUnit(u, amount, events, { aura: false });
      }
      if (t.alive) for (const spec of s.apply || []) this.applyStatus(t, spec, u, `boss_${c.def.id}`, events);
    }
  },

  // ---- Frost Warden: armor plates ----------------------------------------------------------------
  // A hit on a plated boss: it takes `cutPercent` less, and the plate loses health (x fireMultiplier for fire).
  plateHit(target, amount, type, events) {
    const p = target.def.plates;
    if (!p || !(target.plates > 0)) return amount;
    target.plateHp -= amount * (type === 'fire' ? p.fireMultiplier : 1);
    if (target.plateHp <= 0) {
      target.plates--;
      target.plateHp = (target.maxHp * p.plateHpPercent) / 100;
      events.push({ type: 'plateBreak', unit: target, left: target.plates });
    }
    return Math.max(1, Math.round(amount * (1 - p.cutPercent / 100)));
  },

  // ---- Ignatius: heat ----------------------------------------------------------------------------
  tickHeat(u, dt, events) {
    if (u.dust) return;
    this.addHeat(u, (u.def.heat.perSec * dt) / 1000, events);
  },

  addHeat(u, n, events) {
    const h = u.def.heat;
    u.heat = Math.max(0, u.heat + n);
    if (u.heat < h.max) return;
    u.heat = 0;
    const targets = this.defenders();
    events.push({ type: 'bossAbility', unit: u, ability: { id: 'eruption', name: 'ERUPTION' }, targets });
    for (const t of targets) {
      if (!t.alive) continue;
      this.strike(u, t, events, { multiplier: h.eruption.damageMultiplier, damageType: h.eruption.damageType, ability: true });
      if (t.alive) for (const spec of h.eruption.apply || []) this.applyStatus(t, spec, u, 'eruption', events);
    }
  },

  // A hit or status on a hot boss changes its heat (fire up, ice down).
  heatFromHit(target, type, events) {
    const h = target.def.heat;
    if (!h) return;
    if (type === 'fire') this.addHeat(target, h.perFireHit, events);
    if (type === 'ice') this.addHeat(target, h.perIceHit, events);
  },

  heatFromStatus(target, status, events) {
    const h = target.def.heat;
    if (!h) return;
    if (status === 'freeze') this.addHeat(target, -h.freezeDrop, events);
    if (status === 'chill') this.addHeat(target, -h.chillDrop, events);
  },

  // ---- Rask & Vesh: linked twins -----------------------------------------------------------------
  // One falls: the other ENRAGES and raises it after `reviveMs` unless it falls too.
  linkDeath(dead, events) {
    const l = dead.def.link;
    const partner = l && this.enemies.find((e) => e.alive && e.def.id === l.partner);
    if (!partner) return;
    this.applyStatus(partner, { status: 'buff', durationMs: 600000, mods: l.enrage }, partner, 'enrage', events);
    partner.reviveTimer = l.reviveMs;
    partner.reviveUid = dead.uid;
    events.push({ type: 'enrage', unit: partner, partner: dead });
  },

  tickRevive(u, dt, events) {
    u.reviveTimer -= dt;
    if (u.reviveTimer > 0) return;
    const dead = this.enemies.find((e) => e.uid === u.reviveUid && !e.alive);
    u.reviveTimer = 0;
    if (!dead) return;
    dead.alive = true;
    dead.hp = Math.round((dead.maxHp * u.def.link.revivePercent) / 100);
    dead.statuses = [];
    dead.timer = 0;
    dead.bossCast = null;
    if (this.hasPositions(dead)) { dead.x = dead.homeX; dead.y = dead.homeY; }
    events.push({ type: 'revive', unit: dead, by: u });
  },

  // ---- Morthul: phylactery (a second life) --------------------------------------------------------
  // At 0 health he falls to dust (alive but untouchable) and his crystal appears. Break it in time or he
  // comes back at `reformPercent` health; the next crystal is `toughen` times tougher. After `maxReforms` comebacks the
  // next crystal running out ends him for good.
  turnToDust(u, events) {
    const ph = u.def.phylactery;
    u.dust = true;
    u.hp = 1;
    u.statuses = [];
    u.dotClocks = {};
    u.pending = null;
    u.bossCast = null;
    for (const h of this.allUnits()) if (h.foe === u.uid) h.foe = null;
    this.retargetAttacksOn(u, events);
    if (this.focusUid === u.uid) this.focusUid = null;
    const def = { ...this.enemyDefs[ph.id], id: ph.id, reformFor: u.uid };
    const crystal = this.spawnEnemyUnit({ ...def, noFloorScaling: true, stats: { ...def.stats, health: Math.round((u.maxHp * ph.hpPercent * u.toughness) / 100) } }, u, events, 40);
    crystal.reformTimer = ph.reformMs;
    events.push({ type: 'dust', unit: u, crystal });
  },

  tickPhylactery(crystal, dt, events) {
    crystal.reformTimer -= dt;
    if (crystal.reformTimer > 0) return;
    const boss = this.enemies.find((e) => e.uid === crystal.def.reformFor);
    crystal.xpless = true;
    crystal.alive = false;
    events.push({ type: 'death', unit: crystal, vanish: true });
    if (!boss || !boss.alive) return;
    boss.dust = false;
    // He comes back at most `maxReforms` times, then crumbles for good (bug: each crystal was 1.5x tougher, so a
    // squad that missed one could never break the next: the fight never ended).
    const ph = boss.def.phylactery;
    if (ph.maxReforms != null && (boss.reforms || 0) >= ph.maxReforms) {
      boss.finalDeath = true;
      boss.hp = 0;
      return this.killUnit(boss, events);
    }
    boss.reforms = (boss.reforms || 0) + 1;
    boss.hp = Math.round((boss.maxHp * ph.reformPercent) / 100);
    boss.toughness *= boss.def.phylactery.toughen;
    events.push({ type: 'reform', unit: boss });
  },

  // The crystal broke: Morthul is gone for good.
  phylacteryBroken(crystal, events) {
    const boss = this.enemies.find((e) => e.uid === crystal.def.reformFor && e.alive);
    if (!boss) return;
    boss.dust = false;
    boss.finalDeath = true;
    boss.hp = 0;
    this.killUnit(boss, events);
  },

  // ---- Sela: glass clones ------------------------------------------------------------------------
  checkMirror(u, events) {
    const m = u.def.mirror;
    const pct = (u.hp / u.maxHp) * 100;
    if (m.atStart && !u.mirrorDone.includes('start') && this.hasStarted) { u.mirrorDone.push('start'); this.spawnClones(u, m.statPercent, events); }
    for (const at of m.atHp || []) if (pct < at && !u.mirrorDone.includes(at)) { u.mirrorDone.push(at); this.spawnClones(u, m.statPercent, events); }
  },

  spawnClones(u, statPercent, events) {
    events.push({ type: 'bossAbility', unit: u, ability: { id: 'mirror', name: 'Mirror Images' }, targets: [] });
    for (const h of this.heroes.filter((x) => x.alive)) {
      const k = statPercent / 100;
      const def = {
        id: 'glass_clone', name: `Glass ${h.name}`, damageType: h.damageType, height: h.def.height, parts: h.def.parts, alpha: 0.65, glass: true,
        noFloorScaling: true, weak: [], resists: [], xp: 2,
        stats: { health: Math.max(1, Math.round(h.maxHp * k)), attack: Math.max(1, Math.round(h.stats.attack * k)), defense: Math.round(h.stats.defense * k), attackEfficiency: h.stats.attackEfficiency },
      };
      this.spawnEnemyUnit(def, u, events, 140);
    }
  },

  shatterClones(u, multiplier, events) {
    for (const c of this.enemies.filter((e) => e.alive && e.def.glass)) {
      const t = this.nearest(c, this.frontDefenders(c));
      if (t) this.strike(c, t, events, { multiplier, damageType: 'ice', ability: true, projectile: 'knife' });
      c.xpless = true;
      this.killUnit(c, events);
    }
  },

  // A hero skill on a boss with Mirror Ward: it bounces back on the caster (the ward is used up).
  reflects(target) {
    return target.statuses && target.statuses.find((s) => s.type === 'reflect');
  },

  // ---- Vharox: flies out of reach ----------------------------------------------------------------
  tickSky(u, dt, events) {
    const s = u.def.sky;
    const air = u.statuses.find((x) => x.type === 'airborne');
    if (air) {
      u.skyStrike = (u.skyStrike || 0) - dt;
      if (u.skyStrike <= 0) {
        u.skyStrike += s.strikeEveryMs;
        const pool = this.frontDefenders();
        const t = pool[Math.floor(this.rng() * pool.length)];
        if (t) {
          events.push({ type: 'bossAbility', unit: u, ability: { id: 'lightning', name: 'Lightning' }, targets: [t], quiet: true });
          this.strike(u, t, events, { multiplier: s.strike.damageMultiplier, damageType: s.strike.damageType, projectile: 'lightning', ability: true });
          if (t.alive) for (const spec of s.strike.apply || []) this.applyStatus(t, spec, u, 'sky_strike', events);
        }
      }
      // All the sprites down early: he is dragged out of the sky, stunned and vulnerable.
      const sprites = this.enemies.filter((e) => e.alive && (u.skySprites || []).includes(e.uid));
      if (!sprites.length && u.skySprites && u.skySprites.length) {
        u.statuses.splice(u.statuses.indexOf(air), 1);
        u.skySprites = [];
        events.push({ type: 'status', unit: u, change: 'expire', status: air });
        events.push({ type: 'grounded', unit: u });
        this.applyStatus(u, { status: 'stun', durationMs: s.groundedMs / (u.def.statusDurationScale ?? 1) }, u, 'grounded', events);
        this.applyStatus(u, { status: 'mark', durationMs: s.groundedMs * 2, damageTakenPercent: s.vulnerablePercent }, u, 'grounded', events);
      }
      return;
    }
    const pct = (u.hp / u.maxHp) * 100;
    for (const at of s.atHp) {
      if (pct >= at || u.skyDone.includes(at)) continue;
      u.skyDone.push(at);
      u.bossCast = null;
      u.pending = null;
      this.applyStatus(u, { status: 'airborne', durationMs: s.durationMs }, u, 'sky', events);
      for (const h of this.allUnits()) if (h.foe === u.uid) h.foe = null;
      this.retargetAttacksOn(u, events);
      if (this.focusUid === u.uid) this.focusUid = null;
      u.skyStrike = s.strikeEveryMs;
      u.skySprites = [];
      for (let i = 0; i < s.summon.count; i++) { const sp = this.spawnEnemyUnit(s.summon.id, u, events, 150); if (sp) u.skySprites.push(sp.uid); }
      events.push({ type: 'skyPhase', unit: u });
      return;
    }
  },
};
