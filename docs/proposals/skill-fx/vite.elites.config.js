// Bundles elites-entry.js (elites.js + the game's effect code it reads) into ONE plain script dist-elites/hits.js.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  logLevel: 'warn',
  build: { outDir: here('./dist-elites'), emptyOutDir: true, lib: { entry: here('./elites-entry.js'), formats: ['iife'], name: 'SoldiaElitesBundle', fileName: () => 'elites.js' } },
});
