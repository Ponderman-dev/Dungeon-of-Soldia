import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SKILL_COLORS, UI } from '../config.js';
import { drawWindow, uiText, comingSoonWindow, drawButton, buttonTextColor, pageEnter, pageLeave, markBar, pageBackdrop } from '../entities/uiKit.js';
import Character from '../entities/Character.js';
import { floorCrop } from '../entities/floorTexture.js';
import D from '../data/heroPage.json';
import heroes from '../data/heroes.json';
import skills from '../data/skills.json';
import unlocks from '../data/unlocks.json';
import dungeons from '../data/dungeons.json';
import shop from '../data/shop.json';
import { lookDef } from '../systems/looks.js';
import { heroBanner, hasBanner } from '../entities/heroBanner.js';
import { perkMods } from '../systems/party.js';
import { loadProgress, isUnlocked, requirementProgress, describeRequirement } from '../systems/progress.js';
import * as sfx from '../audio/sfx.js';

// The Heroes button (docs/systems/title-base.md section 5, user's pick C), opened over the camp (the camp waits,
// paused). LIST: every hero in 2 columns (locked = a shadow, its goal and a progress bar). HERO PAGE (session 57, user:
// 'banner, stats, armoury, not lore'): the hero's BANNER on top (entities/heroBanner.js), the hero big on the dungeon
// floor wearing the look being tried, an HP / ATK / DEF / RES strip, ARMOURY (looks: try on) and STATS (RECORDS / KIT).
// Opened from the GLOSSARY instead (session 57, user: 'two different pages'): the list opens a SHORT glossary entry
// (showEntry; heroPage.json glossaryStyle A / B / C while the user picks; dev url ?ghero=A|B|C). Data: heroPage.json.
const L = D.layout;
const gold = () => Phaser.Display.Color.HexStringToColor(UI.gold).color; // read when drawn
const DIM = Number(L.dim);
const SHADOW = 0x1c1c26;
const W = GAME_WIDTH - L.side * 2;
const STAT_SHORT = { attack: 'ATK', health: 'HP', defense: 'DEF', resist: 'RES', evasion: 'DODGE', crit: 'CRIT', attackEfficiency: 'SPD' };
const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const perkText = (def) => perkMods({ def, level: 1 }).map((m) => `${m.percent !== undefined ? `+${m.percent}%` : `+${m.flat}`} ${STAT_SHORT[m.stat] || ({ skillDamage: 'skill damage', regen: 'health/s', dotDamage: 'damage over time' })[m.special] || m.special}`).join(', ');
// The Glossary entry style being picked (A / B / C): heroPage.json, or the dev url flag ?ghero=X.
const glossaryStyle = () => {
  try { if (import.meta.env.DEV) { const q = new URLSearchParams(window.location.search).get('ghero'); if (q) return q.toUpperCase(); } } catch { /* no url */ }
  return D.glossaryStyle || 'A';
};

export default class HeroesScene extends Phaser.Scene {
  constructor() {
    super('Heroes');
  }

  init(data) {
    this.from = (data && data.from) || 'Base';
    this.modal = null;
  }

  create() {
    this.scene.bringToTop();
    this.progress = loadProgress();
    pageBackdrop(this, Number(L.bg)).setInteractive();
    this.page = null;
    this.tryOn = {}; // hero id -> look id being tried on (ARMOURY), this visit only
    this.showList();
    pageEnter(this); // the page slides in from the side (uiKit)
  }

  // ---- helpers -----------------------------------------------------------------------------------

  newPage() {
    if (this.page) this.page.destroy();
    this.page = this.add.container(0, 0);
    return this.page;
  }

