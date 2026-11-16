// How much are fighters PUSHED around in a fight? Rules only (no screen), 30s fights, nobody can die.
// Usage: node scripts/dev/push-drift.mjs <repo path>
//   shoved  = px a fighter was moved while NOT walking itself (per fighter, per fight)
//   drift   = how far a fighter ended from the spot where it first stood still to fight (average / worst)
//   wall    = share of the time a fighter is squashed against a side wall
//   attacks = swings per hero / per enemy in the fight (pushing fixes must not stop anyone from fighting)
import fs from 'fs';
const R = process.argv[2] || '.';
const { default: BattleState } = await import(fs.realpathSync(R) + '/src/systems/BattleState.js');
const { noPerks } = await import(fs.realpathSync(R) + '/scripts/tests/util.mjs');
const r = (f) => JSON.parse(fs.readFileSync(R + '/src/data/' + f));
const rules = r('combat.json'), L = rules.movement.layout;
let seed = 1; const rng = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const squads = { '3 melee': ['knight', 'berserker', 'samurai'], 'mixed': ['knight', 'archer', 'mage'] };
const lineups = { '3 enemies': ['goblin', 'bandit', 'slime'], '6 enemies': ['goblin', 'goblin', 'orcBrute', 'bandit', 'skeletonArcher', 'skeletonArcher'], '8 melee': ['goblin', 'goblin', 'orcBrute', 'bandit', 'goblin', 'bandit', 'slime', 'slime'], 'crowd of 12': Array(12).fill('risen_skeleton') };
const RUNS = 6, MS = 30000, STEP = 20;
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('fight', 26) + pad('shoved px', 12) + pad('drift avg', 11) + pad('drift worst', 13) + pad('at wall', 9) + pad('hero swings', 13) + 'enemy swings');
for (const [sq, ids] of Object.entries(squads)) for (const [ln, enemyIds] of Object.entries(lineups)) {
  let shoved = 0, units = 0, driftSum = 0, driftMax = 0, wall = 0, ticks = 0, heroAtk = 0, enemyAtk = 0, heroes = 0, enemies = 0;
  for (let run = 0; run < RUNS; run++) {
    seed = 100 + run;
    const defs = noPerks(r('heroes.json')).filter((d) => ids.includes(d.id));
    const s = new BattleState({ heroDefs: defs, enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
    const es = s.spawnEnemies(enemyIds, 5);
    s.placeLines();
    const all = [...s.heroes, ...es];
    const last = new Map(), anchor = new Map();
    for (let t = 0; t < MS; t += STEP) {
      for (const u of all) { u.hp = u.maxHp = 1e7; u.alive = true; }
      for (const e of s.update(STEP)) if (e.type === 'attack' && e.attacker) { if (e.attacker.side === 'hero') heroAtk++; else enemyAtk++; }
      for (const u of all) {
        const p = last.get(u);
        if (p && !u.speed && !u.knock) shoved += Math.hypot(u.x - p.x, u.y - p.y);
        if (!anchor.has(u) && u.pending) anchor.set(u, { x: u.x, y: u.y }); // its first swing: 'this is where it fights'
        last.set(u, { x: u.x, y: u.y });
        ticks++;
        if (u.x <= L.marginX + 3 || u.x >= L.width - L.marginX - 3) wall++;
      }
    }
    for (const u of all) {
      units++;
      const a = anchor.get(u);
      if (a) { const d = Math.hypot(u.x - a.x, u.y - a.y); driftSum += d; driftMax = Math.max(driftMax, d); }
    }
    heroes += s.heroes.length; enemies += es.length;
  }
  console.log(pad(`${sq} vs ${ln}`, 26) + pad((shoved / units).toFixed(0), 12) + pad((driftSum / units).toFixed(0), 11) + pad(driftMax.toFixed(0), 13) + pad((100 * wall / ticks).toFixed(1) + '%', 9) + pad((heroAtk / heroes).toFixed(1), 13) + (enemyAtk / enemies).toFixed(1));
}
