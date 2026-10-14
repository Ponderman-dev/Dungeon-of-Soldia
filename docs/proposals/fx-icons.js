// STATUS ICONS section (Risk of Rain style): every status has its own small pixel icon (src/data/statusIcons.json,
// 7x7 with its outline), shown in a row over the health bar with the stack count next to each icon.
// EVERY status keeps its own loop on the unit (stars, ice, flames, bubbles...), the icons say which ones are on.
const SI_RANK = { freeze: 0, stun: 1, shock: 2, fear: 3, taunt: 4, silence: 5, chill: 6, burn: 7, poison: 8, bleed: 9, mark: 10, blind: 11, curse: 12, armorBreak: 13, weaken: 14 };

// One icon, its middle on (x, y). n = stack count (shown when 2+), a = alpha, s = pop scale bump (0..1).
function drawSIcon(g, id, x, y, n = 1, a = 1, s = 0) {
  const art = STATUS_ICONS[id]; if (!art) return;
  const pal = art.palette.map((c) => '#' + c.slice(2));
  const left = Math.round(x - 3), top = Math.round(y - 3 - s);
  art.rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') g.px(left + i, top + j, pal[+ch], a); }));
  if (n > 1) { // small white stack number just right of the icon (not on top of it), 1-px dark shadow
    const str = String(n), w = str.length * 4 - 1, cx = left + 7 + w / 2, ty = top + 1;
    g.text(str, cx + 1, ty + 1, OUTL, 1, a, false); g.text(str, cx, ty, '#ffffff', 1, a, false);
  }
}
// How wide one icon is in the row: 7 px, plus room for its stack number.
const siWidth = (n) => 7 + (n > 1 ? String(n).length * 4 : 0);
// Health bar + icon rows over a unit. list = [{ id, n, born, end }] (ms); t = now. perRow = icons per row.
function iconBar(g, u, list, t, { hp = 0.7, perRow = 9, hero = false } = {}) {
  const w = 16, x0 = Math.round(u.x - w / 2), y0 = Math.round(u.top - 5);
  g.rect(x0 - 1, y0 - 1, w + 2, 4, OUTL); g.rect(x0, y0, w, 2, '#3a2f57'); g.rect(x0, y0, Math.round(w * hp), 2, hero ? '#57c26a' : '#e0524d');
  const live = list.filter((s) => t >= s.born && (s.end == null || t < s.end)).map((s) => ({ ...s, n: typeof s.n === 'function' ? s.n(t) : s.n || 1 }));
  for (let r = 0; r * perRow < live.length; r++) {
    const row = live.slice(r * perRow, (r + 1) * perRow);
    let x = Math.round(u.x - row.reduce((sum, s) => sum + siWidth(s.n), 0) / 2);
    const y = y0 - 5 - r * 7;
    for (const s of row) {
      const left = s.end == null ? 1e9 : s.end - t;
      const blink = left < 800 && Math.floor(t / 100) % 2; // blinks just before it runs out
      const age = t - (s.bump ?? s.born); // pops a pixel up when it arrives or gains a stack
      if (!blink) drawSIcon(g, s.id, x + 3, y, s.n, 1, age < 150 ? 1 : 0);
      x += siWidth(s.n);
    }
  }
}
const byRank = (list) => list.slice().sort((a, b) => (SI_RANK[a.id] ?? 50) - (SI_RANK[b.id] ?? 50));

// The stress crowd from fx-stress.js, with stack counts for the damage-over-time ones.
const SI_STACKS = { burn: 3, poison: 8, bleed: 2, chill: 3 };
function crowdIcons(g, t, perRow) {
  const us = crowdBase(g, t, (list, top, i) => (top === 'freeze' ? { recolor: iceRecolor(SP[CROWD[i][0]], 1) } : { tint: [ST[top].color, 0.2] }));
  CROWD.forEach(([, , , list], i) => {
    const u = us[i]; const sorted = list.slice().sort((a, b) => ST[a].rank - ST[b].rank);
    for (const k of sorted) statusLoop(g, k, u, t, i); // every status plays its own effect
    iconBar(g, u, sorted.map((id) => ({ id, n: SI_STACKS[id] || 1, born: -999 })), t, { perRow });
  });
}

