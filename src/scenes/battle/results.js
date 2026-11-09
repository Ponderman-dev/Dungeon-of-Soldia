// Part of BattleScene (mixed into its prototype at the bottom of ../BattleScene.js; `this` is the scene).
// After the fight: win, hero speech lines, the reward sheet, giving items / pages, loss and the defeat window (docs/systems/rewards.md).
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI } from '../../config.js';
import { drawWindow, uiText, uiButton } from '../../entities/uiKit.js';
import allHeroDefs from '../../data/heroes.json';
import combatRules from '../../data/combat.json';
import rarities from '../../data/rarities.json';
import rewardRules from '../../data/rewards.json';
import * as sfx from '../../audio/sfx.js';
import dialogue from '../../data/dialogue.json';
import { pickSpeech, clearSpeech } from '../../systems/dialogue.js';
import { rollChoices } from '../../systems/rewards.js';
import bookData from '../../data/skillBooks.json';
import { maybeAddBook } from '../../systems/books.js';
import { loadProgress, saveProgress, recordRun, unlockedIds } from '../../systems/progress.js';
import { newRunStats, finishRun } from '../../systems/runStats.js';
import profileData from '../../data/profile.json';
import { checkAchievements } from '../../systems/achievements.js';
import { mergeSeen } from '../../systems/glossary.js';
import unlocks from '../../data/unlocks.json';
import defeatData from '../../data/defeat.json';
import { T, itemDefs, BANNER_Y, charScale, DEPTH } from './shared.js';

