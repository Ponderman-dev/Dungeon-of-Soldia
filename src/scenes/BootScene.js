import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';

// First scene: just proves Phaser is running. Later it will load data and start the menu.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Dungeon of Soldia', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#6b5f8a',
      })
      .setOrigin(0.5);
  }
}
