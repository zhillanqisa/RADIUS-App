# MapLibre GL 3D Map Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace RADIUS's Leaflet 2D raster map with MapLibre GL JS so the map renders extruded grey 3D buildings and supports pitch/rotate, using keyless OpenFreeMap vector tiles.

**Architecture:** All map code lives in `web/js/app.js`. A single `addCustomLayers()` routine (run on `load` and after each `setStyle`) hides the base style's `building-3d`, adds our own `radius-buildings` fill-extrusion + isochrone (`iso`) + POI (`poi`) GeoJSON sources/layers, and re-applies the last analysis so a theme swap never blanks the map. Isochrone/POI update via `source.setData`. Bases: OpenFreeMap `liberty` (light) ↔ `dark` (dark).

**Tech Stack:** Vanilla JS (no build step), MapLibre GL JS v4 (vendored), OpenFreeMap CDN (styles + tiles + glyphs + sprites, keyless), FastAPI static host (unchanged).

## Global Constraints

- **Backend zero-touch.** No file under `app/` changes. `.venv\Scripts\python.exe -m pytest -q` must stay **44 passed** after every task.
- **MapLibre GL JS v4** (not v5). Download from `https://unpkg.com/maplibre-gl@4/dist/`.
- **Keyless only.** No API key, no account, no card. Style/tiles/glyphs/sprites hotlinked from `tiles.openfreemap.org`.
- **MapLibre coordinate order is `[lng, lat]`** (Leaflet was `[lat, lng]`). Every coordinate conversion must flip.
- **Preserve unchanged:** all contract element ids (`search-input`, `duration-group`, `score-num`, `category-list`, …), API contract (`/api/analyze`, `/api/geocode`, `/api/config`), `t()` i18n, POI "arahin" functions `wirePoiPopup` / `openDirections` / `getUserLocation` (2 buttons), Capacitor Geolocation plugin, mobile bottom-sheet, PWA manifest.
- **Style URLs:** `STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty"`, `STYLE_DARK = "https://tiles.openfreemap.org/styles/dark"`.
- **fitBounds paddings** (pixels), copied from current Leaflet values: desktop `{top:84,left:462,right:40,bottom:40}`; mobile view peta `{top:132,left:24,right:24,bottom:round(innerHeight*0.44)}`; else `{top:26,right:26,bottom:26,left:26}`.

**Note on testing:** this repo has **no frontend test runner** (tests are pytest/backend only). Adding one is out of scope. Each frontend task is verified by (a) pytest staying green as a guardrail, and (b) concrete browser observations via the chrome-devtools MCP against a running server. Verification steps below give exact expressions and expected results.

---

### Task 1: Vendor MapLibre, retire Leaflet, wire index.html + sw.js

**Files:**
- Create: `web/vendor/maplibre/maplibre-gl.js`, `web/vendor/maplibre/maplibre-gl.css`
- Delete: `web/vendor/leaflet/` (whole dir)
- Modify: `web/index.html` (lines ~20, ~277), `web/sw.js` (lines 6, 15-16, 43)

**Interfaces:**
- Produces: global `maplibregl` (from vendored js) + `maplibre-gl.css` loaded in `<head>`; sw precache updated. Consumed by Task 2 (`new maplibregl.Map`) and Task 3 (CSS class names).

- [ ] **Step 1: Download MapLibre v4 dist into the vendor folder**

Run (Git Bash):
```bash
cd "D:/Collage/Radius-APP/.claude/worktrees/adoring-poincare-c2ef35"
mkdir -p web/vendor/maplibre
curl -fSL https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js  -o web/vendor/maplibre/maplibre-gl.js
curl -fSL https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css -o web/vendor/maplibre/maplibre-gl.css
```

- [ ] **Step 2: Verify the download is real (not an error page)**

Run (Git Bash):
```bash
ls -la web/vendor/maplibre/
head -c 120 web/vendor/maplibre/maplibre-gl.js
```
Expected: `maplibre-gl.js` is > 500 KB, `maplibre-gl.css` is > 20 KB, and the js head shows a JS/UMD banner mentioning `maplibre-gl` (a MapLibre license/version comment), **not** HTML like `<!DOCTYPE`.

- [ ] **Step 3: Swap the Leaflet CSS link for MapLibre in `web/index.html`**

Replace line 20:
```html
  <link rel="stylesheet" href="vendor/leaflet/leaflet.css">
```
with:
```html
  <link rel="stylesheet" href="vendor/maplibre/maplibre-gl.css">
```

