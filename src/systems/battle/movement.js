// Part of BattleState (mixed into its prototype at the bottom of ../BattleState.js; `this` is the BattleState).
// Positions, picking a target, taunt, reach and walking (docs/systems/movement.md).
import { partArt, artSize } from '../pixelArt.js';
import { enemySpots } from '../formation.js';

export const movementMethods = {
  // Puts a fighter at a spot (its feet). This is also its home spot (fear sends it back there).
  place(unit, x, y) {
    unit.x = unit.homeX = x;
    unit.y = unit.homeY = y;
    unit.moving = false;
    unit.knock = null;
  },

  // Places both lines like the battle screen does (combat.json `movement.layout`): heroes in a row at
  // the bottom, enemies in a row at the top, spread evenly. Used by tests and the balance bot.
  placeLines() {
    const L = this.rules.movement.layout;
    this.heroes.forEach((u, i) => this.place(u, (L.width * (i + 0.5)) / this.heroes.length, L.heroY));
    const spots = enemySpots(this.enemies, { width: L.width, y: L.enemyY, perRow: L.enemyPerRow, rowGap: L.enemyRowGap, spread: 'lane', room: { rowRoom: L.rowRoom, eliteRowRoom: L.eliteRowRoom, maxGap: L.enemyRowGapMax }, top: L.enemyY + L.topMarginY });
    this.enemies.forEach((u, i) => this.place(u, spots[i].x, spots[i].y));
  },

  hasPositions(unit) {
    return unit.x !== undefined;
  },

  // Where a unit stands across the screen, 0 (left) to 1 (right), from its slot in its line.
  lane(unit) {
    const line = unit.side === 'hero' ? this.heroes : this.enemies;
    return (line.indexOf(unit) + 0.5) / line.length;
  },

  // How far apart two units are (real distance if they have positions, else by lane).
  distance(a, b) {
    if (this.hasPositions(a) && this.hasPositions(b)) return Math.hypot(a.x - b.x, a.y - b.y);
    return Math.abs(this.lane(a) - this.lane(b));
  },

  // The unit in `list` standing closest (ties broken at random).
  nearest(unit, list) {
    let best = null;
    let bestDist = Infinity;
    for (const other of list) {
      const dist = this.distance(unit, other) + this.rng() * 0.001;
      if (dist < bestDist) {
        best = other;
        bestDist = dist;
      }
    }
    return best;
  },

  // Who a unit attacks next (basic attacks, and single-target skills with no tapped enemy).
  //  - Taunted: whoever taunted it.
  //  - Heroes: the tapped enemy if there is one. Melee heroes keep their opponent (`foe`) until it
  //    dies, then take the NEAREST enemy. Ranged heroes pick any enemy at random.
  //  - Melee enemies keep their opponent too, and a new one is always the NEAREST hero (melee or
  //    ranged). Ranged enemies pick at random. Ranged minions are picked less (`pickWeighted()`).
  pickTarget(unit) {
    // Charmed (Bard's Discord): an enemy attacks the nearest OTHER enemy instead.
    if (unit.side === 'enemy' && this.has(unit, 'charm')) {
      const others = this.enemies.filter((e) => e.alive && e !== unit);
      return others.length ? this.nearest(unit, others) : null;
    }
    const taunter = this.tauntedBy(unit);
    if (taunter) return taunter;
    const foes = (unit.side === 'hero' ? this.targetableEnemies() : this.defenders());
    if (!foes.length) return null;
    if (unit.side === 'hero' && !unit.minion) { // minions ignore tap focus and orders
      const order = this.orderOf(unit);
      if (order) return this.setFoe(unit, order); // its own drag order beats the squad's tap focus
      const focus = foes.find((e) => e.uid === this.focusUid);
      if (focus) return this.setFoe(unit, focus);
    }
    const enemy = unit.side === 'enemy';
    if (unit.damageType !== 'melee') return enemy ? this.pickWeighted(foes) : foes[Math.floor(this.rng() * foes.length)];
    const current = foes.find((u) => u.uid === unit.foe);
    if (current) return current;
    if (!enemy) return this.setFoe(unit, this.nearest(unit, foes));
    // A melee enemy with a ranged minion in its reach picks at random among everyone in reach (not always the minion).
    const close = this.hasPositions(unit) && foes.some((u) => this.backMinion(u) && this.inReach(unit, u)) ? foes.filter((u) => this.inReach(unit, u)) : [];
    if (close.length) return this.setFoe(unit, this.pickWeighted(close));
    return this.setFoe(unit, this.nearest(unit, this.frontDefenders()));
  },

  // Who a unit is taunted by: the most recent taunter that is still alive (an older taunt takes over
  // again when the newer taunter dies). null if it is not taunted. Taunt beats everything else.
  tauntedBy(unit) {
    for (const st of [...unit.statuses].reverse()) {
      if (st.type !== 'taunt') continue;
      const taunter = this.allUnits().find((u) => u.uid === st.sourceUid);
      if (taunter && taunter.alive && taunter.side !== unit.side) return taunter;
    }
    return null;
  },

  // A unit just got taunted while an attack of its was on the way to someone else: a melee swing is
  // dropped (it walks over to the taunter instead), an arrow bends towards the taunter.
  // A bait minion (Mimic, `def.bait`: { radius, durationMs }) deals no damage: on each of its attack turns it taunts every
  // enemy around it, so they hit it instead of the heroes (then it dies and explodes).
  baitTaunt(unit, events) {
    const { radius, durationMs } = unit.def.bait;
    for (const e of this.enemies) {
      if (!e.alive || (this.hasPositions(e) && this.hasPositions(unit) && this.distance(e, unit) > radius)) continue;
      this.applyStatus(e, { status: 'taunt', durationMs }, unit, `bait_${unit.uid}`, events);
    }
  },

  redirectToTaunter(unit, events) {
    const taunter = this.tauntedBy(unit);
    if (!taunter || !unit.pending || unit.pending.target === taunter) return;
    if (unit.damageType === 'melee') {
      unit.pending = null;
      unit.timer = this.interval(unit); // ready again as soon as it reaches the taunter
      events.push({ type: 'attackCancel', unit, reason: 'taunted' });
    } else {
      unit.pending.target = taunter;
      events.push({ type: 'attackRetarget', attacker: unit, target: taunter, hitInMs: unit.pending.remaining });
    }
  },

  setFoe(unit, foe) {
    unit.foe = foe ? foe.uid : null;
    return foe;
  },

  // A melee unit is close enough to hit: inside an oval around the target (`reachX` sideways, `reachY`
  // up/down, a little more up/down because the fighters are tall). Without positions: always.
  inReach(unit, target) {
    if (!this.hasPositions(unit) || !this.hasPositions(target)) return true;
    const M = this.rules.movement;
    // A big target can be hit from its edge, and a big attacker swings from its own edge (bug: a boss walked into
    // the hero's middle, got pushed out, walked back in: overlapping and jittering).
    const big = (target.size || 1) + (unit.size || 1) - 2;
    const dx = (target.x - unit.x) / (M.reachX * (1 + big * 0.5));
    const dy = (target.y - unit.y) / (M.reachY * (1 + big * 0.3));
    return dx * dx + dy * dy <= 1;
  },

  // How big a fighter's body is compared with a hero (1): its sprite width (without the weapon) on screen
  // divided by movement.normalBodyPx, never below 1.
  bodySize(def) {
    const M = this.rules.movement;
    if (!M || !M.normalBodyPx || !def.parts) return 1;
    let x0 = Infinity, x1 = -Infinity;
    for (const [name, p] of Object.entries(def.parts)) {
      if (name === 'weapon') continue;
      const { w } = artSize(partArt(p));
      x0 = Math.min(x0, p.x - w / 2);
      x1 = Math.max(x1, p.x + w / 2);
    }
    if (!isFinite(x0)) return 1;
    return Math.max(1, ((x1 - x0) * (def.drawScale ?? 3)) / M.normalBodyPx);
  },

  // Everyone who can walks this update: melee fighters towards their target (until in reach), feared
  // ones back to their own spot, knocked-back ones get pushed. Then fighters that stand too close push
  // apart a little (`separateX/Y`), so a crowd spreads around a target instead of piling up.
  // Pushing is gentle: a fighter that is standing still (swinging, waiting, stunned) gives way much
  // less than one that is walking (`settledPushShare`), and near the side walls a fighter is hardly
  // pushed further towards the wall (`wallSoftPx`), so crowds do not slide into the walls.
  move(dt) {
    const M = this.rules.movement;
    if (!M) return;
    const units = this.allUnits().filter((u) => u.alive && this.hasPositions(u));
    const before = new Map(units.map((u) => [u, { x: u.x, y: u.y }]));
    const step = (M.walkSpeedPxPerSec * dt) / 1000;
    const walking = new Set();
    for (const u of units) {
      if (u.knock) {
        const t = Math.min(dt, u.knock.remaining);
        u.x += u.knock.vx * t;
        u.y += u.knock.vy * t;
        u.knock.remaining -= dt;
        if (u.knock.remaining <= 0) u.knock = null;
        continue;
      }
      if (this.isStunned(u) || u.pending || u.casting || u.bossCast || u.def.object || u.dust || u.burrowed) continue; // frozen in place, busy, an object, underground
      let goal = null;
      // A lit Kobold Sapper bomb is NOT avoided (user: it blocked walking and the bomb never hit): fighters keep going.
      if (u.walkTo && !this.has(u, 'fear')) {
        u.walkTo.left -= dt;
        const far = Math.hypot(u.walkTo.x - u.x, u.walkTo.y - u.y);
        if (far <= this.rules.moveOrders.arrivePx || u.walkTo.left <= 0) u.walkTo = null; // arrived (or stuck): back to fighting
      }
      if (this.has(u, 'fear')) goal = { x: u.homeX, y: u.homeY, stop: 0 };
      else if (u.walkTo) goal = { x: u.walkTo.x, y: u.walkTo.y }; // a move order (setMove)
      else if (u.damageType === 'melee') {
        const target = this.pickTarget(u);
        if (target && !this.inReach(u, target)) goal = { x: target.x, y: target.y };
      }
      if (!goal) continue;
      const dx = goal.x - u.x;
      const dy = goal.y - u.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.5) continue;
      const d = Math.min(step, len);
      u.x += (dx / len) * d;
      u.y += (dy / len) * d;
      u.speed = dt > 0 ? (d * 1000) / dt : 0;
      walking.add(u);
    }
    // Push apart. Ranged fighters hold their ground (only the other one moves).
    const push = (M.separatePushPerSec * dt) / 1000;
    const L = M.layout;
    const settled = M.settledPushShare ?? 1;
    const share = (u, other) => {
      if (u.def.object) return 0; // objects (War Drum, eggs) never budge
      if (u.minion !== other.minion) return u.minion ? 1 : 0; // minions always make way (they never block a hero or shove an enemy)
      if ((u.size || 1) >= (other.size || 1) * M.bigHoldRatio) return 0; // a big body (boss) is not shoved around by small ones
      if (u.damageType !== 'melee' && other.damageType === 'melee') return 0; // ranged hold their ground
      return walking.has(u) || u.knock ? 1 : settled;
    };
    // How much of a sideways push towards the nearest side wall a fighter still takes (1 far away, 0 at the wall).
    const wallFactor = (u, dirX) => {
      if (!M.wallSoftPx || !L) return 1;
      const room = dirX < 0 ? u.x - L.marginX : L.width - L.marginX - u.x;
      return Math.max(0, Math.min(1, room / M.wallSoftPx));
    };
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        const a = units[i];
        const b = units[j];
        const ghost = (m, o) => m.minion && !walking.has(m) && walking.has(o); // a minion standing still lets walkers pass through it
        if (ghost(a, b) || ghost(b, a)) continue;
        const k = ((a.size || 1) + (b.size || 1)) / 2; // big bodies (bosses) keep others further away
        const d = Math.hypot((b.x - a.x) / (M.separateX * k), (b.y - a.y) / (M.separateY * (1 + (k - 1) * 0.5))); // < 1 = too close
        if (d >= 1) continue;
        let nx = b.x - a.x;
        let ny = b.y - a.y;
        let len = Math.hypot(nx, ny);
        if (len < 0.01) {
          nx = a.uid < b.uid ? 1 : -1; // exactly on top of each other: split sideways
          ny = 0;
          len = 1;
        }
        const amount = Math.min(push, (1 - d) * M.separateX * k);
        let wa = share(a, b);
        let wb = share(b, a);
        if (wa + wb === 0) {
          if (a.def.object !== b.def.object) continue; // a boss next to its own object (eggs): neither budges
          wa = wb = 1;
        }
        // Two fighters both standing still only drift apart slowly (no jostling while they swing).
        const calm = wa < 1 && wb < 1 ? M.settledPairPush ?? 1 : 1;
        const fa = (amount * calm * wa) / (wa + wb);
        const fb = (amount * calm * wb) / (wa + wb);
        a.x -= (nx / len) * fa * wallFactor(a, -nx);
        a.y -= (ny / len) * fa;
        b.x += (nx / len) * fb * wallFactor(b, nx);
        b.y += (ny / len) * fb;
      }
    }
    for (const u of units) {
      u.x = Math.min(L.width - L.marginX, Math.max(L.marginX, u.x));
      u.y = Math.min(L.heroY, Math.max(L.enemyY + L.topMarginY, u.y));
      const b = before.get(u);
      const moved = Math.hypot(u.x - b.x, u.y - b.y);
      u.moving = moved > 0.05;
      if (!walking.has(u)) u.speed = 0; // its OWN walking pace (px/s); being shoved is not a step, so the scene doesn't hop it
      u.walked += moved;
    }
  },

  // A dash or leap skill (skills.json `staysAtImpact`: Defense Bash, Multistrike, Savage Leap) really moves the hero to
  // where it hits, and it stays there (user 2026-10-20: no walking back to its spot). How far is the skill's look
  // (combat.json skillFx): a dash goes the distance minus `stopPx`, between `minPx` and `maxPx`; a leap goes `share` of
  // the way, but never past the target's push-apart edge. Returns where it came from (the scene slides it over from
  // there), or null without positions.
  moveToImpact(hero, target, skillId) {
    const M = this.rules.movement, F = this.rules.skillFx || {};
    if (!M || !this.hasPositions(hero) || !this.hasPositions(target)) return null;
    const dash = F.dash && F.dash[skillId], leap = F.look && F.look[skillId] && F.look[skillId].leap;
    if (!dash && !leap) return null;
    const dx = target.x - hero.x, dy = target.y - hero.y, len = Math.hypot(dx, dy);
    if (len < 1) return null;
    let go = dash ? Math.min(dash.maxPx, Math.max(dash.minPx, len - dash.stopPx)) : len * leap.share;
    // Never into the target's body: stop at the push-apart edge (else he is slowly shoved back out = looks like going back).
    const ux = dx / len, uy = dy / len, k = ((hero.size || 1) + (target.size || 1)) / 2;
    const edge = 1 / Math.hypot(ux / (M.separateX * k), uy / (M.separateY * (1 + (k - 1) * 0.5)));
    go = Math.max(0, Math.min(go, len - edge - 1));
    const from = { x: hero.x, y: hero.y }, L = M.layout;
    hero.x = Math.min(L.width - L.marginX, Math.max(L.marginX, hero.x + ux * go));
    hero.y = Math.min(L.heroY, Math.max(L.enemyY + L.topMarginY, hero.y + uy * go));
    return from;
  },
};
