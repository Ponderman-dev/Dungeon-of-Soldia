// Bundles entry.js (demo.js + the game data and effect code it reads) into ONE plain script dist/demo.js.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  logLevel: 'warn',
  build: { outDir: here('./dist'), emptyOutDir: true, lib: { entry: here('./entry.js'), formats: ['iife'], name: 'SoldiaSkillDemoBundle', fileName: () => 'demo.js' } },
});
