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

// Studio tools: flip, turn, outline, colour swap.
import { flipGridH, flipGridV, rotateGrid90, outlineGrid, replaceColorGrid } from '../../src/systems/pixelArt.js';
const g = [[1, 2, null], [3, null, null]]; // 3 wide, 2 tall
const fh = flipGridH(g, [0.5, 0.5]);
ok('flip left/right mirrors rows and the anchor', fh.grid[0].join() === ',2,1' && fh.anchor.join() === '2.5,0.5');
const fv = flipGridV(g, [0.5, 0.5]);
ok('flip up/down swaps rows and the anchor', fv.grid[0][0] === 3 && fv.anchor.join() === '0.5,1.5');
const r = rotateGrid90(g, [0.5, 0.5]);
ok('quarter turn: 3x2 becomes 2x3, top-left goes top-right', r.grid.length === 3 && r.grid[0].length === 2 && r.grid[0][1] === 1 && r.grid[0][0] === 3);
ok('quarter turn moves the anchor with its pixel', r.anchor.join() === '1.5,0.5');
const o = outlineGrid([[5]], [0.5, 0.5], 9);
ok('outline grows by 1 on each side, only next to pixels', o.grid.length === 3 && o.grid[1][0] === 9 && o.grid[0][0] === null && o.grid[1][1] === 5 && o.anchor.join() === '1.5,1.5');
ok('colour swap', replaceColorGrid([[1, 2], [1, null]], 1, 7).flat().join() === '7,2,7,');

// Studio: ellipse tool and shade brush.
import { ellipseCells } from '../../src/studio/board.js';
import { shadeColor } from '../../src/systems/pixelArt.js';
const has = (cells, x, y) => cells.some(([a, b]) => a === x && b === y);
const ring = ellipseCells(0, 0, 6, 6, false);
const disc = ellipseCells(6, 6, 0, 0, true);
ok('ellipse: a square box makes a round ring (no corners, middle empty)', has(ring, 3, 0) && has(ring, 0, 3) && !has(ring, 0, 0) && !has(ring, 3, 3));
ok('ellipse: filled covers the middle, any drag direction', has(disc, 3, 3) && disc.length > ring.length && !has(disc, 6, 6));
ok('ellipse: the ring is mirror-symmetric', ring.every(([x, y]) => has(ring, 6 - x, y) && has(ring, x, 6 - y)));
ok('ellipse: a 1-pixel box is one pixel', ellipseCells(2, 2, 2, 2, false).length === 1);
const lum = (c) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
ok('shade: darker and lighter steps', lum(shadeColor(0x3b6fd4)) < lum(0x3b6fd4) && lum(shadeColor(0x3b6fd4, true)) > lum(0x3b6fd4));
