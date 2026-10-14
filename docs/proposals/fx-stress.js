// STRESS TEST: 5 enemies, each with 5 debuffs at once. Full version (every status draws its own loop and
// text tag) vs simplified version (only the most important status loops, the rest are small colour pips).
const ST = {
  stun: { label: 'STUN', color: '#d9a400', rank: 1 }, freeze: { label: 'FREEZE', color: '#9fe8ff', rank: 0 },
  chill: { label: 'CHILL', color: '#7fd8ff', rank: 5 }, shock: { label: 'SHOCK', color: '#ffe94d', rank: 2 },
  fear: { label: 'FEAR', color: '#6a3fa0', rank: 3 }, taunt: { label: 'TAUNT', color: '#e05a2a', rank: 4 },
  burn: { label: 'BURN', color: '#ff7a3d', rank: 6 }, poison: { label: 'PSN', color: '#3fae6a', rank: 7 }, bleed: { label: 'BLEED', color: '#c0303a', rank: 8 },
  mark: { label: 'MARK', color: '#ff3d6e', rank: 9 }, blind: { label: 'BLIND', color: '#555566', rank: 10 }, curse: { label: 'CURSE', color: '#7a3fb0', rank: 11 },
  armorBreak: { label: 'ARMOR-', color: '#b0b0b0', rank: 12 }, weaken: { label: 'WEAK', color: '#9a6b3a', rank: 13 },
};
// Five enemies in a line facing one hero, each with 5 debuffs.
const CROWD = [
  ['goblin', 34, 50, ['stun', 'burn', 'poison', 'weaken', 'mark']],
  ['slime', 54, 58, ['freeze', 'bleed', 'curse', 'armorBreak', 'blind']],
  ['rat', 72, 48, ['chill', 'poison', 'bleed', 'burn', 'mark']],
  ['goblin', 90, 58, ['shock', 'burn', 'armorBreak', 'curse', 'weaken']],
  ['slime', 108, 49, ['fear', 'poison', 'weaken', 'blind', 'mark']],
];
// One status loop on a unit (the same looks as in the full section, compact).
function statusLoop(g, k, u, t, i) {
  const sp = u.sp;
  if (k === 'stun') { for (let s = 0; s < 3; s++) { const a = t / 300 + (s * Math.PI * 2) / 3 + i; const x = u.x + Math.cos(a) * 6, y = u.top - 4 + Math.sin(a) * 2; g.px(x, y, '#ffffff'); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.px(x + dx, y + dy, C.gold); } }
  else if (k === 'freeze') { crystals(g, sp, u, 1); }
  else if (k === 'chill') { for (let s = 0; s < 4; s++) g.px(u.x + (rnd(s + i) - 0.5) * 14, u.top - 6 + ((t / 18 + s * 13) % 20), '#ffffff', 0.8); }
  else if (k === 'shock') { const q = Math.floor(t / 110) * 3 + i; if (rnd(q) < 0.7) { const x = u.x + (rnd(q + 1) - 0.5) * u.hw * 2.4, y = u.top + rnd(q + 2) * (u.bot - u.top); g.line(x, y, x + 2, y + 1, C.elec); g.line(x + 2, y + 1, x + 1, y + 3, '#ffffff'); } }
  else if (k === 'fear') { const H = u.bot - u.top; for (let s = 0; s < 3; s++) { const q = (t / 30 + s * 4) % H; g.px(u.x - u.hw - 2, u.bot - q, C.dark, 0.7); g.px(u.x + u.hw + 2, u.bot - ((q + H / 2) % H), C.dark, 0.7); } }
  else if (k === 'burn') { [[-3, 0.6], [2, 0.85], [0, 0.3]].forEach(([dx, f], s) => flame(g, u.x + dx, Math.round(u.top + f * (u.bot - u.top)), 3 + Math.round((Math.sin(t / 80 + s * 2 + i) + 1)), t, s + i)); }
  else if (k === 'poison') { for (let s = 0; s < 3; s++) { const q = ((t / 1200) + s / 3 + i * 0.1) % 1; g.ring(u.x + (rnd(s * 5 + i) - 0.5) * u.hw * 2.4, u.mid - q * 12, 1, C.poison, 0.9); } }
  else if (k === 'bleed') { for (let s = 0; s < 2; s++) { const q = ((t / 700) + s / 2 + i * 0.2) % 1; g.px(u.x + (s ? 2 : -2), u.mid + q * (u.y - u.mid), C.blood); } }
  else if (k === 'mark') brackets(g, u, 2 + Math.round(Math.sin(t / 220 + i) + 1), '#ff3d6e');
  else if (k === 'blind') { for (let s = 0; s < 4; s++) g.disc(u.x - 5 + s * 3.3 + Math.sin(t / 200 + s) * 1, u.top + 3, 1.5, s % 2 ? '#333333' : '#4a4a5a', 0.9); }
  else if (k === 'curse') { const a = t / 330 + i; const x = u.x + Math.cos(a) * (u.hw + 5), y = u.mid + Math.sin(a) * 3 - 2; g.rect(x - 1, y - 1, 3, 3, '#ebe5cf'); g.px(x - 1, y, C.dark2); g.px(x + 1, y, C.dark2); }
  else minorDebuff(g, u, ST[k].color, t, i); // weaken, armorBreak
}
function crowdBase(g, t, tintFor) {
  g.shadow(14, 54, 10); g.sprite(SP.knight, 14, 54);
  const us = CROWD.map(([n, x, y]) => U(SP[n], x, y));
  CROWD.slice().sort((a, b) => a[2] - b[2]).forEach(([n, x, y, list]) => { const i = CROWD.findIndex((c) => c[1] === x); g.shadow(x, y, 9); const top = list.slice().sort((a, b) => ST[a].rank - ST[b].rank)[0]; g.sprite(SP[n], x, y, tintFor(list, top, i)); });
  return us;
}

