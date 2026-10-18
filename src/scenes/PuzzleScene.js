import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../config.js';
import { drawWindow } from '../entities/uiKit.js';
import * as sfx from '../audio/sfx.js';
import { shuffleBoard, slide, isSolved } from '../systems/rooms.js';

const FONT = UI.font; // the interface look: black windows, white lines, pixel font (config.js UI)
const SHEET_TOP = 44;
const TILE = 104; // one tile on screen
const GAP = 6;

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
    drawWindow(bg, 4, SHEET_TOP, GAME_WIDTH - 8, GAME_HEIGHT - SHEET_TOP + 40);
    this.sheet.add(bg);
    this.sheet.add(this.add.text(GAME_WIDTH / 2, SHEET_TOP + 20, 'PUZZLE ROOM', { fontFamily: FONT, fontSize: '8px', color: UI.gold }).setOrigin(0.5, 0));
    this.sheet.add(this.add.text(GAME_WIDTH / 2, 150, 'Slide the tiles', { fontFamily: FONT, fontSize: '16px', color: UI.text }).setOrigin(0.5, 0));
    this.sheet.add(this.add.text(GAME_WIDTH / 2, 184, 'Put them in order 1 to 8.\nTap a tile next to the gap.', { fontFamily: FONT, fontSize: '8px', color: '#c8c8d4', align: 'center', lineSpacing: 6 }).setOrigin(0.5, 0));
    this.moveText = this.add.text(GAME_WIDTH / 2, 226, 'Moves: 0', { fontFamily: FONT, fontSize: '8px', color: UI.text }).setOrigin(0.5, 0);
    this.sheet.add(this.moveText);

    // The board frame.
    const boardW = size * TILE + (size + 1) * GAP;
    this.left = (GAME_WIDTH - boardW) / 2 + GAP;
    this.top = 270;
    const frame = this.add.graphics();
    drawWindow(frame, this.left - GAP - 4, this.top - GAP - 4, boardW + 8, boardW + 8, { fill: 0x14101f });
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
    drawWindow(giveUp, GAME_WIDTH / 2 - 80, by, 160, 44);
    this.sheet.add(giveUp);
    this.sheet.add(this.add.text(GAME_WIDTH / 2, by + 23, 'Give up', { fontFamily: FONT, fontSize: '16px', color: UI.text }).setOrigin(0.5));
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
    // A tile is a small black window with a big white number; solved, they all turn gold.
    const tile = this.add.container(0, 0);
    const g = this.add.graphics();
    const num = this.add.text(TILE / 2 + 2, TILE / 2 + 2, String(n), { fontFamily: FONT, fontSize: '32px', color: UI.text }).setOrigin(0.5);
    tile.paint = (glow) => {
      g.clear();
      drawWindow(g, 0, 0, TILE, TILE, { line: glow ? 0xffd84a : UI.line });
      num.setColor(glow ? UI.gold : UI.text);
    };
    tile.paint(false);
    tile.add(g);
    tile.add(num);
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
    this.moveText.setText(`Solved in ${this.moves} moves!`).setColor(UI.gold);
    this.time.delayedCall(1000, () => this.finish(true));
  }

  finish(solved) {
    if (this.closing) return;
    this.closing = true;
    this.done = true;
    this.tweens.add({ targets: this.sheet, y: GAME_HEIGHT, duration: 300, ease: 'Cubic.easeIn', onComplete: () => this.payload.onDone(solved) });
  }
}
