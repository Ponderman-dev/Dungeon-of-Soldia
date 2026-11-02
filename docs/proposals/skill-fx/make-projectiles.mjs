// Builds the PROJECTILE REVIEW (session 40), published over the Skill Effects page (same url: CLAUDE.md 'no new pages').
// Every basic-attack shot and item shot, drawn by the game's own code; per shot OK / CHANGE + a note, saved in the
// page's db, collection `shots` (doc = shot id or 'general': {verdict: 'ok'|'change'|null, text}).
// Run: node docs/proposals/skill-fx/make-projectiles.mjs <out.html>
import fs from 'node:fs';
import { execSync } from 'node:child_process';
execSync('npx vite build --config docs/proposals/skill-fx/vite.projectiles.config.js', { cwd: new URL('../../../', import.meta.url), stdio: 'inherit' });
const bundle = fs.readFileSync(new URL('./dist-shots/shots.js', import.meta.url), 'utf8').replaceAll('</script', '<\\/script');
const font = fs.readFileSync(new URL('../../../src/assets/fonts/press-start-2p.woff2', import.meta.url)).toString('base64');
const tpl = fs.readFileSync(new URL('./projectiles.html', import.meta.url), 'utf8');
fs.writeFileSync(process.argv[2] || 'projectiles-page.html', tpl.replace('/*FONT*/', () => `data:font/woff2;base64,${font}`).replace('/*BUNDLE*/', () => bundle));
fs.rmSync(new URL('./dist-shots', import.meta.url), { recursive: true, force: true });
console.log('wrote', process.argv[2]);
