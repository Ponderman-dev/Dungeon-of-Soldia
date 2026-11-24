// CREDITS + HELP windows (session 53): info.json is complete. Every credit the licences require is there, help's
// glossary pages exist, and the Settings buttons open the windows.
import fs from 'fs';
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const read = (p) => JSON.parse(fs.readFileSync(new URL('../../' + p, import.meta.url)));
const info = read('src/data/info.json'), glossary = read('src/data/glossary.json'), music = read('src/data/music.json');
const all = (d) => d.sections.flatMap((s) => [s.head, ...s.lines]).join(' ');
const credits = all(info.credits);
ok('every section has a head and lines', [info.credits, info.help].every((d) => d.sections.every((s) => s.head && s.lines.length)));
ok('CC BY-SA music is credited (licence requires it)', /xDeviruchi/.test(credits) && /CC BY-SA 4\.0/.test(credits));
const composers = Object.values(music.tracks).map((t) => t.credit.split(',')[0].split(' / ')[0]);
ok('every music composer in music.json is in the credits', composers.every((c) => credits.includes(c)), composers.filter((c) => !credits.includes(c)).join());
ok('the fonts are credited (OFL: Press Start 2P)', /Press Start 2P/.test(credits) && /Open Font License/.test(credits));
ok('the sound sources are credited', ['Kenney', 'Pixabay', 'Mixkit'].every((n) => credits.includes(n)));
const missing = info.help.fromGlossary.filter((t) => !glossary.basics.some((b) => b.title === t));
ok("help's glossary pages exist in glossary.json", missing.length === 0, missing.join());
const settings = fs.readFileSync(new URL('../../src/scenes/SettingsScene.js', import.meta.url), 'utf8');
ok('Settings CREDITS / HELP open the info window', /b\.id === 'credits' \|\| b\.id === 'help' \? this\.info\(b\.id\)/.test(settings));
