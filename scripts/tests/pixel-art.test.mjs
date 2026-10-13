// Pixel-art parts: blocks become pictures, turning keeps square pixels around the anchor.
import { partArt, artSize, partAnchor, artPixels, pixelsToArt, rotatePixels, mixColor } from '../../src/systems/pixelArt.js';
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

// A 1x5 stick turned 90 degrees around its bottom pixel becomes a 5x1 stick pointing right (clockwise).
const stick = [[1], [1], [1], [1], [2]];
const r = rotatePixels(stick, [0.5, 4.5], 90);
ok('turning 90 degrees swaps width and height', r.w === 5 && r.h === 1, `${r.w}x${r.h}`);
ok('the anchor pixel stays where it was', r.grid[0][Math.floor(r.ox)] === 2 && r.oy === 0.5, JSON.stringify(r));
const r0 = rotatePixels(stick, [0.5, 4.5], 0);
ok('angle 0 keeps the picture', r0.grid === stick && r0.ox === 0.5);
const r45 = rotatePixels([[1, 1, 1], [1, 1, 1], [1, 1, 1]], [1.5, 1.5], 45);
ok('turned pixels stay whole pixels (no half colours)', r45.grid.flat().every((c) => c === 1 || c === null));
ok('mixing colours', mixColor(0x000000, 0xffffff, 0.5) === 0x808080);