- [ ] **Step 4: Swap the Leaflet script tag for MapLibre in `web/index.html`**

Replace line 277:
```html
<script src="vendor/leaflet/leaflet.js"></script>
```
with:
```html
<script src="vendor/maplibre/maplibre-gl.js"></script>
```

- [ ] **Step 5: Update the service worker precache list and tile bypass in `web/sw.js`**

Change the cache name (line 6) from:
```js
const CACHE = "radius-shell-v1";
```
to:
```js
const CACHE = "radius-shell-v2";
```

Replace the two Leaflet entries in `SHELL` (lines 15-16):
```js
  "/vendor/leaflet/leaflet.css",
  "/vendor/leaflet/leaflet.js",
```
with:
```js
  "/vendor/maplibre/maplibre-gl.css",
  "/vendor/maplibre/maplibre-gl.js",
```

Change the tile-bypass host check (line 43) from:
```js
  if (url.pathname.startsWith("/api/") || url.hostname.includes("cartocdn")) {
```
to:
```js
  if (url.pathname.startsWith("/api/") || url.hostname.includes("openfreemap")) {
```

- [ ] **Step 6: Remove the vendored Leaflet directory from git**

Run (Git Bash):
```bash
git rm -r web/vendor/leaflet
```
Expected: git lists `leaflet.css`, `leaflet.js`, and the 5 `images/*.png` as removed.

- [ ] **Step 7: Confirm no other references to Leaflet remain besides `app.js`**

Run (Git Bash):
```bash
grep -rn "leaflet\|L\.map\|L\.tileLayer\|L\.geoJSON\|L\.circleMarker\|L\.marker\|L\.divIcon\|L\.point\|L\.control\|L\.layerGroup" web/ --include=*.html --include=*.js --include=*.css | grep -v "web/js/app.js"
```
Expected: **no output** (every remaining Leaflet reference is inside `web/js/app.js`, which Task 2 rewrites).

- [ ] **Step 8: Commit**

```bash
git add web/vendor/maplibre web/index.html web/sw.js
git commit -m "build: vendor MapLibre GL v4, retire Leaflet assets

Add maplibre-gl v4 js+css, point index.html and the service worker
precache at them, bypass caching for openfreemap tiles. app.js still
references Leaflet globals; rewritten in the next task."
```

---

### Task 2: Rewrite the map engine in `web/js/app.js` (Leaflet → MapLibre)

**Files:**
- Modify: `web/js/app.js` (map constants ~26-27; map block ~155-184; `applyTheme` ~107-112; `renderResult` map section ~513-570; `applyView` ~208-211; `runAnalysis`/`init`/`doSearch` `setView` calls; `map.on("click")` ~169-176)

**Interfaces:**
- Consumes: global `maplibregl` (Task 1); existing `CATEGORY_META`, `state`, `cssVal`, `isDark`, `isDesktop`, `REDUCED_MOTION`, `t`, `wirePoiPopup`, `renderResult`.
- Produces: `map` (MapLibre `Map`), `addCustomLayers()`, `setIsochrone(geometry)`, `setPois(pois)`, `setCenterMarker(lat,lon)`, `fitIsochrone(geometry)`, helpers `geomBounds`, `poiFeatures`, `circleColorExpr`, `firstSymbolId`. Layer ids: `radius-buildings`, `iso-fill`, `iso-line`, `poi-circles`. Source ids: `iso`, `poi`.

- [ ] **Step 1: Replace the raster tile constants with style URLs**

Replace lines 26-27:
```js
const TILE_LIGHT = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
```
with:
```js
const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
const EMPTY_FC = { type: "FeatureCollection", features: [] };
// warna balok gedung 3D (di-refresh saat re-add layer pada ganti tema)
const BUILDING_LIGHT = "#c9ccce";
const BUILDING_DARK = "#3a4550";
```

- [ ] **Step 2: Replace the Leaflet map init + tileLayer + layer groups (lines 153-184) with the MapLibre map, helpers, and custom-layer routine**

