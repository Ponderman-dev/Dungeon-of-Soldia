// Bundles fx-entry.js into ONE plain script (docs/proposals/item-review/dist/fx.js) for the item review page.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  logLevel: 'warn',
  build: {
    outDir: here('./dist'),
    emptyOutDir: true,
    lib: { entry: here('./fx-entry.js'), formats: ['iife'], name: 'SoldiaFxBundle', fileName: () => 'fx.js' },
  },
});
