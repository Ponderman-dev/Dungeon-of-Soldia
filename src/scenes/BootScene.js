import Phaser from 'phaser';

// First scene. Later it will load assets; for now it opens the squad select screen.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.scene.start('Squad');
    this.scene.launch('Debug'); // test button, always on top
  }
}
