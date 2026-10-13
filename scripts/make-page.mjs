// Packs a built page into ONE html file, for publishing as a claude.ai page.
// Game:   npm run build && node scripts/make-page.mjs <output.html>
// Studio: vite build --config vite.studio.config.js && node scripts/make-page.mjs <output.html> dist-studio/studio.html
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'dist-page.html';
const builtHtml = process.argv[3]; // optional: a built page whose own markup is kept

// Keep the code from accidentally closing the script tag or opening an HTML comment.
const safe = (js) => js.replaceAll('</script', '<\\/script').replaceAll('<!--', '<\\!--');

let html;
if (builtHtml) {
  // Keep the page's head (title, fonts, styles) and body, with its script tag swapped for the code itself.
  const src = fs.readFileSync(builtHtml, 'utf8');
  const dir = path.dirname(builtHtml);
  const head = src.match(/<head>([\s\S]*)<\/head>/)[1].replace(/<meta[^>]*>\s*/g, '');
  let body = src.match(/<body>([\s\S]*)<\/body>/)[1];
  let scripts = '';
  const strip = (s) =>
    s.replace(/<script[^>]*src="\/?([^"]+)"[^>]*><\/script>\s*/g, (_, file) => {
      scripts += `<script type="module">\n${safe(fs.readFileSync(path.join(dir, file), 'utf8'))}\n</script>\n`;
      return '';
    });
  html = `<meta charset="utf-8">\n${strip(head).trim()}\n${strip(body).trim()}\n${scripts}`;
} else {
  const assets = 'dist/assets';
  const jsFiles = fs.readdirSync(assets).filter((f) => f.endsWith('.js'));
  if (jsFiles.length !== 1) throw new Error(`Expected 1 JS file in ${assets}, found ${jsFiles.length}`);
  const js = safe(fs.readFileSync(path.join(assets, jsFiles[0]), 'utf8'));

  html = `<meta charset="utf-8">
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
}
fs.writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
