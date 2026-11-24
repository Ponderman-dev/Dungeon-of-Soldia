// Bundles hits-entry.js (hits.js + the game's effect code it reads) into ONE plain script dist-hits/hits.js.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  logLevel: 'warn',
  build: { outDir: here('./dist-hits'), emptyOutDir: true, lib: { entry: here('./hits-entry.js'), formats: ['iife'], name: 'SoldiaHitsBundle', fileName: () => 'hits.js' } },
});
