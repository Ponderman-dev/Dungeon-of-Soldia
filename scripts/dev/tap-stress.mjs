// Tap stress test with REAL mouse events: fat-finger taps aimed at enemies, on many floors. What does each tap do?
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const floors = [1, 3, 6, 9, 13, 15, 18, 20, 25, 34, 40, 47, 55, 60, 70, 80, 95, 100, 120, 140];
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const b = await chromium.launch();
const tot = {};
const add = (k, r) => { tot[k] = tot[k] || { hit: 0, other: 0, move: 0, heroMove: 0, nothing: 0, n: 0 }; tot[k][r]++; tot[k].n++; };
const odd = [];
for (const f of floors) {
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://localhost:5190/?floor=' + f);
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'));
  await page.evaluate(() => { const g = window.__game; g.scene.stop('Title'); g.scene.start('Battle'); });
  try { await page.waitForFunction(() => { const s = window.__game.scene.getScene('Battle'); return s.mode === 'fighting' && s.state.enemies.some((e) => e.alive); }, null, { timeout: 30000 }); } catch (e) { console.log('floor', f, 'no fight'); await page.close(); continue; }
  await page.waitForTimeout(1500); // let the melee enemies walk into the heroes (the messy moment)
  for (const [label, radius] of [['new 70px', 70]]) for (const sigma of [12, 22, 32]) {
    for (let i = 0; i < 30; i++) {
      const aim = await page.evaluate((radius) => {
        const sc = window.__game.scene.getScene('Battle'), s = sc.state;
        s.rules.moveOrders.enemyTapRadiusPx = radius;
        for (const h of s.heroes) { h.hp = h.maxHp; h.walkTo = null; h.order = null; }
        for (const e of s.enemies) if (e.alive) e.hp = e.maxHp = 1e8;
        s.focusUid = null; sc.orderDrag = null;
        const es = s.enemies.filter((e) => e.alive && !s.untargetable(e) && sc.views.get(e.uid));
        if (!es.length) return null;
        const e = es[Math.floor(Math.random() * es.length)], c = sc.center(sc.views.get(e.uid));
        return { uid: e.uid, name: e.def.name, x: c.x, y: c.y };
      }, radius);
      if (!aim) break;
      const x = aim.x + gauss() * sigma, y = aim.y + gauss() * sigma;
      const cx = Math.max(2, Math.min(388, x)), cy = Math.max(2, Math.min(840, y));
      await page.mouse.move(cx, cy); await page.mouse.down(); await page.waitForTimeout(50); await page.mouse.up(); await page.waitForTimeout(70); // a real tap; the game handles input on its next frame
      const r = await page.evaluate((uid) => { const sc0 = window.__game.scene.getScene('Battle'); const s = sc0.state; if (sc0.mode !== 'fighting') return { skip: true }; const w = s.heroes.filter((h) => h.alive && h.walkTo).length; return { focus: s.focusUid, walking: w, alive: s.heroes.filter((h) => h.alive).length }; }, aim.uid);
      if (r.skip) break;
      const res = r.walking ? (r.walking >= r.alive && r.alive > 1 ? 'move' : r.walking === 1 && r.alive > 1 ? 'heroMove' : 'move') : r.focus === aim.uid ? 'hit' : r.focus ? 'other' : 'nothing';
      add(`${label}, finger error ~${sigma}px`, res);
      if (label.startsWith('new') && (res === 'move' || res === 'heroMove' || res === 'nothing') && odd.length < 25) odd.push({ f, res, enemy: aim.name, off: [Math.round(x - aim.x), Math.round(y - aim.y)], at: [Math.round(x), Math.round(y)] });
    }
  }
  if (errs.length) console.log('floor', f, 'ERRORS', errs.slice(0, 2));
  await page.close();
}
await b.close();
for (const [k, t] of Object.entries(tot)) console.log(k.padEnd(34), `taps ${t.n}`, `| right enemy ${(100 * t.hit / t.n).toFixed(1)}%`, `| another enemy ${(100 * t.other / t.n).toFixed(1)}%`, `| SQUAD WALKS ${(100 * t.move / t.n).toFixed(1)}%`, `| one hero walks ${(100 * t.heroMove / t.n).toFixed(1)}%`, `| nothing ${(100 * t.nothing / t.n).toFixed(1)}%`);
console.log('odd cases with the new circle:'); for (const o of odd) console.log(' ', JSON.stringify(o));
