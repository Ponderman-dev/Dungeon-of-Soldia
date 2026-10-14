import re
p='soldia-proposals.html'; s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1, a[:80]
    s=s.replace(a,b)

rep("""<p class="lead">Version 2, after your notes: bosses every 20 floors, hero kits that work with the items (and a bit of shared defense), a new skill book system, and real sound libraries instead of 8-bit sketches. Nothing here is built yet. Tell me which parts you like and I'll build them one step at a time.</p>""",
"""<p class="lead">Version 3. <b>Already in the game:</b> the 8 bosses (floors 20 to 160), the new hero kits and the Organic menu sounds. <b>New on this page:</b> skill books, version 3: smaller stat pages so heroes don't grow too fast, and MODIFIER pages that any hero can put on any skill. The skill books are not built yet: tell me what to keep, cut or change.</p>""")
rep('<p class="eyebrow">Proposal 1 · every 20 floors</p>','<p class="eyebrow">Built ✓ · every 20 floors</p>')
rep('<p class="eyebrow">Proposal 2 · rework, version 2</p>','<p class="eyebrow">Built ✓ · rework, version 2</p>')
rep('<p class="eyebrow">Proposal 4 · audio, version 2</p>','<p class="eyebrow">Menu sounds built (Organic) · fight sounds wait for Kenney</p>')

# books section
start=s.index('  <section id="books">'); end=s.index('  <section id="sounds">')
s=s[:start]+'''  <section id="books">
    <div class="sechead">
      <p class="eyebrow">Proposal · skill books, version 3</p>
      <h2>Skill books: small stats, big twists</h2>
      <p class="lead">After your notes: books no longer give big numbers. A book now holds <b>pages</b>. Stat pages are small and capped. Modifier pages change WHAT a skill does, and every hero can use every modifier, so a book is never useless. Most modifiers have a price (a red line), so each one is a choice, not just a power boost.</p>
    </div>
    <div class="bookFlow"><span class="step">Reward card: SKILL BOOK</span><span class="arrow">›</span><span class="step">Who reads it? (hero)</span><span class="arrow">›</span><span class="step">Pick 1 of 3 pages</span><span class="arrow">›</span><span class="step">Attack or support skill?</span><span class="arrow">›</span><span class="step">Marks under the skill square</span></div>
    <div class="rules" id="bookRules"></div>
    <h3 style="margin-bottom:4px">Stat pages (small, max 3 per skill)</h3>
    <p class="note">At most 3 stat pages per skill, in any mix. So the most a skill can ever get is +24% power, or -24% cooldown. In version 2 a single page gave +30%.</p>
    <div class="pages" id="statPages"></div>
    <h3 style="margin-bottom:4px">Modifier pages (any hero, any skill, 2 slots per skill)</h3>
    <p class="note">Each skill has 2 modifier slots. A third modifier replaces one you choose, so a skill can't pile up effects forever. Where a page works differently on an attack skill and a support skill, the card shows both.</p>
    <div class="filters" id="modFilter" role="group" aria-label="Filter modifier pages"></div>
    <div class="pages mods" id="modPages"></div>
    <h3 style="margin-bottom:10px">Example builds</h3>
    <div class="rules" id="bookExamples"></div>
  </section>

'''+s[end:]

