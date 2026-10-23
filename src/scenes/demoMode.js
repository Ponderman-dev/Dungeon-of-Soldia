// Demo pages (built with VITE_DEMO): 'house' = the Monster House demo (npm run build:house-demo, starts on floor 61,
// every fight a Monster House), 'brood' = the Brood Mother demo (npm run build:brood-demo, floor 40 again and again).
// Each starts with a real squad saved by scripts/tests/make-demo-squad.mjs.
import houseSquad from '../data/demoSquad.json';
import broodSquad from '../data/demoSquadBrood.json';

export const DEMO = import.meta.env.VITE_DEMO || null;
export const demoSquad = DEMO === 'brood' ? broodSquad : houseSquad;
