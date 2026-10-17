// The effect stage for the item review page: the game's own effect code (src/studio/fxStage.js), bundled into one
// script by vite.fx.config.js and inlined into the page by make-item-review.mjs. Exposes window.SoldiaFx.
import { FxStage, catalog, W, H } from '../../../src/studio/fxStage.js';
import { makeTuner } from '../../../src/systems/fxTune.js';
import effectsData from '../../../src/data/effects.json';
import itemFxData from '../../../src/data/itemFx.json';

window.SoldiaFx = { FxStage, catalog, W, H, tuner: makeTuner(effectsData), iconPop: itemFxData.iconPop };
