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
// A floor-6 fight (even floor + ?room= = always a fight) with the given squad; waits for the walk-in.
async function fight(p, squad, floor = 6) {
  await p.goto(`${B}?floor=${floor}&room=treasure`); await wait(p, 2500);
  await p.evaluate((ids) => { const g = window.__game; for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.registry.set('squadIds', ids); g.scene.start('Battle'); }, squad);
  await wait(p, 3200);
}
// Gives items: { heroId: [itemId, ...] }; `tune` = { itemId: { effectIndex: { key: value } } } pushes chances up first.
// Heroes get lots of health (a level-1 squad on floor 6) unless `fragile`.
const setup = (p, give, tune = {}, extra = null) => battle(p, (sc, [give, tune, extra]) => {
  for (const [id, t] of Object.entries(tune)) for (const [i, kv] of Object.entries(t)) Object.assign(sc.state.itemDefs[id].effects[i], kv);
  for (const h of sc.state.heroes) for (const id of give[h.def.id] || []) sc.giveItem(id, h.uid);
  for (const h of sc.state.heroes) { h.maxHp = h.stats.health = 50000; h.hp = 50000; }
  if (extra) (0, eval)(`(${extra})`)(sc);
}, [give, tune, extra && extra.toString()]);
const tanky = (sc) => { for (const e of sc.state.enemies) e.hp = e.maxHp = e.stats.health = 1e6; };
const fragile = (sc) => { for (const e of sc.state.enemies) { e.hp = Math.max(1, Math.round(e.maxHp * 0.15)); } };

