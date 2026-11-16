// Renders the UI concept mock-ups to PNG (2x). Usage: node docs/proposals/ui-concepts/render.mjs <out dir>
// mock.html = A Party Cards, B Clean Glass, C Retro Handheld; mock2.html = D JRPG Windows, E Dungeon Stone, F 16-bit Tactics;
// mock3.html = G Floating HUD, H Hotbar, I Arcade Bars, J Card Hand, K Side Rails. Optional 2nd argument = letters to render (e.g. GHIJK).
// Each has ?v=<letter>-fight and ?v=<letter>-camp. field.png / campfield.png / hero-*.png / sk-*.png are crops of the real
// game (shots.mjs takes the screenshots from a dev server on :5190; the crops were cut from them by hand in python).
// mock4.html = round 4 MINIMAL huds (L bigger buttons, M bottom dock, N ghost icons, O corners) over fight-now.png, ?v=L|M|N|O|now (not in this script).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = fileURLToPath(new URL('.', import.meta.url)), out = process.argv[2] || here;
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
for (const [file, letters] of [['mock.html', 'ABC'], ['mock2.html', 'DEF'], ['mock3.html', 'GHIJK']].filter(([, l]) => !process.argv[3] || [...process.argv[3]].some(c => l.includes(c)))) for (const l of letters) if (!process.argv[3] || process.argv[3].includes(l)) for (const s of ['fight', 'camp']) {
  await page.goto(`file://${here}${file}?v=${l}-${s}`); await page.waitForTimeout(400); await page.screenshot({ path: `${out}/m-${l}-${s}.png` });
}
await b.close();