Replace the whole block from the `/* ---------- map ---------- */` comment through the end of `setCenterMarker` (lines 153-184) with:
```js
/* ---------- map ---------- */

const map = new maplibregl.Map({
  container: "map",
  style: isDark() ? STYLE_DARK : STYLE_LIGHT,
  center: [107.6098, -6.9147], // [lng, lat]
  zoom: 15,
  pitch: 45,
  bearing: 0,
  attributionControl: true,
});
map.__styleUrl = isDark() ? STYLE_DARK : STYLE_LIGHT;
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

function firstSymbolId() {
  for (const l of map.getStyle().layers) if (l.type === "symbol") return l.id;
  return undefined;
}

function circleColorExpr() {
  const expr = ["match", ["get", "category"]];
  for (const [key, meta] of Object.entries(CATEGORY_META)) expr.push(key, cssVal(meta.cssVar));
  expr.push("#888888"); // fallback
  return expr;
}

function poiFeatures(pois) {
  return {
    type: "FeatureCollection",
    features: (pois || [])
      .filter((p) => CATEGORY_META[p.category])
      .map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: { category: p.category, name: p.name, lat: p.lat, lon: p.lon },
      })),
  };
}

// bbox [[minLng,minLat],[maxLng,maxLat]] dari geometri isochrone (Polygon/MultiPolygon)
function geomBounds(geometry) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const walk = (c) => {
    if (typeof c[0] === "number") {
      if (c[0] < minX) minX = c[0];
      if (c[1] < minY) minY = c[1];
      if (c[0] > maxX) maxX = c[0];
      if (c[1] > maxY) maxY = c[1];
    } else for (const x of c) walk(x);
  };
  walk(geometry.coordinates);
  return [[minX, minY], [maxX, maxY]];
}

function setIsochrone(geometry) {
  const src = map.getSource("iso");
  if (src) src.setData({ type: "Feature", geometry, properties: {} });
}

function setPois(pois) {
  const src = map.getSource("poi");
  if (src) src.setData(poiFeatures(pois));
}

// Pasang gedung 3D + sumber/lapisan isochrone & POI. Idempotent; dipanggil saat
// map "load" dan tiap kali "styledata" setelah setStyle (swap tema membuang
// semua custom layer, jadi dipasang ulang di sini).
function addCustomLayers() {
  const before = firstSymbolId();
  if (map.getLayer("building-3d")) map.setLayoutProperty("building-3d", "visibility", "none");

  if (!map.getLayer("radius-buildings")) {
    map.addLayer({
      id: "radius-buildings",
      type: "fill-extrusion",
      source: "openmaptiles",
      "source-layer": "building",
      filter: ["has", "render_height"],
      minzoom: 13,
      paint: {
        "fill-extrusion-color": isDark() ? BUILDING_DARK : BUILDING_LIGHT,
        "fill-extrusion-height": ["get", "render_height"],
        "fill-extrusion-base": ["get", "render_min_height"],
        "fill-extrusion-opacity": 0.85,
      },
    }, before);
  }

  const accent = cssVal("--accent");
  if (!map.getSource("iso")) map.addSource("iso", { type: "geojson", data: EMPTY_FC });
  if (!map.getLayer("iso-fill"))
    map.addLayer({ id: "iso-fill", type: "fill", source: "iso", paint: { "fill-color": accent, "fill-opacity": 0.13 } }, before);
  if (!map.getLayer("iso-line"))
    map.addLayer({ id: "iso-line", type: "line", source: "iso", paint: { "line-color": accent, "line-width": 2 } }, before);

  if (!map.getSource("poi")) map.addSource("poi", { type: "geojson", data: EMPTY_FC });
  if (!map.getLayer("poi-circles"))
    map.addLayer({
      id: "poi-circles",
      type: "circle",
      source: "poi",
      paint: {
        "circle-radius": 6,
        "circle-color": circleColorExpr(),
        "circle-stroke-width": 1.5,
        "circle-stroke-color": isDark() ? "#1c2823" : "#ffffff",
      },
    });

  // setelah swap tema, kembalikan data terakhir supaya peta tak kosong
  if (state.lastData) {
    setIsochrone(state.lastData.isochrone);
    setPois(state.lastData.pois);
  }
}

map.on("load", addCustomLayers);

// POI popup: 2 tombol "arahin" (dari titik / GPS) -> Google Maps jalan kaki.
const POI_POPUP_HTML = `<div class="poi-popup">
   <span class="poi-name"></span>
   <span class="poi-cat"></span>
   <div class="poi-actions">
     <button type="button" class="poi-dir" data-origin="point">
       <svg class="icon" aria-hidden="true"><use href="vendor/icons/sprite.svg#navigation-arrow"></use></svg>
       <span class="poi-dir-label"></span>
     </button>
     <button type="button" class="poi-dir" data-origin="gps">
       <svg class="icon" aria-hidden="true"><use href="vendor/icons/sprite.svg#crosshair-simple"></use></svg>
       <span class="poi-dir-label"></span>
     </button>
   </div>
   <p class="poi-msg" hidden></p>
 </div>`;

map.on("click", "poi-circles", (e) => {
  const f = e.features && e.features[0];
  if (!f) return;
  const p = f.properties;
  const meta = CATEGORY_META[p.category];
  if (!meta) return;
  const poi = { name: p.name, category: p.category, lat: Number(p.lat), lon: Number(p.lon) };
  const wrap = document.createElement("div");
  wrap.innerHTML = POI_POPUP_HTML;
  const node = wrap.firstElementChild;
  new maplibregl.Popup({ offset: 14 }).setLngLat(e.lngLat).setDOMContent(node).addTo(map);
  wirePoiPopup(node, poi, meta);
});
map.on("mouseenter", "poi-circles", () => { map.getCanvas().style.cursor = "pointer"; });
map.on("mouseleave", "poi-circles", () => { map.getCanvas().style.cursor = ""; });

// pilih titik analisis dengan klik peta (abaikan klik yang mengenai POI)
map.on("click", (e) => {
  if (state.loading) return;
  if (map.getLayer("poi-circles") &&
      map.queryRenderedFeatures(e.point, { layers: ["poi-circles"] }).length) return;
  state.locationLabel = t("map.point", { lat: e.lngLat.lat.toFixed(4), lon: e.lngLat.lng.toFixed(4) });
  runAnalysis(e.lngLat.lat, e.lngLat.lng);
});

let centerMarker = null;
function setCenterMarker(lat, lon) {
  if (centerMarker) centerMarker.remove();
  const el = document.createElement("div");
  el.className = "center-pin";
  centerMarker = new maplibregl.Marker({ element: el, anchor: "center" })
    .setLngLat([lon, lat])
    .addTo(map);
}

function fitIsochrone(geometry) {
  const b = geomBounds(geometry);
  let padding;
  if (isDesktop()) padding = { top: 84, left: 462, right: 40, bottom: 40 };
  else if (state.view === "peta")
    padding = { top: 132, left: 24, right: 24, bottom: Math.round(window.innerHeight * 0.44) };
  else padding = { top: 26, right: 26, bottom: 26, left: 26 };
  map.fitBounds(b, { padding, duration: REDUCED_MOTION ? 0 : 600 });
}
```