FX.push(
{ id: 'stress-full', name: 'Full version: 5 enemies x 5 debuffs', group: 'stress', dur: 3000, note: 'Every status draws its own loop and its own text tag. Stars, ice, flames, bubbles, drops, brackets, smoke and skulls all at once, and the tags pile up over each other. Hard to read what is going on.',
  draw(g, t) { const us = crowdBase(g, t, (list, top, i) => ({ recolor: list.includes('freeze') ? iceRecolor(SP[CROWD[i][0]], 1) : null, tint: [ST[list[1]].color, 0.25] }));
    CROWD.forEach(([, , , list], i) => { const u = us[i]; for (const k of list) statusLoop(g, k, u, t, i); });
    CROWD.forEach(([, , , list], i) => { const u = us[i]; const w = 14, x0 = Math.round(u.x - w / 2), y0 = Math.round(u.top - 5); g.rect(x0 - 1, y0 - 1, w + 2, 4, OUTL); g.rect(x0, y0, Math.round(w * 0.6), 2, '#e0524d'); list.forEach((k, j) => { const txt = ST[k].label; const tw = txt.length * 4 + 1; const x = Math.round(u.x - tw / 2 + ((j % 2) ? 6 : -6)); const y = y0 - 8 - j * 3; g.rect(x, y, tw, 7, ST[k].color); g.text(txt, x + tw / 2 + 0.5, y + 1, '#ffffff', 1, 1, false); }); });
    for (let k = 0; k < 4; k++) { const i = (Math.floor(t / 250) + k) % 5; g.pop(String(2 + k), us[i].x + 5, us[i].top - 14, ['#ff7a3d', '#3fae6a', '#c0303a', '#ff7a3d'][k], ((t + k * 120) % 500) / 480); } } },
{ id: 'stress-simple', name: 'Simplified: 5 enemies x 5 debuffs', group: 'stress', dur: 3000, note: 'Each enemy loops ONLY its most important status (Stun stars, Freeze ice, Chill snow, Shock sparks, Fear shivers). The others become a row of 5 small colour pips over its health bar (tap an enemy to read the full names). Damage over time: one added-up number per enemy per second.',
  draw(g, t) { const us = crowdBase(g, t, (list, top, i) => (top === 'freeze' ? { recolor: iceRecolor(SP[CROWD[i][0]], 1) } : { tint: [ST[top].color, 0.2] }));
    CROWD.forEach(([, , , list], i) => { const u = us[i]; const sorted = list.slice().sort((a, b) => ST[a].rank - ST[b].rank); statusLoop(g, sorted[0], u, t, i);
      const w = 14, x0 = Math.round(u.x - w / 2), y0 = Math.round(u.top - 9); g.rect(x0 - 1, y0 - 1, w + 2, 4, OUTL); g.rect(x0, y0, w, 2, '#3a2f57'); g.rect(x0, y0, Math.round(w * 0.6), 2, '#e0524d');
      sorted.forEach((k, j) => { const x = x0 + j * 3; g.rect(x - 1, y0 - 5, 4, 4, OUTL); g.rect(x, y0 - 4, 2, 2, ST[k].color); });
      const tick = (t + i * 200) % 1000; g.pop(String(6 + i * 2), u.x, u.top - 12, '#ffffff', tick / 900); }); } },
{ id: 'stress-tap', name: 'Simplified: tap an enemy to read', group: 'stress', dur: 3000, note: 'When you tap an enemy (you already do this to focus it), a small panel lists its statuses with names and time left. So nothing is hidden, it just is not all shouting at once.',
  draw(g, t) { const us = crowdBase(g, t, (list, top, i) => (top === 'freeze' ? { recolor: iceRecolor(SP[CROWD[i][0]], 1) } : { tint: [ST[top].color, 0.2] }));
    CROWD.forEach(([, , , list], i) => { const u = us[i]; const sorted = list.slice().sort((a, b) => ST[a].rank - ST[b].rank); statusLoop(g, sorted[0], u, t, i); const w = 14, x0 = Math.round(u.x - w / 2), y0 = Math.round(u.top - 9); g.rect(x0 - 1, y0 - 1, w + 2, 4, OUTL); g.rect(x0, y0, Math.round(w * 0.6), 2, '#e0524d'); sorted.forEach((k, j) => { g.rect(x0 + j * 3 - 1, y0 - 5, 4, 4, OUTL); g.rect(x0 + j * 3, y0 - 4, 2, 2, ST[k].color); }); });
    const u = us[2]; brackets(g, u, 2, '#ffffff', 0.9); const sorted = CROWD[2][3].slice().sort((a, b) => ST[a].rank - ST[b].rank); const px = 4, py = 2, pw = 50; g.rect(px - 1, py - 1, pw + 2, sorted.length * 7 + 3, OUTL); g.rect(px, py, pw, sorted.length * 7 + 1, '#221b33'); sorted.forEach((k, j) => { g.rect(px + 2, py + 2 + j * 7, 3, 3, ST[k].color); g.text(ST[k].label, px + 8 + ST[k].label.length * 2, py + 1 + j * 7, '#ffffff', 1, 1, false); g.text(String(4 - j) + 'S', px + pw - 6, py + 1 + j * 7, '#9a8fb8', 1, 1, false); }); } },
);
