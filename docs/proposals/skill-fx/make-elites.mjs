// Builds the ELITE LOOK REVIEW (session 54), published over the Skill Effects page (same url: CLAUDE.md 'no new pages').
// Elite body colour per element + a sign per trait: TODAY / A / B / C per row, the user picks one + a note, saved in the
// page's db, collection `elites` (doc = row id or 'general': {pick: 'today'|'A'|'B'|'C'|null, text}).
// Run: node docs/proposals/skill-fx/make-elites.mjs <out.html>
import fs from 'node:fs';
import { execSync } from 'node:child_process';
execSync('npx vite build --config docs/proposals/skill-fx/vite.elites.config.js', { cwd: new URL('../../../', import.meta.url), stdio: 'inherit' });
const bundle = fs.readFileSync(new URL('./dist-elites/elites.js', import.meta.url), 'utf8').replaceAll('</script', '<\\/script');
const font = fs.readFileSync(new URL('../../../src/assets/fonts/press-start-2p.woff2', import.meta.url)).toString('base64');
const tpl = fs.readFileSync(new URL('./elites.html', import.meta.url), 'utf8');
fs.writeFileSync(process.argv[2] || 'elites-page.html', tpl.replace('/*FONT*/', () => `data:font/woff2;base64,${font}`).replace('/*BUNDLE*/', () => bundle));
fs.rmSync(new URL('./dist-elites', import.meta.url), { recursive: true, force: true });
console.log('wrote', process.argv[2]);
