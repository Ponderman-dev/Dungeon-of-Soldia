// Boss sprites drawn with a tiny pixel DSL on a grid, then outlined like the game's art.
// Each boss: { w, h, draw(P) } where P has rect/px/ell/line/mirror helpers. Colours are hex strings.
const OUT = '#1a1020';

function makeGrid(w, h) {
  const g = Array.from({ length: h }, () => Array(w).fill(null));
  const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; };
  const P = {
    g, w, h,
    px: set,
    rect(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) set(x + i, y + j, c); },
    ell(cx, cy, rx, ry, c) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const dx = (x - cx) / rx, dy = (y - cy) / ry; if (dx * dx + dy * dy <= 1) set(x, y, c); } },
    line(x0, y0, x1, y1, c) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c); },
    // Draw something on the left half and mirror it to the right half (symmetrical bodies).
    sym(fn) { const before = g.map((r) => r.slice()); fn(); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x] !== before[y][x]) g[y][w - 1 - x] = g[y][x]; },
  };
  return P;
}

function outline(g) {
  const h = g.length, w = g[0].length;
  const out = g.map((r) => r.slice());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (g[y][x]) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = (g[y + dy] || [])[x + dx]; if (v && v !== OUT) { out[y][x] = OUT; break; } }
  }
  return out;
}

