// The Heroes screen's two hero pages (session 57; user's picks on the review page):
// - heroPage (camp > HEROES, pick 4 'banner backdrop'): the hero in front of their banner, this hero's PLAYTIME
//   RECORDS (user: 'not the hero stats: runs, kills, deaths, best floor...'), the looks (try on), HERO DETAILS.
// - glossaryPage (Glossary > HEROES, and HERO DETAILS above; pick F 'card'): the hero big, a short intro, the hero's
//   stats and the kit one line each with icons.
// Drawing only, no rules. Data: heroPage.json (layout.page / layout.card2), heroes.json, skills.json.
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

// This hero's playtime records (progress.stats.heroRecords, kept from session 37 on) in a 3 x 2 grid. Returns y under.
const RECORDS = [['RUNS', 'runs'], ['BEST FLOOR', 'bestFloor'], ['KILLS', 'kills'], ['DEATHS', 'deaths'], ['DAMAGE', 'damage'], ['HEALING', 'healing']];
const num = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
function recordGrid(s, page, def, x, y, w) {
  const r = ((s.progress.stats || {}).heroRecords || {})[def.id] || {}, cols = 3, cw = (w - GAP * (cols - 1)) / cols, ch = 56;
  RECORDS.forEach(([label, key], i) => {
    const bx = x + (i % cols) * (cw + GAP), by = y + Math.floor(i / cols) * (ch + GAP);
    win(s, page, bx, by, cw, ch);
    s.text(page, bx + cw / 2, by + 12, label, 'small', UI.dim).setOrigin(0.5, 0);
    s.text(page, bx + cw / 2, by + 30, num(r[key]), 'normal', UI.gold).setOrigin(0.5, 0);
  });
  return y + 2 * ch + GAP * 2;
}

// ---------- HERO PAGE (pick 4: banner backdrop + records) ----------
export function heroPage(s, def) {
  const page = s.newPage(), C = L.page, redraw = () => s.showHero(def);
  s.top(page, '< BACK', null, () => s.showList());
  let y = C.y;
  // The hero stands in front of their banner; the dungeon floor under the banner.
  win(s, page, X, y, W, C.h, { line: gold(), fill: 0x14141c });
  page.add(floorCrop(s, FLOOR(), 200, X + 2, y + C.floorY, W - 4, C.h - C.floorY - 2));
  const Bn = L.banner;
  if (hasBanner(def.id)) page.add(heroBanner(s, def.id, X + 3, y + 2, Bn.scale, W - 4, C.floorY - 2));
  page.add(s.add.graphics().fillStyle(gold(), 1).fillRect(X + 2, y + C.floorY, W - 4, 2));
  page.add(s.add.ellipse(CX, y + C.feetDy, 84, 14, 0x000000, 0.35));
  s.hero(page, def, CX, y + C.feetDy, C.heroScale, false, s.wearing(def).look);
  namePlate(s, page, def, CX, y + 10);
  y += C.h + GAP;
  s.text(page, X, y, D.recordsTitle, 'small', UI.dim);
  y = recordGrid(s, page, def, X, y + 20, W);
  s.text(page, X, y, D.armouryTitle, 'small', UI.dim);
  y = lookRow(s, page, def, X, y + 20, W, C.lookH, redraw) + GAP;
  s.button(page, X, y, W, C.buttonH, D.detailsButton, () => { sfx.play('tap'); s.showEntry(def, () => s.showHero(def)); }, 'solid');
}

// ---------- GLOSSARY HERO (pick F: card) ----------
// `onBack` = where BACK goes (the list, or the hero page when opened from HERO DETAILS).
export function glossaryPage(s, def, onBack = () => s.showList()) {
  const page = s.newPage(), C = L.card2;
  s.top(page, '< BACK', null, onBack);
  let y = C.y;
  stage(s, page, def, X, y, W, C.stageH, C.heroScale, C.feetDy);
  y = namePlate(s, page, def, CX, y + C.stageH + 8, 'big', typeLine(def)) + 8;
  const sum = s.text(page, CX, y, def.summary || '', 'small', UI.text, { wordWrap: { width: W - 20 }, align: 'center', lineSpacing: 5 }).setOrigin(0.5, 0);
  y = sum.y + sum.height + 10;
  y = statGrid(s, page, def, X, y, W, 4) + 8;
  kitRows(s, page, def, X, y, W, false);
}
