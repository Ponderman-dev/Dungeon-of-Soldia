// Heroes screen page STYLES (session 57, user: 'the hero page looks incomplete; stats must not be hidden; show me 5
// styles' + 'the glossary hero too, 5-6 options'). HeroesScene.showHero -> heroPage(scene, def, style 1-5);
// HeroesScene.showEntry (from the Glossary) -> glossaryPage(scene, def, style A-F). The style in use: heroPage.json
// heroPageStyle / glossaryStyle (dev url ?hpage=N / ?ghero=X while the user picks). Drawing only, no rules.
import Phaser from 'phaser';
import { GAME_WIDTH, SKILL_COLORS, UI } from '../../config.js';
import { drawWindow } from '../../entities/uiKit.js';
import { floorCrop } from '../../entities/floorTexture.js';
import { heroBanner, hasBanner } from '../../entities/heroBanner.js';
import { skillIconKey } from '../../entities/skillIconTexture.js';
import * as sfx from '../../audio/sfx.js';
import D from '../../data/heroPage.json';
import heroes from '../../data/heroes.json';
import skills from '../../data/skills.json';
import dungeons from '../../data/dungeons.json';

const L = D.layout, X = L.side, W = GAME_WIDTH - L.side * 2, CX = GAME_WIDTH / 2, P = L.pad, GAP = 12;
const gold = () => Phaser.Display.Color.HexStringToColor(UI.gold).color;
const DIM = Number(L.dim);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const ATK_COL = () => hex(SKILL_COLORS.attack.ready + 0x303030);
const FLOOR = () => dungeons.A.tileColors[0];
// The 7 stats, in order: [label, stat key, suffix]. Bars are scaled by the highest value any hero has.
const STATS = [['HP', 'health', ''], ['ATK', 'attack', ''], ['DEF', 'defense', ''], ['RES', 'resist', ''], ['CRIT', 'crit', '%'], ['DODGE', 'evasion', '%'], ['SPEED', 'attackEfficiency', '%']];
const TOP = Object.fromEntries(STATS.map(([, k]) => [k, Math.max(...heroes.map((h) => h.stats[k] || 0))]));
const typeLine = (def) => `${def.role || ''} - ${def.damageType === 'melee' || def.damageType === 'ranged' ? def.damageType : def.damageType + ' magic'}`.toUpperCase();

// ---------- building blocks ----------
const win = (s, page, x, y, w, h, opt) => { const g = drawWindow(s.add.graphics(), x, y, w, h, opt); page.add(g); return g; };
const behind = (page, g, t) => { page.remove(g); page.addAt(g, page.list.indexOf(t)); };

// The banner box: banner at 3x (or `scale`), centred, cropped to the box. Returns the y under the box.
function bannerBox(s, page, def, y, h = 180, scale = 3, w = W) {
  win(s, page, X, y, w, h, { line: gold(), fill: 0x14141c });
  const bw = Math.min(D.layout.banner.w * scale, w - 4), bh = D.layout.banner.h * scale;
  if (hasBanner(def.id)) page.add(heroBanner(s, def.id, Math.round(X + (w - bw) / 2), y + Math.max(2, Math.round((h - bh) / 2)), scale, w - 4, h - 4));
  else s.text(page, X + w / 2, y + h / 2, 'YOUR PIXEL ART', 'normal', UI.dim).setOrigin(0.5);
  return y + h;
}

// The dungeon floor in a box with the hero standing on it (wearing the look being tried).
function stage(s, page, def, x, y, w, h, scale, feetDy, frame = true) {
  if (frame) win(s, page, x, y, w, h, { line: gold(), fill: 0x14141c });
  page.add(floorCrop(s, FLOOR(), 200, x + 2, y + 2, w - 4, h - 4));
  page.add(s.add.ellipse(x + w / 2, y + feetDy, 14 * scale, 2.4 * scale, 0x000000, 0.35));
  s.hero(page, def, x + w / 2, y + feetDy, scale, false, s.wearing(def).look);
}

