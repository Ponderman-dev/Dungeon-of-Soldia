// Smoke run: start a fight on several floors, cast skills, drag orders, auto-pick rewards; report any page error.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const runs = [['floor=1', 45], ['floor=20', 40], ['floor=40', 30], ['floor=80', 30], ['floor=100', 30], ['floor=160', 30], ['floor=7&house=1', 30], ['floor=9&elite=1', 30], ['floor=5&room=treasure', 15], ['floor=5&room=fountain', 15], ['floor=5&room=puzzle', 15]];
const browser = await chromium.launch();
let bad = 0;
for (const [q, secs] of runs) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); });
  await page.goto('http://localhost:5190/?' + q);
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 20000 });
  await page.evaluate(() => { const g = window.__game; g.scene.stop('Title'); g.scene.start('Battle'); });
  let info = {};
  for (let t = 0; t < secs; t++) {
    await page.waitForTimeout(1000);
    info = await page.evaluate(() => {
      const g = window.__game, b = g.scene.getScene('Battle'), s = b && b.state;
      if (!s) return { none: true };
      // cast every ready skill, order hero 0 onto an enemy, and pick the first reward when the sheet is open
      try { for (const h of s.heroes) if (h.alive) for (const i of [0, 1]) if (s.canCast && s.canCast(h, i)) b.castFromUI(h.uid, i); } catch (e) { throw new Error('cast: ' + e.stack); }
      const foe = s.enemies.find((e) => e.alive); if (foe && s.heroes[0]) s.setOrder(s.heroes[0].uid, foe.uid);
      for (const h of s.heroes) { h.hp = h.maxHp; } // keep the squad alive so the run goes on
      const r = g.scene.getScene('Reward');
      return { floor: b.floor, enemies: s.enemies.filter((e) => e.alive).length, reward: g.scene.isActive('Reward'), active: g.scene.getScenes(true).map((x) => x.scene.key).join() };
    });
    if (info.reward) { // tap a card then the first hero
      for (const [x, y] of [[195, 300], [195, 430], [70, 760], [195, 700], [195, 780]]) { await page.mouse.click(x, y); await page.waitForTimeout(150); }
    }
  }
  console.log(q, JSON.stringify(info), errs.length ? 'ERRORS ' + errs.length : 'clean');
  for (const e of [...new Set(errs)].slice(0, 5)) console.log('   ', e);
  bad += errs.length;
  await page.close();
}
await browser.close();
console.log(bad ? 'SMOKE FAILED' : 'SMOKE OK');
