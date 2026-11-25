import { weakResistMultiplier } from '../combat.js';
import { heroPageFits } from '../books.js';
// Part of BattleState (mixed into its prototype at the bottom of ../BattleState.js; `this` is the BattleState).
// Skill book pages (docs/systems/skill-books.md).

export const skillBooksMethods = {
  // ---- skill books (skillBooks.json pages, combat.json `books` limits) ----------------------------------------
  // Puts a page ({ id, kind, ... } from skillBooks.json) on skill `index` of a hero, for the rest of the run.
  // Stat pages: at most books.maxStatPages per skill (they may repeat; null = no limit). Modifiers: at most books.modifierSlots, no
  // duplicates; on a full skill pass `replace` = which of its modifiers (0, 1...) the new one replaces.
  // Returns { ok, reason?: 'noHero' | 'full' | 'duplicate', replaced? }.
  addPage(heroUid, index, page, replace = null) {
    const hero = this.heroes.find((h) => h.uid === heroUid);
    const slot = hero && hero.skills[index];
    if (!slot || !hero.alive) return { ok: false, reason: 'noHero' };
    if (!heroPageFits(hero, index, page)) return { ok: false, reason: 'wrongSkill' }; // a hero page: only its hero's named skill
    const lim = this.rules.books || {};
    const pages = (slot.pages = slot.pages || []);
    if (page.kind === 'stat') {
      if (pages.filter((p) => p.kind === 'stat').length >= (lim.maxStatPages ?? Infinity)) return { ok: false, reason: 'full' };
      pages.push(page);
      return { ok: true };
    }
    const mods = pages.filter((p) => p.kind === 'modifier');
    if (mods.some((p) => p.id === page.id)) return { ok: false, reason: 'duplicate' };
    if (mods.length >= (lim.modifierSlots ?? Infinity)) { // null = no limit
      if (replace === null || !mods[replace]) return { ok: false, reason: 'full' };
      pages.splice(pages.indexOf(mods[replace]), 1, page);
      return { ok: true, replaced: mods[replace] };
    }
    pages.push(page);
    return { ok: true };
  },

  // What the pages on one skill add up to (percent numbers; windupMultiplier multiplies).
  pageTotals(slot) {
    const t = { power: 0, cooldown: 0, windup: 0, duration: 0, windupMultiplier: 1, mods: [] };
    for (const p of (slot && slot.pages) || []) {
      t.power += p.power || 0;
      t.cooldown += p.cooldown || 0;
      t.windup += p.windup || 0;
      t.duration += p.duration || 0;
      if (p.windupMultiplier) t.windupMultiplier *= p.windupMultiplier;
      if (p.kind === 'modifier') t.mods.push(p);
    }
    return t;
  },

  // Modifiers that act once when the skill goes off: statuses on the caster / squad (Bulwark, Rally). A skill that
  // hits no enemy (a support skill) uses the page's support version: Inks go on the enemy nearest the caster,
  // Siphon heals the caster a % of max health.
  bookCast(hero, skill, mods, events, targets = []) {
    const hitsEnemies = !!(skill.damageMultiplier || skill.channel || (skill.random && skill.random.target === 'enemy'));
    for (const m of mods) {
      for (const spec of m.selfApply || []) this.applyStatus(hero, spec, hero, `book_${m.id}`, events);
      for (const spec of m.squadApply || []) for (const u of this.squadUnits()) this.applyStatus(u, spec, hero, `book_${m.id}`, events);
      // Second Wind: the caster heals a % of its max health.
      if (m.selfHealPercent) this.healUnit(hero, Math.round((hero.maxHp * m.selfHealPercent) / 100), events);
      // Momentum: the caster's next basic attacks hit harder (landAttack spends them).
      if (m.momentum) { hero.momentum = { left: m.momentum.attacks, percent: m.momentum.damagePercent }; events.push({ type: 'proc', unit: hero, label: 'Momentum!' }); }
      // Guardian: the most hurt hero (the caster too) gets a shield.
      if (m.allyShield) {
        const ally = this.heroes.filter((h) => h.alive).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (ally) this.applyStatus(ally, m.allyShield, hero, `book_${m.id}`, events);
      }
      // Time Warp: the caster's OTHER skills are ready again at once.
      if (m.resetOther) for (const other of hero.skills) if (!(other.pages || []).includes(m) && other.cooldownLeft > 0) { other.cooldownLeft = 0; events.push({ type: 'proc', unit: hero, label: 'Time Warp!' }); }
      // Tempo: the caster's OTHER skills come back sooner.
      if (m.otherCooldownMs) for (const other of hero.skills) if (other !== hero.skills.find((sl) => (sl.pages || []).includes(m))) other.cooldownLeft = Math.max(0, other.cooldownLeft - m.otherCooldownMs);
      if (m.grow) events.push({ type: 'grow', unit: hero, scale: m.grow.scale, durationMs: m.grow.durationMs }); // Titan (the scene makes the hero bigger)
      // Blood Price: the most hurt allies heal, the caster pays (never below 1 health).
      if (m.allyHeal) {
        const allies = this.heroes.filter((h) => h.alive && h !== hero).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, m.allyHeal.count);
        for (const a of allies) this.healUnit(a, Math.round((a.maxHp * m.allyHeal.percentMaxHp) / 100), events, { by: hero });
      }
      if (m.selfCostPercent) {
        const cost = Math.round((hero.hp * m.selfCostPercent) / 100);
        hero.hp = Math.max(1, hero.hp - cost);
        events.push({ type: 'selfCost', unit: hero, amount: cost });
      }
      // Cyclone: a tornado on the skill's enemy target (or the enemy nearest the caster).
      if (m.tornado) {
        const e = targets.find((t) => t.side === 'enemy' && t.alive) || this.nearest(hero, this.targetableEnemies());
        if (e) this.spawnTornado(hero, m.tornado, e, events);
      }
      // Purify: the caster loses a debuff (a support skill cleans every ally it touches).
      if (m.purify) for (const u of hitsEnemies ? [hero] : [hero, ...targets.filter((t) => t.side === 'hero' && t !== hero)]) this.cleanse(u, m.purify, events);
      // Roar: enemies near the caster must hit it for a moment; it gets some armor.
      if (m.roar) {
        for (const e of this.targetableEnemies().filter((x) => !this.hasPositions(hero) || !this.hasPositions(x) || this.distance(hero, x) <= m.roar.radius)) this.applyStatus(e, m.roar.taunt, hero, `book_${m.id}`, events);
        this.applyStatus(hero, m.roar.self, hero, `book_${m.id}_self`, events);
        events.push({ type: 'roar', unit: hero });
      }
      // Gravecall: a weak skeleton (at most `max` page skeletons per hero; the oldest goes).
      if (m.summon) {
        const mine = this.minions.filter((x) => x.holderUid === hero.uid && x.capGroup === 'book');
        if (mine.length >= m.summon.max) this.vanishMinion(mine[0], 'pushedOut', events);
        this.spawnMinion(hero, { kind: 'weak', key: `book_${m.id}`, capGroup: 'book', spec: { minion: m.summon.minion } }, events);
      }
      if (hitsEnemies) continue;
      if (m.ink) {
        const e = this.nearest(hero, this.targetableEnemies());
        if (e) for (const spec of m.ink) this.applyStatus(e, spec, hero, `book_${m.id}`, events);
      }
      if (m.supportHealPercent) this.healUnit(hero, Math.round((hero.maxHp * m.supportHealPercent) / 100), events);
    }
  },

  // HERO PAGES (`patch` on a hero-only page): the skill is changed when it goes off. addWaves (channel: more waves like
  // the last one), randomCount (flasks thrown), applyDurationAdd {status: ms} (longer statuses), landApply (statuses the
  // leap's landing shockwave AND its target get), neighbourApply (the skill's statuses also go on the target's
  // neighbours), raiseCount (skeletons a kill raises), extraHeals (Holy Nova heals that many more hurt allies),
  // secondBand {offset} (a band skill slashes the band behind too), convergeEvery (every Nth rotation cast fires all spells).
  heroPagePatch(skill, mods) {
    let out = skill;
    for (const m of mods) {
      const P = m.patch;
      if (!P) continue;
      out = { ...out };
      if (P.addWaves && out.channel) { const w = out.channel.waves; out.channel = { ...out.channel, waves: [...w, ...Array(P.addWaves).fill(w[w.length - 1])] }; }
      if (P.randomCount && out.random) out.random = { ...out.random, count: P.randomCount };
      if (P.applyDurationAdd && out.apply) out.apply = out.apply.map((a) => (P.applyDurationAdd[a.status] ? { ...a, durationMs: (a.durationMs || 0) + P.applyDurationAdd[a.status] } : a));
      if (P.landApply && out.landSplash) { out.landSplash = { ...out.landSplash, apply: P.landApply }; out.apply = [...(out.apply || []), ...P.landApply]; }
      if (P.neighbourApply) out.neighbourApply = true;
      if (P.raiseCount && out.onKill) out.onKill = { ...out.onKill, count: P.raiseCount };
      if (P.extraHeals && out.holyNova) out.holyNova = { ...out.holyNova, extraHeals: P.extraHeals };
      if (P.secondBand) out.secondBand = P.secondBand;
      if (P.convergeEvery) out.convergeEvery = P.convergeEvery;
      if (P.pullCount && out.pull) out.pullCount = P.pullCount; // Long Reach (Warden): Chain Hook drags more enemies
      if (P.areaRadiusPercent && out.area) out.area = { ...out.area, radius: out.area.radius * (1 + P.areaRadiusPercent / 100) }; // Iron Circle
      if (P.addApply) out.apply = [...(out.apply || []), ...P.addApply]; // Cold Iron: extra statuses on every hit
    }
    return out;
  },

  // Twin Crescent: a band skill also slashes the band right behind the first one (further from the squad), hitting
  // the enemies there that the first slash missed. Returns the extra enemies hit.
  secondBandHit(hero, skill, slotId, zone, targets, events) {
    if (!zone || zone.shape !== 'band') return [];
    const z2 = { ...zone, y: zone.y - zone.halfHeight * (skill.secondBand.offset || 2) };
    const extra = this.targetableEnemies().filter((e) => !targets.includes(e) && this.inZone(e, z2));
    events.push({ type: 'wave', unit: hero, skill, wave: 1, waves: 2, targets: extra, zone: z2 });
    for (const e of extra) this.skillHit(hero, skill, slotId, e, events);
    return extra;
  },

  // Per-hit bonuses of this cast's pages (only while the hero's own cast is going off, see castPages): critBonus (Keen),
  // armorPierce (Piercing: % of defense / resist ignored), vsLow (Finisher: more power vs a hurt enemy), vsBig (Giant
  // Slayer: more power vs elites and bosses), elementalStorm (damageType: own type -> the element the target is weakest to).
  // Returns { mult, critBonus, armorPierce, damageType? }.
  bookHitMods(hero, target) {
    const out = { mult: 1, critBonus: 0, armorPierce: 0 };
    const cp = this.castPages;
    if (!cp || cp.hero !== hero || target.side !== 'enemy') return out;
    for (const m of cp.mods) {
      out.critBonus += m.critBonus || 0;
      out.armorPierce += m.armorPierce || 0;
      if (m.vsLow && (target.hp / target.maxHp) * 100 < m.vsLow.belowPercent) out.mult *= 1 + m.vsLow.power / 100;
      if (m.vsBig && (target.elite || (target.def && target.def.boss))) out.mult *= 1 + m.vsBig.power / 100;
      // Elemental Storm: the hit turns into the element the target is weakest to (its own type stays on a tie).
      if (m.elementalStorm) {
        const score = (t) => (this.damageTypes[t] ? weakResistMultiplier(target, t, this.rules, this.damageTypes) : 0);
        out.damageType = (own) => m.elementalStorm.elements.reduce((best, t) => (score(t) > score(best) ? t : best), own);
        if (m.elementalStorm.weakBonus && m.elementalStorm.elements.some((t) => score(t) > 1)) out.mult *= 1 + m.elementalStorm.weakBonus / 100; // it found a weakness
      }
    }
    return out;
  },

  // Quick Draw (`fightStartCharge`: % of the full cooldown): when a fight starts, the skill's cooldown left drops by
  // that much (a skill still cooling from the last fight is half way ready). Called from startFloor.
  bookFightStart(hero) {
    for (const slot of hero.skills) {
      const charge = ((slot.pages || []).find((p) => p.fightStartCharge) || {}).fightStartCharge;
      if (charge && slot.cooldownLeft > 0) slot.cooldownLeft = Math.max(0, slot.cooldownLeft - (this.skillDefs[slot.id].cooldownMs * charge) / 100);
    }
  },

  // Phoenix Page (`phoenix`): once per floor, a hit that would kill the hero leaves it at `hpPercent` health and fires
  // the page's skill for free (no cooldown used). Called from dealDamage when health reaches 0.
  phoenixPage(hero, events) {
    if (hero.side !== 'hero' || hero.minion || !hero.alive || hero.hp > 0 || (hero.floor && hero.floor.phoenixPage)) return;
    const index = hero.skills.findIndex((sl) => (sl.pages || []).some((p) => p.phoenix));
    if (index < 0) return;
    const page = hero.skills[index].pages.find((p) => p.phoenix);
    hero.floor = hero.floor || {};
    hero.floor.phoenixPage = true;
    hero.hp = Math.max(1, Math.round((hero.maxHp * page.phoenix.hpPercent) / 100));
    events.push({ type: 'proc', unit: hero, label: 'Phoenix Page!' });
    hero.casting = null; // a wind-up in progress is dropped: the free cast goes off now
    const saved = this.castPages;
    this.releaseSkill(hero, index, events);
    this.castPages = saved;
  },

  // Momentum: a basic attack of the hero uses up one charge; returns the extra damage % for it (0 = none left).
  spendMomentum(hero) {
    const m = hero.momentum;
    if (!m || m.left <= 0) return 0;
    m.left--;
    return m.percent;
  },

  // Modifiers on every enemy a skill hit lands on: Inks (statuses), Siphon (heals the caster).
  bookOnHit(hero, target, result, events) {
    const cp = this.castPages;
    if (!cp || cp.hero !== hero || target.side !== 'enemy' || !result || result.dodged) return;
    for (const m of cp.mods) {
      const dealt = (result.amount || 0) - (result.absorbed || 0);
      if (m.siphonPercent && dealt > 0) this.healUnit(hero, Math.max(1, Math.round((dealt * m.siphonPercent) / 100)), events);
      if (m.ink && target.alive) for (const spec of m.ink) this.applyStatus(target, spec, hero, `book_${m.id}`, events);
      // Detonate: the target's poison / bleed / burn stacks go off at once (a bonus hit per stack) and are used up.
      if (m.detonate && target.alive) {
        const gone = target.statuses.filter((st) => m.detonate.statuses.includes(st.type));
        if (gone.length) {
          target.statuses = target.statuses.filter((st) => !gone.includes(st));
          for (const st of gone) events.push({ type: 'status', unit: target, change: 'expire', status: st });
          events.push({ type: 'proc', unit: hero, label: `Detonate x${gone.length}!`, target });
          this.strike(hero, target, events, { multiplier: m.detonate.perStack * Math.min(gone.length, m.detonate.maxStacks || Infinity), ...(m.detonate.damageType ? { damageType: m.detonate.damageType } : {}) });
        }
      }
      // Executioner: a normal enemy (not elite, not boss) left under `belowPercent` health dies; the cast's first kill
      // gives back `cooldownBackPercent` of the skill's cooldown.
      if (m.executioner) {
        const ex = m.executioner;
        if (target.alive && !target.elite && !(target.def && target.def.boss) && (target.hp / target.maxHp) * 100 < ex.belowPercent) {
          events.push({ type: 'proc', unit: hero, label: 'Executed!', target });
          const shields = target.statuses.filter((st) => st.type === 'shield').reduce((a, st) => a + Math.ceil(st.amount), 0);
          this.strike(hero, target, events, { fixedAmount: target.hp + shields });
          if (ex.healPercent) this.healUnit(hero, Math.round((hero.maxHp * ex.healPercent) / 100), events); // a survival side (user, tuning round 1)
        }
        if (!target.alive && !cp.refunded) {
          cp.refunded = true;
          const slot = hero.skills.find((sl) => (sl.pages || []).includes(m));
          if (slot) slot.cooldownLeft *= 1 - ex.cooldownBackPercent / 100;
        }
      }
      // Elemental Storm: an enemy hit with its weakness also gets `weakApply` (Weaken: it deals less damage).
      if (m.elementalStorm && m.elementalStorm.weakApply && target.alive && m.elementalStorm.elements.some((t) => this.damageTypes[t] && weakResistMultiplier(target, t, this.rules, this.damageTypes) > 1)) {
        for (const spec of m.elementalStorm.weakApply) this.applyStatus(target, spec, hero, `book_${m.id}`, events);
      }
      if (m.onHitChance && target.alive && this.rng() * 100 < m.onHitChance.chance) for (const spec of m.onHitChance.apply) this.applyStatus(target, spec, hero, `book_${m.id}`, events);
    }
  },

  // Modifiers after the skill's hits: Ricochet (one more target at a share), Aftershock (a later pulse, see tickBookTimers).
  bookAfterCast(hero, skill, slotId, targets, mods, events) {
    for (const m of mods) {
      if (m.ricochet && targets.length === 1) {
        const first = targets[0];
        if (first.side === 'enemy' && skill.damageMultiplier) {
          const other = this.nearest(first, this.targetableEnemies().filter((e) => e !== first));
          if (other) {
            events.push({ type: 'ricochet', unit: hero, from: first, to: other });
            this.skillHit(hero, skill, `${slotId}_ricochet`, other, events, { multiplier: skill.damageMultiplier * m.ricochet });
          }
        } else if (first.side === 'hero') {
          const other = this.heroes.filter((h) => h.alive && h !== first).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
          if (other) {
            events.push({ type: 'ricochet', unit: hero, from: first, to: other });
            this.skillHit(hero, this.scaleSkill(skill, m.ricochet, 1), `${slotId}_ricochet`, other, events);
          }
        }
      }
      // Chain Spark: from the first enemy hit, a spark jumps to the nearest `jumps` other enemies for a share of the skill.
      if (m.chainSpark && skill.damageMultiplier && targets.some((t) => t.side === 'enemy')) {
        let from = targets.find((t) => t.side === 'enemy');
        const hit = new Set(targets);
        for (let j = 0; j < m.chainSpark.jumps; j++) {
          const next = this.nearest(from, this.targetableEnemies().filter((e) => !hit.has(e)));
          if (!next) break;
          hit.add(next);
          this.skillHit(hero, { damageMultiplier: skill.damageMultiplier * m.chainSpark.power, damageType: m.chainSpark.damageType || skill.damageType, chain: true }, `${slotId}_spark`, next, events, { jumpFrom: from });
          from = next;
        }
      }
      if (m.aftershock && (skill.damageMultiplier || skill.heal)) {
        (this.bookTimers = this.bookTimers || []).push({ left: m.aftershock.delayMs, hero, slotId, targets: [...targets], power: m.aftershock.power, skill: { damageType: skill.damageType, damageMultiplier: skill.damageMultiplier, heal: skill.heal } });
      }
    }
  },

  // Aftershock pulses: the same targets are hit (or healed) again for a share, with no statuses.
  tickBookTimers(dt, events) {
    if (!this.bookTimers || !this.bookTimers.length) return;
    for (const t of [...this.bookTimers]) {
      t.left -= dt;
      if (t.left > 0) continue;
      this.bookTimers.splice(this.bookTimers.indexOf(t), 1);
      if (!t.hero.alive) continue;
      const alive = t.targets.filter((u) => u.alive);
      if (!alive.length) continue;
      events.push({ type: 'aftershock', unit: t.hero, targets: alive });
      const sk = { damageType: t.skill.damageType, damageMultiplier: t.skill.damageMultiplier ? t.skill.damageMultiplier * t.power : 0, heal: t.skill.heal ? { percentMaxHp: (t.skill.heal.percentMaxHp || 0) * t.power, attackMultiplier: (t.skill.heal.attackMultiplier || 0) * t.power } : null };
      for (const u of alive) if ((u.side === 'enemy') === !!sk.damageMultiplier) this.skillHit(t.hero, sk, `${t.slotId}_after`, u, events);
    }
  },
};
