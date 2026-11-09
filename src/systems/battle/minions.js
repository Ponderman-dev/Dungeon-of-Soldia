// Part of BattleState (mixed into its prototype at the bottom of ../BattleState.js; `this` is the BattleState).
// Minions: sources, spawning, upkeep, souls, floor start / end (docs/systems/minions.md).

export const minionsMethods = {
  // ---- minions (minions.json) ------------------------------------------------------------------
  // Minions are extra fighters on the hero side, made by a SOURCE:
  //  - the hero's own passive: def.spawner (Necromancer's Skeleton Summoner), weak, costs no upkeep;
  //  - minion ITEMS the hero holds (items.js `minionSources`): effect `minionSpawner` (weak) or
  //    `greaterMinion` (greater). Each copy of a weak spawner item is its own source (own timer and cap);
  //    copies of a greater item only make the ONE minion stronger (copyStatBonus per extra copy).
  // A weak source is { minion, minMs, maxMs, cap, atFloorStart }: a minion every minMs..maxMs while a
  // fight runs and atFloorStart of them when a fight begins; over the cap the OLDEST goes. Weak minions
  // vanish when the floor ends or when their holder dies.
  // A GREATER minion (kind 'greater') is summoned at the start of a fight if there is none, keeps its
  // health between floors (nothing heals it after a win, only healing/buffs), stays with the squad, and
  // when it dies it can only come back after `minions.revivalFloors` (2) floors have been cleared, at the
  // start of the next floor. Minions are never in `this.heroes`: no XP, perks or morale, they don't count
  // as living heroes. Enemies can attack them (and taunt-pull).
  // UPKEEP: for every minion ITEM of a hero that has a live minion, the holder loses attack speed and
  // defense (combat.json `minions`), see refreshStats().

  // The hero's minion sources, from its own passive and its minion items. Kept in hero.minionSources.
  buildSources(hero, itemSources = []) {
    const list = [];
    // The hero's own passive (Necromancer): weak, its own cap, no upkeep.
    if (hero.def.spawner) list.push({ key: 'hero', kind: 'weak', capGroup: 'hero', spec: hero.def.spawner, upkeep: false });
    const byItem = {};
    for (const src of itemSources) {
      const g = (byItem[src.itemId] = byItem[src.itemId] || { key: src.itemId, kind: src.kind, minion: src.minion, spec: src.spec, onHit: !!src.onHit, copies: 0, upkeep: !(src.spec && src.spec.upkeep === false) }); // Rat Cage: `upkeep: false`
      g.copies++;
    }
    // One source per item: a weak spawner has ONE shared timer and spawns `burst` (= copies) minions each time, all
    // weak item minions of a holder share one cap; a greater minion is ONE minion however many copies.
    for (const g of Object.values(byItem)) {
      if (g.kind === 'weak') list.push({ ...g, capGroup: 'items', burst: g.copies, upkeepScale: this.rules.minions.upkeepWeakScale ?? 0.5 });
      else list.push({ ...g, upkeepScale: 1 });
    }
    return list;
  },

  // Squad-wide minion boosters (Bone Charm, Overseer's Whistle, Grave Dust, Necro Crown): they reach EVERY minion
  // whoever holds them, and cost no upkeep. Whistle: +1 weak minion per copy (the 6 per hero limit still holds).
  minionBoost() {
    const sum = { bone: 0, whistle: 0, speed: 0, whistleHp: 0, dust: 0, crown: 0, crownKill: false };
    for (const h of this.heroes) {
      if (!h.alive) continue;
      const sp = h.specials;
      const x = (h.def.passive && h.def.passive.legion && h.def.passive.legion.minionItemMultiplier) || 1; // Legion: minion items count double for him
      sum.bone += (sp.boneCharm || 0) * x;
      sum.whistle += (sp.whistleCap || 0) * x;
      sum.speed += (sp.whistleSpeed || 0) * x;
      sum.whistleHp += (sp.whistleHealth || 0) * x;
      sum.dust += (sp.graveDust || 0) * x;
      sum.crown += (sp.necroCrownCap || 0) * x;
      sum.crownKill = sum.crownKill || !!sp.necroCrownKill;
      sum.spawnSpeed = Math.max(sum.spawnSpeed || 0, sp.necroCrownSpeed || 0); // does not grow with copies
    }
    return { bone: sum.bone, weakCap: sum.whistle + Math.min(6, sum.crown), weakSpeed: sum.speed, weakHealth: sum.whistleHp, dust: sum.dust, crownKill: sum.crownKill, spawnSpeed: sum.spawnSpeed || 0 };
  },

  sourceState(hero, key) {
    hero.sourceState = hero.sourceState || {};
    return (hero.sourceState[key] = hero.sourceState[key] || { timer: 0, wait: 0 });
  },

  // The fight of a new floor begins: floor-start minions rise, greater minions that are due come back,
  // spawn timers start over.
  startFloor(events = []) {
    this.hasStarted = true;
    this.floorMs = 0; // time into this floor (Assault Breastplate waits a moment)
    // Rest fountain blessing (rooms.json fountain): a regen buff on every living hero for the next few FIGHTS.
    const bless = this.blessing && this.blessing.fights > 0 ? this.blessing : null;
    if (bless) bless.fights--;
    for (const hero of this.heroes) {
      if (!hero.alive) continue;
      if (bless) this.applyStatus(hero, { status: 'regenBoost', durationMs: 1e9, percentMaxHpPerSec: bless.regenPercentPerSec }, hero, 'fountain', events);
      hero.sinceHit = 0; // Steady Aim starts counting again with every fight
      hero.wardTimer = 0;
      this.wardShield(hero, events); // Warding Charm
      // Fire Heart: a fire shield at the start of every floor (20% max health per copy) that slowly regenerates and burns attackers.
      if (hero.specials.fireHeart) {
        const amount = (hero.maxHp * hero.specials.fireHeart) / 100 * (1 + (hero.specials.shieldBonus || 0) / 100);
        hero.statuses = hero.statuses.filter((st) => st.key !== 'shield:fireheart');
        const nova = hero.specials.fireHeartNova ? { damageMultiplier: hero.specials.fireHeartNova / 100, damageType: 'fire' } : null; // breaks = fire nova
        hero.statuses.push({ key: 'shield:fireheart', type: 'shield', amount, maxAmount: amount, remaining: Infinity, total: Infinity, sourceUid: hero.uid, onBreak: nova, regenPerSec: amount * 0.05, burns: true });
        events.push({ type: 'status', unit: hero, change: 'apply', status: hero.statuses[hero.statuses.length - 1] });
      }
      for (const src of hero.minionSources || []) {
        const st = this.sourceState(hero, src.key);
        if (src.kind === 'weak' && !src.onHit) {
          st.timer = this.spawnDelay(src.spec, src.copies);
          // Weak minions are there from the START of every fight (user's choice), then more come on the timer.
          for (let i = 0; i < (src.spec.atFloorStart ?? 1) * (src.burst || 1); i++) this.spawnMinion(hero, src, events);
        } else if (src.kind === 'greater' && st.wait <= 0 && !this.minions.some((m) => m.holderUid === hero.uid && m.sourceKey === src.key)) {
          this.spawnMinion(hero, src, events);
        }
      }
    }
    return events;
  },

  // The floor is won: weak minions vanish; greater ones stay, and a dead one is one floor closer to coming back.
  endFloor(events = []) {
    // Excalibur tornadoes die out with the floor (they must not follow the squad to the next one).
    for (const t of this.tornados) events.push({ type: 'tornadoEnd', tornado: t });
    this.tornados = [];
    this.bookTimers = []; // Aftershock pulses do not follow the squad to the next floor
    this.delays = []; // nor do fireballs / crescents still on their way
    for (const b of this.bombs || []) events.push({ type: 'bombFizzle', bomb: b }); // a Sapper bomb still lit when the floor is won goes out
    this.bombs = [];
    this.thunders = []; // a Thunderstruck circle still growing when the floor is won just goes away
    this.spirits = [];
    for (const m of [...this.minions]) {
      if (!m.greater) this.vanishMinion(m, 'floorEnd', events);
      else { m.floors++; m.floorRevived = false; } // a greater minion that survived the floor (Spirit Knight grows; Phoenix can revive again)
    }
    for (const hero of this.heroes) {
      for (const src of hero.minionSources || []) {
        const st = this.sourceState(hero, src.key);
        if (src.kind === 'greater' && st.wait > 0) st.wait--;
      }
    }
    return events;
  },

  // `fasterPerCopy` (Rat Cage): each extra copy of the item makes the next minion come that many % sooner.
  spawnDelay(sp, copies = 1) {
    const ms = sp.minMs + this.rng() * ((sp.maxMs ?? sp.minMs) - sp.minMs);
    return ms / (1 + ((sp.fasterPerCopy || 0) * (copies - 1)) / 100) / (1 + this.minionBoost().spawnSpeed / 100); // Necro Crown: +50%
  },

  // The shared cap of a hero's weak ITEM minions: combat.json itemWeakCap, plus `capPerCopy` for every extra copy
  // of a spawner item that has it (Rat Cage: +1 rat per extra cage).
  itemWeakCap(holder) {
    let cap = this.rules.minions.itemWeakCap;
    for (const src of holder.minionSources || []) if (src.kind === 'weak' && src.spec && src.spec.capPerCopy) cap += src.spec.capPerCopy * ((src.copies || 1) - 1);
    return cap;
  },

  tickSpawner(hero, dt, events) {
    if (!this.enemies.some((e) => e.alive)) return; // only while there is a fight
    for (const src of hero.minionSources || []) {
      if (src.kind !== 'weak' || src.onHit) continue;
      const st = this.sourceState(hero, src.key);
      st.timer -= dt;
      if (st.timer > 0) continue;
      st.timer += this.spawnDelay(src.spec, src.copies);
      for (let i = 0; i < (src.burst || 1); i++) this.spawnMinion(hero, src, events); // one more minion per copy of the item
    }
  },

  // A minion rises next to its holder. Weak, over the cap: the oldest one from the same source is pushed out.
  spawnMinion(holder, src, events) {
    const id = src.kind === 'weak' ? src.spec.minion : src.minion;
    const def = this.minionDefs[id];
    if (!def) return null;
    if (src.kind === 'weak') {
      // Over the cap: the oldest weak minion of the same cap group (the hero's own, or all item minions) goes.
      // Necro Crown skeletons have their own cap (`necroCrownSkeletons`, 4 +2 per extra crown) and never count for the others.
      const mine = this.minions.filter((m) => m.holderUid === holder.uid && m.capGroup === src.capGroup);
      const cap = src.capGroup === 'crown' ? holder.specials.necroCrownSkeletons || 4 : (src.capGroup === 'hero' ? src.spec.cap || 4 : this.itemWeakCap(holder)) + this.minionBoost().weakCap;
      if (mine.length >= cap) this.vanishMinion(mine[0], 'pushedOut', events);
      // At most `minions.maxPerHero` (6) minions per hero (crown skeletons not counted): the oldest WEAK one goes.
      const all = this.minions.filter((m) => m.holderUid === holder.uid && m.capGroup !== 'crown');
      const max = this.rules.minions.maxPerHero || Infinity;
      if (src.capGroup !== 'crown' && all.length >= max) { const old = all.find((m) => !m.greater); if (old) this.vanishMinion(old, 'pushedOut', events); }
    }
    const m = this.makeUnit({ id, ...def, stats: { ...def.stats } }, 'hero', 1);
    m.minion = true;
    if (def.hitType) m.hitType = def.hitType; // Ice Spirit Knight: moves as melee, its hits are ice
    m.greater = src.kind === 'greater';
    m.holderUid = holder.uid;
    m.sourceKey = src.key;
    m.capGroup = src.capGroup;
    m.upkeep = src.upkeep;
    m.upkeepScale = src.upkeepScale ?? 1; // an item costs its upkeep ONCE, however many copies (user's choice)
    m.rawStats = { ...def.stats }; // the stats before copies, boosters and growth (refreshMinionStats scales them)
    m.copies = src.copies || (src.key === 'mimic_chest' ? holder.specials.mimicCopies || 1 : 1);
    if (src.spec && src.spec.copyStatBonus !== undefined) m.copyBonus = src.spec.copyStatBonus; // per item: Rat 0, Wisp 0.2, Imp 0.15
    // Wisp Lantern: each extra copy lets the wisps' bolts jump to one more enemy (`chainPerCopy`).
    const cpc = src.spec && src.spec.chainPerCopy;
    if (cpc && m.copies > 1) m.chain = { jumps: cpc.jumps * (m.copies - 1), damageMultiplier: cpc.damageMultiplier, damageType: def.damageType, skipFirst: true };
    m.floors = 0;
    m.timer = 0;
    if (this.hasPositions(holder) && def.object) {
      // Shield Totem: stands still in the FRONT line, just in front of the heroes, in the centre.
      const L = this.rules.movement.layout;
      this.place(m, L.width / 2, L.heroY - (this.rules.minions.totemAheadPx || 50));
    } else if (this.hasPositions(holder)) {
      const M = this.rules.movement;
      this.place(m, holder.x + (this.rng() - 0.5) * 80, holder.y - 36 - this.rng() * 20);
      m.x = Math.min(M.layout.width - M.layout.marginX, Math.max(M.layout.marginX, m.x));
    }
    this.minions.push(m);
    this.refreshStats(); // scaling, squad buffs and the holder's upkeep
    m.hp = m.maxHp; // a new minion always starts at full health
    events.push({ type: 'minionSpawn', unit: m, holder });
    return m;
  },

  vanishMinion(m, reason, events) {
    if (!this.minions.includes(m)) return;
    m.alive = false;
    m.pending = null;
    m.casting = null;
    for (const u of this.allUnits()) if (u.foe === m.uid) u.foe = null;
    this.minions = this.minions.filter((x) => x !== m);
    this.retargetAttacksOn(m, events);
    this.refreshStats(); // its holder stops paying upkeep for it
    events.push({ type: 'minionVanish', unit: m, reason });
  },

  // All minions made by `holder` leave (the holder died).
  removeMinionsOf(holder, reason, events) {
    for (const m of this.minions.filter((x) => x.holderUid === holder.uid)) this.vanishMinion(m, reason, events);
  },

  // A minion was killed: a greater one starts its revival wait.
  minionDied(m, events = []) {
    this.minions = this.minions.filter((x) => x !== m);
    this.gainSoul(events); // Necromancer's Legion
    this.explodeMinion(m, events); // Mimic, Grave Dust
    const holder = this.heroes.find((h) => h.uid === m.holderUid);
    if (m.greater && holder) this.sourceState(holder, m.sourceKey).wait = this.rules.minions.revivalFloors;
    this.refreshStats();
  },

  // Necromancer's LEGION (passive.legion): every minion that dies gives each living Necromancer a Soul (up to
  // `maxSouls`); his skill with `soulBonusPercent` (Death Coil) spends them all for extra damage.
  gainSoul(events) {
    for (const h of this.heroes) {
      const L = h.alive && h.def.passive && h.def.passive.legion;
      if (!L || (h.souls || 0) >= L.maxSouls) continue;
      h.souls = (h.souls || 0) + 1;
      events.push({ type: 'soul', unit: h, souls: h.souls });
    }
  },

  // BONE SACRIFICE (skill `boneSacrifice: { minion, basePercent, perMinionPercent, durationMs }`): all his skeletons
  // die (Grave Dust makes them explode, each death is a Soul) and every living hero gets a shield of basePercent +
  // perMinionPercent per skeleton of their max health.
  boneSacrifice(hero, skill, slotId, events) {
    const B = skill.boneSacrifice;
    const bones = this.minions.filter((m) => m.alive && m.holderUid === hero.uid && m.def.id === B.minion);
    for (const m of bones) {
      // no per-skeleton pop-up: they stand close and the words piled up (the skill name already shows)
      m.hp = 0;
      this.killUnit(m, events);
    }
    const pct = B.basePercent + B.perMinionPercent * bones.length;
    for (const h of this.heroes.filter((x) => x.alive)) this.applyStatus(h, { status: 'shield', percentMaxHp: pct, durationMs: B.durationMs }, hero, slotId, events);
  },

  // The upkeep a hero pays: every minion ITEM of his that has a live minion costs its full upkeep (greater minion)
  // or half (weak spawner items, `minions.upkeepWeakScale`). Returns the total in "full upkeeps".
  upkeepCount(hero) {
    const seen = new Map();
    for (const m of this.minions) if (m.holderUid === hero.uid && m.upkeep) seen.set(m.sourceKey, m.upkeepScale);
    let total = 0;
    for (const v of seen.values()) total += v;
    return total;
  },

  // A dying weak minion explodes when it has an explosion of its own (Mimic) and/or Grave Dust is out there: damage
  // to the enemies near it (item damage, nothing else triggers).
  explodeMinion(m, events) {
    const own = m.def.explode ? m.def.explode.damageMultiplier * (1 + 0.25 * ((m.copies || 1) - 1)) : 0; // Mimic: +25% per extra chest
    const dust = m.greater ? 0 : this.minionBoost().dust / 100; // Grave Dust: `graveDust`% attack per copy (400), weak minions only
    const total = own + dust;
    if (total <= 0) return;
    const radius = (m.def.explode && m.def.explode.radius) || 120;
    events.push({ type: 'minionExplode', unit: m, radius });
    for (const e of this.enemies.filter((x) => x.alive)) {
      if (this.hasPositions(m) && this.hasPositions(e) && Math.hypot(e.x - m.x, e.y - m.y) > radius * 1.6) continue;
      this.strike(m, e, events, { multiplier: total, damageType: 'fire', item: true });
      if (dust > 0 && e.alive) this.applyStatus(e, { status: 'poison', durationMs: 5000, damageMultiplier: 0.3 }, m, 'graveDust', events); // Grave Dust also poisons
    }
  },

  // A minion's stats: its minions.json stats scaled by copies of its item (copyStatBonus per extra copy), growth per
  // survived floor (Spirit Knight) and the squad's Bone Charms (health and attack); weak minions also attack faster with
  // Overseer's Whistles; plus any buff the squad gave it. Its health keeps the same % when the scale changes.
  refreshMinionStats(m) {
    const raw = m.rawStats || m.baseStats;
    const boost = this.minionBoost();
    const bonus = m.copyBonus ?? m.def.copyStatBonus ?? this.rules.minions.copyStatBonus ?? 0;
    const growth = m.def.growthPerFloor ? 1 + Math.min(m.def.growthMax ?? 1, m.def.growthPerFloor * (m.floors || 0)) : 1;
    const holder = this.heroes.find((h) => h.uid === m.holderUid);
    const legion = holder && holder.def.passive && holder.def.passive.legion;
    const lvl = legion && m.def.id === legion.minion ? 1 + ((legion.perLevelPercent || 0) * ((holder.level || 1) - 1)) / 100 : 1; // Legion: his skeletons level up with him
    const scale = (1 + bonus * ((m.copies || 1) - 1)) * growth * (1 + boost.bone / 100) * lvl;
    const ratio = m.maxHp > 0 ? m.hp / m.maxHp : 1;
    const hpScale = m.greater ? 1 : 1 + (boost.weakHealth || 0) / 100; // Overseer's Whistle: weak minions are tougher
    m.maxHp = Math.max(1, Math.round(raw.health * scale * hpScale));
    m.hp = Math.min(m.maxHp, Math.round(m.maxHp * ratio));
    m.baseStats = { ...raw, health: m.maxHp, attack: Math.round(raw.attack * scale) };
    if (!m.greater) m.baseStats.attackEfficiency = raw.attackEfficiency * (1 + boost.weakSpeed / 100);
    const stats = { ...m.baseStats };
    for (const st of m.statuses) {
      if (st.type !== 'buff') continue;
      for (const mod of st.mods) {
        if (!mod.stat) continue; // specials (e.g. Blood Pact's lifesteal) are for heroes only
        if (mod.percent !== undefined) stats[mod.stat] += ((m.baseStats[mod.stat] || 0) * mod.percent) / 100;
        else stats[mod.stat] = (stats[mod.stat] || 0) + mod.flat;
      }
    }
    for (const key of ['defense', 'resist', 'evasion', 'crit']) stats[key] = Math.max(0, stats[key] || 0);
    stats.attack = Math.max(1, stats.attack);
    stats.attackEfficiency = Math.max(10, stats.attackEfficiency);
    stats.health = m.maxHp; // buffs never change a minion's health
    m.stats = stats;
    // Element COLLARS (session 31): the holder's newest collar turns all its minions' hits into that element; each
    // extra copy of that collar +`collar`% (25) minion damage of it.
    const collar = holder && holder.specials && holder.specials.collarElement;
    m.hitType = collar || m.def.hitType || undefined;
    // Every minion gets `holderElementShare` (minions.json, default combat.json minions.holderBonusShare 0.5) of its
    // hero's +% for its own damage type (Imp fire, Rats/Gargoyle melee...).
    const share = m.def.holderElementShare ?? this.rules.minions.holderBonusShare ?? 0;
    const type = m.hitType || m.def.damageType;
    m.damageBonus = share && holder && holder.damageBonus && holder.damageBonus[type] ? { [type]: holder.damageBonus[type] * share } : {};
    if (collar) {
      const copies = holder.items.filter((id) => (this.itemDefs[id].effects || []).some((e) => e.special === 'collar' && e.element === collar)).length;
      m.damageBonus[collar] = (m.damageBonus[collar] || 0) + (holder.specials.collar || 0) * Math.max(0, copies - 1);
    }
  },
};