// Name in a window, role in gold UNDER it with a clear gap (user: 'name and yellow text too close'). Returns y under.
function namePlate(s, page, def, cx, y, size = 'big', role = def.role) {
  const t = s.text(page, cx, y + 22, def.name.toUpperCase(), size).setOrigin(0.5);
  const nw = t.width + 40, g = win(s, page, cx - nw / 2, y, nw, 44);
  behind(page, g, t);
  const r = s.text(page, cx, y + 44 + 12, (role || '').toUpperCase(), 'normal', UI.gold, { stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5, 0);
  return r.y + r.height;
}

// Stats as a grid of label + value cells in one window. Returns the y under it.
function statGrid(s, page, def, x, y, w, cols = 4) {
  const rows = Math.ceil(STATS.length / cols), rh = 26, h = rows * rh + 16;
  win(s, page, x, y, w, h);
  STATS.forEach(([k, key, suf], i) => {
    const sx = x + P + (i % cols) * ((w - P * 2) / cols), sy = y + 8 + rh / 2 + Math.floor(i / cols) * rh;
    const a = s.text(page, sx, sy, k, 'small').setOrigin(0, 0.5);
    s.text(page, sx + a.width + 6, sy, `${def.stats[key]}${suf}`, 'small', UI.gold).setOrigin(0, 0.5);
  });
  return y + h;
}

// Stats as bars (gold fill = this hero vs the best hero at that stat). Returns the y under it.
function statBars(s, page, def, x, y, w, rh = 22) {
  const h = STATS.length * rh + 16, lw = 64, vw = 44, bx = x + P + lw, bw = w - P * 2 - lw - vw;
  win(s, page, x, y, w, h);
  const g = s.add.graphics(); page.add(g);
  STATS.forEach(([k, key, suf], i) => {
    const cy = y + 8 + i * rh + rh / 2, v = def.stats[key] || 0;
    s.text(page, x + P, cy, k, 'small').setOrigin(0, 0.5);
    g.fillStyle(0x26262f, 1).fillRect(bx, cy - 4, bw, 8).fillStyle(gold(), 1).fillRect(bx, cy - 4, Math.max(2, Math.round((bw * v) / TOP[key])), 8);
    s.text(page, x + w - P, cy, `${v}${suf}`, 'small', UI.gold).setOrigin(1, 0.5);
  });
  return y + h;
}

// Stats as a list (label left, value right) with no window. Returns the y under it.
function statList(s, page, def, x, y, w, rh = 24) {
  STATS.forEach(([k, key, suf], i) => {
    s.text(page, x, y + i * rh, k, 'small');
    s.text(page, x + w, y + i * rh, `${def.stats[key]}${suf}`, 'small', UI.gold).setOrigin(1, 0);
  });
  return y + STATS.length * rh;
}

// The looks in a row of small tiles (tap = try on; the page redraws). Returns the y under it.
function lookRow(s, page, def, x, y, w, h, redraw) {
  const looks = s.looksOf(def), cur = s.wearing(def), n = Math.max(3, looks.length), tw = (w - GAP * (n - 1)) / n;
  looks.forEach((l, i) => {
    const tx = x + i * (tw + GAP), on = l === cur;
    win(s, page, tx, y, tw, h, { line: on ? gold() : l.owned ? UI.line : DIM });
    s.hero(page, def, tx + tw / 2, y + h - 36, 2, false, l.look);
    s.text(page, tx + tw / 2, y + h - 28, l.name.toUpperCase(), 'small', on ? UI.gold : UI.text).setOrigin(0.5, 0);
    s.text(page, tx + tw / 2, y + h - 14, l.owned ? D.armoury.owned : `${l.price} ${D.armoury.currency}`, 'small', l.owned ? UI.green : UI.dim).setOrigin(0.5, 0);
    page.add(s.add.zone(tx, y, tw, h).setOrigin(0).setInteractive({ useHandCursor: true }).onPress(() => {
      if (s.modal || on) return;
      sfx.play('tap'); s.tryOn[def.id] = l.id; redraw();
    }));
  });
  if (looks.length < 3) s.text(page, x + looks.length * (tw + GAP) + (w - looks.length * (tw + GAP)) / 2, y + h / 2, D.armoury.soon, 'small', UI.dim, { align: 'center', wordWrap: { width: w - looks.length * (tw + GAP) - 8 } }).setOrigin(0.5);
  return y + h;
}

// A window: coloured title, wrapped text. Returns the y under it.
function box(s, page, x, y, w, title, body, color = UI.gold) {
  const t = s.text(page, x + P, y + P + 26, body, 'small', UI.text, { wordWrap: { width: w - P * 2 }, lineSpacing: 6 });
  const g = win(s, page, x, y, w, t.height + P * 2 + 26);
  behind(page, g, t);
  s.text(page, x + P, y + P, title, 'normal', color);
  return y + t.height + P * 2 + 26;
}

// The kit: attack, support, perk, passive. `full` = with descriptions; else one line each. Each row has its icon.
function kitRows(s, page, def, x, y, w, full = true) {
  const atk = skills[def.skills.attack], sup = skills[def.skills.support];
  const rows = [[def.skills.attack, `ATTACK - ${atk.name}`, ATK_COL(), `every ${atk.cooldownMs / 1000}s`, atk.description],
    [def.skills.support, `SUPPORT - ${sup.name}`, UI.green, `every ${sup.cooldownMs / 1000}s`, sup.description],
    [null, `PERK - ${def.perk.name}`, UI.gold, 'whole squad', `Whole squad: ${s.perkText(def)}.`],
    ['passive_' + def.id, `PASSIVE - ${def.passive.name}`, UI.text, 'always on', def.passive.description]];
  for (const [icon, title, col, sub, body] of rows) {
    const top = y, ix = x + P, tx = ix + 44;
    const nm = s.text(page, tx, top + P - 2, title.toUpperCase(), 'small', col, { wordWrap: { width: w - P * 2 - 44 } });
    const sb = s.text(page, tx, nm.y + nm.height + 4, sub, 'small', UI.dim);
    let bottom = Math.max(sb.y + sb.height, top + P + 36);
    if (full) { const d = s.text(page, ix, bottom + 6, body, 'small', UI.text, { wordWrap: { width: w - P * 2 }, lineSpacing: 5 }); bottom = d.y + d.height; }
    const h = bottom + P - 4 - top, g = win(s, page, x, top, w, h);
    behind(page, g, nm);
    const ib = win(s, page, ix, top + P - 4, 36, 36, { line: col === UI.gold ? gold() : UI.line });
    behind(page, ib, nm);
    const key = icon ? skillIconKey(s, icon) : null;
    if (key) page.add(s.add.image(ix + 18, top + P + 14, key).setScale(2));
    else s.text(page, ix + 18, top + P + 14, '+', 'normal', UI.gold).setOrigin(0.5);
    y = top + h + 8;
  }
  return y;
}

// Tab buttons; `cur` = the open tab id. Returns the y under them.
function tabs(s, page, y, list, cur, onPick) {
  const tw = (W - GAP * (list.length - 1)) / list.length;
  list.forEach(([id, label], i) => s.button(page, X + i * (tw + GAP), y, tw, 40, label, () => { if (id !== cur) { sfx.play('tap'); onPick(id); } }, id === cur ? 'gold' : 'dim', 'small'));
  return y + 40;
}

const twoButtons = (s, page, def, y, h = 52) => {
  const bw = (W - GAP) / 2;
  s.button(page, X, y, bw, h, 'ARMOURY', () => { sfx.play('tap'); s.showArmoury(def); }, 'solid');
  s.button(page, X + bw + GAP, y, bw, h, 'KIT + RECORDS', () => { sfx.play('tap'); s.showStats(def, 'kit'); }, 'solid', 'small');
  return y + h;
};

// ---------- HERO PAGE: 5 styles ----------
export function heroPage(s, def, style) {
  const page = s.newPage(), redraw = () => s.showHero(def);
  s.top(page, '< BACK', null, () => s.showList());
  let y = 72;
  if (style === 2) {
    // 2. STAT BARS: banner, hero on the floor, every stat as a bar, buttons.
    y = bannerBox(s, page, def, y, 180);
    stage(s, page, def, X, y, W, 214, 4, 196);
    namePlate(s, page, def, CX, y + 10);
    y = statBars(s, page, def, X, y + 214 + GAP, W);
    twoButtons(s, page, def, y + GAP);
  } else if (style === 3) {
    // 3. SIDE BY SIDE: banner; the hero left, name + stats right; the looks in a row; kit + records button.
    y = bannerBox(s, page, def, y, 180) + GAP;
    const lw = 150, rx = X + lw + GAP, rw = W - lw - GAP;
    stage(s, page, def, X, y, lw, 236, 5, 216);
    win(s, page, rx, y, rw, 236);
    s.text(page, rx + P, y + P, def.name.toUpperCase(), 'normal');
    s.text(page, rx + P, y + P + 26, typeLine(def), 'small', UI.gold, { wordWrap: { width: rw - P * 2 } });
    statList(s, page, def, rx + P, y + P + 62, rw - P * 2, 22);
    y += 236 + GAP;
    s.text(page, X, y, 'ARMOURY', 'small', UI.dim); y += 20;
    y = lookRow(s, page, def, X, y, W, 104, redraw) + GAP;
    s.button(page, X, y, W, 52, 'KIT + RECORDS', () => { sfx.play('tap'); s.showStats(def, 'kit'); }, 'solid');
  } else if (style === 4) {
    // 4. BANNER BACKDROP: the hero stands in front of the banner; stats grid; looks row; summary; one button.
    const h = 330;
    win(s, page, X, y, W, h, { line: gold(), fill: 0x14141c });
    page.add(floorCrop(s, FLOOR(), 200, X + 2, y + 178, W - 4, h - 180));
    if (hasBanner(def.id)) page.add(heroBanner(s, def.id, X + 3, y + 2, 3, W - 4, 177));
    page.add(s.add.graphics().fillStyle(gold(), 1).fillRect(X + 2, y + 178, W - 4, 2));
    page.add(s.add.ellipse(CX, y + 300, 84, 14, 0x000000, 0.35));
    s.hero(page, def, CX, y + 300, 6, false, s.wearing(def).look);
    namePlate(s, page, def, CX, y + 10);
    y = statGrid(s, page, def, X, y + h + GAP, W, 4) + GAP;
    y = lookRow(s, page, def, X, y, W, 100, redraw) + GAP;
    s.button(page, X, y, W, 50, 'KIT + RECORDS', () => { sfx.play('tap'); s.showStats(def, 'kit'); }, 'solid');
  } else if (style === 5) {
    // 5. TABS: banner + name, then STATS / ARMOURY / RECORDS tabs; STATS is open first (never hidden).
    const tab = s.heroTab || 'stats';
    y = bannerBox(s, page, def, y, 180);
    y = namePlate(s, page, def, CX, y + GAP) + GAP;
    y = tabs(s, page, y, [['stats', 'STATS'], ['armoury', 'ARMOURY'], ['kit', 'KIT']], tab, (id) => { s.heroTab = id; redraw(); }) + GAP;
    if (tab === 'stats') {
      stage(s, page, def, X, y, 130, 196, 4, 178);
      win(s, page, X + 130 + GAP, y, W - 130 - GAP, 196);
      statList(s, page, def, X + 130 + GAP + P, y + P, W - 130 - GAP - P * 2, 24);
      y += 196 + GAP;
      if (def.summary) box(s, page, X, y, W, 'IN A FIGHT', def.summary, UI.text);
    } else if (tab === 'armoury') {
      stage(s, page, def, X, y, W, 200, 5, 186);
      lookRow(s, page, def, X, y + 200 + GAP, W, 104, redraw);
    } else kitRows(s, page, def, X, y, W, false);
  } else {
    // 1. CLASSIC+: banner, hero on the floor with name + role, a stat grid, buttons, how the hero fights.
    y = bannerBox(s, page, def, y, 180);
    stage(s, page, def, X, y, W, 250, 5, 232);
    page.add(s.add.graphics().fillStyle(gold(), 1).fillRect(X + 2, y, W - 4, 2));
    namePlate(s, page, def, CX, y + 12);
    y = statGrid(s, page, def, X, y + 250 + GAP, W, 4) + GAP;
    y = twoButtons(s, page, def, y) + GAP;
    if (def.summary) box(s, page, X, y, W, 'IN A FIGHT', def.summary, UI.text);
  }
}

// ---------- GLOSSARY ENTRY: 6 styles ----------
// Shared head: the hero on a floor strip, name, role + type, and the stat grid under it. Returns the y under it.
function entryHead(s, page, def, y, withStats = true) {
  const sw = 110, h = 132;
  stage(s, page, def, X, y, sw, h, 4, h - 16);
  win(s, page, X + sw + GAP, y, W - sw - GAP, h);
  const tx = X + sw + GAP + P;
  const nm = s.text(page, tx, y + P, def.name.toUpperCase(), 'big');
  if (nm.width > W - sw - GAP - P * 2) nm.destroy(), s.text(page, tx, y + P + 6, def.name.toUpperCase(), 'normal'); // long names: smaller
  s.text(page, tx, y + P + 44, typeLine(def), 'small', UI.gold, { wordWrap: { width: W - sw - GAP - P * 2 } });
  y += h + GAP;
  return withStats ? statGrid(s, page, def, X, y, W, 4) + GAP : y;
}

export function glossaryPage(s, def, style) {
  const page = s.newPage(), redraw = () => s.showEntry(def);
  s.top(page, '< BACK', null, () => s.showList());
  let y = 72;
  const lore = D.lore[def.id] || '???';
  if (style === 'B') {
    // B. STORY: small banner, the lore, how the hero fights, a tip; stats in a grid.
    y = bannerBox(s, page, def, y, 122, 2);
    y = namePlate(s, page, def, CX, y + GAP) + GAP;
    y = box(s, page, X, y, W, 'STORY', lore) + 8;
    y = statGrid(s, page, def, X, y, W, 4) + 8;
    if (def.summary) y = box(s, page, X, y, W, 'IN A FIGHT', def.summary, UI.text) + 8;
    if (def.tips && def.tips.length) box(s, page, X, y, W, 'TIP', def.tips[0], UI.green);
  } else if (style === 'C') {
    // C. SHORT: head + stats, how the hero fights, the kit one line each with icons.
    y = entryHead(s, page, def, y);
    if (def.summary) y = box(s, page, X, y, W, 'IN A FIGHT', def.summary, UI.text) + 8;
    kitRows(s, page, def, X, y, W, false);
  } else if (style === 'D') {
    // D. SHEET: name plate over a stage, stat bars, the kit one line each.
    y = namePlate(s, page, def, CX, y, 'big', typeLine(def)) + 10;
    stage(s, page, def, X, y, W, 140, 4, 126);
    y = statBars(s, page, def, X, y + 140 + GAP, W, 20) + GAP;
    kitRows(s, page, def, X, y, W, false);
  } else if (style === 'E') {
    // E. TABS: head, then OVERVIEW / SKILLS / STORY.
    const tab = s.entryTab || 'overview';
    y = entryHead(s, page, def, y, false);
    y = tabs(s, page, y, [['overview', 'OVERVIEW'], ['skills', 'SKILLS'], ['story', 'STORY']], tab, (id) => { s.entryTab = id; redraw(); }) + GAP;
    if (tab === 'overview') {
      y = statBars(s, page, def, X, y, W, 22) + 8;
      if (def.summary) y = box(s, page, X, y, W, 'IN A FIGHT', def.summary, UI.text) + 8;
      if (def.tips && def.tips.length) box(s, page, X, y, W, 'TIP', def.tips[0], UI.green);
    } else if (tab === 'skills') kitRows(s, page, def, X, y, W, true);
    else box(s, page, X, y, W, 'STORY', lore);
  } else if (style === 'F') {
    // F. CARD: the hero big and centred, a short intro, then the full kit with icons.
    stage(s, page, def, X, y, W, 170, 4, 150);
    y = namePlate(s, page, def, CX, y + 178, 'big', typeLine(def)) + 8;
    const sum = s.text(page, CX, y, def.summary || '', 'small', UI.text, { wordWrap: { width: W - 20 }, align: 'center', lineSpacing: 5 }).setOrigin(0.5, 0);
    y = sum.y + sum.height + 10;
    y = statGrid(s, page, def, X, y, W, 4) + 8;
    kitRows(s, page, def, X, y, W, false);
  } else {
    // A. KIT: head + stats, then attack / support / perk / passive in full with icons.
    y = entryHead(s, page, def, y);
    kitRows(s, page, def, X, y, W, true);
  }
}
