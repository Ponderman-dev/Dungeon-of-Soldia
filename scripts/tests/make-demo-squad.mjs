// Makes src/data/demoSquad.json for the Monster House demo page (npm run build:house-demo): the smart player plays
// real runs with a squad until all 3 heroes are still alive after floor `floor - 1`, then saves those heroes as they
// are (level, items, skill pages). The demo starts on `floor` with them.
// node scripts/tests/make-demo-squad.mjs [floor=61] [squad, e.g. knight,rogue,archer; default: any squad]
import fs from 'fs';
import { playRun, seeded, allSquads } from './smartbot.mjs';
const floor = Number(process.argv[2] || 61);
const squads = process.argv[3] ? [process.argv[3].split(',')] : allSquads(); // a given squad, or any squad
for (let seed = 1; seed <= 2000; seed++) {
  const squad = squads[seed % squads.length];
  const out = playRun(squad, { rng: seeded(seed), maxFloor: floor - 1 });
  const s = out.state;
  if (out.deaths.length || !s.heroes.every((h) => h.alive)) continue;
  const heroes = s.heroes.map((h) => ({ id: h.def.id, level: h.level, items: h.items, pages: h.skills.map((k) => k.pages || []) }));
  fs.writeFileSync(new URL('../../src/data/demoSquad.json', import.meta.url), JSON.stringify({ _about: `Made by scripts/tests/make-demo-squad.mjs (smart player, seed ${seed}): the squad as it was after floor ${floor - 1}.`, floor, heroes }, null, 1) + '\n');
  console.log(`seed ${seed}:`, heroes.map((h) => `${h.id} Lv${h.level} ${h.items.length} items`).join(', '));
  process.exit(0);
}
console.log('no run made it');
