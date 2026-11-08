import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config.js';
import { drawWindow, uiText, drawButton, buttonTextColor, popIn, popOut } from '../entities/uiKit.js';
import pauseData from '../data/pause.json';
import * as sfx from '../audio/sfx.js';

// The PAUSE window over a fight (the battle's pause button; data/pause.json). The Battle scene is paused under it.
// RESUME = back to the fight; SETTINGS = the Settings page over this window (back = here again); GIVE UP = asks first,
// then the run ends like a defeat (BattleScene.giveUp: game over summary, best floor kept).
const W = pauseData.window, TX = pauseData.text;
const RED = Phaser.Display.Color.HexStringToColor(UI.red).color;

export default class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create() {
    this.scene.bringToTop();
    this.busy = false;
    this.shade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, W.shade).setOrigin(0).setInteractive(); // blocks taps on the fight
    this.events.on(Phaser.Scenes.Events.RESUME, () => { this.busy = false; }); // back from Settings
    this.showMain();
  }

  // A window of `rows` buttons: [label, look ('main' | 'plain' | 'red'), onTap]. Replaces the window shown before.
  showWindow(title, body, rows) {
    if (this.box) this.box.destroy();
    const n = rows.length, bodyH = body ? 64 : 0;
    const h = W.firstY + bodyH + n * W.btnH + (n - 1) * W.gap + W.pad, x = (GAME_WIDTH - W.w) / 2, y = (GAME_HEIGHT - h) / 2, cx = GAME_WIDTH / 2;
    const box = (this.box = this.add.container(0, 0));
    box.add(drawWindow(this.add.graphics(), x, y, W.w, h));
    box.add(uiText(this, cx, y + W.titleY, title, 'big', rows.some((r) => r[1] === 'red') && body ? UI.red : UI.text).setOrigin(0.5, 0));
    if (body) box.add(uiText(this, cx, y + W.firstY, body, 'small', UI.text, { align: 'center', lineSpacing: 8 }).setOrigin(0.5, 0));
    rows.forEach(([label, look, onTap], i) => {
      const bx = x + W.pad, by = y + W.firstY + bodyH + i * (W.btnH + W.gap), bw = W.w - 2 * W.pad;
      const main = look === 'main';
      box.add(main ? drawButton(this.add.graphics(), bx, by, bw, W.btnH, { primary: true }) : drawWindow(this.add.graphics(), bx, by, bw, W.btnH, { line: look === 'red' ? RED : UI.line }));
      box.add(uiText(this, cx, by + W.btnH / 2, label, 'normal', main ? buttonTextColor(true, false, true) : look === 'red' ? UI.red : UI.text).setOrigin(0.5));
      const zone = this.add.zone(bx, by, bw, W.btnH).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => { if (!this.busy) onTap(); });
      box.add(zone);
    });
    return box;
  }

  // The window's drawn parts (not its tap zones) for popIn / popOut.
  shown() {
    return this.box.list.filter((o) => !(o instanceof Phaser.GameObjects.Zone));
  }

  showMain() {
    const box = this.showWindow(TX.title, null, [
      [TX.resume, 'main', () => this.resume()],
      [TX.settings, 'plain', () => this.openSettings()],
      [TX.giveUp, 'red', () => this.askGiveUp()],
    ]);
    if (!this.opened) { this.opened = true; sfx.play('cardOpen'); popIn(this, this.shown()); }
  }

  askGiveUp() {
    sfx.play('tap');
    this.showWindow(TX.confirmTitle, TX.confirm, [
      [TX.keep, 'plain', () => { sfx.play('tap'); this.showMain(); }],
      [TX.yes, 'red', () => this.leave((battle) => battle.giveUp())],
    ]);
  }

  openSettings() {
    sfx.play('tap');
    this.busy = true;
    this.scene.launch('Settings', { from: 'Pause' });
    this.scene.pause();
  }

  resume() {
    this.leave(() => {});
  }

  // The window lifts away, the fight runs again, then `then(battle)`.
  leave(then) {
    if (this.busy) return;
    this.busy = true;
    sfx.play('cardClose');
    popOut(this, this.shown(), [this.shade], () => {
      const battle = this.scene.get('Battle');
      this.scene.resume('Battle');
      this.scene.stop();
      then(battle);
    });
  }
}
