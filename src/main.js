import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, BG_COLOR } from './config.js';
import BootScene from './scenes/BootScene.js';
import BattleScene from './scenes/BattleScene.js';
import RewardScene from './scenes/RewardScene.js';
import SquadScene from './scenes/SquadScene.js';
import DebugScene from './scenes/DebugScene.js';
import PuzzleScene from './scenes/PuzzleScene.js';
import BaseScene from './scenes/BaseScene.js';
import TitleScene from './scenes/TitleScene.js';
import SettingsScene from './scenes/SettingsScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import ProfileScene from './scenes/ProfileScene.js';
import HeroesScene from './scenes/HeroesScene.js';
import GlossaryScene from './scenes/GlossaryScene.js';
import LeadersScene from './scenes/LeadersScene.js';
import ShopScene from './scenes/ShopScene.js';

const game = new Phaser.Game({
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
  scene: [BootScene, TitleScene, BaseScene, SquadScene, BattleScene, RewardScene, PuzzleScene, SettingsScene, GameOverScene, ProfileScene, HeroesScene, GlossaryScene, LeadersScene, ShopScene, DebugScene],
});

// Dev server only (never in the built page): browser checks drive the game through this.
if (import.meta.env.DEV) window.__game = game;
