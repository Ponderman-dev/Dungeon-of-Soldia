import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import * as sfx from '../audio/sfx.js';
import { shuffleBoard, slide, isSolved } from '../systems/rooms.js';

const FONT = 'system-ui, Arial, sans-serif';
const SHEET_TOP = 44;
const TILE = 104; // one tile on screen
const GAP = 6;
// Tile colours run from purple (1) to gold (8), so the order is easy to see.
const FROM = Phaser.Display.Color.ValueToColor(0x6a3fb0);
const TO = Phaser.Display.Color.ValueToColor(0xf2b632);

// The slide puzzle of the Puzzle Room (rooms.json `puzzle`): a sheet like the reward screen with a 3x3 board.
// Tap a tile next to the gap to slide it. Put 1-8 in order (gap bottom right) = solved. "Give up" leaves with
// nothing. Reports through payload.onDone(solved). The board rules are in systems/rooms.js.
export default class PuzzleScene extends Phaser.Scene {
  constructor() {
    super('Puzzle');
  }

  init(payload) {
    this.payload = payload; // { size, moves, onDone }
  }

  create() {
    const size = this.payload.size;
    this.size = size;
    this.board = shuffleBoard(size, this.payload.moves);
    this.moves = 0;
    this.done = false;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05030a, 0.6).setInteractive();
    this.sheet = this.add.container(0, GAME_HEIGHT);
    const bg = this.add.graphics();
    bg.fillStyle(0x17112a, 1).fillRoundedRect(0, SHEET_TOP, GAME_WIDTH, GAME_HEIGHT - SHEET_TOP + 40, 24);
    bg.lineStyle(2, 0x8b55d6, 0.8).strokeRoundedRect(0, SHEET_TOP, GAME_WIDTH, GAME_HEIGHT - SHEET_TOP + 40, 24);
    this.sheet.add(bg);
    this.sheet.add(this.add.text(GAME_WIDTH / 2, SHEET_TOP + 24, 'PUZZLE ROOM', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#f2b632' }).setOrigin(0.5, 0));
    this.sheet.add(this.add.text(GAME_WIDTH / 2, 150, 'Slide the tiles', { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#f3eefc' }).setOrigin(0.5, 0));
    this.sheet.add(this.add.text(GAME_WIDTH / 2, 190, 'Put them in order 1 to 8. Tap a tile next to the gap.', { fontFamily: FONT, fontSize: '13px', color: '#a399c2' }).setOrigin(0.5, 0));
    this.moveText = this.add.text(GAME_WIDTH / 2, 226, 'Moves: 0', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#f3eefc' }).setOrigin(0.5, 0);
    this.sheet.add(this.moveText);

    // The board frame.
    const boardW = size * TILE + (size + 1) * GAP;
    this.left = (GAME_WIDTH - boardW) / 2 + GAP;
    this.top = 270;
    const frame = this.add.graphics();
    frame.fillStyle(0x0d0a18, 1).fillRoundedRect(this.left - GAP, this.top - GAP, boardW, boardW, 14);
    frame.lineStyle(2, 0x3a2f57, 1).strokeRoundedRect(this.left - GAP, this.top - GAP, boardW, boardW, 14);
    this.sheet.add(frame);

    // One container per tile, keyed by its number.
    this.tiles = {};
    this.board.forEach((n, i) => {
      if (!n) return;
      const tile = this.makeTile(n);
      this.tiles[n] = tile;
      tile.setPosition(...this.spot(i));
      this.sheet.add(tile);
    });

    // Give up: leave the room with nothing.
    const by = this.top + boardW + 40;
    const giveUp = this.add.graphics();
    giveUp.fillStyle(0x231b38, 1).fillRoundedRect(GAME_WIDTH / 2 - 80, by, 160, 44, 22).lineStyle(2, 0x3a2f57, 1).strokeRoundedRect(GAME_WIDTH / 2 - 80, by, 160, 44, 22);
    this.sheet.add(giveUp);
    this.sheet.add(this.add.text(GAME_WIDTH / 2, by + 22, 'Give up', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#a399c2' }).setOrigin(0.5));
    const zone = this.add.zone(GAME_WIDTH / 2, by + 22, 160, 48).setInteractive();
    this.sheet.add(zone);
    zone.on('pointerdown', () => this.finish(false));

    this.tweens.add({ targets: this.sheet, y: 0, duration: 420, ease: 'Cubic.easeOut' });
    sfx.play('rewardUp');
  }

  // The top-left corner of board spot i.
  spot(i) {
    return [this.left + (i % this.size) * (TILE + GAP), this.top + Math.floor(i / this.size) * (TILE + GAP)];
  }

  makeTile(n) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(FROM, TO, this.size * this.size - 2, n - 1);
    const color = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    const tile = this.add.container(0, 0);
    const g = this.add.graphics();
    tile.paint = (glow) => {
      g.clear();
      g.fillStyle(0x000000, 0.35).fillRoundedRect(2, 4, TILE, TILE, 12);
      g.fillStyle(color, 1).fillRoundedRect(0, 0, TILE, TILE, 12);
      g.fillStyle(0xffffff, 0.18).fillRoundedRect(4, 4, TILE - 8, 14, 7);
      g.lineStyle(glow ? 4 : 2, glow ? 0xffffff : 0x000000, glow ? 1 : 0.5).strokeRoundedRect(0, 0, TILE, TILE, 12);
    };
    tile.paint(false);
    tile.add(g);
    tile.add(this.add.text(TILE / 2, TILE / 2, String(n), { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 5 }).setOrigin(0.5));
    const hit = this.add.zone(TILE / 2, TILE / 2, TILE, TILE).setInteractive();
    hit.on('pointerdown', () => this.tapTile(n));
    tile.add(hit);
    return tile;
  }

  tapTile(n) {
    if (this.done || this.sliding) return;
    const from = this.board.indexOf(n);
    const next = slide(this.board, this.size, from);
    if (!next) return; // not next to the gap
    this.board = next;
    this.moves++;
    this.moveText.setText(`Moves: ${this.moves}`);
    sfx.play('puzzleSlide');
    const [x, y] = this.spot(this.board.indexOf(n));
    this.sliding = true;
    this.tweens.add({
      targets: this.tiles[n],
      x,
      y,
      duration: 110,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.sliding = false;
        if (isSolved(this.board)) this.solved();
      },
    });
  }

  // Every tile glows, then the sheet goes down and the item pick comes.
  solved() {
    this.done = true;
    sfx.play('puzzleSolved');
    Object.values(this.tiles).forEach((t, i) => this.time.delayedCall(i * 50, () => t.paint(true)));
    this.moveText.setText(`Solved in ${this.moves} moves!`).setColor('#f2b632');
    this.time.delayedCall(1000, () => this.finish(true));
  }

  finish(solved) {
    if (this.closing) return;
    this.closing = true;
    this.done = true;
    this.tweens.add({ targets: this.sheet, y: GAME_HEIGHT, duration: 300, ease: 'Cubic.easeIn', onComplete: () => this.payload.onDone(solved) });
  }
}
