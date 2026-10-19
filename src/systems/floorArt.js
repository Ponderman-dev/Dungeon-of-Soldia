// The pixel art of a floor (no Phaser): an old dungeon room seen from above. The back wall is stone bricks with
// two pillars, moss and hanging vines; the floor is worn flagstones with dirt in the gaps, cracks, dirt patches
// where stones are gone, grass tufts, moss and pebbles. Look numbers: data/floorArt.json.
// floorArtPixels(...) returns { width, height, pixels } (pixels = one 0xrrggbb number per art pixel, row by row).

// A small seeded random (the same seed always draws the same floor).
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const num = (c) => (typeof c === 'number' ? c : Number(c));
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
// Lighter (amount > 0) or darker (amount < 0), in 0-255 steps per channel.
export function shade(c, amount) {
  return (clamp(((c >> 16) & 255) + amount) << 16) | (clamp(((c >> 8) & 255) + amount) << 8) | clamp((c & 255) + amount);
}
// a and b mixed: t = 0 is all a, 1 is all b.
export function mix(a, b, t) {
  const ch = (s) => clamp(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export function floorArtPixels(art, { width, height, wallH, tint, seed }) {
  const rnd = seeded(seed);
  const between = ([lo, hi]) => lo + Math.floor(rnd() * (hi - lo + 1));
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const tinted = (c) => mix(num(c), num(tint), art.tintShare);
  const px = new Uint32Array(width * height);
  const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
  const get = (x, y) => px[y * width + x];
  const set = (x, y, c) => { if (inside(x, y)) px[y * width + x] = c; };
  const grain = art.grain ?? 0.12; // share of stone pixels a shade lighter/darker (0 = flat, clean stones)
  const W = art.wall;
  const F = art.floor;
  const P = art.pillars;

  // --- The back wall: rows of stone bricks, each a slightly different stone, lit along its top edge.
  const mortar = tinted(W.mortar);
  // Bricks are laid from the wall's BASE upward (whole rows at the bottom, any cut row at the top), and the base is a
  // course of long foundation stones with a lit ledge, so the wall stands ON the floor (user: the old cut row + long
  // soft shadow looked disconnected).
  const brickBottom = wallH - W.baseH;
  // Bricks are drawn by the SAME rules as the floor stones (one art style): a 1-pixel mortar gap, worn corners, lit
  // top edge, shaded bottom/right edge, a little grain; some bricks darker, some chipped.
  const bricks = [];
  for (let top = brickBottom - Math.ceil(brickBottom / W.brickH) * W.brickH; top < brickBottom; top += W.brickH) {
    for (let x = -between([0, W.brickW[1]]); x < width; ) {
      const w = between(W.brickW);
      const c = shade(tinted(pick(W.stone)), rnd() < W.darkShare ? -10 : 0);
      const chip = rnd() < W.chipShare ? (rnd() < 0.5 ? 'tl' : 'br') : null;
      for (let y = Math.max(0, top); y < Math.min(top + W.brickH, brickBottom); y++) {
        for (let i = x; i < x + w; i++) {
          if (i < 0 || i >= width) continue;
          const gapPx = y === top || i === x;
          const corner = (y === top + 1 || y === top + W.brickH - 1) && (i === x + 1 || i === x + w - 1);
          const chipped = (chip === 'tl' && y <= top + 2 && i <= x + 2) || (chip === 'br' && y >= top + W.brickH - 2 && i >= x + w - 3);
          if (gapPx || corner || chipped) { set(i, y, mortar); continue; }
          const v = y === top + 1 ? W.highlight : y === top + W.brickH - 1 || i === x + w - 1 ? -W.shade : 0;
          set(i, y, shade(c, v + (rnd() < grain ? (rnd() < 0.5 ? -5 : 5) : 0)));
        }
      }
      bricks.push({ x, y: top, w, h: W.brickH });
      x += w;
    }
  }
  // Cracks in the bricks, and damp stains running down the wall (dithered, so they stay pixel-art).
  for (let i = 0; i < W.cracks; i++) {
    const b = pick(bricks);
    let x = b.x + 2 + Math.floor(rnd() * Math.max(1, b.w - 4)), y = Math.max(1, b.y + 1);
    for (let k = between([3, 6]); k > 0; k--, y++) { if (get(x, y) !== mortar) set(x, y, shade(get(x, y), -18)); if (rnd() < 0.5) x += rnd() < 0.5 ? 1 : -1; }
  }
  for (let i = 0; i < W.stains; i++) {
    const x0 = Math.floor(rnd() * width), y0 = Math.floor(rnd() * brickBottom * 0.6), len = between(W.stainLen), sw = between([2, 4]);
    for (let y = y0; y < Math.min(brickBottom, y0 + len); y++) for (let x = x0; x < x0 + sw; x++) if ((x + y) % 2 === 0 && get(x, y) !== mortar) set(x, y, shade(get(x, y), -9));
  }
  // The foundation course: long blocks, a bright ledge on top, a dark foot.
  for (let x = -between([0, W.baseBlockW[1]]); x < width; ) {
    const w = between(W.baseBlockW);
    const c = shade(tinted(pick(W.stone)), W.baseLight);
    for (let y = brickBottom; y < wallH; y++) {
      for (let i = x; i < x + w; i++) {
        if (i < 0 || i >= width) continue;
        set(i, y, i === x ? mortar : y === brickBottom ? shade(c, W.highlight + 8) : y === wallH - 1 ? shade(c, -6) : shade(c, rnd() < grain ? -5 : 0));
      }
    }
    x += w;
  }
  // Moss creeping up from the foot of the wall.
  for (let i = 0; i < W.mossBase; i++) {
    const cx = Math.floor(rnd() * width), w = between([2, 6]), h = between([1, 4]);
    for (let x = cx; x < cx + w; x++) {
      const top = wallH - Math.max(1, h - Math.abs(x - cx - w / 2));
      for (let y = top; y < wallH; y++) if (rnd() < 0.75) set(x, y, tinted(pick(F.moss)));
    }
  }

  // --- The floor: rows of worn flagstones with dirt between them.
  const gap = tinted(F.gap);
  for (let y = wallH; y < height; y++) for (let x = 0; x < width; x++) set(x, y, gap);
  const stones = []; // { x, y, w, h } of every flagstone (cracks and grass use them)
  for (let top = wallH - 1; top < height; ) {
    const h = between(F.rowH);
    let x = -between([0, F.stoneW[1]]);
    while (x < width) {
      const w = between(F.stoneW);
      const sunk = rnd() < F.sunkenShare; // a few stones have sunk and lie in shadow
      const c = shade(tinted(pick(F.stone)), sunk ? -12 : 0);
      // Each stone is inset 1 pixel (the gap) and has its corners knocked off (worn).
      for (let y = top + 1; y < Math.min(top + h, height); y++) {
        for (let i = x + 1; i < x + w; i++) {
          const corner = (y === top + 1 || y === top + h - 1) && (i === x + 1 || i === x + w - 1);
          if (corner) continue;
          const v = y === top + 1 ? F.highlight : y === top + h - 1 || i === x + w - 1 ? -F.shade : 0;
          set(i, y, shade(c, v + (rnd() < grain ? (rnd() < 0.5 ? -5 : 5) : 0))); // a little grain
        }
      }
      stones.push({ x, y: top, w, h });
      x += w;
    }
    top += h;
  }
  // Cracks: short wandering dark lines inside stones.
  for (let i = 0; i < F.cracks; i++) {
    const s = pick(stones);
    let x = s.x + 2 + Math.floor(rnd() * Math.max(1, s.w - 4));
    let y = s.y + 2 + Math.floor(rnd() * Math.max(1, s.h - 4));
    for (let k = between([4, 10]); k > 0; k--) {
      if (inside(x, y) && get(x, y) !== gap) set(x, y, shade(get(x, y), -22));
      x += rnd() < 0.5 ? 1 : -1;
      if (rnd() < 0.6) y += rnd() < 0.5 ? 1 : -1;
    }
  }
  // Dirt patches: rough blobs where the stones are gone.
  const patches = [];
  for (let i = 0; i < F.dirtPatches; i++) {
    const cx = Math.floor(rnd() * width);
    const cy = wallH + 12 + Math.floor(rnd() * (height - wallH - 16));
    const r = between(F.dirtRadius);
    patches.push({ cx, cy, r });
    const base = tinted(pick(F.dirt));
    const wob = [0, 1, 2, 3, 4, 5, 6, 7].map(() => 0.75 + rnd() * 0.4); // a lumpy outline (8 directions)
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = Math.round(cx - r * 1.6); x <= cx + r * 1.6; x++) {
        if (y < wallH + 1) continue;
        const a = Math.atan2(y - cy, (x - cx) / 1.4);
        const k = wob[Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8) % 8];
        const d = Math.hypot((x - cx) / 1.4, y - cy) / (r * k);
        if (d >= 1) continue;
        // Mostly one earth colour, a darker rim, a few clods and lighter grains.
        const g = rnd();
        set(x, y, d > 0.82 ? shade(base, -10) : g < 0.08 ? shade(base, -14) : g < 0.14 ? shade(base, 10) : base);
      }
    }
    // A few broken stone chunks lying in the dirt.
    for (let j = between([1, 3]); j > 0; j--) {
      const bx = cx + between([-r, r]);
      const by = cy + between([-Math.floor(r / 2), Math.floor(r / 2)]);
      const c = tinted(pick(F.stone));
      for (let y = by; y < by + between([2, 4]); y++) for (let x = bx; x < bx + between([3, 6]); x++) if (y > wallH) set(x, y, y === by ? shade(c, F.highlight) : c);
    }
  }
  // Grass tufts: a few blades growing up, near dirt patches and along the walls, sometimes anywhere.
  const tuft = (x, y) => {
    for (let b = between([2, 5]); b > 0; b--) {
      const bx = x + between([-2, 2]);
      const len = between([2, 5]);
      const c = tinted(pick(F.grass));
      for (let k = 0; k < len; k++) set(bx + (k > 1 && rnd() < 0.3 ? (rnd() < 0.5 ? -1 : 1) : 0), y - k, k === len - 1 ? shade(c, 18) : c);
    }
  };
  for (let i = 0; i < F.grassTufts; i++) {
    const r = rnd();
    if (r < 0.45 && patches.length) {
      const p = pick(patches);
      const a = rnd() * Math.PI * 2;
      tuft(Math.round(p.cx + Math.cos(a) * p.r * 1.3), Math.round(p.cy + Math.sin(a) * p.r));
    } else if (r < 0.75) {
      const side = rnd() < 0.5 ? between([0, 10]) : width - 1 - between([0, 10]);
      tuft(side, wallH + 4 + Math.floor(rnd() * (height - wallH - 4)));
    } else if (r < 0.88) {
      tuft(Math.floor(rnd() * width), wallH + between([3, 8])); // along the foot of the wall
    } else {
      tuft(Math.floor(rnd() * width), wallH + 6 + Math.floor(rnd() * (height - wallH - 6)));
    }
  }
  // Moss in the gaps between the stones, and pebbles.
  for (let i = 0; i < F.mossSpecks; i++) {
    const x = Math.floor(rnd() * width);
    const y = wallH + Math.floor(rnd() * (height - wallH));
    if (get(x, y) === gap) set(x, y, tinted(pick(F.moss)));
  }
  for (let i = 0; i < F.pebbles; i++) {
    const x = Math.floor(rnd() * width);
    const y = wallH + 2 + Math.floor(rnd() * (height - wallH - 2));
    const c = tinted(pick(F.pebble));
    set(x, y, c);
    if (rnd() < 0.4) set(x + 1, y, shade(c, -12));
  }

  // --- The pillars: round stone columns with a capital on top and a base, standing on the floor line.
  for (const cx of P.x) {
    const half = P.width / 2;
    const column = (x0, x1, y0, y1) => {
      for (let x = x0; x < x1; x++) {
        const t = (x - x0) / Math.max(1, x1 - x0 - 1); // 0 = left edge, 1 = right edge; lit from the left
        const c = t < 0.15 ? num(P.mid) : t < 0.45 ? num(P.light) : t < 0.8 ? num(P.mid) : num(P.dark);
        for (let y = y0; y < y1; y++) set(x, y, tinted(c));
      }
    };
    column(cx - half, cx + half, 0, wallH);
    const o = P.overhang;
    column(cx - half - o, cx + half + o, 0, P.capitalH); // capital
    column(cx - half - o, cx + half + o, wallH - P.baseH, wallH); // base, standing on the floor line like the wall
    for (const y of [P.capitalH, wallH - P.baseH - 1]) for (let x = cx - half - o; x < cx + half + o; x++) set(x, y, tinted(num(P.dark))); // the shadow line under the capital / over the base
    for (let i = 0; i < P.cracks; i++) {
      let x = cx - half + 2 + Math.floor(rnd() * (P.width - 4));
      let y = P.capitalH + 4 + Math.floor(rnd() * (wallH - P.capitalH - P.baseH - 12));
      for (let k = between([4, 9]); k > 0; k--, y++) { set(x, y, tinted(num(P.dark))); if (rnd() < 0.4) x += rnd() < 0.5 ? 1 : -1; }
    }
    // (No block shadow on the floor: the wall's contact shadow runs under the pillar too; a square looked like it floated.)
  }

  // Hanging vines from the top of the wall (over bricks and pillars).
  for (let i = 0; i < W.vines; i++) {
    let x = Math.floor(rnd() * width);
    const len = between(W.vineLen);
    for (let y = 0; y < len; y++) {
      const c = tinted(pick(F.grass));
      set(x, y, shade(c, -10));
      if (rnd() < 0.25) set(x + (rnd() < 0.5 ? -1 : 1), y, c); // a leaf
      if (rnd() < 0.15) x += rnd() < 0.5 ? -1 : 1;
    }
  }

  // Light: the wall's shadow on the floor, and darker side edges.
  // The seam between wall and floor: no dark line. Dirt drifts, rubble and grass cross it, so the wall and the floor
  // read as one place.
  for (let i = 0; i < F.seamDirt; i++) {
    const cx = Math.floor(rnd() * width), w = between([3, 9]), base = tinted(pick(F.dirt));
    for (let x = cx; x < cx + w; x++) {
      const h = Math.max(1, Math.round(2.5 - Math.abs(x - cx - w / 2) / 2));
      for (let y = wallH - 1; y < wallH - 1 + h; y++) if (rnd() < 0.85) set(x, y, rnd() < 0.15 ? shade(base, 8) : base);
    }
  }
  for (let i = 0; i < F.seamRubble; i++) {
    const x = Math.floor(rnd() * width), y = wallH - 1 + between([0, 2]), c = tinted(pick(W.stone));
    const w = between([1, 3]);
    for (let k = 0; k < w; k++) set(x + k, y, k === 0 ? shade(c, W.highlight) : c);
    if (w > 1) set(x + 1, y + 1, shade(c, -12));
  }
  for (let i = 0; i < F.seamTufts; i++) tuft(Math.floor(rnd() * width), wallH + between([0, 2]));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const e = Math.min(x, width - 1 - x) / (width * 0.18);
      if (e < 1) set(x, y, shade(get(x, y), -Math.round(F.edgeShade * (1 - e))));
    }
  }
  return { width, height, pixels: px };
}
