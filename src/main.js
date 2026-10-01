import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, BG_COLOR } from './config.js';
import BootScene from './scenes/BootScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: BG_COLOR,
  pixelArt: true, // nearest-neighbour scaling = crisp pixels
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT, // scale the 390x844 screen to fit any phone/window
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene],
});
