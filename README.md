# reveal.js MapLibre GL plugin

A [reveal.js](https://github.com/hakimel/reveal.js) plugin for embedding interactive [MapLibre GL JS](https://maplibre.org/) maps in slides.

The package is structured for npm-first usage:

- The root package exports the plugin for bundlers and includes TypeScript declarations.
- `maplibre-gl` stays a peer dependency in the library build.
- A separate standalone bundle is published for direct browser usage.

Based on the original [reveal.js-mapbox-gl-plugin](https://github.com/lipov3cz3k/reveal.js-mapbox-gl-plugin) by Tomas Lipovsky.

## Installation

### npm / pnpm / bun

```bash
npm install reveal.js reveal.js-maplibre-gl-plugin maplibre-gl
```

```bash
pnpm add reveal.js reveal.js-maplibre-gl-plugin maplibre-gl
```

## Usage

### Bundler usage

Import the plugin from the package root and import MapLibre's CSS explicitly:

```ts
import Reveal from 'reveal.js';
import createMaplibrePlugin from 'reveal.js-maplibre-gl-plugin';
import 'maplibre-gl/dist/maplibre-gl.css';

const maplibrePlugin = createMaplibrePlugin({
  mode: 'slide',
});

Reveal.initialize({
  plugins: [maplibrePlugin],
  maplibre: {
    style: 'https://demotiles.maplibre.org/style.json',
  },
});
```

Plugin options can come from two places:

- `createMaplibrePlugin(options)` provides factory defaults.
- `Reveal.initialize({ maplibre: ... })` provides deck-level config and overrides the factory defaults.

Per-slide `data-maplibre.mode` still overrides both.

### Standalone browser usage

Use the published standalone assets when you want to load the plugin directly in the browser:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@6/dist/reveal.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@6/dist/theme/black.css">
<link rel="stylesheet" href="https://unpkg.com/reveal.js-maplibre-gl-plugin/dist/reveal-maplibre-gl.bundled.css">

<script src="https://cdn.jsdelivr.net/npm/reveal.js@6/dist/reveal.js"></script>
<script type="module">
  import createMaplibrePlugin from 'https://unpkg.com/reveal.js-maplibre-gl-plugin/dist/reveal-maplibre-gl.bundled.js';

  Reveal.initialize({
    plugins: [createMaplibrePlugin()],
    maplibre: {
      style: 'https://demotiles.maplibre.org/style.json',
    },
  });
</script>
```

For a plain `<script>` flow, the bundled IIFE also exposes `window.RevealMaplibreGl`.

## Plugin API

### `createMaplibrePlugin(options?: PluginOptions)`

Creates a reveal.js plugin instance.

```ts
import type { PluginOptions } from 'reveal.js-maplibre-gl-plugin';
```

`PluginOptions`:

| Field | Type | Description |
| --- | --- | --- |
| `style` | `string \| StyleSpecification` | MapLibre style URL or inline style spec. Defaults to the MapLibre demo style. |
| `mode` | `'slide' \| 'fullpage'` | Default layout mode for maps in the deck. |
| `onMapCreated` | `(map, slide) => void` | Called once per slide map after creation. |

The plugin instance exposes:

- `id`
- `init(reveal)`
- `destroy()`
- `getMap(slideEl)`

## Slide configuration

### Basic slide

```html
<section data-maplibre='{"center":[2.17,41.38],"zoom":12}'>
  <h2>Barcelona</h2>
</section>
```

### Per-slide mode override

```html
<section data-maplibre='{"center":[2.17,41.38],"zoom":12,"mode":"fullpage"}'>
  <h2>Barcelona</h2>
</section>
```

### Fragment-driven camera moves

```html
<section data-maplibre='{"center":[2.17,41.38],"zoom":12}'>
  <p class="fragment" data-maplibre-to='{"center":[2.18,41.40],"zoom":15,"pitch":60}'>
    Park Guell
  </p>
  <p class="fragment" data-maplibre-to='{"center":[2.15,41.38],"zoom":15}'>
    Camp Nou
  </p>
</section>
```

### GeoJSON track overlay

```html
<section
  data-maplibre='{"center":[37.30,-0.16],"zoom":9}'
  data-maplibre-trek='{"url":"data/route.geojson","color":"#e05252","width":4}'
>
  <h2>Route</h2>
</section>
```

`data-maplibre` supports these fields:

| Field | Type | Default |
| --- | --- | --- |
| `center` | `[lon, lat]` | `[0, 0]` |
| `zoom` | `number` | `10` |
| `bearing` | `number` | `0` |
| `pitch` | `number` | `0` |
| `speed` | `number` | `1.2` |
| `curve` | `number` | `1.42` |
| `mode` | `'slide' \| 'fullpage'` | Deck `maplibre.mode` or `'slide'` |

`data-maplibre-trek` accepts either one `TrekSpec` or an array:

| Field | Type | Default |
| --- | --- | --- |
| `url` | `string` | required |
| `color` | `string` | `#e05252` |
| `width` | `number` | `4` |

## Development

```bash
pnpm install
pnpm dev
pnpm check
pnpm build
pnpm pack:check
```

The build emits:

- `dist/reveal-maplibre-gl.js` for ESM consumers
- `dist/reveal-maplibre-gl.cjs` for CommonJS consumers
- `dist/index.d.ts` and related declaration files
- `dist/reveal-maplibre-gl.bundled.js` and `dist/reveal-maplibre-gl.bundled.iife.js` for standalone browser usage
- `dist/reveal-maplibre-gl.bundled.css` for the standalone bundle

## License

MIT
