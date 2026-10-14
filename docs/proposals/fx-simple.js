// SUGGESTION section: the simplified effect system. Same engine and anchors as the main page.
// 1) A small KIT of pieces, effects are recipes (pieces + a colour).
// 2) Item procs = the item's icon pops over the holder + the normal hit in its damage colour.
// 3) Minor debuffs share ONE look (tint + falling flecks in the debuff colour); the TAG says which.
// 4) Only the most important status loops on a unit; the rest are just tags.
// 5) Damage over time: one added-up number per second. Real game speeds.

// ---- extra helpers ------------------------------------------------------------------------------
// The item's 16x16 icon, its middle at (x, y), with a thin rarity-coloured frame.
function drawIcon(g, id, x, y, a = 1, framed = true) {
  const art = ICON_ART[id]; if (!art) return;
  const pal = art.palette.map((c) => '#' + c.slice(2));
  const left = Math.round(x - 8), top = Math.round(y - 8);
  if (framed) { const f = ICON_FRAME[ICON_RAR[id]] || ICON_FRAME.common; const edge = '#' + f.edge.slice(2), fill = '#' + f.fill.slice(2); for (let i = -1; i <= 16; i++) for (let j = -1; j <= 16; j++) { const e = i === -1 || j === -1 || i === 16 || j === 16; if (e && (i === -1 || i === 16) && (j === -1 || j === 16)) continue; g.px(left + i, top + j, e ? edge : fill, a); } }
  art.rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') g.px(left + i, top + j, pal[parseInt(ch, 36)], a); }));
}
// Icon pop over a unit: jumps up, holds, fades (p = 0..1 over ~0.6s).
function iconPop(g, id, u, p) { if (p <= 0 || p >= 1) return; const up = ease.back(Math.min(1, p / 0.25)); const y = u.top - 12 - up * 4 - (p > 0.7 ? (p - 0.7) * 10 : 0); const a = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1; if (p < 0.25) g.ring(u.x, y, 9 + p * 16, '#ffffff', 1 - p / 0.25); drawIcon(g, id, u.x, y, a); }
// A small health bar over a unit with status tags under it (the tag is what tells WHICH debuff).
function barTags(g, u, tags, hp = 0.7) {
  const w = 16, x0 = Math.round(u.x - w / 2), y0 = Math.round(u.top - 5);
  g.rect(x0 - 1, y0 - 1, w + 2, 4, OUTL); g.rect(x0, y0, w, 2, '#3a2f57'); g.rect(x0, y0, Math.round(w * hp), 2, '#e0524d');
  const widths = tags.map(([txt]) => txt.length * 4 + 1);
  let x = Math.round(u.x - (widths.reduce((s, v) => s + v + 1, -1)) / 2);
  tags.forEach(([txt, col], i) => { const tw = widths[i]; g.rect(x, y0 - 8, tw, 7, col); g.text(txt, x + tw / 2 + 0.5, y0 - 7, '#ffffff', 1, 1, false); x += tw + 1; });
}
// ONE look for every minor debuff: the unit is tinted in the debuff colour and a few flecks of that
// colour drift down off it. Only the colour changes.
function minorDebuff(g, u, col, t, seed = 0) { for (let i = 0; i < 4; i++) { const q = ((t / 1500) + i / 4 + seed * 0.13) % 1; g.px(u.x + (rnd(i + seed * 7) - 0.5) * u.hw * 2.4, u.top + q * (u.y - u.top + 2), col, 1 - q); } }
// The standard HIT recipe: (optional shot) + spark burst on the front + ring + number, in one colour.
function recipeHit(g, t, at, col, col2, shot = true) {
  const h = H0(), e = E0(); const [ax, ay] = muzzle(h), [bx, by] = front(e);
  const p = ph(t, at - 160, at); if (shot && p > 0 && p < 1) { const [x, y] = g.fly(ax, ay, bx, by, p, 3); g.disc(x, y, 1.5, col); g.px(x, y, col2); const [x2, y2] = g.fly(ax, ay, bx, by, Math.max(0, p - 0.08), 3); g.px(x2, y2, col, 0.5); }
  const q = ph(t, at, at + 260); g.burst(bx, by, 8, [col, col2], q, 8, 3); if (q > 0 && q < 1) g.ring(bx, by, 2 + q * 6, col, 1 - q);
}
const DEB = { weaken: ['WEAK', '#9a6b3a'], armorBreak: ['ARMOR-', '#8c909c'], curse: ['CURSE', '#7a3fb0'], mark: ['MARK', '#ff3d6e'] };

