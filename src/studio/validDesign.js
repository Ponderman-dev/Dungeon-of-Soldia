// Rows from the Studio page's shared store (and this browser's) are UNTRUSTED data: anyone with access can write any
// shape. These checks keep only designs the Studio (and scripts/apply-designs.mjs) can draw safely; the rest are
// skipped. No DOM, no Phaser (test: scripts/tests/studio-valid.test.mjs).

export const NAME_RE = /^[A-Za-z][A-Za-z0-9]*$/; // part names (the same rule as renaming a part in the Studio)
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const idOk = (v) => typeof v === 'string' && ID_RE.test(v) && !['__proto__', 'constructor', 'prototype'].includes(v);
const KINDS = ['hero', 'enemy', 'minion', 'item'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, lo = -1e4, hi = 1e4) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const colour = (c) => (typeof c === 'number' || typeof c === 'string') && Number.isFinite(Number(c)) && Number(c) >= 0 && Number(c) <= 0xffffff;

function validPart(p) {
  if (!isObj(p) || !num(p.x) || !num(p.y)) return false;
  if (p.anchor !== undefined && !(Array.isArray(p.anchor) && p.anchor.length === 2 && p.anchor.every((v) => num(v)))) return false;
  if (p.idle !== undefined && !isObj(p.idle)) return false;
  if (p.art !== undefined) {
    const a = p.art;
    return isObj(a) && Array.isArray(a.palette) && a.palette.length <= 36 && a.palette.every(colour)
      && Array.isArray(a.rows) && a.rows.length >= 1 && a.rows.length <= 128 && a.rows.every((r) => typeof r === 'string' && r.length <= 128);
  }
  return num(p.w, 1, 64) && num(p.h, 1, 64) && colour(p.color);
}

function validClips(anims) {
  if (anims === undefined) return true;
  if (!isObj(anims)) return false;
  return Object.entries(anims).every(([id, c]) => idOk(id) && isObj(c) && num(c.length, 1, 1e5) && (c.hitAt === undefined || num(c.hitAt, 0, 1e5))
    && isObj(c.tracks) && Object.entries(c.tracks).every(([part, props]) => NAME_RE.test(part) && isObj(props)
      && Object.values(props).every((keys) => Array.isArray(keys) && keys.every((k) => isObj(k) && num(k.t, 0, 1e5) && num(k.v, -1e5, 1e5)))));
}

// A character look { height, hover?, parts, anims? } (a saved design or a saved version).
export function validLook(d) {
  if (!isObj(d) || !num(d.height, 0, 200) || (d.hover !== undefined && !num(d.hover, 0, 400)) || !isObj(d.parts)) return false;
  const names = Object.keys(d.parts);
  return names.length >= 1 && names.length <= 64 && names.every((n) => NAME_RE.test(n) && validPart(d.parts[n])) && validClips(d.anims);
}

// A saved design row: a look plus which character it is.
export function validDesign(d) {
  return isObj(d) && KINDS.includes(d.kind) && idOk(d.id) && validLook(d);
}

// A saved effect row { group, name, speed?, colors? } (the effects editor).
export function validEffect(d) {
  return isObj(d) && idOk(d.group) && idOk(d.name)
    && (d.speed === undefined || num(d.speed, 0.05, 20)) && (d.colors === undefined || (isObj(d.colors) && Object.entries(d.colors).every(([k, v]) => colour(k) && colour(v))));
}
