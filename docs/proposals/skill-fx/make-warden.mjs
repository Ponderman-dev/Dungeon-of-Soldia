// Builds the WARDEN REVIEW (skill looks + icon options), published over the Skill Effects page (CLAUDE.md: no new pages).
// Per look OK / CHANGE + a note, per icon a pick (A / B); saved in the db, collection `warden`
// (doc = look id or `icon:<id>` or `general`: {verdict, pick, text}).
// Run: node docs/proposals/skill-fx/make-warden.mjs <out.html>
import fs from 'node:fs';
import { execSync } from 'node:child_process';
execSync('npx vite build --config docs/proposals/skill-fx/vite.warden.config.js', { cwd: new URL('../../../', import.meta.url), stdio: 'inherit' });
const bundle = fs.readFileSync(new URL('./dist-warden/warden.js', import.meta.url), 'utf8').replaceAll('</script', '<\\/script');
const font = fs.readFileSync(new URL('../../../src/assets/fonts/press-start-2p.woff2', import.meta.url)).toString('base64');
const tpl = fs.readFileSync(new URL('./warden.html', import.meta.url), 'utf8');
fs.writeFileSync(process.argv[2] || 'warden-page.html', tpl.replace('/*FONT*/', () => `data:font/woff2;base64,${font}`).replace('/*BUNDLE*/', () => bundle));
fs.rmSync(new URL('./dist-warden', import.meta.url), { recursive: true, force: true });
console.log('wrote', process.argv[2]);
