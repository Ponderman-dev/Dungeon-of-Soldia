import Phaser from 'phaser';
import { loadUiFont } from '../entities/uiKit.js';

// First scene: loads the interface font, then opens the title screen with its INTRO (TitleScene: the logo and the
// LOADING bar up in the night sky while every picture is made once, then the camera glides down to the forest).
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    // The interface font must be ready before any text is drawn (else the first screen shows the fallback font).
    loadUiFont().then(() => {
      if (import.meta.env.VITE_SQUAD_DEMO === '1') return this.scene.start('Squad'); // the squad screen demo page: straight to it, no test buttons
      this.scene.start('Title', { intro: true });
      if (import.meta.env.VITE_TESTER !== '1') this.scene.launch('Debug'); // test buttons, always on top (not in the playtest build, npm run build:itch)
    });
  }
}
