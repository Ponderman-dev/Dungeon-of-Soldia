// Title screen pixel art (systems/titleArt.js, title.json): the sky, moon, clouds and the forest from above all draw,
// the forest fills everything below the horizon, it is lit (more than one colour), and the tower sits on screen.
import fs from 'fs';
import { skyLayer, twinkleSpots, moonLayers, cloudLayer, canopyLayer } from '../../src/systems/titleArt.js';
const T = JSON.parse(fs.readFileSync(new URL('../../src/data/title.json', import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const width = 130, height = 282;
const sky = skyLayer(T, { width, height });
ok('sky: every pixel drawn', sky.pixels.every((c) => c >= 0));
ok('twinkling stars: the right count, all in the sky', twinkleSpots(T, width).length === T.twinkle.count && twinkleSpots(T, width).every((s) => s.y < T.canopy.horizon));
const M = moonLayers(T);
ok('moon: round and filled in the middle', M.moon.pixels[M.moon.ay * M.moon.w + M.moon.ax] >= 0 && M.moon.pixels[0] === -1);
ok('moon glow alpha between 0 and 1', [...M.glow.alpha].every((a) => a >= 0 && a <= 1));
ok('clouds: each draws something', T.clouds.list.every((cl, i) => cloudLayer(T, cl, i).pixels.some((c) => c >= 0)));
const F = canopyLayer(T, { width, height });
let gaps = 0;
for (let y = T.canopy.horizon; y < height; y++) for (let x = 0; x < width; x++) if (F.layer.pixels[y * width + x] < 0) gaps++;
ok('forest fills everything below the horizon', gaps === 0, `${gaps} empty`);
ok('forest is shaded (many colours)', new Set(F.layer.pixels).size > 20);
ok('tower is on screen', F.tower.x > 0 && F.tower.x < width && F.tower.y > 0 && F.tower.y < height);
