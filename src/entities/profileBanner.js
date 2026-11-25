// The Profile banners' pictures (crops of the title forest, systems/banners.js), made once per banner and shared by
// key. Session 58: the forest is only worked out when the picture is not made yet (it cost ~80 ms, a stutter on the
// Profile page); BootScene's warm-up (warmUp.js) makes them all before the title.
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { layerTexture } from './pixelLayer.js';
import { bannerLayer } from '../systems/banners.js';
import D from '../data/profile.json';
import title from '../data/title.json';

// The texture key of profile banner `id` (unknown id = the first banner).
export function profileBannerKey(scene, id) {
  const b = D.banners.find((v) => v.id === id) || D.banners[0], key = `banner-${b.id}`;
  if (scene.textures.exists(key)) return key;
  const P = title.pixel, C = D.layout.card;
  return layerTexture(scene, key, bannerLayer(title, b, { w: C.artW, h: C.artH, width: Math.ceil(GAME_WIDTH / P), height: Math.ceil(GAME_HEIGHT / P) }));
}

export const profileBannerIds = () => D.banners.map((b) => b.id);
