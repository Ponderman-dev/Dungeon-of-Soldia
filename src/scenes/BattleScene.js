import Phaser from 'phaser';
import { GAME_WIDTH } from '../config.js';
import heroes from '../data/heroes.json';
import Character from '../entities/Character.js';

const SLOT_Y = 720;
const SLOT_WIDTH = GAME_WIDTH / 4;

// Battle screen. For now: just the hero row, with one placeholder hero.
export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  create() {
    // Four empty hero slots along the bottom.
    for (let i = 0; i < 4; i++) {
      const cx = SLOT_WIDTH * i + SLOT_WIDTH / 2;
      this.add.rectangle(cx, SLOT_Y - 40, SLOT_WIDTH - 12, 110, 0x1d1730).setStrokeStyle(1, 0x3a3057);
    }

    // Put the first four heroes from heroes.json into the four slots.
    heroes.slice(0, 4).forEach((def, i) => {
      const cx = SLOT_WIDTH * i + SLOT_WIDTH / 2;
      new Character(this, cx, SLOT_Y, def);
      this.add
        .text(cx, SLOT_Y + 28, def.name, { fontFamily: 'monospace', fontSize: '12px', color: '#9a8fc0' })
        .setOrigin(0.5);
    });
  }
}
