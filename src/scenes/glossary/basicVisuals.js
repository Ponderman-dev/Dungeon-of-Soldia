// Part of GlossaryScene (mixed into its prototype; `this` is the scene). The BASICS pictures (session 53, user: 'the
// basics need visuals'; picked: GAME ART ONLY, animated loops). glossary.json basics[i].visual names one of the
// visual_<name> methods below; each draws into `page` inside the box (x, y, w, h) with the game's own sprites, icons,
// health bars, hit effects (systems/hitFx.js: the SAME recipes the fight paints) and pop-up words / colours.
// User round 2: 'make it look like in game' (drag = the red / white order line, on-hit icon pops over the HERO and the
// debuff sits over the enemy's health bar, real projectiles drawn bigger, LEVEL UP like the fight's).
import Phaser from 'phaser';
import { UI, CHAR_SCALE } from '../../config.js';
import { drawWindow, drawCursor } from '../../entities/uiKit.js';
import { bareIconKey, itemIconKey } from '../../entities/itemIconTexture.js';
import { skillIconKey } from '../../entities/skillIconTexture.js';
import { statusIconKey } from '../../entities/statusIconTexture.js';
import { drawGrave } from '../../entities/grave.js';
import { projectileFx, impactFx, critFx, dodgeFx, blockFx, soakFx, deathPuffFx, IMPACT_MS, CRIT_MS } from '../../systems/hitFx.js';
import { bodyBox } from '../../systems/statusFx.js';
import heroes from '../../data/heroes.json';
import enemies from '../../data/enemies.json';
import items from '../../data/items.json';
import roomProps from '../../data/roomProps.json';
import damageTypes from '../../data/damageTypes.json';
import combat from '../../data/combat.json';
import G from '../../data/glossary.json';

const V = G.layout.basics.visuals; // which heroes / enemies / items / timings each picture uses
const FXC = combat.skillFx; // the fight's number colours: damage (attackColor), heal; crits / LEVEL UP use UI.fightGold
const SHOT_S = V.shotScale || 4; // projectiles are drawn bigger than in the fight (user: 'hard to see 2 dots')
const BAR_W = 44; // the fight's health bar width (battle/shared.js BAR_WIDTH)
const hero = (id) => heroes.find((h) => h.id === id);
const enemy = (id) => ({ id, ...enemies[id] });
const hex = (c) => Phaser.Display.Color.HexStringToColor(c).color;
const gold = () => hex(UI.gold);

