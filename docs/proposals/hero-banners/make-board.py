# HERO BANNERS pick page (session 57). Each card = the REAL hero page (game screenshot) with its proposed banner pasted
# into the 'YOUR PIXEL ART' box, the lore line it is drawn from, LOVE / MAYBE / NO + a note.
# Picks: db collection 'banners' on the reused review page (doc id = hero id: {key, verdict, note}).
# Usage: python3 make-board.py <mock dir (from the scratch: page shots + banners)> <out dir>
import sys, os, json, shutil, html
MOCK, OUT = sys.argv[1], sys.argv[2]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../..')
os.makedirs(os.path.join(OUT, 'b'), exist_ok=True)
heroes = json.load(open(os.path.join(ROOT, 'src/data/heroes.json')))
lore = json.load(open(os.path.join(ROOT, 'src/data/heroPage.json')))['lore']
SCENE = {'knight': "Soldia's fallen gate: the stair down into the dark, two torches, the Knight's flag on top.",
         'berserker': 'Three war camps burning under a red sky, crossed axes in front.',
         'rogue': "Rooftops at night, the lord's lit window, a gold coin falling. The Rogue crouches on the roof.",
         'archer': 'The forest around the tower at sunset, an arrow in flight.',
         'samurai': "A huge red sun, the old master's grave with a sword planted beside it, falling petals.",
         'mage': 'The academy library on fire, with an ice shard and a lightning bolt in the middle.',
         'cleric': 'The chapel of the dawn: a glowing window, light falling into the dark.',
         'necromancer': 'A crypt: a glowing skull on an open book, candles, bones on the floor.',
         'bard': 'The deepest cells: one cell with a bent bar (escaped), the big key ring on a chain.',
         'alchemist': 'The lab shelf full of bottles, one going BANG in the middle.'}
cards = []
for h in heroes:
    shutil.copy(os.path.join(MOCK, h['id'] + '.png'), os.path.join(OUT, 'b', h['id'] + '.png'))
    cards.append({'id': h['id'], 'name': h['name'], 'scene': SCENE[h['id']], 'lore': lore.get(h['id'], '')})
T = r'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Soldia Hero Banners</title>
<style>
/* VOICE: the game's own dusk menus. IDEA: a review of real hero pages. PICTURE: each card IS the game screen with its
   banner. COLOUR and TYPE: dusk black, white frames, gold, salmon buttons; Press Start-like pixel headings.
   LAYOUT: a grid of phone screens, one per hero, picks under each. */
