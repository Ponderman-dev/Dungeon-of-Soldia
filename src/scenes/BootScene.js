import Phaser from 'phaser';

// First scene. Later it will load assets; for now it just starts the battle screen.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.scene.start('Battle');
  }
}