export const basicVisualMethods = {
  // The picture box: a dark recessed panel, the picture, and on top a layer for the hit effects (painted every frame).
  basicVisual(page, kind, x, y, w, h) {
    page.add(this.add.graphics().fillStyle(UI.goldTheme.slot, 1).fillRect(x, y, w, h));
    const draw = this['visual_' + kind];
    this.vFxList = [];
    this.vFxG = this.add.graphics();
    if (draw) draw.call(this, page, x, y, w, h);
    page.add(this.vFxG);
    this.events.on('update', this.vFxPaint, this);
  },
  pictureHeight(kind) { return (V[kind] && V[kind].h) || G.layout.basics.picH; },

  // ---------- motion: short loops; every tween / timer is kept so a new page stops them (visualStop) ----------
  vTween(cfg) { const t = this.tweens.add(cfg); (this.vMotion ||= []).push(t); return t; },
  vLoop(ms, fn) { fn(); const e = this.time.addEvent({ delay: ms, loop: true, callback: fn }); (this.vMotion ||= []).push(e); return e; },
  vLater(ms, fn) { const e = this.time.delayedCall(ms, fn); (this.vMotion ||= []).push(e); return e; },
  visualStop() {
    for (const m of this.vMotion || []) { if (m.remove) m.remove(false); if (m.stop) m.stop(); }
    this.vMotion = []; this.vFxList = [];
    this.events.off('update', this.vFxPaint, this);
    for (const f of this.vTicks || []) this.events.off('update', f);
    this.vTicks = [];
  },
  vTick(fn) { this.events.on('update', fn); (this.vTicks ||= []).push(fn); },
  vTint(ch, color) { for (const p of Object.values(ch.parts)) { if (color === null) p.image.clearTint(); else p.image.setTint(color).setTintMode(Phaser.TintModes.FILL); } },
  vIdle(o, delay = 0) { this.vTween({ targets: o, y: o.y - 2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay }); return o; },
  vFace(ch, left) { ch.setScale((left ? -1 : 1) * Math.abs(ch.scaleX), ch.scaleY); return ch; },
  vLabel(page, x, y, text, color = UI.dim) { return this.text(page, x, y, text, 'small', color).setOrigin(0.5, 0); },

  // ---------- the fight's hit effects (systems/hitFx.js), painted in character pixels like effects.js drawHitFx ----------
  vFxPaint() {
    const g = this.vFxG;
    if (!g || !g.active) return;
    g.clear();
    const now = this.time.now;
    this.vFxList = (this.vFxList || []).filter((f) => now - f.start < f.ms);
    for (const f of this.vFxList) {
      const out = f.fn(Math.min(1, (now - f.start) / f.ms), now);
      const draws = Array.isArray(out) ? out : out.draws || [];
      for (const [px, py, pw, ph, c, a] of draws) g.fillStyle(c, a).fillRect(px * f.S - f.S / 2, py * f.S, pw * f.S, ph * f.S);
    }
  },
  vFx(ms, S, fn) { this.vFxList.push({ start: this.time.now, ms, S, fn }); },
  // a sprite's body in character pixels (effects.js fxBody), for hits on it; side = the side the hit comes from
  vBody(ch, def, from) {
    const S = CHAR_SCALE, box = (ch.vBox ||= bodyBox(def.parts, def.height)), k = Math.abs(ch.scaleY) / S;
    const x = (ch.x + box.cx * ch.scaleX) / S, y = ch.y / S;
    return { x, y, top: y + box.top * k, mid: y + box.mid * k, bot: y + box.bot * k, hw: box.hw * k, side: from < ch.x ? -1 : 1 };
  },
  // a hit landing on a sprite: type = a damage type, or kind = 'crit' | 'dodge' | 'block' | 'soak'
  vImpact(ch, def, from, type = 'melee', kind = null) {
    const S = CHAR_SCALE, x0 = ch.x;
    if (kind === 'crit') return this.vFx(CRIT_MS, S, (q, now) => critFx(q, this.vBody(ch, def, from), now));
    if (kind === 'dodge') return this.vFx(500, S, (q) => { const o = dodgeFx(q, this.vBody(ch, def, from)); ch.x = q >= 0.98 ? x0 : x0 + o.dx * S; return o.draws; });
    if (kind === 'block') return this.vFx(420, S, (q) => blockFx(q, this.vBody(ch, def, from)));
    if (kind === 'soak') return this.vFx(420, S, (q) => soakFx(q, this.vBody(ch, def, from)));
    return this.vFx(IMPACT_MS[type] || 300, S, (q, now) => impactFx(type, q, this.vBody(ch, def, from), now, 7, null, type === 'melee'));
  },
  // a shot (arrow, fire bolt, ice shard, spark, dark orb) flying from a to b, drawn bigger; onHit when it lands
  vShot(type, a, b, ms, onHit) {
    const S = SHOT_S, start = { x: a.x / S, y: a.y / S }, end = { x: b.x / S, y: b.y / S };
    this.vFx(ms, S, (q, now) => projectileFx(type, start, { x: start.x + (end.x - start.x) * q, y: start.y + (end.y - start.y) * q }, now, 3));
    this.vLater(ms, () => { if (onHit) onHit(); });
  },
  vPuff(x, y) { const S = CHAR_SCALE; this.vFx(500, S, (q) => deathPuffFx(q, x / S, y / S)); },
  // a melee strike: a step toward the target and back; onHit at the turn
  vStrike(ch, toward, onHit, px = 12) {
    const x0 = ch.x, dir = toward > x0 ? 1 : -1;
    this.vTween({ targets: ch, x: x0 + dir * px, duration: 110, yoyo: true, ease: 'Quad.easeOut', onYoyo: () => { if (onHit) onHit(); }, onComplete: () => ch.setX(x0) });
  },
  vFlash(ch) { this.vTint(ch, 0xffffff); this.vLater(70, () => this.vTint(ch, null)); },
  // a pop-up number / word like the fight's (bold, dark outline); it pops in, rises and fades
  visualNumber(page, x, y, text, color, px = 16) {
    return this.text(page, x, y, text, px, color, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 4, align: 'center' }).setOrigin(0.5, 1);
  },
  vWord(page, x, y, text, color, px = FXC.numberSizePx) {
    const t = this.visualNumber(page, x, y, text, color, px);
    t.setScale(0.6); this.vTween({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.vTween({ targets: t, y: y - 14, alpha: 0, delay: 650, duration: 450, onComplete: () => t.destroy() });
    return t;
  },
  // a health bar over a sprite like the fight's: black frame, green (hero) / red (enemy) fill, an optional light-blue
  // shield line above it and a hero's 'Lv' label on its left. Returns { y, set(frac, shield), lv }.
  vBar(page, ch, def, side, { lv = null, shield = 0 } = {}) {
    const top = Math.round(ch.y - (def.height || 24) * Math.abs(ch.scaleY) - 10), x = ch.x;
    const g = this.add.graphics(); page.add(g);
    const lvT = lv ? this.text(page, x - BAR_W / 2 - 3, top, lv, 8, UI.fightGold, { stroke: '#000000', strokeThickness: 3 }).setOrigin(1, 0.5) : null;
    const bar = { y: top, lv: lvT, frac: 1, shield };
    bar.set = (frac, sh = bar.shield) => {
      bar.frac = Math.max(0, frac); bar.shield = sh;
      g.clear().fillStyle(0x000000, 1).fillRect(x - BAR_W / 2 - 1, top - 4, BAR_W + 2, 7)
        .fillStyle(side === 'hero' ? 0x4cd16a : 0xe04b4b, 1).fillRect(x - BAR_W / 2, top - 3, Math.round(BAR_W * bar.frac), 5);
      if (sh > 0) g.fillStyle(0x103050, 1).fillRect(x - BAR_W / 2 - 1, top - 9, Math.round(BAR_W * sh) + 2, 5).fillStyle(0x6fd0ff, 1).fillRect(x - BAR_W / 2, top - 8, Math.round(BAR_W * sh), 3);
    };
    bar.show = (on) => g.setVisible(on);
    bar.set(1, shield);
    return bar;
  },
  // the item's framed icon jumping up over its holder, holding, then floating up and fading (effects.js iconPop)
  vIconPop(page, x, barY, itemId) {
    const def = items[itemId], img = this.add.image(x, barY - 12, itemIconKey(this, itemId, def.rarity)).setScale(2).setAlpha(0);
    page.add(img);
    this.vTween({ targets: img, y: barY - 24, alpha: 1, duration: 140, ease: 'Back.easeOut' });
    this.vTween({ targets: img, y: barY - 34, alpha: 0, delay: 700, duration: 300, onComplete: () => img.destroy() });
  },
  // a pixel arrow pointing right (between floors)
  visualArrow(page, cx, cy, color = UI.dim) {
    const g = this.add.graphics().fillStyle(hex(color), 1);
    for (let i = 0; i < 4; i++) g.fillRect(cx - 4 + i * 2, cy - 6 + i * 2, 2, 12 - i * 4);
    page.add(g);
  },
  // the fight's order arrow while dragging (orders.js drawOrders): a dark under-line, a red (attack that enemy) or
  // white (walk to that spot) line with a head
  vOrderArrow(g, from, to, red) {
    const col = red ? 0xff4d4d : 0xffffff, ang = Math.atan2(to.y - from.y, to.x - from.x);
    const ex = to.x - Math.cos(ang) * 10, ey = to.y - Math.sin(ang) * 10;
    g.lineStyle(6, 0x1a1020, 0.8).lineBetween(from.x, from.y, ex, ey).lineStyle(3, col, 1).lineBetween(from.x, from.y, ex, ey);
    const head = (k, w) => [to.x - Math.cos(ang) * k + Math.cos(ang + Math.PI / 2) * w, to.y - Math.sin(ang) * k + Math.sin(ang + Math.PI / 2) * w];
    const [l1, l2] = head(16, 9), [r1, r2] = head(16, -9);
    g.fillStyle(col, 1).fillTriangle(to.x, to.y, l1, l2, r1, r2);
  },

  // YOUR SQUAD: three heroes; the third flashes red, falls (a puff), and a tombstone pops up where it stood.
  visual_squad(page, x, y, w, h) {
    const feet = y + h - 14, ids = V.squad.heroes, M = V.squad;
    const chs = ids.map((id, i) => this.sprite(page, hero(id), x + Math.round(w * (i + 1) / (ids.length + 1)), feet, h - 24));
    chs.slice(0, -1).forEach((c, i) => this.vIdle(c, i * 300));
    const last = chs[chs.length - 1], home = last.y;
    const grave = drawGrave(this.add.graphics(), 3).setPosition(last.x, feet); page.add(grave);
    this.vLoop(M.loopMs, () => {
      last.setAlpha(1).setY(home); this.vTint(last, null); grave.setScale(0).setVisible(false);
      [0, 240].forEach((d) => { this.vLater(M.hitMs + d, () => this.vTint(last, 0xff4d4d)); this.vLater(M.hitMs + d + 120, () => this.vTint(last, null)); });
      this.vLater(M.hitMs + 360, () => {
        this.vTween({ targets: last, alpha: 0, y: home + 6, duration: 300 });
        this.vPuff(last.x, home - 10);
        grave.setVisible(true).setScale(0.3);
        this.vTween({ targets: grave, scaleX: 1, scaleY: 1, delay: 200, duration: 260, ease: 'Back.easeOut' });
      });
    });
  },

  // FLOORS: a fight -> a special room (chest) -> ... -> the boss on floor 20. A gold pointer walks along; at the boss,
  // the boss shakes (its roar).
  visual_floors(page, x, y, w, h) {
    const F = V.floors, feet = y + h - 26, slots = [0.14, 0.4, 0.63, 0.86].map((f) => x + Math.round(w * f));
    this.vIdle(this.sprite(page, enemy(F.fight), slots[0], feet, 40));
    const chest = this.sprite(page, roomProps[F.room], slots[1], feet, 40);
    chest.setScale(roomProps[F.room].drawScale || 3);
    this.text(page, slots[2], feet - 18, '. . .', 'normal', UI.dim).setOrigin(0.5);
    const boss = this.sprite(page, enemy(F.boss), slots[3], feet, h - 30, false, 2);
    boss.setScale(Math.min(2, (h - 34) / (enemies[F.boss].height || 32)));
    [[0, '1'], [1, '2'], [3, '20']].forEach(([i, n]) => this.text(page, slots[i], feet + 6, n, 'small', i === 3 ? UI.red : UI.gold).setOrigin(0.5, 0));
    this.visualArrow(page, Math.round((slots[0] + slots[1]) / 2), feet - 18);
    this.visualArrow(page, Math.round((slots[2] + slots[3]) / 2) - 8, feet - 18);
    const ptr = this.add.graphics().fillStyle(gold(), 1); for (let r = 0; r < 4; r++) ptr.fillRect(-6 + r * 2, r * 2, 12 - r * 4, 2);
    page.add(ptr);
    const stops = [[slots[0], feet - 46], [slots[1], feet - 50], [slots[2], feet - 36], [slots[3], y + 4]], bx = boss.x;
    this.vLoop(F.loopMs, () => {
      ptr.setPosition(...stops[0]);
      stops.slice(1).forEach((p, k) => this.vLater((k + 1) * F.stepMs, () => this.vTween({ targets: ptr, x: p[0], y: p[1], duration: 220, ease: 'Quad.easeOut' })));
      this.vLater(3 * F.stepMs + 260, () => this.vTween({ targets: boss, x: bx + 3, duration: 50, yoyo: true, repeat: 5, onComplete: () => boss.setX(bx) }));
    });
  },

  // AUTO BATTLE: nobody taps: the knight walks up to the slime and swings, the archer shoots an arrow from the back.
  visual_auto(page, x, y, w, h) {
    const A = V.auto, feet = y + h - 14, def = enemy(A.enemy);
    const archer = this.sprite(page, hero(A.ranged), x + Math.round(w * 0.12), feet, h - 30);
    const knight = this.sprite(page, hero(A.melee), x + Math.round(w * 0.34), feet, h - 30);
    const foe = this.vIdle(this.vFace(this.sprite(page, def, x + Math.round(w * 0.82), feet, 50), true));
    const kx = knight.x, stop = foe.x - 34;
    this.vLoop(A.loopMs, () => {
      knight.setX(kx);
      this.vTween({ targets: knight, x: stop, duration: 700, ease: 'Sine.easeInOut', onComplete: () => this.vStrike(knight, foe.x, () => { this.vImpact(foe, def, knight.x, 'melee'); this.vWord(page, foe.x, foe.y - 30, A.number, FXC.attackColor); }) });
      this.vLater(1100, () => this.vShot('ranged', { x: archer.x + 12, y: feet - 34 }, { x: foe.x - 10, y: feet - 18 }, 380, () => { this.vImpact(foe, def, archer.x, 'ranged'); this.vWord(page, foe.x + 12, foe.y - 44, A.number, FXC.attackColor); }));
      this.vLater(1700, () => this.vTween({ targets: knight, x: kx, duration: 600, ease: 'Sine.easeInOut' }));
    });
  },

  // SKILLS: the hero casts its attack skill (red square flashes, the hero lunges), then its support skill; the
  // support square goes grey and counts down its cooldown, then lights up green again.
  visual_skills(page, x, y, w, h) {
    const S = V.skills, def = hero(S.hero), cx = x + Math.round(w * 0.24), feet = y + h - 14;
    const ch = this.sprite(page, def, cx, feet, h - 24);
    const size = 48, gap = 14, sy = y + Math.round((h - size) / 2), sx = x + w - (2 * size + gap) - 24;
    const square = (bx, kind) => {
      const frame = this.add.graphics(); page.add(frame);
      const key = skillIconKey(this, def.skills[kind]);
      const icon = key ? this.add.image(bx + size / 2, sy + size / 2, key).setScale(2) : null; if (icon) page.add(icon);
      const shade = this.add.graphics(); page.add(shade);
      const flash = this.add.graphics().fillStyle(0xffffff, 1).fillRect(bx + 2, sy + 2, size - 4, size - 4).setAlpha(0); page.add(flash);
      const num = this.text(page, bx + size / 2, sy + size / 2, '', 'normal', UI.text).setOrigin(0.5);
      const ready = (on) => {
        frame.clear().fillStyle(on ? hex(kind === 'attack' ? UI.red : UI.green) : 0x4a4a5a, 1).fillRect(bx, sy, size, size)
          .fillStyle(UI.goldTheme.slot, 1).fillRect(bx + 2, sy + 2, size - 4, size - 4);
        if (icon) { if (on) icon.clearTint(); else icon.setTint(0x5a5a66); }
      };
      const cool = (frac, left) => { shade.clear(); if (frac > 0) shade.fillStyle(0x2a2a36, 0.85).fillRect(bx + 2, sy + 2, size - 4, Math.round((size - 4) * frac)); num.setText(left > 0 ? String(left) : ''); };
      const press = () => { flash.setAlpha(0.9); this.vTween({ targets: flash, alpha: 0, duration: 220 }); };
      ready(true); cool(0, 0);
      return { ready, cool, press };
    };
    const atk = square(sx, 'attack'), sup = square(sx + size + gap, 'support'), hx = ch.x;
    const lunge = () => this.vTween({ targets: ch, x: hx + 8, duration: 90, yoyo: true, ease: 'Quad.easeOut', onComplete: () => ch.setX(hx) });
    this.vLoop(S.loopMs, () => {
      atk.ready(true); sup.ready(true); sup.cool(0, 0);
      this.vLater(400, () => { atk.press(); lunge(); });
      this.vLater(1300, () => {
        sup.press(); lunge(); sup.ready(false);
        const sec = S.cooldownSec;
        for (let k = 0; k <= sec; k++) this.vLater(k * S.tickMs, () => sup.cool((sec - k) / sec, sec - k));
        this.vLater(sec * S.tickMs, () => sup.ready(true));
      });
    });
  },

  // TAP AND DRAG (the fight's own markers, orders.js): TAP an enemy: a red ring bursts on it and both heroes hit it.
  // DRAG a hero onto an enemy: the RED order line, then only that hero goes for it (orange order rings). DRAG a hero
  // onto the floor: the WHITE line and a white ring where it will stand; it walks there.
  visual_tap(page, x, y, w, h) {
    const T = V.tap, feet = y + h - 14;
    const archer = this.sprite(page, hero(T.heroes[1]), x + Math.round(w * 0.1), feet, h - 34);
    const knight = this.sprite(page, hero(T.heroes[0]), x + Math.round(w * 0.3), feet, h - 34);
    const defs = T.enemies.map(enemy);
    const foes = defs.map((d, i) => this.vIdle(this.vFace(this.sprite(page, d, x + Math.round(w * (0.66 + 0.2 * i)), feet, 46), true), i * 250));
    const marks = this.add.graphics(); page.add(marks);
    const line = this.add.graphics(); page.add(line);
    const cur = this.add.graphics(); page.add(cur);
    const label = this.text(page, x + 8, y + 6, '', 'small', UI.gold);
    const pointAt = (px, py) => { cur.clear(); drawCursor(cur, 0, 0, gold()); cur.setPosition(px, py).setVisible(true); };
    const mid = (ch) => ({ x: ch.x, y: ch.y - 22 });
    const kx = knight.x, ax = archer.x;
    let drag = null;
    this.vTick(() => { // the drag line, redrawn every frame while dragging
      if (!line.active) return;
      line.clear(); if (!drag) return;
      this.vOrderArrow(line, mid(drag.from), drag.to, drag.red);
      if (drag.red) line.lineStyle(3, 0xff4d4d, 1).strokeEllipse(foes[1].x, feet + 2, 62, 16);
      if (drag.floor) line.lineStyle(2, 0xffffff, 0.9).strokeEllipse(drag.to.x, drag.to.y + 4, 30, 9);
    });
    this.vLoop(T.loopMs, () => {
      knight.setX(kx); archer.setX(ax); cur.setVisible(false); marks.clear(); drag = null; label.setText('TAP');
      this.vLater(300, () => pointAt(foes[0].x - 16, feet - 22));
      this.vLater(650, () => { // the tap: a red ring bursts on the enemy (bossView.js ring)
        const r = this.add.circle(foes[0].x, feet - 18, 10).setStrokeStyle(3, 0xff4d4d, 0.9); page.add(r);
        this.vTween({ targets: r, scale: 3, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
      });
      this.vLater(900, () => {
        cur.setVisible(false);
        this.vStrike(knight, foes[0].x, () => this.vImpact(foes[0], defs[0], knight.x, 'melee'), 16);
        this.vShot('ranged', { x: archer.x + 12, y: feet - 34 }, { x: foes[0].x - 8, y: feet - 18 }, 360, () => this.vImpact(foes[0], defs[0], archer.x, 'ranged'));
      });
      // DRAG onto an enemy: red line
      this.vLater(1900, () => { label.setText('DRAG ONTO AN ENEMY'); pointAt(kx - 14, feet - 30); drag = { from: knight, to: mid(knight), red: false }; });
      this.vLater(2200, () => drag && this.vTween({ targets: drag.to, x: foes[1].x, y: feet - 20, duration: 700, ease: 'Sine.easeInOut', onUpdate: () => { if (!drag) return; cur.setPosition(drag.to.x - 16, drag.to.y - 4); drag.red = drag.to.x > foes[1].x - 30; } }));
      this.vLater(3000, () => {
        drag = null; cur.setVisible(false);
        marks.clear().lineStyle(2, 0xffa040, 0.9).strokeEllipse(foes[1].x, feet + 2, 54, 14).lineStyle(2, 0xffa040, 0.6).strokeEllipse(kx, feet + 4, 34, 9);
        this.vTween({ targets: knight, x: foes[1].x - 30, duration: 600, ease: 'Sine.easeInOut', onComplete: () => this.vStrike(knight, foes[1].x, () => this.vImpact(foes[1], defs[1], knight.x, 'melee')) });
      });
      // DRAG onto the floor: white line + ring, the hero walks there
      this.vLater(4300, () => { marks.clear(); label.setText('DRAG ONTO THE FLOOR'); pointAt(ax - 14, feet - 30); drag = { from: archer, to: mid(archer), red: false, floor: true }; });
      this.vLater(4600, () => drag && this.vTween({ targets: drag.to, x: x + Math.round(w * 0.44), y: feet - 4, duration: 600, ease: 'Sine.easeInOut', onUpdate: () => { if (drag) cur.setPosition(drag.to.x - 16, drag.to.y - 4); } }));
      this.vLater(5300, () => {
        if (!drag) return;
        const spot = { x: drag.to.x, y: feet }; drag = null; cur.setVisible(false);
        marks.clear().lineStyle(2, 0xffffff, 0.75).strokeEllipse(spot.x, spot.y + 4, 30, 9);
        this.vTween({ targets: archer, x: spot.x, duration: 700, ease: 'Sine.easeInOut', onComplete: () => marks.clear() });
      });
    });
  },

  // DAMAGE TYPES: PHYSICAL (melee: a slash; ranged: an arrow) and MAGIC (the mage's fire / ice / electric shots, the
  // necromancer's dark orb), each with the fight's own shot and hit, one after the other.
  visual_damage(page, x, y, w, h) {
    const D = V.damage, feet = y + h - 28, list = [...D.physical, ...D.magic], step = w / (list.length + 1);
    this.vLabel(page, x + step * 1.5, y + 4, 'PHYSICAL', UI.text);
    this.vLabel(page, x + step * (D.physical.length + (D.magic.length + 1) / 2), y + 4, 'MAGIC', UI.text);
    page.add(this.add.graphics().fillStyle(0x000000, 0.35).fillRect(x + Math.round(step * (D.physical.length + 0.5)) - 1, y + 8, 2, h - 16));
    const cells = list.map((d) => d).map((d, i) => {
      const cx = x + Math.round(step * (i + 1)), ch = this.sprite(page, hero(d.hero), cx - 10, feet, h - 54, false, 2);
      const types = d.types || [d.type];
      const lab = this.vLabel(page, cx, feet + 6, types[0].toUpperCase(), damageTypes[types[0]].color);
      return { ch, cx, types, lab };
    });
    let turn = 0;
    this.vLoop(D.loopMs, () => {
      const k = turn++;
      cells.forEach((c, i) => this.vLater(i * 420, () => {
        const type = c.types[k % c.types.length];
        c.lab.setText(type.toUpperCase()).setColor(damageTypes[type].color);
        const tx = c.cx + 22, ty = feet - 26;
        if (type === 'melee') {
          this.vStrike(c.ch, tx, null, 6);
          const S = CHAR_SCALE, u = { x: tx / S, y: feet / S, top: (ty - 14) / S, mid: ty / S, bot: feet / S, hw: 2, side: -1 };
          this.vFx(IMPACT_MS.melee, S, (q, now) => impactFx('melee', q, u, now, 5, null, true));
        } else this.vShot(type, { x: c.ch.x + 10, y: feet - 30 }, { x: tx, y: ty - 10 }, 320);
      }));
    });
  },

  // DEFENSE AND RESIST: left, a goblin hits a hero who wears a defense item; right, a fire imp shoots a hero who wears a
  // resist item. Each hit: the item flashes and only a small number pops up.
  visual_defense(page, x, y, w, h) {
    const D = V.defense, feet = y + h - 14, half = Math.round(w / 2);
    page.add(this.add.graphics().fillStyle(0x000000, 0.35).fillRect(x + half - 1, y + 8, 2, h - 16));
    const sides = [[D.physical, 0], [D.magical, half]].map(([s, ox]) => {
      const ex = x + ox + Math.round(half * 0.26), hx = x + ox + Math.round(half * 0.7), hd = hero(s.hero);
      const foe = this.sprite(page, enemy(s.enemy), ex, feet, 40, false, 2);
      const hc = this.vIdle(this.vFace(this.sprite(page, hd, hx, feet, h - 30, false, 2), true), ox ? 300 : 0);
      page.add(drawWindow(this.add.graphics(), hx + 2, y + 2, 40, 40));
      const icon = this.add.image(hx + 22, y + 22, bareIconKey(this, s.item)).setScale(2); page.add(icon);
      return { s, foe, hc, hd, icon };
    });
    this.vLoop(D.loopMs, () => sides.forEach((sd, k) => this.vLater(k * D.loopMs / 2 + 200, () => {
      const land = () => {
        this.vImpact(sd.hc, sd.hd, sd.foe.x, sd.s.type);
        this.vTween({ targets: sd.icon, scale: 2.6, duration: 90, yoyo: true, onComplete: () => sd.icon.setScale(2) });
        this.vWord(page, sd.hc.x - 16, y + 52, sd.s.number, FXC.attackColor);
      };
      if (sd.s.type === 'melee') this.vStrike(sd.foe, sd.hc.x, land, 14);
      else this.vShot(sd.s.type, { x: sd.foe.x + 10, y: feet - 18 }, { x: sd.hc.x - 6, y: feet - 26 }, 360, land);
    })));
  },

  // WEAK AND RESIST: a mage shoots a fire imp with ice: a big number with '!' (weak); then with fire: a small one with
  // '…' (resist). The marks are the fight's own.
  visual_weak(page, x, y, w, h) {
    const Wk = V.weak, feet = y + h - 14, def = enemy(Wk.enemy);
    const mage = this.sprite(page, hero(Wk.hero), x + Math.round(w * 0.2), feet, h - 30);
    const foe = this.vIdle(this.vFace(this.sprite(page, def, x + Math.round(w * 0.72), feet, 50), true));
    const shot = (at, type, num) => this.vLater(at, () => {
      this.vStrike(mage, foe.x, null, 5);
      this.vShot(type, { x: mage.x + 14, y: feet - 36 }, { x: foe.x - 6, y: feet - 20 }, 420, () => { this.vImpact(foe, def, mage.x, type); this.vWord(page, foe.x, foe.y - 36, num, FXC.attackColor); });
    });
    this.vLoop(Wk.loopMs, () => { shot(300, Wk.weakType, Wk.weakNumber); shot(Wk.loopMs / 2 + 200, Wk.resistType, Wk.resistNumber); });
  },

  // CRIT AND DODGE (+ block and shield, user): four small fights with the fight's own hit looks and words.
  // CRIT: crossing slashes + a big peach number. DODGE: the rogue side-steps, 'Miss'. BLOCK: a shield flash, 'Blocked!'.
  // SHIELD: a blue ring soaks the hit, the light-blue shield line over the health bar shrinks, 'Shield -12'.
  visual_crit(page, x, y, w, h) {
    const C = V.crit, cw = Math.round(w / 2), chh = Math.round(h / 2);
    page.add(this.add.graphics().fillStyle(0x000000, 0.35).fillRect(x + cw - 1, y + 6, 2, h - 12).fillRect(x + 6, y + chh - 1, w - 12, 2));
    const make = (i, name, attId, attIsHero, tgtId, tgtIsHero) => {
      const cx = x + (i % 2) * cw, cy = y + Math.floor(i / 2) * chh, feet = cy + chh - 8;
      this.text(page, cx + 6, cy + 4, name, 'small', UI.gold);
      const aDef = attIsHero ? hero(attId) : enemy(attId), tDef = tgtIsHero ? hero(tgtId) : enemy(tgtId);
      const att = this.sprite(page, aDef, cx + Math.round(cw * 0.3), feet, chh - 26, false, 2);
      const tgt = this.vFace(this.sprite(page, tDef, cx + Math.round(cw * 0.72), feet, chh - 26, false, 2), true);
      return { att, tgt, aDef, tDef };
    };
    const crit = make(0, 'CRIT', C.critHero, true, C.enemy, false);
    const dodge = make(1, 'DODGE', C.enemy, false, C.dodgeHero, true);
    const block = make(2, 'BLOCK', C.enemy, false, C.blockHero, true);
    const shield = make(3, 'SHIELD', C.enemy, false, C.shieldHero, true);
    const sBar = this.vBar(page, shield.tgt, shield.tDef, 'hero', { shield: 0.6 });
    const go = (c, at, fn) => this.vLater(at, () => this.vStrike(c.att, c.tgt.x, fn, 10));
    this.vLoop(C.loopMs, () => {
      sBar.set(1, 0.6);
      go(crit, 200, () => { this.vImpact(crit.tgt, crit.tDef, crit.att.x, 'melee', 'crit'); this.vFlash(crit.tgt); this.vWord(page, crit.tgt.x, crit.tgt.y - 30, C.critNumber, UI.fightGold, 20); });
      go(dodge, 800, () => { this.vImpact(dodge.tgt, dodge.tDef, dodge.att.x, 'melee', 'dodge'); this.vWord(page, dodge.tgt.x, dodge.tgt.y - 30, 'Miss', '#aaaaaa', 14); });
      go(block, 1400, () => { this.vImpact(block.tgt, block.tDef, block.att.x, 'melee', 'block'); this.vWord(page, block.tgt.x, block.tgt.y - 30, 'Blocked!', '#9fc4ff', 16); });
      go(shield, 2000, () => {
        this.vImpact(shield.tgt, shield.tDef, shield.att.x, 'melee', 'soak');
        const p = { s: 0.6 }; this.vTween({ targets: p, s: 0.25, duration: 300, onUpdate: () => sBar.set(1, p.s) });
        this.vWord(page, shield.tgt.x, sBar.y - 12, C.shieldText, '#6fd0ff', 14);
      });
    });
  },

  // ITEMS: a hero with its items next to it; a second copy of the first item flies in and joins it: 'x2'.
  visual_items(page, x, y, w, h) {
    const I = V.items, feet = y + h - 14;
    this.vIdle(this.sprite(page, hero(I.hero), x + Math.round(w * 0.2), feet, h - 30));
    const slots = I.items.map((id, i) => {
      const bx = x + Math.round(w * 0.42) + i * 54, by = y + Math.round(h / 2) - 20;
      page.add(drawWindow(this.add.graphics(), bx, by, 40, 40));
      page.add(this.add.image(bx + 20, by + 20, bareIconKey(this, id)).setScale(2));
      return { bx, by };
    });
    const twin = this.add.image(0, 0, bareIconKey(this, I.items[0])).setScale(2); page.add(twin);
    const x2 = this.text(page, slots[0].bx + 36, slots[0].by + 38, 'x2', 'small', UI.gold).setOrigin(1, 1).setAlpha(0);
    this.vLoop(I.loopMs, () => {
      twin.setPosition(x + w - 20, y + 16).setAlpha(1); x2.setAlpha(0);
      this.vLater(500, () => this.vTween({ targets: twin, x: slots[0].bx + 20, y: slots[0].by + 20, duration: 600, ease: 'Quad.easeIn', onComplete: () => {
        twin.setAlpha(0); x2.setAlpha(1); this.vTween({ targets: x2, scale: 1.4, duration: 120, yoyo: true });
      } }));
    });
  },

  // LEVELS: like the fight: the knight (health bar, 'Lv1' on its left) beats a slime (its bar empties, a puff), then
  // 'LEVEL UP / Lv2' rises over the knight in small peach letters and its label turns 'Lv2'.
  visual_levels(page, x, y, w, h) {
    const Lv = V.levels, feet = y + h - 12, hDef = hero(Lv.hero), eDef = enemy(Lv.enemy);
    const ch = this.sprite(page, hDef, x + Math.round(w * 0.38), feet, h - 50);
    const foe = this.vFace(this.sprite(page, eDef, x + Math.round(w * 0.7), feet, 40), true);
    const hb = this.vBar(page, ch, hDef, 'hero', { lv: 'Lv1' }), eb = this.vBar(page, foe, eDef, 'enemy');
    const word = this.text(page, ch.x, hb.y - 8, Lv.text, 8, UI.fightGold, { stroke: '#000000', strokeThickness: 3, align: 'center', lineSpacing: 2 }).setOrigin(0.5, 1).setAlpha(0);
    const wy = word.y;
    this.vLoop(Lv.loopMs, () => {
      foe.setAlpha(1); eb.set(0.35); eb.show(true); hb.lv.setText('Lv1'); word.setAlpha(0).setY(wy);
      this.vLater(300, () => this.vStrike(ch, foe.x, () => {
        this.vImpact(foe, eDef, ch.x, 'melee'); eb.set(0);
        this.vLater(200, () => { this.vTween({ targets: foe, alpha: 0, duration: 250 }); this.vPuff(foe.x, foe.y - 8); eb.show(false); });
      }));
      this.vLater(1000, () => {
        hb.lv.setText('Lv2');
        word.setScale(0.6).setAlpha(1);
        this.vTween({ targets: word, scale: 1, duration: 220, ease: 'Back.easeOut' });
        this.vTween({ targets: word, y: wy - 10, alpha: 0, delay: 1300, duration: 500 });
      });
    });
  },

  // PERKS AND PASSIVES: three heroes, each wearing its passive's gold badge; soft green sparkles rise from all three
  // (the perks help the whole squad).
  visual_perks(page, x, y, w, h) {
    const Pk = V.perks, feet = y + h - 14;
    const chs = Pk.heroes.map((id, i) => {
      const cx = x + Math.round(w * (i + 1) / (Pk.heroes.length + 1));
      const ch = this.vIdle(this.sprite(page, hero(id), cx, feet, h - 40, false, 2), i * 200);
      const key = skillIconKey(this, 'passive_' + id, true);
      if (key) page.add(this.add.image(cx + 26, y + 18, key).setScale(1.5));
      return ch;
    });
    const spark = (cx) => {
      const g = this.add.graphics().fillStyle(hex(FXC.supportColor), 1).fillRect(-1, -3, 2, 6).fillRect(-3, -1, 6, 2);
      g.setPosition(cx + Phaser.Math.Between(-12, 12), feet - 6); page.add(g);
      this.vTween({ targets: g, y: feet - 50, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => g.destroy() });
    };
    this.vLoop(Pk.sparkMs, () => chs.forEach((c) => spark(c.x)));
  },

  // ON-HIT ITEMS (like the fight): the rogue keeps hitting the goblin; on one hit its item's framed icon pops OVER THE
  // ROGUE (iconPop), the Bleed icon appears over the GOBLIN'S health bar, and the bleed ticks ('-3', red).
  visual_onhit(page, x, y, w, h) {
    const O = V.onhit, feet = y + h - 12, hDef = hero(O.hero), eDef = enemy(O.enemy);
    const ch = this.sprite(page, hDef, x + Math.round(w * 0.3), feet, h - 56);
    const foe = this.vFace(this.sprite(page, eDef, x + Math.round(w * 0.66), feet, 46), true);
    const hb = this.vBar(page, ch, hDef, 'hero'), eb = this.vBar(page, foe, eDef, 'enemy');
    const mark = this.add.image(foe.x, eb.y - 14, statusIconKey(this, O.status)).setScale(2).setAlpha(0); page.add(mark);
    this.vLoop(O.loopMs, () => {
      mark.setAlpha(0); eb.set(1);
      [300, 900, 1500].forEach((t, k) => this.vLater(t, () => this.vStrike(ch, foe.x, () => {
        this.vImpact(foe, eDef, ch.x, 'melee'); eb.set(eb.frac - 0.12);
        this.vWord(page, foe.x - 14, eb.y - 20, O.number, FXC.attackColor);
        if (k === 2) {
          this.vIconPop(page, ch.x, hb.y, O.item);
          mark.setAlpha(1).setScale(1); this.vTween({ targets: mark, scale: 2, duration: 160, ease: 'Back.easeOut' });
          [500, 1000, 1500].forEach((d) => this.vLater(d, () => { eb.set(eb.frac - 0.04); this.vWord(page, foe.x + 20, eb.y - 20, O.bleedText, O.bleedColor, 12); }));
        }
      })));
    });
  },

  // CHANNEL: the archer stands still while her skill rains arrows on the enemies in waves; the bar under her empties
  // while it lasts (she does nothing else).
  visual_channel(page, x, y, w, h) {
    const Cn = V.channel, feet = y + h - 18;
    const ch = this.sprite(page, hero(Cn.hero), x + Math.round(w * 0.2), feet, h - 34);
    const defs = Cn.enemies.map(enemy);
    const foes = defs.map((d, i) => this.vFace(this.sprite(page, d, x + Math.round(w * (0.6 + 0.2 * i)), feet, 40), true));
    const bw = 44, bx = ch.x - bw / 2, by = feet + 6;
    const bar = this.add.graphics(); page.add(bar);
    const draw = (f) => bar.clear().fillStyle(0x2a2a36, 1).fillRect(bx, by, bw, 5).fillStyle(gold(), 1).fillRect(bx, by, Math.round(bw * f), 5);
    const key = skillIconKey(this, Cn.skill);
    if (key) page.add(this.add.image(ch.x + 26, y + 18, key).setScale(1.5));
    this.vLoop(Cn.loopMs, () => {
      draw(0);
      this.vLater(300, () => {
        draw(1);
        const prog = { f: 1 }; this.vTween({ targets: prog, f: 0, duration: Cn.waves * Cn.waveMs, onUpdate: () => draw(prog.f) });
        for (let k = 0; k < Cn.waves; k++) this.vLater(k * Cn.waveMs, () => foes.forEach((f, i) => {
          const fx = f.x + Phaser.Math.Between(-10, 10);
          this.vShot('ranged', { x: fx - 8, y: y + 2 }, { x: fx, y: f.y - 16 }, 220, () => this.vImpact(f, defs[i], fx - 20, 'ranged'));
        }));
      });
    });
  },

  // MIXING ELEMENTS: the mage's fire hit; each item of ANOTHER element next to her cuts her elemental damage by the
  // combat.json percent: the real numbers (M.base, then -10%, -20%) and the cut under each item.
  visual_mixing(page, x, y, w, h) {
    const M = V.mixing, feet = y + h - 14, eDef = enemy(M.enemy);
    const ch = this.sprite(page, hero(M.hero), x + Math.round(w * 0.16), feet, h - 30);
    const foe = this.vFace(this.sprite(page, eDef, x + Math.round(w * 0.86), feet, 40), true);
    const pen = combat.elementMix.penaltyPerExtraPercent;
    const icons = M.items.map((id, i) => {
      const bx = x + Math.round(w * 0.3) + i * 46, by = y + 8;
      const frame = drawWindow(this.add.graphics(), bx, by, 38, 38); page.add(frame);
      const im = this.add.image(bx + 19, by + 19, bareIconKey(this, id)).setScale(2); page.add(im);
      const tag = this.text(page, bx + 19, by + 42, i ? `-${pen * i}%` : '100%', 'small', i ? UI.red : UI.dim).setOrigin(0.5, 0);
      return [frame, im, tag];
    });
    this.vLoop(M.loopMs, () => {
      icons.forEach((parts, i) => parts.forEach((o) => o.setAlpha(i ? 0 : 1)));
      M.items.forEach((_, i) => this.vLater(300 + i * M.stepMs, () => {
        if (i) { icons[i].forEach((o) => o.setAlpha(1)); this.vTween({ targets: icons[i][1], scale: 2.6, duration: 120, yoyo: true }); }
        this.vLater(150, () => {
          this.vStrike(ch, foe.x, null, 5);
          this.vShot('fire', { x: ch.x + 14, y: feet - 36 }, { x: foe.x - 6, y: feet - 20 }, 320, () => {
            this.vImpact(foe, eDef, ch.x, 'fire');
            this.vWord(page, foe.x - 6, foe.y - 34, String(Math.round(M.base * (1 - pen * i / 100))), FXC.attackColor);
          });
        });
      }));
    });
  },
};
