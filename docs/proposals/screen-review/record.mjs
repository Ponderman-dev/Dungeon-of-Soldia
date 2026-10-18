// Records the review clips of the real game (dev server on :5173) with Playwright, then trims each moment with ffmpeg.
// Usage: node record.mjs <outDir> [clipId...]   (needs playwright-core; see make.mjs for the page)
// Every clip runs in a fresh browser; `mark(id, ms)` starts a recorded moment, `still(id)` takes a layout screenshot.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2]);
const ONLY = process.argv.slice(3);
const B = 'http://localhost:5173/';
fs.mkdirSync(path.join(OUT, 'clips'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'raw'), { recursive: true });

const startBattle = (p) => p.evaluate(() => { const g = window.__game; g.scene.stop('Squad'); g.scene.start('Battle'); });
const battle = (p, fn, arg) => p.evaluate(([src, a]) => (0, eval)(`(${src})`)(window.__game.scene.getScene('Battle'), a), [fn.toString(), arg]);
const reward = (p, fn, arg) => p.evaluate(([src, a]) => (0, eval)(`(${src})`)(window.__game.scene.getScene('Reward'), a), [fn.toString(), arg]);
const squad = (p, fn, arg) => p.evaluate(([src, a]) => (0, eval)(`(${src})`)(window.__game.scene.getScene('Squad'), a), [fn.toString(), arg]);
// The centre of the n-th tappable zone of the reward sheet whose height is `h` (cards, hero rows, buttons).
const rewardZone = (p, h, n = 0) => reward(p, (rw, [hh, nn]) => { const z = rw.stepObjects.filter((o) => o.type === 'Zone' && Math.abs(o.height - hh) < 3)[nn]; return z ? { x: z.x, y: z.y + rw.sheet.y } : null; }, [h, n]);
const tap = async (p, pt) => { if (pt) await p.mouse.click(pt.x, pt.y); };
const winFloor = (p) => battle(p, (sc) => { for (const e of sc.state.enemies) { e.hp = 1; e.stats.defense = 0; } for (const h of sc.state.heroes) h.stats.attack = 99999; });
const wait = (p, ms) => p.waitForTimeout(ms);
// Starts the battle again until `cond(scene)` holds (a floor can roll a special room instead of the wanted fight).
const startUntil = async (p, cond) => {
  for (let i = 0; i < 8; i++) {
    await startBattle(p);
    await wait(p, 400);
    if (await battle(p, cond)) return;
  }
};

