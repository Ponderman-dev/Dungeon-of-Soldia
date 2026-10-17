// Bundles fx-entry.js (effect stage + proposed recipes) into ONE plain script dist/fx.js for the proposal page.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  logLevel: 'warn',
  build: { outDir: here('./dist'), emptyOutDir: true, lib: { entry: here('./fx-entry.js'), formats: ['iife'], name: 'SoldiaFxProposal', fileName: () => 'fx.js' } },
});
