// Minion sprite PROPOSAL (user asked for SIMPLE sprites: 3-5 colours, no tiny details). Written in a
// friendly form and turned into the game's part format by toGame() (used by build-minions.mjs for the page,
// and later to apply them to src/data/minions.json).
// Each part: rows (letters, "." = empty), pal (letter -> colour), at [left, top] = where its top-left pixel
// sits in character pixels around the feet (x 0 = middle, feet y = 0, up is negative), pivot [col, row] = the
// pixel it turns around, idle = gentle loop (same as the heroes').

export const DESIGNS = {
  skeleton: {
    idea: 'Small bone-white skeleton with green glowing eyes and a short rusty sword (raised by the Necromancer).',
    height: 15,
    parts: {
      body: { at: [-4, -14], pivot: [4, 13], idle: { dy: -1, duration: 520 }, pal: { w: '#ebe5cf', s: '#b8b29c', e: '#6dff8a', k: '#1a1020' }, rows: [
        '..wwww..',
        '.wwwwww.',
        '.wewwew.',
        '.wwwwww.',
        '..wkkw..',
        '...ww...',
        '.wwwwww.',
        'w.wsws.w',
        'w..ww..w',
        '..wsww..',
        '..w..w..',
        '..w..w..',
        '..s..s..',
        '.ww..ww.'] },
      weapon: { at: [2, -13], pivot: [1, 5], idle: { angle: 8, duration: 650 }, pal: { t: '#b8b29c', r: '#1a1020' }, rows: [
        '.t.',
        '.t.',
        '.t.',
        '.t.',
        '.t.',
        'rrr',
        '.r.'] },
    },
  },
  rat: {
    idea: 'A small grey-brown rat with pink ears and tail, smaller than the Cave Rat enemy.',
    height: 6,
    parts: {
      body: { at: [-6, -6], pivot: [6, 5], idle: { dy: -0.5, duration: 260 }, pal: { a: '#8a7a6a', c: '#c4b6a4', p: '#d99090', k: '#1a1020' }, rows: [
        '.........pp.',
        '....aaaaapa.',
        '..aaaaaaaaka',
        'p.aaaaaaaaaa',
        '.paccccccaa.',
        '...a....a...'] },
    },
  },
  wisp: {
    idea: 'A crackling ball of pale blue light with yellow sparks around it (flies).',
    height: 8,
    parts: {
      body: { at: [-4, -8], pivot: [4, 4], idle: { dy: -1.5, duration: 420 }, pal: { b: '#9fe8ff', w: '#ffffff', y: '#ffe94d' }, rows: [
        '...y....',
        '..bbb.y.',
        '.bbwwb..',
        'ybwwwwby',
        '.bwwwwb.',
        '..bwwb..',
        '.y.bb...',
        '.....y..'] },
    },
  },
  imp: {
    idea: 'A little red devil with dark horns, yellow eyes, a pointy tail and a fire pitchfork.',
    height: 12,
    parts: {
      body: { at: [-4, -12], pivot: [4, 11], idle: { dy: -1, duration: 380 }, pal: { r: '#d9482e', d: '#8a2a1a', y: '#ffd24d', h: '#3a2a2a' }, rows: [
        '.h....h.',
        '.hrrrrh.',
        '.rrrrrr.',
        '.ryrryr.',
        '.rrddrr.',
        '..rrrr..',
        '.rrrrrr.',
        'r.rrrr.r',
        '..rrrr..',
        '..r..r.d',
        '..r..r.d',
        '.dd..ddd'] },
      weapon: { at: [3, -13], pivot: [2, 7], idle: { angle: 6, duration: 600 }, pal: { o: '#ffd24d', s: '#8a2a1a' }, rows: [
        'o.o.o',
        'ooooo',
        '..s..',
        '..s..',
        '..s..',
        '..s..',
        '..s..',
        '..s..',
        '..s..'] },
    },
  },
  mimic: {
    idea: 'A treasure chest with a gold lock, a row of white teeth and a red tongue. The lid is its own part so it can chomp.',
    height: 10,
    parts: {
      body: { at: [-6, -5], pivot: [6, 4], idle: { dy: -0.5, duration: 300 }, pal: { b: '#5e3a1a', B: '#8a5a2b', r: '#c0303a', w: '#ffffff', g: '#f2c544' }, rows: [
        'wrwrwrwrwrwrw',
        'bBBBBBBBBBBBb',
        'bBBBBBgBBBBBb',
        'bBBBBBBBBBBBb',
        '.bb.......bb.'] },
      head: { at: [-6, -10], pivot: [1, 4], idle: { angle: -6, duration: 300 }, pal: { b: '#5e3a1a', B: '#8a5a2b', g: '#f2c544', w: '#ffffff' }, rows: [
        '.bbbbbbbbbbb.',
        'bBBBBBBBBBBBb',
        'bBBBBBgBBBBBb',
        'bBBBBBBBBBBBb',
        'wbwbwbwbwbwbw'] },
    },
  },
  gargoyle: {
    idea: 'A crouching stone gargoyle with folded bat wings, small horns and glowing red eyes. Bigger, it is a greater minion.',
    height: 18,
    parts: {
      body: { at: [-8, -18], pivot: [8, 17], idle: { dy: -1, duration: 700 }, pal: { g: '#8a8f9c', G: '#5c606c', w: '#6e7280', h: '#4a4e5a', y: '#ff4a4a' }, rows: [
        '...h........h...',
        '...hh......hh...',
        '....gggggggg....',
        'w...gyggggyg...w',
        'ww..gggggggg..ww',
        'www..gGGGGg..www',
        'wwwwgggggggggwww',
        'wwwggggggggggwww',
        '.wwggGggggGggww.',
        '..wggGggggGggw..',
        '...gggggggggg...',
        '...gggggggggg...',
        '...ggg.gg.ggg...',
        '..gggg....gggg..',
        '..gggg....gggg..',
        '..gGgg....ggGg..',
        '.ggggg....ggggg.',
        '.g.g.g....g.g.g.'] },
    },
  },
  spirit_knight: {
    idea: 'A pale blue ghost of a knight: helmet with a glowing visor, no legs (a wispy tail), a light sword. A bit see-through.',
    height: 21,
    alpha: 0.8,
    parts: {
      body: { at: [-5, -13], pivot: [5, 12], idle: { dy: -1.5, duration: 600 }, pal: { h: '#cfeaff', b: '#7fc8ff', w: '#ffffff' }, rows: [
        '.hhbbbbhh.',
        'hhbbbbbbhh',
        'hhbbwwbbhh',
        'hhbbwwbbhh',
        '.hbbbbbbh.',
        '..bbbbbb..',
        '..bbbbbb..',
        '...bbbb...',
        '...bbbb...',
        '....bb....',
        '...b..b...',
        '..b....b..',
        '..........'] },
      head: { at: [-5, -21], pivot: [5, 7], idle: { dy: -1.5, duration: 600, delay: 120 }, pal: { h: '#cfeaff', H: '#7fc8ff', c: '#ffffff' }, rows: [
        '..hhhhhh..',
        '.hhhhhhhh.',
        'hhhhhhhhhh',
        'hHccccccHh',
        'hhhhhhhhhh',
        'hhhhhhhhhh',
        '.hHhhhhHh.',
        '..hhhhhh..'] },
      weapon: { at: [3, -18], pivot: [2, 10], idle: { angle: 8, duration: 700 }, pal: { t: '#e8f4ff', g: '#7fc8ff' }, rows: [
        '..t..',
        '.ttt.',
        '.ttt.',
        '.ttt.',
        '.ttt.',
        '.ttt.',
        '.ttt.',
        '.ttt.',
        'ggggg',
        '..g..',
        '..g..'] },
    },
  },
  phoenix: {
    idea: 'A small fire bird with a golden head, orange body, a long red tail and a wing that flaps (flies).',
    height: 10,
    parts: {
      body: { at: [-8, -8], pivot: [8, 4], idle: { dy: -2, duration: 350 }, pal: { y: '#ffd24d', o: '#ff7a3d', r: '#d9482e', b: '#fff2a0', k: '#1a1020' }, rows: [
        '...........yy...',
        '..........yyyk..',
        '.........yyyyyb.',
        '....ooooooyyy...',
        '..oooooooooo....',
        'rrrooooooooo....',
        '..rrr.oooo......',
        'rrr...o..o......'] },
      wingL: { at: [-6, -11], pivot: [7, 4], idle: { dy: -3, duration: 200 }, pal: { w: '#ffd24d', o: '#ff7a3d', y: '#fff2a0' }, rows: [
        'o.......',
        'oo....y.',
        '.ooww.yy',
        '..owwwww',
        '...wwww.'] },
    },
  },
};

// The game's part format (minions.json / heroes.json): { x, y (picture middle), w, h, art: { palette, rows }, anchor, idle }.
export function toGame(design) {
  const parts = {};
  for (const [name, p] of Object.entries(design.parts)) {
    const w = Math.max(...p.rows.map((r) => r.length)), h = p.rows.length;
    const letters = Object.keys(p.pal);
    const palette = letters.map((k) => '0x' + p.pal[k].slice(1));
    const rows = p.rows.map((r) => [...r.padEnd(w, '.')].map((ch) => (ch === '.' ? '.' : letters.indexOf(ch).toString(36))).join(''));
    if (rows.some((r) => r.includes('-1'))) throw new Error(`unknown letter in ${name}`);
    parts[name] = { x: p.at[0] + w / 2, y: p.at[1] + h / 2, w, h, art: { palette, rows }, anchor: [p.pivot[0] + 0.5, p.pivot[1] + 0.5], ...(p.idle ? { idle: p.idle } : {}) };
  }
  return { height: design.height, ...(design.alpha ? { alpha: design.alpha } : {}), parts };
}
