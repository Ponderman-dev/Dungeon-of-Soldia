// Packs the built game into ONE html file, for publishing as a claude.ai page.
// Usage: npm run build && node scripts/make-page.mjs <output.html>
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'dist-page.html';
const assets = 'dist/assets';
const jsFiles = fs.readdirSync(assets).filter((f) => f.endsWith('.js'));
if (jsFiles.length !== 1) throw new Error(`Expected 1 JS file in ${assets}, found ${jsFiles.length}`);

// Keep the code from accidentally closing the script tag or opening an HTML comment.
const js = fs
  .readFileSync(path.join(assets, jsFiles[0]), 'utf8')
  .replaceAll('</script', '<\\/script')
  .replaceAll('<!--', '<\\!--');

const html = `<meta charset="utf-8">
<title>Dungeon of Soldia</title>
<style>
  :root { color-scheme: dark; }
  html, body { height: 100%; margin: 0; overflow: hidden; background: #000; }
  #game { width: 100%; height: 100%; }
  canvas { image-rendering: pixelated; touch-action: none; }
</style>
<div id="game"></div>
<script type="module">
${js}
</script>
`;
fs.writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
