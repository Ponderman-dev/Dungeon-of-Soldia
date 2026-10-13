// Pixel-art parts: blocks become pictures, anchors, art <-> pixels.
import { partArt, artSize, partAnchor, artPixels, pixelsToArt, mixColor } from '../../src/systems/pixelArt.js';
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);

const block = { w: 3, h: 4, x: 0, y: -2, color: '0x3b6fd4' };
const art = partArt(block);
ok('an undrawn block becomes a w x h picture', artSize(art).w === 3 && artSize(art).h === 4);
ok('with a dark outline and its colour inside', art.rows[0] === '111' && art.rows[1] === '101' && art.palette[0] === '0x3b6fd4');
ok('anchor defaults to the middle', partAnchor(block).join() === '1.5,2');
ok('old pivotY 1 = anchor at the bottom middle', partAnchor({ ...block, pivotY: 1 }).join() === '1.5,4');
ok('a saved anchor wins', partAnchor({ ...block, anchor: [0.5, 3.5] }).join() === '0.5,3.5');

const grid = artPixels({ palette: ['0xff0000', '0x00ff00'], rows: ['0.', '.1'] });
ok('art -> pixels (dots are empty)', grid[0][0] === 0xff0000 && grid[0][1] === null && grid[1][1] === 0x00ff00);
const back = pixelsToArt(grid);
ok('pixels -> art round trip', back.rows.join('|') === '0.|.1' && back.palette.join() === '0xff0000,0x00ff00');

ok('mixing colours', mixColor(0x000000, 0xffffff, 0.5) === 0x808080);
