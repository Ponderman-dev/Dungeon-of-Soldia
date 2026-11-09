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

  // Modifiers on every enemy a skill hit lands on: Inks (statuses), Siphon (heals the caster).
  bookOnHit(hero, target, result, events) {
    const cp = this.castPages;
    if (!cp || cp.hero !== hero || target.side !== 'enemy' || !result || result.dodged) return;
    for (const m of cp.mods) {
      const dealt = (result.amount || 0) - (result.absorbed || 0);
      if (m.siphonPercent && dealt > 0) this.healUnit(hero, Math.max(1, Math.round((dealt * m.siphonPercent) / 100)), events);
      if (m.ink && target.alive) for (const spec of m.ink) this.applyStatus(target, spec, hero, `book_${m.id}`, events);
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
