// Writes src/data/statusIcons.json: one small pixel icon per status (shown in a row over the health bar,
// Risk of Rain style). Each design is 5x5; this script adds a 1-px dark outline that follows the shape,
// so the saved art is 7x7 (palette index 0 = outline). Same format as itemIcons.json ({ palette, rows }).
// Usage: node docs/proposals/make-status-icons.mjs   (the JSON is the real data; edit it or re-run this)
import fs from 'node:fs';

const OUT = '0x1a1020';
const W = '0xffffff';
// [palette (index 1..), 5 rows]
const D = {
  stun: [['0xb8860b', '0xffd84d', '0xfff7c0'], ['..3..', '22322', '.222.', '.2.2.', '.1.1.']],
  freeze: [['0x4aa8d8', '0x9fe8ff', W], ['..3..', '3.3.3', '23232', '22222', '.111.']],
  chill: [['0x7fd8ff', W], ['1.1.1', '.111.', '11211', '.111.', '1.1.1']],
  shock: [['0xd9b400', '0xffe94d', W], ['...22', '..23.', '.2222', '..32.', '.21..']],
  fear: [['0x4a2a78', '0x8a5fc8', '0x1a1020'], ['.222.', '23232', '22222', '22222', '2.2.2']],
  taunt: [['0xa83418', '0xe05a2a', '0xffb08a'], ['.232.', '.232.', '.222.', '.....', '.222.']],
  silence: [['0x5a566e', '0x8a86a0', '0xd0cce0', '0xffd84d'], ['.333.', '.3.3.', '22222', '22422', '11111']],
  bleed: [['0x7a1a22', '0xc0303a', '0xff8a8a'], ['..2..', '.222.', '22222', '23222', '.111.']],
  burn: [['0xc03a1a', '0xff7a3d', '0xffd84d', W], ['.1..1', '.12.1', '12321', '13431', '.121.']],
  poison: [['0x1f6b3a', '0x3fae6a', '0xa8f0b8', '0x0e2a18'], ['.222.', '24242', '22322', '.222.', '.2.2.']],
  weaken: [['0x5e3a1a', '0x9a6b3a', '0xd8a870'], ['.232.', '.232.', '22322', '.222.', '..1..']],
  armorBreak: [['0x6e6e7a', '0xb0b0b0', '0xe8e8f0', '0x1a1020'], ['22422', '23422', '22242', '.242.', '..1..']],
  curse: [['0x3a1a5a', '0x7a3fb0', '0xd8a8ff', '0xff3d6e'], ['.222.', '23332', '33433', '23332', '.222.']],
  blind: [['0x8a2a3a', '0x6a6a80', '0xd0d0dc'], ['....1', '.221.', '23132', '.122.', '1....']],
  mark: [['0xb01a46', '0xff3d6e', W], ['.222.', '2...2', '2.3.2', '2...2', '.222.']],
  shield: [['0x2a6ab0', '0x5fb8ff', '0xc8ecff'], ['22222', '23222', '23222', '.222.', '..1..']],
  invulnerable: [['0xb8862a', '0xffe08a', W], ['22222', '22322', '23332', '.232.', '..1..']],
  buff: [['0xb8862a', '0xf2b632', '0xfff0a0'], ['..3..', '.322.', '32222', '.222.', '.111.']],
  regenBoost: [['0x2a8a44', '0x6dff8f', W], ['..2..', '..2..', '22322', '..2..', '..1..']],
  parry: [['0xb8862a', '0xffd27a', '0xc8ccd6', W], ['3...3', '.3.3.', '..4..', '.3.3.', '2...2']],
  guaranteedCrit: [['0xc05a10', '0xff9b3d', '0xffe94d', W], ['..2..', '.232.', '23432', '.232.', '..2..']],
  blockCooldown: [['0x4a4a5a', '0x8a8aa0', '0xffd84d'], ['22222', '.131.', '..3..', '.131.', '22222']],
  steady: [['0x2a7aa8', '0x9fe0ff', W], ['..2..', '..22.', '11223', '..22.', '..2..']],
};

const out = { _about: 'Status icons (Risk of Rain style): one per status, shown in a row over the health bar with the stack count next to it. 7x7 including the dark outline (palette index 0). Same format as itemIcons.json. Made by docs/proposals/make-status-icons.mjs; not used by the game yet (proposal).' };
for (const [id, [pal, rows]] of Object.entries(D)) {
  if (rows.length !== 5 || rows.some((r) => r.length !== 5)) throw new Error('bad size: ' + id);
  const at = (x, y) => (x >= 0 && y >= 0 && x < 5 && y < 5 && rows[y][x] !== '.' ? rows[y][x] : null);
  const grid = [];
  for (let y = -1; y <= 5; y++) {
    let s = '';
    for (let x = -1; x <= 5; x++) {
      const c = at(x, y);
      if (c) s += c;
      else s += [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy)) ? '0' : '.';
    }
    grid.push(s);
  }
  out[id] = { palette: [OUT, ...pal], rows: grid };
}
fs.writeFileSync(new URL('../../src/data/statusIcons.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log('wrote src/data/statusIcons.json', Object.keys(D).length, 'icons');
