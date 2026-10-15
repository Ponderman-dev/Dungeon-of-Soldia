import Phaser from 'phaser';
import { GAME_WIDTH } from '../config.js';

// TEST ONLY: a small always-on-top button that gives up the run and goes back to the
// squad select screen (nothing is saved). Remove this scene before release.
export default class DebugScene extends Phaser.Scene {
  constructor() {
    super('Debug');
  }

  create() {
    const w = 168;
    const h = 26;
    const x = GAME_WIDTH - w - 6;
    const y = 6;
    this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0.7).setStrokeStyle(2, 0xffe08a, 0.9);
    this.add
      .text(x + w / 2, y + h / 2, 'TEST: restart run', { fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#ffe08a' })
      .setOrigin(0.5);
    this.add
      .zone(x + w / 2, y + h / 2, w, h)
      .setInteractive()
      .on('pointerdown', () => {
        this.scene.stop('Reward');
        this.scene.stop('Puzzle');
        this.scene.stop('Battle');
        this.scene.run('Squad'); // run, not start: start would also stop this debug scene
      });
  }
}
