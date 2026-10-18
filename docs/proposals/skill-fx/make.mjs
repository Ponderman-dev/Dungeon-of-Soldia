// Builds the SKILL EFFECTS DEMO page: the Knight's two skills, today's look vs the new 3-beat look, and the two skill
// name styles (A cut-in bar, B floating name). Notes in the page's db, collection `notes`:
//   `name` {pick: 'A'|'B', text}, `look:defense_bash` / `look:challenge` {verdict: 'ok'|'change', text}, `general` {text}.
// Run: node docs/proposals/skill-fx/make.mjs <out.html>
import fs from 'node:fs';
import { execSync } from 'node:child_process';
execSync('npx vite build --config docs/proposals/skill-fx/vite.config.js', { cwd: new URL('../../../', import.meta.url), stdio: 'inherit' });
const bundle = fs.readFileSync(new URL('./dist/demo.js', import.meta.url), 'utf8').replaceAll('</script', '<\\/script');
const font = fs.readFileSync(new URL('../../../src/assets/fonts/press-start-2p.woff2', import.meta.url)).toString('base64');
const tpl = fs.readFileSync(new URL('./template.html', import.meta.url), 'utf8');
const out = tpl.replace('/*FONT*/', () => `data:font/woff2;base64,${font}`).replace('/*BUNDLE*/', () => bundle);
fs.writeFileSync(process.argv[2] || 'skill-fx-demo.html', out);
console.log('wrote', process.argv[2]);
