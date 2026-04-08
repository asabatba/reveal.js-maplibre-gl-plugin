# reveal.js · MapLibre GL plugin

A [reveal.js](https://github.com/hakimel/reveal.js) plugin that embeds interactive [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) maps into slides. No API token required.

Built with TypeScript and bundled via Vite. Based on the original [reveal.js-mapbox-gl-plugin](https://github.com/lipov3cz3k/reveal.js-mapbox-gl-plugin) by Tomas Lipovsky.

## Installation

```bash
npm install reveal.js-maplibre-gl-plugin maplibre-gl
# or
pnpm add reveal.js-maplibre-gl-plugin maplibre-gl
```

## Usage

Import the plugin and the MapLibre CSS, then pass the plugin factory to `Reveal.initialize`:

```javascript
import createMaplibrePlugin from 'reveal.js-maplibre-gl-plugin';
import 'maplibre-gl/dist/maplibre-gl.css';

Reveal.initialize({
  plugins: [createMaplibrePlugin()],
});
```

### Plugin options

Pass options via the `maplibre` key in the Reveal config:

```javascript
Reveal.initialize({
  maplibre: {
    // Any MapLibre style URL or style spec object.
    // Defaults to the free MapLibre demo tiles.
    style: 'https://demotiles.maplibre.org/style.json',

    // 'slide' (default): map fills the slide's bounding box.
    // 'fullpage': map is fixed to the full browser viewport behind the slides.
    mode: 'slide',

    // Called once per map after creation (before the style loads).
    onMapCreated(map, slide) {
      map.addControl(new maplibregl.NavigationControl());
    },
  },
  plugins: [createMaplibrePlugin()],
});
```

## Slide configuration

### Basic map slide

Add `data-maplibre` to a `<section>` with a JSON camera position. The map fills the slide background.

```html
<section data-maplibre='{"center": [2.17, 41.38], "zoom": 12}'>
  <h2>Barcelona</h2>
</section>
```

All camera fields are optional and fall back to sensible defaults:

| Field     | Type         | Default  | Description            |
|-----------|--------------|----------|------------------------|
| `center`  | `[lon, lat]` | `[0, 0]` | Map centre             |
| `zoom`    | number       | `10`     | Zoom level             |
| `bearing` | number       | `0`      | Rotation in degrees    |
| `pitch`   | number       | `0`      | Tilt in degrees        |
| `speed`   | number       | `1.2`    | Fly-to animation speed |
| `curve`   | number       | `1.42`   | Fly-to animation curve |

### Fragment-driven camera moves

Attach `data-maplibre-to` to fragment elements to fly the camera when the fragment is shown or hidden:

```html
<section data-maplibre='{"center": [2.17, 41.38], "zoom": 12}'>
  <p class="fragment" data-maplibre-to='{"center": [2.18, 41.40], "zoom": 15, "pitch": 60}'>
    Park Güell
  </p>
  <p class="fragment" data-maplibre-to='{"center": [2.15, 41.38], "zoom": 15}'>
    Camp Nou
  </p>
</section>
```

### GeoJSON track overlay

Add `data-maplibre-trek` with a `TrekSpec` JSON object to draw a line layer on the map. Pass an array for multiple tracks.

```html
<!-- Single track -->
<section
  data-maplibre='{"center": [37.30, -0.16], "zoom": 9}'
  data-maplibre-trek='{"url": "data/route.geojson", "color": "#e05252", "width": 4}'
>
  <h2>Mt. Kenya expedition</h2>
  <p class="fragment" data-maplibre-to='{"center": [37.02, -0.17], "zoom": 14}'>
    Base camp
  </p>
</section>

<!-- Multiple tracks -->
<section
  data-maplibre='{"center": [10.0, 47.0], "zoom": 6}'
  data-maplibre-trek='[{"url": "data/day1.geojson"}, {"url": "data/day2.geojson", "color": "steelblue"}]'
></section>
```

`TrekSpec` fields:

| Field   | Type   | Default     | Description           |
|---------|--------|-------------|-----------------------|
| `url`   | string | —           | URL to a GeoJSON file |
| `color` | string | `"#e05252"` | Line colour           |
| `width` | number | `4`         | Line width in pixels  |

### Accessing the map instance

The plugin instance exposes `getMap(slideEl)` for adding custom layers or controls:

```javascript
const plugin = createMaplibrePlugin({
  onMapCreated(map, slide) {
    // called once per slide map, right after creation
    map.addControl(new maplibregl.NavigationControl());
  },
});

Reveal.initialize({ plugins: [plugin] });

// Later — e.g. in a slidechanged handler:
const map = plugin.getMap(Reveal.getCurrentSlide());
```

## Development

```bash
pnpm install
pnpm dev      # start Vite dev server with the demo presentation
pnpm build    # type-check + build the library to dist/
```

## License

MIT