  button(page, x, y, w, h, label, onTap, look = 'plain', size = 'normal') {
    const line = { plain: UI.line, gold: gold(), dim: DIM, solid: UI.line }[look];
    page.add(look === 'solid' ? drawButton(this.add.graphics(), x, y, w, h) : drawWindow(this.add.graphics(), x, y, w, h, { line }));
    page.add(uiText(this, x + w / 2, y + h / 2, label, size, { plain: UI.text, gold: UI.gold, dim: UI.dim, solid: buttonTextColor() }[look]).setOrigin(0.5));
    page.add(this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true }).onPress(() => { if (!this.modal) onTap(); }));
  }

  text(page, x, y, str, size = 'normal', color = UI.text, extra = {}) {
    const t = uiText(this, x, y, str, size, color, extra);
    page.add(t);
    return t;
  }

  top(page, back, title, onBack) {
    const B = L.back, n0 = page.list.length;
    this.button(page, B.x, B.y, B.w, B.h, back, () => { sfx.play('tap'); onBack(); }, 'solid');
    markBar(page.list.slice(n0)); // the page's top bar (uiKit)
    if (title) this.text(page, GAME_WIDTH / 2, L.titleY, title, 'big').setOrigin(0.5, 0);
  }

  hero(page, def, x, feet, scale, shadow = false, look = null) {
    const ch = new Character(this, x, feet, look ? lookDef(def, look) : def).setScale(scale);
    if (shadow) for (const p of Object.values(ch.parts)) p.image.setTint(SHADOW).setTintMode(Phaser.TintModes.FILL);
    page.add(ch);
    return ch;
  }

  isOpen(id) {
    return isUnlocked(id, this.progress, unlocks);
  }

  // ---- LIST --------------------------------------------------------------------------------------

  showList() {
    const page = this.newPage(), Li = L.list, x = L.side, w = (W - Li.gap) / 2;
    this.top(page, this.from === 'Base' ? '< CAMP' : '< BACK', 'HEROES', () => this.close());
    heroes.forEach((def, i) => {
      const cx = x + (i % 2) * (w + Li.gap), cy = Li.y + Math.floor(i / 2) * (Li.h + Li.gap), open = this.isOpen(def.id);
      page.add(drawWindow(this.add.graphics(), cx, cy, w, Li.h, { line: open ? UI.line : DIM }));
      if (open) {
        this.hero(page, def, cx + w / 2, cy + Li.h - 40, Li.heroScale);
        this.text(page, cx + w / 2, cy + Li.h - 22, D.shortNames[def.id] || def.name.toUpperCase(), 'normal').setOrigin(0.5);
      } else {
        // Locked: name dim on top, the shadow on the left, the goal and how far along on the right.
        const req = unlocks.requirements[def.id], p = requirementProgress(req, this.progress);
        this.text(page, cx + w / 2, cy + 18, D.shortNames[def.id] || def.name.toUpperCase(), 'normal', UI.dim).setOrigin(0.5);
        this.hero(page, def, cx + 34, cy + Li.h - 14, 2, true);
        const gx = cx + 66, gw = w - 66 - L.pad;
        this.text(page, gx, cy + 44, D.shortGoals[req.type].replace('{value}', req.value), 'small', UI.text, { wordWrap: { width: gw } });
        page.add(this.add.graphics().fillStyle(0x26262f, 1).fillRect(gx, cy + 70, gw, Li.barH).fillStyle(gold(), 1).fillRect(gx, cy + 70, Math.round((gw * Math.min(p.have, p.need)) / p.need), Li.barH));
        this.text(page, gx, cy + 84, `${Math.min(p.have, p.need)}/${p.need}`, 'small', UI.gold);
      }
      page.add(this.add.zone(cx, cy, w, Li.h).setOrigin(0).setInteractive({ useHandCursor: true }).onPress(() => {
        if (this.modal) return;
        if (open) { sfx.play('tap'); if (this.from === 'Glossary') this.showEntry(def); else this.showHero(def); return; }
        this.modal = comingSoonWindow(this, def.name, describeRequirement(unlocks.requirements[def.id], unlocks), { onClose: () => this.time.delayedCall(0, () => { this.modal = null; }) });
        const t = this.modal.list.find((o) => o.text === 'Coming soon');
        if (t) t.setText('LOCKED').setColor(UI.dim);
      }));
    });
  }

  // ---- HERO PAGE (pick C) --------------------------------------------------------------------------

  showHero(def) {
    const page = this.newPage(), C = L.card, x = L.side, y = C.y, h = C.artH + C.floorH, cx = GAME_WIDTH / 2;
    this.top(page, '< BACK', null, () => this.showList());
    // One gold card: the art box on top (the user's own pixel art comes later), the dungeon floor under it.
    page.add(drawWindow(this.add.graphics(), x, y, W, h, { line: gold(), fill: 0x14141c }));
    // The banner, at a whole-number scale, centred in the box (heroPage.json banner).
    const Bn = L.banner, bw0 = Bn.w * Bn.scale, bh0 = Bn.h * Bn.scale;
    if (hasBanner(def.id)) page.add(heroBanner(this, def.id, Math.round(cx - Math.min(bw0, W - 4) / 2), y + Math.round((C.artH - bh0) / 2) + 1, Bn.scale, W - 4, C.artH - 2));
    else this.text(page, cx, y + C.artH / 2, 'YOUR PIXEL ART', 'normal', UI.dim).setOrigin(0.5);
    const fy = y + C.artH;
    page.add(floorCrop(this, dungeons.A.tileColors[0], 200, x + 2, fy, W - 4, C.floorH - 2));
    page.add(this.add.graphics().fillStyle(gold(), 1).fillRect(x + 2, fy, W - 4, 2));
    // Name in a window, role in gold under it.
    const name = this.text(page, cx, fy + C.nameY + 22, def.name.toUpperCase(), 'big').setOrigin(0.5);
    const nw = name.width + 40;
    page.addAt(drawWindow(this.add.graphics(), cx - nw / 2, fy + C.nameY, nw, 44), page.list.indexOf(name));
    this.text(page, cx, fy + C.roleY + 10, (def.role || '').toUpperCase(), 'normal', UI.gold, { stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5);
    page.add(this.add.ellipse(cx, fy + C.feetDy, 90, 14, 0x000000, 0.35));
    const looks = this.looksOf(def), wearing = looks.find((l) => l.id === this.tryOn[def.id]) || looks[0];
    this.hero(page, def, cx, fy + C.feetDy, C.heroScale, false, wearing.look);
    // The look being tried (ARMOURY): its name, one dot per look (gold = this one).
    const look = this.text(page, cx, fy + C.lookY + 18, wearing.name.toUpperCase(), 'normal').setOrigin(0.5);
    const lw = look.width + 32;
    page.addAt(drawWindow(this.add.graphics(), cx - lw / 2, fy + C.lookY, lw, 36), page.list.indexOf(look));
    const dots = this.add.graphics();
    looks.forEach((l, i) => dots.fillStyle(l === wearing ? gold() : DIM, 1).fillRect(Math.round(cx - looks.length * 6 + i * 12 + 3), fy + C.lookY + 44, 6, 6));
    page.add(dots);
    // HP / ATK / DEF / RES strip.
    const S = L.strip, st = def.stats;
    page.add(drawWindow(this.add.graphics(), x, S.y, W, S.h));
    [['HP', st.health], ['ATK', st.attack], ['DEF', st.defense], ['RES', st.resist]].forEach(([k, v], i) => {
      const sx = x + L.pad + (i * (W - L.pad * 2)) / 4;
      const a = this.text(page, sx, S.y + S.h / 2, k, 'small').setOrigin(0, 0.5);
      this.text(page, sx + a.width + 8, S.y + S.h / 2, String(v), 'small', UI.gold).setOrigin(0, 0.5);
    });
    const B = L.buttons, bw = (W - B.gap) / 2;
    this.button(page, x, B.y, bw, B.h, 'ARMOURY', () => { sfx.play('tap'); this.showArmoury(def); }, 'solid');
    this.button(page, x + bw + B.gap, B.y, bw, B.h, 'STATS', () => { sfx.play('tap'); this.showStats(def, 'records'); }, 'solid');
  }

  // ---- ARMOURY (looks) ---------------------------------------------------------------------------

  // This hero's looks: CLASSIC (the hero as is) + every shop look for it. owned = can wear it (CLASSIC always).
  looksOf(def) {
    const mine = this.progress.looks || [];
    return [{ id: 'classic', name: D.lookName, look: null, owned: true },
      ...shop.looks.filter((l) => l.hero === def.id).map((l) => ({ id: l.id, name: l.name, look: l, owned: mine.includes(l.id), price: l.price }))];
  }

  // The hero big on the floor in the look being tried, then a tile per look: tap = try it on. Not owned = its gem
  // price (bought in the SHOP). Wearing a look in fights comes later (looks are stand-in recolours for now).
  showArmoury(def) {
    const page = this.newPage(), A = L.armoury, x = L.side, cx = GAME_WIDTH / 2;
    this.top(page, '< BACK', 'ARMOURY', () => this.showHero(def));
    const looks = this.looksOf(def), wearing = looks.find((l) => l.id === this.tryOn[def.id]) || looks[0];
    page.add(drawWindow(this.add.graphics(), x, A.y, W, A.stageH, { line: gold(), fill: 0x14141c }));
    page.add(floorCrop(this, dungeons.A.tileColors[0], 200, x + 2, A.y + 2, W - 4, A.stageH - 4));
    page.add(this.add.ellipse(cx, A.y + A.feetDy, 80, 12, 0x000000, 0.35));
    this.hero(page, def, cx, A.y + A.feetDy, A.heroScale, false, wearing.look);
    const nm = this.text(page, cx, A.y + 18, def.name.toUpperCase() + ' - ' + wearing.name.toUpperCase(), 'normal').setOrigin(0.5, 0);
    page.addAt(drawWindow(this.add.graphics(), cx - nm.width / 2 - 16, A.y + 10, nm.width + 32, 36), page.list.indexOf(nm));
    const tw = (W - A.gap * (A.cols - 1)) / A.cols, ty = A.y + A.stageH + A.gap;
    looks.forEach((l, i) => {
      const tx = x + (i % A.cols) * (tw + A.gap), tyy = ty + Math.floor(i / A.cols) * (A.tileH + A.gap), on = l === wearing;
      page.add(drawWindow(this.add.graphics(), tx, tyy, tw, A.tileH, { line: on ? gold() : l.owned ? UI.line : DIM }));
      this.hero(page, def, tx + tw / 2, tyy + A.tileH - 44, A.tileScale, false, l.look);
      this.text(page, tx + tw / 2, tyy + A.tileH - 34, l.name.toUpperCase(), 'small', on ? UI.gold : UI.text).setOrigin(0.5, 0);
      this.text(page, tx + tw / 2, tyy + A.tileH - 18, l.owned ? D.armoury.owned : `${l.price} ${D.armoury.currency}`, 'small', l.owned ? UI.green : UI.dim).setOrigin(0.5, 0);
      page.add(this.add.zone(tx, tyy, tw, A.tileH).setOrigin(0).setInteractive({ useHandCursor: true }).onPress(() => {
        if (this.modal || on) return;
        sfx.play('tap'); this.tryOn[def.id] = l.id; this.showArmoury(def);
      }));
    });
    const rows = Math.ceil(looks.length / A.cols), ny = ty + rows * (A.tileH + A.gap) + 4;
    this.text(page, cx, ny, looks.length > 1 ? D.armoury.note : D.armoury.noneYet, 'small', UI.dim, { wordWrap: { width: W }, align: 'center' }).setOrigin(0.5, 0);
  }

  // ---- GLOSSARY ENTRY (the short page, opened from the Glossary) ------------------------------------

  // Hero on a floor strip, name + role beside it. Returns the y under it.
  entryHead(page, def, y) {
    const E = L.entry, x = L.side;
    page.add(drawWindow(this.add.graphics(), x, y, W, E.headH, { line: gold(), fill: 0x14141c }));
    page.add(floorCrop(this, dungeons.A.tileColors[0], 200, x + 2, y + 2, E.stageW, E.headH - 4));
    page.add(this.add.ellipse(x + 2 + E.stageW / 2, y + E.headH - 18, 50, 9, 0x000000, 0.35));
    this.hero(page, def, x + 2 + E.stageW / 2, y + E.headH - 18, E.heroScale);
    const tx = x + E.stageW + 18;
    this.text(page, tx, y + 22, def.name.toUpperCase(), 'big');
    this.text(page, tx, y + 64, (def.role || '').toUpperCase(), 'normal', UI.gold);
    const st = def.stats;
    this.text(page, tx, y + 98, `HP ${st.health}  ATK ${st.attack}\nDEF ${st.defense}  RES ${st.resist}`, 'small', UI.text, { lineSpacing: 8 });
    return y + E.headH + L.kit.gap;
  }

  // A window with a coloured title and wrapped text. Returns the y under it.
  entryBox(page, y, title, body, color) {
    const x = L.side, P = L.pad;
    const t = this.text(page, x + P, y + P + 28, body, 'small', UI.text, { wordWrap: { width: W - P * 2 }, lineSpacing: 7 });
    const h = t.height + P * 2 + 28;
    page.addAt(drawWindow(this.add.graphics(), x, y, W, h), page.list.indexOf(t));
    this.text(page, x + P, y + P, title, 'normal', color);
    return y + h + L.kit.gap;
  }

  // Style A = KIT (skills, perk, passive), B = STORY (lore + how it fights), C = SHORT (how it fights + skill names).
  showEntry(def) {
    const page = this.newPage();
    this.top(page, '< BACK', null, () => this.showList());
    const style = glossaryStyle();
    let y = this.entryHead(page, def, L.entry.y);
    const atk = skills[def.skills.attack], sup = skills[def.skills.support];
    if (style === 'B') {
      y = this.entryBox(page, y, 'STORY', D.lore[def.id] || '???', UI.gold);
      if (def.summary) y = this.entryBox(page, y, 'IN A FIGHT', def.summary, UI.text);
      if (def.tips && def.tips.length) this.entryBox(page, y, 'TIP', def.tips[0], UI.text);
    } else if (style === 'C') {
      if (def.summary) y = this.entryBox(page, y, 'IN A FIGHT', def.summary, UI.text);
      const line = (k, v) => `${k}: ${v}`;
      this.entryBox(page, y, 'KIT', [line('ATTACK', `${atk.name} (${atk.cooldownMs / 1000}s)`), line('SUPPORT', `${sup.name} (${sup.cooldownMs / 1000}s)`),
        line('PERK', def.perk.name), line('PASSIVE', def.passive.name)].join('\n'), UI.gold);
    } else {
      y = this.entryBox(page, y, `ATTACK - ${atk.name.toUpperCase()}`, `Every ${atk.cooldownMs / 1000}s. ${atk.description}`, hex(SKILL_COLORS.attack.ready + 0x303030));
      y = this.entryBox(page, y, `SUPPORT - ${sup.name.toUpperCase()}`, `Every ${sup.cooldownMs / 1000}s. ${sup.description}`, UI.green);
      y = this.entryBox(page, y, `PERK - ${def.perk.name.toUpperCase()}`, `Whole squad: ${perkText(def)}.`, UI.gold);
      this.entryBox(page, y, `PASSIVE - ${def.passive.name.toUpperCase()}`, def.passive.description, UI.text);
    }
  }

  // ---- STATS: RECORDS / KIT ------------------------------------------------------------------------

  showStats(def, tab) {
    const page = this.newPage(), x = L.side, T = L.tabs, tw = (W - T.gap) / 2;
    this.top(page, '< BACK', def.name.toUpperCase(), () => this.showHero(def));
    [['records', 'RECORDS'], ['kit', 'KIT']].forEach(([id, label], i) => {
      this.button(page, x + i * (tw + T.gap), T.y, tw, T.h, label, () => { if (id !== tab) { sfx.play('tap'); this.showStats(def, id); } }, id === tab ? 'gold' : 'dim');
    });
    if (tab === 'records') this.drawRecords(page, def);
    else this.drawKit(page, def);
  }

  // This hero's numbers over every run (kept from session 37 on).
  drawRecords(page, def) {
    const r = { runs: 0, bestFloor: 0, kills: 0, damage: 0, healing: 0, deaths: 0, ...(this.progress.stats.heroRecords || {})[def.id] };
    const R = L.records, x = L.side, w = (W - R.gap) / 2;
    [['RUNS', r.runs], ['BEST FLOOR', r.bestFloor], ['KILLS', r.kills], ['DEATHS', r.deaths], ['DAMAGE', r.damage], ['HEALING', r.healing]].forEach(([label, v], i) => {
      const bx = x + (i % 2) * (w + R.gap), by = R.y + Math.floor(i / 2) * (R.h + R.gap);
      page.add(drawWindow(this.add.graphics(), bx, by, w, R.h));
      this.text(page, bx + L.pad, by + 14, label, 'small', UI.dim);
      this.text(page, bx + L.pad, by + 30, num(v), 'normal');
    });
    const y = R.y + 3 * (R.h + R.gap) + 4;
    this.text(page, GAME_WIDTH / 2, y, 'Counted from runs played since this update.', 'small', UI.dim).setOrigin(0.5, 0);
  }

  // Full stats, then attack skill, support skill, perk and passive, each in a card.
  drawKit(page, def) {
    const x = L.side, P = L.pad, st = def.stats;
    let y = L.kit.y;
    const g = drawWindow(this.add.graphics(), x, y, W, 64);
    page.add(g);
    [['HP', st.health], ['ATK', st.attack], ['DEF', st.defense], ['RES', st.resist], ['CRIT', `${st.crit}%`], ['DODGE', `${st.evasion}%`]].forEach(([k, v], i) => {
      const sx = x + P + (i % 3) * ((W - P * 2) / 3), sy = y + 20 + Math.floor(i / 3) * 24;
      const a = this.text(page, sx, sy, k, 'small').setOrigin(0, 0.5);
      this.text(page, sx + a.width + 8, sy, String(v), 'small', UI.gold).setOrigin(0, 0.5);
    });
    y += 64 + L.kit.gap;
    const card = (head, color, extra, body) => {
      const t = this.text(page, x + P, 0, body, 'small', UI.text, { wordWrap: { width: W - P * 2 }, lineSpacing: 6 });
      const top = extra ? 56 : 40;
      t.setY(y + top);
      const h = top + t.height + P - 2;
      page.addAt(drawWindow(this.add.graphics(), x, y, W, h), page.list.indexOf(t));
      this.text(page, x + P, y + 12, head, 'normal', color, { wordWrap: { width: W - P * 2 } });
      if (extra) this.text(page, x + P, y + 38, extra, 'small', UI.dim);
      y += h + L.kit.gap;
    };
    const atk = skills[def.skills.attack], sup = skills[def.skills.support];
    const perk = perkText(def);
    card(`ATTACK - ${atk.name.toUpperCase()}`, hex(SKILL_COLORS.attack.ready + 0x303030), `every ${atk.cooldownMs / 1000}s`, atk.description);
    card(`SUPPORT - ${sup.name.toUpperCase()}`, UI.green, `every ${sup.cooldownMs / 1000}s`, sup.description);
    card(`PERK - ${def.perk.name.toUpperCase()}`, UI.gold, null, `Whole squad: ${perk}.`);
    card(`PASSIVE - ${def.passive.name.toUpperCase()}`, UI.text, null, def.passive.description);
  }

  close() {
    if (this.pageLeaving) return;
    pageLeave(this, () => { this.scene.resume(this.from); this.scene.stop(); }); // the page slides away first (uiKit)
  }
}
