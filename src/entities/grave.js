// The pixel tombstone of a fallen hero (grey stone, dark cross), drawn into Graphics `g` with its FOOT at (0, 0).
// P = the pixel size. Used by the fight (effects.js makeGrave) and the Glossary basics pictures.
export function drawGrave(g, P) {
  const w = 8, hgt = 10;
  g.fillStyle(0x1a1a1a).fillRect(-w / 2 * P - P, -hgt * P - P, (w + 2) * P, (hgt + 1) * P); // outline
  g.fillStyle(0x8a8a96).fillRect(-w / 2 * P, -hgt * P, w * P, hgt * P);
  g.fillStyle(0x1a1a1a).fillRect(-w / 2 * P - P, -hgt * P - P, P, P).fillRect((w / 2) * P, -hgt * P - P, P, P); // round top corners
  g.fillStyle(0xb4b4c0).fillRect(-w / 2 * P, -hgt * P, w * P, P); // light top edge
  g.fillStyle(0x3a3a44).fillRect(-P, -8 * P, P, 6 * P).fillRect(-2 * P, -6 * P, 4 * P, P); // the cross
  g.fillStyle(0x2a2a30, 0.6).fillRect(-w / 2 * P - 2 * P, 0, (w + 4) * P, P); // a little dirt at its foot
  return g;
}
