// The pixel art of a door in the back wall (no Phaser), at the floor's pixel size, in the wall's stone: an arch of
// worn wedge stones with a keystone, two wooden halves of planks with iron bands and rivets, and the dark doorway
// behind them (a hint of steps going down). The big entrance adds a skull keystone, portcullis teeth, chains and bones.
// doorArtLayers(D, big) returns { frame, leaf, hole, extras } layers: { w, h, ax, ay, pixels } where (ax, ay) is
// the door's middle at the floor line inside the layer (the leaf: its hinge at the floor line), pixels = 0xrrggbb
// numbers or -1 (empty), row by row. Sizes and colours: floorArt.json `door` (`art.small` / `art.big`).

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
const shade = (c, a) => (clamp(((c >> 16) & 255) + a) << 16) | (clamp(((c >> 8) & 255) + a) << 8) | clamp((c & 255) + a);

function layer(w, h, ax, ay) {
  const pixels = new Int32Array(w * h).fill(-1);
  return {
    w, h, ax, ay, pixels,
    set(x, y, c) { const X = x + ax, Y = y + ay; if (X >= 0 && Y >= 0 && X < w && Y < h) pixels[Y * w + X] = c; },
  };
}

export function doorArtLayers(D, big) {
  const S = big ? D.art.big : D.art.small;
  const C = Object.fromEntries(Object.entries(D.art.colors).map(([k, v]) => [k, num(v)]));
  const rnd = seeded(big ? 7 : 3);
  const { halfW, openH, archH, frameW, block, plank } = S;
  const top = -openH; // all coordinates: x from the door's middle, y up from the floor line (negative = up)
  const hw = halfW + frameW, ah = archH + frameW;
  const inOpen = (x, y) => {
    if (y >= 0 || Math.abs(x + 0.5) > halfW) return false;
    if (y >= top) return true;
    const dx = (x + 0.5) / halfW;
    return y + 0.5 >= top - archH * Math.sqrt(Math.max(0, 1 - dx * dx));
  };
  const inFrame = (x, y) => {
    if (y >= 0 || Math.abs(x + 0.5) > hw) return false;
    if (y >= top) return true;
    const dx = (x + 0.5) / hw;
    return y + 0.5 >= top - ah * Math.sqrt(Math.max(0, 1 - dx * dx));
  };
  const keyUp = big ? 3 : 1;
  const W = hw * 2 + 2, Hh = openH + ah + keyUp + 2;
  const frame = layer(W + (big ? 2 * (S.chainOut + 3) : 0), Hh + (big ? S.bonesBelow : 0), hw + 1 + (big ? S.chainOut + 3 : 0), Hh);
  // Jambs: courses of `block` rows, a mortar line between them; the inner edge (the reveal) darker.
  for (let y = top; y < 0; y++) {
    for (let x = -hw; x < hw; x++) {
      if (!inFrame(x, y) || inOpen(x, y)) continue;
      const local = (-1 - y) % block;
      const split = big && (x === (x < 0 ? -hw + (Math.floor((-1 - y) / block) % 2 ? Math.floor(frameW / 2) : Math.floor(frameW / 3)) : halfW + (Math.floor((-1 - y) / block) % 2 ? Math.floor(frameW / 2) : Math.floor(frameW / 3))));
      let c = local === block - 1 || split ? C.mortar : local === 0 ? C.stoneDark : C.stone;
      if (c !== C.mortar) {
        if (x === -hw || x === hw - 1) c = shade(c, -10);
        if (x === -halfW - 1 || x === halfW) c = shade(c, -14);
        if (rnd() < D.art.grain) c = shade(c, rnd() < 0.5 ? -5 : 5);
      }
      frame.set(x, y, c);
    }
  }
  // Arch: wedge stones with crisp mortar lines between them, lit on the outside, shaded on the inside.
  const n = big ? 7 : 5;
  const wedge = (x, y) => Math.min(n - 1, Math.floor((Math.atan2(Math.max(0, top - (y + 0.5)), x + 0.5) / Math.PI) * n));
  for (let y = top - ah - 2; y < top; y++) {
    for (let x = -hw - 1; x <= hw; x++) {
      if (!inFrame(x, y) || inOpen(x, y)) continue;
      const w = wedge(x, y), key = w === Math.floor(n / 2);
      const nb = (x2, y2) => inFrame(x2, y2) && !inOpen(x2, y2) && y2 < top && wedge(x2, y2) !== w;
      const dxo = (x + 0.5) / hw, dyo = (top - y - 0.5) / ah, outer = dxo * dxo + dyo * dyo;
      const dxi = (x + 0.5) / (halfW + 1), dyi = (top - y - 0.5) / (archH + 1), inner = dxi * dxi + dyi * dyi;
      let c = key ? C.stoneLight : C.stone;
      if (outer > 0.8) c = shade(c, 10);
      else if (inner < 1.25) c = shade(c, -14);
      if (rnd() < D.art.grain) c = shade(c, rnd() < 0.5 ? -5 : 5);
      frame.set(x, y, (nb(x + 1, y) || nb(x, y + 1)) && !key ? C.mortar : c);
    }
  }
  const kw = big ? 2 : 1; // the keystone sticks up a little
  for (let x = -kw; x < kw; x++) for (let y = top - ah - keyUp; y <= top - ah; y++) frame.set(x, y, y === top - ah - keyUp ? shade(C.stoneLight, 10) : C.stoneLight);
  for (let x = -hw; x < hw; x++) if (Math.abs(x + 0.5) > halfW) frame.set(x, -1, C.stoneLight); // threshold ends

  // The doorway behind the halves: black, a faint edge, a hint of steps going down.
  const hole = layer(halfW * 2, openH + archH, halfW, openH + archH);
  const steps = big ? [0, 4, 9] : [0, 3, 7];
  for (let y = top - archH; y < 0; y++) {
    for (let x = -halfW; x < halfW; x++) {
      if (!inOpen(x, y)) continue;
      const d = Math.min(x + halfW, halfW - 1 - x), s = -1 - y;
      hole.set(x, y, d === 0 ? C.holeEdge : steps.includes(s) && d > 0 ? (s === 0 ? C.step : C.stepFar) : C.hole);
    }
  }
  // The left half (the right one is the same mirrored): hinge at x = 0, the middle of the doorway at x = halfW.
  const leaf = layer(halfW, openH + archH, 0, openH + archH);
  for (let y = top - archH; y < 0; y++) {
    for (let lx = 0; lx < halfW; lx++) {
      const x = lx - halfW; // in door coordinates
      if (!inOpen(x, y)) continue;
      const p = lx % plank;
      let c = p === 0 ? C.woodDark : p === 1 ? C.woodLight : C.wood;
      if (!inOpen(x, y - 1)) c = C.woodDark; // the top edge
      if (lx === halfW - 1) c = C.woodDark; // the seam in the middle
      if (rnd() < 0.12) c = shade(c, -8);
      leaf.set(lx, y, c);
    }
  }
  for (const b of S.bands) {
    for (let lx = 0; lx < halfW; lx++) if (inOpen(lx - halfW, b)) { leaf.set(lx, b, C.ironLight); leaf.set(lx, b + 1, C.iron); }
    for (let lx = Math.floor(plank / 2); lx < halfW; lx += plank) if (inOpen(lx - halfW, b)) leaf.set(lx, b, C.rivet);
  }
  for (const [dx, dy] of [[-3, 0], [-2, -1], [-2, 1], [-1, 0]]) leaf.set(halfW + dx, S.ring + dy, C.ironLight); // ring handle
  if (big) for (let k = 0; k < 3; k++) for (let t = 0; t < 7; t++) leaf.set(4 + k * 2 + Math.floor(t / 3), -30 + t, C.woodDark); // claw marks

  // The entrance's extras: skull keystone, chains beside the arch, bones on the floor; teeth go with the doorway.
  const extras = big ? layer(frame.w, frame.h, frame.ax, frame.ay) : null;
  if (big) {
    const SK = [' ##### ', '#######', '#..#..#', '#..#..#', '###.###', ' ##### ', ' #.#.# '];
    const sx = -3, sy = top - ah + 1;
    SK.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '#') extras.set(sx + i, sy + j, j < 3 || i === 1 || i === 2 ? C.bone : C.boneDark);
      else if (ch === '.') extras.set(sx + i, sy + j, C.hole);
    }));
    for (const side of [-1, 1]) {
      const x = side * (hw + S.chainOut);
      for (let y = top - archH; y < top + 18; y++) extras.set(x + ((y >> 1) % 2 ? 1 : 0), y, y % 2 ? C.ironLight : C.iron);
      for (const [dx, dy] of [[-1, 18], [1, 18], [0, 19], [0, 17]]) extras.set(x + dx, top + dy, C.ironLight);
    }
    for (const [bx, by] of [[-hw - 3, 3], [hw - 2, 5]]) {
      for (let t = 0; t < 5; t++) extras.set(bx + t, by, C.bone);
      for (const [dx, dy] of [[-1, -1], [-1, 1], [5, -1], [5, 1]]) extras.set(bx + dx, by + dy, C.bone);
    }
    for (let i = -halfW + 1; i < halfW; i += 3) for (let t = 0; t < 4; t++) if (inOpen(i, top - archH + 3 + t)) hole.set(i, top - archH + 3 + t, t < 3 ? C.ironLight : C.iron); // portcullis teeth
  }
  return { frame, leaf, hole, extras, size: S };
}
