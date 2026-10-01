import Phaser from 'phaser';
import { GAME_WIDTH, CHAR_SCALE } from '../config.js';
import heroDefs from '../data/heroes.json';
import enemyDefs from '../data/enemies.json';
import dungeons from '../data/dungeons.json';
import combatRules from '../data/combat.json';
import damageTypes from '../data/damageTypes.json';
import Character from '../entities/Character.js';
import BattleState from '../systems/BattleState.js';
import { validateDungeon } from '../systems/validate.js';

const DUNGEON_ID = 'A';
const SLOT_Y = 720;
const SLOT_WIDTH = GAME_WIDTH / 4;
const ENEMY_Y = 340;
const BAR_WIDTH = 44;

// The battle screen: enemies at the top, four heroes at the bottom, everyone auto-attacks.
// The fight rules live in systems/BattleState.js; this scene only draws what happens.
export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  create() {
    this.dungeon = dungeons[DUNGEON_ID];
    for (const problem of validateDungeon(this.dungeon, enemyDefs)) console.error('Dungeon data:', problem);

    this.floor = 1;
    this.mode = 'fighting'; // 'fighting' | 'won' | 'lost'
    this.views = new Map(); // unit uid -> { unit, ch, bg, fill, groundY }
    this.state = new BattleState({
      heroDefs: heroDefs.slice(0, 4),
      enemyDefs,
      rules: combatRules,
      damageTypes,
    });

    this.drawHeroSlots();
    this.floorText = this.add.text(GAME_WIDTH / 2, 24, '', { fontFamily: 'monospace', fontSize: '16px', color: '#9a8fc0' }).setOrigin(0.5);
    this.banner = this.add
      .text(GAME_WIDTH / 2, 520, '', { fontFamily: 'monospace', fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(20);
    this.focusMarker = this.add.ellipse(0, 0, 70, 18).setStrokeStyle(2, 0xff4d4d).setVisible(false);

    this.startFloor(1);
  }

  drawHeroSlots() {
    this.state.heroes.forEach((unit, i) => {
      const cx = SLOT_WIDTH * i + SLOT_WIDTH / 2;
      this.add.rectangle(cx, SLOT_Y - 40, SLOT_WIDTH - 12, 110, 0x1d1730).setStrokeStyle(1, 0x3a3057);
      this.add.text(cx, SLOT_Y + 28, unit.name, { fontFamily: 'monospace', fontSize: '12px', color: '#9a8fc0' }).setOrigin(0.5);
      this.makeView(unit, cx, SLOT_Y);
    });
  }

  // Draws one fighter: the character, plus a health bar above it.
  makeView(unit, x, groundY) {
    const hover = unit.flying ? unit.def.hover || 0 : 0;
    const ch = new Character(this, x, groundY - hover, unit.def);
    const barY = groundY - hover - unit.def.height * CHAR_SCALE - 10;
    const bg = this.add.rectangle(x, barY, BAR_WIDTH + 2, 7, 0x000000);
    const fill = this.add
      .rectangle(x - BAR_WIDTH / 2, barY, BAR_WIDTH, 5, unit.side === 'hero' ? 0x4cd16a : 0xe04b4b)
      .setOrigin(0, 0.5);
    const view = { unit, ch, bg, fill, groundY };
    this.views.set(unit.uid, view);

    if (unit.side === 'enemy') {
      // Tap an enemy to focus it.
      const h = unit.def.height;
      ch.setInteractive(new Phaser.Geom.Rectangle(-16, -h - 2, 32, h + 4), Phaser.Geom.Rectangle.Contains);
      ch.on('pointerdown', () => this.state.setFocus(unit.uid));
    }
    return view;
  }

  startFloor(n) {
    this.floor = n;
    const floors = this.dungeon.floors;
    // Use the last defined floor once we run past the end of the list.
    const entry = [...floors].reverse().find((f) => f.floor <= n) || floors[0];
    const enemies = this.state.spawnEnemies(entry.enemies, n);

    enemies.forEach((unit, i) => {
      const x = (GAME_WIDTH * (i + 1)) / (enemies.length + 1);
      this.makeView(unit, x, ENEMY_Y);
    });

    this.floorText.setText(`Floor ${n}`);
    this.banner.setText('');
    this.mode = 'fighting';
  }

  update(time, delta) {
    if (this.mode !== 'fighting') return;

    // Cap the step so switching browser tabs doesn't cause a huge jump.
    const events = this.state.update(Math.min(delta, 100));
    for (const e of events) this.showEvent(e);

    const focus = this.state.focusUnit;
    if (focus) {
      const v = this.views.get(focus.uid);
      this.focusMarker.setPosition(v.ch.homeX, v.groundY + 6).setVisible(true);
    } else {
      this.focusMarker.setVisible(false);
    }

    if (this.state.allEnemiesDead()) this.onWin();
    else if (this.state.allHeroesDead()) this.onLoss();
  }

  showEvent(e) {
    if (e.type === 'attack') {
      const a = this.views.get(e.attacker.uid);
      const t = this.views.get(e.target.uid);
      a.ch.lunge(t.ch.homeX, t.ch.homeY);
      if (e.result.dodged) {
        this.popText(t, 'Miss', '#aaaaaa');
        return;
      }
      t.ch.flash();
      this.setBar(t);
      const { amount, crit, mult } = e.result;
      const mark = mult > 1 ? '!' : mult < 1 ? '…' : '';
      const color = e.attacker.side === 'hero' ? this.damageTypes()[e.attacker.damageType].color : '#ff6b6b';
      this.popText(t, `${amount}${mark}`, crit ? '#ffd24d' : color, crit);
    } else if (e.type === 'death') {
      const v = this.views.get(e.unit.uid);
      this.setBar(v);
      if (e.unit.side === 'enemy') {
        this.tweens.add({ targets: [v.ch, v.bg, v.fill], alpha: 0, duration: 400, onComplete: () => this.removeView(e.unit.uid) });
      } else {
        v.ch.setAlpha(0.25);
        v.bg.setAlpha(0.4);
        v.fill.setAlpha(0.4);
      }
    }
  }

  damageTypes() {
    return damageTypes;
  }

  setBar(view) {
    view.fill.width = BAR_WIDTH * (view.unit.hp / view.unit.maxHp);
  }

  removeView(uid) {
    const v = this.views.get(uid);
    if (!v) return;
    v.ch.destroy();
    v.bg.destroy();
    v.fill.destroy();
    this.views.delete(uid);
  }

  // Floating number above a fighter.
  popText(view, text, color, big = false) {
    const y = view.ch.homeY - view.unit.def.height * CHAR_SCALE - 22;
    const t = this.add
      .text(view.ch.homeX, y, text, {
        fontFamily: 'monospace',
        fontSize: big ? '20px' : '14px',
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  onWin() {
    this.mode = 'won';
    this.banner.setText(`Floor ${this.floor} cleared!`);
    this.time.delayedCall(combatRules.nextFloorDelayMs, () => {
      for (const { unit, amount } of this.state.healHeroes(combatRules.winHealPercent)) {
        const v = this.views.get(unit.uid);
        this.setBar(v);
        if (amount > 0) this.popText(v, `+${amount}`, '#6dff8f');
      }
      this.startFloor(this.floor + 1);
    });
  }

  onLoss() {
    this.mode = 'lost';
    this.banner.setText(`Squad defeated\nReached floor ${this.floor}`);
    this.time.delayedCall(combatRules.restartDelayMs, () => this.scene.restart());
  }
}
