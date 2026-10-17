// Difficulty curve with the SMART player (scripts/tests/smartbot.mjs): every 3-hero squad plays whole runs with
// thoughtful item drafting, skill books and special rooms. Prints how deep runs go, the survival curve, where runs
// die, boss win rates, fight length and hero strength. Uses all CPU cores (one worker per core).
// Usage: node scripts/tests/curve.mjs [runsPerSquad=3] [smart|random] [key=value tweaks...]
//   tweaks change combat.json for this run only, e.g. hpPerStep=0.4 attackPerStep=0.6 speed=0.7 heal=25
import os from 'os';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { playRun, allSquads, seeded, DATA } from './smartbot.mjs';

function tweakRules(tweaks) {
  const rules = JSON.parse(JSON.stringify(DATA.rules));
  for (const [k, v] of Object.entries(tweaks)) {
    if (k === 'hpPerStep' || k === 'attackPerStep') rules.floorScaling[k] = v;
    else if (k === 'speed') rules.enemyAttackSpeedMultiplier = v;
    else if (k === 'heal') rules.winHealPercent = v;
  }
  return rules;
}

if (!isMainThread) {
  const { jobs, mode, tweaks } = workerData;
  const rules = tweakRules(tweaks);
  const res = jobs.map(([squad, seed]) => ({ squad, ...playRun(squad, { rng: seeded(seed), random: mode === 'random', rules }) }));
  parentPort.postMessage(res);
} else {
  const N = Number(process.argv[2] || 3), mode = process.argv[3] || 'smart';
  const tweaks = Object.fromEntries(process.argv.slice(4).map((a) => a.split('=')).map(([k, v]) => [k, Number(v)]));
  const jobs = [];
  allSquads().forEach((sq, i) => { for (let n = 0; n < N; n++) jobs.push([sq, 1000 + i * 97 + n * 7919]); });
  const cores = Math.max(1, os.cpus().length);
  const chunks = Array.from({ length: cores }, (_, c) => jobs.filter((_, j) => j % cores === c));
  const T0 = Date.now();
  const results = (await Promise.all(chunks.map((jobs) => new Promise((ok, bad) => { const w = new Worker(new URL(import.meta.url), { workerData: { jobs, mode, tweaks } }); w.on('message', ok); w.on('error', bad); })))).flat();
  const floors = results.map((x) => x.floor).sort((a, b) => a - b);
  const q = (p) => floors[Math.min(floors.length - 1, Math.floor(floors.length * p))];
  console.log(`${mode} player, ${results.length} runs (${N}/squad), ${((Date.now() - T0) / 1000).toFixed(0)}s, tweaks ${JSON.stringify(tweaks)}`);
  console.log(`floor reached: mean ${(floors.reduce((a, b) => a + b) / floors.length).toFixed(1)}  p10 ${q(0.1)}  p25 ${q(0.25)}  median ${q(0.5)}  p75 ${q(0.75)}  p90 ${q(0.9)}  max ${floors[floors.length - 1]}`);
  const alive = (f) => (100 * results.filter((x) => x.floor > f || (x.floor === f && !x.deaths.length)).length) / results.length;
  console.log('still alive after floor:', [5, 10, 15, 19, 20, 30, 39, 40, 50, 60, 80, 100, 120].map((f) => `${f}: ${alive(f).toFixed(0)}%`).join('  '));
  const band = {};
  for (const x of results) if (x.deaths.length) { const b = Math.floor((x.floor - 1) / 5) * 5 + 1; band[b] = (band[b] || 0) + 1; }
  console.log('deaths per 5 floors (% of all runs):', Object.keys(band).sort((a, b) => a - b).map((b) => `${b}-${+b + 4}: ${((100 * band[b]) / results.length).toFixed(1)}`).join('  '));
  const bt = {}, bw = {};
  for (const x of results) for (const [f, w] of Object.entries(x.bosses)) { bt[f] = (bt[f] || 0) + 1; if (w) bw[f] = (bw[f] || 0) + 1; }
  console.log('bosses (win % of squads that reached it):', Object.keys(bt).map((f) => `${f}: ${((100 * (bw[f] || 0)) / bt[f]).toFixed(0)}% of ${bt[f]}`).join('  '));
  const kill = {};
  for (const x of results) for (const d of x.deaths) kill[d] = (kill[d] || 0) + 1;
  console.log('top killers:', Object.entries(kill).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => `${k} ${n}`).join(', '));
  const fs = {}, fn = {};
  for (const x of results) for (const [f, ms] of Object.entries(x.fightMs)) { const b = Math.floor((f - 1) / 10) * 10 + 1; fs[b] = (fs[b] || 0) + ms; fn[b] = (fn[b] || 0) + 1; }
  console.log('avg fight seconds per 10 floors:', Object.keys(fs).sort((a, b) => a - b).filter((b) => fn[b] >= 10).map((b) => `${b}: ${(fs[b] / fn[b] / 1000).toFixed(1)}`).join('  '));
  const hf = {}, hn = {};
  for (const x of results) for (const id of x.squad) { hf[id] = (hf[id] || 0) + x.floor; hn[id] = (hn[id] || 0) + 1; }
  console.log('hero avg floor:', Object.keys(hf).map((id) => [id, hf[id] / hn[id]]).sort((a, b) => b[1] - a[1]).map(([id, v]) => `${id} ${v.toFixed(1)}`).join(', '));
  const rooms = {};
  for (const x of results) for (const [k, n] of Object.entries(x.rooms)) rooms[k] = (rooms[k] || 0) + n;
  console.log('rooms visited:', JSON.stringify(rooms), ' timeouts:', results.reduce((a, x) => a + (x.timeouts || 0), 0));
  const itemCount = {};
  for (const x of results) for (const [, id] of x.log) itemCount[id] = (itemCount[id] || 0) + 1;
  console.log('most picked items:', Object.entries(itemCount).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k} ${n}`).join(', '));
}
