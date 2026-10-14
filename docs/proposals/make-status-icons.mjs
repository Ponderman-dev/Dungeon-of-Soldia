// Writes src/data/statusIcons.json: one small pixel icon per status (shown in a row over the health bar,
// Risk of Rain style). Each design is 7x7; this script adds a 1-px dark outline that follows the shape,
// so the saved art is 9x9 (palette index 0 = outline). Same format as itemIcons.json ({ palette, rows }).
// Usage: node docs/proposals/make-status-icons.mjs   (the JSON is the real data; edit it or re-run this)
import fs from 'node:fs';

const OUT = '0x1a1020';
const W = '0xffffff';
// [palette (index 1..), 7 rows]
const D = {
  stun: [['0xb8860b', '0xffd84d', '0xfff7c0'], [
    '...2...',
    '..232..',
    '1222221',
    '.12221.',
    '..222..',
    '.22.22.',
    '.1...1.']],
  freeze: [['0x4aa8d8', '0x9fe8ff', W], [
    '...3...',
    '..323.3',
    '3.323.2',
    '2132312',
    '2122212',
    '1222221',
    '.11111.']],
  chill: [['0x7fd8ff', W], [
    '1..1..1',
    '.1.1.1.',
    '..121..',
    '1122211',
    '..121..',
    '.1.1.1.',
    '1..1..1']],
  shock: [['0xd9b400', '0xffe94d', W], [
    '....22.',
    '...23..',
    '..23...',
    '.22332.',
    '...32..',
    '..21...',
    '.1.....']],
  fear: [['0x4a2a78', '0x8a5fc8', '0x1a1020', W], [
    '..222..',
    '.22222.',
    '2342342',
    '2232232',
    '2222222',
    '2222222',
    '2.1.1.2']],
  taunt: [['0xa83418', '0xe05a2a', '0xffb08a'], [
    '..232..',
    '..232..',
    '..232..',
    '..222..',
    '...1...',
    '.......',
    '..222..']],
  silence: [['0x5a566e', '0x8a86a0', '0xd0cce0', '0xffd84d'], [
    '..333..',
    '.3...3.',
    '.3...3.',
    '2222222',
    '2224222',
    '2224222',
    '1111111']],
  bleed: [['0x7a1a22', '0xc0303a', '0xff8a8a'], [
    '...2...',
    '...2...',
    '..222..',
    '.22222.',
    '.23222.',
    '.12221.',
    '..111..']],
  burn: [['0xc03a1a', '0xff7a3d', '0xffd84d', W], [
    '...1...',
    '..11..1',
    '.1121.1',
    '.122211',
    '1223221',
    '1234321',
    '.12321.']],
  poison: [['0x1f6b3a', '0x3fae6a', '0xa8f0b8', '0x0e2a18'], [
    '.22222.',
    '2233322',
    '2442442',
    '2442442',
    '.22422.',
    '.12221.',
    '.1.1.1.']],
  weaken: [['0x5e3a1a', '0xb07a40', '0xc8ccd6', W], [
    '.....34',
    '....343',
    '.....3.',
    '..3....',
    '.232...',
    '..12...',
    '.1..2..']],
  armorBreak: [['0x6e6e7a', '0xb0b0b0', '0xe8e8f0', '0x1a1020'], [
    '2224222',
    '2334322',
    '2332422',
    '2334222',
    '.22242.',
    '..121..',
    '...1...']],
  curse: [['0x3a1a5a', '0x7a3fb0', '0xd8a8ff', '0xff3d6e'], [
    '.......',
    '..222..',
    '.23332.',
    '2334332',
    '.23332.',
    '..222..',
    '.1.1.1.']],
  blind: [['0x8a2a3a', '0x6a6a80', '0xd0d0dc'], [
    '......1',
    '..2221.',
    '.23312.',
    '2331332',
    '.21332.',
    '.1222..',
    '1......']],
  mark: [['0xb01a46', '0xff3d6e', W], [
    '..222..',
    '.2...2.',
    '2..1..2',
    '2.131.2',
    '2..1..2',
    '.2...2.',
    '..222..']],
  shield: [['0x2a6ab0', '0x5fb8ff', '0xc8ecff'], [
    '2222222',
    '2333322',
    '2322222',
    '2322222',
    '.22222.',
    '..121..',
    '...1...']],
  invulnerable: [['0xb8862a', '0xffe08a', W], [
    '2222222',
    '2223222',
    '2233322',
    '2223222',
    '.22322.',
    '..121..',
    '...1...']],
  buff: [['0xb8862a', '0xf2b632', '0xfff0a0'], [
    '...3...',
    '..323..',
    '.32222.',
    '3222221',
    '..222..',
    '..222..',
    '..111..']],
  regenBoost: [['0x2a8a44', '0x6dff8f', W], [
    '..222..',
    '..232..',
    '2223222',
    '2333332',
    '1223221',
    '..121..',
    '..111..']],
  parry: [['0xb8862a', '0xffd27a', '0xc8ccd6', W], [
    '3.....3',
    '.3...3.',
    '..3.3..',
    '...4...',
    '..3.3..',
    '.2...2.',
    '1.....1']],
  guaranteedCrit: [['0xc05a10', '0xff9b3d', '0xffe94d', W], [
    '...2...',
    '...2...',
    '..232..',
    '2234322',
    '..232..',
    '...2...',
    '...2...']],
  blockCooldown: [['0x4a4a5a', '0x8a8aa0', '0xffd84d'], [
    '2222222',
    '.13331.',
    '..131..',
    '...3...',
    '..1.1..',
    '.13331.',
    '2222222']],
  steady: [['0x2a7aa8', '0x9fe0ff', W], [
    '....2..',
    '....22.',
    '1222332',
    '1223333',
    '1222332',
    '....22.',
    '....2..']],
};

const out = { _about: 'Status icons (Risk of Rain style): one per status, shown in a row over the health bar with the stack count in the corner. 9x9 including the dark outline (palette index 0). Same format as itemIcons.json. Made by docs/proposals/make-status-icons.mjs; not used by the game yet (proposal).' };
for (const [id, [pal, rows]] of Object.entries(D)) {
  if (rows.length !== 7 || rows.some((r) => r.length !== 7)) throw new Error('bad size: ' + id);
  const at = (x, y) => (x >= 0 && y >= 0 && x < 7 && y < 7 && rows[y][x] !== '.' ? rows[y][x] : null);
  const grid = [];
  for (let y = -1; y <= 7; y++) {
    let s = '';
    for (let x = -1; x <= 7; x++) {
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