FX.push(
// ---- 1. the kit ----------------------------------------------------------------------------------
{ id: 's-kit', name: 'The kit: 8 pieces', group: 'simple', dur: 2400, note: 'Every effect in the game is built from these 8 pieces: spark, burst, ring, number (top row) and shot, bolt, pillar, tint (bottom row). An effect is just a recipe: which pieces, which colour, how big, how fast. This is also what the Studio\'s Effects section would edit.',
  draw(g, t) { g.clear(); const cells = [[18, 18], [48, 18], [78, 18], [104, 18], [18, 48], [48, 48], [78, 48], [104, 48]]; const lab = ['SPARK', 'BURST', 'RING', 'NUMBER', 'SHOT', 'BOLT', 'PILLAR', 'TINT']; const p = (t % 1200) / 1200;
    cells.forEach(([x, y], i) => g.text(lab[i], x, y + 10, '#9a8fb8'));
    { const [x, y] = cells[0]; g.slash(x, y, 6, '#ffffff', p * 1.2 % 1); }
    { const [x, y] = cells[1]; g.burst(x, y, 10, [C.fire, C.fire2], p, 10, 2, 0.5); }
    { const [x, y] = cells[2]; g.ring(x, y, 1 + p * 8, C.ice, 1 - p, 1 + p * 6); }
    { const [x, y] = cells[3]; g.pop('24', x, y + 4, '#ffffff', p); }
    { const [x, y] = cells[4]; const [sx, sy] = g.fly(x - 12, y, x + 12, y, p, 6); g.disc(sx, sy, 1.5, C.poison); g.px(sx - 2, sy, C.poison, 0.5); }
    { const [x, y] = cells[5]; if (Math.floor(t / 70) % 2) g.bolt(x - 12, y - 4, x + 12, y + 2, C.elec, Math.floor(t / 70), 5, 3); }
    { const [x, y] = cells[6]; const w = Math.round(3 * (1 - p)) + 1; for (let yy = y - 14; yy < y + 4; yy++) for (let xx = -w; xx <= w; xx++) g.px(x + xx, yy, Math.abs(xx) < w / 2 ? '#ffffff' : C.holy, 0.8 * (1 - p)); }
    { const [x, y] = cells[7]; g.sprite(SP.slime, x, y + 4, { tint: [C.dark, 0.5 * Math.sin(p * Math.PI)] }); } } },
{ id: 's-recipe', name: 'One hit recipe, five colours', group: 'simple', dur: 3000, note: 'Instead of 7 hand-made hit effects, ONE recipe (shot + burst + ring + number) is used for every damage type; only the colour changes. Here it cycles fire, ice, electric, dark, holy at real game speed (a hit lasts about a quarter of a second).',
  draw(g, t) { const els = [['FIRE', C.fire, C.fire2], ['ICE', C.ice, '#ffffff'], ['ELECTRIC', C.elec, '#ffffff'], ['DARK', C.dark, '#ffffff'], ['HOLY', C.holy2, '#ffffff']]; const k = Math.floor(t / 600) % 5, tt = t % 600; const [name, col, col2] = els[k]; solo(g, {}, hitReact(tt, 300)); recipeHit(g, tt, 300, col, col2); num(g, E0(), '18', col, ph(tt, 300, 600)); g.text(name, 60, 4, col); } },

// ---- 2. item procs = icon pop ------------------------------------------------------------------------
{ id: 's-venom', name: 'Venom Fang procs', group: 'simple', dur: 1800, note: 'The item\'s own icon pops up over the hero, the hit uses the normal recipe in poison green, and the Poison status starts on the enemy. No custom effect needed: the icon tells you which item did it.',
  draw(g, t) { solo(g, lunge(t, 300), hitReact(t, 300)); const [x, y] = front(E0()); g.slash(x, y, 8, C.grey, ph(t, 260, 500), -1); g.burst(x, y, 8, [C.poison, '#c8ffd0'], ph(t, 300, 560), 8, 3); iconPop(g, 'venom_fang', H0(), ph(t, 300, 1000)); if (t > 400) { const e = E0(); for (let i = 0; i < 3; i++) { const q = ((t / 1200) + i / 3) % 1; g.ring(e.x + (i - 1) * 4, e.mid - q * 12, 1, C.poison, 0.9); } } num(g, E0(), '12', '#ffffff', ph(t, 300, 900)); } },
{ id: 's-serrated', name: 'Serrated Edge procs', group: 'simple', dur: 1800, note: 'Same pattern: icon pop, normal hit, Bleed starts (red drops).',
  draw(g, t) { solo(g, lunge(t, 300), hitReact(t, 300)); const e = E0(); const [x, y] = front(e); g.slash(x, y, 8, C.grey, ph(t, 260, 500), -1); g.burst(x, y, 8, [C.blood, '#ffffff'], ph(t, 300, 560), 8, 3); iconPop(g, 'serrated_edge', H0(), ph(t, 300, 1000)); if (t > 400) for (let i = 0; i < 2; i++) { const q = ((t / 700) + i / 2) % 1; g.px(e.x + (i ? 2 : -2), e.mid + q * (e.y - e.mid), C.blood); } num(g, e, '12', '#ffffff', ph(t, 300, 900)); } },
{ id: 's-ember', name: 'Ember Charm procs', group: 'simple', dur: 1800, note: 'Icon pop, a fire-coloured burst, then the normal Burn loop.',
  draw(g, t) { solo(g, lunge(t, 300), { ...hitReact(t, 300), tint: t > 400 ? [C.fire, 0.18] : null }); const e = E0(); const [x, y] = front(e); g.slash(x, y, 8, C.grey, ph(t, 260, 500), -1); g.burst(x, y, 10, [C.fire, C.fire2], ph(t, 300, 560), 9, 3, 0.5); iconPop(g, 'ember_charm', H0(), ph(t, 300, 1000)); if (t > 450) [[-3, 0.6], [2, 0.8], [0, 0.3]].forEach(([dx, f], i) => flame(g, e.x + dx, Math.round(e.top + f * (e.bot - e.top)), 3 + Math.round((Math.sin(t / 80 + i) + 1)), t, i)); num(g, e, '12', '#ffffff', ph(t, 300, 900)); } },
{ id: 's-banner', name: 'War Banner procs', group: 'simple', dur: 1800, note: 'Squad items work the same: the icon pops over the holder and a ring in the item\'s colour rolls over the squad (+attack speed).',
  draw(g, t) { const p = ph(t, 450, 1100); squad(g, HEROS.map(() => (p > 0.3 && p < 1 ? { tint: ['#f2d03a', 0.25] } : {})), []); iconPop(g, 'war_banner', HS(1), ph(t, 250, 950)); const c = HS(1); if (p > 0 && p < 1) g.ring(c.x, c.mid, 3 + p * 30, '#f2d03a', 1 - p, 2 + p * 20); } },
{ id: 's-lifesteal', name: 'Bloodlust Mask lifesteal', group: 'simple', dur: 1800, note: 'Icon pop over the hero plus the standard green heal (+3). The red-droplets effect from the full version is dropped.',
  draw(g, t) { const hp = ph(t, 450, 900); solo(g, { ...lunge(t, 300), tint: hp > 0 && hp < 1 ? [C.heal, 0.3 * Math.sin(hp * Math.PI)] : null }, hitReact(t, 300)); const [x, y] = front(E0()); g.slash(x, y, 8, C.grey, ph(t, 260, 500), -1); iconPop(g, 'bloodlust_mask', H0(), ph(t, 300, 1000)); num(g, E0(), '20', '#ffffff', ph(t, 300, 900)); g.pop('+3', H0().x + 10, H0().top + 4, C.heal, ph(t, 450, 1100)); } },
{ id: 's-special', name: 'Kept special (examples)', group: 'simple', dur: 2400, note: 'A few items stay big and unique because they do something you must SEE: Fire Bombs, Static Crystal chain lightning, Excalibur tornado, Mimic Chest, Shatter Hammer, Frozen Thunderbolt. They also get the icon pop. Here: the bomb.',
  draw(g, t) { solo(g, {}, hitReact(t, 750)); iconPop(g, 'fire_bombs', H0(), ph(t, 100, 800)); const e = E0(); const [ax, ay] = muzzle(H0()); const p = ph(t, 250, 750); if (p > 0 && p < 1) { const [x, y] = g.fly(ax, ay, e.x, e.mid, p, 18); g.disc(x, y, 2, '#4a4a5a'); g.px(x + 1, y - 3, Math.floor(t / 60) % 2 ? C.fire2 : C.fire); } const q = ph(t, 750, 1150); if (q > 0 && q < 1) { g.disc(e.x, e.mid, 3 + q * 6, C.fire2, (1 - q) * 0.9); g.ring(e.x, e.mid, 4 + q * 10, C.fire, 1 - q); } g.burst(e.x, e.mid, 14, [C.fire, C.fire2, C.blood, '#4a4a5a'], q, 14, 2, 1); num(g, e, '38', C.fire, ph(t, 750, 1500), 2); } },

// ---- 3. one look for minor debuffs ---------------------------------------------------------------
{ id: 's-minor', name: 'Minor debuffs share one look', group: 'simple', dur: 2400, note: 'Weaken, Armor Break and Curse (and Mark) all use the SAME look: a light tint plus a few flecks drifting off, in the debuff\'s colour. The tag above the health bar tells you which one it is. Fewer things to learn, less noise.',
  draw(g, t) { const list = [['weaken', 'goblin', 22], ['armorBreak', 'rat', 60], ['curse', 'slime', 98]]; for (const [, n, x] of list) g.shadow(x, 56, 10); list.forEach(([k, n, x], i) => { g.sprite(SP[n], x, 56, { tint: [DEB[k][1], 0.3] }); const u = U(SP[n], x, 56); minorDebuff(g, u, DEB[k][1], t, i); barTags(g, u, [[DEB[k][0], DEB[k][1]]], 0.8 - i * 0.15); }); } },

// ---- 4. one loop per unit -----------------------------------------------------------------------
{ id: 's-priority', name: 'Only the top status loops', group: 'simple', dur: 4000, note: 'This goblin has Chill, Burn and Weaken at once. Only the most important one is drawn (control > damage over time > debuff > buff): first the Chill snow; when Chill ends the Burn flames take over. All of them still show as tags.',
  draw(g, t) { const chill = t < 2000; const e = E0(); solo(g, {}, { tint: chill ? [C.ice, 0.35] : [C.fire, 0.2] }); if (chill) { for (let i = 0; i < 6; i++) { const y = e.top - 8 + ((t / 18 + i * 13) % 24); g.px(e.x + (rnd(i) - 0.5) * 16 + Math.sin(t / 300 + i) * 2, y, '#ffffff', 0.8); } } else [[-4, 0.55], [0, 0.85], [4, 0.6]].forEach(([dx, f], i) => flame(g, e.x + dx, Math.round(e.top + f * (e.bot - e.top)), 3 + Math.round((Math.sin(t / 80 + i * 2) + 1) * 1.5), t, i)); const tags = chill ? [['CHILL', '#2f8ab0'], ['BURN', '#c8562a'], ['WEAK', '#9a6b3a']] : [['BURN', '#c8562a'], ['WEAK', '#9a6b3a']]; barTags(g, e, tags, 0.6); } },

// ---- 5. calmer numbers --------------------------------------------------------------------------
{ id: 's-dotnum', name: 'One poison number per second', group: 'simple', dur: 3000, note: 'Three Poison stacks tick together: one added-up green number each second instead of three small ones. Same for Bleed and Burn (Burn adds up its two half-second ticks).',
  draw(g, t) { const tick = t % 1000; solo(g, {}, { tint: [C.poison, tick < 160 ? 0.45 : 0.15] }); const e = E0(); for (let i = 0; i < 4; i++) { const q = ((t / 1200) + i / 4) % 1; g.ring(e.x + (rnd(i * 5) - 0.5) * e.hw * 2.4, e.mid - q * 14, 1, C.poison, 0.9); } num(g, e, '12', C.poison, tick / 900); barTags(g, e, [['PSN X3', '#2f8a4a']], 0.7 - (t / 3000) * 0.3); } },
{ id: 's-scale', name: 'Size = importance (real speed)', group: 'simple', dur: 3000, note: 'At real game speed: a normal hit is small and over in a quarter second, an item proc adds its icon, a crit adds a star and a tiny shake. Skills (not shown here) stay the biggest. Screen shake only for crits and attack skills.',
  draw(g, t) { const k = Math.floor(t / 1000), tt = t % 1000; const sh = k === 2 ? shake(tt, 300, 400) : 0; solo(g, { ...lunge(tt, 300, k === 2 ? 8 : 6), dy: sh }, { ...hitReact(tt, 300), dy: sh }); const [x, y] = front(E0()); g.slash(x, y, 8, k === 2 ? C.gold : C.grey, ph(tt, 260, 480), -1); if (k === 1) iconPop(g, 'rusty_nails', H0(), ph(tt, 300, 900)); if (k === 2) g.rays(x, y, 8, 12, C.gold, ph(tt, 300, 560)); num(g, E0(), k === 2 ? '24!' : '12', k === 2 ? C.gold : '#ffffff', ph(tt, 300, 950), k === 2 ? 2 : 1); g.text(['HIT', 'PROC', 'CRIT'][k], 60, 4, '#9a8fb8'); } },
);
