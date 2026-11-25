// Bundles warden-entry.js (warden.js + the game effect code it reads + warden-icons.json) into ONE plain script dist-warden/warden.js.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  logLevel: 'warn',
  build: { outDir: here('./dist-warden'), emptyOutDir: true, lib: { entry: here('./warden-entry.js'), formats: ['iife'], name: 'SoldiaWardenBundle', fileName: () => 'warden.js' } },
});