# JS data
start=s.index('const BOOK_RULES = ['); end=s.index('];', s.index('const HERO_PAGES = ['))+2
s=s[:start]+r'''const BOOK_RULES = [
  ['How you get one', 'A Skill Book can be one of the 3 reward cards (about 1 in 8 reward screens). After every BOSS you also get a free GOLDEN book.'],
  ['Blue book', 'Shows 3 pages: usually 2 stat pages and 1 modifier. You keep one.'],
  ['Golden book (after a boss)', 'Shows 3 MODIFIER pages. You keep one.'],
  ['Limits', 'Each skill holds 3 stat pages and 2 modifiers at most. A fallen hero can\'t read books, and their pages stop working.'],
  ['Shown in the fight', 'Small marks under the skill square: a dot for each stat page, a coloured diamond for each modifier.'],
];
const STAT_PAGES = [
  ['Sharpen', '+8% skill power (damage, healing, shield or buff size).'],
  ['Swift', 'Cooldown 8% shorter.'],
  ['Steady Hands', 'Wind-up 15% shorter (less time to get interrupted).'],
  ['Lasting', 'The statuses, buffs and shields this skill gives last 15% longer.'],
];
// [name, tag, plus, minus, attack-vs-support note]
const MOD_PAGES = [
  ['Inks (4 kinds)', 'Debuff', 'Every enemy the skill hits also gets 2 stacks of: Poison (Venom Ink), Bleed (Razor Ink), Burn (Ember Ink) or Chill (Frost Ink).', '', 'Support skill: the 2 stacks go on the nearest enemy.'],
  ['Hunter\'s Ink', 'Debuff', 'Enemies it hits are Marked for 4s (+15% damage taken from everyone).', '', 'Support skill: marks the nearest enemy.'],
  ['Blood Price', 'Heal', 'Also heals the 2 most hurt allies for 12% of their max health.', 'Costs the caster 6% of its health (it can\'t kill itself, it stops at 1).', ''],
  ['Siphon', 'Heal', '15% of the damage it deals heals the caster.', '', 'Support skill: the caster heals 5% of its max health instead.'],
  ['Cyclone', 'Area', 'A small tornado spins up on the target for 4s and drifts between enemies (40% damage per hit, like a weak Excalibur).', 'Cooldown 30% longer.', 'Support skill: the tornado starts on the nearest enemy.'],
  ['Ricochet', 'Area', 'A single-target skill also hits 1 more enemy at 50%.', '', 'Support skill: also reaches 1 more ally at 50%.'],
  ['Aftershock', 'Area', '1 second later a second pulse hits the same targets for 35%.', '', 'Support skill: the buff or heal pulses again at 35%.'],
  ['Titan', 'Self', 'The caster grows 30% bigger for 3s: +20% max health (it gets that health too) and +20% damage.', 'While big it has 10 less evasion. The extra health goes away after (never below 1).', ''],
  ['Bulwark', 'Defense', 'Casting gives the caster a shield of 8% of its max health for 4s.', '', ''],
  ['Purify', 'Defense', 'Casting removes 1 debuff from the caster.', '', 'Support skill: removes 1 debuff from every target instead.'],
  ['Roar', 'Defense', 'Enemies near the caster are Taunted for 2s, and the caster gets +10 defense for 2s.', 'The caster takes those hits.', ''],
  ['Gravecall', 'Summon', 'Raises 1 weak skeleton next to the caster. It fights until the floor ends.', 'At most 2 page skeletons per hero.', ''],
  ['Rally', 'Team', 'Casting gives the whole squad +10% attack speed for 3s.', '', ''],
  ['Concussive', 'Control', 'Each hit has a 20% chance to Stun for 0.6s (bosses: half as long).', 'Cooldown 15% longer.', ''],
  ['Overcharge', 'Risk', '+40% skill power.', 'Wind-up twice as long: much easier to interrupt.', ''],
  ['Reckless', 'Risk', '+35% skill damage.', 'For 4s after casting, the caster takes 15% more damage.', ''],
  ['Desperate', 'Risk', '+50% skill power while the caster is under 40% health.', 'Nothing extra above 40%.', ''],
  ['Hasty', 'Tempo', 'Cooldown 25% shorter.', 'Skill power 20% lower.', ''],
];
const BOOK_EXAMPLES = [
  ['Knight · Shield Bash', 'Venom Ink + Cyclone: every bash poisons, and a tornado chews through the enemy line. Slower bashes, much more damage over time.'],
  ['Cleric · Divine Shield', 'Blood Price + Rally: she pays a little health, two allies heal, and the whole squad swings faster.'],
  ['Archer · Headshot', 'Overcharge + Hunter\'s Ink: a slow, risky shot that hits very hard and marks the target for the squad.'],
  ['Necromancer · Bone Ward', 'Gravecall + Bulwark: every ward also raises a skeleton and shields himself.'],
];
'''+s[end:]

