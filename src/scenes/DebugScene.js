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

    // TEST: a second button that switches the squad (restarts the run) until squad select exists.
    const presets = [
      ['knight', 'rogue', 'archer'],
      ['berserker', 'samurai', 'mage'],
      ['cleric', 'necromancer', 'bard'],
      ['alchemist', 'knight', 'mage'],
    ];
    const y2 = y + h + 4;
    this.squadLabel = this.add
      .text(x + w / 2, y2 + h / 2, '', { fontFamily: 'monospace', fontSize: '10px', fontStyle: 'bold', color: '#ffe08a' })
      .setOrigin(0.5);
    this.add.rectangle(x + w / 2, y2 + h / 2, w, h, 0x000000, 0.7).setStrokeStyle(2, 0xffe08a, 0.8).setDepth(-1);
    const showSquad = () => this.squadLabel.setText(`TEST squad: ${(this.registry.get('squadIds') || presets[0]).map((i) => i.slice(0, 3)).join(' ')}`);
    showSquad();
    this.add
      .zone(x + w / 2, y2 + h / 2, w, h)
      .setInteractive()
      .on('pointerdown', () => {
        const now = (this.registry.get('squadIds') || presets[0]).join();
        const next = presets[(presets.findIndex((p) => p.join() === now) + 1) % presets.length];
        this.registry.set('squadIds', next);
        showSquad();
        this.scene.stop('Reward');
        this.scene.get('Battle').scene.restart();
      });

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
