// The two wall torches on the pillars (pixel art: systems/torchArt.js, floorArt.json `torch`): a warm glow that
// pulses, the bracket, a flame that flickers by switching frames. add(obj) puts each part where it belongs (the
// squad screen: the scene at floor depth; a battle floor: the floor's container, so they slide with it).
import floorArt from '../data/floorArt.json';
import { torchLayers } from '../systems/torchArt.js';
import { layerTexture } from './pixelLayer.js';
import { FLOOR_PIXEL } from './floorTexture.js';

export function drawWallTorches(scene, wallH, add) {
  const T = floorArt.torch, L = torchLayers(T), P = FLOOR_PIXEL;
  const img = (lay, key, x, y) => add(scene.add.image(x, y, layerTexture(scene, key, lay)).setOrigin(lay.ax / lay.w, lay.ay / lay.h).setScale(P));
  const flameKeys = L.flames.map((f, i) => layerTexture(scene, `torch-flame-${i}`, f));
  for (const x of (floorArt.torchPillars || floorArt.pillars.x).map((ax) => ax * P)) { // on the two middle pillars (floorArt.json torchPillars)
    const y = wallH - 33 * P; // the top of the handle
    const glow = img(L.glow, 'torch-glow', x, y);
    scene.tweens.add({ targets: glow, alpha: 0.75, duration: 300 + Math.random() * 120, yoyo: true, repeat: -1 });
    img(L.holder, 'torch-holder', x, y);
    const flame = img(L.flames[0], 'torch-flame-0', x, y);
    let f = Math.floor(Math.random() * flameKeys.length);
    scene.time.addEvent({ delay: T.frameMs, loop: true, callback: () => { if (!flame.active) return; f = (f + 1 + Math.floor(Math.random() * 2)) % flameKeys.length; flame.setTexture(flameKeys[f]); } });
  }
}
