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

  // YOUR SQUAD: three heroes side by side; the third has fallen: only a tombstone is left where it stood.
  visual_squad(page, x, y, w, h) {
    const feet = y + h - 14, ids = V.squad.heroes;
    ids.forEach((id, i) => {
      const cx = x + Math.round(w * (i + 1) / (ids.length + 1));
      if (i === ids.length - 1) { const g = drawGrave(this.add.graphics(), 3); g.setPosition(cx, feet); page.add(g); return; }
      this.sprite(page, hero(id), cx, feet, h - 24);
    });
  },

  // FLOORS: a fight -> a special room (treasure chest) -> ... -> the boss on floor 20, with floor numbers under them.
  visual_floors(page, x, y, w, h) {
    const F = V.floors, feet = y + h - 26, slots = [0.14, 0.4, 0.63, 0.86].map((f) => x + Math.round(w * f));
    this.sprite(page, enemy(F.fight), slots[0], feet, 40);
    const chest = this.sprite(page, roomProps[F.room], slots[1], feet, 40);
    chest.setScale(roomProps[F.room].drawScale || 3);
    this.text(page, slots[2], feet - 18, '. . .', 'normal', UI.dim).setOrigin(0.5);
    const boss = this.sprite(page, enemy(F.boss), slots[3], feet, h - 30, false, 2);
    boss.setScale(Math.min(2, (h - 34) / (enemies[F.boss].height || 32)));
    [[0, '1'], [1, '2'], [3, '20']].forEach(([i, n]) => this.text(page, slots[i], feet + 6, n, 'small', i === 3 ? UI.red : UI.gold).setOrigin(0.5, 0));
    this.visualArrow(page, Math.round((slots[0] + slots[1]) / 2), feet - 18);
    this.visualArrow(page, Math.round((slots[2] + slots[3]) / 2) - 8, feet - 18);
  },

  // SKILLS: a hero with its two skill squares under it, like in a fight: red = attack (ready), green = support; and the
  // same support square cooling down (grey fill draining, seconds left).
  visual_skills(page, x, y, w, h) {
    const S = V.skills, def = hero(S.hero), cx = x + Math.round(w * 0.2), feet = y + h - 14;
    this.sprite(page, def, cx, feet, h - 24);
    const size = 44, gap = 8, sy = y + Math.round((h - size) / 2), sx = x + w - (3 * size + gap + 30) - 14; // three squares + the arrow, right-aligned
    const square = (bx, kind, cooling) => {
      const line = cooling ? 0x4a4a5a : hex(kind === 'attack' ? UI.red : UI.green);
      const g = this.add.graphics();
      g.fillStyle(line, 1).fillRect(bx, sy, size, size).fillStyle(UI.goldTheme.slot, 1).fillRect(bx + 2, sy + 2, size - 4, size - 4);
      page.add(g);
      const key = skillIconKey(this, def.skills[kind]);
      if (key) { const icon = this.add.image(bx + size / 2, sy + size / 2, key).setScale(2); if (cooling) icon.setTint(0x5a5a66); page.add(icon); }
      if (cooling) {
        page.add(this.add.graphics().fillStyle(0x2a2a36, 0.85).fillRect(bx + 2, sy + 2, size - 4, Math.round((size - 4) * 0.55)));
        this.text(page, bx + size / 2, sy + size / 2, String(S.cooldownSec), 'normal', UI.text).setOrigin(0.5);
      }
    };
    square(sx, 'attack', false);
    square(sx + size + gap, 'support', false);
    this.visualArrow(page, sx + 2 * size + gap + 16, sy + size / 2);
    square(sx + 2 * size + gap + 30, 'support', true);
  },

  // DEFENSE AND RESIST: two small fights. Left: a melee hit on a hero with a defense item -> a small white number.
  // Right: a fire hit on a hero with a resist item -> a small orange number. (The item floats over the hero.)
  visual_defense(page, x, y, w, h) {
    const D = V.defense, feet = y + h - 14, half = Math.round(w / 2);
    page.add(this.add.graphics().fillStyle(0x000000, 0.35).fillRect(x + half - 1, y + 8, 2, h - 16)); // a thin split
    [[D.physical, 0], [D.magical, half]].forEach(([s, ox]) => {
      const ex = x + ox + Math.round(half * 0.26), hx = x + ox + Math.round(half * 0.7);
      this.sprite(page, enemy(s.enemy), ex, feet, 40, false, 2);
      const hc = this.sprite(page, hero(s.hero), hx, feet, h - 30, false, 2);
      hc.setScale(-Math.abs(hc.scaleX), hc.scaleY); // the hero faces the enemy (left)
      const icon = this.add.image(hx + 22, y + 22, bareIconKey(this, s.item)).setScale(2);
      page.add(drawWindow(this.add.graphics(), hx + 22 - 20, y + 2, 40, 40));
      page.add(icon);
      this.visualNumber(page, hx - 18, y + 34, s.number, damageTypes[s.type].color, 16);
    });
  },
};
