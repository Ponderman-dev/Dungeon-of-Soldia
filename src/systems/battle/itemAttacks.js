// Part of BattleState (mixed into its prototype at the bottom of ../BattleState.js; `this` is the BattleState).
// Item effects on the attacking side: procs, bombs, chains, extra hits and the items that change a basic attack (docs/systems/items.md).
import { computeDamage, computeDotDamage } from '../combat.js';

export const itemAttacksMethods = {
  // Ghastly Fire: an enemy burning from a holder attacks `ghastlySlow`% slower per burn stack (5, +2 per extra copy), max 75%.
  ghastlySlow(unit) {
    let slow = 0;
    for (const st of unit.statuses) {
      if (st.type !== 'burn') continue;
      const h = this.heroes.find((x) => x.uid === st.sourceUid && x.alive);
      if (h && h.specials && h.specials.ghastlySlow) slow += h.specials.ghastlySlow;
    }
    return Math.min(75, slow);
  },

  // Spirit Axe (user v2: spin ONCE): `spiritAxe`% (8 per copy) when the holder is hit: a ghostly axe spins once around it
  // and hits every enemy within `spiritAxeRadius` px for `spiritAxeDamage`% (400) of the holder's attack (item damage).
  trySpiritAxe(target, events) {
    const sp = target.specials || {};
    if (!sp.spiritAxe || target.minion || !target.alive || this.rng() * 100 >= sp.spiritAxe) return;
    events.push({ type: 'proc', unit: target, label: 'Spirit Axe!', itemId: 'spirit_axe' });
    const near = this.targetableEnemies().filter((e) => !this.hasPositions(target) || !this.hasPositions(e) || Math.hypot(e.x - target.x, e.y - target.y) <= sp.spiritAxeRadius);
    for (const e of near) this.strike(target, e, events, { multiplier: sp.spiritAxeDamage / 100, damageType: 'melee', item: true });
  },

  // Flame Spirit: launches 3-5 slow dark fireballs, one after another, at random enemies (`damageMultiplier` each, 300%; item damage).
  conjureSpirit(hero, events, mult = 0.8) {
    const n = 3 + Math.floor(this.rng() * 3);
    events.push({ type: 'proc', unit: hero, label: 'Dark Spirit!', itemId: 'flame_spirit' });
    for (let i = 0; i < n; i++) this.later(250 * i, (ev) => {
      if (!hero.alive) return;
      const foes = this.targetableEnemies();
      if (!foes.length) return;
      const t = foes[Math.floor(this.rng() * foes.length)];
      ev.push({ type: 'projectile', from: hero, to: t, kind: 'spiritfire' }); // a big dark fireball that sways slowly to its target
      this.later(900, (ev2) => { if (t.alive && hero.alive) this.strike(hero, t, ev2, { multiplier: mult, damageType: 'dark', item: true }); });
    });
  },

  // Moonlight Twinblade: a crescent flies at the enemy and hits it 3 times (60% each, +20% per extra copy, item damage).
  moonCrescent(hero, foe, copies, events, hit = 0.6) {
    events.push({ type: 'proc', unit: hero, label: 'Moonlight!', itemId: 'moonlight_twinblade', target: foe });
    events.push({ type: 'projectile', from: hero, to: foe, kind: 'moon' });
    const mult = hit * (1 + 0.2 * (copies - 1)); // `hitMultiplier` of the proc in items.json
    for (let i = 0; i < 3; i++) this.later(300 + 120 * i, (ev) => { if (foe.alive && hero.alive) this.strike(hero, foe, ev, { multiplier: mult, damageType: 'ranged', item: true }); });
  },

  // THUNDERSTRUCK (legendary, `thunderstruck: { damageMultiplier, damageType, delayMs }`): a circle grows under the
  // STRONGEST enemy (boss, then elite, then most max health) for `delayMs`, then a giant bolt hits it. The bolt is a
  // real hit (it can't be dodged): lifesteal, thorns and the holder's on-hit items all go off (not Thunderstruck itself).
  // One circle per holder at a time. If the marked enemy dies first, the bolt hits the next strongest.
  strongestEnemy() {
    const foes = this.targetableEnemies();
    const rank = (u) => (u.def.boss ? 2e9 : 0) + (u.elite ? 1e9 : 0) + u.maxHp;
    return foes.reduce((best, u) => (!best || rank(u) > rank(best) ? u : best), null);
  },

  markThunder(hero, spec, events) {
    const target = this.strongestEnemy();
    if (!target) return false;
    const t = { uid: this.nextUid++, holder: hero, target, spec, remaining: spec.delayMs, total: spec.delayMs };
    (this.thunders = this.thunders || []).push(t);
    events.push({ type: 'proc', unit: hero, label: 'Thunderstruck!', itemId: 'thunderstruck', target });
    return true;
  },

  tickThunders(dt, events) {
    if (!this.thunders || !this.thunders.length) return;
    for (const t of [...this.thunders]) {
      t.remaining -= dt;
      if (t.remaining > 0) continue;
      this.thunders = this.thunders.filter((x) => x !== t);
      const hero = t.holder;
      const target = t.target.alive && !this.untargetable(t.target) ? t.target : this.strongestEnemy();
      if (!hero.alive || !target) continue;
      events.push({ type: 'thunderstruck', unit: hero, target });
      const hit = this.strike(hero, target, events, { multiplier: t.spec.damageMultiplier, damageType: t.spec.damageType, sure: true, noImpact: true });
      this.rollProcs(hero, 'onAttack', events, { target, hit: !hit.dodged, skipItem: 'thunderstruck' });
    }
  },

  // Assault Breastplate (`assaultShred` special, per copy): while its holder lives, EVERY enemy has that much less
  // defense (an aura, adds up over copies and holders; it can go below 0 = more damage, like Armor Break).
  // It starts `assaultDelayMs` (0.5s) into each floor (`floorMs`, counted from startFloor).
  assaultShred() {
    return this.heroes.reduce((sum, h) => sum + (h.alive && h.specials && (this.floorMs || 0) >= (h.specials.assaultDelayMs || 0) ? h.specials.assaultShred || 0 : 0), 0);
  },

  // Ghastly Fire on a burn tick: each holder's share of the burn also hits as DARK damage (`ghastly`% per copy).
  ghastlyBurn(unit, stacks, events) {
    for (const h of this.heroes) {
      const pct = h.alive && h.specials ? h.specials.ghastly || 0 : 0;
      if (!pct) continue;
      const mine = stacks.filter((s) => s.sourceUid === h.uid).reduce((n, s) => n + s.damage, 0);
      if (!mine) continue;
      const amount = Math.max(1, Math.round(computeDotDamage(unit, (mine * pct) / 100, 'dark', this.rules, this.damageTypes, {})));
      const d = this.dealDamage(unit, amount, events);
      events.push({ type: 'dot', unit, amount: d.immune ? 0 : amount - d.absorbed, absorbed: d.absorbed, immune: d.immune, damageType: 'dark', status: 'burn', stacks: 0, shares: { [h.uid]: 1 } });
      if (!d.immune) this.storeDark(h, amount - d.absorbed, events);
      this.breakEffects(unit, d.broken, events);
    }
  },

  // Kinetic Coil v2 (session 31): charges are kept until there are `kineticCoilCount` (3); then the weapon glows and the
  // next basic attack is a LIGHTNING strike: +`kineticCoil`% (400, +200 per extra copy) of its attack as electric inside
  // the hit (a rider), and the charges reset. Returns the riders to add.
  spendCoil(unit, events, target = null) {
    if (!this.coilReady(unit)) return [];
    unit.floor.coil = 0;
    if (events) events.push({ type: 'proc', unit, label: 'Lightning!', itemId: 'kinetic_coil', target }); // a thunderbolt on the enemy
    return [{ damageType: 'electric', multiplier: unit.specials.kineticCoil / 100 }];
  },

  // Kinetic Coil: full of charges (the scene makes the weapon glow).
  coilReady(unit) {
    const n = unit.side === 'hero' && !unit.minion && unit.floor ? unit.floor.coil || 0 : 0;
    return !!(unit.specials && unit.specials.kineticCoil && n >= (unit.specials.kineticCoilCount || 3));
  },

  // Sharpest Blade (reworked session 29, user): only PURE STEEL counts: a basic attack with NO element (plain
  // melee/ranged, no element riders: charms, Chill Band, Magma Core, Kinetic Coil charges...; the Mage's attacks are
  // always elemental). Every pure attack deals +`pureSteel`% (40, +20 per extra copy).
  pureSteel(unit, extra = []) {
    const sp = unit.side === 'hero' && !unit.minion ? unit.specials : null;
    if (!sp || !sp.heartStrike) return false;
    const type = unit.hitType || unit.damageType;
    return (type === 'melee' || type === 'ranged') && !this.riders(unit).length && !extra.length;
  },

  // Every `heartStrike`th (5) pure attack of the floor is a HEART STRIKE: `heartStrikeMult`% (500, +50 per extra
  // copy), plus exactly `heartStrikeMaxHp`% (15) of the enemy's max health (`heartStrikeBossMaxHp`% 2 on a boss) and a stun
  // (2.5s). A Heart Strike that kills makes the next attack one too (`floor.nextHeart`). Returns the multiplier, or 0.
  heartStrike(unit) {
    const sp = unit.specials, f = unit.floor, mult = (sp.heartStrikeMult || 500) / 100;
    if (f.nextHeart) { f.nextHeart = false; return mult; }
    f.heartCount = (f.heartCount || 0) + 1;
    if (f.heartCount < sp.heartStrike) return 0;
    f.heartCount = 0;
    return mult;
  },

  // The pure attacks still to go before the next Heart Strike (the scene shows a glint on the last one); -1 = none.
  heartStrikeIn(unit) {
    if (!this.pureSteel(unit)) return -1;
    return unit.floor.nextHeart ? 0 : unit.specials.heartStrike - 1 - (unit.floor.heartCount || 0);
  },

  // Sweeping Strap (CLEAVE, session 32): every `sweepEvery`th (3) MELEE basic attack of the holder also hits EVERY other
  // enemy in front of it (closer to the enemy side, within `sweepRadius` px (110) of the target) for `sweep`% (70, +35 per
  // extra copy) of the attack as item damage (it triggers nothing). Counted per floor; a dodged swing still counts.
  sweep(unit, target, hit, events) {
    const sp = unit.side === 'hero' && !unit.minion ? unit.specials : null;
    if (!sp || !sp.sweep || unit.damageType !== 'melee') return;
    unit.floor.cleave = (unit.floor.cleave || 0) + 1;
    if (unit.floor.cleave < (sp.sweepEvery || 3)) return;
    unit.floor.cleave = 0;
    const radius = sp.sweepRadius || 110;
    const ahead = (e) => !this.hasPositions(e) || !this.hasPositions(unit) || e.y <= unit.y + 10; // in front = up the screen
    const near = this.enemies.filter((e) => e.alive && e !== target && !this.untargetable(e) && ahead(e) && (!this.hasPositions(e) || !this.hasPositions(target) || Math.hypot(e.x - target.x, e.y - target.y) <= radius));
    events.push({ type: 'sweep', unit, target, radius, cleave: true }); // the scene draws the cleave swing
    for (const e of near) this.strike(unit, e, events, { multiplier: sp.sweep / 100, damageType: 'melee', item: true, burst: true });
  },

  // Dread Bell (FEAR RING, session 32): `fearRing`% (5, +3 per extra) per basic attack of the holder: the target and every
  // enemy within `fearRingRadius` px (100) of it are Feared (`fearRingSpec`, 1s +0.3s per extra copy), then the bell
  // rests `fearRingCooldownMs` (3s). Bosses are immune to fear (enemies.json statusImmune); their adds are not.
  fearRing(unit, target, hit, events) {
    const sp = unit.side === 'hero' && !unit.minion ? unit.specials : null;
    if (!sp || !sp.fearRing || hit.dodged || !target.alive || (unit.floor.fearCd || 0) > this.floorMs) return;
    if (this.rng() * 100 >= this.debuffChance(unit, sp.fearRing)) return;
    unit.floor.fearCd = this.floorMs + (sp.fearRingCooldownMs || 3000);
    const copies = unit.items.filter((i) => i === 'dread_bell').length;
    const base = sp.fearRingSpec || { status: 'fear', durationMs: 1000 };
    const spec = { status: base.status, durationMs: base.durationMs + (base.durationPerCopyMs || 0) * Math.max(0, copies - 1) };
    const radius = sp.fearRingRadius || 100;
    const near = this.enemies.filter((e) => e.alive && !this.untargetable(e) && (e === target || !this.hasPositions(e) || !this.hasPositions(target) || Math.hypot(e.x - target.x, e.y - target.y) <= radius));
    events.push({ type: 'proc', unit, label: 'Fear!', itemId: 'dread_bell', target });
    events.push({ type: 'fearRing', unit, target, radius, targets: near });
    for (const e of near) this.applyStatus(e, spec, unit, `fearRing_${unit.uid}`, events);
  },

  // Mage's ELEMENT CYCLE (passive.elementCycle: ['fire', 'ice', 'electric']): her basic attacks go through the list in
  // turn (`hitType` = the element of her NEXT shot, also how the scene draws it), so they keep setting off Reactions.
  cycleElement(unit) {
    const cyc = unit.def.passive && unit.def.passive.elementCycle;
    if (!cyc || unit.side !== 'hero') return;
    unit.cycleIndex = ((unit.cycleIndex || 0) + 1) % cyc.length;
    unit.hitType = cyc[unit.cycleIndex];
  },

  // Archer's VOLLEY (passive.volley): every `every`th basic shot also fires at `arrows`-1 other enemies (the nearest
  // to her target), +`perQuiver` per Quiver of Plenty she holds. Each arrow is a full shot that rolls her on-hit items.
  // The count is kept for the whole run.
  volley(unit, target, events) {
    const V = unit.def.passive && unit.def.passive.volley;
    if (!V || unit.side !== 'hero') return;
    unit.volleyCount = (unit.volleyCount || 0) + 1;
    if (unit.volleyCount < V.every) return;
    unit.volleyCount = 0;
    const quivers = unit.items.filter((i) => i === 'quiver_of_plenty').length;
    let n = V.arrows - 1 + quivers * (V.perQuiver || 0);
    const others = this.targetableEnemies().filter((e) => e !== target);
    if (!others.length) return;
    events.push({ type: 'proc', unit, label: 'Volley!', target });
    const from = target.alive ? target : others[0];
    others.sort((a, b) => (this.hasPositions(a) ? this.distance(a, from) - this.distance(b, from) : 0));
    for (const e of others) {
      if (n-- <= 0) break;
      const res = this.strike(unit, e, events, { multiplier: V.damageMultiplier, projectile: 'arrow', riders: true });
      this.rollProcs(unit, 'onAttack', events, { target: e, hit: !res.dodged, folded: true });
    }
  },

  // Quiver of Plenty (DOUBLE SHOT, user session 40): a RANGED basic attack of the holder has `extraArrow`% (25, +8 per
  // extra copy) to shoot one more arrow at the SAME enemy (full damage, on-hit items roll); past 100% the rest is the
  // chance for a third arrow (max 2 extra). Each extra arrow is fired as the shot lands (the next one
  // `extraArrowGapMs` later) and hits when it arrives (`rangedHitMs`). If the target is already dead (the shot killed
  // it) or dies before the arrow lands, the arrow goes to another enemy instead.
  extraArrows(unit, target, events) {
    const ch = (unit.specials && unit.specials.extraArrow) || 0;
    if (!ch || unit.minion || unit.side !== 'hero' || unit.damageType === 'melee') return;
    const n = Math.min(2, Math.floor(ch / 100) + (this.rng() * 100 < ch % 100 ? 1 : 0));
    const timing = this.rules.attackTiming || {};
    const fly = (timing.hero && timing.hero.rangedHitMs) || 0, gap = timing.extraArrowGapMs || 0;
    const aim = () => { // the same enemy while it lives, else a random other one
      if (target.alive && !this.untargetable(target)) return target;
      const others = this.targetableEnemies();
      return others.length ? others[Math.floor(this.rng() * others.length)] : null;
    };
    for (let i = 0; i < n; i++) {
      const shoot = (ev) => {
        if (!unit.alive) return;
        const to = aim();
        if (!to) return;
        ev.push({ type: 'proc', unit, label: 'Extra arrow!', itemId: 'quiver_of_plenty', target: to });
        ev.push({ type: 'projectile', from: unit, to, kind: 'arrow', ms: fly });
        const land = (ev2) => {
          if (!unit.alive) return;
          const at = to.alive && !this.untargetable(to) ? to : aim();
          if (!at) return;
          const res = this.strike(unit, at, ev2, { riders: true });
          this.rollProcs(unit, 'onAttack', ev2, { target: at, hit: !res.dodged, folded: true });
        };
        if (fly > 0) this.later(fly, land); else land(ev);
      };
      if (i * gap > 0) this.later(i * gap, shoot); else shoot(events);
    }
  },

  // Metronome: the holder counts its own basic attacks; every 4th (`metronomeEvery`) gets +`metronome`% damage
  // (+50% per copy). The count is kept for the whole run. Returns the bonus for this attack (0 = none).
  metronomeBeat(unit, target, events) {
    const bonus = (unit.specials && unit.specials.metronome) || 0;
    if (!bonus || unit.minion || unit.side !== 'hero') return 0;
    unit.metroCount = (unit.metroCount || 0) + 1;
    if (unit.metroCount < (unit.specials.metronomeEvery || 4)) return 0;
    unit.metroCount = 0;
    events.push({ type: 'proc', unit, label: 'Metronome!', itemId: 'metronome', target });
    return bonus;
  },

  // Bandage Roll (cure): every `bandageCureEveryMs` (6s) of a fight the most hurt living hero (lowest health %, hurt
  // or debuffed) loses `bandageCount` debuffs of any kind (1 per roll, all stacks of a kind, the biggest first) and
  // gets +`bandageArmor` defense (8 per roll) for `bandageArmorMs` (6s).
  tickBandages(hero, dt, events) {
    const armor = hero.specials.bandageArmor || 0;
    if (!armor || !this.enemies.some((e) => e.alive)) return;
    hero.bandageTimer = (hero.bandageTimer || 0) + dt;
    if (hero.bandageTimer < (hero.specials.bandageCureEveryMs || 6000)) return;
    hero.bandageTimer = 0;
    const debuffs = (u) => u.statuses.filter((st) => this.statusDefs[st.type] && this.statusDefs[st.type].debuff);
    const needy = this.heroes.filter((h) => h.alive && (h.hp < h.maxHp || debuffs(h).length));
    if (!needy.length) return;
    const ally = needy.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a));
    events.push({ type: 'proc', unit: hero, label: 'Bandage!', itemId: 'bandage_roll' });
    events.push({ type: 'flask', unit: hero, target: ally, flask: { color: '0xf2e6cc', look: 'bandage' } }); // drawn as a lobbed bandage roll (skillFx `bandage`)
    for (let i = 0; i < (hero.specials.bandageCount || 1); i++) {
      const kinds = debuffs(ally).map((st) => st.type);
      if (!kinds.length) break;
      const kind = kinds.sort((x, y) => kinds.filter((k) => k === y).length - kinds.filter((k) => k === x).length)[0]; // most stacks first
      for (const st of ally.statuses.filter((x) => x.type === kind)) events.push({ type: 'status', unit: ally, change: 'expire', status: st });
      ally.statuses = ally.statuses.filter((x) => x.type !== kind);
      delete ally.dotClocks[kind];
    }
    this.applyStatus(ally, { status: 'buff', durationMs: hero.specials.bandageArmorMs || 6000, mods: [{ stat: 'defense', flat: armor }] }, hero, `bandage_${hero.uid}`, events);
  },

  // Warding Charm: a shield of `wardPulse`% max health (8, does not grow with copies; Warding Charm's own shield bonus
  // makes it bigger) at the start of every fight and again every `wardPulseEveryMs` (10s) while enemies live; it refills.
  wardShield(hero, events) {
    if (!hero.specials.wardPulse) return;
    this.applyStatus(hero, { status: 'shield', percentMaxHp: hero.specials.wardPulse }, hero, 'warding', events);
  },
  tickWard(hero, dt, events) {
    if (!hero.specials.wardPulse || !this.enemies.some((e) => e.alive)) return;
    hero.wardTimer = (hero.wardTimer || 0) + dt;
    if (hero.wardTimer < (hero.specials.wardPulseEveryMs || 10000)) return;
    hero.wardTimer = 0;
    this.wardShield(hero, events);
  },

  // Item effects that react to a hit that connected (the attacker's items).
  //  - Shatter Hammer: the hit breaks a freeze.   - Hunter's Sigil: the first hit on each enemy Marks it.
  //  - Frozen Thunderbolt: electric hits add ice + Chill; at 3 Chill / frozen the enemy shatters into ice on it and its neighbours.
  afterItemHit(attacker, target, opts, events) {
    const sp = attacker.specials;
    if (!sp || attacker.side !== 'hero' || attacker.minion || !target.alive) return;
    if (sp.shatterHammer) {
      const freeze = target.statuses.find((st) => st.type === 'freeze');
      if (freeze) {
        target.statuses.splice(target.statuses.indexOf(freeze), 1);
        events.push({ type: 'status', unit: target, change: 'expire', status: freeze });
        events.push({ type: 'proc', unit: attacker, label: 'Shatter!', itemId: 'shatter_hammer', target });
      }
    }
    if (sp.hunterSigil && !attacker.sigilHits.has(target.uid) && target.side === 'enemy') {
      attacker.sigilHits.add(target.uid);
      const copies = Math.max(1, attacker.items.filter((id) => id === 'hunters_sigil').length);
      this.applyStatus(target, { status: 'mark', durationMs: 5000 + 2500 * (copies - 1), damageTakenPercent: sp.hunterSigil }, attacker, `sigil_${attacker.uid}`, events);
    }
    if (sp.frozenThunderbolt && (opts.damageType || attacker.damageType) === 'electric' && !opts.burst) {
      // Frozen Thunderbolt: every electric hit adds a small ICE hit and 1 Chill; at `thunderShatterAt` Chill (or Frozen)
      // the target shatters: an ice burst on it and its neighbours, the cold is used up.
      if (sp.thunderIce) this.strike(attacker, target, events, { multiplier: sp.thunderIce / 100, damageType: 'ice', item: true, burst: true });
      if (target.alive) this.applyStatus(target, { status: 'chill', durationMs: 5000 }, attacker, 'thunderbolt', events);
      const cold = target.statuses.filter((st) => st.type === 'chill' || st.type === 'freeze');
      if (target.alive && (cold.some((st) => st.type === 'freeze') || this.stacks(target, 'chill') >= (sp.thunderShatterAt || 3))) {
        events.push({ type: 'proc', unit: attacker, label: 'Thunderbolt!', itemId: 'frozen_thunderbolt', target });
        for (const e of [target, ...this.neighbours(target)]) if (e.alive) this.strike(attacker, e, events, { multiplier: sp.frozenThunderbolt / 100, damageType: 'ice', item: true, burst: true });
        for (const st of cold) {
          const i = target.statuses.indexOf(st);
          if (i < 0) continue; // already gone (Shatter Hammer broke the freeze)
          target.statuses.splice(i, 1);
          events.push({ type: 'status', unit: target, change: 'expire', status: st });
        }
      }
    }
  },

  // Extra damage % from the ATTACKER's item specials for this hit.
  //  - suckerPunch: ANY hit (attack, skill, item) on an enemy above `suckerPunchAbove`% health.
  //  - fullVigor: while the attacker is above 90% health.
  //  - brawlerMax: +`brawlerStep`% (3) per basic hit in a row (any enemy), up to the item's max; lost on stun/freeze/fear.
  itemDamageBonus(attacker, target, opts) {
    const sp = attacker.specials;
    this.bonusItems = []; // items that boosted this hit (the scene shows them: Sucker Punch, Executioner's Axe)
    if (!sp || attacker.side !== 'hero' || attacker.minion) return 0;
    let bonus = 0;
    if (sp.suckerPunch && target.side === 'enemy' && target.hp >= (target.maxHp * (sp.suckerPunchAbove ?? 90)) / 100) { bonus += sp.suckerPunch; this.bonusItems.push(['sucker_punch_glove', 'Sucker Punch!']); }
    if (opts.basic) {
      if (sp.brawlerMax) {
        const st = attacker.streak;
        // A COMBO of the holder's basic hits on ANY enemy; lost when the holder is stunned, frozen or feared (applyStatus).
        bonus += Math.min(sp.brawlerMax, st.count * (sp.brawlerStep || 2));
        attacker.streak = { uid: target.uid, count: st.count + 1 };
      }
    }
    if (sp.fullVigor && attacker.hp >= attacker.maxHp * 0.9) bonus += sp.fullVigor; // Full Vigor: above 90% health
    if (sp.lastStand && attacker.hp < (attacker.maxHp * (sp.lastStandBelow ?? 30)) / 100) bonus += sp.lastStand; // Last Stand: below 30% health
    // Bonuses against what the target is suffering from or how hurt it is.
    const kinds = new Set(target.statuses.filter((st) => this.statusDefs[st.type] && this.statusDefs[st.type].debuff).map((st) => st.type));
    if (sp.bloodChalice && kinds.has('bleed')) bonus += sp.bloodChalice; // Blood Chalice
    if (sp.shatterHammer && kinds.has('freeze')) bonus += sp.shatterHammer; // Shatter Hammer (the freeze is broken after the hit)
    else if (sp.shatterChill && kinds.has('chill')) bonus += sp.shatterChill; // ...and a smaller bonus vs chilled enemies
    if (sp.exploiter && kinds.size >= 3) bonus += sp.exploiter; // Exploiter's Lens
    if (sp.executioner && target.hp < (target.maxHp * (sp.executionerBelow ?? 25)) / 100) { bonus += sp.executioner; this.bonusItems.push(['executioners_axe', 'Execute!']); } // Executioner's Axe
    if (sp.hornDamage && this.has(target, 'taunt')) bonus += sp.hornDamage; // Provoker's Horn: taunted enemies take more
    if (sp.spotter && (this.focusUid === target.uid || this.heroes.some((h) => h.alive && h.order === target.uid))) bonus += sp.spotter; // Spotter's Lens: the TAPPED (or drag-ordered) enemy takes more from the squad
    if (sp.bossDamage && target.def.boss) bonus += sp.bossDamage; // (old boss-only items)
    if (sp.bigGame && (target.def.boss || target.elite)) bonus += sp.bigGame; // Giantslayer's Brand: BIG GAME, bosses and elites
    if (sp.eliteDamage && target.elite) bonus += sp.eliteDamage; // Hunter's Badge
    if (sp.fodderDamage && target.def.tier === 'fodder') bonus += sp.fodderDamage; // (old fodder-only Swarm Swatter)
    if (sp.normalDamage && !target.elite && !target.def.boss) bonus += sp.normalDamage; // Swarm Swatter: normal enemies (not elites, not bosses)
    if (sp.betterOdds) bonus += sp.betterOdds * this.enemies.filter((e) => e.alive && !e.def.object).length; // Better Odds: per enemy alive
    return bonus;
  },

  // Items with a chance effect (e.g. War Banner): each copy rolls separately every time the
  // trigger happens. ctx.target is the enemy that was just attacked. A proc can:
  //   doubleHit  - hit the same target once more (Quick Gloves)
  //   strike     - an extra hit { damageMultiplier, damageType, projectile } (Fire Bombs, Chill Band)
  //   chain      - a bolt that jumps to other enemies { jumps, damageMultiplier, damageType } (Static Crystal)
  //   apply      - give statuses to `targets`: self, squad or target (the hit enemy; only if the attack connected)
  //   silent     - no popup (for effects that go off on every attack)
  // The attacker's sure extra element hits (`mergeCopies` onAttack strikes, already merged per element by items.js):
  // [{ damageType, multiplier }], folded into the hit itself (computeDamage riders).
  riders(unit) {
    if (unit.side !== 'hero' || !unit.procs) return [];
    return unit.procs.filter((p) => p.proc === 'onAttack' && p.mergeCopies && p.strike).map((p) => ({ damageType: p.strike.damageType, multiplier: p.strike.damageMultiplier }));
  },

  rollProcs(hero, trigger, events, ctx = {}) {
    if (hero.side !== 'hero' || !hero.alive) return;
    for (const proc of [...hero.procs]) {
      const debuffs = (proc.apply || []).some((sp) => (sp.to === 'target' || (!sp.to && proc.targets === 'target')) && this.statusDefs[sp.status] && this.statusDefs[sp.status].debuff);
      const base = String(proc.itemId).startsWith('passive_') ? proc.chance : proc.chance * this.marchProcs(); // Bard's March: item procs likelier
      const chance = (debuffs ? this.debuffChance(hero, base) : base) * (ctx.chanceMult || 1); // Opportunist: his debuffs are likelier; Savage Leap: x chanceMult
      if (proc.meleeOnly && hero.damageType !== 'melee') continue; // Thousand Cuts: melee hits only
      if (proc.rangedOnly && hero.damageType === 'melee') continue; // Moonlight Twinblade: ranged attacks only
      if (ctx.skipItem && proc.itemId === ctx.skipItem) continue; // Thunderstruck's bolt never calls another bolt
      if (proc.thunderstruck && (this.thunders || []).some((t) => t.holder === hero)) continue; // one circle at a time
      if (proc.proc !== trigger || (!ctx.force && this.rng() * 100 >= chance)) continue; // ctx.force: every proc goes off
      const enemy = ctx.target && ctx.target.alive ? ctx.target : null;
      let landed = ctx.hit !== false; // statuses on the target need the attack to have connected
      // Damage from a proc (extra hit, bomb, bolt, tornado) is never wasted: if the attack just killed its
      // enemy it goes to the enemy nearest to it instead. Statuses on the target still need the hit enemy.
      const foe = enemy || (ctx.target ? this.nearest(ctx.target, this.targetableEnemies()) : null);
      const damages = !!(proc.doubleHit || proc.strike || proc.chain || proc.tornado || proc.flameSpirit || proc.moonlight || proc.thunderstruck);
      const targets = proc.targets === 'squad' ? this.squadUnits() : proc.targets === 'target' ? (enemy && landed ? [enemy] : []) : [hero];
      // A status spec can pick its own receivers with `to` (self / squad / target), e.g. a proc that taunts
      // the enemy hit AND gives the holder a defense buff.
      let ally; // Jolly Banner: the holder and ONE random other living hero (picked once per proc)
      const receivers = (to) => (to === 'selfAndAlly' ? (ally = ally || this.randomAlly(hero), ally ? [hero, ally] : [hero]) : to === 'squad' ? this.squadUnits() : to === 'target' ? (enemy && landed ? [enemy] : []) : to === 'self' ? [hero] : targets);
      // A proc that can't do anything (its enemy died or the attack missed) doesn't go off at all, so its
      // icon never pops for nothing.
      if (!(damages && foe) && !(proc.apply || []).some((spec) => receivers(spec.to).length)) continue;
      if (!proc.silent) events.push({ type: 'proc', unit: hero, label: proc.label, itemId: proc.itemId, target: foe || ctx.target || null });
      if (proc.doubleHit && foe) { const dh = this.strike(hero, foe, events); if (!dh.dodged) this.addCombo(hero, foe, 1, events); }
      if (debuffs && enemy && ctx.hit !== false && !String(proc.itemId).startsWith('passive_')) this.addCombo(hero, enemy, 1, events); // Rogue: a debuff item proc = a combo point
      if (proc.strike && foe && !(ctx.folded && proc.mergeCopies)) { // folded: already inside the hit (riders)
        if (proc.bomb) this.throwBomb(hero, foe, proc, events);
        else {
          const hit = this.strike(hero, foe, events, {
            multiplier: proc.strike.damageMultiplier,
            damageType: proc.strike.damageType,
            projectile: proc.strike.projectile,
            item: true, // damage made BY an item never triggers lifesteal, thorns or other item effects
          });
          landed = foe === enemy && !hit.dodged;
        }
      }
      const extra = (proc.copies || 1) - 1;
      // Static Crystal: +`jumpsPerExtra` jumps per extra crystal.
      if (proc.chain && foe) this.chainHit(hero, foe, proc.chain.jumpsPerExtra ? { ...proc.chain, jumps: proc.chain.jumps + proc.chain.jumpsPerExtra * extra } : proc.chain, events);
      // Excalibur: tornadoes hit `damagePerExtraPercent` harder per extra copy. A tornado also comes on a miss.
      if (proc.flameSpirit && foe) this.conjureSpirit(hero, events, proc.damageMultiplier || 0.8);
      if (proc.thunderstruck && foe) this.markThunder(hero, proc.thunderstruck.damagePerExtra ? { ...proc.thunderstruck, damageMultiplier: proc.thunderstruck.damageMultiplier + proc.thunderstruck.damagePerExtra * extra } : proc.thunderstruck, events); // +350% per extra copy
      if (proc.moonlight && foe) this.moonCrescent(hero, foe, proc.copies || 1, events, proc.hitMultiplier);
      if (proc.tornado && foe) this.spawnTornado(hero, proc.tornado.damagePerExtraPercent ? { ...proc.tornado, damageMultiplier: proc.tornado.damageMultiplier * (1 + (proc.tornado.damagePerExtraPercent * extra) / 100) } : proc.tornado, foe, events);
      for (const spec of proc.apply || []) {
        // scalesWithCopies: the status gets stronger with every copy of the item held; `damagePerExtraPercent`:
        // +that % per extra copy (Ember Charm's burn +10% per extra charm).
        let real = spec.scalesWithCopies ? { ...spec, damageMultiplier: spec.damageMultiplier * (proc.copies || 1) } : spec;
        if (spec.damagePerExtraPercent) real = { ...real, damageMultiplier: spec.damageMultiplier * (1 + (spec.damagePerExtraPercent * ((proc.copies || 1) - 1)) / 100) };
        if (spec.durationPerCopyMs) real = { ...real, durationMs: spec.durationMs + spec.durationPerCopyMs * ((proc.copies || 1) - 1) }; // Jolly Banner: longer with every extra copy
        for (const target of receivers(spec.to)) this.applyStatus(target, real, hero, `proc_${proc.itemId}`, events);
      }
    }
  },

  // A bomb (Fire / Ice / Electric / Dark / Poison Bombs: procs with `bomb: true`) hits `foe` for its strike, boosted
  // by Bombardier's Barrel (`bombDamage`%), and puts its `strike.apply` statuses on the enemy it hit.
  // Then the Barrel: `bombBarrel`% chance to throw `bombBarrelCount` [2, 4] more bombs at random enemies, one every
  // `bombBarrelStaggerMs` (0.15s), each a random pick from the holder's bomb items. Those bombs can set the Barrel
  // off again, but it has a `bombBarrelCooldownMs` (0.3s) cooldown, so it can't loop forever in one go.
  throwBomb(hero, foe, proc, events) {
    const sp = hero.specials || {};
    const hit = this.strike(hero, foe, events, { multiplier: proc.strike.damageMultiplier * (1 + (sp.bombDamage || 0) / 100), damageType: proc.strike.damageType, projectile: proc.strike.projectile, item: true });
    if (!hit.dodged && foe.alive) for (const spec of proc.strike.apply || []) this.applyStatus(foe, spec, hero, `proc_${proc.itemId}`, events);
    if (!sp.bombBarrel || hero.barrelCd > 0 || this.rng() * 100 >= sp.bombBarrel) return;
    hero.barrelCd = sp.bombBarrelCooldownMs ?? 300;
    const bombs = [...new Map(hero.procs.filter((p) => p.bomb).map((p) => [p.itemId, p])).values()];
    const [lo, hi] = sp.bombBarrelCount || [2, 4];
    const count = lo + Math.floor(this.rng() * (hi - lo + 1));
    events.push({ type: 'proc', unit: hero, label: 'Bombs away!', itemId: 'bombardiers_barrel' });
    const step = sp.bombBarrelStaggerMs ?? 150;
    for (let i = 0; i < count; i++) {
      const pick = bombs[Math.floor(this.rng() * bombs.length)];
      const go = (ev) => {
        const alive = this.targetableEnemies();
        if (hero.alive && alive.length) this.throwBomb(hero, alive[Math.floor(this.rng() * alive.length)], pick, ev);
      };
      if (step > 0) this.later(step * (i + 1), go);
      else go(events);
    }
  },

  // Excalibur: a tornado lives `durationMs`, hits its enemy every `tickMs` (item damage) and drifts to another
  // random living enemy every `hopEvery` ticks. At most `max` at once: a new one pushes the oldest out.
  spawnTornado(hero, spec, enemy, events) {
    const mine = this.tornados.filter((t) => t.holder === hero);
    if (this.tornados.length >= spec.max) {
      const old = this.tornados.shift();
      events.push({ type: 'tornadoEnd', tornado: old });
    }
    const t = { id: this.nextUid++, holder: hero, remaining: spec.durationMs, tick: spec.tickMs, ticks: 0, target: enemy, spec };
    this.tornados.push(t);
    events.push({ type: 'tornadoSpawn', tornado: t, target: enemy });
    return mine;
  },

  tickTornados(dt, events) {
    for (const t of [...this.tornados]) {
      t.remaining -= dt;
      t.tick -= dt;
      while (t.tick <= 0 && t.remaining > -t.spec.tickMs) {
        t.tick += t.spec.tickMs;
        if (!t.holder.alive || !t.target.alive || this.untargetable(t.target)) {
          const alive = this.targetableEnemies();
          if (!alive.length) break;
          t.target = alive[Math.floor(this.rng() * alive.length)];
          events.push({ type: 'tornadoMove', tornado: t, target: t.target });
        }
        this.strike(t.holder, t.target, events, { multiplier: t.spec.damageMultiplier, damageType: t.spec.damageType, item: true });
        t.ticks++;
        if (t.spec.hopEvery && t.ticks % t.spec.hopEvery === 0) {
          const others = this.targetableEnemies().filter((e) => e !== t.target);
          if (others.length) {
            t.target = others[Math.floor(this.rng() * others.length)];
            events.push({ type: 'tornadoMove', tornado: t, target: t.target });
          }
        }
        if (t.remaining <= 0) break;
      }
      if (t.remaining <= 0 || !this.enemies.some((e) => e.alive)) {
        this.tornados = this.tornados.filter((x) => x !== t);
        events.push({ type: 'tornadoEnd', tornado: t });
      }
    }
  },

  // One random living hero other than `hero` (undefined if he is alone).
  randomAlly(hero) {
    const others = this.heroes.filter((h) => h.alive && h !== hero);
    return others[Math.floor(this.rng() * others.length)];
  },

  // Slot neighbours of an enemy: the living enemies standing right next to it.
  neighbours(enemy) {
    const i = this.enemies.indexOf(enemy);
    return [this.enemies[i - 1], this.enemies[i + 1]].filter((e) => e && e.alive);
  },

  // A bolt hits `first`, then jumps `jumps` more times to the closest enemies not hit yet.
  // `skipFirst`: `first` was already hit (a Wisp's own bolt), only the jumps deal damage.
  chainHit(hero, first, chain, events) {
    const hit = new Set([first]);
    let from = hero;
    let target = first;
    for (let jump = 0; target; jump++) {
      if (jump === 0 && chain.skipFirst) {
        if (chain.jumps < 1) break;
        from = target;
        const here0 = this.enemies.indexOf(from);
        target = this.enemies.filter((e) => e.alive && !hit.has(e)).sort((a, b) => Math.abs(this.enemies.indexOf(a) - here0) - Math.abs(this.enemies.indexOf(b) - here0))[0];
        if (target) hit.add(target);
        continue;
      }
      const res = this.strike(hero, target, events, { multiplier: chain.damageMultiplier, damageType: chain.damageType, projectile: 'lightning', from, item: true });
      if (!res.dodged && target.alive) for (const spec of chain.apply || []) this.applyStatus(target, spec, hero, 'chain', events); // Static Crystal: Shock on every enemy hit
      if (jump >= chain.jumps) break;
      from = target;
      const here = this.enemies.indexOf(from);
      const next = this.enemies.filter((e) => e.alive && !hit.has(e)).sort((a, b) => Math.abs(this.enemies.indexOf(a) - here) - Math.abs(this.enemies.indexOf(b) - here))[0];
      if (next) hit.add(next);
      target = next;
    }
  },
};
