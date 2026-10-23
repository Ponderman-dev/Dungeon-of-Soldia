// Records the real-fight clips of the NEW items for the ITEM REVIEW page (round 3): each new item going off in a fight
// (dev server), trimmed with ffmpeg. Usage: node record.mjs <outDir> [port=5177] [clipId...]  (global playwright, run vite
// from the scratchpad). Each clip: a floor-6 fight, the item given to a hero with its chance pushed up so it shows quickly.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2]);
const PORT = process.argv[3] || '5177';
const ONLY = process.argv.slice(4);
const B = `http://localhost:${PORT}/`;
for (const d of ['clips', 'raw', 'stills']) fs.mkdirSync(path.join(OUT, d), { recursive: true });

const wait = (p, ms) => p.waitForTimeout(ms);
const battle = (p, fn, arg) => p.evaluate(([src, a]) => (0, eval)(`(${src})`)(window.__game.scene.getScene('Battle'), a), [fn.toString(), arg]);
// A floor-6 fight (even floor + ?room= = always a fight) with the given squad and `?lineup=` enemies; waits for the walk-in.
async function fight(p, squad, floor = 6, lineup = 'risen_skeleton*10') {
  await p.goto(`${B}?floor=${floor}&room=treasure&lineup=${lineup}`); await wait(p, 2500);
  await p.evaluate((ids) => { const g = window.__game; for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.registry.set('squadIds', ids); g.scene.start('Battle'); }, squad);
  await wait(p, 3600);
}
// Gives items: { heroId: [itemId, ...] }; `tune` = { itemId: { effectIndex: { key: value } } } pushes chances up first.
// Heroes get lots of health (a level-1 hero on floor 6 against a crowd).
const setup = (p, give, tune = {}, extra = null) => battle(p, (sc, [give, tune, extra]) => {
  for (const [id, t] of Object.entries(tune)) for (const [i, kv] of Object.entries(t)) Object.assign(sc.state.itemDefs[id].effects[i], kv);
  for (const h of sc.state.heroes) for (const id of give[h.def.id] || []) sc.giveItem(id, h.uid);
  for (const h of sc.state.heroes) { h.maxHp = h.stats.health = 50000; h.hp = 50000; }
  if (extra) (0, eval)(`(${extra})`)(sc);
}, [give, tune, extra && extra.toString()]);
const tanky = (sc) => { for (const e of sc.state.enemies) e.hp = e.maxHp = e.stats.health = 1e6; };

