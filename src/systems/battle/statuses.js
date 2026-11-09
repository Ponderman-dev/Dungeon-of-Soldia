// Part of BattleState (mixed into its prototype at the bottom of ../BattleState.js; `this` is the BattleState).
// Statuses: applying, stacking, ticking, damage over time (docs/systems/statuses.md).
import { computeDotDamage } from '../combat.js';

export const statusesMethods = {
  // Magma Core (ERUPTION, session 31): when the last Burn stack on an enemy ends (runs out, not death), every living hero
  // with `eruption` whose burn was on it makes it explode: `eruption`% (150, +75 per extra copy) of that hero's attack as
  // fire on it and every enemy within `eruptionRadius` px (item hits).
  erupt(unit, ended, events) {
    if (unit.side !== 'enemy' || !unit.alive || unit.statuses.some((st) => st.type === 'burn')) return;
    for (const h of this.heroes) {
      const pct = h.alive && h.specials ? h.specials.eruption || 0 : 0;
      if (!pct || !ended.some((st) => st.sourceUid === h.uid)) continue;
      const radius = h.specials.eruptionRadius || 100;
      const near = this.enemies.filter((e) => e.alive && !this.untargetable(e) && (e === unit || !this.hasPositions(e) || !this.hasPositions(unit) || Math.hypot(e.x - unit.x, e.y - unit.y) <= radius));
      events.push({ type: 'proc', unit: h, label: 'Eruption!', itemId: 'magma_core', target: unit });
      events.push({ type: 'deathBurst', unit, radius, color: '#ff7a3d', targets: near, explosive: true });
      for (const e of near) if (e.alive) this.strike(h, e, events, { multiplier: pct / 100, damageType: 'fire', item: true, burst: true });
    }
  },

  // Puts a copy of a damage-over-time stack on a unit (Plague Flask).
  addDotStack(unit, stack) {
    unit.statuses.push({ ...stack, key: `${stack.key}#${unit.uid}` });
    if (!(stack.type in unit.dotClocks)) unit.dotClocks[stack.type] = 0;
  },

  // A shield was broken: tell the scene, and run its `onBreak` effect if it has one
  // (Bone Ward: bone shards hit every enemy of the holder for damageMultiplier x the caster's attack).
  breakEffects(unit, broken, events) {
    for (const shield of broken) {
      events.push({ type: 'shieldBreak', unit, status: shield });
      if (!shield.onBreak) continue;
      const caster = this.allUnits().find((u) => u.uid === shield.sourceUid && u.alive) || unit;
      const foes = unit.side === 'hero' ? this.enemies.filter((u) => u.alive) : this.defenders();
      events.push({ type: 'proc', unit, label: 'Shards!' });
      for (const foe of foes) this.strike(caster, foe, events, { multiplier: shield.onBreak.damageMultiplier, damageType: shield.onBreak.damageType });
    }
  },

  // How much shield a unit has left (all its shields together).
  shieldAmount(unit) {
    return unit.statuses.reduce((sum, st) => (st.type === 'shield' ? sum + st.amount : sum), 0);
  },

  // ---- statuses (statuses.json) ----------------------------------------------------------

  // Gives a unit a status (rules in statuses.json).
  //  - Damage over time (`dot`: bleed, burn, poison) and `stacking` statuses (chill): EVERY
  //    application adds a new stack (spec.stacks, default 1), with no limit, each with its own timer.
  //    All stacks of one damage-over-time kind tick together.
  //  - Chill: at `freezeAt` stacks the unit freezes for `freezeMs` and all its chill is removed.
  //  - `instant` statuses (knockback) happen once and leave nothing behind.
  //  - Anything else: the same status from the same source (skill/item) just restarts its timer.
  // Bosses have `statusDurationScale` (e.g. 0.5): CONTROL statuses (statuses.json `control`:
  // stun, freeze, chill, fear...) last less on them. Damage over time is never shortened.
  applyStatus(target, spec, source, skillId, events) {
    const info = this.statusDefs[spec.status] || {};
    if ((target.def.statusImmune || []).includes(spec.status)) {
      events.push({ type: 'immuneStatus', unit: target, status: spec.status }); // Frost Warden: no Chill / Freeze
      return;
    }
    if (target.def.heat) this.heatFromStatus(target, spec.status, events);
    if (info.debuff && target.side === 'enemy' && source && source.side === 'hero') (target.debuffedBy = target.debuffedBy || new Set()).add(source.uid); // who has debuffed it (Dirty Fighting)
    if (target.streak && ['stun', 'freeze', 'fear'].includes(spec.status)) target.streak = { uid: null, count: 0 }; // Brawler's Streak combo is lost
    const scale = info.control ? target.def.statusDurationScale ?? 1 : 1;
    // A shield with no durationMs lasts until it is broken.
    // Catalyst (Alchemist): debuffs on ENEMIES last longer.
    const cat = target.side === 'enemy' && this.statusDefs[spec.status] && this.statusDefs[spec.status].debuff ? this.catalyst() : { dur: 1, dot: 1 };
    const will = info.control && target.side === 'hero' && target.specials ? target.specials.ironWill || 0 : 0; // Iron Will Talisman
    const duration = (spec.durationMs ?? (spec.status === 'shield' ? Infinity : 0)) * scale * cat.dur * (1 - Math.min(95, will) / 100);
    const key = `${spec.status}:${skillId}`;

    if (info.instant) {
      // Knockback: the next attack starts over (a boss only loses part of its wind-up), and an attack
      // already on its way is stopped.
      if (spec.status === 'knockback') {
        target.timer *= 1 - scale;
        // Pushed back `knockbackPx` towards its own side over `knockbackMs` (heroes down, enemies up).
        const M = this.rules.movement;
        if (M && this.hasPositions(target)) {
          const dir = target.side === 'hero' ? 1 : -1;
          target.knock = { vx: 0, vy: (dir * M.knockbackPx) / M.knockbackMs, remaining: M.knockbackMs };
        }
        if (target.pending) {
          target.pending = null;
          events.push({ type: 'attackCancel', unit: target, reason: 'knockback' });
        }
      }
      events.push({ type: 'status', unit: target, change: 'apply', status: { key, type: spec.status, remaining: 0, total: 0 } });
      return;
    }

    const stacking = info.dot || info.stacking;
    const count = stacking ? spec.stacks || 1 : 1;
    let status;
    for (let i = 0; i < count; i++) {
      // `stackEach` (Hex Doll's Curse, Rusty Nails' Armor Break): every application is its own stack with its own timer.
      status = stacking || spec.stackEach ? null : target.statuses.find((s) => s.key === key);
      if (!status) {
        status = { key, type: spec.status };
        target.statuses.push(status);
      }
      status.remaining = duration;
      status.total = duration;
      if (spec.status === 'buff') status.mods = spec.mods;
      if (spec.status === 'taunt' || spec.status === 'guarded') status.sourceUid = source.uid; // who taunted / who guards
      if (spec.status === 'shield') {
        // Size: a flat `amount`, plus `percentMaxHp` of the holder's health, plus `attackMultiplier` x the
        // caster's attack. The same shield (same source + skill) is refilled instead of stacking.
        const wards = 1 + ((target.specials && target.specials.shieldBonus) || 0) / 100; // Warding Charm: shields received are bigger
        status.amount = Math.max(1, Math.round(((spec.amount || 0) + ((spec.percentMaxHp || 0) * target.maxHp) / 100 + (spec.attackMultiplier || 0) * source.stats.attack) * wards));
        status.maxAmount = status.amount;
        status.sourceUid = source.uid;
        status.onBreak = spec.onBreak || null;
        status.fade = !!spec.fade; // shrinks evenly to 0 over its duration (Emergency Buckler)
      }
      if (spec.status === 'invulnerable') status.healPercentOnEnd = spec.healPercentOnEnd || 0;
      if (spec.status === 'regenBoost') status.percentMaxHpPerSec = spec.percentMaxHpPerSec || 0;
      // Stat debuffs: the number comes from the skill/item, or the default in statuses.json.
      for (const field of ['attackPercent', 'defenseFlat', 'defensePercent', 'resistFlat', 'missPercent', 'damageTakenPercent']) {
        if (spec[field] !== undefined || info[field] !== undefined) status[field] = spec[field] ?? info[field];
      }
      if (spec.status === 'shock') {
        status.attackSpeedPercent = spec.attackSpeedPercent ?? info.attackSpeedPercent ?? 0;
        status.fumbleChance = spec.fumbleChance ?? info.fumbleChance ?? 0;
        status.fumbleStunMs = spec.fumbleStunMs ?? info.fumbleStunMs ?? 300;
      }
      if (spec.status === 'tangled') status.attackSpeedPercent = spec.attackSpeedPercent ?? info.attackSpeedPercent ?? 0;
      if (spec.status === 'doom') {
        status.attackSpeedPercent = spec.attackSpeedPercent ?? info.attackSpeedPercent ?? 0;
        status.resistCutPercent = spec.resistCutPercent || 0; // Eclipse Idol: % of resist taken off (the biggest one counts)
      }
      if (info.dot) {
        status.stack = true;
        status.sourceUid = source.uid; // who applied this stack (kill credit, Plague Flask, Thousand Cuts, Magma Core)
        status.damageType = spec.damageType || info.damageType || 'dark';
        status.ignoresArmor = spec.ignoresArmor ?? !!info.ignoresArmor;
        // Damage-type items boost damage over time of that type too (e.g. +15% fire boosts Burn; not Poison).
        const bonus = info.typeBonus === false ? 0 : ((source.damageBonus && source.damageBonus[status.damageType]) || 0) / 100; // Poison: `typeBonus: false`
        const sp = source.side === 'hero' && source.specials ? source.specials : {};
        const magma = spec.status === 'burn' ? sp.magmaBurn || 0 : spec.status === 'poison' ? sp.plaguePoison || 0 : 0; // Magma Core: burns, Plague Flask: poison deal more damage
        const mixCut = (source.elementCut && ((this.rules.elementMix && this.rules.elementMix.elements) || []).includes(status.damageType) ? source.elementCut : 0) / 100; // mixing elements cuts burns too
        status.damage = Math.max(1, Math.round(source.stats.attack * spec.damageMultiplier * (1 + bonus) * (1 - mixCut) * cat.dot * (1 + ((source.side === 'hero' && source.specials && source.specials.dotDamage) || 0) / 100) * (1 + magma / 100)));
        if (!(spec.status in target.dotClocks)) target.dotClocks[spec.status] = 0; // first stack: start the tick clock
      }
    }
    if (spec.status === 'buff') this.refreshStats();
    events.push({ type: 'status', unit: target, change: 'apply', status });
    if (spec.status === 'taunt') this.redirectToTaunter(target, events);
    if (spec.status === 'charm' && target.pending) {
      target.pending = null; // charmed: whatever it was swinging at, it now turns on its friends
      events.push({ type: 'attackCancel', unit: target, reason: 'charmed' });
    }
    // Thousand Cuts: whenever the holder applies Bleed it adds 1 EXTRA Bleed stack.
    if (spec.status === 'bleed' && source && source.specials && source.specials.thousandCuts && !spec.extra && source.side === 'hero') {
      this.applyStatus(target, { ...spec, extra: true }, source, `${skillId}_extra`, events);
    }
    // Gag Rune: a stun or freeze the holder causes also Silences the enemy (2s, +1s per extra copy).
    const gag = source && source.specials && source.specials.gagRune;
    if (gag && target.side === 'enemy' && source.side === 'hero' && (spec.status === 'stun' || spec.status === 'freeze')) {
      this.applyStatus(target, { status: 'silence', durationMs: (1 + gag) * 1000 }, source, 'gag_rune', events);
    }

    // Enough chill: the unit freezes and the chill is used up.
    if (spec.status === 'chill' && info.freezeAt && this.stacks(target, 'chill') >= info.freezeAt) {
      target.statuses = target.statuses.filter((s) => s.type !== 'chill');
      this.applyStatus(target, { status: 'freeze', durationMs: info.freezeMs }, source, 'chill', events);
    }
  },

  // How many stacks of a status a unit has (damage over time: one per application).
  stacks(unit, type) {
    return unit.statuses.filter((s) => s.type === type).length;
  },

  // Counts statuses down, ticks damage over time, and removes finished statuses.
  tickStatuses(dt, events) {
    let buffEnded = false;
    for (const unit of this.allUnits()) {
      if (!unit.alive) continue;
      for (const status of unit.statuses) status.remaining -= dt;
      for (const st of unit.statuses) if (st.regenPerSec && st.amount < st.maxAmount) st.amount = Math.min(st.maxAmount, st.amount + (st.regenPerSec * dt) / 1000); // Fire Heart's shield regenerates
      for (const st of unit.statuses) if (st.fade && st.total > 0) st.amount = Math.min(st.amount, Math.ceil((st.maxAmount * Math.max(0, st.remaining)) / st.total)); // Emergency Buckler: the shield fades
      for (const st of unit.statuses) {
        if (st.type !== 'regenBoost' || unit.hp >= unit.maxHp) continue;
        const gain = Math.min(unit.maxHp - unit.hp, (unit.maxHp * st.percentMaxHpPerSec * this.regenAura().factor * dt) / 100000); // Ballad of Rest (Cleric aura makes it stronger)
        unit.hp += gain;
        unit.regenAcc += gain;
      }
      this.tickDots(unit, dt, events);
      if (!unit.alive) continue;
      const burnsEnded = [];
      for (const status of [...unit.statuses]) {
        if (status.remaining > 0) continue;
        unit.statuses.splice(unit.statuses.indexOf(status), 1);
        if (status.type === 'burn') burnsEnded.push(status);
        if (status.type === 'buff') buffEnded = true;
        events.push({ type: 'status', unit, change: 'expire', status });
        if (status.type === 'invulnerable' && status.healPercentOnEnd > 0) {
          // Divine Shield: it heals when the invulnerability ends.
          this.healUnit(unit, (unit.maxHp * status.healPercentOnEnd) / 100, events, { aura: false });
        }
      }
      if (burnsEnded.length) this.erupt(unit, burnsEnded, events); // Magma Core: a Burn ran out
    }
    if (buffEnded) this.refreshStats();
  },

  // Damage over time: all stacks of one kind (bleed, burn, poison) tick together every `tickMs`
  // (statuses.json). One tick = the sum of every stack's damage, shown as one number.
  tickDots(unit, dt, events) {
    for (const type of Object.keys(unit.dotClocks)) {
      const stacks = unit.statuses.filter((s) => s.type === type);
      if (!stacks.length) {
        delete unit.dotClocks[type]; // last stack gone: the next one starts a fresh clock
        continue;
      }
      const tickMs = (this.statusDefs[type] && this.statusDefs[type].tickMs) || 1000;
      unit.dotClocks[type] += dt;
      while (unit.dotClocks[type] >= tickMs && unit.alive) {
        unit.dotClocks[type] -= tickMs;
        // Catalyst Vial (`dotCrit`): a holder's share of the tick can CRIT (one roll per holder per tick, the holder's
        // crit chance); a crit share deals the normal crit multiplier + `dotCrit`% (25 per copy).
        let crit = false;
        const share = (h) => {
          if (!h || !h.alive || !h.specials || !h.specials.dotCrit || this.rng() * 100 >= Math.min(h.stats.crit, this.rules.caps.crit)) return 1;
          crit = true;
          return this.rules.critMultiplier + ((h.specials.critDamage || 0) + h.specials.dotCrit) / 100;
        };
        const mults = new Map();
        const mult = (s) => { if (!mults.has(s.sourceUid)) mults.set(s.sourceUid, unit.side === 'enemy' ? share(this.heroes.find((x) => x.uid === s.sourceUid)) : 1); return mults.get(s.sourceUid); };
        const total = stacks.reduce((sum, s) => sum + s.damage * mult(s), 0);
        const { damageType, ignoresArmor } = stacks[0];
        const amount = computeDotDamage(unit, total, damageType, this.rules, this.damageTypes, { ignoresArmor });
        const d = this.dealDamage(unit, amount, events);
        const shares = {}; // who put the stacks on, as parts of the tick (run stats)
        for (const st of stacks) if (st.sourceUid != null && total > 0) shares[st.sourceUid] = (shares[st.sourceUid] || 0) + (st.damage * mult(st)) / total;
        events.push({ type: 'dot', unit, amount: d.immune ? 0 : amount - d.absorbed, absorbed: d.absorbed, immune: d.immune, damageType, status: type, stacks: stacks.length, crit, shares });
        if (damageType === 'dark' && type !== 'doom' && !d.immune) for (const h of this.heroes) { const mine = stacks.filter((x) => x.sourceUid === h.uid).reduce((n, x) => n + x.damage, 0); if (mine) this.storeDark(h, ((amount - d.absorbed) * mine) / total, events); }
        if (type === 'burn' && unit.alive && unit.hp > 0) this.ghastlyBurn(unit, stacks, events); // Ghastly Fire: burns also deal dark damage
        this.breakEffects(unit, d.broken, events);
        if (unit.hp <= 0 && unit.alive) this.killUnit(unit, events);
      }
    }
  },
};
