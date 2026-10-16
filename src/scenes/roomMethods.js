import Phaser from 'phaser';
import { GAME_WIDTH } from '../config.js';
import Character from '../entities/Character.js';
import * as sfx from '../audio/sfx.js';
import roomRules from '../data/rooms.json';
import roomProps from '../data/roomProps.json';
import bookData from '../data/skillBooks.json';
import { roomForFloor } from '../systems/rooms.js';

// SPECIAL ROOMS (user's choice): from floor 4 about 1 floor in 4 is not a fight but a room (rooms.json):
// TREASURE (1-2 chests, each = a 1-of-3 item pick), MIMIC (one chest that jumps up and fights; its prize is
// rare/epic only), REST FOUNTAIN (heals 50% + a regen buff for the next 3 fights), SKILL DEALER (1 of 5 pages)
// and a SLIDE PUZZLE (PuzzleScene; solved = an item pick). The rules live in systems/rooms.js; these methods are
// mixed into BattleScene (like bossMethods into BattleState). When the room is done the door opens and the
// squad walks on as after a fight.

const PROP_Y = 360; // where the props stand (the enemies' line)

export const roomMethods = {
  // Which room (or null = a fight) floor n is. Never two rooms in a row.
  roomKindFor(n) {
    const prev = this.layer && this.layer.room ? this.layer.room.kind : null;
    // Dev server only: ?room=treasure makes every odd floor that room (browser checks).
    const forced = import.meta.env.DEV && new URLSearchParams(location.search).get('room');
    if (forced && roomRules.kinds[forced]) return n % 2 ? forced : null;
    return roomForFloor(roomRules, this.dungeon, n, prev);
  },

  // After the heroes walked in: a fight, or the room's props wake up.
  beginFloor() {
    this.enterHeroes(() => (this.layer.room ? this.startRoom() : this.startFighting()));
  },

  // The props of a room, drawn on its floor (container). Returns the room: { kind, rules, props: [{ ch, x, arrow }] }.
  buildRoom(kind, container) {
    const rules = roomRules.kinds[kind];
    const room = { kind, rules, props: [], busy: false };
    const xs =
      kind === 'treasure' ? (Math.random() < rules.twoChestChance ? [GAME_WIDTH / 3, (GAME_WIDTH * 2) / 3] : [GAME_WIDTH / 2]) : [rules.x ?? GAME_WIDTH / 2];
    const def = { treasure: 'chest', mimic: 'chest', fountain: 'fountain', dealer: 'dealer', puzzle: 'tablet' }[kind];
    for (const x of xs) {
      const ch = new Character(this, x, PROP_Y, roomProps[def]);
      container.add(ch);
      room.props.push({ ch, x, done: false });
    }
    return room;
  },

  // The room is ready: its name and a hint show, a small gold arrow bobs over everything that can be tapped.
  startRoom() {
    this.mode = 'room';
    this.showSlots(true);
    const room = this.layer.room;
    this.banner.setText(room.rules.name);
    this.roomHint = this.add
      .text(GAME_WIDTH / 2, 556, room.rules.hint, { fontFamily: 'monospace', fontSize: '15px', color: '#f2e6b0', stroke: '#000000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(20);
    for (const prop of room.props) {
      const { ch } = prop;
      const def = ch.def;
      const h = def.height;
      const w = 22;
      ch.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h - 4, w, h + 8), Phaser.Geom.Rectangle.Contains);
      ch.on('pointerdown', () => this.tapProp(prop));
      const top = PROP_Y - h * (def.drawScale ?? 3) - 22;
      prop.arrow = this.add.triangle(prop.x, top, 0, 0, 20, 0, 10, 14, 0xf2b632).setStrokeStyle(2, 0x000000).setDepth(20);
      this.tweens.add({ targets: prop.arrow, y: top - 10, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  },

  // A prop was tapped: what happens depends on the room.
  tapProp(prop) {
    const room = this.layer.room;
    if (this.mode !== 'room' || room.busy || prop.done) return;
    room.busy = true;
    prop.done = true;
    if (prop.arrow) prop.arrow.destroy();
    if (this.roomHint) this.roomHint.setText('');
    this.banner.setText('');
    sfx.play('tap');
    const after = () => {
      room.busy = false;
      if (room.props.every((p) => p.done)) this.leaveRoom();
    };
    ({ treasure: () => this.openChest(prop, () => this.vanishProp(prop, after)), mimic: () => this.wakeMimic(prop), fountain: () => this.drinkFountain(prop), dealer: () => this.visitDealer(() => this.stepAside(prop, after)), puzzle: () => this.startPuzzle(() => this.vanishProp(prop, after)) })[room.kind]();
  },

  // A used prop (an emptied chest, the solved tablet) sinks into the floor in a puff, so the squad does not walk
  // through it on the way to the door.
  vanishProp(prop, after) {
    const ch = prop.ch;
    this.puff(prop.x, PROP_Y - 12, 0x8a7a9a, 8);
    this.tweens.add({ targets: ch, scaleY: 0.05, alpha: 0, duration: 320, ease: 'Back.easeIn', onComplete: () => ch.destroy() });
    this.time.delayedCall(360, after);
  },

  // The dealer is done: he walks to the side wall (hopping like the heroes) and waits there, out of the way.
  stepAside(prop, after) {
    const ch = prop.ch;
    const toX = prop.x < GAME_WIDTH / 2 ? GAME_WIDTH - 46 : 46;
    ch.face(toX < ch.x ? -1 : 1);
    const dist = Math.abs(toX - ch.x);
    const hop = { t: 0 };
    this.tweens.add({ targets: ch, x: toX, duration: (dist / 170) * 1000, ease: 'Linear' });
    this.tweens.add({ targets: hop, t: 1, duration: (dist / 170) * 1000, onUpdate: () => (ch.y = PROP_Y - Math.abs(Math.sin(hop.t * Math.PI * 6)) * 6), onComplete: () => { ch.y = PROP_Y; ch.face(toX < GAME_WIDTH / 2 ? 1 : -1); after(); } });
  },

  // A normal item pick (1 of 3) on a sheet, then `after`.
  itemPick(banner, after, odds = null) {
    const choices = this.rollItems(odds);
    if (!choices.length) return after();
    this.openRewardSheet(choices, after, banner);
  },

  // The lid swings open, gold sparkles, then the item pick.
  openChest(prop, after) {
    const lid = prop.ch.parts.head;
    this.tweens.add({ targets: lid, angle: -110, duration: 260, ease: 'Back.easeOut' });
    sfx.play('doorOpen');
    this.time.delayedCall(200, () => this.puff(prop.x, PROP_Y - 50, 0xf2c544, 10));
    this.time.delayedCall(520, () => this.itemPick('TREASURE CHEST', after));
  },

  // The chest shakes... and it is a Mimic. It becomes an enemy and the fight starts; the prize comes after the win.
  wakeMimic(prop) {
    const ch = prop.ch;
    this.tweens.add({ targets: ch, x: ch.x + 5, duration: 50, yoyo: true, repeat: 7 });
    sfx.play('bossWarn');
    this.time.delayedCall(820, () => {
      ch.destroy();
      const [unit] = this.state.spawnEnemies([this.layer.room.rules.enemy], this.floor);
      this.showEnemySpawn(unit, 0x5e3a1a);
      this.popText(this.views.get(unit.uid), 'MIMIC!', '#ff5a5a', true);
      sfx.play('bossMove');
      this.layer.room.fought = true;
      this.startFighting(); // the win goes through onWin like any fight; showReward gives the Mimic's prize
    });
  },

  // The squad drinks: every living hero heals and is blessed (regen for the next fights).
  drinkFountain(prop) {
    const rules = this.layer.room.rules;
    sfx.play('potion');
    this.tweens.add({ targets: prop.ch, alpha: 0.6, duration: 160, yoyo: true, repeat: 2 });
    for (const { unit, amount } of this.state.healHeroes(rules.healPercent)) {
      const v = this.views.get(unit.uid);
      this.setBar(v);
      if (Math.round(amount) > 0) this.popText(v, `+${Math.round(amount)}`, '#6dff8f', true);
      this.addMoment('heal', v);
    }
    this.state.bless(rules.regenPercentPerSec, rules.fights);
    this.banner.setText(`Blessed!\nRegen for the next ${rules.fights} fights`);
    this.time.delayedCall(1400, () => {
      this.banner.setText('');
      this.layer.room.busy = false;
      this.leaveRoom();
    });
  },

  // The dealer opens a book of 5 pages (skillBooks.json contents.dealer).
  visitDealer(after) {
    if (!this.state.heroes.some((h) => h.alive)) return after();
    this.openRewardSheet([bookData.cards.dealer], after, 'THE SKILL DEALER');
  },

  // The slide puzzle sheet; solved = an item pick, given up = nothing.
  startPuzzle(after) {
    const rules = this.layer.room.rules;
    this.scene.launch('Puzzle', {
      size: rules.size,
      moves: rules.shuffleMoves,
      onDone: (solved) => {
        this.scene.stop('Puzzle');
        this.scene.resume();
        if (solved) this.itemPick('PUZZLE SOLVED', after);
        else after();
      },
    });
    this.scene.pause();
  },

  // The room is done: the door opens and the squad walks on.
  leaveRoom() {
    this.mode = 'won';
    if (this.roomHint) this.roomHint.destroy();
    this.roomHint = null;
    this.layer.setDoorOpen(true);
    sfx.play('doorOpen');
    this.time.delayedCall(700, () => this.goToNextFloor());
  },

  // Through the door to the next floor (after a won fight or a finished room).
  goToNextFloor() {
    this.showSlots(false);
    this.heroesWalkToDoor(() => {
      this.removeFallenHeroes();
      this.slideToNextFloor(() => this.beginFloor());
    });
  },
};
