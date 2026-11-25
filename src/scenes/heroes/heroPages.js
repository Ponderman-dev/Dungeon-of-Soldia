// The Heroes screen's two hero pages (session 57; user's picks on the review page):
// - heroPage (camp > HEROES, pick 4 'banner backdrop'): the hero in front of their banner, this hero's PLAYTIME
//   RECORDS (user: 'not the hero stats: runs, kills, deaths, best floor...'), the looks (try on), HERO DETAILS.
// - glossaryPage (Glossary > HEROES, and HERO DETAILS above; pick F 'card', scrolls): the hero big, a one-line
//   intro, the STORY, the hero's stats and the full kit (passive first) with icons.
// Drawing only, no rules. Data: heroPage.json (layout.page / layout.card2), heroes.json, skills.json.
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SKILL_COLORS, UI } from '../../config.js';
import { drawWindow, drawStrip, backdropStrip } from '../../entities/uiKit.js';
import { floorCrop } from '../../entities/floorTexture.js';
import { heroBanner, hasBanner } from '../../entities/heroBanner.js';
import { skillIconKey } from '../../entities/skillIconTexture.js';
import * as sfx from '../../audio/sfx.js';
import D from '../../data/heroPage.json';
import skills from '../../data/skills.json';
import dungeons from '../../data/dungeons.json';

const L = D.layout, X = L.side, W = GAME_WIDTH - L.side * 2, CX = GAME_WIDTH / 2, P = L.pad, GAP = 12;
const gold = () => Phaser.Display.Color.HexStringToColor(UI.gold).color;
const DIM = Number(L.dim);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const ATK_COL = () => hex(SKILL_COLORS.attack.ready + 0x303030);
const FLOOR = () => dungeons.A.tileColors[0];
// The 7 hero stats, in order: [label, stat key, suffix].
const STATS = [['HP', 'health', ''], ['ATK', 'attack', ''], ['DEF', 'defense', ''], ['RES', 'resist', ''], ['CRIT', 'crit', '%'], ['DODGE', 'evasion', '%'], ['SPEED', 'attackEfficiency', '%']];
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

const SEC = 28; // a section's title strip height

// A section: a window with a title strip (the DUSK look's strip, salmon title). Returns where its content starts.
function section(s, page, x, y, w, h, title) {
  win(s, page, x, y, w, h);
  page.add(drawStrip(s.add.graphics(), x + 2, y + 2, w - 4, SEC - 2));
  s.text(page, x + P, y + SEC / 2 + 1, title, 'small', UI.goldTheme.title).setOrigin(0, 0.5);
  return y + SEC + 8;
}

// The 7 hero stats as label + value cells, `cols` per row (no window). Returns the y under them.
function statCells(s, page, def, x, y, w, cols = 4, rh = 24) {
  STATS.forEach(([k, key, suf], i) => {
    const sx = x + (i % cols) * (w / cols), sy = y + rh / 2 + Math.floor(i / cols) * rh;
    const a = s.text(page, sx, sy, k, 'small').setOrigin(0, 0.5);
    s.text(page, sx + a.width + 6, sy, `${def.stats[key]}${suf}`, 'small', UI.gold).setOrigin(0, 0.5);
  });
  return y + Math.ceil(STATS.length / cols) * rh;
}

// The looks in a row of small tiles (tap = try on; the page redraws). Returns the y under it.
function lookRow(s, page, def, x, y, w, h, redraw) {
  const looks = s.looksOf(def), cur = s.wearing(def), n = Math.max(3, looks.length), tw = (w - 8 * (n - 1)) / n;
  looks.forEach((l, i) => {
    const tx = x + i * (tw + 8), on = l === cur;
    win(s, page, tx, y, tw, h, { line: on ? gold() : l.owned ? UI.line : DIM, fill: UI.goldTheme.tileFill });
    s.hero(page, def, tx + tw / 2, y + h - 36, 2, false, l.look);
    s.text(page, tx + tw / 2, y + h - 28, l.name.toUpperCase(), 'small', on ? UI.gold : UI.text).setOrigin(0.5, 0);
    s.text(page, tx + tw / 2, y + h - 14, l.owned ? D.armoury.owned : `${l.price} ${D.armoury.currency}`, 'small', l.owned ? UI.green : UI.dim).setOrigin(0.5, 0);
    page.add(s.add.zone(tx, y, tw, h).setOrigin(0).setInteractive({ useHandCursor: true }).onPress(() => {
      if (s.modal || on) return;
      sfx.play('tap'); s.tryOn[def.id] = l.id; redraw();
    }));
  });
  if (looks.length < n) {
    const fx = x + looks.length * (tw + 8), fw = w - looks.length * (tw + 8);
    s.text(page, fx + fw / 2, y + h / 2, D.armoury.soon, 'small', UI.dim, { align: 'center', wordWrap: { width: fw - 12 } }).setOrigin(0.5);
  }
  return y + h;
}