const BOSSES_ART = {
  grukk: { w: 44, h: 40, draw(P) {
    const skin = '#5fa83a', dark = '#3d7426', fur = '#7a5530', furD = '#5a3c20', iron = '#9aa0ad', ironD = '#5c6170', red = '#c0303a', bone = '#efe6cf';
    // legs + feet
    P.rect(13, 31, 5, 6, dark); P.rect(22, 31, 5, 6, dark); P.rect(12, 37, 7, 2, furD); P.rect(21, 37, 7, 2, furD);
    // belly + body
    P.ell(20, 25, 10, 8, skin); P.ell(20, 27, 7, 5, '#6fbb46');
    P.rect(11, 29, 18, 3, fur); P.rect(18, 29, 4, 3, '#d9b44a'); // belt + buckle
    // fur cape on shoulders
    P.ell(10, 18, 5, 4, fur); P.ell(30, 18, 5, 4, fur); P.rect(8, 17, 24, 3, furD);
    // arms
    P.rect(6, 19, 4, 9, skin); P.rect(30, 19, 4, 9, skin); P.rect(5, 27, 5, 3, dark); P.rect(30, 27, 5, 3, dark);
    // head with helmet + horns
    P.ell(20, 12, 7, 6, skin); P.rect(13, 6, 14, 4, iron); P.rect(13, 9, 14, 1, ironD);
    P.line(13, 7, 9, 2, bone); P.line(12, 7, 8, 3, bone); P.line(26, 7, 30, 2, bone); P.line(27, 7, 31, 3, bone);
    P.px(17, 12, red); P.px(23, 12, red); P.rect(16, 11, 2, 1, '#1a1020'); P.rect(22, 11, 2, 1, '#1a1020');
    P.rect(17, 15, 6, 1, '#2a4a1a'); P.px(17, 16, bone); P.px(22, 16, bone); // mouth + tusks
    P.ell(13, 13, 2, 1, skin); P.ell(27, 13, 2, 1, skin); // ears
    // cleaver in the right hand
    P.rect(34, 24, 2, 8, furD); P.rect(33, 13, 8, 12, iron); P.rect(33, 13, 8, 2, '#c8ccd6'); P.rect(39, 15, 2, 10, ironD); P.px(36, 17, red); P.px(37, 18, red);
  } },
  drum: { w: 18, h: 18, draw(P) {
    P.ell(9, 6, 7, 3, '#e8d9b0'); P.rect(2, 6, 15, 9, '#8a3a24'); P.ell(9, 15, 7, 2, '#8a3a24');
    for (let x = 3; x < 16; x += 3) P.line(x, 7, x + 1, 14, '#e8d9b0');
    P.rect(2, 8, 15, 1, '#d9b44a'); P.rect(2, 13, 15, 1, '#d9b44a');
    P.line(12, 2, 16, 0, '#7a5530'); P.ell(12, 3, 1, 1, '#efe6cf');
  } },
  brood: { w: 48, h: 34, draw(P) {
    const body = '#3a2450', bodyL = '#56357a', red = '#e04a4a', leg = '#2a1a3a';
    // legs (4 per side)
    const legs = [[14, 20, 4, 10, 1, 30], [15, 22, 6, 16, 3, 31], [17, 23, 10, 20, 8, 32], [19, 24, 14, 24, 12, 33]];
    P.sym(() => { for (const [x0, y0, x1, y1, x2, y2] of legs) { P.line(x0, y0, x1, y1 - 4, leg); P.line(x1, y1 - 4, x2, y2, leg); P.line(x0, y0 + 1, x1, y1 - 3, leg); } });
    // abdomen + head
    P.ell(24, 14, 12, 10, body); P.ell(24, 12, 9, 6, bodyL);
    P.rect(22, 9, 5, 2, red); P.rect(23, 11, 3, 2, red); P.rect(22, 13, 5, 2, red); // hourglass
    P.ell(24, 25, 6, 5, body);
    // many eyes
    for (const [x, y] of [[21, 24], [27, 24], [22, 26], [26, 26], [24, 23], [24, 27]]) P.px(x, y, red);
    P.px(21, 23, '#ff9a9a'); P.px(27, 23, '#ff9a9a');
    // fangs
    P.rect(22, 29, 1, 3, '#efe6cf'); P.rect(26, 29, 1, 3, '#efe6cf');
  } },
  egg: { w: 14, h: 14, draw(P) {
    P.ell(7, 8, 5, 5, '#e9e0f0'); P.ell(6, 7, 3, 3, '#ffffff'); P.line(3, 3, 11, 13, '#c9bed6'); P.line(11, 3, 3, 13, '#c9bed6'); P.px(8, 9, '#7a5a9a'); P.px(6, 10, '#7a5a9a');
  } },
  warden: { w: 44, h: 44, draw(P) {
    const ice = '#9fd8f0', iceL = '#d8f4ff', iceD = '#5aa0c8', rock = '#4a6680', glow = '#7ff0ff';
    // legs
    P.rect(12, 34, 7, 8, rock); P.rect(25, 34, 7, 8, rock); P.rect(11, 40, 9, 3, iceD); P.rect(24, 40, 9, 3, iceD);
    // body block
    P.rect(10, 16, 24, 19, rock); P.rect(12, 18, 20, 15, '#5a7a96');
    // ice plates (3)
    P.rect(4, 12, 10, 9, ice); P.rect(5, 12, 8, 2, iceL); P.rect(30, 12, 10, 9, ice); P.rect(31, 12, 8, 2, iceL); // shoulders
    P.rect(15, 21, 14, 10, ice); P.rect(16, 21, 12, 2, iceL); P.line(18, 24, 22, 29, iceD); // chest plate
    // arms
    P.rect(3, 21, 7, 13, rock); P.rect(34, 21, 7, 13, rock); P.ell(6, 35, 4, 3, iceD); P.ell(37, 35, 4, 3, iceD);
    // head
    P.rect(16, 7, 12, 9, rock); P.rect(16, 7, 12, 2, iceD); P.rect(18, 11, 3, 2, glow); P.rect(23, 11, 3, 2, glow);
    // crystals on the back
    P.line(14, 6, 11, 0, iceL); P.line(15, 6, 12, 1, ice); P.line(29, 6, 32, 0, iceL); P.line(28, 6, 31, 1, ice); P.line(22, 6, 22, 1, iceL);
  } },
  rask: { w: 26, h: 36, draw(P) {
    const skin = '#c98a5a', red = '#b8402a', leather = '#5a3c20', dark = '#2a2233', steel = '#b7bcc8';
    P.rect(7, 28, 4, 6, dark); P.rect(14, 28, 4, 6, dark); P.rect(6, 33, 6, 2, leather); P.rect(13, 33, 6, 2, leather);
    P.rect(5, 15, 15, 14, leather); P.rect(7, 17, 11, 10, '#7a5530'); P.line(5, 15, 19, 28, '#3a2614');
    P.rect(2, 16, 4, 10, skin); P.rect(19, 16, 4, 10, skin);
    P.ell(12, 10, 5, 5, skin); P.rect(7, 5, 11, 3, red); P.line(17, 6, 21, 9, red); P.rect(8, 11, 9, 2, '#3a2614'); // bandana + beard
    P.px(10, 9, dark); P.px(14, 9, dark);
    // big axe
    P.rect(22, 6, 2, 24, leather); P.ell(23, 9, 3, 5, steel); P.rect(24, 5, 2, 9, '#d8dce6');
  } },
  vesh: { w: 24, h: 36, draw(P) {
    const cloak = '#5a2f7a', cloakL = '#7a45a0', skin = '#e0b48a', dark = '#1e1630', steel = '#c8ccd6';
    P.rect(8, 28, 3, 6, dark); P.rect(13, 28, 3, 6, dark);
    P.rect(6, 14, 12, 15, cloak); P.rect(8, 16, 8, 12, cloakL); P.rect(6, 22, 12, 2, '#d9b44a');
    P.ell(12, 9, 6, 6, cloak); P.ell(12, 11, 3, 3, skin); P.rect(10, 11, 1, 1, dark); P.rect(13, 11, 1, 1, dark); P.rect(9, 13, 6, 1, dark); // hood + mask
    P.rect(3, 15, 3, 9, cloak); P.rect(18, 15, 3, 9, cloak);
    P.line(2, 24, 0, 30, steel); P.line(21, 24, 23, 30, steel); // daggers
    P.px(2, 23, '#d9b44a'); P.px(21, 23, '#d9b44a');
  } },
  morthul: { w: 40, h: 46, draw(P) {
    const robe = '#3a1f5a', robeL = '#56307f', bone = '#e8e2cf', boneD = '#b8b09a', gold = '#d9b44a', green = '#6dff8f';
    // robe
    P.sym(() => { P.line(12, 18, 6, 44, robe); P.line(13, 18, 7, 44, robe); });
    for (let y = 18; y < 44; y++) { const half = 6 + (y - 18) * 0.42; P.rect(20 - half, y, half * 2, 1, robe); }
    P.rect(18, 20, 4, 24, robeL); P.rect(10, 42, 20, 2, '#24123a');
    // shoulders with bone pads
    P.ell(11, 18, 4, 3, bone); P.ell(29, 18, 4, 3, bone); P.px(11, 17, boneD); P.px(29, 17, boneD);
    // skull + crown
    P.ell(20, 12, 5, 6, bone); P.rect(17, 11, 2, 2, '#1a1020'); P.rect(21, 11, 2, 2, '#1a1020'); P.px(17, 11, green); P.px(22, 11, green);
    P.rect(18, 15, 4, 1, boneD); P.px(18, 16, bone); P.px(20, 16, bone); P.px(22, 16, bone);
    P.rect(15, 5, 10, 2, gold); P.px(15, 3, gold); P.px(15, 4, gold); P.px(20, 2, gold); P.rect(20, 3, 1, 2, gold); P.px(24, 3, gold); P.px(24, 4, gold); P.px(20, 5, '#e04a4a');
    // bony hands + staff with green orb
    P.rect(5, 26, 3, 3, bone); P.rect(32, 26, 3, 3, bone);
    P.rect(35, 10, 2, 32, '#5a3c20'); P.ell(36, 7, 3, 3, green); P.ell(36, 6, 1, 1, '#dfffe8');
  } },
  phylactery: { w: 14, h: 18, draw(P) {
    P.line(7, 0, 12, 7, '#6dff8f'); P.line(7, 0, 2, 7, '#6dff8f'); P.line(2, 7, 7, 15, '#3fbf6a'); P.line(12, 7, 7, 15, '#3fbf6a');
    for (let y = 1; y < 15; y++) { const half = y < 7 ? y * 0.7 : (15 - y) * 0.6; P.rect(7 - half, y, half * 2 + 1, 1, y < 7 ? '#9affb8' : '#4fd47c'); }
    P.px(6, 5, '#ffffff'); P.rect(4, 16, 7, 2, '#5c6170');
  } },
  ignatius: { w: 46, h: 44, draw(P) {
    const rock = '#3a2a2a', rockL = '#5a4040', lava = '#ff8a3d', lavaL = '#ffd27a', ember = '#e0402a';
    P.rect(12, 34, 8, 8, rock); P.rect(26, 34, 8, 8, rock); P.rect(11, 41, 10, 2, rockL); P.rect(25, 41, 10, 2, rockL);
    P.ell(23, 24, 15, 12, rock); P.ell(23, 22, 12, 9, rockL);
    P.ell(23, 24, 5, 5, lava); P.ell(23, 24, 3, 3, lavaL); // the forge heart
    for (const [a, b, c, d] of [[14, 18, 19, 24], [32, 17, 27, 23], [16, 30, 21, 27], [30, 31, 26, 27], [20, 14, 23, 19]]) P.line(a, b, c, d, lava);
    // arms like anvils
    P.rect(3, 20, 8, 14, rock); P.rect(1, 31, 12, 5, rockL); P.rect(35, 20, 8, 14, rock); P.rect(33, 31, 12, 5, rockL);
    P.line(5, 24, 8, 30, lava); P.line(40, 24, 37, 30, lava);
    // head with two chimneys
    P.rect(17, 7, 12, 8, rock); P.rect(19, 10, 3, 2, lavaL); P.rect(25, 10, 3, 2, lavaL);
    P.rect(15, 2, 3, 6, rockL); P.rect(28, 2, 3, 6, rockL); P.px(16, 0, ember); P.px(29, 0, ember); P.px(16, 1, lava); P.px(29, 1, lava);
  } },
  sela: { w: 34, h: 44, draw(P) {
    const dress = '#2f8f8a', dressL = '#5fc4bc', silver = '#d8e6ee', skin = '#f0d4bc', hair = '#e8e8ff', dark = '#1e1630';
    for (let y = 20; y < 42; y++) { const half = 5 + (y - 20) * 0.45; P.rect(17 - half, y, half * 2, 1, dress); }
    for (let y = 22; y < 42; y += 4) P.rect(17 - 2, y, 4, 2, dressL);
    P.rect(12, 14, 10, 8, dress); P.rect(14, 15, 6, 5, dressL);
    P.ell(17, 9, 5, 6, hair); P.ell(17, 10, 3, 4, skin); P.px(16, 10, dark); P.px(18, 10, dark); P.px(17, 12, '#c0303a');
    P.line(12, 6, 10, 18, hair); P.line(22, 6, 24, 18, hair); P.rect(14, 3, 6, 1, silver); P.px(17, 2, '#7ff0ff');
    P.rect(8, 15, 4, 8, dress); P.rect(22, 15, 4, 8, dress);
    // the hand mirror
    P.rect(27, 18, 1, 6, silver); P.ell(28, 14, 4, 5, silver); P.ell(28, 14, 3, 4, '#a8e8ff'); P.px(27, 12, '#ffffff');
    // floating shards
    for (const [x, y] of [[3, 8], [5, 26], [31, 30], [2, 36]]) { P.line(x, y, x + 1, y - 2, '#a8e8ff'); P.px(x + 1, y - 1, '#ffffff'); }
  } },
  vharox: { w: 60, h: 46, draw(P) {
    const scale = '#3a4aa0', scaleL = '#5a6ad0', belly = '#c8c0e8', bolt = '#ffe04a', wing = '#2a3478', wingL = '#4a58b8';
    // wings
    P.sym(() => {
      for (let i = 0; i < 18; i++) P.line(22, 16, 22 - i - 2, 2 + i * 0.6, i % 6 === 0 ? wingL : wing);
      P.line(22, 16, 2, 3, wingL); P.line(4, 3, 4, 20, wingL); P.line(10, 4, 10, 18, wingL); P.line(16, 6, 16, 17, wingL);
    });
    // body + tail
    P.ell(30, 26, 10, 9, scale); P.ell(30, 28, 6, 6, belly);
    P.line(38, 32, 50, 40, scale); P.line(38, 33, 50, 41, scale); P.line(50, 40, 56, 36, scale); P.line(54, 34, 57, 37, bolt);
    // legs
    P.rect(23, 33, 4, 7, scale); P.rect(33, 33, 4, 7, scale); P.rect(22, 40, 6, 2, scaleL); P.rect(32, 40, 6, 2, scaleL);
    // neck + head
    P.line(30, 18, 30, 10, scale); P.line(31, 18, 31, 10, scale); P.line(29, 18, 29, 11, scale);
    P.ell(30, 8, 5, 4, scale); P.rect(31, 7, 7, 3, scale); P.px(30, 6, bolt); P.rect(36, 9, 2, 1, '#efe6cf');
    P.line(26, 6, 23, 1, scaleL); P.line(34, 5, 36, 0, scaleL); // horns
    // lightning
    P.line(44, 10, 46, 14, bolt); P.line(46, 14, 44, 15, bolt); P.line(44, 15, 47, 20, bolt);
    P.line(10, 26, 12, 30, bolt); P.line(12, 30, 10, 31, bolt); P.line(10, 31, 13, 36, bolt);
  } },
  sprite: { w: 12, h: 14, draw(P) {
    P.ell(6, 7, 4, 5, '#7ab0ff'); P.ell(6, 6, 2, 3, '#d8ecff'); P.px(5, 6, '#1a1020'); P.px(7, 6, '#1a1020'); P.line(9, 2, 11, 0, '#ffe04a'); P.line(2, 11, 0, 13, '#ffe04a');
  } },
};

