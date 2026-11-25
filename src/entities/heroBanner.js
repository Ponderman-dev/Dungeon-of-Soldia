// Hero banners (session 57): one small pixel scene per hero (src/assets/banners/<heroId>.png, 113x59, drawn by
// docs/proposals/hero-banners/make-banners.py), shown at a whole-number scale on the Heroes page. Files are packed
// into the game code (Vite `?inline`, like the sounds): no fetch, so the one-file preview page has them too.
const files = import.meta.glob('../assets/banners/*.png', { eager: true, query: '?inline', import: 'default' });

export const hasBanner = (id) => !!files[`../assets/banners/${id}.png`];

// The banner of hero `id` with its top-left at (x, y), `scale` x, cropped to at most `maxW` x `maxH` screen px.
// Returns the Image (empty until the picture is decoded the first time; then it shows by itself).
export function heroBanner(scene, id, x, y, scale, maxW, maxH) {
  const key = 'banner_' + id, url = files[`../assets/banners/${id}.png`];
  const img = scene.add.image(x, y, '__MISSING').setOrigin(0).setScale(scale).setVisible(false);
  const show = () => {
    if (!img.scene) return; // the page was closed before the picture was ready
    img.setTexture(key).setVisible(true);
    img.setCrop(0, 0, Math.min(img.frame.width, Math.floor(maxW / scale)), Math.min(img.frame.height, Math.floor(maxH / scale)));
  };
  if (!url) return img;
  if (scene.textures.exists(key)) show();
  else {
    const el = new Image();
    el.onload = () => { if (!scene.textures.exists(key)) scene.textures.addImage(key, el); show(); };
    el.src = url;
  }
  return img;
}