const CLIPS = {
  // ---------------- hero select
  squadOpen: async ({ p, mark, still }) => { mark('squad-open', 3600, 0); await wait(p, 3600); await still('squad'); },
  squadCard: async ({ p, mark, still }) => { await wait(p, 2600); mark('squad-card', 3600); await p.mouse.click(195, 330); await wait(p, 1400); await still('squad-card'); await p.mouse.click(348, 66); await wait(p, 2000); },
  squadSwap: async ({ p, mark }) => {
    await wait(p, 2600);
    mark('squad-sendback', 3200); await p.mouse.click(195, 404); await wait(p, 3200);
    const x = await squad(p, (s) => s.benchX(s.figures.get(s.slots.find((id) => !id) === undefined ? 'rogue' : 'rogue')));
    mark('squad-choose', 4200); await p.mouse.click(x, 660); await wait(p, 1100); await p.mouse.click(195, 788); await wait(p, 3100);
  },
  // Random and the bench first switch on 'unlock every hero' (bottom toggle), so there are heroes to pick and see.
  squadRandom: async ({ p, mark }) => { await wait(p, 2600); await p.mouse.click(195, 818); await wait(p, 600); mark('squad-random', 3600); await p.mouse.click(195, 773); await wait(p, 3600); },
  squadBench: async ({ p, mark }) => {
    await wait(p, 2600); await p.mouse.click(195, 818); await wait(p, 600); mark('squad-bench', 4200);
    await p.mouse.move(330, 650); await p.mouse.down(); for (let i = 0; i <= 20; i++) { await p.mouse.move(330 - i * 13, 650); await wait(p, 25); } await p.mouse.up();
    await wait(p, 900); await p.mouse.click(22, 658); await wait(p, 2200);
  },
  squadDescend: async ({ p, mark }) => { await wait(p, 2600); mark('squad-descend', 7600); await p.mouse.click(195, 96); await wait(p, 7600); },
  // ---------------- reward
  rewardFlow: async ({ p, mark, still }) => {
    await p.goto(B + '?floor=2'); await wait(p, 2500); await startBattle(p); await wait(p, 2800);
    mark('reward-up', 4600); await winFloor(p); await wait(p, 4600); await still('reward-pick');
    mark('reward-pick', 2600); await tap(p, await rewardZone(p, 136, 0) || await rewardZone(p, 150, 0)); await wait(p, 1600); await still('reward-who'); await wait(p, 1000);
    mark('reward-give', 9000); await tap(p, await rewardZone(p, 92, 0)); await wait(p, 700); await still('reward-who-picked'); await tap(p, await rewardZone(p, 52, 0)); await wait(p, 8300);
  },
  rewardBook: async ({ p, mark, still }) => {
    await p.goto(B + '?floor=3&room=dealer'); await wait(p, 2500); await startBattle(p); await wait(p, 5200);
    mark('reward-book', 9500); await battle(p, (sc) => sc.tapProp(sc.layer.room.props[0])); await wait(p, 2600); await still('book-pages');
    const page = await reward(p, (rw) => { const z = rw.stepObjects.filter((o) => o.type === 'Zone' && o.height >= 78 && o.width > 300)[0]; return z && { x: z.x, y: z.y }; });
    await tap(p, page); await wait(p, 1500); await still('book-skill');
    await tap(p, await rewardZone(p, 70, 0)); await wait(p, 900); await tap(p, await rewardZone(p, 52, 0)); await wait(p, 4500);
  },
  // ---------------- dungeon overlay
  fight: async ({ p, mark, still }) => { await p.goto(B + '?floor=6'); await wait(p, 2500); mark('fight-start', 8000); await startBattle(p); await wait(p, 4500); await still('fight'); await wait(p, 3500); },
  skills: async ({ p, mark }) => {
    await p.goto(B + '?floor=6'); await wait(p, 2500); await startBattle(p); await wait(p, 4200);
    mark('skill-attack', 5200); for (const x of [43, 173, 303]) { await p.mouse.click(x, 772); await wait(p, 900); } await wait(p, 2500);
    mark('skill-support', 4800); for (const x of [87, 217, 347]) { await p.mouse.click(x, 772); await wait(p, 800); } await wait(p, 2400);
  },
  orders: async ({ p, mark }) => {
    await p.goto(B + '?floor=6'); await wait(p, 2500); await startBattle(p); await wait(p, 4200);
    const pos = await battle(p, (sc) => ({ e: sc.state.enemies.filter((e) => e.alive).map((e) => ({ x: e.x, y: e.y - 20 })), h: sc.state.heroes.map((h) => ({ x: h.x, y: h.y - 30 })) }));
    mark('tap-focus', 2600); await p.mouse.click(pos.e[0].x, pos.e[0].y); await wait(p, 2600);
    const e = pos.e[pos.e.length - 1];
    mark('drag-order', 3200); await p.mouse.move(pos.h[0].x, pos.h[0].y); await p.mouse.down(); for (let i = 1; i <= 15; i++) { await p.mouse.move(pos.h[0].x + ((e.x - pos.h[0].x) * i) / 15, pos.h[0].y + ((e.y - pos.h[0].y) * i) / 15); await wait(p, 30); } await p.mouse.up(); await wait(p, 2700);
  },
  levelUp: async ({ p, mark }) => {
    await p.goto(B + '?floor=6'); await wait(p, 2500); await startBattle(p); await wait(p, 3500);
    mark('level-up', 3800); await battle(p, (sc) => { for (const h of sc.state.heroes) h.xp = 1e5; const e = sc.state.enemies.find((x) => x.alive); e.hp = 1; }); await wait(p, 3800);
  },
  floorWalk: async ({ p, mark }) => {
    await p.goto(B + '?floor=4'); await wait(p, 2500); await startBattle(p); await wait(p, 2800); await winFloor(p); await wait(p, 4200);
    await tap(p, await rewardZone(p, 136, 0) || await rewardZone(p, 150, 0)); await wait(p, 1200); await tap(p, await rewardZone(p, 92, 0)); await wait(p, 500);
    mark('floor-walk', 7000); await tap(p, await rewardZone(p, 52, 0)); await wait(p, 7000);
  },
  defeat: async ({ p, mark }) => {
    await p.goto(B + '?floor=6'); await wait(p, 2500); await startBattle(p); await wait(p, 3500);
    mark('defeat', 9000); await battle(p, (sc) => { for (const e of sc.state.enemies) e.stats.attack = 1e6; for (const h of sc.state.heroes) { h.hp = 1; h.stats.evasion = 0; } }); await wait(p, 9000);
  },
  boss: async ({ p, mark, still }) => { await p.goto(B + '?floor=20'); await wait(p, 2500); await startBattle(p); mark('boss-intro', 8000); await wait(p, 5000); await still('boss'); await wait(p, 3000); },
  elite: async ({ p, mark }) => { await p.goto(B + '?floor=12&elite=1'); await wait(p, 2500); await startUntil(p, (sc) => sc.state.enemies.some((e) => e.elite)); mark('elite', 6500); await wait(p, 6500); },
  house: async ({ p, mark, still }) => { await p.goto(B + '?floor=61&house=1'); await wait(p, 2500); await startUntil(p, (sc) => !!sc.state.monsterHouse); mark('monster-house', 7500);
    // A level-1 squad would die at once on floor 61: make the heroes tough for the clip.
    await battle(p, (sc) => { for (const h of sc.state.heroes) h.hp = h.maxHp = 1e7; }); await wait(p, 5500); await still('monster-house'); await wait(p, 2000); },
  treasure: async ({ p, mark, still }) => {
    await p.goto(B + '?floor=3&room=treasure'); await wait(p, 2500); mark('room-treasure', 10000); await startBattle(p); await wait(p, 5000); await still('room');
    await battle(p, (sc) => sc.tapProp(sc.layer.room.props[0])); await wait(p, 5000);
  },
  fountain: async ({ p, mark }) => { await p.goto(B + '?floor=3&room=fountain'); await wait(p, 2500); await startBattle(p); await wait(p, 5000); mark('room-fountain', 4000); await battle(p, (sc) => sc.tapProp(sc.layer.room.props[0])); await wait(p, 4000); },
  mimicRoom: async ({ p, mark }) => { await p.goto(B + '?floor=3&room=mimic'); await wait(p, 2500); await startBattle(p); await wait(p, 5000); mark('room-mimic', 6000); await battle(p, (sc) => sc.tapProp(sc.layer.room.props[0])); await wait(p, 6000); },
  puzzle: async ({ p, mark, still }) => {
    await p.goto(B + '?floor=3&room=puzzle&puzzle=mimic'); await wait(p, 2500); await startBattle(p); await wait(p, 5000);
    mark('puzzle-open', 9000); await battle(p, (sc) => sc.tapProp(sc.layer.room.props[0])); await wait(p, 9000); await still('puzzle');
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
  await p.goto(B);
  const mark = (id, ms, at = null) => marks.push({ id, ms, at: at ?? (Date.now() - t0) / 1000 });
  const still = (id) => p.screenshot({ path: path.join(OUT, 'stills', `${id}.png`) });
  try { await fn({ p, mark, still }); } catch (e) { errors.push(`${name}: ${e.message}`); }
  const video = p.video();
  await ctx.close();
  const raw = await video.path();
  for (const m of marks) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, m.at - 0.15)), '-i', raw, '-t', String(m.ms / 1000 + 0.3), '-vf', 'scale=390:844:flags=neighbor', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '30', '-preset', 'veryfast', '-movflags', '+faststart', '-an', path.join(OUT, 'clips', `${m.id}.mp4`)]);
    // A WebM copy too: browsers without H.264 (open-source Chromium builds) play this one.
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(OUT, 'clips', `${m.id}.mp4`), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-an', path.join(OUT, 'clips', `${m.id}.webm`)]);
  }
  fs.rmSync(raw);
  console.log(name, marks.map((m) => m.id).join(' '));
}
await browser.close();
console.log('errors', errors);
