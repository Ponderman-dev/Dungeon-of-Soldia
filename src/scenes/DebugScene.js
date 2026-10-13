import Phaser from 'phaser';
import { GAME_WIDTH } from '../config.js';

// TEST ONLY: a small always-on-top button that turns the automatic reward picking on or off.
// (Remove this scene once rewards are played for real.)
export default class DebugScene extends Phaser.Scene {
  constructor() {
    super('Debug');
  }

  create() {
    if (this.registry.get('autoRewards') === undefined) this.registry.set('autoRewards', true);

    const w = 168;
    const h = 26;
    const x = GAME_WIDTH - w - 6;
    const y = 6;
    this.bg = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0.7).setStrokeStyle(2, 0xffffff, 0.8);
    this.label = this.add
      .text(x + w / 2, y + h / 2, '', { fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);
    this.add
      .zone(x + w / 2, y + h / 2, w, h)
      .setInteractive()
      .on('pointerdown', () => this.registry.set('autoRewards', !this.registry.get('autoRewards')));

    this.refresh();
    this.registry.events.on('changedata-autoRewards', this.refresh, this);
    this.events.once('shutdown', () => this.registry.events.off('changedata-autoRewards', this.refresh, this));
  }

  refresh() {
    const on = this.registry.get('autoRewards');
    this.label.setText(`TEST auto-reward: ${on ? 'ON ' : 'OFF'}`);
    this.bg.setStrokeStyle(2, on ? 0x6dff8f : 0xff6b6b, 0.9);
    this.label.setColor(on ? '#6dff8f' : '#ff6b6b');
  }
}
