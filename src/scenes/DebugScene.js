import Phaser from 'phaser';
import { GAME_WIDTH, UI } from '../config.js';
import { drawWindow } from '../entities/uiKit.js';
import { toggleTestPanel } from './testPanel.js';

// TEST ONLY: a small always-on-top button that gives up the run and goes back to the
// squad select screen (nothing is saved), and a 'TEST: tools' button (testPanel.js). Remove this scene before release.
export default class DebugScene extends Phaser.Scene {
  constructor() {
    super('Debug');
  }

  create() {
    // (user, session 40: the two buttons covered the profile) ONE small 'TEST' tab at the top middle; tapping it opens
    // the two test buttons under it (restart run, tools), tapping again closes them.
    const tw = 56, th = 22, tx = Math.round(GAME_WIDTH / 2 - tw / 2), ty = 4;
    const ink = { fontFamily: UI.font, fontSize: '8px', color: '#ffe08a' };
    drawWindow(this.add.graphics(), tx, ty, tw, th, { line: 0xffe08a }); // gold line: a test tool, not part of the game
    this.add.text(tx + tw / 2, ty + th / 2, 'TEST', ink).setOrigin(0.5);
    const w = 168, h = 26, x = Math.round(GAME_WIDTH / 2 - w / 2), y = ty + th + 4;
    const menu = this.add.container(0, 0).setVisible(false);
    const item = (yy, label, onTap) => {
      menu.add(drawWindow(this.add.graphics(), x, yy, w, h, { line: 0xffe08a }));
      menu.add(this.add.text(x + w / 2, yy + h / 2, label, ink).setOrigin(0.5));
      const z = this.add.zone(x + w / 2, yy + h / 2, w, h).on('pointerdown', () => { menu.setVisible(false); z1.disableInteractive(); z2.disableInteractive(); onTap(); });
      menu.add(z);
      return z;
    };
    const z1 = item(y, 'TEST: restart run', () => {
      this.scene.stop('Reward');
      this.scene.stop('Puzzle');
      this.scene.stop('Battle');
      this.scene.run('Squad'); // run, not start: start would also stop this debug scene
    });
    const z2 = item(y + h + 4, 'TEST: tools', () => toggleTestPanel(this.game)); // any floor, any item (testPanel.js)
    this.add.zone(tx + tw / 2, ty + th / 2, tw + 8, th + 6).setInteractive().on('pointerdown', () => {
      const open = !menu.visible;
      menu.setVisible(open);
      for (const z of [z1, z2]) { if (open) z.setInteractive(); else z.disableInteractive(); }
    });
  }
}