// The visual display (user): ONE melee hero, the Knight, in a crowd of skeletons.
const K = ['knight'];
const CLIPS = {
  bombs: async ({ p, mark }) => {
    await fight(p, K);
    const c = { 0: { chance: 40 } };
    await setup(p, { knight: ['ice_bomb', 'electric_bomb', 'dark_bomb', 'poison_bombs'] }, { ice_bomb: c, electric_bomb: c, dark_bomb: c, poison_bombs: c }, tanky);
    await wait(p, 300); mark('bombs', 8000); await wait(p, 8000);
  },
  barrel: async ({ p, mark }) => {
    await fight(p, K);
    const c = { 0: { chance: 25 } };
    await setup(p, { knight: ['bombardiers_barrel', 'fire_bombs', 'ice_bomb', 'electric_bomb', 'dark_bomb', 'poison_bombs'] },
      { fire_bombs: c, ice_bomb: c, electric_bomb: c, dark_bomb: c, poison_bombs: c, bombardiers_barrel: { 1: { percent: 100 } } }, tanky);
    await wait(p, 300); mark('barrel', 8000); await wait(p, 8000);
  },
  lifeCrystal: async ({ p, mark }) => {
    await fight(p, K);
    await setup(p, { knight: ['life_crystal'] }, { life_crystal: { 0: { percent: 100, radius: 400 } } },
      (sc) => { for (const h of sc.state.heroes) h.hp = h.maxHp * 0.4; for (const e of sc.state.enemies) e.hp = Math.max(1, Math.round(e.maxHp * 0.3)); });
    await wait(p, 300); mark('life-crystal', 7000); await wait(p, 7000);
  },
  reaper: async ({ p, mark }) => {
    await fight(p, K);
    await setup(p, { knight: ['reapers_bell'] }, { reapers_bell: { 0: { percent: 40 } } },
      (sc) => { for (const e of sc.state.enemies) e.hp = Math.max(1, Math.round(e.maxHp * 0.5)); });
    await wait(p, 300); mark('reapers-bell', 7000); await wait(p, 7000);
  },
  demonHead: async ({ p, mark }) => {
    await fight(p, K);
    await setup(p, { knight: ['frozen_demon_head', 'frost_charm', 'chill_band'] }, { frozen_demon_head: { 2: { percent: 30 } } }, tanky);
    await wait(p, 300); mark('demon-head', 12000); await wait(p, 12000);
  },
  euclid: async ({ p, mark }) => {
    await fight(p, K);
    await setup(p, { knight: ['euclid_of_elements', 'frost_charm', 'storm_charm', 'magma_core'] }, { euclid_of_elements: { 0: { percent: 50 } } }, tanky);
    await wait(p, 300); mark('euclid', 8000); await wait(p, 8000);
  },
  blade: async ({ p, mark }) => {
    await fight(p, K);
    await setup(p, { knight: ['sharpest_blade'] }, { sharpest_blade: { 0: { percent: 35 } } }, tanky);
    await wait(p, 300); mark('sharpest-blade', 8000); await wait(p, 8000);
  },
  coil: async ({ p, mark }) => {
    await fight(p, K);
    await setup(p, { knight: ['kinetic_coil'] }, {}, (sc) => { for (const e of sc.state.enemies) e.hp = e.maxHp = e.stats.health = 1e6; const k = sc.state.heroes[0]; k.stats.evasion = 85; k.baseStats.evasion = 85; });
    await wait(p, 300); mark('kinetic-coil', 8000); await wait(p, 8000);
  },
  buckler: async ({ p, mark }) => {
    await fight(p, K);
    await setup(p, { knight: ['emergency_buckler'] }, {}, (sc) => { for (const e of sc.state.enemies) e.hp = Math.max(1, Math.round(e.maxHp * 0.3)); });
    await wait(p, 300); mark('emergency-buckler', 7000); await wait(p, 7000);
  },
  rally: async ({ p, mark }) => {
    await fight(p, K);
    await setup(p, { knight: ['rally_flag'] }, {}, (sc) => { for (const e of sc.state.enemies) e.hp = e.maxHp = e.stats.health = 1e6; const k = sc.state.heroes[0]; k.maxHp = k.stats.health = 400; k.hp = 125; });
    await wait(p, 300); mark('rally-flag', 6000); await wait(p, 6000);
  },
  strap: async ({ p, mark }) => {
    await fight(p, K);
    await setup(p, { knight: ['sweeping_strap'] }, {}, tanky);
    await wait(p, 300); mark('sweeping-strap', 7000); await wait(p, 7000);
  },
  mantle: async ({ p, mark }) => {
    await fight(p, K);
    await setup(p, { knight: ['frost_mantle'] }, { frost_mantle: { 0: { percent: 100 } } }, tanky);
    await wait(p, 300); mark('frost-mantle', 7000); await wait(p, 7000);
  },
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
for (const [name, fn] of Object.entries(CLIPS)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: path.join(OUT, 'raw'), size: { width: 390, height: 844 } } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  const t0 = Date.now();
  const marks = [];
  const mark = (id, ms) => marks.push({ id, ms, at: (Date.now() - t0) / 1000 });
  try { await fn({ p, mark }); } catch (e) { errors.push(`${name}: ${e.message}`); }
  for (const m of marks) await p.screenshot({ path: path.join(OUT, 'stills', `${m.id}.png`) });
  const video = p.video();
  await ctx.close();
  const raw = await video.path();
  for (const m of marks) {
    // Around the Knight and his crowd (320x400 of the 390x844 screen), scaled x3 with crisp pixels.
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, m.at - 0.1)), '-i', raw, '-t', String(m.ms / 1000 + 0.2), '-vf', 'crop=320:400:35:360,scale=960:1200:flags=neighbor', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', '-preset', 'veryfast', '-movflags', '+faststart', '-an', path.join(OUT, 'clips', `${m.id}.mp4`)]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(OUT, 'clips', `${m.id}.mp4`), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-an', path.join(OUT, 'clips', `${m.id}.webm`)]);
  }
  fs.rmSync(raw);
  console.log(name, marks.map((m) => m.id).join(' '));
}
await browser.close();
console.log('errors', errors);
