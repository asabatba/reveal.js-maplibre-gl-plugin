import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: 'src/maplibre-gl.ts',
      name: 'RevealMaplibreGl',
      fileName: 'reveal-maplibre-gl',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      // Consumers are expected to have maplibre-gl bundled themselves.
      external: ['maplibre-gl'],
      output: {
        globals: {
          'maplibre-gl': 'maplibregl',
        },
      },
    },
  },
});
