// Part of BattleState (mixed into its prototype at the bottom of ../BattleState.js; `this` is the BattleState).
// XP, levels, stat refresh, giving items, and the room effects on the squad (bless, trap, heals).
import { xpForNextLevel, statsAtLevel } from '../leveling.js';
import { computeHeroStats, elementMix } from '../items.js';
import { moraleTier } from '../party.js';

export const statsMethods = {
  // ---- XP, levels, items --------------------------------------------------------------

  // Splits an enemy's XP between the living heroes. Dead heroes get nothing.
  awardXp(enemy, events) {
    this.kills = (this.kills || 0) + 1; // enemies killed in this run (saved with the run's results)
    const living = this.heroes.filter((h) => h.alive);
    if (!living.length) return;
    const bounty = enemy.elite ? living.reduce((n, h) => n + ((h.specials && h.specials.bountyXp) || 0), 0) : 0; // Elite's Badge: +50% XP from elites
    const share = ((enemy.def.xp || 0) * (enemy.xpScale ?? 1) * (1 + bounty / 100)) / living.length;
    for (const hero of living) {
      hero.xp += share;
      while (hero.xp >= xpForNextLevel(hero.level, this.leveling)) {
        hero.xp -= xpForNextLevel(hero.level, this.leveling);
        this.levelUp(hero);
        events.push({ type: 'levelup', unit: hero });
      }
    }
  },

  // Raises a hero one level.
  levelUp(hero) {
    hero.level += 1;
    this.refreshStats();
  },

  // Works out every living hero's stats again (level + items + buffs). If max health goes up,
  // current health goes up by the same amount; if it goes down, current health is capped to the
  // new max.
  refreshStats() {
    this.morale = moraleTier(this.heroes);
    for (const hero of this.heroes) {
      if (!hero.alive) continue;
      const levelStats = statsAtLevel(hero.baseStats, hero.def, hero.level);
      const tough = 1 + ((this.rules.heroDefense && this.rules.heroDefense.percent) || 0) / 100; // combat.json heroDefense
      levelStats.defense = (levelStats.defense || 0) * tough;
      levelStats.resist = (levelStats.resist || 0) * tough;
      levelStats.attack = (levelStats.attack || 0) * (1 + ((this.rules.heroAttack && this.rules.heroAttack.percent) || 0) / 100); // combat.json heroAttack
      const { stats, damageBonus, specials, procs, minionSources } = computeHeroStats(hero, this.heroes, this.itemDefs, levelStats, this.rules.morale, this.statUpkeep(hero), this.squadItemMult());
      hero.minionSources = this.buildSources(hero, minionSources);
      const hpDelta = stats.health - hero.maxHp;
      hero.stats = stats;
      hero.damageBonus = damageBonus;
      hero.specials = specials;
      hero.elementCut = elementMix(hero, this.itemDefs, this.rules.elementMix).cut; // mixing elements: combat.js cuts the element damage
      // Shield Totem: while a holder's totem stands, EVERY hero blocks `totemBlock`% (4 per copy) more (60% cap shared).
      const aura = this.totemBlock();
      if (aura) specials.block = Math.min(this.rules.blockCapPercent || 60, (specials.block || 0) + aura);
      // The hero's own passive can have procs too (Knight's Taunt Wall); they roll like item procs.
      hero.procs = [...procs, ...(((hero.def.passive && hero.def.passive.procs) || []).map((p) => ({ ...p, itemId: `passive_${hero.def.id}` })))];
      hero.maxHp = stats.health;
      hero.hp = Math.max(1, hpDelta > 0 ? hero.hp + hpDelta : Math.min(hero.hp, hero.maxHp));
    }
    for (const e of this.enemies) if (e.alive) this.refreshEnemyStats(e);
    for (const m of this.minions) {
      // A greater minion's item got another copy: it grows (see refreshMinionStats).
      const holder = m.greater && this.heroes.find((h) => h.uid === m.holderUid);
      const src = holder && (holder.minionSources || []).find((x) => x.key === m.sourceKey);
      if (src) m.copies = src.copies;
      this.refreshMinionStats(m);
    }
  },

  // An enemy's stats = its base stats (floor scaling, elite) + its `buff` statuses (Rask & Vesh enrage, Stone Golem,
  // Lava Hound howl). Buffs never change its health.
  refreshEnemyStats(e) {
    const buffs = e.statuses.filter((st) => st.type === 'buff');
    if (!buffs.length && !e.buffed) return;
    e.buffed = buffs.length > 0;
    const stats = { ...e.baseStats };
    for (const st of buffs) {
      for (const mod of st.mods || []) {
        if (!mod.stat || mod.stat === 'health') continue;
        if (mod.percent !== undefined) stats[mod.stat] += ((e.baseStats[mod.stat] || 0) * mod.percent) / 100;
        else stats[mod.stat] = (stats[mod.stat] || 0) + mod.flat;
      }
    }
    stats.health = e.maxHp;
    e.stats = stats;
  },

  // Shield Totem aura: the block every hero gets from the living holders whose totem stands (copies add up).
  totemBlock() {
    let n = 0;
    for (const h of this.heroes) if (h.alive && h.specials && h.specials.totemBlock && this.minions.some((m) => m.alive && m.holderUid === h.uid && m.sourceKey === 'shield_totem')) n += h.specials.totemBlock;
    return n;
  },

  // Changes to a hero's stats that come from its current state, not its items: minion upkeep,
  // Spite Mail while taunting, the Archer's Steady Aim.
  statUpkeep(hero) {
    const upkeep = [];
    const paying = this.upkeepCount(hero);
    const mr = this.rules.minions || {};
    if (paying > 0) upkeep.push({ stat: 'attackEfficiency', percent: (mr.upkeepAttackSpeedPercent || 0) * paying }, { stat: 'defense', percent: (mr.upkeepDefensePercent || 0) * paying });
    if (hero.taunting && hero.specials && hero.specials.spiteMail) upkeep.push({ stat: 'defense', flat: hero.specials.spiteMail }, { stat: 'resist', flat: hero.specials.spiteResist || 0 }); // Spite Mail
    if (hero.lanternGain) upkeep.push({ stat: 'attack', percent: hero.lanternGain }, { stat: 'health', percent: hero.lanternGain }, { stat: 'attackEfficiency', percent: hero.lanternGain }, { stat: 'defense', flat: hero.lanternGain }); // Soul Lantern
    const sa = hero.def.passive && hero.def.passive.steadyAim;
    if (sa && hero.steady) upkeep.push({ stat: 'attackEfficiency', percent: sa.attackSpeedPercent }, { stat: 'crit', flat: sa.critFlat });
    if (hero.thirst) upkeep.push({ stat: 'attack', percent: hero.def.passive.bloodthirst.attackPercent }); // Berserker's Bloodthirst
    const iai = hero.def.passive && hero.def.passive.iaido;
    if (iai && iai.evasionFlat) upkeep.push({ stat: 'evasion', flat: iai.evasionFlat }); // Samurai v3: built-in evasion
    const lob = hero.def.passive && hero.def.passive.lobbed;
    if (lob && lob.attackSpeedPercent) upkeep.push({ stat: 'attackEfficiency', percent: lob.attackSpeedPercent }); // Alchemist: slower flasks
    // Bard's March: the whole squad attacks faster while he plays it (Conductor's Baton makes it stronger).
    for (const b of this.bards()) if (b.song === 'march') upkeep.push({ stat: 'attackEfficiency', percent: b.def.passive.songs.march.attackSpeedPercent * (1 + ((b.specials && b.specials.baton) || 0) / 100) });
    return upkeep;
  },

  // Gives a hero an item.
  giveItem(heroUid, itemId) {
    const hero = this.heroes.find((h) => h.uid === heroUid);
    hero.items.push(itemId);
    this.refreshStats();
  },

  // What a hero's stats WOULD be with one more copy of an item (nothing changes).
  previewStats(heroUid, itemId) {
    const hero = this.heroes.find((h) => h.uid === heroUid);
    hero.items.push(itemId);
    const levelStats = statsAtLevel(hero.baseStats, hero.def, hero.level);
    const result = computeHeroStats(hero, this.heroes, this.itemDefs, levelStats, this.rules.morale, this.statUpkeep(hero), this.squadItemMult()); // same state bonuses as now, so before > after compares like with like
    hero.items.pop();
    return result;
  },

  // Rest fountain: the next `fights` fights start with a regen buff of `regenPercentPerSec` on every living hero.
  // A second fountain replaces the first (it does not stack).
  bless(regenPercentPerSec, fights) {
    this.blessing = { regenPercentPerSec, fights };
  },

  // Heals every living hero by a % of their max health. Returns [{ unit, amount }].
  // A trap outside a fight (a Mimic in the Puzzle Room bites): one random living hero loses `percent` of max health,
  // but never dies from it (at least 1 health is left). Returns { unit, amount } or null.
  trapDamage(percent) {
    const alive = this.heroes.filter((h) => h.alive);
    if (!alive.length) return null;
    const unit = alive[Math.floor(this.rng() * alive.length)];
    const amount = Math.min(Math.round((unit.maxHp * percent) / 100), unit.hp - 1);
    unit.hp -= amount;
    return { unit, amount };
  },

  healHeroes(percent) {
    const healed = [];
    for (const h of this.heroes) {
      if (!h.alive) continue;
      const amount = Math.min(Math.round((h.maxHp * percent) / 100), h.maxHp - h.hp);
      h.hp += amount;
      healed.push({ unit: h, amount });
    }
    return healed;
  },

  // The heal after a won floor: the normal % plus each hero's own Aid Kits.
  winHeal(percent) {
    const healed = [];
    for (const h of this.heroes) {
      if (!h.alive) continue;
      const bonus = (h.specials && h.specials.clearHealFlat) || 0; // (old Aid Kit: flat health per kit)
      const more = (h.specials && h.specials.winHeal) || 0; // Heart Charm: +5% of max health per charm
      const amount = Math.min(Math.round((h.maxHp * (percent + more)) / 100 + bonus), h.maxHp - h.hp);
      h.hp += amount;
      healed.push({ unit: h, amount });
    }
    return healed;
  },

  // Removes every status from the heroes (called when a floor is cleared).
  clearStatuses() {
    for (const h of this.heroes) {
      h.statuses = [];
      h.dotClocks = {};
      h.casting = null;
    }
    this.refreshStats();
  },
};
