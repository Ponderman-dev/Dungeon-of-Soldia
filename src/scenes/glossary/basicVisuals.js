// Part of GlossaryScene (mixed into its prototype; `this` is the scene). The BASICS pictures (session 53, user: 'the
// basics need visuals'; picked: GAME ART ONLY, still pictures). glossary.json basics[i].visual names one of the
// methods below; each draws into `page` inside the box (x, y, w, h) using the game's own sprites, icons and colours.
import Phaser from 'phaser';
import { UI } from '../../config.js';
import { bareIconKey } from '../../entities/itemIconTexture.js';
import { skillIconKey } from '../../entities/skillIconTexture.js';
import { drawGrave } from '../../entities/grave.js';
import heroes from '../../data/heroes.json';
import enemies from '../../data/enemies.json';
import roomProps from '../../data/roomProps.json';
import damageTypes from '../../data/damageTypes.json';
import G from '../../data/glossary.json';
import combat from '../../data/combat.json';
import { statusIconKey } from '../../entities/statusIconTexture.js';
import { drawWindow, drawCursor } from '../../entities/uiKit.js';

const FXC = combat.skillFx; // the fight's number colours: damage, heal; crits / LEVEL UP use UI.fightGold

const V = G.layout.basics.visuals; // which heroes / enemies / items each picture uses
const hero = (id) => heroes.find((h) => h.id === id);
const enemy = (id) => ({ id, ...enemies[id] });
const hex = (c) => Phaser.Display.Color.HexStringToColor(c).color;
const gold = () => hex(UI.gold);