:root{color-scheme:dark;--bg:#0e0b16;--panel:#000;--line:#fff;--soft:#3a3150;--fg:#f0ecf8;--muted:#aaa0c0;--gold:#ffd84a;--btn:#6a2235}
*{box-sizing:border-box;min-width:0}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;overflow-x:clip}
header{padding:20px max(4vw,14px) 8px}
h1{font:400 clamp(17px,4vw,24px)/1.3 "Courier New",monospace;letter-spacing:.02em;margin:0;text-wrap:balance}
.lede{color:var(--muted);max-width:70ch;margin:8px 0 0}
#st{color:var(--muted);font-size:13px;margin:6px 0 0}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:18px;padding:12px max(4vw,14px) 40px}
.card{background:var(--panel);border:3px solid var(--line);padding:10px;display:flex;flex-direction:column;gap:8px}
.card.love{border-color:var(--gold)}.card.no{opacity:.55}
.card img{width:100%;height:auto;image-rendering:pixelated;display:block;border:1px solid var(--soft)}
.card h2{margin:0;font:700 16px/1.3 "Courier New",monospace;color:var(--gold)}
.card p{margin:0;font-size:14px}.card .lore{color:var(--muted);font-style:italic}
.picks{display:flex;gap:8px}
.picks button{flex:1;min-height:44px;font:700 13px "Courier New",monospace;color:var(--fg);background:var(--btn);border:2px solid var(--btn);cursor:pointer}
.picks button.on{background:var(--gold);border-color:var(--gold);color:#000}
.picks button:focus-visible,textarea:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
textarea{width:100%;min-height:56px;font:16px system-ui;background:#14121c;color:var(--fg);border:2px solid var(--soft);padding:8px;resize:vertical}
.general{grid-column:1/-1}
</style></head><body>
<header><h1>Hero banners · proposal 1</h1>
<p class="lede">One pixel banner per hero, drawn from their lore. Each sits in the <b>YOUR PIXEL ART</b> box on the real hero page (113×59 pixels, shown 3× like the heroes). Mark each <b>LOVE / MAYBE / NO</b> and add a note if you want a change (other scene, colours, more detail…).</p>
<p id="st">Connecting…</p></header>
<main id="grid"></main>
<script>
{
const CARDS = /*CARDS*/;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const grid = document.getElementById('grid'), st = document.getElementById('st');
grid.innerHTML = CARDS.map((c) => `<article class="card" id="c-${c.id}">
  <img src="b/${c.id}.png" alt="${esc(c.name)} hero page with the proposed banner" width="390" height="720" loading="lazy">
  <h2>${esc(c.name.toUpperCase())}</h2><p>${esc(c.scene)}</p><p class="lore">${esc(c.lore)}</p>
  <div class="picks">${['love','maybe','no'].map((v) => `<button type="button" data-id="${c.id}" data-v="${v}">${v.toUpperCase()}</button>`).join('')}</div>
  <textarea data-note="${c.id}" placeholder="Note for ${esc(c.name)}…" aria-label="Note for ${esc(c.name)}"></textarea></article>`).join('')
  + `<article class="card general"><h2>ANYTHING ELSE</h2><p>About the whole set: style, size, lore page ideas…</p><textarea data-note="general" aria-label="General note"></textarea></article>`;
let db = null; const state = {};
function paint() {
  for (const c of CARDS) {
    const v = (state[c.id] || {}).verdict, el = document.getElementById('c-' + c.id);
    el.classList.toggle('love', v === 'love'); el.classList.toggle('no', v === 'no');
    el.querySelectorAll('.picks button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  }
  document.querySelectorAll('textarea').forEach((t) => { if (document.activeElement !== t) t.value = (state[t.dataset.note] || {}).note || ''; });
}
async function save(id, patch) {
  state[id] = { ...(state[id] || {}), ...patch }; paint();
  try { if (db) await db.collection('banners').doc(id).set({ key: id, ...state[id], updatedAt: new Date().toISOString() }); else localStorage.setItem('banners', JSON.stringify(state)); } catch (e) { st.textContent = 'Could not save: ' + (e.message || e); }
}
grid.addEventListener('click', (e) => { const b = e.target.closest('.picks button'); if (!b) return; const cur = (state[b.dataset.id] || {}).verdict; save(b.dataset.id, { verdict: cur === b.dataset.v ? null : b.dataset.v }); });
let tm = {}; grid.addEventListener('input', (e) => { const t = e.target.closest('textarea'); if (!t) return; clearTimeout(tm[t.dataset.note]); tm[t.dataset.note] = setTimeout(() => save(t.dataset.note, { note: t.value }), 600); });
(async () => {
  try { db = window.claude ? await window.claude.use('db') : null; } catch { db = null; }
  if (!db) { try { Object.assign(state, JSON.parse(localStorage.getItem('banners') || '{}')); } catch {} st.textContent = 'Picks stay in this browser (open it in Claude to send them to me).'; paint(); return; }
  st.textContent = 'Your picks save automatically and I can read them.';
  db.collection('banners').onSnapshot((snap) => { snap.docs.forEach((d) => { state[d.id] = d.data(); }); paint(); });
})();
paint();
}
</script></body></html>
'''
open(os.path.join(OUT, 'index.html'), 'w').write(T.replace('/*CARDS*/', json.dumps(cards)))
print(len(cards), 'cards ->', OUT)
