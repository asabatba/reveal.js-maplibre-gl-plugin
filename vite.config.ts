import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: 'src/index.ts',
      fileName: (format) => `reveal-maplibre-gl.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      // Consumers are expected to have maplibre-gl bundled themselves.
      external: ['maplibre-gl'],
    },
  },
});
