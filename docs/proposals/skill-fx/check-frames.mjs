// Contact sheet of demo frames (for checking a hero's look without watching the page). Needs playwright-core (install
// it in the scratchpad, not the repo). Usage: SETS='[["skillId","new","B",[ms,ms,...]],...]' node check-frames.mjs <page.html> <out.png>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 900, height: 1000 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + process.argv[2]);
await p.waitForTimeout(800);
const out = await p.evaluate(async (SETS) => {
  const D = new window.SoldiaSkillDemo.Demo();
  const sets = SETS;
  const cv = document.createElement('canvas'); cv.width = 390*4; cv.height = 288*6; const g = cv.getContext('2d');
  let k = 0;
  for (const [skill, look, name, ts] of sets) for (const t of ts) {
    const c = document.createElement('canvas'); c.width = 390; c.height = 288;
    D.draw(c.getContext('2d'), { skill, look, name, t });
    g.drawImage(c, (k%4)*390, Math.floor(k/4)*288); g.fillStyle='#ff0'; g.font='12px monospace'; g.fillText(`${skill} ${look} t=${t}`, (k%4)*390+4, Math.floor(k/4)*288+284); k++;
  }
  return cv.toDataURL();
}, JSON.parse(process.env.SETS));
fs.writeFileSync(process.argv[3], Buffer.from(out.split(',')[1], 'base64'));
console.log('errors:', errs);
await b.close();
