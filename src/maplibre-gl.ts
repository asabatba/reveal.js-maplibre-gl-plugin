import {
  type CameraOptions,
  type FitBoundsOptions,
  type FlyToOptions,
  type LayerSpecification,
  type LngLatBoundsLike,
  Map as MaplibreMap,
  type StyleSpecification,
} from 'maplibre-gl';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Camera position used in data-maplibre and data-maplibre-to attributes. */
export interface MapPosition {
  center?: [number, number];
  bearing?: number;
  zoom?: number;
  pitch?: number;
  /** Bounds to fit instead of using a single center/zoom camera position. */
  bounds?: LngLatBoundsLike;
  /** Extra MapLibre fitBounds options applied when `bounds` is present. */
  fitBoundsOptions?: FitBoundsOptions;
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

export interface SlideMapConfig extends MapPosition {
  /** Optional per-slide override for the plugin's global layout mode. */
  mode?: MapMode;
}

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
  removeEventListener?(event: string, callback: (e: Event) => void): void;
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
let activePluginCount = 0;

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

function mergeOptions(
  defaults: PluginOptions,
  revealConfig: PluginOptions | undefined,
): PluginOptions {
  return {
    ...defaults,
    ...revealConfig,
  };
}

function createPlugin(factoryOptions: PluginOptions = {}) {
  let deck: RevealApi;
  let options: PluginOptions = { ...factoryOptions };
  let destroyed = false;
  const managedSlides = new Set<RevealSlide>();
  let onReady: ((e: Event) => void) | undefined;

  // ---- CSS injection -------------------------------------------------------

  function injectStyles(): void {
    const existing = document.getElementById(STYLE_TAG_ID);
    if (!existing) {
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

    activePluginCount += 1;
  }

  function releaseStyles(): void {
    activePluginCount = Math.max(0, activePluginCount - 1);
    if (activePluginCount > 0) return;
    document.getElementById(STYLE_TAG_ID)?.remove();
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
    if (map.isStyleLoaded()) add();
    else map.once('styledata', add);
  }

  // ---- Map lifecycle -------------------------------------------------------

  function parseSlideMapConfig(slide: RevealSlide): SlideMapConfig | null {
    const raw = slide.getAttribute('data-maplibre');
    return raw ? (JSON.parse(raw) as SlideMapConfig) : null;
  }

  function resolveMapMode(slide: RevealSlide): MapMode {
    return parseSlideMapConfig(slide)?.mode ?? options.mode ?? 'slide';
  }

  function createContainer(slide: RevealSlide): HTMLDivElement {
    const container = document.createElement('div');
    container.className = CONTAINER_CLASS;

    if (resolveMapMode(slide) === 'fullpage') {
      container.style.cssText = 'position:fixed;inset:0;z-index:-1;display:none;';
      document.body.prepend(container);
    } else {
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

    return map;
  }

  function initSlides(): void {
    const slides = document.querySelectorAll<RevealSlide>('[data-maplibre]');
    for (const slide of slides) {
      managedSlides.add(slide);
      slide.maplibreMap = createMap(slide);
    }
  }

  // ---- Active-slide activation ---------------------------------------------

  /**
   * Make the map for `slide` fill its container and jump/fly to the correct
   * camera position. Pass `animate: true` for slide-change transitions.
   *
   * If the container has no layout size yet (slide still display:none while
   * Reveal transitions it in), a ResizeObserver defers the work until the
   * browser has computed real dimensions.
   */
  function activateSlide(slide: RevealSlide, animate = false): void {
    if (resolveMapMode(slide) === 'fullpage') {
      for (const el of document.querySelectorAll<HTMLElement>(`.${CONTAINER_CLASS}`)) {
        el.style.display = 'none';
      }
      if (slide.maplibreContainer) slide.maplibreContainer.style.display = 'block';
    }

    const map = slide.maplibreMap;
    const container = slide.maplibreContainer;
    if (!map || !container) return;

    const applyCamera = () => {
      map.resize();
      const trekAttr = slide.getAttribute('data-maplibre-trek');
      if (trekAttr) ensureTreks(map, parseTreks(trekAttr));
      const position = resolveCurrentPosition();
      if (!position) return;
      if (animate) flyToPosition(map, position);
      else jumpToPosition(map, position);
    };

    if (container.offsetWidth > 0) {
      applyCamera();
    } else {
      // Container is not yet laid out (Reveal.js is still transitioning the
      // slide in from display:none). Wait for the first non-zero size.
      const ro = new ResizeObserver(() => {
        if (container.offsetWidth === 0) return;
        ro.disconnect();
        applyCamera();
      });
      ro.observe(container);
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

  function buildFitBoundsOptions(position: MapPosition): FitBoundsOptions {
    return {
      ...position.fitBoundsOptions,
      bearing: position.bearing ?? position.fitBoundsOptions?.bearing ?? 0,
      pitch: position.pitch ?? position.fitBoundsOptions?.pitch ?? 0,
    };
  }

  function jumpToPosition(map: MaplibreMap, position: MapPosition): void {
    try {
      if (position.bounds) {
        map.fitBounds(position.bounds, {
          ...buildFitBoundsOptions(position),
          duration: 0,
        });
        return;
      }
      map.jumpTo(buildCameraOptions(position));
    } catch (err) {
      console.error('[RevealMaplibreGl] jumpTo error:', err);
    }
  }

  function flyToPosition(map: MaplibreMap, position: MapPosition): void {
    if (position.bounds) {
      try {
        map.fitBounds(position.bounds, {
          ...buildFitBoundsOptions(position),
          speed: position.speed ?? position.fitBoundsOptions?.speed ?? 1.2,
          curve: position.curve ?? position.fitBoundsOptions?.curve ?? 1.42,
        });
      } catch (err) {
        console.error('[RevealMaplibreGl] fitBounds error:', err);
      }
      return;
    }

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

    return parseSlideMapConfig(slide);
  }

  // ---- Reveal.js event handlers -------------------------------------------

  function onSlideChanged(event: Event): void {
    const { currentSlide } = event as SlideChangedEvent;
    activateSlide(currentSlide, true);
  }

  function onFragmentShown(event: Event): void {
    const { fragment } = event as FragmentEvent;
    if (!fragment.hasAttribute('data-maplibre-to')) return;
    const map = deck.getCurrentSlide().maplibreMap;
    if (!map) return;
    const position = resolveCurrentPosition();
    if (position) flyToPosition(map, position);
  }

  function onFragmentHidden(event: Event): void {
    const { fragment } = event as FragmentEvent;
    if (!fragment.hasAttribute('data-maplibre-to')) return;
    const map = deck.getCurrentSlide().maplibreMap;
    if (!map) return;
    const position = resolveCurrentPosition();
    if (position) flyToPosition(map, position);
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;

    deck.removeEventListener?.('slidechanged', onSlideChanged);
    deck.removeEventListener?.('fragmentshown', onFragmentShown);
    deck.removeEventListener?.('fragmenthidden', onFragmentHidden);
    if (onReady) deck.removeEventListener?.('ready', onReady);

    for (const slide of managedSlides) {
      slide.maplibreMap?.remove();
      slide.maplibreMap = undefined;
      slide.maplibreContainer?.remove();
      slide.maplibreContainer = undefined;
    }
    managedSlides.clear();

    releaseStyles();
  }

  // ---- Plugin entry point --------------------------------------------------

  function init(revealDeck: RevealApi): void {
    deck = revealDeck;
    const revealConfig = deck.getConfig().maplibre as PluginOptions | undefined;
    options = mergeOptions(factoryOptions, revealConfig);
    destroyed = false;

    injectStyles();
    initSlides();

    deck.addEventListener('slidechanged', onSlideChanged);
    deck.addEventListener('fragmentshown', onFragmentShown);
    deck.addEventListener('fragmenthidden', onFragmentHidden);

    // 'ready' fires after Reveal has finished its own layout — this is the
    // correct moment to resize and position the first slide's map.
    // Using a map.loaded() guard ensures we only act once the style is ready;
    // if load hasn't fired yet, the map.once('load') handler above will cover it.
    onReady = () => {
      const slide = deck.getCurrentSlide();
      const map = slide.maplibreMap;
      if (map?.loaded()) {
        activateSlide(slide);
      } else {
        // Style still loading — wire up a one-shot handler so activation
        // happens as soon as the map is ready (after Reveal layout is stable).
        map?.once('load', () => activateSlide(slide));
      }
    };
    deck.addEventListener('ready', onReady);
  }

  return {
    id: 'maplibre-gl',
    init,
    destroy,
    getMap(slide: HTMLElement): MaplibreMap | undefined {
      return (slide as RevealSlide).maplibreMap;
    },
  } as const;
}

export default createPlugin;
