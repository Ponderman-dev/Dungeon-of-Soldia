// Builds the HIT + SHOT REVIEW (session 54), published over the Skill Effects page (same url: CLAUDE.md 'no new pages').
// Melee hits per hero weapon + shots per damage type: TODAY / A / B / C per row, the user picks one + a note, saved in the
// page's db, collection `hits` (doc = row id or 'general': {pick: 'today'|'A'|'B'|'C'|null, text}).
// Run: node docs/proposals/skill-fx/make-hits.mjs <out.html>
import fs from 'node:fs';
import { execSync } from 'node:child_process';
execSync('npx vite build --config docs/proposals/skill-fx/vite.hits.config.js', { cwd: new URL('../../../', import.meta.url), stdio: 'inherit' });
const bundle = fs.readFileSync(new URL('./dist-hits/hits.js', import.meta.url), 'utf8').replaceAll('</script', '<\\/script');
const font = fs.readFileSync(new URL('../../../src/assets/fonts/press-start-2p.woff2', import.meta.url)).toString('base64');
const tpl = fs.readFileSync(new URL('./hits.html', import.meta.url), 'utf8');
fs.writeFileSync(process.argv[2] || 'hits-page.html', tpl.replace('/*FONT*/', () => `data:font/woff2;base64,${font}`).replace('/*BUNDLE*/', () => bundle));
fs.rmSync(new URL('./dist-hits', import.meta.url), { recursive: true, force: true });
console.log('wrote', process.argv[2]);