// The kit, PASSIVE first (user: 'the passive should be the highest'), then attack, support, perk; each with its icon,
// name, when it works and its full description. Returns the y under it.
function kitRows(s, page, def, x, y, w) {
  const atk = skills[def.skills.attack], sup = skills[def.skills.support];
  const rows = [['passive_' + def.id, `PASSIVE - ${def.passive.name}`, UI.fightGold, 'always on', def.passive.description],
    [def.skills.attack, `ATTACK - ${atk.name}`, ATK_COL(), `skill, every ${atk.cooldownMs / 1000}s`, atk.description],
    [def.skills.support, `SUPPORT - ${sup.name}`, UI.green, `skill, every ${sup.cooldownMs / 1000}s`, sup.description],
    [null, `PERK - ${def.perk.name}`, UI.gold, 'helps the whole squad', `Whole squad: ${s.perkText(def)}.`]];
  for (const [icon, title, col, sub, body] of rows) {
    const top = y, ix = x + P, tx = ix + 46;
    const nm = s.text(page, tx, top + P - 2, title.toUpperCase(), 'small', col, { wordWrap: { width: w - P * 2 - 46 } });
    const sb = s.text(page, tx, nm.y + nm.height + 5, sub, 'small', UI.dim);
    const d = s.text(page, ix, Math.max(sb.y + sb.height, top + P + 36) + 10, body, 'small', UI.goldTheme.body, { wordWrap: { width: w - P * 2 }, lineSpacing: 6 });
    const h = d.y + d.height + P - top, g = win(s, page, x, top, w, h);
    behind(page, g, nm);
    const ib = win(s, page, ix, top + P - 4, 36, 36, { line: col === UI.gold ? gold() : UI.line, fill: UI.goldTheme.slot });
    behind(page, ib, nm);
    const key = icon ? skillIconKey(s, icon) : null;
    if (key) page.add(s.add.image(ix + 18, top + P + 14, key).setScale(2));
    else s.text(page, ix + 18, top + P + 14, '+', 'normal', UI.gold).setOrigin(0.5);
    y = top + h + 10;
  }
  return y;
}

// This hero's playtime records (progress.stats.heroRecords, kept from session 37 on): 3 x 2 label + number cells
// (no window). Returns the y under them.
const RECORDS = [['RUNS', 'runs'], ['BEST FLOOR', 'bestFloor'], ['KILLS', 'kills'], ['DEATHS', 'deaths'], ['DAMAGE', 'damage'], ['HEALING', 'healing']];
const num = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
function recordCells(s, page, def, x, y, w, rh) {
  const r = ((s.progress.stats || {}).heroRecords || {})[def.id] || {}, cw = w / 3;
  const g = s.add.graphics().fillStyle(UI.goldTheme.tileEdge, 1); page.add(g);
  RECORDS.forEach(([label, key], i) => {
    const cx = x + (i % 3) * cw + cw / 2, cy = y + Math.floor(i / 3) * rh;
    s.text(page, cx, cy + 4, label, 'small', UI.dim).setOrigin(0.5, 0);
    s.text(page, cx, cy + 20, num(r[key]), 'normal', UI.gold).setOrigin(0.5, 0);
  });
  g.fillRect(x + cw, y + 2, 2, rh * 2 - 8).fillRect(x + cw * 2, y + 2, 2, rh * 2 - 8).fillRect(x + 8, y + rh - 4, w - 16, 2);
  return y + rh * 2;
}

// Drag (or mouse wheel) scrolls `body` between the top bar (viewTop) and the screen bottom; a thin bar shows where.
// `page` holds only the top bar and `body` when this is called.
function scrollable(s, page, body, viewTop, bottom) {
  const viewH = GAME_HEIGHT - viewTop, contentH = bottom + 16 - viewTop, max = Math.max(0, contentH - viewH);
  if (!max) return;
  // The content scrolls up UNDER a strip of page background, and the top bar (BACK) is moved over that strip
  // (session 58: no mask, see uiKit backdropStrip).
  const bar0 = page.list.filter((o) => o !== body);
  page.add(backdropStrip(s, viewTop));
  for (const o of bar0) page.bringToTop(o);
  const bar = s.add.graphics(); page.add(bar);
  let at = 0, drag = null;
  const set = (v) => {
    at = Math.max(0, Math.min(max, v)); body.y = -at;
    const bh = Math.max(30, (viewH * viewH) / contentH), by = viewTop + (viewH - bh) * (at / max);
    bar.clear().fillStyle(DIM, 1).fillRect(GAME_WIDTH - 9, viewTop + 4, 4, viewH - 8).fillStyle(gold(), 1).fillRect(GAME_WIDTH - 9, Math.round(by), 4, Math.round(bh));
  };
  const down = (p) => { if (p.y >= viewTop) drag = { y: p.y, at }; };
  const move = (p) => { if (drag && p.isDown) set(drag.at - (p.y - drag.y)); };
  const up = () => { drag = null; };
  const wheel = (p, o, dx, dy) => set(at + dy);
  s.input.on('pointerdown', down); s.input.on('pointermove', move); s.input.on('pointerup', up); s.input.on('wheel', wheel);
  body.once('destroy', () => { s.input.off('pointerdown', down); s.input.off('pointermove', move); s.input.off('pointerup', up); s.input.off('wheel', wheel); });
  set(0);
}