- [ ] **Step 3: Rewrite `applyTheme()` to swap the MapLibre style**

Replace the current `applyTheme` (lines 107-112):
```js
function applyTheme() {
  tileLayer.setUrl(isDark() ? TILE_DARK : TILE_LIGHT);
  // warna inline (band, ikon kategori) dibaca dari CSS var saat render;
  // render ulang hasil terakhir supaya ikut tema baru.
  if (state.lastData) renderResult(state.lastData, { refetchDock: false });
}
```
with:
```js
function applyTheme() {
  const target = isDark() ? STYLE_DARK : STYLE_LIGHT;
  if (typeof map !== "undefined" && map.__styleUrl !== target) {
    map.__styleUrl = target;
    map.setStyle(target);
    map.once("styledata", addCustomLayers); // custom layer dibuang saat swap; pasang ulang
  }
  // warna inline (band, ikon kategori) dibaca dari CSS var saat render;
  // render ulang hasil terakhir supaya ikut tema baru.
  if (state.lastData) renderResult(state.lastData, { refetchDock: false });
}
```
Note: `applyTheme` is first called at bootstrap (line 914) **before** `map` exists in source order — the `typeof map !== "undefined"` guard skips the swap on that first call; the initial style is already correct from the `Map` constructor, and `addCustomLayers` runs via `map.on("load")`.

- [ ] **Step 4: Replace the Leaflet layer rendering inside `renderResult` (lines 513-570) with MapLibre source updates**

