// Picture memory (entities/textureCache.js pruneTextures, called after each boss floor in battle/walk.js): unused
// character part pictures are removed, pictures still on screen (also inside containers) and other textures stay.
import { pruneTextures } from '../../src/entities/textureCache.js';
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
const list = { 'px-a': 1, 'px-b': 1, 'px-c': 1, 'floorArt-1': 1, 'icon-x': 1 };
const img = (key) => ({ texture: { key } });
const scene = { children: { list: [img('px-a'), { list: [img('icon-x'), { list: [img('px-c')] }] }] } };
const game = { scene: { getScenes: () => [scene, {}] }, textures: { list, remove: (k) => delete list[k] } };
const n = pruneTextures(game);
ok('an unused part picture is removed', !list['px-b'] && n === 1);
ok('part pictures in use (also deep in containers) stay', !!list['px-a'] && !!list['px-c']);
ok('other kinds of textures are never touched', !!list['floorArt-1'] && !!list['icon-x']);
