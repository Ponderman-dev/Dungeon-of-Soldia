// Bundles projectiles-entry.js (projectiles.js + the game's effect code it reads) into ONE plain script dist-shots/shots.js.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  logLevel: 'warn',
  build: { outDir: here('./dist-shots'), emptyOutDir: true, lib: { entry: here('./projectiles-entry.js'), formats: ['iife'], name: 'SoldiaShotsBundle', fileName: () => 'shots.js' } },
});
