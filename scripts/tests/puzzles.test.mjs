// Puzzle Room (systems/puzzles.js): the 5 puzzles the user kept. Every generated level must be solvable.
import fs from 'fs';
import BattleState from '../../src/systems/BattleState.js';
import { pickPuzzle, puzzleSettings, mimicPlan, runePlan, traceBeam, flipMirror, makeBeamLevel, slideKey, iceDistances, makeIceLevel, shufflePieces, swapPieces, pictureDone } from '../../src/systems/puzzles.js';
const r = (f) => JSON.parse(fs.readFileSync(new URL('../../src/data/' + f, import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const R = r('rooms.json').kinds.puzzle;

ok('the 5 kept puzzles, each with a name, a how-to and 3 depth tiers', R.puzzles.join() === 'mimic,runes,beam,ice,picture' && R.puzzles.every((k) => R.names[k] && R.howTo[k] && R.tiers[k].length === 3));
{ const seen = new Set(); for (let i = 0; i < 500; i++) seen.add(pickPuzzle(R)); ok('a room picks any of the 5', seen.size === 5); }
ok('deeper floors use harder tiers', puzzleSettings(R, 'ice', 4) === R.tiers.ice[0] && puzzleSettings(R, 'ice', R.tiers.ice[1].fromFloor) === R.tiers.ice[1] && puzzleSettings(R, 'ice', 400) === R.tiers.ice[2]);

// Mimic Shuffle
for (const P of R.tiers.mimic) { const m = mimicPlan(P);
  ok(`Mimic (${P.chests} chests): the coin is in one chest, ${P.swaps} swaps of two different chests`, m.treasure >= 0 && m.treasure < P.chests && m.swaps.length === P.swaps && m.swaps.every(([a, b]) => a !== b && a < P.chests && b < P.chests)); }
{ const s = new BattleState({ heroDefs: r('heroes.json').slice(0, 3), enemyDefs: r('enemies.json'), itemDefs: {}, skillDefs: r('skills.json'), statusDefs: r('statuses.json'), rules: r('combat.json'), damageTypes: r('damageTypes.json'), leveling: r('leveling.json') });
  const before = s.heroes.map((h) => h.hp); const bite = s.trapDamage(R.mimicBiteHealthPercent);
  ok(`...a wrong chest: a Mimic bites one hero for ${R.mimicBiteHealthPercent}% of max health`, bite && bite.amount === Math.round(bite.unit.maxHp * R.mimicBiteHealthPercent / 100) && s.heroes.filter((h, i) => h.hp < before[i]).length === 1);
  s.heroes.forEach((h) => (h.hp = 3)); s.trapDamage(R.mimicBiteHealthPercent); ok('...but never kills', s.heroes.every((h) => h.hp >= 1)); }

// Rune Lock
for (const P of R.tiers.runes) { const p = runePlan(P, R.runeGlyphs.length);
  ok(`Runes (${P.runes} runes): different glyphs on the door, a ${P.length}-long order`, new Set(p.runes).size === P.runes && p.sequence.length === P.length && p.sequence.every((v) => v >= 0 && v < P.runes)); }

// Mirror Beam: some way of turning the mirrors reaches the crystal; the start does not.
for (const P of R.tiers.beam) {
  let bad = 0, slow = 0;
  for (let i = 0; i < 30; i++) {
    const t0 = Date.now(); const made = makeBeamLevel(P); slow = Math.max(slow, Date.now() - t0);
    if (!made || traceBeam(made.level, made.ori).hit) { bad++; continue; }
    let solvable = false;
    for (let mask = 0; mask < 1 << P.mirrors && !solvable; mask++) solvable = traceBeam(made.level, made.level.mirrors.map((_, k) => ((mask >> k) & 1 ? '/' : '\\'))).hit;
    if (!solvable || made.bounces < P.minBounces) bad++;
  }
  ok(`Mirror Beam ${P.size}x${P.size}: always solvable, never solved at the start, ${P.minBounces}+ bounces`, bad === 0, `bad ${bad}, slowest ${slow}ms`);
}
{ const level = { n: 3, srow: 0, mirrors: [[2, 0]], pillars: [], crystal: '2,2' };
  ok('...a "\\\\" mirror turns the beam down into the crystal, "/" sends it up and out', traceBeam(level, ['\\']).hit && !traceBeam(level, ['/']).hit && flipMirror(['/'], 0)[0] === '\\'); }

// Ice Slide: the keyhole is reachable in exactly `par` moves, par fits the depth.
for (const P of R.tiers.ice) {
  let bad = 0;
  for (let i = 0; i < 40; i++) { const m = makeIceLevel(P); if (!m) { bad++; continue; } const d = iceDistances(m.level, m.start).get(m.goal.join(',')); if (d !== m.par || m.par < P.minMoves || m.par > P.minMoves + 1) bad++; }
  ok(`Ice Slide ${P.size}x${P.size}: always solvable, par ${P.minMoves}-${P.minMoves + 1} moves`, bad === 0, bad);
}
{ const level = { n: 4, rocks: ['3,0'] }; ok('...the key slides until a rock or the wall', slideKey(level, [0, 0], [1, 0]).join() === '2,0' && slideKey(level, [0, 0], [0, 1]).join() === '0,3'); }

// Picture Puzzle
for (const P of R.tiers.picture) { const n = P.grid * P.grid; const o = shufflePieces(n);
  ok(`Picture ${P.grid}x${P.grid}: every piece once, never already done`, o.length === n && new Set(o).size === n && !pictureDone(o)); }
{ ok('...swapping two pieces back finishes it', pictureDone(swapPieces([1, 0, 2, 3], 0, 1)) && !pictureDone(swapPieces([0, 1, 2, 3], 2, 3))); }