# render
start=s.index("document.getElementById('bookRules').innerHTML"); end=s.index("// Sound libraries")
s=s[:start]+r'''document.getElementById('bookRules').innerHTML = BOOK_RULES.map(([t, d]) => `<div><b>${t}</b>${d}</div>`).join('');
document.getElementById('statPages').innerHTML = STAT_PAGES.map(([n, d]) => `<div class="page stat"><b>${n}</b>${d}</div>`).join('');
const MOD_TAGS = ['All', ...new Set(MOD_PAGES.map((m) => m[1]))];
let modTag = 'All';
function drawMods() {
  document.getElementById('modFilter').innerHTML = MOD_TAGS.map((t) => `<button type="button" data-tag="${t}" aria-pressed="${t === modTag}">${t}</button>`).join('');
  document.getElementById('modPages').innerHTML = MOD_PAGES.filter((m) => modTag === 'All' || m[1] === modTag).map(([n, tag, plus, minus, note]) =>
    `<div class="page mod"><div class="modHead"><b>${n}</b><span class="tag t-${tag}">${tag}</span></div><p class="plus">+ ${plus}</p>${minus ? `<p class="minus">− ${minus}</p>` : '<p class="free">No price.</p>'}${note ? `<p class="also">${note}</p>` : ''}</div>`).join('');
}
drawMods();
document.getElementById('modFilter').addEventListener('click', (e) => { const b = e.target.closest('button[data-tag]'); if (!b) return; modTag = b.dataset.tag; drawMods(); });
document.getElementById('bookExamples').innerHTML = BOOK_EXAMPLES.map(([t, d]) => `<div><b>${t}</b>${d}</div>`).join('');

'''+s[end:]

# css
rep('</style>', '''.note { color: var(--mute); font-size: 14px; margin: 0 0 12px; max-width: 70ch; }
.page.stat { border-color: #3d5a8a; background: linear-gradient(160deg, #1f2742, #1b1833); }
.filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.filters button { font: 600 13px var(--body); color: var(--soft); background: var(--panel); border: 1px solid var(--line); border-radius: 999px; padding: 6px 12px; cursor: pointer; min-height: 32px; }
.filters button[aria-pressed="true"] { background: var(--purple); border-color: var(--purple); color: #fff; }
.filters button:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.mod .modHead { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 6px; }
.mod .modHead b { margin: 0; }
.mod p { margin: 4px 0 0; }
.mod .plus { color: #b8f5c8; }
.mod .minus { color: #ffb0a8; }
.mod .free { color: var(--mute); font-size: 13px; }
.mod .also { color: var(--mute); font-size: 13px; border-top: 1px dashed #3a2f57; padding-top: 6px; margin-top: 8px; }
.tag { font: 600 11px/1 var(--mono); padding: 4px 7px; border-radius: 6px; white-space: nowrap; background: #2a2240; color: var(--soft); border: 1px solid #3a2f57; }
.t-Debuff { color: #c9f08a; border-color: #4a6a2a; } .t-Heal { color: #9ff0c0; border-color: #2a5a40; } .t-Area { color: #ffcf8a; border-color: #6a4a20; }
.t-Self { color: #ffd84d; border-color: #6a5a20; } .t-Defense { color: #9fc4ff; border-color: #2a4a7a; } .t-Summon { color: #c8a0ff; border-color: #4a3a7a; }
.t-Team { color: #ff9fd0; border-color: #6a2a50; } .t-Control { color: #e8e0b0; border-color: #5a5030; } .t-Risk { color: #ff8a7a; border-color: #7a2a2a; } .t-Tempo { color: #8ae8ff; border-color: #2a5a6a; }
</style>''')

# decide
start=s.index('      <ol>', s.index('<section id="decide">')); end=s.index('      </ol>', start)+len('      </ol>')
s=s[:start]+'''      <ol>
        <li>Stat pages: OK with +8% power / -8% cooldown / -15% wind-up / +15% duration, max 3 per skill? Or even smaller?</li>
        <li>Modifiers: which ones do you like, which should go, and any to add? (Tap the filter buttons to see them by kind.)</li>
        <li>2 modifier slots per skill (a new one replaces an old one): OK?</li>
        <li>A free golden book after every boss: OK?</li>
        <li>Fight sounds: add kenney.nl (and freesound.org) to the allowed domains in this environment's network settings, or upload the zip packs, and I'll add hit, magic and boss sounds.</li>
      </ol>'''+s[end:]
open(p,'w').write(s)
print('ok')