Replace this block (starts at `// layer peta`, ends after the `if (refetchDock) { ... fitBounds ... }`):
```js
  // layer peta
  isochroneLayer.clearLayers();
  poiLayer.clearLayers();
  const accent = cssVal("--accent");
  const iso = L.geoJSON(
    { type: "Feature", geometry: data.isochrone },
    { style: { color: accent, weight: 2, fillColor: accent, fillOpacity: 0.13, className: "iso-shape" } }
  ).addTo(isochroneLayer);

  for (const poi of data.pois) {
    const meta = CATEGORY_META[poi.category];
    if (!meta) continue;
    L.circleMarker([poi.lat, poi.lon], {
      radius: 6,
      color: isDark() ? "#1c2823" : "#ffffff",
      weight: 1.5,
      fillColor: cssVal(meta.cssVar),
      fillOpacity: 0.95,
    })
      .bindPopup(
        `<div class="poi-popup">
           <span class="poi-name"></span>
           <span class="poi-cat"></span>
           <div class="poi-actions">
             <button type="button" class="poi-dir" data-origin="point">
               <svg class="icon" aria-hidden="true"><use href="vendor/icons/sprite.svg#navigation-arrow"></use></svg>
               <span class="poi-dir-label"></span>
             </button>
             <button type="button" class="poi-dir" data-origin="gps">
               <svg class="icon" aria-hidden="true"><use href="vendor/icons/sprite.svg#crosshair-simple"></use></svg>
               <span class="poi-dir-label"></span>
             </button>
           </div>
           <p class="poi-msg" hidden></p>
         </div>`
      )
      .on("popupopen", (e) => wirePoiPopup(e.popup.getElement(), poi, meta))
      .addTo(poiLayer);
  }

  setCenterMarker(data.center.lat, data.center.lon);
  if (refetchDock) {
    if (isDesktop()) {
      // beri ruang untuk panel kiri dan dock durasi atas
      map.fitBounds(iso.getBounds(), {
        paddingTopLeft: L.point(462, 84),
        paddingBottomRight: L.point(40, 40),
      });
    } else if (state.view === "peta") {
      // mobile: sisakan ruang untuk bottom sheet (41vh) + kontrol atas
      map.fitBounds(iso.getBounds(), {
        paddingTopLeft: L.point(24, 132),
        paddingBottomRight: L.point(24, Math.round(window.innerHeight * 0.44)),
      });
    } else {
      map.fitBounds(iso.getBounds(), { padding: [26, 26] });
    }
  }
```
with:
```js
  // layer peta (MapLibre GeoJSON sources)
  setIsochrone(data.isochrone);
  setPois(data.pois);
  setCenterMarker(data.center.lat, data.center.lon);
  if (refetchDock) fitIsochrone(data.isochrone);
```

- [ ] **Step 5: Replace `map.invalidateSize()` with `map.resize()` in `applyView`**

In `applyView` (line ~210), replace:
```js
    setTimeout(() => map.invalidateSize(), 60);
```
with:
```js
    setTimeout(() => map.resize(), 60);
```

- [ ] **Step 6: Replace the three `map.setView(...)` calls with `map.jumpTo(...)`**

In `doSearch` (line ~731) replace:
```js
        map.setView([r.lat, r.lon], 15);
```
with:
```js
        map.jumpTo({ center: [r.lon, r.lat], zoom: 15 });
```

In `init` (line ~889) replace:
```js
    map.setView([cfg.default_center.lat, cfg.default_center.lon], 15);
```
with:
```js
    map.jumpTo({ center: [cfg.default_center.lon, cfg.default_center.lat], zoom: 15 });
```

In `init`'s demo-location handler (line ~900) replace:
```js
        map.setView([loc.lat, loc.lon], 15);
```
with:
```js
        map.jumpTo({ center: [loc.lon, loc.lat], zoom: 15 });
```

- [ ] **Step 7: Update the header comment**

Replace line 1's `Leaflet map` with `MapLibre GL map`:
```js
/* RADIUS frontend v3: MapLibre GL map + panel/bottom-sheet, hash routing,
```

- [ ] **Step 8: Static sanity — confirm no Leaflet globals remain**

Run (Git Bash):
```bash
cd "D:/Collage/Radius-APP/.claude/worktrees/adoring-poincare-c2ef35"
grep -nE "\bL\.|tileLayer|invalidateSize|isochroneLayer|poiLayer|setView|\.getBounds\(" web/js/app.js
```
Expected: **no output**. (Every Leaflet-ism is gone; `fitIsochrone`/`geomBounds` replaced `getBounds`.)

- [ ] **Step 9: Start the server and smoke-test in the browser via chrome-devtools MCP**

Start server (PowerShell, background):
```
.venv\Scripts\python.exe -m uvicorn app.server:app --host 127.0.0.1 --port 8000
```
Then with the chrome-devtools MCP: `new_page` → `navigate_page` to `http://127.0.0.1:8000/#/peta` → wait ~3s → `evaluate_script`:
```js
() => ({
  maplibre: typeof maplibregl,
  styleLoaded: map.isStyleLoaded(),
  buildings: !!map.getLayer("radius-buildings"),
  isoFill: !!map.getLayer("iso-fill"),
  poi: !!map.getLayer("poi-circles"),
  pitch: map.getPitch(),
})
```
Expected: `{maplibre:"object", styleLoaded:true, buildings:true, isoFill:true, poi:true, pitch:45}`.
Then `list_console_messages` → expected: **no errors** (warnings from the style are acceptable).