export const resultsMethods = {
  onWin() {
    this.mode = 'won';
    sfx.play('floorClear');
    sfx.play('doorOpen');
    for (const e of this.state.endFloor()) this.showEvent(e); // weak minions vanish with the floor
    if (this.castBars) this.castBars.clear(); // a wind-up still going is dropped
    if (this.tauntLines) this.tauntLines.clear();
    this.drawBossHud(); // mode is 'won': the boss bar goes away
    this.focusMarker.setVisible(false);
    this.banner.setY(T.clearBannerY).setText(`Floor ${this.floor}\ncleared!`); // two lines (user): one line ran off the screen on floor 10+
    this.layer.setDoorOpen(true);

    this.state.clearStatuses();
    const saved = loadProgress(); // the Glossary keeps what this floor showed, even if the run is left half-way
    saveProgress(mergeSeen(saved, this.seenBuf, { enemies: this.state.enemies, heroes: this.state.heroes }));
    for (const h of this.state.heroes) {
      const v = this.views.get(h.uid);
      v.lookAt = null;
      if (h.alive) v.ch.face(1); // look the normal way again
      if (h.alive) {
        v.ch.setStunned(false);
        v.ch.cheer(); // victory clip (if it has one)
      }
      if (h.alive) this.runHome(v); // anyone still out at an enemy walks back before the door walk
      this.drawChips(v);
    }
    for (const m of this.state.minions) {
      const mv = this.views.get(m.uid);
      if (m.greater && m.alive && mv) {
        mv.lookAt = null;
        mv.ch.face(1);
        this.runHome(mv); // a greater minion walks back to its waiting spot too
      }
    }
    // A hero says something about the floor (before the win heal: a close call reads the health it ended with).
    const someoneFell = this.livingHeroViews().length < (this.aliveAtStart ?? 0);
    const bossFloor = !!(this.dungeon.bosses && this.dungeon.bosses[this.floor]);
    const said = clearSpeech(dialogue, this.state.heroes, { bossFloor, someoneFell });
    this.sayLine(said.kind, said.heroes); // never waited for: the bubble goes away just after the reward screen opens
    for (const { unit, amount } of this.state.winHeal(combatRules.winHealPercent)) {
      const v = this.views.get(unit.uid);
      this.setBar(v);
      if (Math.round(amount) > 0) this.popText(v, `+${Math.round(amount)}`, '#6dff8f');
    }

    this.time.delayedCall(T.clearPauseMs, () => {
      this.banner.setText('').setY(BANNER_Y);
      this.showReward(() => this.goToNextFloor());
    });
  },

  // A speech bubble over a living hero (purely for show; lines in data/dialogue.json, picked by systems/dialogue.js).
  // kind = 'start' | 'clear' | 'boss' | 'fallen' | 'hurt' | 'close'; `heroes` = who may speak (default: the squad).
  // Returns how long the bubble stays (ms), 0 = no bubble.
  sayLine(kind, heroes = this.state.heroes) {
    const s = pickSpeech(dialogue, heroes, kind, Math.random, this.speechMemory);
    const v = s && this.views.get(s.uid);
    if (!v) return 0;
    if (this.speech) this.speech.c.destroy();
    const R = dialogue.rules;
    const t = uiText(this, 0, 0, s.text, R.sizePx, R.textColor, { align: 'center', wordWrap: { width: R.maxWidthPx - 2 * R.padPx } }).setOrigin(0.5, 1);
    const w = Math.ceil((t.width + 2 * R.padPx) / 2) * 2, h = Math.ceil((t.height + 2 * R.padPx) / 2) * 2;
    t.setPosition(0, -R.tailPx - R.padPx + 2);
    const box = drawWindow(this.add.graphics(), -w / 2, -R.tailPx - h, w, h, { fill: R.fill, line: R.line, plain: true }); // off-white bubble, dark line (user, session 41): never themed
    const tail = this.add.graphics();
    const c = this.add.container(0, 0, [box, tail, t]).setDepth(DEPTH.popup + 3).setScale(0.6).setAlpha(0);
    this.speech = { c, v, box, tail, w };
    this.placeSpeech();
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: R.inMs, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: R.inMs + R.holdMs, duration: R.outMs, onComplete: () => c.destroy() });
    return R.inMs + R.holdMs + R.outMs;
  },

  // Keeps the speech bubble over its hero's head (heroes walk home after a win) and inside the screen; the tail
  // always points at the hero.
  placeSpeech() {
    const S = this.speech;
    if (!S || !S.c.active) return;
    const R = dialogue.rules, ch = S.v.ch;
    const headY = ch.y + (ch.hopOffset || 0) - S.v.unit.def.height * charScale(S.v.unit.def) - R.abovePx;
    const x = Math.round(Phaser.Math.Clamp(ch.x, S.w / 2 + 6, GAME_WIDTH - S.w / 2 - 6));
    S.c.setPosition(x, Math.round(headY));
    // The tail: a small stepped point under the window, pointing at the hero (moves along the bottom when clamped).
    const dx = Math.round(Phaser.Math.Clamp(ch.x - x, -S.w / 2 + 10, S.w / 2 - 10) / 2) * 2;
    if (S.tailDx === dx) return;
    S.tailDx = dx;
    S.tail.clear();
    for (let r = 0; r < R.tailPx + 2; r += 2) {
      const half = R.tailPx + 2 - r;
      S.tail.fillStyle(R.line, 1).fillRect(dx - half, -R.tailPx - 2 + r, half * 2, 2);
      if (half > 2) S.tail.fillStyle(R.fill, 1).fillRect(dx - half + 2, -R.tailPx - 2 + r, half * 2 - 4, 2);
    }
  },

  // Shows the reward screen. When it is done, the hero gets the item and `next` runs.
  showReward(next) {
    // A beaten Mimic (special room) gives a rare/epic pick instead of the normal reward.
    const room = this.layer.room;
    if (room && room.kind === 'mimic') return this.itemPick('MIMIC DEFEATED', next, room.rules.rewardOdds);
    // A cleared Monster House: a pick from the epic pool with a small legendary chance (an elite there still bumps a card).
    if (this.state.monsterHouse) return this.itemPick('MONSTER HOUSE CLEARED', next, this.dungeon.director.monsterHouse.rewardOdds, this.state.floorHadElite ? combatRules.elites.rewardBump : 0);
    const bossFloor = !!(this.dungeon.bosses && this.dungeon.bosses[this.floor]) && this.state.heroes.some((h) => h.alive);
    // A BOSS floor: set rarities (rewards.json bossRarities: 2 epic + 1 legendary), no potion or book card.
    let choices = bossFloor ? this.rollItems(null, 0, rewardRules.bossRarities) : this.rollItems(null, this.state.floorHadElite ? combatRules.elites.rewardBump : 0); // an elite: one card a rarity higher
    if (!bossFloor) choices = maybeAddBook(choices, bookData, this.state.heroes, bookData.bookChancePerScreen); // a skill book card, about 1 in 15 screens
    // After a BOSS the squad also gets a free golden book (3 modifier pages), after the item reward.
    const afterNormal = bossFloor ? () => this.openRewardSheet([bookData.cards.golden], next, 'BOSS DEFEATED: A GOLDEN BOOK') : next;
    if (!choices.length) return afterNormal();
    this.openRewardSheet(choices, afterNormal);
  },

  // 3 item cards for a reward sheet (odds = optional rarity odds instead of the floor's).
  rollItems(odds = null, bump = 0, rarities = null) {
    return rollChoices({ itemDefs, rules: rewardRules, floor: this.floor, count: rewardRules.choices, heroes: this.state.heroes, potionChance: odds || rarities ? 0 : rewardRules.potionChance, offered: (this.state.offeredOnce = this.state.offeredOnce || new Set()), odds, bump, rarities });
  },

  // The reward sheet with these cards; `next` runs after the pick has been applied.
  openRewardSheet(choices, next, banner = null) {
    // A speech bubble goes away just after the reward screen pops up (user: never seen after the reward). The battle is
    // paused under the reward screen, so the reward screen's clock removes it.
    const bubble = this.speech && this.speech.c.active ? this.speech : null;
    if (bubble) this.scene.get('Reward').events.once('create', (rs) => rs.time.delayedCall(dialogue.rules.goneAfterRewardMs, () => bubble.c.destroy()));
    this.scene.launch('Reward', {
      state: this.state,
      choices,
      floor: this.floor,
      banner,
      onDone: (itemId, heroUid, book) => {
        this.scene.stop('Reward');
        this.scene.resume();
        if (book) this.applyPage(heroUid, book);
        else this.applyReward(itemId, heroUid);
        this.time.delayedCall(700, next); // a moment to see the new dot
      },
    });
    this.scene.pause();
  },

  // A skill book page goes on the chosen skill (BattleState.addPage); the hero shows it.
  applyPage(heroUid, { page, index, replace }) {
    const res = this.state.addPage(heroUid, index, page, replace);
    const v = this.views.get(heroUid);
    if (res.ok && v) {
      this.gainText(v, page.name, '#c8a0ff');
      v.ch.flash(0xc8a0ff, 200);
    }
  },

  // Applies the chosen reward: a potion heals every living hero; an item goes to the chosen hero.
  applyReward(itemId, heroUid) {
    const item = itemDefs[itemId];
    if (item.kind !== 'potion') return this.giveItem(itemId, heroUid);
    for (const { unit, amount } of this.state.healHeroes(item.healPercent)) {
      const v = this.views.get(unit.uid);
      this.setBar(v);
      if (Math.round(amount) > 0) this.popText(v, `+${Math.round(amount)}`, '#6dff8f', true);
    }
  },

  giveItem(itemId, heroUid) {
    this.state.giveItem(heroUid, itemId);
    const item = itemDefs[itemId];
    this.drawAllBars();
    const view = this.views.get(heroUid);
    this.drawDots(view);
    this.iconPop(view, itemId);
    this.gainText(view, item.name, `#${Number(rarities[item.rarity].color).toString(16).padStart(6, '0')}`);
  },

  onLoss() {
    this.mode = 'lost';
    sfx.play('defeat');
    this.drawBossHud();
    this.banner.setText('');
    // Save the run (floor reached, enemies defeated) and see which heroes it unlocked.
    const progress = loadProgress();
    const bestBefore = progress.stats.bestFloor;
    const before = unlockedIds(allHeroDefs, progress, unlocks);
    const summary = finishRun(this.runStats || newRunStats(this.state.heroes), this.state.heroes, {
      floor: this.floor, kills: this.state.kills || 0, ms: Date.now() - this.runStartedAt, bestBefore, bossFloors: Object.keys(this.dungeon.bosses || {}),
    });
    recordRun(progress, { floor: this.floor, kills: this.state.kills || 0, ms: summary.ms, bosses: summary.bosses.map((b) => b.id), items: summary.itemCount, heroes: summary.heroes.map((h) => h.id), heroStats: summary.heroes });
    const newly = unlockedIds(allHeroDefs, progress, unlocks).filter((id) => !before.includes(id));
    // Achievements (profile.json): kept in the save; the run's new ones ride along in the summary.
    mergeSeen(progress, this.seenBuf, { enemies: this.state.enemies, heroes: this.state.heroes });
    summary.achievements = checkAchievements(progress, profileData.achievements, { summary, itemDefs, heroesUnlocked: unlockedIds(allHeroDefs, { ...progress, unlockAll: false }, unlocks).length }); // the test toggle does not count
    saveProgress(progress);
    const lastRun = { floor: this.floor, kills: this.state.kills || 0, newly };
    this.showDefeat(() => this.scene.start('GameOver', { summary, lastRun }));
  },

  // The defeat screen (user): the screen dims first, then SQUAD DEFEATED pops in, then how far the squad got and a
  // random line on how it ended (naming the enemy that landed the last blow), then a Back button. Data: defeat.json.
  showDefeat(onBack) {
    const D = defeatData;
    const top = 1000; // above everything (flying enemies sit high too)
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000).setOrigin(0).setAlpha(0).setDepth(top).setInteractive(); // also blocks taps on the fight
    this.tweens.add({ targets: dim, alpha: D.dimAlpha, duration: D.dimMs });
    const title = uiText(this, GAME_WIDTH / 2, 300, 'SQUAD\nDEFEATED', D.titlePx, '#ff4a3a', { align: 'center', stroke: '#000000', strokeThickness: 8 })
      .setOrigin(0.5).setDepth(top + 1).setAlpha(0);
    if (title.width > GAME_WIDTH - 16) title.setScale((GAME_WIDTH - 16) / title.width);
    const end = title.scale;
    this.time.delayedCall(D.titleDelayMs, () => {
      title.setScale(end * 2.6);
      this.tweens.add({ targets: title, scale: end, alpha: 1, duration: 260, ease: 'Back.easeOut' });
      this.time.delayedCall(200, () => this.cameras.main.shake(220, 0.006));
    });
    const name = this.lastKiller;
    const pool = name ? D.withKiller : D.noKiller;
    const line = pool[Math.floor(Math.random() * pool.length)]
      .replace(/\ba \{enemy\}/, `${/^[aeiou]/i.test(name || '') ? 'an' : 'a'} {enemy}`)
      .replace(/\{enemy\}/g, name || '');
    const story = uiText(this, GAME_WIDTH / 2, 420, `${D.story.replace('{floor}', this.floor)} before ${line}`, 'normal', UI.text, {
      align: 'center', wordWrap: { width: GAME_WIDTH - 48 },
    }).setOrigin(0.5, 0).setDepth(top + 1).setAlpha(0);
    this.time.delayedCall(D.storyDelayMs, () => this.tweens.add({ targets: story, alpha: 1, y: { from: story.y + 12, to: story.y }, duration: 400 }));
    this.time.delayedCall(D.buttonDelayMs, () => {
      const w = 200, h = 64;
      const btn = uiButton(this, (GAME_WIDTH - w) / 2, Math.max(story.y + story.height + 40, 640), w, h, D.button, { selected: true, depth: top + 2, onTap: () => { sfx.play('tap'); onBack(); } });
      btn.container.setAlpha(0);
      this.tweens.add({ targets: btn.container, alpha: 1, duration: 300 });
    });
  },
};