// ---------- HERO PAGE (pick 4: banner backdrop; user: 'make everything neater') ----------
// The hero in front of their banner (no text over the art), name + role under the card, then two sections:
// YOUR RECORDS and LOOKS, then HERO DETAILS. Every gap is GAP; sections share one look (window + title strip).
export function heroPage(s, def) {
  const page = s.newPage(), C = L.page, redraw = () => s.showHero(def);
  s.top(page, '< BACK', null, () => s.showList());
  let y = C.y;
  win(s, page, X, y, W, C.h, { line: gold(), fill: 0x14141c });
  page.add(floorCrop(s, FLOOR(), 200, X + 2, y + C.floorY, W - 4, C.h - C.floorY - 2));
  if (hasBanner(def.id)) page.add(heroBanner(s, def.id, X + 3, y + 2, L.banner.scale, W - 4, C.floorY - 2));
  page.add(s.add.graphics().fillStyle(gold(), 1).fillRect(X + 2, y + C.floorY, W - 4, 2));
  page.add(s.add.ellipse(CX, y + C.feetDy, 84, 14, 0x000000, 0.35));
  s.hero(page, def, CX, y + C.feetDy, C.heroScale, false, s.wearing(def).look);
  y = namePlate(s, page, def, CX, y + C.h + 10) + GAP;
  const rh = C.recordH, rt = section(s, page, X, y, W, SEC + 8 + rh * 2 + 6, D.recordsTitle);
  y = recordCells(s, page, def, X + 4, rt, W - 8, rh) + 6 + GAP;
  const lt = section(s, page, X, y, W, SEC + 8 + C.lookH + 10, D.armouryTitle);
  y = lookRow(s, page, def, X + 10, lt, W - 20, C.lookH, redraw) + 10 + GAP;
  s.button(page, X, y, W, C.buttonH, D.detailsButton, () => { sfx.play('tap'); s.showEntry(def, () => s.showHero(def)); }, 'solid');
}

// ---------- GLOSSARY HERO (pick F: card; user: 'describe the skills, passive first, a longer story') ----------
// Scrolls (drag): hero, name + role/type, one-line summary, STORY, STATS, the kit in full (passive first).
// `onBack` = where BACK goes (the list, or the hero page when opened from HERO DETAILS).
export function glossaryPage(s, def, onBack = () => s.showList()) {
  const page = s.newPage(), C = L.card2;
  s.top(page, '< BACK', null, onBack);
  const body = s.add.container(0, 0); page.add(body);
  let y = C.y;
  stage(s, body, def, X, y, W, C.stageH, C.heroScale, C.feetDy);
  y = namePlate(s, body, def, CX, y + C.stageH + 10, 'big', typeLine(def)) + 8;
  const sum = s.text(body, CX, y, def.summary || '', 'small', UI.text, { wordWrap: { width: W - 20 }, align: 'center', lineSpacing: 5 }).setOrigin(0.5, 0);
  y = sum.y + sum.height + GAP;
  // STORY: its height comes from the text.
  const st = s.text(body, X + P, 0, D.lore[def.id] || '???', 'small', UI.goldTheme.body, { wordWrap: { width: W - P * 2 }, lineSpacing: 6 });
  const sh = SEC + 8 + st.height + P, sg = drawWindow(s.add.graphics(), X, y, W, sh); body.addAt(sg, body.list.indexOf(st));
  const strip = drawStrip(s.add.graphics(), X + 2, y + 2, W - 4, SEC - 2); body.addAt(strip, body.list.indexOf(st));
  s.text(body, X + P, y + SEC / 2 + 1, D.storyTitle, 'small', UI.goldTheme.title).setOrigin(0, 0.5);
  st.setY(y + SEC + 8);
  y += sh + GAP;
  const ct = section(s, body, X, y, W, SEC + 8 + 2 * 24 + 6, D.statsTitle);
  y = statCells(s, body, def, X + P, ct, W - P * 2, 4) + 6 + GAP;
  y = kitRows(s, body, def, X, y, W);
  scrollable(s, page, body, L.back.y + L.back.h + 6, y);
}
