import Phaser from 'phaser';
import { loadUiFont } from '../entities/uiKit.js';

// First scene: loads the interface font, then opens the squad select screen.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    // The interface font must be ready before any text is drawn (else the first screen shows the fallback font).
    loadUiFont().then(() => {
      this.scene.start('Squad');
      this.scene.launch('Debug'); // test button, always on top
    });
  }
}