- [ ] **Step 10: Smoke-test an analysis renders isochrone + POI**

Via chrome-devtools MCP `evaluate_script` (drives a demo point through the real API):
```js
async () => {
  const r = await fetch("/api/analyze?lat=-6.9175&lon=107.6560&minutes=15");
  const d = await r.json();
  window.__t2 = d;
  return { ok: r.ok, hasIso: !!d.isochrone, pois: (d.pois||[]).length };
}
```
Expected: `ok:true`, `hasIso:true`, `pois` > 0. Then feed it to the map and check the sources have features:
```js
() => {
  setIsochrone(window.__t2.isochrone);
  setPois(window.__t2.pois);
  return { iso: !!map.getSource("iso"), poiFeats: map.querySourceFeatures("poi").length >= 0 };
}
```
Expected: `iso:true`. (Full click→popup + fitBounds is exercised in Task 4 on the emulator.)

- [ ] **Step 11: Commit**

```bash
git add web/js/app.js
git commit -m "feat: render the map with MapLibre GL (3D buildings, pitch)

Replace Leaflet map/tileLayer/geoJSON/circleMarker/marker with a MapLibre
Map: liberty<->dark styles, an owned radius-buildings fill-extrusion layer,
iso/poi GeoJSON sources updated via setData, POI popup keeps the 2 arahin
buttons (wirePoiPopup unchanged), center pin as a Marker, fitBounds with
the same desktop/mobile paddings. Theme toggle swaps style + re-adds layers."
```

---

### Task 3: Port the map furniture CSS (Leaflet → MapLibre classes)

**Files:**
- Modify: `web/css/app.css` (lines 948-1012, the `/* ---- map furniture ---- */` block)

**Interfaces:**
- Consumes: MapLibre popup/control DOM classes (`.maplibregl-popup-content`, `.maplibregl-popup-tip`, `.maplibregl-ctrl-group`), existing CSS vars `--accent`, `--line`, `--radius`, `--panel`, `--ink-2`, `--ink-3`.
- Produces: styled popup + zoom/nav controls matching the app in light and dark; `.poi-*` and `.center-pin` retained.

- [ ] **Step 1: Confirm the CSS vars this task relies on exist**

Run (Git Bash):
```bash
cd "D:/Collage/Radius-APP/.claude/worktrees/adoring-poincare-c2ef35"
grep -nE "^\s*--(radius|panel|ink-3)\s*:" web/css/app.css | head
```
Expected: `--radius`, `--panel`, and `--ink-3` are all defined (in `:root`). If `--ink-3` is absent, substitute `--ink-2` in Step 2's rules.

- [ ] **Step 2: Replace the Leaflet furniture block with MapLibre equivalents**

