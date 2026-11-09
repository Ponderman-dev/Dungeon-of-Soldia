// Part of BattleState (mixed into its prototype at the bottom of ../BattleState.js; `this` is the BattleState).
// Hero kits: signature mechanics, passives, the Rogue's Opportunist and the 'every Nth attack' counters (docs/systems/heroes.md).
import { computeHeroStats } from '../items.js';

export const heroesMethods = {
  // ---- hero rework v2: signature mechanics (all numbers in the hero's passive in heroes.json) ----------

  // Knight's INTERCEPT (passive.intercept): when an ally drops under `belowPercent` health, the Knight guards
  // them for `durationMs`: he takes `sharePercent` of every enemy hit on them (see strike). Cooldown `cooldownMs`.
  tryIntercept(ally, events) {
    for (const k of this.heroes) {
      const ic = k.alive && k !== ally && k.def.passive && k.def.passive.intercept;
      if (!ic || k.interceptCd > 0 || ally.hp >= (ally.maxHp * ic.belowPercent) / 100) continue;
      k.interceptCd = ic.cooldownMs;
      this.applyStatus(ally, { status: 'guarded', durationMs: ic.durationMs }, k, 'intercept', events);
      events.push({ type: 'intercept', unit: k, ally });
      return;
    }
  },

  // The Knight takes his share of a hit on a guarded ally. Returns the amount the ally still takes.
  interceptHit(attacker, target, amount, events) {
    const g = target.statuses.find((st) => st.type === 'guarded');
    const k = g && this.heroes.find((h) => h.uid === g.sourceUid && h.alive && h !== target && h.def.passive && h.def.passive.intercept); // not a Martyr's Shield guard
    if (!k) return amount;
    const part = Math.round((amount * k.def.passive.intercept.sharePercent) / 100);
    if (part <= 0) return amount;
    const d = this.dealDamage(k, part, events);
    events.push({ type: 'intercepted', unit: k, ally: target, amount: d.immune ? 0 : part - d.absorbed });
    this.breakEffects(k, d.broken, events);
    if (!d.immune) this.afterHit(attacker, k, part - d.absorbed, events); // his Bulwark Plate / Spite Mail reflect it
    if (k.hp <= 0 && k.alive) this.killUnit(k, events, attacker);
    return amount - part;
  },

  // Berserker's RAGE (passive.rage): fills from his hits (`perHitDealt`, x`critMultiplier` on crits) and
  // hits he takes (`perHitTaken`); full = FRENZY (a buff with `frenzy.mods` for `frenzy.durationMs`).
  gainRage(hero, amount, events) {
    const r = hero.def.passive && hero.def.passive.rage;
    if (!r || !hero.alive || hero.side !== 'hero' || this.frenzied(hero)) return;
    hero.rage = Math.min(r.max, hero.rage + amount);
    if (hero.rage < r.max) return;
    hero.rage = 0;
    if (events) events.push({ type: 'proc', unit: hero, label: 'Frenzy!' });
    this.applyStatus(hero, { status: 'buff', durationMs: r.frenzy.durationMs, mods: r.frenzy.mods }, hero, 'frenzy', events || []);
  },

  frenzied(hero) {
    return hero.statuses.some((st) => st.key === 'buff:frenzy');
  },

  // Rogue's COMBO (passive.combo): points on ONE enemy (another enemy starts over), up to `max`.
  addCombo(hero, target, n, events) {
    const c = hero.def.passive && hero.def.passive.combo;
    if (!c || !target || target.side !== 'enemy') return;
    if (hero.combo.uid !== target.uid) hero.combo = { uid: target.uid, points: 0 };
    hero.combo.points = Math.min(c.max, hero.combo.points + n);
    events.push({ type: 'combo', unit: hero, target, points: hero.combo.points });
  },

  // Archer's pierce (passive.steadyAim.pierce): a basic shot on a MARKED enemy (on ANY enemy with
  // `everyShot`) also hits the closest other enemy within `radius` of it for `damageMultiplier`.
  pierce(unit, target, hit, events) {
    const p = unit.def.passive && unit.def.passive.steadyAim && unit.def.passive.steadyAim.pierce;
    if (!p || hit.dodged || (!p.everyShot && !this.has(target, 'mark'))) return;
    const others = this.enemies.filter((e) => e.alive && e !== target && (!this.hasPositions(e) || this.distance(e, target) <= p.radius));
    if (!others.length) return;
    const next = this.nearest(target, others);
    events.push({ type: 'proc', unit, label: 'Pierce!' });
    this.strike(unit, next, events, { multiplier: p.damageMultiplier, projectile: 'knife', from: target });
  },

  // Alchemist's LOBBED SHOTS (passive.lobbed): his basic attack is a flask. It poisons the target (`apply`) and
  // splashes `splashMultiplier` on every other enemy within `splashRadius` of it, poisoning them too.
  lobbedShot(unit, target, hit, events) {
    const L = unit.def.passive && unit.def.passive.lobbed;
    if (!L || hit.dodged) return;
    const near = this.enemies.filter((e) => e.alive && e !== target && this.hasPositions(e) && this.hasPositions(target) && this.distance(e, target) <= L.splashRadius);
    const poison = (e) => { for (const spec of L.apply || []) if (e.alive) this.applyStatus(e, spec, unit, 'passive_lobbed', events); };
    poison(target);
    for (const e of near) {
      const h = this.strike(unit, e, events, { multiplier: L.splashMultiplier });
      if (!h.dodged) poison(e);
    }
  },

  // Bard's SONGS (passive.songs): the song he plays helps the squad while he lives.
  bards() {
    return this.heroes.filter((h) => h.alive && h.def.passive && h.def.passive.songs);
  },

  songRegen() {
    let regen = 0;
    for (const b of this.bards()) if (b.song === 'ballad') regen += b.def.passive.songs.ballad.regenPercentPerSec * (1 + (b.specials.baton || 0) / 100);
    return regen;
  },

  // Change Song: switches the song and plays a short burst of the new one (a squad heal or a speed buff).
  // Bard v3 (`songs.first` + `durationMs`): plays `nextSong` for durationMs, the next cast plays the other one.
  switchSong(bard, events) {
    const songs = bard.def.passive.songs;
    if (songs.durationMs) {
      bard.song = bard.nextSong || 'march';
      bard.nextSong = bard.song === 'march' ? 'ballad' : 'march';
      bard.songLeft = songs.durationMs;
    } else bard.song = bard.song === 'march' ? 'ballad' : 'march';
    const burst = songs[bard.song].burst || {};
    events.push({ type: 'song', unit: bard, song: bard.song });
    for (const u of this.squadUnits()) {
      if (burst.healPercent) this.healUnit(u, (u.maxHp * burst.healPercent) / 100, events);
      if (burst.mods) this.applyStatus(u, { status: 'buff', durationMs: burst.durationMs, mods: burst.mods }, bard, 'song_burst', events);
    }
    this.refreshStats();
  },

  // Cleric's GRACE (passive.grace): every `everyMs` of a fight she heals the most hurt hero (`heal`, made stronger by
  // her aura like item heals). Healing SOMEONE ELSE gives HER `selfBuff` (+attack, +attack speed).
  tickGrace(hero, dt, events) {
    const G = hero.def.passive && hero.def.passive.grace;
    if (!G) return;
    hero.floor.grace = (hero.floor.grace || 0) + dt;
    if (hero.floor.grace < G.everyMs) return;
    const ally = this.lowestHealthPercent();
    if (!ally || ally.hp >= ally.maxHp) { hero.floor.grace = G.everyMs; return; } // nobody hurt: it waits, charged
    hero.floor.grace = 0;
    events.push({ type: 'flask', unit: hero, target: ally, flask: { color: '0xfff2a0' }, grace: true }); // a holy mote lobbed over (grace: she plays her bless motion)
    this.clericHeal(hero, ally, this.healAmount(hero, ally, G.heal) * this.regenAura().factor, events);
  },

  // A heal from the Cleric: if it lands on SOMEONE ELSE she gets Grace's self buff. Returns the health restored.
  clericHeal(cleric, ally, amount, events) {
    const got = this.healUnit(ally, amount, events, { aura: false, by: cleric });
    const G = cleric.def.passive && cleric.def.passive.grace;
    if (G && G.selfBuff && ally !== cleric && got > 0) this.applyStatus(cleric, { status: 'buff', durationMs: G.selfBuff.durationMs, mods: G.selfBuff.mods }, cleric, 'grace', events);
    return got;
  },

  // HOLY NOVA (skill `holyNova: { heal, radius, damageMultiplier, healSharePercent }`): heals the most hurt hero, and
  // every enemy within `radius` of THAT hero takes holy damage = damageMultiplier + healSharePercent% of the heal (so it
  // grows with her healing). No on-hit items.
  holyNova(hero, skill, slotId, ally, events) {
    const N = skill.holyNova;
    if (!ally) return;
    const raw = this.healAmount(hero, ally, N.heal) * this.regenAura().factor;
    this.clericHeal(hero, ally, raw, events);
    const zone = { shape: 'circle', x: ally.x, y: ally.y, radius: N.radius, ySquash: 0.7 };
    const foes = this.enemies.filter((e) => e.alive && (!this.hasPositions(e) || !this.hasPositions(ally) || this.inZone(e, zone)));
    events.push({ type: 'wave', unit: hero, skill, wave: 0, waves: 1, targets: foes, zone: this.hasPositions(ally) ? zone : null });
    const mult = N.damageMultiplier + ((N.healSharePercent / 100) * raw) / Math.max(1, hero.stats.attack);
    for (const e of foes) this.skillHit(hero, { damageType: skill.damageType, damageMultiplier: mult }, slotId, e, events);
  },

  // Berserker's BLOODTHIRST (passive.bloodthirst): below `belowPercent` health he gets +`attackPercent`% attack and
  // x`lifestealMultiplier` lifesteal (`hero.thirst`, statUpkeep / afterHit); it LINGERS `lingerMs` after he heals back
  // above, so lifesteal does not switch it off at once.
  tickBloodthirst(hero, dt, events) {
    const B = hero.def.passive && hero.def.passive.bloodthirst;
    if (!B) return;
    if (hero.hp < (hero.maxHp * B.belowPercent) / 100) hero.thirstLinger = B.lingerMs;
    else if (hero.thirstLinger > 0) hero.thirstLinger -= dt;
    const on = hero.thirstLinger > 0;
    if (on === !!hero.thirst) return;
    hero.thirst = on;
    if (on) events.push({ type: 'proc', unit: hero, label: 'Bloodthirst!' });
    this.refreshStats();
  },

  // Bard v3: a song plays only `songs.durationMs`, then stops (no song until the next Change Song).
  tickSong(hero, dt, events) {
    if (!hero.song || !hero.songLeft) return;
    hero.songLeft -= dt;
    if (hero.songLeft > 0) return;
    hero.songLeft = 0;
    hero.song = null;
    events.push({ type: 'song', unit: hero, song: null });
    this.refreshStats();
  },

  // MARCH (`songs.march.procChancePercent`): item procs of the squad are likelier while it plays.
  marchProcs() {
    let p = 0;
    for (const b of this.bards()) if (b.song === 'march') p += b.def.passive.songs.march.procChancePercent || 0;
    return 1 + p / 100;
  },

  // BALLAD (`songs.ballad.healPercent`): item healing (heals, lifesteal, item regen) is stronger while it plays.
  balladHeal() {
    let p = 0;
    for (const b of this.bards()) if (b.song === 'ballad') p += b.def.passive.songs.ballad.healPercent || 0;
    return 1 + p / 100;
  },

  // Bard's HYMN (`passive.hymn.squadItemMultiplier`): squad items (items.json type 'squad') work this much
  // stronger while he lives (computeHeroStats scales their effects).
  squadItemMult() {
    let m = 1;
    for (const h of this.heroes) if (h.alive && h.def.passive && h.def.passive.hymn) m *= h.def.passive.hymn.squadItemMultiplier;
    return m;
  },

  // Bard's LUTE (`passive.lute`): every `everyMs` of a floor's fight he plays a random boost for the whole squad.
  tickLute(hero, dt, events) {
    const L = hero.def.passive && hero.def.passive.lute;
    if (!L) return;
    hero.floor.lute = (hero.floor.lute || 0) + dt;
    if (hero.floor.lute < L.everyMs) return;
    hero.floor.lute -= L.everyMs;
    const boost = L.boosts[Math.floor(this.rng() * L.boosts.length)];
    events.push({ type: 'lute', unit: hero, boost: boost.name, color: boost.color });
    for (const u of this.squadUnits()) {
      if (boost.mods) this.applyStatus(u, { status: 'buff', durationMs: L.durationMs, mods: boost.mods }, hero, 'lute', events);
      if (boost.regenPercentPerSec) this.applyStatus(u, { status: 'regenBoost', durationMs: L.durationMs, percentMaxHpPerSec: boost.regenPercentPerSec }, hero, 'lute', events);
    }
  },

  // Mage's REACTIONS (passive.reactions, while the Mage lives): a fire / ice / electric hit leaves that element
  // on the enemy (status 'element'); a DIFFERENT element on top reacts (and uses the mark up):
  //   fire + ice = steam (`steam` statuses: Blind), ice + electric = shatter (this hit +`shatterPercent`%),
  //   fire + electric = overload (`overload`: a fire burst on the enemies around it).
  // Returns { damagePercent, overload } for the hit that is about to land.
  reaction(attacker, target, type, events) {
    const out = { damagePercent: 0, overload: null };
    // Arcane Ward's TEAM ELEMENTS (`teamElements`): for a while every squad hit that has no element leaves a random one.
    if (attacker.side === 'hero' && this.teamElementsMs > 0 && !['fire', 'ice', 'electric'].includes(type)) type = ['fire', 'ice', 'electric'][Math.floor(this.rng() * 3)];
    if (attacker.side !== 'hero' || target.side !== 'enemy' || !['fire', 'ice', 'electric'].includes(type)) return out;
    const mage = this.heroes.find((h) => h.alive && h.def.passive && h.def.passive.reactions);
    if (!mage) return out;
    const R = mage.def.passive.reactions;
    const mark = target.statuses.find((st) => st.type === 'element');
    if (mark && mark.element !== type) {
      target.statuses.splice(target.statuses.indexOf(mark), 1);
      events.push({ type: 'status', unit: target, change: 'expire', status: mark });
      const pair = [mark.element, type].sort().join('+');
      const kind = pair === 'fire+ice' ? 'steam' : pair === 'electric+ice' ? 'shatter' : 'overload';
      events.push({ type: 'reaction', unit: target, kind, attacker });
      if (kind === 'steam') for (const spec of R.steam) this.applyStatus(target, spec, mage, 'steam', events);
      if (kind === 'shatter') out.damagePercent = R.shatterPercent;
      if (kind === 'overload') out.overload = R.overload;
      return out;
    }
    if (mark) target.statuses.splice(target.statuses.indexOf(mark), 1);
    this.applyStatus(target, { status: 'element', durationMs: R.markMs }, mage, 'element', events);
    const st = target.statuses.find((x) => x.type === 'element');
    if (st) st.element = type;
    return out;
  },

  // Samurai's IAIDO (passive.iaido): every `every`th hit he takes is parried. A parried, blocked or dodged
  // hit is answered with a counter-cut (`counterMultiplier`, a basic melee hit: his on-hit items can go off).
  iaido(target) {
    return (target.def.passive && target.def.passive.iaido) || null;
  },

  // Riposte Cloak: the holder strikes back at whoever it dodged for `riposte`% (120, +60 per extra copy) of its attack,
  // whatever the distance (a ranged hero shoots back).
  riposte(hero, attacker, events) {
    if (!hero.alive || !attacker.alive || attacker.hp <= 0 || this.isStunned(hero)) return;
    events.push({ type: 'proc', unit: hero, label: 'Riposte!', itemId: 'riposte_cloak', target: attacker });
    this.strike(hero, attacker, events, { multiplier: hero.specials.riposte / 100, counter: true });
  },

  counterCut(samurai, attacker, events) {
    const ia = this.iaido(samurai);
    if (!ia || !samurai.alive || !attacker.alive || this.isStunned(samurai)) return;
    // Counter Stance (`parry` status): the parried hit is THROWN BACK, whatever the distance.
    const stance = this.has(samurai, 'parry');
    if (!stance && this.hasPositions(samurai) && this.hasPositions(attacker) && !this.inReach(samurai, attacker)) return; // too far to cut back
    events.push({ type: 'proc', unit: samurai, label: 'Counter!' });
    // v3 `counterCrit`: the counter-cut is a sure crit, so it uses his CRIT DAMAGE.
    const res = this.strike(samurai, attacker, events, { multiplier: ia.counterMultiplier, counter: true, critBonus: ia.counterCrit ? 100 : 0, ...(stance && !this.inReach(samurai, attacker) ? { projectile: 'crescent' } : {}), riders: true });
    this.rollProcs(samurai, 'onAttack', events, { target: attacker, hit: !res.dodged, folded: true });
  },

  // ---- passives that change over time or need a living hero --------------------------------------
  // Cleric: while she lives, every hero regenerates `baseRegenPercentPerSec` and regen/heals from items
  // are `healMultiplierPercent` stronger. Returns { base, factor }.
  regenAura() {
    let base = 0;
    let mult = 0;
    for (const h of this.heroes) {
      const a = h.alive && h.def.passive && h.def.passive.regenAura;
      if (!a) continue;
      base += a.baseRegenPercentPerSec;
      mult += a.healMultiplierPercent;
    }
    return { base, factor: (1 + mult / 100) * this.balladHeal() }; // Bard's Ballad: item heals stronger too
  },

  // Alchemist: while he lives, debuffs on enemies last longer and damage over time hits harder.
  catalyst() {
    let dur = 0;
    let dot = 0;
    for (const h of this.heroes) {
      const c = h.alive && h.def.passive && h.def.passive.catalyst;
      if (!c) continue;
      dur += c.durationPercent;
      dot += c.dotPercent;
    }
    return { dur: 1 + dur / 100, dot: 1 + dot / 100 };
  },

  // Martyr's Shield (Bodyguard): when an ally drops below `bodyguardBelow`% (30) health, a living holder off cooldown
  // guards them for `bodyguardMs` (3s, +1s per extra shield): EVERY enemy hit on that ally goes to the holder instead
  // (see strike). Cooldown `bodyguardCdMs` (20s). The ally shows the GUARD icon.
  tryBodyguard(ally, events) {
    for (const h of this.heroes) {
      const sp = h.specials;
      if (h === ally || !h.alive || !sp || !sp.bodyguardMs || (h.floor.guardCd || 0) > 0 || h.floor.guard) continue;
      if (ally.hp >= (ally.maxHp * (sp.bodyguardBelow || 30)) / 100) return;
      h.floor.guardCd = sp.bodyguardCdMs || 20000;
      h.floor.guard = { uid: ally.uid, remaining: sp.bodyguardMs };
      this.applyStatus(ally, { status: 'guarded', durationMs: sp.bodyguardMs }, h, 'bodyguard', events);
      events.push({ type: 'proc', unit: h, label: 'Bodyguard!', itemId: 'martyrs_shield', target: ally });
      return;
    }
  },

  // The living holder who is guarding `target` right now (Martyr's Shield), or null.
  martyrFor(target) {
    return this.heroes.find((h) => h !== target && h.alive && h.floor.guard && h.floor.guard.uid === target.uid) || null;
  },

  // Spite Mail: while the holder has a taunted enemy (it taunted one that still lives) he gets +defense, +resist and
  // heals `spiteHeal`% of max health per hit taken (session 32; the reflect is gone).
  tickTaunting(hero) {
    if (!hero.specials || !hero.specials.spiteMail) {
      if (hero.taunting) hero.taunting = false;
      return;
    }
    const now = this.enemies.some((e) => e.alive && this.tauntedBy(e) === hero);
    if (now !== hero.taunting) {
      hero.taunting = now;
      this.refreshStats();
    }
  },

  // Archer: after `afterMs` without being hit he gets attack speed and crit (hero.steady) until hit again.
  tickSteadyAim(hero, dt) {
    const sa = hero.def.passive && hero.def.passive.steadyAim;
    if (!sa) return;
    hero.sinceHit += dt;
    const steady = hero.sinceHit >= sa.afterMs;
    if (steady !== hero.steady) {
      hero.steady = steady;
      this.refreshStats();
    }
  },

  // ---- Opportunist (the Rogue's passive: def.passive.opportunist) ---------------------------------
  opportunist(unit) {
    return (unit.def.passive && unit.def.passive.opportunist) || null;
  },

  // Passives that make the unit's own chance-based debuffs likelier (Rogue's Opportunist, Samurai's Focused Strike).
  debuffBoost(unit) {
    const p = unit.def.passive;
    return (p && ((p.opportunist && p.opportunist.debuffChancePercent) || (p.focusedStrike && p.focusedStrike.debuffChancePercent))) || 0;
  },

  // Has the unit any harmful status (statuses.json `debuff: true`)?
  isDebuffed(unit) {
    return unit.statuses.some((st) => this.statusDefs[st.type] && this.statusDefs[st.type].debuff);
  },

  // The chance (in %) that one of the unit's own CHANCE-based debuffs goes off: the Rogue gets a bonus.
  debuffChance(unit, chance) {
    return chance * (1 + this.debuffBoost(unit) / 100);
  },

  // ---- "every Nth attack" counters (a hero def can have `counter`) ----------------------------------
  // counter: { id, label, color, every (4), scope: 'self' | 'squad', effect: 'empower' | 'heal',
  //   firedLabel, strike {damageMultiplier, damageType}, apply [status specs], forceProcs,
  //   heal { percentMaxHp, attackMultiplier } }.
  //  - scope 'self' counts the holder's own basic attacks, 'squad' counts the basic attacks of every
  //    living hero of the squad (not skills, not minions). A dead holder counts nothing.
  //  - The count is kept for the whole run (it does not reset between floors).
  //  - 'empower': when the count reaches `every` that attack also gets a free extra hit (`strike`) and
  //    debuffs (`apply`); `forceProcs` makes the attacker's on-hit item procs all go off.
  //  - 'heal': that attack heals the lowest-health ally instead of hitting. If nobody is hurt it hits
  //    normally and the counter stays charged until somebody is.
  // Returns the counters that fired on this attack ({ holder, counter }), and sends a `beat` event for
  // every counted attack (the scene shows the count).
  countBeats(unit, events, target = null) {
    const fired = [];
    if (unit.side !== 'hero' || unit.minion) return fired; // minions never count
    for (const holder of this.heroes) {
      const c = holder.def.counter;
      if (!c || !holder.alive) continue;
      if (c.scope === 'squad' ? false : holder !== unit) continue;
      if (holder.counterCount >= c.every) {
        // Already charged and waiting (a heal with nobody hurt): this attack tries again, no new count.
        if (c.effect === 'heal' && this.lowestHealthAlly()) {
          holder.counterCount = 0;
          fired.push({ holder, counter: c });
          events.push({ type: 'beat', unit, holder, counter: c, count: c.every, fired: true, target });
        }
        continue;
      }
      holder.counterCount++;
      const hit = holder.counterCount >= c.every;
      if (hit && c.effect === 'heal' && !this.lowestHealthAlly()) {
        events.push({ type: 'beat', unit, holder, counter: c, count: holder.counterCount, fired: false });
        continue; // charged, waiting for somebody to be hurt
      }
      if (hit) holder.counterCount = 0;
      const element = hit && c.rotation ? c.rotation[(holder.beatsFired || 0) % c.rotation.length] : null;
      if (element) holder.beatsFired = (holder.beatsFired || 0) + 1;
      if (hit) fired.push({ holder, counter: c, element });
      events.push({ type: 'beat', unit, holder, counter: c, count: hit ? c.every : holder.counterCount, fired: hit, target, color: element && element.color });
    }
    return fired;
  },

  // Heroes and minions that are alive: what squad-wide buffs and effects reach.
  squadUnits() {
    return [...this.heroes.filter((h) => h.alive), ...this.minions.filter((m) => m.alive)];
  },

  // Removes `count` debuffs from a unit: each one is a whole KIND (all stacks of poison, say), the oldest
  // first. Which statuses are debuffs: statuses.json `debuff: true`.
  cleanse(unit, count, events) {
    for (let i = 0; i < count; i++) {
      const bad = unit.statuses.find((st) => this.statusDefs[st.type] && this.statusDefs[st.type].debuff);
      if (!bad) return;
      const gone = unit.statuses.filter((st) => st.type === bad.type);
      unit.statuses = unit.statuses.filter((st) => st.type !== bad.type);
      if (this.statusDefs[bad.type].dot) delete unit.dotClocks[bad.type];
      for (const st of gone) events.push({ type: 'status', unit, change: 'expire', status: st });
      events.push({ type: 'proc', unit, label: 'Cleansed!' });
    }
  },

  // The living hero with the lowest health % that is actually hurt, or null.
  lowestHealthAlly() {
    let best = null;
    for (const h of this.heroes) {
      if (!h.alive || h.hp >= h.maxHp) continue;
      if (!best || h.hp / h.maxHp < best.hp / best.maxHp) best = h;
    }
    return best;
  },

  // The Cleric's beat: heal the most hurt ally (percentMaxHp of THEIR health + attackMultiplier x the
  // caster's attack). Returns false if nobody is hurt.
  fireHeal(holder, counter, events) {
    const ally = this.lowestHealthAlly();
    if (!ally) return false;
    const h = counter.heal || {};
    const amount = Math.max(1, Math.round(((h.percentMaxHp || 0) * ally.maxHp) / 100 + (h.attackMultiplier || 0) * holder.stats.attack));
    this.healUnit(ally, amount, events, { aura: false, by: holder });
    return true;
  },
};
