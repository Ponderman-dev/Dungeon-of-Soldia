// Builds the SCREEN REVIEW page: every screen's layout (stills), animations (clips) and sounds, each with a note.
// 1) node record.mjs <dir>   (clips + stills of the real game, dev server on :5173)
// 2) node make.mjs <dir>     (copies the sound files, writes <dir>/soldia-screen-review.html)
// Publish <dir>/soldia-screen-review.html with files clips/*, stills/*, sounds/* (see docs/proposals/README.md).
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(process.argv[2]);
const ROOT = new URL('../../../', import.meta.url).pathname;
const sounds = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/sounds.json'), 'utf8'));

// What each sound is for (the moment it plays).
const SOUND_WHEN = {
  tap: 'Any button tap', heroPick: 'A hero is chosen', heroBack: 'A hero is sent back', cardOpen: 'Hero card opens', cardClose: 'Hero card closes',
  scroll: 'Bench scrolls (arrows)', descend: 'BEGIN DESCENT', unlock: 'A new hero unlocked (after a run)',
  rewardUp: 'Reward sheet slides up', rewardCard: 'Each reward card rises in', itemGiven: 'Item given to a hero', potion: 'Potion picked',
  skillCast: 'A hero skill goes off', interrupted: 'A skill wind-up is interrupted', hitMelee: 'Melee hit', hitRanged: 'Arrow hit', hitFire: 'Fire hit',
  hitIce: 'Ice hit', hitElectric: 'Lightning hit', hitDark: 'Dark hit', hitHoly: 'Holy hit', crit: 'Critical hit (on top)', miss: 'Miss / dodge',
  block: 'Block / immune', shieldSoak: 'A shield soaks a hit', shieldBreak: 'A shield breaks', stun: 'Stun', freeze: 'Freeze', enemyDeath: 'Enemy dies',
  heroFall: 'Hero falls', itemProc: 'An item goes off (icon pops)', minionSummon: 'A minion rises', levelUp: 'Level up', floorClear: 'Floor cleared',
  doorOpen: 'The door opens', step: 'Footsteps on the door walk', defeat: 'Squad defeated', bossIntro: 'Boss floor starts', bossWarn: 'Boss wind-up warning',
  bossMove: 'Boss move goes off', chestOpen: 'Treasure chest opens', fountain: 'Drink from the fountain', puzzleSlide: 'Puzzle move (swap, slide, flash)',
  puzzleSolved: 'Puzzle solved', flaskBreak: 'Alchemist flask breaks',
};