Replace lines 948-1012 (from `/* ---- map furniture ---- */` through the `.center-pin { … }` rule) with:
```css
/* ---- map furniture (MapLibre) ---- */
.maplibregl-map { font-family: inherit; }

.maplibregl-popup-content {
  border-radius: var(--radius);
  box-shadow: 0 8px 24px rgba(22, 29, 26, 0.18);
  padding: 12px 14px;
  background: var(--panel);
  color: var(--ink-1);
}
.maplibregl-popup-close-button {
  font-size: 17px;
  color: var(--ink-3);
  padding: 0 6px;
}
.maplibregl-popup-anchor-top .maplibregl-popup-tip,
.maplibregl-popup-anchor-top-left .maplibregl-popup-tip,
.maplibregl-popup-anchor-top-right .maplibregl-popup-tip { border-bottom-color: var(--panel); }
.maplibregl-popup-anchor-bottom .maplibregl-popup-tip,
.maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip,
.maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip { border-top-color: var(--panel); }
.maplibregl-popup-anchor-left .maplibregl-popup-tip { border-right-color: var(--panel); }
.maplibregl-popup-anchor-right .maplibregl-popup-tip { border-left-color: var(--panel); }

.poi-popup { min-width: 184px; }
.poi-popup .poi-name { font-weight: 600; display: block; }
.poi-popup .poi-cat { color: var(--ink-3); font-size: 12px; }
.poi-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}
.poi-dir {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-ink);
  background: var(--accent-soft);
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 8px 14px;
  cursor: pointer;
}
.poi-dir:hover { border-color: var(--accent); }
.poi-dir:active { transform: scale(0.98); }
.poi-dir:disabled { opacity: 0.5; cursor: default; }
.poi-dir .icon { width: 16px; height: 16px; }
.poi-msg {
  margin: 8px 0 0;
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--warn-ink);
}
@media (prefers-reduced-motion: reduce) {
  .poi-dir:active { transform: none; }
}

.maplibregl-ctrl-group {
  border: 1px solid var(--line) !important;
  border-radius: var(--radius) !important;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(22, 29, 26, 0.10) !important;
  background: var(--panel);
}
.maplibregl-ctrl-group button { background: var(--panel); }
.maplibregl-ctrl-group button + button { border-top: 1px solid var(--line); }
.maplibregl-ctrl-attribution { font-size: 10px; }

.center-pin {
  width: 18px; height: 18px;
  border-radius: 50%;
  background: var(--accent);
  border: 3px solid #fff;
  box-shadow: 0 2px 8px rgba(22, 29, 26, 0.35);
}
```
Note: this deletes the old `.leaflet-*` rules and the `.iso-shape` / `@keyframes iso-in` rules (a GL layer can't carry a CSS class). If `--ink-1` is not defined, drop the `color: var(--ink-1);` line from `.maplibregl-popup-content` (MapLibre's default text color is fine).

- [ ] **Step 3: Verify the `.iso-shape` keyframe block is gone (it referenced a Leaflet-only class)**

Run (Git Bash):
```bash
grep -nE "leaflet|iso-shape|iso-in" web/css/app.css
```
Expected: **no output**.

- [ ] **Step 4: Visual check in light + dark via chrome-devtools MCP**

With the server running, navigate to `http://127.0.0.1:8000/#/peta`, run an analysis (click a demo chip), click a POI circle, `take_screenshot`. Then toggle dark (`evaluate_script`: `() => document.querySelector('.theme-btn').click()`), wait ~2s, `take_screenshot`.
Expected: popup has rounded corners + app shadow + readable text in both themes; the zoom/nav control group is bordered/rounded; MapLibre nav control icons visible in dark.

- [ ] **Step 5: Commit**

```bash
git add web/css/app.css
git commit -m "style: port map furniture CSS from Leaflet to MapLibre classes

Restyle .maplibregl-popup-content/tip and .maplibregl-ctrl-group to match
the app (radius, shadow, panel bg, dark mode); keep .poi-* and .center-pin;
drop the Leaflet-only .iso-shape keyframe."
```

---

### Task 4: End-to-end verification on the Pixel emulator + push

**Files:** none (verification + git push only).

**Interfaces:**
- Consumes: everything from Tasks 1-3, backend unchanged.
- Produces: recorded evidence that pytest is green and the 3D map works end-to-end on the emulator; commits pushed to `origin/main`.

- [ ] **Step 1: Backend guardrail — pytest still green**

Run (PowerShell):
```
.venv\Scripts\python.exe -m pytest -q
```
Expected: `44 passed`. If not, STOP — a backend file was touched by mistake; revert it.

- [ ] **Step 2: Start the server (background) and the Pixel emulator**

Server (PowerShell, background):
```
.venv\Scripts\python.exe -m uvicorn app.server:app --host 127.0.0.1 --port 8000
```
Emulator (PowerShell, background):
```
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
D:\Sdk\emulator\emulator.exe -avd Pixel_10_Pro_XL
```
Wait for boot: `D:\Sdk\platform-tools\adb.exe wait-for-device; D:\Sdk\platform-tools\adb.exe shell getprop sys.boot_completed` → expected `1`.

- [ ] **Step 3: Attach to the app WebView over CDP (chrome-devtools MCP)**

The app WebView exposes `webview_devtools_remote` (pattern already used in this repo). Forward and connect:
```
D:\Sdk\platform-tools\adb.exe forward tcp:9222 localabstract:webview_devtools_remote
```
Point the chrome-devtools MCP at `http://127.0.0.1:9222` and select the RADIUS page. (If the app loads the deployed origin, drive the emulator to the local host `http://10.0.2.2:8000` per `capacitor.config.json`.)

- [ ] **Step 4: Verify 3D + pitch + no console errors**