export const basicVisualMethods = {
  // The picture box: a dark recessed panel, then the picture.
  basicVisual(page, kind, x, y, w, h) {
    page.add(this.add.graphics().fillStyle(UI.goldTheme.slot, 1).fillRect(x, y, w, h));
    const draw = this['visual_' + kind];
    if (draw) draw.call(this, page, x, y, w, h);
  },

  // A pixel arrow pointing right, centred on (cx, cy).
  visualArrow(page, cx, cy, color = UI.dim) {
    const g = this.add.graphics().fillStyle(hex(color), 1);
    for (let i = 0; i < 4; i++) g.fillRect(cx - 4 + i * 2, cy - 6 + i * 2, 2, 12 - i * 4);
    page.add(g);
  },

  // A damage number like the fight's pop-ups (bold, dark outline).
  visualNumber(page, x, y, text, color, px = 16) {
    return this.text(page, x, y, text, px, color, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5, 1);
  },

  // ---------- motion (session 53, user: 'animate these'): short loops that repeat. Every tween / timer is kept so a
  // new page stops them (visualStop, called by GlossaryScene.newPage). ----------
  vTween(cfg) { const t = this.tweens.add(cfg); (this.vMotion ||= []).push(t); return t; },
  vLoop(ms, fn) { fn(); const e = this.time.addEvent({ delay: ms, loop: true, callback: fn }); (this.vMotion ||= []).push(e); return e; },
  vLater(ms, fn) { const e = this.time.delayedCall(ms, fn); (this.vMotion ||= []).push(e); return e; },
  visualStop() { for (const m of this.vMotion || []) { if (m.remove) m.remove(false); if (m.stop) m.stop(); } this.vMotion = []; },
  vTint(ch, color) { for (const p of Object.values(ch.parts)) { if (color === null) p.image.clearTint(); else p.image.setTint(color).setTintMode(Phaser.TintModes.FILL); } },
  // a hero / enemy breathing: 1-2 px up and down, forever
  vIdle(o, delay = 0) { this.vTween({ targets: o, y: o.y - 2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay }); },
  // a damage number that pops up and fades (like the fight's)
  vPop(num) { const y0 = num.y; num.setAlpha(1).setY(y0); this.vTween({ targets: num, y: y0 - 14, alpha: 0, delay: 350, duration: 500, ease: 'Quad.easeIn', onComplete: () => num.setY(y0) }); },

  // YOUR SQUAD: three heroes; the third flashes red, falls, and a tombstone pops up where it stood. Then again.
  visual_squad(page, x, y, w, h) {
    const feet = y + h - 14, ids = V.squad.heroes, M = V.squad;
    const chs = ids.map((id, i) => this.sprite(page, hero(id), x + Math.round(w * (i + 1) / (ids.length + 1)), feet, h - 24));
    chs.slice(0, -1).forEach((c, i) => this.vIdle(c, i * 300));
    const last = chs[chs.length - 1], home = last.y;
    const grave = drawGrave(this.add.graphics(), 3).setPosition(last.x, feet); page.add(grave);
    this.vLoop(M.loopMs, () => {
      last.setAlpha(1).setY(home); this.vTint(last, null); grave.setScale(0).setVisible(false);
      this.vLater(M.hitMs, () => this.vTint(last, 0xff4d4d));
      this.vLater(M.hitMs + 120, () => this.vTint(last, null));
      this.vLater(M.hitMs + 240, () => this.vTint(last, 0xff4d4d));
      this.vLater(M.hitMs + 360, () => {
        this.vTint(last, null);
        this.vTween({ targets: last, alpha: 0, y: home + 6, duration: 300 });
        grave.setVisible(true).setScale(0.3);
        this.vTween({ targets: grave, scaleX: 1, scaleY: 1, delay: 200, duration: 260, ease: 'Back.easeOut' });
      });
    });
  },

  // FLOORS: a fight -> a special room (chest) -> ... -> the boss on floor 20. A gold pointer walks along the floors;
  // when it reaches the boss, the boss shakes (its roar). Then again.
  visual_floors(page, x, y, w, h) {
    const F = V.floors, feet = y + h - 26, slots = [0.14, 0.4, 0.63, 0.86].map((f) => x + Math.round(w * f));
    const slime = this.sprite(page, enemy(F.fight), slots[0], feet, 40);
    this.vIdle(slime);
    const chest = this.sprite(page, roomProps[F.room], slots[1], feet, 40);
    chest.setScale(roomProps[F.room].drawScale || 3);
    this.text(page, slots[2], feet - 18, '. . .', 'normal', UI.dim).setOrigin(0.5);
    const boss = this.sprite(page, enemy(F.boss), slots[3], feet, h - 30, false, 2);
    boss.setScale(Math.min(2, (h - 34) / (enemies[F.boss].height || 32)));
    const nums = [[0, '1'], [1, '2'], [3, '20']].map(([i, n]) => this.text(page, slots[i], feet + 6, n, 'small', i === 3 ? UI.red : UI.gold).setOrigin(0.5, 0));
    this.visualArrow(page, Math.round((slots[0] + slots[1]) / 2), feet - 18);
    this.visualArrow(page, Math.round((slots[2] + slots[3]) / 2) - 8, feet - 18);
    // the pointer: a small gold triangle above the floor it is on
    const ptr = this.add.graphics().fillStyle(gold(), 1); for (let r = 0; r < 4; r++) ptr.fillRect(-6 + r * 2, r * 2, 12 - r * 4, 2);
    page.add(ptr);
    const stops = [[slots[0], feet - 46], [slots[1], feet - 50], [slots[2], feet - 36], [slots[3], y + 4]];
    const bx = boss.x;
    this.vLoop(F.loopMs, () => {
      ptr.setPosition(...stops[0]).setAlpha(1);
      stops.slice(1).forEach((p, k) => this.vLater((k + 1) * F.stepMs, () => this.vTween({ targets: ptr, x: p[0], y: p[1], duration: 220, ease: 'Quad.easeOut' })));
      this.vLater(3 * F.stepMs + 260, () => this.vTween({ targets: boss, x: bx + 3, duration: 50, yoyo: true, repeat: 5, onComplete: () => boss.setX(bx) }));
    });
    void nums;
  },

  // SKILLS: the hero casts its attack skill (the red square flashes, the hero lunges), then its support skill; the
  // support square goes grey and counts down its cooldown, then lights up green again. Then again.
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

  // DEFENSE AND RESIST: two small fights. Left: a goblin hits a hero who wears a defense item; right: a fire imp hits a
  // hero who wears a resist item. Each hit: the item flashes (it blocks most of it) and only a small number pops up.
  visual_defense(page, x, y, w, h) {
    const D = V.defense, feet = y + h - 14, half = Math.round(w / 2);
    page.add(this.add.graphics().fillStyle(0x000000, 0.35).fillRect(x + half - 1, y + 8, 2, h - 16)); // a thin split
    const sides = [[D.physical, 0], [D.magical, half]].map(([s, ox]) => {
      const ex = x + ox + Math.round(half * 0.26), hx = x + ox + Math.round(half * 0.7);
      const foe = this.sprite(page, enemy(s.enemy), ex, feet, 40, false, 2);
      const hc = this.sprite(page, hero(s.hero), hx, feet, h - 30, false, 2);
      hc.setScale(-Math.abs(hc.scaleX), hc.scaleY); // the hero faces the enemy (left)
      this.vIdle(hc, ox ? 300 : 0);
      page.add(drawWindow(this.add.graphics(), hx + 2, y + 2, 40, 40));
      const icon = this.add.image(hx + 22, y + 22, bareIconKey(this, s.item)).setScale(2); page.add(icon);
      const num = this.visualNumber(page, hx - 18, y + 46, s.number, FXC.attackColor, FXC.numberSizePx).setAlpha(0);
      return { foe, hc, icon, num, fx: foe.x };
    });
    this.vLoop(D.loopMs, () => sides.forEach((sd, k) => this.vLater(k * D.loopMs / 2 + 200, () => {
      this.vTween({ targets: sd.foe, x: sd.fx + 14, duration: 120, yoyo: true, ease: 'Quad.easeOut', onComplete: () => sd.foe.setX(sd.fx) });
      this.vLater(120, () => {
        this.vTween({ targets: sd.icon, scale: 2.6, duration: 90, yoyo: true, onComplete: () => sd.icon.setScale(2) });
        this.vTween({ targets: sd.hc, alpha: 0.4, duration: 60, yoyo: true, repeat: 1 });
        this.vPop(sd.num);
      });
    })));
  },

  // ---------- more helpers ----------
  // a small coloured bolt flying from (x0, y0) to (x1, y1); onHit when it lands
  vBolt(page, x0, y0, x1, y1, color, ms, onHit) {
    const b = this.add.graphics().fillStyle(hex(color), 1).fillRect(-4, -2, 8, 4).fillStyle(0xffffff, 0.8).fillRect(1, -1, 3, 2);
    b.setPosition(x0, y0); page.add(b);
    this.vTween({ targets: b, x: x1, y: y1, duration: ms, ease: 'Linear', onComplete: () => { b.destroy(); if (onHit) onHit(); } });
  },
  // a word or number that pops in over a fighter and floats away (like the fight's pop-ups)
  vWord(page, x, y, text, color, px = FXC.numberSizePx) {
    const t = this.visualNumber(page, x, y, text, color, px).setAlpha(0);
    this.vPop(t);
    this.vLater(1200, () => t.destroy());
    return t;
  },
  // a sprite hit: a quick white-ish flash and a small shake
  vHit(ch) {
    const x0 = ch.x;
    this.vTint(ch, 0xffffff); this.vLater(80, () => this.vTint(ch, null));
    this.vTween({ targets: ch, x: x0 + 3, duration: 40, yoyo: true, repeat: 1, onComplete: () => ch.setX(x0) });
  },
  // a melee strike: a step toward the target and back, the hit lands at the turn
  vStrike(ch, toward, onHit, px = 12) {
    const x0 = ch.x, dir = toward > x0 ? 1 : -1;
    this.vTween({ targets: ch, x: x0 + dir * px, duration: 110, yoyo: true, ease: 'Quad.easeOut', onYoyo: () => { if (onHit) onHit(); }, onComplete: () => ch.setX(x0) });
  },
  vFace(ch, left) { ch.setScale((left ? -1 : 1) * Math.abs(ch.scaleX), ch.scaleY); return ch; },
  vLabel(page, x, y, text, color = UI.dim) { return this.text(page, x, y, text, 'small', color).setOrigin(0.5, 0); },

  // AUTO BATTLE: nobody taps anything: the knight walks up to the slime and swings, the archer shoots from the back.
  visual_auto(page, x, y, w, h) {
    const A = V.auto, feet = y + h - 14;
    const archer = this.sprite(page, hero(A.ranged), x + Math.round(w * 0.12), feet, h - 30);
    const knight = this.sprite(page, hero(A.melee), x + Math.round(w * 0.34), feet, h - 30);
    const foe = this.sprite(page, enemy(A.enemy), x + Math.round(w * 0.82), feet, 50);
    this.vFace(foe, true); this.vIdle(foe);
    const kx = knight.x, stop = foe.x - 34;
    this.vLoop(A.loopMs, () => {
      knight.setX(kx);
      this.vTween({ targets: knight, x: stop, duration: 700, ease: 'Sine.easeInOut', onComplete: () => this.vStrike(knight, foe.x, () => { this.vHit(foe); this.vWord(page, foe.x, foe.y - 30, A.number, FXC.attackColor); }) });
      this.vLater(1100, () => this.vBolt(page, archer.x + 10, feet - 30, foe.x - 6, feet - 16, '#e6e6b8', 380, () => { this.vHit(foe); this.vWord(page, foe.x + 10, foe.y - 44, A.number, FXC.attackColor); }));
      this.vLater(1700, () => this.vTween({ targets: knight, x: kx, duration: 600, ease: 'Sine.easeInOut' }));
    });
  },

  // TAP AND DRAG: TAP: the pointer taps the slime, the red focus ring appears under it and both heroes hit it.
  // DRAG: the pointer drags the knight onto the rat: only the knight goes for it.
  visual_tap(page, x, y, w, h) {
    const T = V.tap, feet = y + h - 14;
    const archer = this.sprite(page, hero(T.heroes[1]), x + Math.round(w * 0.1), feet, h - 30);
    const knight = this.sprite(page, hero(T.heroes[0]), x + Math.round(w * 0.3), feet, h - 30);
    const foes = T.enemies.map((id, i) => this.vFace(this.sprite(page, enemy(id), x + Math.round(w * (0.66 + 0.2 * i)), feet, 46), true));
    foes.forEach((f, i) => this.vIdle(f, i * 250));
    const ring = this.add.ellipse(0, feet, 52, 14).setStrokeStyle(2, 0xff4d4d).setVisible(false); page.add(ring);
    const cur = this.add.graphics(); page.add(cur);
    const label = this.text(page, x + 8, y + 6, '', 'small', UI.gold);
    const pointAt = (px, py) => { cur.clear(); drawCursor(cur, 0, 0, gold()); cur.setPosition(px, py).setVisible(true); };
    const kx = knight.x, ky = knight.y;
    this.vLoop(T.loopMs, () => {
      knight.setPosition(kx, ky).setAlpha(1); ring.setVisible(false); cur.setVisible(false); label.setText('TAP');
      this.vLater(300, () => pointAt(foes[0].x - 18, feet - 20));
      this.vLater(700, () => { ring.setPosition(foes[0].x, feet).setVisible(true); cur.setScale(0.8); this.vLater(120, () => cur.setScale(1)); });
      this.vLater(950, () => { this.vStrike(knight, foes[0].x, () => this.vHit(foes[0])); this.vBolt(page, archer.x + 10, feet - 30, foes[0].x, feet - 16, '#e6e6b8', 360, () => this.vHit(foes[0])); });
      this.vLater(2000, () => { label.setText('DRAG'); ring.setVisible(false); pointAt(kx - 16, ky - 30); });
      this.vLater(2400, () => {
        knight.setAlpha(0.75);
        this.vTween({ targets: knight, x: foes[1].x - 30, duration: 700, ease: 'Sine.easeInOut' });
        this.vTween({ targets: cur, x: foes[1].x - 46, duration: 700, ease: 'Sine.easeInOut' });
      });
      this.vLater(3150, () => { knight.setAlpha(1); cur.setVisible(false); this.vStrike(knight, foes[1].x, () => this.vHit(foes[1])); });
    });
  },

  // DAMAGE TYPES: the heroes in two groups, PHYSICAL (melee, ranged) and MAGIC (the elements); each strikes in turn and
  // a spark of its damage colour flies out.
  visual_damage(page, x, y, w, h) {
    const D = V.damage, feet = y + h - 26, all = [...D.physical, ...D.magic];
    const step = w / (all.length + 1);
    this.vLabel(page, x + step * 1.5, y + 4, 'PHYSICAL', UI.text);
    this.vLabel(page, x + step * (D.physical.length + (D.magic.length + 1) / 2), y + 4, 'MAGIC', UI.text);
    page.add(this.add.graphics().fillStyle(0x000000, 0.35).fillRect(x + Math.round(step * (D.physical.length + 0.5)) - 1, y + 8, 2, h - 16));
    const chs = all.map((d, i) => {
      const cx = x + Math.round(step * (i + 1));
      const ch = this.sprite(page, hero(d.hero), cx, feet, h - 48, false, 2);
      this.vLabel(page, cx, feet + 4, d.label, damageTypes[d.type].color);
      return { ch, d, cx };
    });
    this.vLoop(D.loopMs, () => chs.forEach((c, i) => this.vLater(i * 380, () => {
      this.vStrike(c.ch, c.cx + 20, null, 5);
      this.vBolt(page, c.cx + 6, feet - 26, c.cx + 20, feet - 44, damageTypes[c.d.type].color, 260);
    })));
  },

  // WEAK AND RESIST: a mage hits a fire imp with ice: a big number with '!' (weak); then with fire: a small one with
  // '…' (resist). The marks are the fight's own.
  visual_weak(page, x, y, w, h) {
    const Wk = V.weak, feet = y + h - 14;
    const mage = this.sprite(page, hero(Wk.hero), x + Math.round(w * 0.2), feet, h - 30);
    const foe = this.vFace(this.sprite(page, enemy(Wk.enemy), x + Math.round(w * 0.72), feet, 50), true);
    this.vIdle(foe);
    const shot = (at, type, num) => this.vLater(at, () => {
      this.vStrike(mage, foe.x, null, 5);
      this.vBolt(page, mage.x + 12, feet - 34, foe.x - 8, feet - 20, damageTypes[type].color, 420, () => { this.vHit(foe); this.vWord(page, foe.x, foe.y - 36, num, FXC.attackColor); });
    });
    this.vLoop(Wk.loopMs, () => { shot(300, Wk.weakType, Wk.weakNumber); shot(Wk.loopMs / 2 + 200, Wk.resistType, Wk.resistNumber); });
  },

  // CRIT AND DODGE: left, the knight lands a crit: a big peach number. Right, a goblin swings at the rogue, who hops
  // back: 'Miss'.
  visual_crit(page, x, y, w, h) {
    const C = V.crit, feet = y + h - 14, half = Math.round(w / 2);
    page.add(this.add.graphics().fillStyle(0x000000, 0.35).fillRect(x + half - 1, y + 8, 2, h - 16));
    const kn = this.sprite(page, hero(C.critHero), x + Math.round(half * 0.3), feet, h - 34, false, 2);
    const f1 = this.vFace(this.sprite(page, enemy(C.enemy), x + Math.round(half * 0.75), feet, 44, false, 2), true);
    const f2 = this.sprite(page, enemy(C.enemy), x + half + Math.round(half * 0.25), feet, 44, false, 2);
    const ro = this.vFace(this.sprite(page, hero(C.dodgeHero), x + half + Math.round(half * 0.72), feet, h - 34, false, 2), true);
    const ry = ro.y;
    this.vLoop(C.loopMs, () => {
      this.vLater(300, () => this.vStrike(kn, f1.x, () => { this.vHit(f1); this.vWord(page, f1.x, f1.y - 34, C.critNumber, UI.fightGold, 20); }));
      this.vLater(C.loopMs / 2, () => this.vStrike(f2, ro.x, () => {
        this.vTween({ targets: ro, y: ry - 10, x: ro.x + 8, duration: 140, yoyo: true, ease: 'Quad.easeOut', onComplete: () => ro.setY(ry) });
        this.vWord(page, ro.x, ro.y - 40, 'Miss', '#aaaaaa', 14);
      }));
    });
  },

  // ITEMS: a hero with its items floating next to it; a second copy of the first item flies in and joins it: 'x2'.
  visual_items(page, x, y, w, h) {
    const I = V.items, feet = y + h - 14;
    const ch = this.sprite(page, hero(I.hero), x + Math.round(w * 0.2), feet, h - 30);
    this.vIdle(ch);
    const slots = I.items.map((id, i) => {
      const bx = x + Math.round(w * 0.42) + i * 54, by = y + Math.round(h / 2) - 20;
      page.add(drawWindow(this.add.graphics(), bx, by, 40, 40));
      page.add(this.add.image(bx + 20, by + 20, bareIconKey(this, id)).setScale(2));
      return { bx, by };
    });
    const twin = this.add.image(0, 0, bareIconKey(this, I.items[0])).setScale(2); page.add(twin);
    const x2 = this.text(page, slots[0].bx + 36, slots[0].by + 38, 'x2', 'small', UI.gold).setOrigin(1, 1).setAlpha(0);
    this.vLoop(I.loopMs, () => {
      twin.setPosition(x + w - 20, y + 16).setAlpha(1).setScale(2); x2.setAlpha(0);
      this.vLater(500, () => this.vTween({ targets: twin, x: slots[0].bx + 20, y: slots[0].by + 20, duration: 600, ease: 'Quad.easeIn', onComplete: () => {
        twin.setAlpha(0); x2.setAlpha(1);
        this.vTween({ targets: x2, scale: 1.4, duration: 120, yoyo: true });
      } }));
    });
  },

  // LEVELS: the hero beats an enemy (it fades), the hero flashes and 'LEVEL UP' rises over it.
  visual_levels(page, x, y, w, h) {
    const Lv = V.levels, feet = y + h - 14;
    const ch = this.sprite(page, hero(Lv.hero), x + Math.round(w * 0.35), feet, h - 30);
    const foe = this.vFace(this.sprite(page, enemy(Lv.enemy), x + Math.round(w * 0.7), feet, 44), true);
    const fy = foe.y;
    this.vLoop(Lv.loopMs, () => {
      foe.setAlpha(1).setY(fy); this.vTint(foe, null);
      this.vLater(300, () => this.vStrike(ch, foe.x, () => {
        this.vHit(foe);
        this.vLater(160, () => this.vTween({ targets: foe, alpha: 0, y: fy + 4, duration: 300 }));
      }));
      this.vLater(1000, () => {
        this.vTween({ targets: ch, alpha: 0.45, duration: 120, yoyo: true, repeat: 2 }); // a soft blink
        this.vWord(page, ch.x + 44, y + 66, Lv.text, UI.fightGold, 14); // inside the picture (two lines, it floats up a little)
      });
    });
  },

  // PERKS AND PASSIVES: three heroes; each wears its passive's gold badge; soft green sparkles rise from all three
  // (the perks help the whole squad).
  visual_perks(page, x, y, w, h) {
    const Pk = V.perks, feet = y + h - 14;
    const chs = Pk.heroes.map((id, i) => {
      const cx = x + Math.round(w * (i + 1) / (Pk.heroes.length + 1));
      const ch = this.sprite(page, hero(id), cx, feet, h - 40, false, 2);
      const key = skillIconKey(this, 'passive_' + id, true);
      if (key) page.add(this.add.image(cx + 26, y + 18, key).setScale(1.5));
      this.vIdle(ch, i * 200);
      return ch;
    });
    const spark = (cx) => {
      const g = this.add.graphics().fillStyle(hex(FXC.supportColor), 1).fillRect(-1, -3, 2, 6).fillRect(-3, -1, 6, 2);
      g.setPosition(cx + Phaser.Math.Between(-12, 12), feet - 6); page.add(g);
      this.vTween({ targets: g, y: feet - 50, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => g.destroy() });
    };
    this.vLoop(Pk.sparkMs, () => chs.forEach((c) => spark(c.x)));
  },

  // ON-HIT ITEMS: the rogue keeps hitting; on one hit its on-hit item (Serrated Edge) pops over the enemy, the enemy
  // gets the Bleed mark and small bleed numbers tick.
  visual_onhit(page, x, y, w, h) {
    const O = V.onhit, feet = y + h - 14;
    const ch = this.sprite(page, hero(O.hero), x + Math.round(w * 0.3), feet, h - 30);
    const foe = this.vFace(this.sprite(page, enemy(O.enemy), x + Math.round(w * 0.62), feet, 50), true);
    const pop = this.add.image(foe.x, y + 20, bareIconKey(this, O.item)).setScale(2).setAlpha(0); page.add(pop);
    const mark = this.add.image(foe.x + 22, feet - 46, statusIconKey(this, O.status)).setScale(2).setAlpha(0); page.add(mark);
    this.vLoop(O.loopMs, () => {
      mark.setAlpha(0);
      [300, 900, 1500].forEach((t, k) => this.vLater(t, () => this.vStrike(ch, foe.x, () => {
        this.vHit(foe); this.vWord(page, foe.x - 8, foe.y - 34, O.number, FXC.attackColor);
        if (k === 2) {
          pop.setAlpha(1).setScale(1); this.vTween({ targets: pop, scale: 2.4, duration: 160, yoyo: true, hold: 300, onComplete: () => pop.setAlpha(0) });
          mark.setAlpha(1);
          [500, 1000, 1500].forEach((d) => this.vLater(d, () => this.vWord(page, foe.x + 14, foe.y - 24, O.bleedNumber, O.bleedColor, 12)));
        }
      })));
    });
  },

  // CHANNEL: the archer stands still while her skill rains arrows on the enemies in waves; the bar under her empties
  // while it lasts (she does nothing else).
  visual_channel(page, x, y, w, h) {
    const Cn = V.channel, feet = y + h - 18;
    const ch = this.sprite(page, hero(Cn.hero), x + Math.round(w * 0.2), feet, h - 34);
    const foes = Cn.enemies.map((id, i) => this.vFace(this.sprite(page, enemy(id), x + Math.round(w * (0.6 + 0.2 * i)), feet, 40), true));
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
        for (let k = 0; k < Cn.waves; k++) this.vLater(k * Cn.waveMs, () => foes.forEach((f) => {
          const a = this.add.graphics().fillStyle(0xe6e6b8, 1).fillRect(-1, -8, 2, 8); a.setPosition(f.x + Phaser.Math.Between(-10, 10), y + 4); page.add(a);
          this.vTween({ targets: a, y: f.y - 20, duration: 220, ease: 'Quad.easeIn', onComplete: () => { a.destroy(); this.vHit(f); } });
        }));
      });
    });
  },

  // REACTIONS: an enemy is hit by one element, then by a different one: the reaction's word pops (Steam / Shatter /
  // Overload, the fight's own words and colours). The three take turns.
  visual_reactions(page, x, y, w, h) {
    const R = V.reactions, feet = y + h - 14;
    const mage = this.sprite(page, hero(R.hero), x + Math.round(w * 0.2), feet, h - 30);
    const foe = this.vFace(this.sprite(page, enemy(R.enemy), x + Math.round(w * 0.72), feet, 50), true);
    const tag = this.text(page, foe.x, y + 6, '', 'small', UI.dim).setOrigin(0.5, 0);
    let turn = 0;
    this.vLoop(R.loopMs, () => {
      const r = R.list[turn++ % R.list.length];
      tag.setText('');
      const bolt = (at, type, then) => this.vLater(at, () => { this.vStrike(mage, foe.x, null, 5); this.vBolt(page, mage.x + 12, feet - 34, foe.x - 8, feet - 22, damageTypes[type].color, 380, () => { this.vHit(foe); if (then) then(); }); });
      bolt(200, r.first, () => { this.vTint(foe, hex(damageTypes[r.first].color)); this.vLater(500, () => this.vTint(foe, null)); });
      bolt(1100, r.second, () => this.vWord(page, foe.x, foe.y - 40, r.word, r.color, 16));
    });
  },

  // MIXING ELEMENTS: a mage's fire hit; each new item of ANOTHER element next to her cuts the number a little.
  visual_mixing(page, x, y, w, h) {
    const M = V.mixing, feet = y + h - 14;
    const ch = this.sprite(page, hero(M.hero), x + Math.round(w * 0.16), feet, h - 30);
    const foe = this.vFace(this.sprite(page, enemy(M.enemy), x + Math.round(w * 0.86), feet, 40), true);
    const icons = M.items.map((id, i) => {
      const bx = x + Math.round(w * 0.3) + i * 46, by = y + 8;
      const frame = drawWindow(this.add.graphics(), bx, by, 38, 38); page.add(frame);
      const im = this.add.image(bx + 19, by + 19, bareIconKey(this, id)).setScale(2); page.add(im);
      return [frame, im];
    });
    const pen = combat.elementMix.penaltyPerExtraPercent;
    this.vLoop(M.loopMs, () => {
      icons.forEach(([f, im], i) => { f.setAlpha(i ? 0 : 1); im.setAlpha(i ? 0 : 1); });
      M.items.forEach((_, i) => this.vLater(300 + i * M.stepMs, () => {
        if (i) { icons[i].forEach((o) => o.setAlpha(1)); this.vTween({ targets: icons[i][1], scale: 2.6, duration: 120, yoyo: true }); }
        this.vLater(120, () => {
          this.vStrike(ch, foe.x, null, 5);
          this.vBolt(page, ch.x + 12, feet - 34, foe.x - 8, feet - 20, damageTypes.fire.color, 300, () => { this.vHit(foe); this.vWord(page, foe.x - 6, foe.y - 34, String(M.base - pen * i), FXC.attackColor); });
        });
      }));
    });
  },
};
