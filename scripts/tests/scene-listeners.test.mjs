// A scene's own events (this.events) outlive scene.stop / restart in Phaser: a listener added in create() piles up on
// every visit unless it is removed on SHUTDOWN (session 51: camp, Pause and the fight HUD added a RESUME listener per
// visit). This checks the source: every file that listens to a scene event with .on() also removes that event.
import fs from 'node:fs';
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const dir = new URL('../../src/scenes/', import.meta.url);
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const u = new URL(f.name + (f.isDirectory() ? '/' : ''), d); if (f.isDirectory()) walk(u); else if (f.name.endsWith('.js')) files.push(u); } };
walk(dir);
const bad = [];
for (const u of files) {
  const src = fs.readFileSync(u, 'utf8');
  for (const m of src.matchAll(/this\.events\.on\((Phaser\.Scenes\.Events\.[A-Z_]+)/g)) if (!src.includes(`this.events.off(${m[1]}`)) bad.push(`${u.pathname.split('/scenes/')[1]} ${m[1]}`);
}
ok('every scene-event listener added with this.events.on(Phaser.Scenes.Events.X) is removed again', !bad.length, bad.join(', '));
