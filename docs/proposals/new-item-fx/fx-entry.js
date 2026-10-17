// The effect stage + the PROPOSED effects for the new-item-fx page, bundled into one script by vite.fx.config.js.
import { FxStage, catalog, W, H } from '../../../src/studio/fxStage.js';
import { makeTuner } from '../../../src/systems/fxTune.js';
import effectsData from '../../../src/data/effects.json';
import { PROPOSALS } from './recipes.js';

window.SoldiaFx = { FxStage, catalog, W, H, tuner: makeTuner(effectsData), proposals: PROPOSALS };
