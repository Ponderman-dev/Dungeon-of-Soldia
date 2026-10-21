import Phaser from 'phaser';
import { loadUiFont } from '../entities/uiKit.js';

// First scene: loads the interface font, then opens the title screen.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    // The interface font must be ready before any text is drawn (else the first screen shows the fallback font).
    loadUiFont().then(() => {
      this.scene.start('Title');
      if (import.meta.env.VITE_TESTER !== '1') this.scene.launch('Debug'); // test buttons, always on top (not in the playtest build, npm run build:itch)
    });
  }
}