const CLIPS = {
  bombs: async ({ p, mark }) => {
    await fight(p, ['knight', 'rogue', 'archer']);
    const c = { 0: { chance: 45 } };
    await setup(p, { knight: ['ice_bomb'], rogue: ['electric_bomb', 'dark_bomb'], archer: ['poison_bombs'] }, { ice_bomb: c, electric_bomb: c, dark_bomb: c, poison_bombs: c }, tanky);
    await wait(p, 400); mark('bombs', 8000); await wait(p, 8000);
  },
  barrel: async ({ p, mark }) => {
    await fight(p, ['knight', 'rogue', 'archer']);
    const c = { 0: { chance: 25 } };
    await setup(p, { archer: ['bombardiers_barrel', 'fire_bombs', 'ice_bomb', 'electric_bomb', 'dark_bomb', 'poison_bombs'] },
      { fire_bombs: c, ice_bomb: c, electric_bomb: c, dark_bomb: c, poison_bombs: c, bombardiers_barrel: { 1: { percent: 100 } } }, tanky);
    await wait(p, 400); mark('barrel', 8000); await wait(p, 8000);
  },
  lifeCrystal: async ({ p, mark }) => {
    await fight(p, ['knight', 'rogue', 'archer']);
    await setup(p, { knight: ['life_crystal'], rogue: ['life_crystal'] }, { life_crystal: { 0: { percent: 100, radius: 400 } } },
      (sc) => { for (const h of sc.state.heroes) h.hp = h.maxHp * 0.4; for (const e of sc.state.enemies) e.hp = Math.max(1, Math.round(e.maxHp * 0.2)); });
    await wait(p, 300); mark('life-crystal', 3600); await wait(p, 3600);
  },
  reaper: async ({ p, mark }) => {
    await fight(p, ['knight', 'rogue', 'archer'], 8);
    await setup(p, { knight: ['reapers_bell'], rogue: ['reapers_bell'], archer: ['reapers_bell'] }, { reapers_bell: { 0: { percent: 60, radius: 160 } } },
      (sc) => { for (const e of sc.state.enemies) e.hp = Math.max(1, Math.round(e.maxHp * 0.3)); });
    await wait(p, 300); mark('reapers-bell', 3600); await wait(p, 3600);
  },
  demonHead: async ({ p, mark }) => {
    await fight(p, ['knight', 'mage', 'archer']);
    await setup(p, { mage: ['frozen_demon_head', 'frost_charm', 'chill_band'] }, { frozen_demon_head: { 2: { percent: 150 } } }, tanky);
    await wait(p, 300); mark('demon-head', 12000); await wait(p, 12000);
  },
  euclid: async ({ p, mark }) => {
    await fight(p, ['knight', 'rogue', 'archer']);
    await setup(p, { archer: ['euclid_of_elements', 'frost_charm', 'storm_charm'], knight: ['euclid_of_elements', 'shadow_charm', 'magma_core'] }, { euclid_of_elements: { 0: { percent: 35 } } }, tanky);
    await wait(p, 300); mark('euclid', 8000); await wait(p, 8000);
  },
  blade: async ({ p, mark }) => {
    await fight(p, ['knight', 'rogue', 'samurai']);
    await setup(p, { knight: ['sharpest_blade'], rogue: ['sharpest_blade'], samurai: ['sharpest_blade'] }, { sharpest_blade: { 0: { percent: 30 } } }, tanky);
    await wait(p, 300); mark('sharpest-blade', 8000); await wait(p, 8000);
  },
  coil: async ({ p, mark }) => {
    await fight(p, ['rogue', 'knight', 'archer']);
    await setup(p, { rogue: ['kinetic_coil'] }, {}, (sc) => { for (const e of sc.state.enemies) e.hp = e.maxHp = e.stats.health = 1e6; const r = sc.state.heroes.find((h) => h.def.id === 'rogue'); r.stats.evasion = 85; r.baseStats.evasion = 85; });
    await wait(p, 300); mark('kinetic-coil', 8000); await wait(p, 8000);
  },
  buckler: async ({ p, mark }) => {
    await fight(p, ['knight', 'rogue', 'archer']);
    await setup(p, { knight: ['emergency_buckler'], rogue: ['emergency_buckler'], archer: ['emergency_buckler'] }, { emergency_buckler: { 0: { percent: 30 } } },
      (sc) => { for (const e of sc.state.enemies) e.hp = Math.max(1, Math.round(e.maxHp * 0.25)); });
    await wait(p, 300); mark('emergency-buckler', 4200); await wait(p, 4200);
  },
  rally: async ({ p, mark }) => {
    await fight(p, ['knight', 'rogue', 'archer']);
    await setup(p, { archer: ['rally_flag'] }, {}, (sc) => { for (const e of sc.state.enemies) e.hp = e.maxHp = e.stats.health = 1e6; for (const h of sc.state.heroes) { h.maxHp = h.stats.health = 400; h.hp = 400; } const k = sc.state.heroes[0]; k.hp = 125; for (const e of sc.state.enemies) e.stats.attack *= 3; });
    await wait(p, 300); mark('rally-flag', 6000); await wait(p, 6000);
  },
  strap: async ({ p, mark }) => {
    await fight(p, ['knight', 'samurai', 'archer']);
    await setup(p, { knight: ['sweeping_strap'], samurai: ['sweeping_strap'] }, { sweeping_strap: { 0: { radius: 90 } } }, tanky);
    await wait(p, 300); mark('sweeping-strap', 7000); await wait(p, 7000);
  },
  mantle: async ({ p, mark }) => {
    await fight(p, ['knight', 'rogue', 'archer']);
    await setup(p, { knight: ['frost_mantle'], rogue: ['frost_mantle'] }, { frost_mantle: { 0: { percent: 100 } } }, tanky);
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
    // The fight area only (top 600px of the 390x844 screen), scaled x2 with crisp pixels.
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, m.at - 0.1)), '-i', raw, '-t', String(m.ms / 1000 + 0.2), '-vf', 'crop=390:600:0:120,scale=780:1200:flags=neighbor', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', '-preset', 'veryfast', '-movflags', '+faststart', '-an', path.join(OUT, 'clips', `${m.id}.mp4`)]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(OUT, 'clips', `${m.id}.mp4`), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-an', path.join(OUT, 'clips', `${m.id}.webm`)]);
  }
  fs.rmSync(raw);
  console.log(name, marks.map((m) => m.id).join(' '));
}
await browser.close();
console.log('errors', errors);
