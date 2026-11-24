// Part of GlossaryScene (mixed into its prototype; `this` is the scene). The BASICS pictures (session 53, user: 'the
// basics need visuals'; picked: GAME ART ONLY, still pictures). glossary.json basics[i].visual names one of the
// methods below; each draws into `page` inside the box (x, y, w, h) using the game's own sprites, icons and colours.
import Phaser from 'phaser';
import { UI } from '../../config.js';
import { drawWindow } from '../../entities/uiKit.js';
import { bareIconKey } from '../../entities/itemIconTexture.js';
import { skillIconKey } from '../../entities/skillIconTexture.js';
import { drawGrave } from '../../entities/grave.js';
import heroes from '../../data/heroes.json';
import enemies from '../../data/enemies.json';
import roomProps from '../../data/roomProps.json';
import damageTypes from '../../data/damageTypes.json';
import G from '../../data/glossary.json';

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
      const num = this.visualNumber(page, hx - 18, y + 46, s.number, damageTypes[s.type].color, 16).setAlpha(0);
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
};
