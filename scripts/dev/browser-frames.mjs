// Dev helper (NOT part of the game): runs the built game in headless Chromium with a fake clock,
// fast-forwards, takes screenshots and prints console/page errors.
// Needs playwright-core, which is not a project dependency: `npm i playwright-core` in a scratch folder
// and run this file from there, or copy it there. Chromium is at /opt/pw-browsers/chromium-1194/chrome-linux/chrome.
// Usage: start `npx vite preview --port 4173` (or `npm run build` first), then
//   node browser-frames.mjs <msBeforeFirstShot> <numberOfShots> <msBetweenShots> [tapX tapY]
// Screenshots are written as frame0.png, frame1.png... in the current folder.
import { chromium } from 'playwright-core';
const [start = 2600, count = 4, gap = 150, tapX, tapY] = process.argv.slice(2).map(Number);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text()); }); // the favicon 404 is harmless
await p.clock.install();
await p.goto('http://localhost:4173/');
await p.clock.runFor(start);
if (tapX !== undefined) await p.mouse.click(tapX, tapY); // e.g. tap an enemy to focus it
for (let i = 0; i < count; i++) {
  await p.screenshot({ path: `frame${i}.png` });
  await p.clock.runFor(gap);
}
console.log('errors:', errs);
await b.close();
