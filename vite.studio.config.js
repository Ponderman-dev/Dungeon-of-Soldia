// Builds the Character Studio page (studio.html) on its own, into dist-studio/.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist-studio',
    rollupOptions: { input: 'studio.html' },
  },
});
