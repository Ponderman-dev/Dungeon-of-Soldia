// PICTURE MEMORY (session 51): character part pictures (`px-...`, Character.texture) are made once and kept, one per
// look / status tint / ice height. Over a long run that only grows, so after each boss floor the ones no object on any
// running scene uses are thrown away; Character.texture simply makes them again if they come back.

// Every texture key used by a game object on a display list (containers looked into).
function usedKeys(game) {
  const used = new Set();
  const visit = (o) => {
    if (o.texture && o.texture.key) used.add(o.texture.key);
    if (o.list) for (const c of o.list) visit(c);
  };
  for (const scene of game.scene.getScenes(false)) if (scene.children) for (const o of scene.children.list) visit(o);
  return used;
}

// Removes the unused textures whose key starts with one of `prefixes`. Returns how many went.
export function pruneTextures(game, prefixes = ['px-']) {
  const used = usedKeys(game);
  let n = 0;
  for (const key of Object.keys(game.textures.list)) {
    if (!prefixes.some((p) => key.startsWith(p)) || used.has(key)) continue;
    game.textures.remove(key);
    n++;
  }
  return n;
}
