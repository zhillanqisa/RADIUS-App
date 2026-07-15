# RADIUS map engine migration: Leaflet → MapLibre GL JS (3D)

Date: 2026-07-15
Status: approved design → implementation planning

## Goal

Replace the RADIUS map engine from Leaflet (2D raster tiles) with MapLibre GL JS
so the map is 3D: buildings extruded as grey blocks (from footprint + height) and
the camera can pitch/rotate — like Google Maps 3D but grey blocks, not textured
photorealistic (that needs a paid Google API).

Tiles: **OpenFreeMap** (https://openfreemap.org) vector tiles — public, no signup,
no API key, no card. OpenMapTiles schema exposes `building` source-layer with
`render_height` / `render_min_height` for extrusion.

## Scope boundary

- **Only `#map` engine changes.** Backend (`app/`) is zero-touch → pytest 44 stays
  green (`.venv\Scripts\python.exe -m pytest -q`).
- Panel / dock / bottom-sheet layout unchanged — only the map area swaps engine.
- **Preserved untouched:** all contract element ids (`search-input`,
  `duration-group`, `score-num`, `category-list`, …), API contract
  (`/api/analyze`, `/api/geocode`, `/api/config`), i18n `t()`, POI "arahin"
  feature (`wirePoiPopup`, `openDirections`, `getUserLocation` — 2 buttons:
  from point / from GPS → Google Maps walking), Capacitor Geolocation plugin,
  mobile bottom-sheet, PWA (manifest + service worker).

## Basemap + dark-mode decision

OpenFreeMap serves complete styles at `https://tiles.openfreemap.org/styles/{name}`.
Verified facts (fetched 2026-07-15):

- `liberty`: has a `building-3d` fill-extrusion layer (source-layer `building`,
  `fill-extrusion-height=["get","render_height"]`,
  `fill-extrusion-base=["get","render_min_height"]`). Source `openmaptiles` →
  `https://tiles.openfreemap.org/planet`. Glyphs `…/fonts/{fontstack}/{range}.pbf`,
  sprite `…/sprites/ofm_f384/ofm` — hosted, so pointing MapLibre at the style URL
  needs no self-hosted fonts.
- `dark`: exists (`background rgb(12,12,12)`), same hosted glyphs/sprites, but its
  building layer is flat `fill` — **no** extrusion.

**Chosen strategy (hybrid):** bases `liberty` (light) ↔ `dark` (dark) for
professional theming with zero hand-tuning, but **we own a single
`radius-buildings` fill-extrusion layer in both themes** and hide the base's
built-in `building-3d` when present (avoid double-draw). Gives guaranteed grey
blocks with per-theme color and one uniform re-add routine.

Rejected alternatives:
- Recolor liberty for dark via `setPaintProperty`: liberty has ~100 layers;
  darkening a curated dozen leaves the rest light and broken. Fragile.
- positron ↔ dark: viable and uniform, but liberty light reads closer to the
  "Google Maps 3D" target.

## Architecture

Vanilla JS, no build step. All map code stays in `web/js/app.js`.

### Vendoring
- Download `maplibre-gl@4` dist `maplibre-gl.js` + `maplibre-gl.css` from unpkg
  into `web/vendor/maplibre/`.
- `web/index.html`: replace the two Leaflet `<link>`/`<script>` tags with the
  MapLibre css/js tags (css in `<head>`, js before `js/app.js`).
- Retire `web/vendor/leaflet/` (delete dir).

### Constants
```
const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty";
const STYLE_DARK  = "https://tiles.openfreemap.org/styles/dark";
```
Remove `TILE_LIGHT` / `TILE_DARK` raster constants.

### Map init
```
const map = new maplibregl.Map({
  container: "map",
  style: isDark() ? STYLE_DARK : STYLE_LIGHT,
  center: [107.6098, -6.9147],   // NOTE: MapLibre is [lng, lat]
  zoom: 15, pitch: 45, bearing: 0,
  attributionControl: true,
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
```

### `addCustomLayers()` — idempotent, runs on initial `load` and after each
`setStyle` (bound via `map.on("styledata", …)` guarded so it only fires once the
new style's base layers exist):
1. If layer `building-3d` exists → `setLayoutProperty("building-3d","visibility","none")`.
2. Add `radius-buildings` fill-extrusion: source `openmaptiles`, source-layer
   `building`, `fill-extrusion-height ["get","render_height"]`,
   `fill-extrusion-base ["get","render_min_height"]`,
   `fill-extrusion-color` grey per theme, `fill-extrusion-opacity` ~0.85,
   filter `["has","render_height"]`. Insert below the first symbol (label) layer so
   labels stay on top.
3. Add isochrone: source `iso` (empty GeoJSON) + fill layer (accent,
   `fill-opacity 0.13`) + line layer (accent, width 2).
4. Add POI: source `poi` (empty GeoJSON) + circle layer `poi-circles`
   (`circle-color` = `["match",["get","category"], "warung_minimarket", <var>, …]`,
   radius 6, white/dark stroke 1.5).
5. Re-apply latest data: if `state.lastData`, call `setIsochrone`/`setPois` with it
   so a theme swap does not blank the map.

Layer/source add order and the "insert before first symbol layer" rule keep
extrusions under labels and isochrone/POI above buildings.

### Isochrone + POI update (per analysis)
- `map.getSource("iso").setData({type:"Feature", geometry:data.isochrone})`.
- `map.getSource("poi").setData(featureCollection(data.pois))` where each feature
  carries `{category, name, lat, lon, id}` in properties.
- POI popup: `poi-circles` `click` handler → build popup DOM node (same markup as
  today), `new maplibregl.Popup().setLngLat([lon,lat]).setDOMContent(node).addTo(map)`,
  then `wirePoiPopup(node, poi, meta)` — **wirePoiPopup / openDirections /
  getUserLocation unchanged**. `mouseenter/mouseleave` on the layer toggles
  `map.getCanvas().style.cursor`.
- General `map.on("click")` (choose analysis point): if
  `map.queryRenderedFeatures(e.point,{layers:["poi-circles"]}).length` → return
  (let the POI handler own it); else run analysis with `e.lngLat.lat/lng`.

### Center pin
`maplibregl.Marker({ element: div.center-pin, anchor:"center" })` — reuses the
existing `.center-pin` CSS; markers are not style-owned so they survive `setStyle`
(no re-add needed). Keep `centerMarker`, `.remove()` + recreate on move.

### fitBounds
Compute bbox by walking the isochrone geometry coordinates (Polygon /
MultiPolygon) → `[[minLng,minLat],[maxLng,maxLat]]`, then
`map.fitBounds(bbox, { padding, duration })`. Padding is a pixel object:
- desktop (`min-width:901px`): `{ top:84, left:462, right:40, bottom:40 }`
- mobile view peta: `{ top:132, left:24, right:24, bottom: round(innerHeight*0.44) }`
- else: `{ top:26, right:26, bottom:26, left:26 }`
Pitch/bearing preserved (fitBounds keeps current camera angle).

### Theme swap
`applyTheme()`:
- `map.setStyle(isDark() ? STYLE_DARK : STYLE_LIGHT)` (only if the map's current
  style differs — avoid needless reload).
- `styledata` handler re-runs `addCustomLayers()` (which re-adds buildings/iso/POI
  and re-applies `state.lastData`).
- Still `renderResult(state.lastData, {refetchDock:false})` for inline colors
  (band/category icons) as today.
- Building + isochrone grey/accent swapped per theme for contrast.

### CSS (`web/css/app.css`)
- `.leaflet-container` → `.maplibregl-map { font-family: inherit }`.
- `.leaflet-popup-content-wrapper` radius+shadow → `.maplibregl-popup-content`
  (add `padding` reset), `.maplibregl-popup-tip` border color per theme.
- `.leaflet-bar` control border/shadow → `.maplibregl-ctrl-group`.
- Keep `.poi-popup`, `.poi-*`, `.center-pin`.
- Drop `.iso-shape` fade keyframe usage (a GL layer can't take a CSS class); if a
  fade is wanted, animate `fill-opacity` via paint — out of scope, skip.
- Dark-mode overrides for popup/tip/ctrl colors under `[data-theme=dark]` and
  `prefers-color-scheme:dark`.

## Risk / verification notes

- WebGL in the Android WebView / Pixel emulator: MapLibre needs WebGL. Verify it
  renders in the emulator (SwiftShader/hardware GL). If broken, note it — do not
  silently ship.
- Service worker: MapLibre js/css are vendored (cacheable like Leaflet was);
  tiles/glyphs/sprites come from OpenFreeMap CDN over network — same online
  requirement Leaflet+CARTO had. PWA parity preserved.
- Capacitor `capacitor.config.json` stays `10.0.2.2:8000` for the emulator; the
  WebView still reaches openfreemap.org over the internet.

## Verification checklist (no assumptions)

1. `.venv\Scripts\python.exe -m pytest -q` → 44 pass (backend untouched).
2. Start server (`uvicorn app.server:app --host 127.0.0.1 --port 8000`) + Pixel
   emulator (`D:\Sdk\emulator\emulator.exe -avd Pixel_10_Pro_XL`,
   `JAVA_HOME=C:\Program Files\Android\Android Studio\jbr`).
3. Via chrome-devtools MCP / CDP over `webview_devtools_remote`:
   - 3D buildings extruded + camera pitched.
   - Analyze Antapani → isochrone fill + POI circles render.
   - Click a POI → MapLibre popup with 2 "arahin" buttons; both open Google Maps
     walking dir.
   - Dark toggle swaps style, buildings/iso re-appear with contrast, no blank map.
   - Mobile view: fitBounds leaves bottom-sheet room.
   - Zero console errors.
4. Commit per part → push `origin/main` (github.com/zhillanqisa/RADIUS-App).

## Out of scope (YAGNI)
- Offline vector tiles / self-hosted OpenFreeMap.
- 3D terrain, sky layer, building textures.
- Isochrone fade-in animation.
- maplibre-gl v5 (spec pins v4).
