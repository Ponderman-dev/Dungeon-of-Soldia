// Hero looks (skins), no Phaser. For now a look is a STAND-IN recolour of the hero's own sprite (shop.json looks):
// coloured pixels turn by `hue` degrees and their colour is scaled by `sat`; grey armour / cloth is tinted towards
// `metal`. Skin, dark outlines and near-black stay as they are. The real looks will be new sprites (Studio).
// Also the shop's daily deals (picked from the date).

const OUTLINE_MAX_L = 0.16; // darker than this = outline, never recoloured

function toHsl(c) {
  const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const ch = (v) => Math.round((v + m) * 255);
  return (ch(r) << 16) | (ch(g) << 8) | ch(b);
}

const isSkin = (h, s, l) => h >= 15 && h <= 40 && s > 0.35 && s < 0.85 && l > 0.6;

// One colour of the look.
export function recolor(c, look) {
  const [h, s, l] = toHsl(c);
  if (l < OUTLINE_MAX_L || isSkin(h, s, l)) return c;
  if (s < 0.2) {
    if (!look.metal) return c;
    const [mh, ms] = toHsl(Number(look.metal));
    return fromHsl(mh, Math.min(1, ms * 0.8), l);
  }
  return fromHsl(h + (look.hue || 0), Math.min(1, s * (look.sat ?? 1)), l);
}

// A copy of hero `def` wearing `look` (null = the hero as is). Only part palettes change.
export function lookDef(def, look) {
  if (!look) return def;
  const parts = {};
  for (const [name, p] of Object.entries(def.parts)) {
    const art = p.art && p.art.palette ? { ...p.art, palette: p.art.palette.map((c) => '0x' + recolor(Number(c), look).toString(16).padStart(6, '0')) } : p.art;
    parts[name] = { ...p, art, ...(p.color && !p.art ? { color: '0x' + recolor(Number(p.color), look).toString(16).padStart(6, '0') } : {}) };
  }
  return { ...def, parts };
}

// Today's deals: `count` different looks picked from the day's number, each with a discount. Returns
// [{ look, discount, price }]. `day` = days since 1970 (local), so deals change at midnight.
export function dailyDeals(looks, deals, day) {
  let seed = (day * 2654435761) >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pool = looks.slice(), out = [];
  while (out.length < deals.count && pool.length) {
    const look = pool.splice(Math.floor(rnd() * pool.length), 1)[0], discount = deals.discounts[out.length % deals.discounts.length];
    out.push({ look, discount, price: Math.round((look.price * (100 - discount)) / 100 / 10) * 10 });
  }
  return out;
}

// Days since 1970 in the phone's own time zone.
export function localDay(now = new Date()) {
  return Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
}
