// Part of BattleState (mixed into its prototype at the bottom of ../BattleState.js; `this` is the BattleState).
// Skills: casting, wind-up, release, skill hits, area skills, flasks and healing (docs/systems/skills.md).

export const skillsMethods = {
  // ---- skills -------------------------------------------------------------------------

  // The skill a slot would cast NOW. A skill with a `rotation` (the Mage's Elemental Rotation) is a list of
  // spells; the slot's `rotation` counter says which one is next (it advances when the spell goes off).
  // The spell's fields (name, short, target, damage...) override the skill's.
  currentSpell(hero, index) {
    const slot = hero.skills[index];
    const base = this.skillDefs[slot.id];
    if (!base.rotation) return base;
    return this.charmed(hero, { ...base, ...base.rotation[(slot.rotation || 0) % base.rotation.length] });
  },

  // Mage's spells grow with their element charm (`charm: { item, damagePercent, splashPercent, radiusPercent, jumps }`,
  // per copy the caster holds): Kindling = bigger Fireball, Frost Charm = bigger Nova, Storm Charm = more Chain jumps.
  charmed(hero, spell) {
    const c = spell.charm;
    const n = c && hero.items ? hero.items.filter((i) => i === c.item).length : 0;
    if (!n) return spell;
    const out = { ...spell };
    if (c.damagePercent) out.damageMultiplier = spell.damageMultiplier * (1 + (c.damagePercent * n) / 100);
    if (c.splashPercent && spell.splash) out.splash = { ...spell.splash, damageMultiplier: spell.splash.damageMultiplier * (1 + (c.splashPercent * n) / 100) };
    if (c.radiusPercent && spell.area) out.area = { ...spell.area, radius: spell.area.radius * (1 + (c.radiusPercent * n) / 100) };
    if (c.jumps && spell.chainJumps !== undefined) out.chainJumps = spell.chainJumps + c.jumps * n;
    return out;
  },

  // Can this hero cast this skill right now? Returns false if not (dead, stunned, cooling down,
  // or nothing to aim at). Skills cost no mana: only the cooldown limits them.
  canCast(hero, index) {
    const slot = hero.skills[index];
    if (!slot || !hero.alive || hero.casting || this.isStunned(hero) || this.has(hero, 'silence')) return false;
    const skill = this.currentSpell(hero, index);
    if (slot.cooldownLeft > 0) return false;
    if (this.targetsAllies(skill)) return true;
    return this.enemies.some((e) => e.alive);
  },

  // Skills that only touch the hero's side (no enemy needed to cast them).
  targetsAllies(skill) {
    return skill.target === 'self' || skill.target === 'squad' || skill.target === 'lowestAlly' || (skill.random && skill.random.target === 'ally');
  },

  // How long a skill winds up before it goes off: the skill's `castMs`, else combat.json
  // `skillWindUp.defaultCastMs` (0 = instant). Longer than a normal attack, so you can see it coming.
  castTime(skill) {
    return skill.castMs ?? (this.rules.skillWindUp && this.rules.skillWindUp.defaultCastMs) ?? 0;
  },

  // Taps a hero's skill: it goes on cooldown at once and starts winding up (castStart); it goes off
  // when the wind-up is done (see tickCasting). Instant if the wind-up time is 0.
  // Returns events (empty if the skill could not be cast).
  castSkill(heroUid, index) {
    const events = [];
    const hero = this.heroes.find((h) => h.uid === heroUid);
    if (!hero || !this.canCast(hero, index)) return events;
    const slot = hero.skills[index];
    const skill = this.currentSpell(hero, index);
    const book = this.pageTotals(slot); // skill book pages: shorter cooldown / wind-up (Swift, Steady Hands, Hasty, Overcharge)
    slot.cooldownLeft = skill.cooldownMs * (1 - Math.min(95, hero.specials.cooldown || 0) / 100) * (1 - Math.min(75, book.cooldown) / 100); // Hourglass
    const castMs = this.castTime(skill) * (1 - Math.min(75, book.windup) / 100) * book.windupMultiplier;
    if (castMs <= 0) {
      this.releaseSkill(hero, index, events);
      return events;
    }
    hero.casting = { index, remaining: castMs, total: castMs };
    events.push({ type: 'castStart', unit: hero, skill, index, castMs });
    return events;
  },

  // A wind-up (or a channel, see startChannel) runs down. Stunned, frozen or silenced meanwhile: the
  // skill is LOST (it stays on cooldown, the user's choice); a channel stops where it is.
  tickCasting(hero, dt, events) {
    if (!hero.casting) return;
    const c = hero.casting;
    const skill = c.channel ? c.channel.skill : this.currentSpell(hero, c.index);
    if (this.isStunned(hero) || this.has(hero, 'silence')) {
      hero.casting = null;
      events.push({ type: 'castCancel', unit: hero, skill, reason: 'interrupted' });
      return;
    }
    c.remaining -= dt;
    if (c.channel) {
      // The channel fires its waves one after another (Rain of Arrows, Crescendo).
      c.channel.timer -= dt;
      while (c.channel.timer <= 0 && c.channel.wave < c.channel.waves.length) {
        this.fireWave(hero, c.channel, events);
        c.channel.timer += c.channel.intervalMs;
      }
      if (c.channel.wave >= c.channel.waves.length) hero.casting = null;
      return;
    }
    if (c.flasks) {
      // Flasks thrown one after another (`random.intervalMs`, Alchemist).
      const f = c.flasks;
      f.timer -= dt;
      while (f.timer <= 0 && f.left > 0) {
        this.castPages = f.book.length ? { hero, mods: f.book } : null;
        const thrown = this.throwFlask(hero, f.skill, f.slotId, f.healed, events);
        this.castPages = null;
        f.left = thrown ? f.left - 1 : 0;
        f.timer += f.skill.random.intervalMs;
      }
      if (f.left <= 0) hero.casting = null;
      return;
    }
    if (c.remaining > 0) return;
    const { index } = c;
    hero.casting = null;
    this.releaseSkill(hero, index, events);
  },

  // The skill goes off. One-target skills hit the focused enemy, else the hero's usual target
  // (picked now, at the end of the wind-up).
  releaseSkill(hero, index, events, echo = null) {
    const slot = hero.skills[index];
    let skill = echo ? echo.spell : this.currentSpell(hero, index);
    // Conductor's Baton: the holder's SUPPORT skills are stronger and last longer.
    if (skill.kind === 'support' && hero.specials.baton) skill = this.scaleSupport(skill, 1 + hero.specials.baton / 100);
    // Skill book pages on this skill: power and duration (an echo is already scaled), modifiers (see bookCast / skillHit).
    const book = this.pageTotals(slot);
    const desp = book.mods.find((m) => m.desperate); // Desperate: more power while the caster is low
    const power = book.power + (desp && (hero.hp / hero.maxHp) * 100 < desp.desperate.belowPercent ? desp.desperate.power : 0);
    if (!echo && (power || book.duration)) skill = this.scaleSkill(skill, Math.max(0.1, 1 + power / 100), 1 + book.duration / 100);
    // Nothing to hit: no living enemy, or every one left can't be hit right now (Morthul as dust, Vharox in the sky).
    if (!this.targetsAllies(skill) && !this.targetableEnemies().length) {
      events.push({ type: 'castCancel', unit: hero, skill, reason: 'noTarget' });
      return;
    }
    if (!echo && this.skillDefs[slot.id].rotation) slot.rotation = ((slot.rotation || 0) + 1) % this.skillDefs[slot.id].rotation.length; // next spell next time

    let targets;
    let zone = null;
    if (skill.random) targets = [];
    else if (skill.target === 'self') targets = [hero];
    else if (skill.target === 'squad') targets = this.squadUnits(); // every living hero and minion
    else if (skill.target === 'lowestAlly') targets = [this.lowestHealthPercent()];
    else if (skill.target === 'allEnemies') ({ targets, zone } = this.areaHit(hero, skill)); // an `area` skill hits only who stands in it
    else targets = [this.pickTarget(hero)];
    targets = targets.filter(Boolean); // a pick can come back empty (no target left): never hit "nobody"
    if (!skill.random && !targets.length) {
      events.push({ type: 'castCancel', unit: hero, skill, reason: 'noTarget' });
      return;
    }
    if (skill.chain && targets[0]) targets = this.chainOrder(targets[0]); // Chain Lightning: through ALL enemies, nearest next
    if (skill.chain && skill.chainJumps !== undefined) targets = targets.slice(0, 1 + skill.chainJumps); // ...or `chainJumps` jumps (v3)
    const splash = (hero.specials && hero.specials.skillSplash) || 0; // Siege Cannon: % chance to hit the neighbours too
    if (skill.target === 'enemy' && skill.damageMultiplier && splash > 0 && this.rng() * 100 < splash) {
      const near = this.neighbours(targets[0]);
      if (near.length) {
        targets = [...targets, ...near];
        events.push({ type: 'proc', unit: hero, label: 'Splash!', itemId: 'siege_cannon' });
      }
    }

    const moved = skill.staysAtImpact && targets[0] ? this.moveToImpact(hero, targets[0], slot.id) : null; // dash / leap: he stays where he hit
    events.push({ type: 'cast', unit: hero, skill, skillId: slot.id, targets, zone, moved }); // skillId: the skill's own sound (skill_<id>); moved = where he came from
    if (!echo) this.bookCast(hero, skill, book.mods, events, targets);
    this.castPages = book.mods.length ? { hero, mods: book.mods } : null; // on-hit modifiers (Inks, Siphon) for this cast's hits
    // Blood Pact: the skill costs the caster some of their own health.
    if (skill.selfCostPercent) {
      const cost = Math.round((hero.maxHp * skill.selfCostPercent) / 100);
      hero.hp = Math.max(1, hero.hp - cost);
      events.push({ type: 'selfCost', unit: hero, amount: cost });
    }
    for (const spec of skill.selfApply || []) this.applyStatus(hero, spec, hero, `${slot.id}_self`, events); // Challenge: +defense for himself
    if (skill.songSwitch) this.switchSong(hero, events); // Bard's Change Song
    if (skill.teamElements) { this.teamElementsMs = skill.teamElements.durationMs; events.push({ type: 'proc', unit: hero, label: 'Team Elements!' }); } // Arcane Ward v3
    // `cleanse: N`: every target loses N debuffs (a whole kind each, the oldest first).
    if (skill.cleanse) for (const t of targets) this.cleanse(t, skill.cleanse, events);
    // `applyEnemies`: statuses every living enemy gets (Smoke Bomb: blind).
    for (const spec of skill.applyEnemies || []) for (const e of this.enemies.filter((x) => x.alive)) this.applyStatus(e, spec, hero, slot.id, events);

    if (skill.channel) {
      // A channel: after the cast it keeps firing waves; the hero is busy until the last one.
      const ch = skill.channel;
      hero.casting = { index, remaining: ch.waves.length * ch.intervalMs, total: ch.waves.length * ch.intervalMs, channel: { skill, slotId: slot.id, waves: ch.waves, intervalMs: ch.intervalMs, timer: 0, wave: 0, zone, book: book.mods, aimUid: targets[0] && targets[0].uid } };
      this.castPages = null;
      return;
    }
    if (skill.random && skill.random.intervalMs && !echo) {
      // Flasks one after another: the first goes now, the rest every `intervalMs`; the hero is busy until the last.
      const r = skill.random;
      const flasks = { skill, slotId: slot.id, healed: new Set(), left: r.count, timer: 0, book: book.mods };
      const ms = Math.max(1, (r.count - 1) * r.intervalMs);
      hero.casting = { index, remaining: ms, total: ms, flasks };
      this.castPages = null;
      this.tickCasting(hero, 0, events);
      return;
    }
    if (skill.boneSacrifice) {
      this.boneSacrifice(hero, skill, slot.id, events);
      this.castPages = null;
      return;
    }
    if (skill.holyNova) {
      this.holyNova(hero, skill, slot.id, targets[0], events);
      this.castPages = null;
      return;
    }
    if (skill.random) {
      this.throwFlasks(hero, skill, slot.id, events);
      this.castPages = null;
      return;
    }
    let first = true;
    for (const target of targets) {
      // Eviscerate (`finisher`): spends the combo points on this enemy; a full combo crits, bleeds and fires every on-hit item.
      let fin = null;
      if (skill.finisher) {
        const pts = hero.combo.uid === target.uid ? hero.combo.points : 0;
        const full = pts >= ((hero.def.passive && hero.def.passive.combo && hero.def.passive.combo.max) || 5);
        fin = { multiplier: skill.damageMultiplier + skill.finisher.perPoint * pts, critBonus: full ? 100 : 0, full };
        hero.combo = { uid: target.uid, points: 0 };
        events.push({ type: 'combo', unit: hero, target, points: 0, spent: pts });
      }
      const res = this.skillHit(hero, skill, slot.id, target, events, { jumpFrom: skill.chain && !first ? targets[targets.indexOf(target) - 1] : null, scale: echo ? echo.power : 1, multiplier: fin ? fin.multiplier : undefined, critBonus: fin ? fin.critBonus : 0, riders: !!(skill.triggersOnHit || skill.procBoost) }); // on-hit skills carry the element charms in the hit
      if (fin && fin.full && target.alive && res && !res.dodged) {
        for (const spec of skill.finisher.applyAtMax || []) this.applyStatus(target, spec, hero, `${slot.id}_max`, events);
        this.rollProcs(hero, 'onAttack', events, { target, hit: true, force: true });
      }
      // Headshot (`triggersOnHit`): counts as a basic attack for on-hit items.
      if (skill.triggersOnHit && res && target.alive) {
        this.rollProcs(hero, 'onAttack', events, { target, hit: !res.dodged, folded: true });
      }
      // Savage Leap v3 (`procBoost`): every enemy it hits rolls his on-hit items, at `procBoost` times their chance.
      if (skill.procBoost && res && target.alive) this.rollProcs(hero, 'onAttack', events, { target, hit: !res.dodged, chanceMult: skill.procBoost, folded: true });
      // Savage Leap (`landSplash`): a shockwave hits the other enemies near where he lands.
      if (skill.landSplash && first) {
        const near = this.enemies.filter((e) => e.alive && e !== target && (this.hasPositions(e) && this.hasPositions(target) ? this.distance(e, target) <= skill.landSplash.radius : this.neighbours(target).includes(e)));
        for (const e of near) {
          const r = this.skillHit(hero, { ...skill, apply: null, doubleIf: null, landSplash: null }, slot.id, e, events, { multiplier: skill.landSplash.damageMultiplier, riders: !!skill.procBoost });
          if (skill.procBoost && r && e.alive) this.rollProcs(hero, 'onAttack', events, { target: e, hit: !r.dodged, chanceMult: skill.procBoost, folded: true });
        }
      }
      first = false;
      // Fireball: the neighbours of its target are hit too, for a share of the damage, with the same debuffs.
      if (skill.splash && target === targets[0] && skill.target === 'enemy') {
        for (const n of this.neighbours(target)) this.skillHit(hero, skill, slot.id, n, events, { multiplier: skill.splash.damageMultiplier, scale: echo ? echo.power : 1 });
      }
    }
    // Wind Cutter v3 (`killCooldownCutPercent`): if the cast killed an enemy, its cooldown is cut.
    if (skill.killCooldownCutPercent && !echo && targets.some((t) => !t.alive)) {
      slot.cooldownLeft *= 1 - skill.killCooldownCutPercent / 100;
      events.push({ type: 'proc', unit: hero, label: 'Perfect Cut!' });
    }
    if (!echo) this.bookAfterCast(hero, skill, slot.id, targets, book.mods, events);
    this.castPages = null;
    // Echo Rune: a skill sometimes casts a second time (the echo cannot echo, the Mage's rotation does not move again).
    // Channels (Rain of Arrows, Crescendo) and flasks thrown one by one do not echo.
    const chance = hero.specials.echo || 0;
    if (!echo && chance > 0 && !skill.channel && !(skill.random && skill.random.intervalMs) && this.rng() * 100 < chance) {
      events.push({ type: 'proc', unit: hero, label: 'Echo!', itemId: 'echo_rune' });
      const copies = hero.specials.echoCopies || 1;
      this.releaseSkill(hero, index, events, { spell: skill, power: (hero.specials.echoPower || 60) / 100 + 0.1 * (copies - 1) }); // Echo Rune: echo power, +10% per extra rune
    }
  },

  // A skill with skill book power `power` (1.08 = +8%: damage, heals, shields, buff sizes) and `dur` (1.15 = what it
  // gives lasts 15% longer). Returns a scaled copy.
  scaleSkill(skill, power, dur) {
    const spec = (s) => {
      const out = { ...s };
      if (out.durationMs) out.durationMs *= dur;
      if (out.mods) out.mods = out.mods.map((m) => ({ ...m, ...(m.percent !== undefined ? { percent: m.percent * power } : {}), ...(m.flat !== undefined ? { flat: m.flat * power } : {}) }));
      for (const f of ['amount', 'percentMaxHp', 'attackMultiplier', 'healPercentOnEnd', 'percentMaxHpPerSec']) if (out[f] !== undefined) out[f] *= power;
      return out;
    };
    const list = (a) => (a ? a.map(spec) : a);
    const out = { ...skill, apply: list(skill.apply), applyEnemies: list(skill.applyEnemies), selfApply: list(skill.selfApply), waveApply: list(skill.waveApply), onCrit: list(skill.onCrit) };
    if (skill.damageMultiplier) out.damageMultiplier = skill.damageMultiplier * power;
    if (skill.heal) out.heal = { ...skill.heal, percentMaxHp: (skill.heal.percentMaxHp || 0) * power, attackMultiplier: (skill.heal.attackMultiplier || 0) * power };
    if (skill.channel) out.channel = { ...skill.channel, waves: skill.channel.waves.map((w) => w * power) };
    if (skill.finisher) out.finisher = { ...skill.finisher, perPoint: skill.finisher.perPoint * power, applyAtMax: list(skill.finisher.applyAtMax) };
    if (skill.splash) out.splash = { ...skill.splash, damageMultiplier: skill.splash.damageMultiplier * power };
    if (skill.landSplash) out.landSplash = { ...skill.landSplash, damageMultiplier: skill.landSplash.damageMultiplier * power };
    if (skill.random) out.random = { ...skill.random, pool: skill.random.pool.map((f) => ({ ...f, ...(f.damageMultiplier ? { damageMultiplier: f.damageMultiplier * power } : {}), ...(f.apply ? { apply: list(f.apply) } : {}), ...(f.heal ? { heal: { ...f.heal, percentMaxHp: f.heal.percentMaxHp * power } } : {}) })) };
    return out;
  },

  // A support skill made stronger and longer by `k` (1.25 = 25%): every status it applies lasts longer, its
  // numbers (buff mods, shields, heals, regen, marks) are bigger.
  scaleSupport(skill, k) {
    const scaleSpec = (spec) => {
      const out = { ...spec };
      if (out.durationMs) out.durationMs *= k;
      if (out.mods) out.mods = out.mods.map((m) => ({ ...m, ...(m.percent !== undefined ? { percent: m.percent * k } : {}), ...(m.flat !== undefined ? { flat: m.flat * k } : {}) }));
      for (const f of ['amount', 'percentMaxHp', 'attackMultiplier', 'healPercentOnEnd', 'percentMaxHpPerSec', 'damageTakenPercent']) if (out[f] !== undefined) out[f] *= k;
      return out;
    };
    const out = { ...skill };
    if (skill.apply) out.apply = skill.apply.map(scaleSpec);
    if (skill.applyEnemies) out.applyEnemies = skill.applyEnemies.map(scaleSpec);
    if (skill.heal) out.heal = { ...skill.heal, percentMaxHp: (skill.heal.percentMaxHp || 0) * k };
    if (skill.random) out.random = { ...skill.random, pool: skill.random.pool.map((f) => ({ ...f, ...(f.apply ? { apply: f.apply.map(scaleSpec) } : {}), ...(f.heal ? { heal: { ...f.heal, percentMaxHp: f.heal.percentMaxHp * k } } : {}) })) };
    return out;
  },

  // One hit of a skill on one target (damage, bonuses, statuses, healing). opts.multiplier overrides the
  // skill's damageMultiplier (waves, splash). Returns the strike result or null (no damage in this skill).
  skillHit(hero, skill, slotId, target, events, opts = {}) {
    let result = null;
    // Sela's Mirror Ward: the first hero skill that hits her bounces back on the caster.
    const ward = hero.side === 'hero' && target.side === 'enemy' && this.reflects(target);
    if (ward && (skill.damageMultiplier || (skill.apply || []).length)) {
      target.statuses.splice(target.statuses.indexOf(ward), 1);
      events.push({ type: 'status', unit: target, change: 'expire', status: ward });
      events.push({ type: 'reflect', unit: target, at: hero });
      if (skill.damageMultiplier) return this.strike(hero, hero, events, { multiplier: (opts.multiplier ?? skill.damageMultiplier), damageType: skill.damageType, reflected: true });
      return null;
    }
    let base = opts.multiplier ?? skill.damageMultiplier;
    // Defense Bash (`defenseMultiplier`): also deals that many times the caster's DEFENSE (as a share of his attack).
    if (skill.defenseMultiplier && opts.multiplier === undefined) base += (skill.defenseMultiplier * hero.stats.defense) / Math.max(1, hero.stats.attack);
    // Necromancer's Souls (`soulBonusPercent`): every Soul makes this skill stronger, then they are all spent.
    if (skill.soulBonusPercent && hero.souls) {
      base *= 1 + (hero.souls * skill.soulBonusPercent) / 100;
      events.push({ type: 'proc', unit: hero, label: `Souls x${hero.souls}!` });
      hero.souls = 0;
      events.push({ type: 'soul', unit: hero, souls: 0 });
    }
    // Knight's Grudge: the charge from reflected hits makes this skill stronger, then it is used up.
    if (skill.grudgeCharged && hero.grudge) {
      base *= 1 + (hero.grudge * hero.def.passive.grudge.perReflectPercent) / 100;
      events.push({ type: 'proc', unit: hero, label: `Grudge x${hero.grudge}!` });
      hero.grudge = 0;
      events.push({ type: 'grudge', unit: hero, stacks: 0 });
    }
    if (base) {
      let mult = base * (1 + (((hero.specials && hero.specials.skillDamage) || 0) + this.bookmarkBonus(hero)) / 100) * (opts.scale ?? 1);
      // Bonus damage against certain enemies: `debuffedMultiplier` (any debuff: Smite, Death Coil), `bonusVs`
      // (a list of { status, multiplier }: Chain Lightning vs burning/frozen), `doubleIf` (x2 if the target
      // is bleeding / below half health: Savage Leap).
      if (skill.debuffedMultiplier && this.isDebuffed(target)) mult *= skill.debuffedMultiplier;
      for (const b of skill.bonusVs || []) if (target.statuses.some((st) => st.type === b.status)) mult *= b.multiplier;
      if (skill.doubleIf && skill.doubleIf.some((c) => (c === 'bleed' ? this.has(target, 'bleed') : c === 'below50' ? target.hp < target.maxHp / 2 : false))) mult *= 2;
      result = this.strike(hero, target, events, {
        multiplier: mult,
        damageType: skill.damageType,
        critBonus: (opts.critBonus || 0) + (skill.sureCrit ? 100 : 0), // Wind Cutter v3: always crits
        ignoreArmor: !!skill.ignoresArmor,
        skill,
        projectile: skill.chain ? 'lightning' : skill.projectile,
        from: opts.jumpFrom || undefined,
        riders: !!opts.riders,
      });
      // Smite: the most hurt ally heals for a share of the damage that got through.
      if (skill.healShare && !result.dodged) {
        const ally = this.lowestHealthAlly();
        const amount = Math.round(((result.amount - (result.absorbed || 0)) * skill.healShare) / 100);
        if (ally && amount > 0) this.healUnit(ally, amount, events, { by: hero });
      }
      // Death Coil: a kill raises a skeleton.
      if (!target.alive && skill.onKill && skill.onKill.raise) {
        this.spawnMinion(hero, { kind: 'weak', key: 'hero', spec: { minion: skill.onKill.raise, cap: (hero.def.spawner && hero.def.spawner.cap) || 4 } }, events);
      }
      this.bookOnHit(hero, target, result, events); // Inks, Siphon
      if (result.dodged || !target.alive) return result;
      // `onCrit`: statuses that only a crit puts on the target (Fan of Knives: bleed).
      if (result.crit) for (const spec of skill.onCrit || []) this.applyStatus(target, spec, hero, `${slotId}_crit`, events);
    }
    for (const spec of skill.apply || []) this.applyStatus(target, spec, hero, slotId, events);
    if (skill.heal) this.healUnit(target, this.healAmount(hero, target, skill.heal), events, { by: hero });
    return result;
  },

  // One wave of a channel: every living enemy takes a hit (growing in Crescendo), `waveApply` statuses with a chance each.
  fireWave(hero, ch, events) {
    this.castPages = ch.book && ch.book.length ? { hero, mods: ch.book } : null;
    const mult = ch.waves[ch.wave];
    // The zone follows its main target while that one lives (enemies walk during a channel).
    const z = ch.zone;
    const aim = z && this.enemies.find((e) => e.uid === z.aimUid && e.alive);
    if (aim && z.at !== 'caster') {
      if (z.shape === 'cone') z.dir = Math.atan2(aim.y - z.y, aim.x - z.x);
      else { z.x = aim.x; z.y = aim.y; }
    }
    let targets = this.enemies.filter((e) => e.alive && (!z || e === aim || this.inZone(e, z)));
    // A one-enemy channel (Multistrike, skill target 'enemy'): every wave hits the same enemy, or the next one if it died.
    if (ch.skill.target === 'enemy') {
      let one = this.enemies.find((e) => e.uid === ch.aimUid && e.alive);
      if (!one) { one = this.pickTarget(hero); if (one) ch.aimUid = one.uid; }
      targets = one ? [one] : [];
    }
    events.push({ type: 'wave', unit: hero, skill: ch.skill, wave: ch.wave, waves: ch.waves.length, targets, zone: z });
    for (const t of targets) {
      const res = this.skillHit(hero, { ...ch.skill, apply: null, onCrit: ch.skill.onCrit }, ch.slotId, t, events, { multiplier: mult });
      if (res && !res.dodged && t.alive) for (const spec of ch.skill.waveApply || []) if (this.rng() * 100 < (spec.chance ?? 100)) this.applyStatus(t, spec, hero, ch.slotId, events);
      // Arrow Rain (`waveOnHit`): every wave rolls the caster's on-hit items on each enemy it hits.
      if (ch.skill.waveOnHit && res && t.alive) {
        this.rollProcs(hero, 'onAttack', events, { target: t, hit: !res.dodged });
      }
    }
    this.castPages = null;
    ch.wave++;
  },

  // AREA skills (skills.json `area`): where the skill lands and which enemies stand in it.
  //   { shape: 'circle', at: 'target' | 'caster', radius, ySquash }  an oval around the hero's target (or itself)
  //   { shape: 'cone', range, angleDeg }                              a wedge from the caster towards its target
  //   { shape: 'band', halfHeight }                                   a strip across the field at the target's height
  // The target itself is always hit. Without positions (some rule tests) or without `area`: every living enemy.
  areaHit(hero, skill) {
    const alive = this.targetableEnemies();
    const a = skill.area;
    if (!a || !this.hasPositions(hero) || !alive.every((e) => this.hasPositions(e))) return { targets: alive, zone: null };
    const aim = this.pickTarget(hero) || alive[0];
    let zone;
    if (a.shape === 'cone') zone = { shape: 'cone', x: hero.x, y: hero.y, dir: Math.atan2(aim.y - hero.y, aim.x - hero.x), range: a.range, half: ((a.angleDeg || 60) * Math.PI) / 360 };
    else if (a.shape === 'band') zone = { shape: 'band', x: aim.x, y: aim.y, halfHeight: a.halfHeight };
    else {
      const c = a.at === 'caster' ? hero : aim;
      zone = { shape: 'circle', x: c.x, y: c.y, radius: a.radius, ySquash: a.ySquash ?? 0.7 };
    }
    zone.aimUid = aim.uid;
    zone.at = a.at;
    return { targets: alive.filter((e) => e === aim || this.inZone(e, zone)), zone };
  },

  inZone(unit, z) {
    if (!this.hasPositions(unit)) return true;
    const dx = unit.x - z.x;
    const dy = unit.y - z.y;
    if (z.shape === 'band') return Math.abs(dy) <= z.halfHeight;
    if (z.shape === 'cone') {
      if (Math.hypot(dx, dy) > z.range) return false;
      let diff = Math.atan2(dy, dx) - z.dir;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return Math.abs(diff) <= z.half;
    }
    const ry = z.radius * z.ySquash;
    return (dx / z.radius) ** 2 + (dy / ry) ** 2 <= 1;
  },

  // Alchemist flasks: `random: { count, target: 'enemy' | 'ally', pool: [ { name, color, damageType,
  // damageMultiplier, apply, heal } ] }`. Each flask picks a random living target and a random flask from the pool.
  // With `intervalMs` they go one after another (tickCasting), else all at once.
  throwFlasks(hero, skill, slotId, events) {
    const healed = new Set();
    for (let i = 0; i < skill.random.count; i++) if (!this.throwFlask(hero, skill, slotId, healed, events)) return;
  },

  // One flask. Returns false when there is nobody left to throw at.
  throwFlask(hero, skill, slotId, healed, events) {
    const r = skill.random;
    const side = r.target === 'enemy' ? this.enemies.filter((e) => e.alive) : this.heroes.filter((h) => h.alive);
    if (!side.length) return false;
    const flask = r.pool[Math.floor(this.rng() * r.pool.length)];
    // `healsMostHurt`: a healing flask goes to the most hurt hero (lowest health %) not healed yet this cast.
    let target = side[Math.floor(this.rng() * side.length)];
    if (r.healsMostHurt && flask.heal) {
      const open = side.filter((h) => !healed.has(h));
      if (open.length) target = open.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a));
      healed.add(target);
    }
    events.push({ type: 'flask', unit: hero, target, flask });
    this.skillHit(hero, { damageType: flask.damageType, damageMultiplier: flask.damageMultiplier, apply: flask.apply, heal: flask.heal }, `${slotId}_${flask.name}`, target, events);
    // Enemy flasks splash a small area where they land (`splash: { radius, multiplier }`).
    if (r.target === 'enemy' && r.splash) {
      for (const e of this.enemies.filter((x) => x.alive && x !== target && this.hasPositions(x) && this.hasPositions(target) && this.distance(x, target) <= r.splash.radius)) {
        this.skillHit(hero, { damageType: flask.damageType, damageMultiplier: flask.damageMultiplier * r.splash.multiplier, apply: flask.apply }, `${slotId}_${flask.name}_splash`, e, events);
      }
    }
    return true;
  },

  // How much a heal of `spec` { percentMaxHp, attackMultiplier } gives `target` from `healer`.
  healAmount(healer, target, spec) {
    return Math.max(1, Math.round(((spec.percentMaxHp || 0) * target.maxHp) / 100 + (spec.attackMultiplier || 0) * healer.stats.attack));
  },

  // Heals a unit. `amount` is made stronger by the Cleric's aura (unless opts.aura is false: the caller already did it).
  // A heal that really restored health is a "heal received": the Lost Cleric's Grimoire reacts to it.
  // Returns the health restored.
  healUnit(unit, amount, events, opts = {}) {
    const raw = Math.round(amount * (opts.aura === false ? 1 : this.regenAura().factor));
    const room = unit.maxHp - unit.hp;
    const got = Math.min(room, raw);
    if (got <= 0) return 0;
    unit.hp += got;
    events.push({ type: 'heal', unit, amount: got, by: opts.by || null }); // by: the healer (run stats), when the caller names one
    this.onHealed(unit, got, events);
    return got;
  },

  // The unit was healed for `got` health: Lost Cleric's Grimoire launches green fire at a random enemy
  // (chance per copy, capped; its fireball is item damage: no lifesteal, no other effects).
  onHealed(unit, got, events) {
    const sp = unit.specials;
    if (!sp || !sp.soulEnergy || unit.side !== 'hero' || unit.minion || !unit.alive) return;
    // Lost Cleric's Grimoire: healing received is stored as Soul Energy (100% per copy). At 10% of max health it
    // bursts out as a green fireball dealing `soulDamage`% of the stored energy (at most one every 0.1s); it bursts at
    // `soulFill`% of max health (7).
    unit.soul = (unit.soul || 0) + (got * sp.soulEnergy) / 100;
    const foes = this.targetableEnemies();
    if (!foes.length || unit.soul < (unit.maxHp * (sp.soulFill || 10)) / 100 || (unit.soulCd || 0) > 0) return;
    const target = foes[Math.floor(this.rng() * foes.length)];
    const damage = unit.soul * ((sp.soulDamage || 250) / 100);
    unit.soul = 0;
    unit.soulCd = 100;
    events.push({ type: 'proc', unit, label: 'Grimoire!', itemId: 'lost_clerics_grimoire', target });
    this.strike(unit, target, events, { multiplier: damage / Math.max(1, unit.stats.attack), damageType: 'fire', projectile: 'greenfire', item: true });
  },
};