`evaluate_script`:
```js
() => ({ pitch: map.getPitch(), buildings: !!map.getLayer("radius-buildings"), styleLoaded: map.isStyleLoaded() })
```
Expected: `pitch:45, buildings:true, styleLoaded:true`. `list_console_messages` → no errors. `take_screenshot` → grey extruded blocks visible, camera tilted.

- [ ] **Step 5: Verify analysis → isochrone + POI, then POI popup with 2 arahin buttons**

Tap the Antapani demo chip (or `evaluate_script` to click it), wait for the result panel (`#score-num` non-zero). Confirm isochrone fill + POI circles render (`take_screenshot`). Click a POI circle:
```js
() => {
  const f = map.querySourceFeatures("poi")[0];
  return f ? { lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] } : null;
}
```
then dispatch a click at that lng/lat via `map.project(...)` and a synthetic click, OR tap via the MCP at the projected pixel. Expected: a MapLibre popup opens with two `.poi-dir` buttons whose labels are the translated "dari titik / GPS" strings. Confirm `openDirections` builds a `google.com/maps/dir` walking URL (spy: `evaluate_script` wrapping `window.open`).

- [ ] **Step 6: Verify dark swap keeps the map populated**

`evaluate_script`: `() => document.querySelector('.theme-btn').click()`, wait ~2s, then:
```js
() => ({ style: map.__styleUrl, buildings: !!map.getLayer("radius-buildings"), isoHasData: map.querySourceFeatures("iso").length > 0 })
```
Expected: `style` ends with `/dark`, `buildings:true`, and the isochrone still has features (not blanked). `take_screenshot` → dark basemap + contrasting grey blocks + visible isochrone.

- [ ] **Step 7: Verify mobile fitBounds leaves bottom-sheet room**

In the emulator (portrait), after an analysis in view `#/peta`, confirm the isochrone is fully visible above the bottom sheet (not hidden behind it). `take_screenshot`. If the isochrone bottom is occluded, the `fitIsochrone` mobile padding needs raising — fix in `web/js/app.js` and re-commit under Task 2's scope.

- [ ] **Step 8: Push all commits to origin/main**

```bash
cd "D:/Collage/Radius-APP/.claude/worktrees/adoring-poincare-c2ef35"
git log --oneline origin/main..HEAD
git push origin HEAD:main
```
Expected: the Task 1-3 commits (plus the spec/plan docs) land on `origin/main` (github.com/zhillanqisa/RADIUS-App).

---

## Self-Review

**Spec coverage:**
- Vendor MapLibre + swap index.html + retire Leaflet → Task 1. ✓
- fill-extrusion 3D buildings from `render_height` → Task 2 Step 2 (`radius-buildings`). ✓
- Isochrone GeoJSON source + fill (0.13) + outline → Task 2 Step 2 (`iso-fill`/`iso-line`). ✓
- POI circle layer per category color + popup with 2 arahin buttons; `wirePoiPopup`/`openDirections`/`getUserLocation` preserved → Task 2 Step 2 (`poi-circles` + `POI_POPUP_HTML` + click handler). ✓
- Center pin as Marker accent → Task 2 Step 2 (`setCenterMarker`). ✓
- fitBounds bbox from isochrone, desktop/mobile paddings → Task 2 Step 2 (`fitIsochrone`/`geomBounds`). ✓
- Zoom + navigation (pitch) control → Task 2 Step 2 (`NavigationControl visualizePitch`). ✓
- Dark mode style swap + re-add custom layers on styledata → Task 2 Step 3 (`applyTheme`) + `addCustomLayers`. ✓
- CSS `.leaflet-*` → `.maplibregl-*`, keep `.poi-*` + dark → Task 3. ✓
- PWA precache updated (sw.js) → Task 1 Step 5. ✓
- pytest 44 green + emulator/CDP verify + commit per part + push → Task 4. ✓

**Placeholder scan:** no TBD/TODO; every code step shows full code; verification steps give exact expressions + expected values. ✓

**Type consistency:** layer ids (`radius-buildings`, `iso-fill`, `iso-line`, `poi-circles`) and source ids (`iso`, `poi`) are identical across `addCustomLayers`, `setIsochrone`, `setPois`, `renderResult`, click handler, and Task 4 checks. `geomBounds` returns `[[minLng,minLat],[maxLng,maxLat]]` consumed by `fitIsochrone`. `poiFeatures` writes `{category,name,lat,lon}` properties read back by the click handler. `map.__styleUrl` set in init + read/written in `applyTheme`. ✓
