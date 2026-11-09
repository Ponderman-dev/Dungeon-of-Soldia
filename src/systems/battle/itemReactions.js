// Part of BattleState (mixed into its prototype at the bottom of ../BattleState.js; `this` is the BattleState).
// Item effects that react to being hit, to damage, to kills and to heals: saves, shields, stored damage (docs/systems/items.md).
import { elementMix } from '../items.js';

export const itemReactionsMethods = {
  // Spiked Aegis (`shieldThorns`, 40% per copy): a MELEE hit on the holder while a shield is up (it soaked some of this
  // hit, or one is still left) sends that % of the WHOLE hit back at the attacker, even when the shield took all of it.
  aegisSpikes(attacker, target, result, events) {
    const pct = target.side === 'hero' && target.specials ? target.specials.shieldThorns || 0 : 0;
    if (!pct || attacker.damageType !== 'melee' || !attacker.alive || !(result.absorbed > 0 || this.shieldAmount(target) > 0)) return;
    const back = Math.max(1, Math.round((result.amount * pct) / 100));
    const d = this.dealDamage(attacker, back, events);
    if (!d.immune) events.push({ type: 'thorns', unit: attacker, amount: back - d.absorbed, holder: target });
    this.addGrudge(target, events);
    this.breakEffects(attacker, d.broken, events);
    if (attacker.hp <= 0 && attacker.alive) this.killUnit(attacker, events);
  },

  // Knight's GRUDGE (passive.grudge): every hit he reflects (thorns, Spite Mail, Mirror Buckler) charges his next
  // Shield Bash by `perReflectPercent`, up to `maxStacks`; the Bash uses the charge up (skillHit, `grudgeCharged`).
  addGrudge(holder, events) {
    const g = holder.def && holder.def.passive && holder.def.passive.grudge;
    if (!g || !holder.alive) return;
    const was = holder.grudge || 0;
    holder.grudge = Math.min(g.maxStacks, was + 1);
    if (holder.grudge !== was) events.push({ type: 'grudge', unit: holder, stacks: holder.grudge });
  },

  // Soul Lantern: every `lanternEvery` (7) enemies the squad defeats (counted from pick-up), each holder gains +1% max
  // health, attack and attack speed and +1 FLAT defense per lantern for the rest of the run, with NO limit
  // (`hero.lanternGain`, used in statUpkeep()).
  // Every kill feeds the lantern (`soulFeed` event: green lines swirl round the holder); every 7th pops its icon.
  soulLanternKill(events = []) {
    let changed = false;
    for (const h of this.heroes) {
      const n = h.alive && h.specials ? h.specials.soulLantern || 0 : 0;
      if (!n) continue;
      h.lanternKills = (h.lanternKills || 0) + 1;
      events.push({ type: 'soulFeed', unit: h });
      if (h.lanternKills % ((this.rules.soulLantern && this.rules.soulLantern.every) || 7) !== 0) continue;
      events.push({ type: 'proc', unit: h, label: 'Soul Lantern!', itemId: 'soul_lantern' });
      const before = h.lanternGain || 0;
      h.lanternGain = before + n; // no limit (user's choice: legendary, offered at most once per run)
      if (h.lanternGain !== before) changed = true;
    }
    if (changed) this.refreshStats();
  },

  // Scholar's Bookmark: +`bookmark`% skill damage (4 per copy) for every page on the holder's skills, modifiers count double.
  bookmarkBonus(hero) {
    const per = (hero.specials && hero.specials.bookmark) || 0;
    if (!per) return 0;
    let pages = 0;
    for (const slot of hero.skills || []) for (const p of slot.pages || []) pages += p.kind === 'modifier' ? 2 : 1;
    return per * pages;
  },

  // Death save (combat.json deathSave), once per run per hero: the first hit that would kill only does
  // `damagePercent`% of its damage. If that still kills, the hero dies anyway. Event `deathSave` { unit, survived }.
  deathSave(target, amount, events) {
    const rule = this.rules.deathSave;
    if (!rule || target.side !== 'hero' || target.minion || !target.alive || target.deathSaveUsed) return amount;
    target.deathSaveUsed = true;
    const cut = Math.round((amount * rule.damagePercent) / 100);
    events.push({ type: 'deathSave', unit: target, survived: cut < target.hp });
    return cut;
  },

  // Phoenix Feather (used up): when the holder would die it stays at 1 health, is invulnerable for 3s and heals back up
  // to 100% of max health over 3s (a regen boost); every OTHER living hero heals 30% of max health at once.
  // Every feather is one more save.
  phoenixSave(target, events) {
    const sp = target.specials;
    if (target.side !== 'hero' || target.minion || !target.alive || !sp || !sp.phoenixFeather) return;
    const id = this.consumeItem(target, 'phoenixFeather');
    if (!id) return;
    target.hp = 1;
    events.push({ type: 'proc', unit: target, label: 'Phoenix!', itemId: 'phoenix_feather' });
    events.push({ type: 'itemUsed', unit: target, itemId: id });
    // 3s untouchable while it climbs back to 100% of max health over 3s.
    const P = this.rules.phoenixFeather || { invulnerableMs: 3000, healToPercent: 100, healMs: 3000, squadHealPercent: 30 };
    this.applyStatus(target, { status: 'invulnerable', durationMs: P.invulnerableMs }, target, 'phoenix_feather', events);
    this.applyStatus(target, { status: 'regenBoost', durationMs: P.healMs, percentMaxHpPerSec: (P.healToPercent - 100 / target.maxHp) / (P.healMs / 1000) }, target, 'phoenix_feather', events);
    for (const h of this.heroes) if (h !== target && h.alive) this.healUnit(h, (h.maxHp * P.squadHealPercent) / 100, events, { aura: false });
  },

  // Mirror Buckler: `mirrorBuckler`% chance (12 per copy, stops at 60%) that a ranged/magic hit bounces back; every copy
  // past 5 makes the bounced hit 25% stronger. Returns true when it bounced (the hit is then reported as blocked).
  mirrorBounce(attacker, target, result, opts, events) {
    const sp = target.specials;
    const type = opts.damageType || attacker.damageType;
    if (!sp || !sp.mirrorBuckler || type === 'melee') return false;
    const copies = sp.mirrorBuckler / 12;
    if (this.rng() * 100 >= Math.min(60, sp.mirrorBuckler)) return false;
    const back = Math.max(1, Math.round(result.amount * (1 + 0.25 * Math.max(0, copies - 5))));
    result.dodged = true; result.blocked = true; result.reflected = true; result.amount = 0;
    events.push({ type: 'proc', unit: target, label: 'Mirror!', itemId: 'mirror_buckler', target: attacker });
    events.push({ type: 'attack', attacker, target, result, damageType: type });
    const d = this.dealDamage(attacker, back, events);
    if (!d.immune) events.push({ type: 'thorns', unit: attacker, amount: back - d.absorbed, holder: target });
    this.addGrudge(target, events);
    this.breakEffects(attacker, d.broken, events);
    if (attacker.hp <= 0 && attacker.alive) this.killUnit(attacker, events);
    return true;
  },

  // Things that react to a unit having lost health (called from dealDamage when it has an events list).
  // Aid Kit (TRIAGE): when any living hero drops below `triageBelow`% (30) health, a living holder whose kit is ready
  // patches them at once for `triage`% of THEIR max health (8, +4 per extra kit), then waits `triageCooldownMs` (10s).
  tryTriage(target, events) {
    if (target.hp <= 0) return;
    for (const h of this.heroes) {
      const sp = h.specials;
      if (!h.alive || !sp || !sp.triage || (h.triageCd || 0) > 0) continue;
      if (target.hp >= (target.maxHp * (sp.triageBelow || 30)) / 100) return;
      h.triageCd = sp.triageCooldownMs || 10000;
      events.push({ type: 'proc', unit: h, label: 'Triage!', itemId: 'aid_kit', target });
      if (h !== target) events.push({ type: 'flask', unit: h, target, flask: { color: '0xff6b6b', look: 'kit' } }); // a white first-aid kit lobbed over (skillFx `kit`)
      this.healUnit(target, (target.maxHp * sp.triage) / 100, events, { aura: false });
      return;
    }
  },

  // Uses up one copy of an item that has the special `name` (a consumable). Returns its id, or null.
  consumeItem(hero, name) {
    const i = hero.items.findIndex((id) => (this.itemDefs[id].effects || []).some((e) => e.special === name));
    if (i < 0) return null;
    const [id] = hero.items.splice(i, 1);
    this.refreshStats();
    return id;
  },

  // Item reactions to a kill (killer = the unit that dealt the last blow, if known).
  // Cautious Banner (was Rally Flag, session 32): when a hero drops below `rallyFlagBelow`% (30) health, ONE holder whose
  // banner is unused this floor gives ONLY THAT hero a shield of `rallyFlag`% (25, +12 per extra) of its max health.
  // Each hero can set it off once per floor (2 banners = 2 heroes dropping low).
  tryRally(target, events) {
    if (target.floor.rallied) return;
    const holder = this.heroes.find((h) => h.alive && h.specials.rallyFlag && !h.floor.rallyUsed && target.hp < (target.maxHp * (h.specials.rallyFlagBelow ?? 30)) / 100);
    if (!holder) return;
    holder.floor.rallyUsed = true;
    target.floor.rallied = true;
    events.push({ type: 'proc', unit: holder, label: 'Rally!', itemId: 'rally_flag', target });
    this.applyStatus(target, { status: 'shield', percentMaxHp: holder.specials.rallyFlag }, holder, 'rally', events);
  },

  // Skins: a MELEE hit on the holder. Frost Mantle (FROST SKIN, session 31): `frostMantle`% (100 = every attacker) to
  // give the attacker 1 Chill. Ember Charm (BURNING SKIN): the attacker is Burned (`burningSkinSpec`, 3s) for
  // `burningSkin`% of the holder's attack per tick (20, +4 per extra copy). A sure effect pops no icon (every hit).
  frostMantle(attacker, target, events) {
    const sp = target.specials;
    if (!sp || target.minion || attacker.damageType !== 'melee' || !attacker.alive || attacker.hp <= 0) return;
    if (sp.burningSkin) this.applyStatus(attacker, { ...(sp.burningSkinSpec || { status: 'burn', durationMs: 3000, damageType: 'fire' }), damageMultiplier: sp.burningSkin / 100 }, target, `skin_${target.uid}`, events);
    if (!sp.frostMantle || !attacker.alive) return;
    if (sp.frostMantle < 100 && this.rng() * 100 >= this.debuffChance(target, sp.frostMantle)) return;
    if (sp.frostMantle < 100) events.push({ type: 'proc', unit: target, label: 'Frost!', itemId: 'frost_mantle', target: attacker });
    this.applyStatus(attacker, sp.frostMantleSpec || { status: 'chill', durationMs: 3000 }, target, `mantle_${target.uid}`, events);
  },

  // A friendly was hit by an enemy: Spirit Axe, Mimic Chest (10% a Mimic pops out of the holder).
  onHeroHit(target, events) {
    this.trySpiritAxe(target, events);
    const low = target.hp < (target.maxHp * (target.specials.mimicBelow ?? 100)) / 100; // Mimic Chest: only below 50% health
    if (!target.minion && target.alive && target.specials.mimic && low && this.rng() * 100 < target.specials.mimic) {
      const src = { key: 'mimic_chest', kind: 'weak', capGroup: 'items', upkeep: true, upkeepScale: this.rules.minions.upkeepWeakScale ?? 0.5, spec: { minion: 'mimic' }, copies: target.specials.mimicCopies || 1 };
      events.push({ type: 'proc', unit: target, label: 'Mimic!', itemId: 'mimic_chest' });
      this.spawnMinion(target, src, events);
    }
  },

  // Reaper's Bell (HAUNTING SPIRITS, user's design session 31): when the holder kills an enemy, `reaperBell`% (50, +15 per
  // extra copy) a ghost spirit rises and flies to the nearest enemy that is not haunted yet, haunting it for `hauntMs`
  // (5s, +1s per extra copy): it deals less damage (combat.json `haunt.attackPercent`), is Silenced (`haunt.silenceMs`;
  // bosses are not) and gets 1 Armor Break stack. At most `hauntMax` (3) spirits at once. No element.
  hauntSpirit(killer, victim, events) {
    const sp = killer.specials, H = this.rules.haunt || { attackPercent: -20, silenceMs: 2000 };
    this.spirits = (this.spirits || []).filter((x) => x.target.alive && x.remaining > 0);
    if (this.spirits.length >= (sp.hauntMax || 3) || this.rng() * 100 >= sp.reaperBell) return;
    const free = this.targetableEnemies().filter((e) => e !== victim && !e.def.object && !this.spirits.some((x) => x.target === e));
    if (!free.length) return;
    const target = this.nearest(victim, free);
    const ms = sp.hauntMs || 5000;
    this.spirits.push({ holder: killer, target, remaining: ms });
    events.push({ type: 'proc', unit: killer, label: 'Haunt!', itemId: 'reapers_bell', target });
    events.push({ type: 'projectile', from: victim, to: target, kind: 'spiritfire' }); // the ghost flies from the dead enemy
    this.applyStatus(target, { status: 'weaken', attackPercent: H.attackPercent, durationMs: ms }, killer, 'haunt', events);
    if (!target.def.boss) this.applyStatus(target, { status: 'silence', durationMs: H.silenceMs }, killer, 'haunt', events);
    this.applyStatus(target, { status: 'armorBreak', durationMs: ms, stackEach: true }, killer, 'haunt', events);
  },

  // Eclipse Idol: the holder's DARK damage (hits, Dark Spirit orbs, Poison and other dark ticks; not Doom itself) is
  // stored. At `eclipseCharge`% of its attack it is cast: 2-3 random enemies get DOOM for `eclipseMs` (a dark DoT of
  // `eclipse`% attack per second and `eclipseSlow`% slower attacks). Doom is item damage (it never refills the idol).
  // Frozen Demon Head: true when `type` is an element its holder may not deal (fire, electric, dark).
  demonHeadBlocks(unit, type) {
    return !!(unit.side === 'hero' && !unit.minion && unit.specials && unit.specials.demonHead && (type === 'fire' || type === 'electric' || type === 'dark'));
  },

  // Frozen Demon Head: stores the holder's ice damage; at `demonHeadFill`% (800) of its attack, Ice Spikes burst under
  // the strongest enemy (boss > elite > most health) for `demonHead`% (700, +150 per extra copy) of its attack as ice
  // + `demonHeadSpec` (Freeze 5s).
  storeIce(unit, amount, events) {
    const sp = unit.specials;
    if (!sp || !sp.demonHead || unit.side !== 'hero' || unit.minion || !unit.alive || !(amount > 0)) return;
    unit.iceStore = (unit.iceStore || 0) + amount;
    if (unit.iceStore < (unit.stats.attack * (sp.demonHeadFill || 800)) / 100) return;
    const target = this.strongestEnemy();
    if (!target) return;
    unit.iceStore = 0;
    events.push({ type: 'proc', unit, label: 'Ice Spikes!', itemId: 'frozen_demon_head', target });
    events.push({ type: 'iceSpikes', unit, target });
    const hit = this.strike(unit, target, events, { multiplier: sp.demonHead / 100, damageType: 'ice', item: true, burst: true, spikes: true });
    if (!hit.dodged && target.alive) this.applyStatus(target, sp.demonHeadSpec || { status: 'freeze', durationMs: 5000 }, unit, `spikes_${unit.uid}`, events);
  },

  // Euclid of Elements (PRISM BURST, session 31): the damage of the holder's hits (not item damage) carrying 2+ different
  // ELEMENTS (magical types: its own + its riders) fills a prism. At `prismFill`% (1000) of its attack the prism bursts:
  // every enemy is hit by fire, ice, electric and dark, together `prism`% (300, +150 per extra copy) of its attack
  // (item hits). The +% element damage part is in items.js elementMix (a negative cut).
  euclid(unit, target, opts, events, amount = 0) {
    const sp = unit.side === 'hero' && !unit.minion ? unit.specials : null;
    if (!sp || !sp.prism || !(amount > 0)) return;
    const magic = (t) => this.damageTypes[t] && this.damageTypes[t].category === 'magical';
    const own = opts.damageType || unit.hitType || unit.damageType;
    const elements = new Set([own, ...(opts.riders || []).map((rd) => rd.damageType)].filter(magic));
    if (elements.size < 2) return;
    unit.prismStore = (unit.prismStore || 0) + amount;
    if (unit.prismStore < (unit.stats.attack * (sp.prismFill || 1000)) / 100) return;
    unit.prismStore = 0;
    const foes = this.targetableEnemies();
    if (!foes.length) return;
    const colors = ['fire', 'ice', 'electric', 'dark'];
    events.push({ type: 'proc', unit, label: 'Prism burst!', itemId: 'euclid_of_elements', target, elements: colors, staggerMs: 80, count: colors.length });
    for (const e of foes) events.push({ type: 'deathBurst', unit: e, radius: 40, color: '#ffffff', targets: [], explosive: false });
    colors.forEach((type, i) => this.later(80 * (i + 1), (ev) => {
      if (!unit.alive) return;
      for (const e of this.targetableEnemies()) this.strike(unit, e, ev, { multiplier: sp.prism / 100 / colors.length, damageType: type, item: true, burst: true });
    }));
  },

  // Prism fill 0..1 (the scene can show it).
  prismCharge(unit) {
    const sp = unit.specials;
    return sp && sp.prism ? Math.min(1, (unit.prismStore || 0) / ((unit.stats.attack * (sp.prismFill || 1000)) / 100)) : 0;
  },

  storeDark(unit, amount, events) {
    const sp = unit.specials;
    if (!sp || !sp.eclipse || unit.side !== 'hero' || unit.minion || !unit.alive || !(amount > 0)) return;
    unit.voidStore = (unit.voidStore || 0) + amount;
    if (unit.voidStore < (unit.stats.attack * (sp.eclipseCharge || 1000)) / 100) return;
    const foes = this.targetableEnemies();
    if (!foes.length) return;
    unit.voidStore = 0;
    const picks = [...foes].sort(() => this.rng() - 0.5).slice(0, 2 + Math.floor(this.rng() * 2));
    events.push({ type: 'proc', unit, label: 'Eclipse!', itemId: 'eclipse_idol', target: picks[0] });
    for (const t of picks) {
      events.push({ type: 'projectile', from: unit, to: t, kind: 'spiritfire' }); // the Dark Spirit orb flies to it
      this.later(900, (ev) => {
        if (!t.alive || !unit.alive) return;
        this.applyStatus(t, { status: 'doom', durationMs: sp.eclipseMs || 4000, damageMultiplier: sp.eclipse / 100, damageType: 'dark', attackSpeedPercent: -(sp.eclipseSlow || 50), resistCutPercent: sp.eclipseResistCut || 0 }, unit, `doom_${unit.uid}`, ev);
      });
    }
  },

  // All enemies in a chain order: from `first`, always to the nearest one not yet hit.
  chainOrder(first) {
    const left = this.enemies.filter((e) => e.alive && e !== first);
    const order = [first];
    let at = first;
    while (left.length) {
      left.sort((a, b) => this.distance(at, a) - this.distance(at, b));
      at = left.shift();
      order.push(at);
    }
    return order;
  },

  // The living hero with the lowest health % (full health counts), for Divine Shield.
  lowestHealthPercent() {
    return this.heroes.filter((h) => h.alive).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  },
};