FX.push(
{ id: 'icons-life', name: 'One enemy: icons come and go', group: 'icons', dur: 6400,
  note: 'Poison lands and its icon pops in; every new stack bumps the icon and the number next to it goes up (2, 3 ... 8). Then a Stun (the icon blinks just before it runs out), Burn x3 and Mark. Every status plays its own effect on the body at the same time (bubbles, stars, flames, brackets). Icons keep a fixed order: control first, then damage over time, then the rest.',
  draw(g, t) {
    const e = U(SP.goblin, 72, 52), h = U(SP.knight, 34, 52);
    g.shadow(h.x, h.y, 10); g.sprite(SP.knight, h.x, h.y); g.shadow(e.x, e.y, 9);
    g.sprite(SP.goblin, e.x, e.y, { flash: (t % 400) < 60 && t > 300 && t < 3100 ? 0.6 : 0 });
    const pn = (tt) => Math.min(8, 1 + Math.floor(Math.max(0, tt - 300) / 400));
    const list = [
      { id: 'poison', born: 300, end: 6000, n: pn, bump: 300 + (pn(t) - 1) * 400 },
      { id: 'stun', born: 2000, end: 4200 },
      { id: 'burn', born: 3000, end: 6000, n: (tt) => Math.min(3, 1 + Math.floor((tt - 3000) / 300)), bump: 3000 + Math.min(2, Math.floor((t - 3000) / 300)) * 300 },
      { id: 'mark', born: 3600, end: 6000 },
    ];
    for (const s of list) if (t >= s.born && t < s.end) statusLoop(g, s.id, e, t, 0); // every status plays
    iconBar(g, e, byRank(list), t, { hp: 0.9 - Math.min(0.6, t / 10000) });
    g.text('POISON X' + pn(t), 60, 2, '#9a8fb8');
  } },
{ id: 'icons-heroes', name: 'Heroes: buffs as icons', group: 'icons', dur: 3000,
  note: 'The same row works for heroes: Shield, Buff (Rally Cry), Regen, the Samurai\'s parry stance, a ready crit and the Archer\'s Steady Aim. Green health bar, same icon size.',
  draw(g, t) {
    if (!SP.samurai) SP.samurai = heroSprite('samurai');
    const heroes = [['knight', 26, 54, ['shield', 'buff']], ['samurai', 60, 50, ['parry', 'guaranteedCrit', 'buff']], ['archer', 94, 54, ['steady', 'regenBoost', 'buff']]];
    heroes.forEach(([n, x, y]) => { g.shadow(x, y, 10); g.sprite(SP[n], x, y); });
    heroes.forEach(([n, x, y, list], i) => iconBar(g, U(SP[n], x, y), list.map((id) => ({ id, born: -999 })), t, { hero: true, hp: 0.6 + i * 0.15 }));
  } },
{ id: 'icons-stress-row', name: 'Icons: 5 enemies x 5 debuffs (one row)', group: 'stress', dur: 3000,
  note: 'NEW. Each debuff is its own icon in one row over the health bar, stack count next to it (Poison 8, Burn 3, Bleed 2, Chill 3). Every debuff plays its own effect on the body too. The rows are wider than the enemies, so neighbours touch.',
  draw(g, t) { crowdIcons(g, t, 9); } },
{ id: 'icons-stress-3', name: 'Icons: 5 enemies x 5 debuffs (rows of 3)', group: 'stress', dur: 3000,
  note: 'NEW. Same icons and all effects playing, but at most 3 icons per row, rows stacked upwards. Narrower, so neighbours do not touch, but a little taller.',
  draw(g, t) { crowdIcons(g, t, 3); } },
);

// Gallery: every icon big, with its name, filled into #icons .gallery.
const SI_NAMES = { stun: 'Stun', freeze: 'Freeze', chill: 'Chill (stacks)', shock: 'Shock', fear: 'Fear', taunt: 'Taunt', silence: 'Silence', bleed: 'Bleed (stacks)', burn: 'Burn (stacks)', poison: 'Poison (stacks)', weaken: 'Weaken', armorBreak: 'Armor Break', curse: 'Curse', blind: 'Blind', mark: 'Mark', shield: 'Shield', invulnerable: 'Invulnerable', buff: 'Buff', regenBoost: 'Regen', parry: 'Parry stance', guaranteedCrit: 'Crit ready', blockCooldown: 'Block cooldown', steady: 'Steady Aim' };
function buildIconGallery() {
  const box = document.querySelector('#icons .gallery'); if (!box) return;
  for (const id of Object.keys(STATUS_ICONS)) {
    if (id[0] === '_') continue;
    const art = STATUS_ICONS[id], pal = art.palette.map((c) => '#' + c.slice(2));
    const tile = document.createElement('figure'); tile.className = 'ico';
    const big = document.createElement('canvas'); big.width = 7 * 6; big.height = 7 * 6;
    const small = document.createElement('canvas'); small.width = 7 * 3; small.height = 7 * 3; small.className = 'small';
    for (const [cv, z] of [[big, 6], [small, 3]]) { const x = cv.getContext('2d'); art.rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') { x.fillStyle = pal[+ch]; x.fillRect(i * z, j * z, z, z); } })); }
    big.setAttribute('role', 'img'); big.setAttribute('aria-label', (SI_NAMES[id] || id) + ' icon'); small.setAttribute('aria-hidden', 'true');
    const cap = document.createElement('figcaption'); cap.textContent = SI_NAMES[id] || id;
    const pics = document.createElement('div'); pics.className = 'pics'; pics.append(big, small);
    tile.append(pics, cap); box.append(tile);
  }
}