function drawSprite(canvas, key, scale) {
  const art = BOSSES_ART[key];
  const P = makeGrid(art.w + 2, art.h + 2);
  const inner = makeGrid(art.w, art.h);
  art.draw(inner);
  for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) P.g[y + 1][x + 1] = inner.g[y][x];
  const g = outline(P.g);
  canvas.width = (art.w + 2) * scale;
  canvas.height = (art.h + 2) * scale;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  g.forEach((row, y) => row.forEach((c, x) => { if (c) { ctx.fillStyle = c; ctx.fillRect(x * scale, y * scale, scale, scale); } }));
}

// The game's own hero art (heroes.json parts): parts drawn at their place, feet at the bottom middle.
function drawHero(canvas, hero, scale) {
  const boxes = hero.parts.map((p) => {
    const rows = p.art ? p.art.rows : null;
    const w = rows ? Math.max(...rows.map((r) => r.length)) : Math.round(p.w);
    const h = rows ? rows.length : Math.round(p.h);
    return { p, w, h, x0: Math.round(p.x - w / 2), y0: Math.round(p.y - h / 2) };
  });
  const minX = Math.min(...boxes.map((b) => b.x0)), maxX = Math.max(...boxes.map((b) => b.x0 + b.w));
  const minY = Math.min(...boxes.map((b) => b.y0));
  const W = maxX - minX + 2, H = -minY + 2;
  canvas.width = W * scale; canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const DIG = '0123456789abcdefghijklmnopqrstuvwxyz';
  const order = ['body', 'head', 'weapon'];
  boxes.sort((a, b) => order.indexOf(a.p.n) - order.indexOf(b.p.n));
  for (const b of boxes) {
    const pal = b.p.art ? b.p.art.palette.map((c) => '#' + c.slice(2)) : ['#' + String(b.p.color).slice(2)];
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      let c = null;
      if (b.p.art) { const ch = b.p.art.rows[y][x]; if (ch && ch !== '.') c = pal[DIG.indexOf(ch)]; } else c = pal[0];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect((b.x0 + x - minX + 1) * scale, (b.y0 + y - minY + 1) * scale, scale, scale);
    }
  }
}
