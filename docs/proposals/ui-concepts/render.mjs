// Renders the UI concept mock-ups to PNG (2x). Usage: node docs/proposals/ui-concepts/render.mjs <out dir>
// mock.html = A Party Cards, B Clean Glass, C Retro Handheld; mock2.html = D JRPG Windows, E Dungeon Stone, F 16-bit Tactics.
// Each has ?v=<letter>-fight and ?v=<letter>-camp. field.png / campfield.png / hero-*.png / sk-*.png are crops of the real
// game (shots.mjs takes the screenshots from a dev server on :5190; the crops were cut from them by hand in python).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = fileURLToPath(new URL('.', import.meta.url)), out = process.argv[2] || here;
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
for (const [file, letters] of [['mock.html', 'ABC'], ['mock2.html', 'DEF']]) for (const l of letters) for (const s of ['fight', 'camp']) {
  await page.goto(`file://${here}${file}?v=${l}-${s}`); await page.waitForTimeout(400); await page.screenshot({ path: `${out}/m-${l}-${s}.png` });
}
await b.close();
