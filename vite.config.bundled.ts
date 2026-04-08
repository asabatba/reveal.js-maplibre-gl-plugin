import { defineConfig } from 'vite';

/**
 * Self-contained build: maplibre-gl and its CSS are bundled into the output.
 * Consumers only need to load two files:
 *   dist/reveal-maplibre-gl.bundled.js   (ES module)
 *   dist/reveal-maplibre-gl.bundled.css  (MapLibre GL styles)
 */
export default defineConfig({
  build: {
    // The lib build runs first and clears dist/; this one must not wipe it.
    emptyOutDir: false,
    lib: {
      entry: 'src/maplibre-gl.ts',
      name: 'RevealMaplibreGl',
      fileName: 'reveal-maplibre-gl.bundled',
      // ES module for <script type="module"> usage.
      // IIFE for plain <script> usage (window.RevealMaplibreGl).
      formats: ['es', 'iife'],
    },
  },
});
