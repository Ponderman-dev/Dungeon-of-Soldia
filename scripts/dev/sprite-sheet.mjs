// Contact sheet of every character sprite in the game (heroes, enemies, bosses, minions) + simple style stats.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const R = process.argv[2], out = process.argv[3];
const j = (f) => JSON.parse(fs.readFileSync(`${R}/src/data/${f}`));
const heroes = j('heroes.json'), enemies = j('enemies.json'), minions = j('minions.json');
const hs = Array.isArray(heroes) ? heroes : heroes.heroes;
const groups = [
  ['HEROES', hs.map((h) => [h.name, h])],
  ['ENEMIES', Object.entries(enemies).filter(([k, v]) => !k.startsWith('_') && !v.boss).map(([k, v]) => [v.name || k, v])],
  ['BOSSES', Object.entries(enemies).filter(([k, v]) => !k.startsWith('_') && v.boss).map(([k, v]) => [v.name || k, v])],
  ['MINIONS', Object.entries(minions).filter(([k, v]) => !k.startsWith('_') && v.parts).map(([k, v]) => [v.name || k, v])],
];
const stats = [];
const DARK = (c) => { const n = Number(c); return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255) < 150; };
for (const [g, list] of groups) for (const [name, d] of list) {
  const cols = new Set(); let px = 0, edgeDark = 0, edge = 0, noArt = 0;
  for (const p of Object.values(d.parts || {})) {
    if (!p.art) { noArt++; continue; }
    const rows = p.art.rows;
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (ch === '.') return; px++; const c = p.art.palette[parseInt(ch, 36)]; cols.add(c);
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const q = rows[y + b]?.[x + a]; return q === undefined || q === '.'; });
      if (nb) { edge++; if (DARK(c)) edgeDark++; }
    }));
  }
  stats.push({ g, name, parts: Object.keys(d.parts || {}).length, noArt, colours: cols.size, outline: edge ? Math.round(100 * edgeDark / edge) : 0, scale: d.drawScale ?? '', height: d.height });
}
fs.writeFileSync(out.replace('.png', '.json'), JSON.stringify(stats));
console.log(stats.map((s) => `${s.g[0]} ${s.name.padEnd(18)} parts ${s.parts}${s.noArt ? ' (blocks ' + s.noArt + ')' : ''} colours ${String(s.colours).padStart(2)} dark-edge ${String(s.outline).padStart(3)}% h ${s.height} ${s.scale ? 'drawScale ' + s.scale : ''}`).join('\n'));
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
await page.setContent(`<body style="margin:0;background:#2b2a33"><canvas id=c></canvas></body>`);
await page.evaluate(({ groups }) => {
  const Z = 4, CW = 148, CH = 150, PER = 10;
  let rows = 0; for (const [, l] of groups) rows += Math.ceil(l.length / PER);
  const c = document.getElementById('c'); c.width = CW * PER; c.height = rows * CH + groups.length * 28;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#2b2a33'; x.fillRect(0, 0, c.width, c.height);
  let y0 = 0;
  for (const [g, list] of groups) {
    x.fillStyle = '#ffe7a8'; x.font = 'bold 16px monospace'; x.fillText(g, 8, y0 + 19); y0 += 28;
    list.forEach(([name, d], i) => {
      const cx = (i % PER) * CW + CW / 2, fy = y0 + Math.floor(i / PER) * CH + CH - 26;
      x.fillStyle = '#3a3945'; x.fillRect(cx - CW / 2 + 3, fy + 2, CW - 6, 2);
      const sc = Z * ((d.drawScale ?? 3) / 3);
      for (const p of Object.values(d.parts || {})) {
        if (!p.art) { x.fillStyle = '#' + String(p.color || '0xff00ff').slice(2); x.fillRect(cx + (p.x - p.w / 2) * sc, fy + (p.y - p.h / 2) * sc, p.w * sc, p.h * sc); continue; }
        const rows = p.art.rows, w = rows[0].length, h = rows.length;
        rows.forEach((r, yy) => [...r].forEach((ch, xx) => { if (ch === '.') return; x.fillStyle = '#' + String(p.art.palette[parseInt(ch, 36)]).slice(2).padStart(6, '0'); x.fillRect(Math.round(cx + (p.x - w / 2 + xx) * sc), Math.round(fy + (p.y - h / 2 + yy) * sc), Math.ceil(sc), Math.ceil(sc)); }));
      }
      x.fillStyle = '#c8c6d4'; x.font = '11px monospace'; x.textAlign = 'center'; x.fillText(name, cx, fy + 18); x.textAlign = 'left';
    });
    y0 += Math.ceil(list.length / PER) * CH;
  }
}, { groups });
await (await page.$('#c')).screenshot({ path: out }); await b.close();