const SECTIONS = [
  {
    id: 'squad', name: 'Hero select',
    stills: [['squad', 'The squad screen'], ['squad-card', 'A hero card']],
    clips: [
      ['squad-open', 'Screen opens', 'The game starts on this screen: the room, door, torches, the 3 picked heroes and the bench.'],
      ['squad-card', 'Hero card', 'Tap a hero: the card slides up and fades in. X closes it.'],
      ['squad-sendback', 'Send back', 'The hero walks back down to its spot on the bench.'],
      ['squad-choose', 'Choose a hero', 'Tap a bench hero, card, CHOOSE: it walks up to the empty slot.'],
      ['squad-random', 'Random', 'RANDOM sends heroes back and new ones walk up.'],
      ['squad-bench', 'Bench scroll', 'Drag the bench left and right; the < > arrows jump a page.'],
      ['squad-descend', 'Begin descent', 'The door opens, the squad walks in one by one, fade to black, floor 1 begins.'],
    ],
    sounds: ['tap', 'heroPick', 'heroBack', 'cardOpen', 'cardClose', 'scroll', 'descend', 'unlock'],
  },
  {
    id: 'reward', name: 'Reward',
    stills: [['reward-pick', 'Choose a reward'], ['reward-who', 'Who gets it?'], ['reward-who-picked', 'A hero picked (Give)'], ['book-pages', 'Skill book: pages'], ['book-skill', 'Skill book: which skill']],
    clips: [
      ['reward-up', 'Floor cleared, sheet rises', 'The last enemy dies, "Floor cleared!", the dungeon dims, the sheet slides up and the 3 cards rise in one by one.'],
      ['reward-pick', 'Pick a card', 'The tapped card lights up, then "Who gets it?" opens.'],
      ['reward-give', 'Give it, next floor', 'Pick a hero, Give: the sheet slides down, the item pops on the hero, the squad walks to the next floor.'],
      ['reward-book', 'Skill book (Skill Dealer)', 'The dealer\'s book: choose a page, choose a skill, write it in.'],
    ],
    sounds: ['rewardUp', 'rewardCard', 'tap', 'itemGiven', 'potion'],
  },
  {
    id: 'dungeon', name: 'Dungeon',
    stills: [['fight', 'A fight'], ['boss', 'A boss fight'], ['monster-house', 'Monster House'], ['room', 'A special room'], ['puzzle', 'A puzzle']],
    clips: [
      ['fight-start', 'A fight', 'Floor counter, health bars, levels, damage numbers, item and passive popups, skill buttons.'],
      ['skill-attack', 'Attack skills', 'Tapping the 3 red skills: wind-up bar, skill name banner, the hit, screen shake.'],
      ['skill-support', 'Support skills', 'Tapping the 3 green skills.'],
      ['tap-focus', 'Tap an enemy (focus)', 'The red ring under the enemy everyone attacks.'],
      ['drag-order', 'Drag a hero onto an enemy', 'The order line and "On it!".'],
      ['level-up', 'Level up', 'LEVEL UP popups over the heroes.'],
      ['floor-walk', 'Between floors', 'After the reward: the door opens, the squad walks through, the next floor slides in.'],
      ['defeat', 'Defeat', 'The squad falls, "Squad defeated", back to the hero select screen.'],
      ['boss-intro', 'Boss floor', 'The boss arrives with its name and health bar at the top, its moves warn with a red flash.'],
      ['elite', 'Elite enemy', 'An elite: its element colour, name tag and trait.'],
      ['monster-house', 'Monster House', 'The big "IT\'S A MONSTER HOUSE!" banner and 11-15 enemies at once.'],
      ['room-treasure', 'Treasure room', 'The room name and hint window, the gold arrow, the chest opens, the reward sheet.'],
      ['room-fountain', 'Rest fountain', 'Drinking heals the squad: "Blessed!".'],
      ['room-mimic', 'Mimic room', 'The lone chest shakes and turns into the Mimic.'],
      ['puzzle-open', 'Puzzle room', 'The puzzle sheet slides up (here: Mimic Shuffle, the coin and the shuffle).'],
    ],
    sounds: ['skillCast', 'interrupted', 'hitMelee', 'hitRanged', 'hitFire', 'hitIce', 'hitElectric', 'hitDark', 'hitHoly', 'crit', 'miss', 'block', 'shieldSoak', 'shieldBreak', 'stun', 'freeze',
      'enemyDeath', 'heroFall', 'itemProc', 'minionSummon', 'levelUp', 'floorClear', 'doorOpen', 'step', 'defeat', 'bossIntro', 'bossWarn', 'bossMove', 'chestOpen', 'fountain', 'puzzleSlide', 'puzzleSolved', 'flaskBreak'],
  },
];

// Copy each cue's sound file (its first take) next to the page.
fs.mkdirSync(path.join(DIR, 'sounds'), { recursive: true });
const soundFile = (name) => path.join(ROOT, 'src/assets/sounds', `${name.includes('/') ? name : `${sounds.pack}/${name}`}.mp3`);
for (const s of SECTIONS) {
  for (const cue of s.sounds) {
    const c = sounds.cues[cue];
    if (!c) throw new Error('no cue ' + cue);
    fs.copyFileSync(soundFile(c.file || c.files[0]), path.join(DIR, 'sounds', `${cue}.mp3`));
  }
}
for (const s of SECTIONS) {
  for (const [id] of s.clips) if (!fs.existsSync(path.join(DIR, 'clips', `${id}.mp4`))) throw new Error('missing clip ' + id);
  for (const [id] of s.stills) if (!fs.existsSync(path.join(DIR, 'stills', `${id}.png`))) throw new Error('missing still ' + id);
}
const data = SECTIONS.map((s) => ({ ...s, sounds: s.sounds.map((cue) => [cue, SOUND_WHEN[cue] || cue]) }));
const page = fs.readFileSync(new URL('./template.html', import.meta.url), 'utf8').replace('/*DATA*/', `const SECTIONS = ${JSON.stringify(data)};`);
fs.writeFileSync(path.join(DIR, 'soldia-screen-review.html'), page);
console.log('wrote', path.join(DIR, 'soldia-screen-review.html'), 'items', data.reduce((n, s) => n + s.stills.length + s.clips.length + s.sounds.length, 0));
