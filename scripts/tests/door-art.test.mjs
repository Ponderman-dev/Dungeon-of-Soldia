// Door and torch pixel art (systems/doorArt.js, torchArt.js; floorArt.json `door.art`, `torch`): the arch leaves the
// doorway empty so the doorway and the two wooden halves show through, a half covers its side of the doorway, and
// the torch flames all have one size (they swap frames to flicker).
import fs from 'fs';
import { doorArtLayers } from '../../src/systems/doorArt.js';
import { torchLayers } from '../../src/systems/torchArt.js';
const art = JSON.parse(fs.readFileSync(new URL('../../src/data/floorArt.json', import.meta.url)));
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const at = (lay, x, y) => lay.pixels[(y + lay.ay) * lay.w + (x + lay.ax)];
for (const big of [false, true]) {
  const L = doorArtLayers(art.door, big), S = L.size, name = big ? 'entrance' : 'floor door';
  const mid = -Math.floor(S.openH / 2); // halfway up the doorway
  ok(`${name}: the arch leaves the doorway empty`, at(L.frame, 0, mid) === -1 && at(L.frame, -S.halfW + 1, mid) === -1);
  ok(`${name}: the arch has stone beside the doorway`, at(L.frame, -S.halfW - 1, mid) >= 0 && at(L.frame, S.halfW, mid) >= 0);
  ok(`${name}: the doorway is filled behind the halves`, at(L.hole, 0, mid) >= 0 && at(L.hole, -S.halfW, mid) >= 0);
  let filled = 0;
  for (let x = 0; x < S.halfW; x++) if (L.leaf.pixels[(L.leaf.ay + mid) * L.leaf.w + x] >= 0) filled++;
  ok(`${name}: a half covers its side of the doorway`, filled === S.halfW, `${filled}/${S.halfW}`);
  ok(`${name}: extras only on the entrance`, big ? !!L.extras : L.extras === null);
}
const T = torchLayers(art.torch);
ok('torch: at least 2 flame frames, all the same size', T.flames.length >= 2 && T.flames.every((f) => f.w === T.flames[0].w && f.h === T.flames[0].h));
ok('torch: glow alpha stays between 0 and 1', [...T.glow.alpha].every((a) => a >= 0 && a <= 1) && Math.max(...T.glow.alpha) > 0);
