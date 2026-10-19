// A pixel layer ({ w, h, pixels: 0xrrggbb or -1, optional alpha }) as a texture, made once per key.
export function layerTexture(scene, key, lay) {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, lay.w, lay.h);
  const img = tex.context.createImageData(lay.w, lay.h);
  lay.pixels.forEach((c, i) => {
    if (c < 0) return;
    img.data[i * 4] = (c >> 16) & 255;
    img.data[i * 4 + 1] = (c >> 8) & 255;
    img.data[i * 4 + 2] = c & 255;
    img.data[i * 4 + 3] = lay.alpha ? Math.round(lay.alpha[i] * 255) : 255;
  });
  tex.context.putImageData(img, 0, 0);
  tex.refresh();
  return key;
}
