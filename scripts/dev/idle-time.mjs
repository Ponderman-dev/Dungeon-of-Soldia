// How long can a hero go WITHOUT attacking? Rules only (no screen), 20s fights, heroes and enemies cannot die.
import fs from 'fs';
const R = process.argv[2];
const { default: BattleState } = await import(R + '/src/systems/BattleState.js');
const { noPerks } = await import(R + '/scripts/tests/util.mjs');
const r = (f) => JSON.parse(fs.readFileSync(R + '/src/data/' + f));
const rules = r('combat.json'), L = rules.movement.layout;
let seed = 1; const rng = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const squads = { '3 melee (Knight, Berserker, Samurai)': ['knight', 'berserker', 'samurai'], 'mixed (Knight, Archer, Mage)': ['knight', 'archer', 'mage'] };
const lineups = { '3 enemies': ['goblin', 'bandit', 'slime'], '6 + archers behind': ['goblin', 'goblin', 'orcBrute', 'bandit', 'skeletonArcher', 'skeletonArcher'], 'crowd of 12': Array(12).fill('risen_skeleton') };
const scenarios = {
  'no taps': () => {},
  'focus the FARTHEST enemy': (s, t) => { if (t === 1000) { const h = s.heroes[0]; const far = s.enemies.filter((e) => e.alive).sort((a, b) => Math.hypot(b.x - h.x, b.y - h.y) - Math.hypot(a.x - h.x, a.y - h.y))[0]; s.setFocus(far.uid); } },
  'mis-tap floor every 4s, never corrected': (s, t) => { if (t % 4000 === 1000) s.moveSquad(30 + rng() * 330, 420 + rng() * 280); },
  'mis-tap floor every 4s, enemy tapped 0.4s later': (s, t) => { if (t % 4000 === 1000) s.moveSquad(30 + rng() * 330, 420 + rng() * 280); if (t % 4000 === 1400) s.setFocus(s.enemies.find((e) => e.alive).uid); },
};
console.log('longest time one hero spent NOT attacking (worst hero, worst of 5 fights), after the first contact');
for (const [sq, ids] of Object.entries(squads)) for (const [ln, enemyIds] of Object.entries(lineups)) {
  const row = [];
  for (const [sc, act] of Object.entries(scenarios)) {
    let worst = 0, walk = 0;
    for (let run = 0; run < 5; run++) {
      seed = 100 + run;
      const defs = noPerks(r('heroes.json')).filter((d) => ids.includes(d.id));
      const s = new BattleState({ heroDefs: defs, enemyDefs: r('enemies.json'), minionDefs: r('minions.json'), itemDefs: {}, statusDefs: r('statuses.json'), skillDefs: r('skills.json'), rules, damageTypes: r('damageTypes.json'), leveling: r('leveling.json'), rng });
      const es = s.spawnEnemies(enemyIds, 5);
      s.placeLines();
      const last = {}, first = {}; let gap = 0;
      for (let t = 0; t < 20000; t += 50) {
        for (const u of [...s.heroes, ...es]) { u.hp = u.maxHp = 1e7; u.alive = true; }
        act(s, t);
        for (const e of s.update(50)) if (e.type === 'attack' && e.attacker && e.attacker.side === 'hero' && !e.attacker.minion) { const id = e.attacker.uid; if (first[id] !== undefined) gap = Math.max(gap, t - last[id]); else first[id] = t; last[id] = t; }
        walk = Math.max(walk, ...s.heroes.map((h) => (h.walkTo ? rules.moveOrders.maxMs - h.walkTo.left : 0)));
      }
      for (const h of s.heroes) gap = Math.max(gap, first[h.uid] === undefined ? 20000 : 20000 - last[h.uid]);
      worst = Math.max(worst, gap);
    }
    row.push(`${sc}: ${(worst / 1000).toFixed(1)}s` + (sc.startsWith('mis-tap') ? ` (longest walk ${(walk / 1000).toFixed(1)}s)` : ''));
  }
  console.log(`\n${sq} vs ${ln}`); for (const x of row) console.log('   ' + x);
}
