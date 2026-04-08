import {
  type CameraOptions,
  type FlyToOptions,
  type LayerSpecification,
  Map as MaplibreMap,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Camera position used in data-maplibre and data-maplibre-to attributes. */
export interface MapPosition {
  center?: [number, number];
  bearing?: number;
  zoom?: number;
  pitch?: number;
  /** Fly-to animation speed multiplier (default 1.2). Only used for transitions. */
  speed?: number;
  /** Fly-to animation curve (default 1.42). Only used for transitions. */
  curve?: number;
}

/**
 * GeoJSON line track spec used in the data-maplibre-trek attribute.
 * The attribute accepts a single TrekSpec or an array of TrekSpec objects.
 *
 * @example
 * data-maplibre-trek='{"url":"route.geojson","color":"#e05252","width":4}'
 * data-maplibre-trek='[{"url":"a.geojson"},{"url":"b.geojson","color":"blue"}]'
 */
export interface TrekSpec {
  url: string;
  color?: string;
  width?: number;
}

/**
 * - `'slide'` (default) — map fills the slide's bounding box.
 * - `'fullpage'` — map is fixed to the full browser viewport behind the slides.
 */
export type MapMode = 'slide' | 'fullpage';

export interface PluginOptions {
  /** MapLibre style URL or inline style spec. Defaults to MapLibre demo tiles. */
  style?: string | StyleSpecification;
  /**
   * Layout mode for map containers.
   * `'slide'` fills the slide area; `'fullpage'` covers the entire viewport.
   * Defaults to `'slide'`.
   */
  mode?: MapMode;
  /**
   * Called once per slide map after creation, before the style loads.
   * Use this to add controls or attach custom event listeners.
   */
  onMapCreated?: (map: MaplibreMap, slide: HTMLElement) => void;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface RevealSlide extends HTMLElement {
  maplibreMap?: MaplibreMap;
  /** The DOM element that hosts the MapLibre canvas. */
  maplibreContainer?: HTMLDivElement;
}

interface SlideChangedEvent extends Event {
  currentSlide: RevealSlide;
  previousSlide?: RevealSlide;
}

interface FragmentEvent extends Event {
  fragment: HTMLElement;
}

interface RevealApi {
  getConfig(): Record<string, unknown>;
  getCurrentSlide(): RevealSlide;
  addEventListener(event: string, callback: (e: Event) => void): void;
  availableFragments(): { prev: boolean; next: boolean };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_STYLE = 'https://demotiles.maplibre.org/style.json';
const DEFAULT_TREK_COLOR = '#e05252';
const DEFAULT_TREK_WIDTH = 4;
const CONTAINER_CLASS = 'maplibre-gl-container';
const STYLE_TAG_ID = 'maplibre-gl-plugin-styles';

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

function createPlugin() {
  let deck: RevealApi;
  let options: PluginOptions;

  // ---- CSS injection -------------------------------------------------------

  function injectStyles(): void {
    if (document.getElementById(STYLE_TAG_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_TAG_ID;
    // In slide mode:
    //   - overflow:hidden clips MapLibre controls at the slide edge
    //   - content siblings are lifted above the map via z-index
    style.textContent = [
      `.reveal .slides section[data-maplibre]{overflow:hidden;}`,
      `.reveal .slides section[data-maplibre]>*:not(.${CONTAINER_CLASS})`,
      `{position:relative;z-index:1;}`,
    ].join('');
    document.head.appendChild(style);
  }

  // ---- Trek helpers --------------------------------------------------------

  function parseTreks(attr: string): TrekSpec[] {
    const value = JSON.parse(attr) as TrekSpec | TrekSpec[];
    return Array.isArray(value) ? value : [value];
  }

  function addTrek(map: MaplibreMap, trek: TrekSpec): void {
    const { url, color = DEFAULT_TREK_COLOR, width = DEFAULT_TREK_WIDTH } = trek;
    if (map.getLayer(url)) return;

    const layer: LayerSpecification = {
      id: url,
      type: 'line',
      source: url,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': color, 'line-width': width },
    };

    try {
      if (!map.getSource(url)) {
        map.addSource(url, { type: 'geojson', data: url });
      }
      map.addLayer(layer);
    } catch (err) {
      console.error('[RevealMaplibreGl] addLayer error:', err);
    }
  }

  function ensureTreks(map: MaplibreMap, treks: TrekSpec[]): void {
    const add = () => { for (const t of treks) addTrek(map, t); };
    if (map.isStyleLoaded()) {
      add();
    } else {
      map.once('styledata', add);
    }
  }

  // ---- Map lifecycle -------------------------------------------------------

  function createContainer(slide: RevealSlide): HTMLDivElement {
    const container = document.createElement('div');
    container.className = CONTAINER_CLASS;

    if (options.mode === 'fullpage') {
      // Fixed to the viewport, behind everything (z-index:-1).
      // Hidden until this slide becomes active.
      container.style.cssText =
        'position:fixed;inset:0;z-index:-1;display:none;';
      document.body.prepend(container);
    } else {
      // Absolute within the slide, behind slide content (z-index:0).
      container.style.cssText = 'position:absolute;inset:0;z-index:0;';
      slide.appendChild(container);
    }

    return container;
  }

  function createMap(slide: RevealSlide): MaplibreMap {
    const container = createContainer(slide);
    slide.maplibreContainer = container;

    const map = new MaplibreMap({
      container,
      style: options.style ?? DEFAULT_STYLE,
    });

    options.onMapCreated?.(map, slide);

    // Once loaded: resize (container may have been hidden at init time)
    // and jump to position if this is the active slide.
    map.once('load', () => {
      map.resize();
      if (deck.getCurrentSlide() !== slide) return;

      const trekAttr = slide.getAttribute('data-maplibre-trek');
      if (trekAttr) ensureTreks(map, parseTreks(trekAttr));

      const position = resolveCurrentPosition();
      if (position) jumpToPosition(map, position);
    });

    return map;
  }

  function initSlides(): void {
    const slides = document.querySelectorAll<RevealSlide>('[data-maplibre]');
    for (const slide of slides) {
      slide.maplibreMap = createMap(slide);
    }

    // Show the first active map (fullpage mode needs explicit show).
    if (options.mode === 'fullpage') {
      showFullpageContainer(deck.getCurrentSlide());
    }
  }

  // ---- Fullpage container visibility ---------------------------------------

  function showFullpageContainer(currentSlide: RevealSlide): void {
    // Hide all fullpage containers.
    for (const el of document.querySelectorAll<HTMLElement>(`.${CONTAINER_CLASS}`)) {
      el.style.display = 'none';
    }
    // Show the one belonging to the active slide, if any.
    const container = currentSlide.maplibreContainer;
    if (container) {
      container.style.display = 'block';
      currentSlide.maplibreMap?.resize();
    }
  }

  // ---- Navigation ----------------------------------------------------------

  function buildCameraOptions(position: MapPosition): CameraOptions {
    return {
      center: position.center ?? [0, 0],
      bearing: position.bearing ?? 0,
      zoom: position.zoom ?? 10,
      pitch: position.pitch ?? 0,
    };
  }

  /** Instant camera move — used on first map load. */
  function jumpToPosition(map: MaplibreMap, position: MapPosition): void {
    try {
      map.jumpTo(buildCameraOptions(position));
    } catch (err) {
      console.error('[RevealMaplibreGl] jumpTo error:', err);
    }
  }

  /** Animated camera move — used for slide / fragment transitions. */
  function flyToPosition(map: MaplibreMap, position: MapPosition): void {
    const flyOptions: FlyToOptions = {
      ...buildCameraOptions(position),
      speed: position.speed ?? 1.2,
      curve: position.curve ?? 1.42,
    };
    try {
      map.flyTo(flyOptions);
    } catch (err) {
      console.error('[RevealMaplibreGl] flyTo error:', err);
    }
  }

  function resolveCurrentPosition(): MapPosition | null {
    const slide = deck.getCurrentSlide();

    // Active fragment overrides the slide-level position.
    const activeFragment = slide.querySelector<HTMLElement>(
      '.fragment.current-fragment[data-maplibre-to]',
    );
    if (activeFragment) {
      const raw = activeFragment.getAttribute('data-maplibre-to');
      return raw ? (JSON.parse(raw) as MapPosition) : null;
    }

    // All fragments done — stay put to avoid re-flying back to slide position.
    const { prev, next } = deck.availableFragments();
    if (prev && !next) return null;

    const raw = slide.getAttribute('data-maplibre');
    return raw ? (JSON.parse(raw) as MapPosition) : null;
  }

  function goCurrentMapPosition(): void {
    const slide = deck.getCurrentSlide();
    const map = slide.maplibreMap;
    if (!map) return;

    const position = resolveCurrentPosition();
    if (position) flyToPosition(map, position);
  }

  // ---- Reveal.js event handlers -------------------------------------------

  function onSlideChanged(event: Event): void {
    const { currentSlide } = event as SlideChangedEvent;

    if (options.mode === 'fullpage') {
      showFullpageContainer(currentSlide);
    }

    const map = currentSlide.maplibreMap;
    if (!map) return;

    if (options.mode !== 'fullpage') map.resize();

    const trekAttr = currentSlide.getAttribute('data-maplibre-trek');
    if (trekAttr) ensureTreks(map, parseTreks(trekAttr));

    goCurrentMapPosition();
  }

  function onFragmentShown(event: Event): void {
    const { fragment } = event as FragmentEvent;
    if (!fragment.hasAttribute('data-maplibre-to')) return;
    goCurrentMapPosition();
  }

  function onFragmentHidden(event: Event): void {
    const { fragment } = event as FragmentEvent;
    if (!fragment.hasAttribute('data-maplibre-to')) return;
    goCurrentMapPosition();
  }

  // ---- Plugin entry point --------------------------------------------------

  function init(revealDeck: RevealApi): void {
    deck = revealDeck;
    options = (deck.getConfig()['maplibre'] as PluginOptions | undefined) ?? {};

    injectStyles();
    initSlides();

    deck.addEventListener('slidechanged', onSlideChanged);
    deck.addEventListener('fragmentshown', onFragmentShown);
    deck.addEventListener('fragmenthidden', onFragmentHidden);
  }

  return {
    id: 'maplibre-gl',
    init,
    /** Returns the MapLibre map instance attached to a slide element, if any. */
    getMap(slide: HTMLElement): MaplibreMap | undefined {
      return (slide as RevealSlide).maplibreMap;
    },
  } as const;
}

export default createPlugin;
