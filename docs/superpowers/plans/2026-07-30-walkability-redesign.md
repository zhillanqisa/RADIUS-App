# RADIUS Walkability Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `web/` to the "RADIUS Alur Lengkap" canvas — new visual identity plus six unbuilt screens (Landing, guest entry, Beranda dashboard, Comparison, Tersimpan/Riwayat, Pengaturan) — on top of the existing MapLibre 3D map, with the backend untouched.

**Architecture:** Vanilla JS, no build step. `app.js` and `app.css` are split into ordered classic scripts and four stylesheets so each file has one responsibility. New palette values are re-pointed onto the **existing** CSS custom-property names, so existing rules keep working. All four features that appear to need backend support are derived client-side from data `/api/analyze` already returns.

**Tech Stack:** MapLibre GL JS v4 (vendored), OpenFreeMap keyless vector styles, vendored Outfit variable font, FastAPI static mount, Capacitor WebView shell, PWA service worker.

Spec: `docs/superpowers/specs/2026-07-30-walkability-redesign-design.md`

## Global Constraints

- **Backend frozen.** No edits to `app/`, `radius_core.py`, `cost_assumptions.py`. `pytest` must report **44 passed** after every task.
- **No build step.** Classic `<script>` tags in fixed order, no ES modules, no bundler, no npm dependency added.
- **Keyless only.** Map styles come from `https://tiles.openfreemap.org/styles/liberty` and `.../dark`. No API keys, no new external host, no CDN font.
- **Element ids are contract** and must keep resolving: `search-input`, `search-results`, `search-error`, `duration-group`, `demo-chips`, `state-empty`, `state-loading`, `result-view`, `notice-demo`, `notice-demo-text`, `ring-value`, `score-num`, `score-band`, `score-caption`, `score-cached`, `verdict-gap`, `breakdown-title`, `category-list`, `map`, `menu-screen`, `analysis-view`, `cost-view`, `rent-input`, `cost-lines`, `cost-notes`, `cost-summary`, `cost-rent`, `cost-extra`, `cost-total`, `cost-disclaimer`, `compare-save`, `compare-card`, `compare-grid`, `compare-clear`, `mini-score`, `mini-band`, `mini-caption`, `panel`, `sheet-handle`.
- **API contract frozen:** `/api/analyze?lat&lon&minutes`, `/api/geocode?q`, `/api/config`.
- **Every user-visible string goes through `t()`.** No hardcoded Indonesian in a render path. Keys use the existing dotted convention.
- **Preserve:** POI "arahin" (`wirePoiPopup` / `openDirections` / `getUserLocation` incl. the Capacitor Geolocation native branch), PWA (`manifest.webmanifest` untouched, `sw.js` precache updated), the `addCustomLayers` unready-style guard from `30207b9`.
- **Category colours `--cat-*` never change** — the map legend must stay identical across themes.
- **`prefers-reduced-motion: reduce`** disables every animation and transition added.
- **Font:** vendored Outfit only (`--font-display` / `--font-body` both Outfit). Space Grotesk is deliberately not used.
- **GateGuard:** the first Write/Bash per file per session is denied once with a `[Fact-Forcing Gate]` message. State the requested facts briefly, then retry the identical call.
- **Env:** run Python as `"D:\Collage\Radius-APP\.venv\Scripts\python.exe"` from the repo root.

---

### Task 1: Design-system foundation

**Files:**
- Create: `web/css/tokens.css`, `web/css/base.css`, `web/css/components.css`
- Modify: `web/vendor/icons/sprite.svg` (append symbols), `web/index.html` (stylesheet links), `web/css/app.css` (drop the moved token/base blocks)

**Interfaces:**
- Consumes: nothing.
- Produces: the custom properties every later task styles against — `--ink`, `--ink-2`, `--ink-3`, `--ink-4`, `--surface`, `--surface-2`, `--card`, `--line`, `--line-2`, `--accent`, `--accent-ink`, `--accent-soft`, `--lime`, `--lime-ink`, `--chrome`, `--chrome-ink`, `--olive`, `--spark`, `--good`, `--warn`, `--bad`, `--bad-2`, `--good-bg`, `--warn-bg`, `--bad-bg`, `--bad-line`, `--band-low`, `--band-mid`, `--band-high`, `--r-pill`, `--r-card`, `--r-card-lg`, `--r-sheet`, `--sh-1`, `--sh-2`, `--sh-sheet`, `--font-display`, `--font-body`. Sprite symbol ids `chevron-left`, `chevron-right`, `arrow-right`, `house`, `user`, `bookmark`, `bookmark-fill`, `heart`, `sliders`, `trash`, `plus`, `minus`, `spinner`. Component classes `.tabbar`, `.tab`, `.screen`, `.screen-head`, `.icon-btn`, `.pill-btn`, `.lime-btn`, `.dark-btn`, `.card`, `.stat-tile`, `.chip`, `.chip-row`, `.segmented-pill`, `.verdict-card`, `.gauge`, `.cat-row`, `.timeline`, `.stepper`, `.skeleton`, `.spinner`.

- [ ] **Step 1: Write `web/css/tokens.css`** with the light palette, both dark-mode paths, radii, shadows and font stacks exactly as spec §3. Both dark paths must reassign the same property list:

```css
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { /* *-dark values */ } }
:root[data-theme="dark"] { /* identical body */ }
```

- [ ] **Step 2: Write `web/css/base.css`** — `box-sizing`, body defaults on `--surface`/`--ink`/`--font-body`, `[hidden]{display:none!important}`, `.icon{width:1em;height:1em;fill:currentColor}`, `.sr-only`, focus-visible ring using `--accent`, and a `@media (prefers-reduced-motion: reduce)` block zeroing `animation-duration`/`transition-duration` globally.

- [ ] **Step 3: Write `web/css/components.css`** with the component classes listed under Produces, sized from the canvas: tabbar is a `--chrome` pill, `margin: 0 20px calc(12px + env(safe-area-inset-bottom,0px))`, `padding:8px`, tabs 38×38 circles, active tab `background: var(--lime)`; `.icon-btn` 38×38 white circle with `--sh-1`; hit targets ≥40px.

- [ ] **Step 4: Append the 13 sprite symbols** to `web/vendor/icons/sprite.svg`, before `</svg>`, using the canvas path data. Each is `<symbol id="..." viewBox="0 0 24 24">` with `fill="none" stroke="currentColor" stroke-width="2"` on the path, e.g.:

```xml
<symbol id="chevron-left" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="bookmark" viewBox="0 0 24 24"><path d="M6 4a2 2 0 012-2h8a2 2 0 012 2v16l-6-4-6 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="bookmark-fill" viewBox="0 0 24 24"><path d="M6 4a2 2 0 012-2h8a2 2 0 012 2v16l-6-4-6 4z" fill="currentColor"/></symbol>
<symbol id="house" viewBox="0 0 24 24"><path d="M4 11L12 4l8 7M6 10v9h5v-5h2v5h5v-9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
```

- [ ] **Step 5: Link the new stylesheets** in `web/index.html`, before the existing `css/app.css` link so app.css still wins on overrides:

```html
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/components.css">
<link rel="stylesheet" href="css/app.css">
```

- [ ] **Step 6: Delete the moved blocks from `web/css/app.css`** — the `:root` token block (lines ~13-51), both dark-theme blocks (~53-99), and the `[hidden]` rule — leaving screen composition, responsive and map furniture. Re-point any now-dangling references to the new names.

- [ ] **Step 7: Verify in the preview.** Start the `radius` preview config, then confirm tokens resolve and no rule was orphaned:

```js
getComputedStyle(document.documentElement).getPropertyValue('--lime').trim()
```
Expected: `#d6e84a`. Also `read_console_messages` → no errors, and `document.querySelectorAll('#menu-screen,#map,#panel').length` → `3`.

- [ ] **Step 8: Run pytest**

Run: `"D:\Collage\Radius-APP\.venv\Scripts\python.exe" -m pytest -q`
Expected: `44 passed`

- [ ] **Step 9: Commit**

```bash
git add web/css web/index.html web/vendor/icons/sprite.svg
git commit -m "feat(ui): new design-system foundation — tokens, base, components, icons"
```

---

### Task 2: Chrome and routing — tabbar, Landing, guest entry

**Files:**
- Create: nothing
- Modify: `web/index.html` (add `#landing-screen`, `#masuk-screen`, `.tabbar`), `web/js/app.js` (router), `web/css/app.css` (screen layout), `web/js/i18n.js` (new keys)

**Interfaces:**
- Consumes: Task 1 component classes and sprite symbols.
- Produces: `VIEW_FOR_HASH` extended to `{"#/landing":"landing","#/masuk":"masuk","#/menu":"menu","#/peta":"peta","#/biaya":"biaya","#/banding":"banding","#/tersimpan":"tersimpan","#/pengaturan":"pengaturan"}`; `applyView()` toggling one `.screen` per view and setting `document.body.dataset.view`; global `Store` is **not** yet available (Task 3) — Task 2 reads first-run state via a local `try/catch`'d `localStorage.getItem("radius_seen_landing")`.

- [ ] **Step 1: Add the Landing markup** to `web/index.html` as the first child of `<body>`, per canvas f1 — grid + concentric-ring SVG hero, centred `15 menit jalan kaki dari sini` pill, and a bottom white card with headline, sub and the `Gambar Radius Saya` CTA linking to `#/peta`. Every text node carries `data-i18n`.

- [ ] **Step 2: Add the guest-entry markup** per canvas 5b — centred logo mark, `RADIUS bisa dipakai tanpa akun` title, sub, then a `.dark-btn` `Lanjut sebagai Tamu` linking to `#/menu` and a **disabled** `.card` button for Google with a `data-i18n="masuk.soon"` note. The disabled control must be a real `<button disabled>`, not a styled div.

- [ ] **Step 3: Add the tabbar markup** before `</body>`, 4 `<a class="tab">` to `#/menu`, `#/peta`, `#/tersimpan`, `#/pengaturan`, each with an `.icon` `<use>` of `house` / `magnifying-glass` / `clock` / `user` and an `aria-label` via `data-i18n-attr`.

- [ ] **Step 4: Extend the router** in `web/js/app.js`. Replace `VIEW_FOR_HASH` and `applyView()`:

```js
const VIEW_FOR_HASH = {
  "#/landing": "landing", "#/masuk": "masuk", "#/menu": "menu",
  "#/peta": "peta", "#/biaya": "biaya", "#/banding": "banding",
  "#/tersimpan": "tersimpan", "#/pengaturan": "pengaturan",
};
const TABBAR_VIEWS = new Set(["menu", "tersimpan", "pengaturan", "banding"]);
const SHELL_VIEWS = new Set(["peta", "biaya"]);

function defaultHash() {
  let seen = false;
  try { seen = localStorage.getItem("radius_seen_landing") === "1"; } catch (e) { seen = true; }
  return seen ? "#/menu" : "#/landing";
}

function applyView() {
  if (!location.hash || !VIEW_FOR_HASH[location.hash]) {
    location.replace(defaultHash());
    if (!VIEW_FOR_HASH[location.hash]) return;
  }
  const view = VIEW_FOR_HASH[location.hash];
  state.view = view;
  document.body.dataset.view = view;
  for (const el of document.querySelectorAll("[data-screen]")) {
    el.hidden = el.dataset.screen !== view;
  }
  els.shell.hidden = !SHELL_VIEWS.has(view);
  els.tabbar.hidden = !TABBAR_VIEWS.has(view);
  els.durationDock.hidden = view !== "peta";
  els.analysisView.hidden = view !== "peta";
  els.costView.hidden = view !== "biaya";
  els.panel.classList.remove("sheet-full");
  for (const tab of els.tabbar.querySelectorAll(".tab")) {
    tab.setAttribute("aria-current", String(tab.getAttribute("href") === location.hash));
  }
  updateCompareVisibility();
  if (SHELL_VIEWS.has(view)) setTimeout(() => map.resize(), 60);
}
```

- [ ] **Step 5: Mark the screens.** Give `#landing-screen` `data-screen="landing"`, `#masuk-screen` `data-screen="masuk"`, `#menu-screen` `data-screen="menu"`. Add `els.shell = document.querySelector(".shell")` and `els.tabbar = document.querySelector(".tabbar")` to the `els` map. `#menu-screen` keeps its id.

- [ ] **Step 6: Persist the first-run flag.** On the Landing CTA and the guest `Lanjut sebagai Tamu` click, set the flag before navigating:

```js
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-seen-landing]")) {
    try { localStorage.setItem("radius_seen_landing", "1"); } catch (err) { /* private WebView */ }
  }
});
```
Put `data-seen-landing` on both controls.

- [ ] **Step 7: Add i18n keys** for every new string in both `id` and `en`: `landing.title`, `landing.sub`, `landing.cta`, `landing.pill`, `masuk.title`, `masuk.sub`, `masuk.guest`, `masuk.google`, `masuk.soon`, `tab.beranda`, `tab.peta`, `tab.tersimpan`, `tab.pengaturan`.

- [ ] **Step 8: Verify routing in the preview.** For each hash, navigate and assert exactly one screen is visible:

```js
["#/landing","#/masuk","#/menu","#/peta","#/tersimpan","#/pengaturan"].map(h => {
  location.hash = h;
  return [h, [...document.querySelectorAll("[data-screen]")].filter(e => !e.hidden).map(e => e.dataset.screen)];
})
```
Expected: one screen name per hash, matching. Console clean.

- [ ] **Step 9: Run pytest** — `44 passed`.

- [ ] **Step 10: Commit**

```bash
git add web/index.html web/js/app.js web/js/i18n.js web/css/app.css
git commit -m "feat(ui): landing, guest entry, bottom tabbar and extended router"
```

---

### Task 3: `store.js` and the Beranda dashboard

**Files:**
- Create: `web/js/store.js`, `web/js/format.js`
- Modify: `web/index.html` (Beranda markup inside `#menu-screen`, script tags), `web/js/app.js` (record history, render Beranda), `web/js/i18n.js`

**Interfaces:**
- Consumes: Task 2 router (`applyView`, `data-screen`).
- Produces:
  - `Store.get(key, fallback)`, `Store.set(key, value)` — JSON-safe, never throws.
  - `Store.saved()` → array; `Store.isSaved(entry)` → bool; `Store.toggleSaved(entry)` → bool (new membership); `Store.history()` → array newest-first; `Store.pushHistory(entry)`; `Store.clearHistory()`.
  - Entry shape: `{id, label, kelurahan, lat, lon, minutes, score, band, total, at}` where `id = `${lat.toFixed(4)},${lon.toFixed(4)},${minutes}`` and `at` is an ISO-8601 string.
  - `fmtRp(n)`, `fmtRange(low, high)`, `fmtRelativeTime(iso)` → `"Hari ini · 09:20"` style via `t()`, `haversineKm(a, b)` → number.
  - `renderBeranda()` — repaints stats, recommendation and recent list from `Store`.

- [ ] **Step 1: Write `web/js/store.js`.** A memory fallback map, then:

```js
const Store = (() => {
  const mem = new Map();
  const KEY = (k) => "radius_" + k;
  const CAP = 50;
  function raw(k) { try { return localStorage.getItem(KEY(k)); } catch (e) { return mem.get(KEY(k)) ?? null; } }
  function write(k, s) { try { localStorage.setItem(KEY(k), s); } catch (e) { mem.set(KEY(k), s); } }
  function get(k, fb) { const s = raw(k); if (s == null) return fb; try { return JSON.parse(s); } catch (e) { return fb; } }
  function set(k, v) { write(k, JSON.stringify(v)); return v; }
  const list = (k) => { const v = get(k, []); return Array.isArray(v) ? v : []; };
  const entryId = (e) => `${Number(e.lat).toFixed(4)},${Number(e.lon).toFixed(4)},${e.minutes}`;
  return {
    get, set, entryId,
    saved: () => list("saved"),
    isSaved: (e) => list("saved").some((s) => s.id === entryId(e)),
    toggleSaved(e) {
      const id = entryId(e);
      const cur = list("saved");
      const next = cur.some((s) => s.id === id)
        ? cur.filter((s) => s.id !== id)
        : [{ ...e, id }, ...cur].slice(0, CAP);
      set("saved", next);
      return next.some((s) => s.id === id);
    },
    history: () => list("history"),
    pushHistory(e) {
      const id = entryId(e);
      set("history", [{ ...e, id }, ...list("history").filter((h) => h.id !== id)].slice(0, CAP));
    },
    clearHistory: () => set("history", []),
  };
})();
```

- [ ] **Step 2: Write `web/js/format.js`** with `fmtRp`, `fmtRange`, `haversineKm` and `fmtRelativeTime`. Move `fmtRp`/`fmtRange` out of `app.js` (delete them there — they must exist in exactly one place):

```js
function haversineKm(a, b) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function fmtRelativeTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hhmm = d.toTimeString().slice(0, 5);
  const days = Math.round((new Date().setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0)) / 86400000);
  if (days <= 0) return t("time.today", { time: hhmm });
  if (days === 1) return t("time.yesterday", { time: hhmm });
  return t("time.daysAgo", { n: days, time: hhmm });
}
```

- [ ] **Step 3: Replace `#menu-screen`'s contents** with the Beranda dashboard per canvas f2, keeping the id: header row (`.icon-btn` to `#/pengaturan` + avatar), greeting, headline, 3 `.stat-tile`s with ids `stat-checked`, `stat-best`, `stat-saved`, a search pill linking to `#/peta`, the dark `Bandingkan 2 Lokasi` card linking to `#/banding`, a `#reco-card` recommendation block, and a `#recent-list`. The lang pill and `.theme-btn` stay in the header so the existing global handler keeps working.

- [ ] **Step 4: Write `renderBeranda()`** in `web/js/app.js`:

```js
function renderBeranda() {
  const hist = Store.history(), saved = Store.saved();
  els.statChecked.textContent = String(hist.length);
  els.statBest.textContent = hist.length ? String(Math.max(...hist.map((h) => h.score || 0))) : "-";
  els.statSaved.textContent = String(saved.length);

  const reco = hist.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  renderReco(reco);   // falls back to demo locations when reco is undefined

  els.recentList.replaceChildren();
  for (const h of hist.slice(0, 5)) els.recentList.appendChild(recentRow(h));
  els.recentEmpty.hidden = hist.length > 0;
}
```
`renderReco(undefined)` must render the first entry of `state.demoLocations` (captured in `init()` from `/api/config`) labelled with `t("beranda.recoDemo")` — never a blank card.

- [ ] **Step 5: Record history on every successful analysis.** In `renderResult()`, after the score and band are known:

```js
Store.pushHistory({
  label: state.locationLabel || t("result.captionFallback"),
  kelurahan: "", lat: data.center.lat, lon: data.center.lon,
  minutes: data.minutes, score, band: band.labelKey,
  total: null, at: new Date().toISOString(),
});
```

- [ ] **Step 6: Call `renderBeranda()`** from `applyView()` when `view === "menu"`, and from `refreshLanguage()`.

- [ ] **Step 7: Add script tags** to `web/index.html` in order: `store.js`, `format.js` after `i18n.js` and before `app.js`.

- [ ] **Step 8: Add i18n keys**: `beranda.greeting`, `beranda.title`, `beranda.statChecked`, `beranda.statBest`, `beranda.statSaved`, `beranda.searchCta`, `beranda.compareTitle`, `beranda.compareSub`, `beranda.recoTitle`, `beranda.recoDemo`, `beranda.recoBadge`, `beranda.recentTitle`, `beranda.recentEmpty`, `time.today`, `time.yesterday`, `time.daysAgo`.

- [ ] **Step 9: Verify in the preview.** Confirm the store round-trips and Beranda repaints:

```js
location.hash = "#/peta";
// after an analysis completes:
Store.history().length > 0 && (location.hash = "#/menu", document.getElementById("stat-checked").textContent)
```
Expected: a non-zero count. Then check the private-mode path by stubbing a throwing `localStorage.setItem` and confirming `Store.set("x",1)` does not throw.

- [ ] **Step 10: Run pytest** — `44 passed`.

- [ ] **Step 11: Commit**

```bash
git add web/js/store.js web/js/format.js web/index.html web/js/app.js web/js/i18n.js web/css
git commit -m "feat(ui): Beranda dashboard with local saved/history store"
```

---

### Task 4: Cek Lokasi — persona chips, pin label, bookmark

**Files:**
- Create: `web/js/persona.js`, `web/js/map.js`
- Modify: `web/index.html` (persona chip row, bookmark button, gauge into sheet), `web/js/app.js`, `web/js/i18n.js`, `web/css/app.css`

**Interfaces:**
- Consumes: `Store` (Task 3), tokens (Task 1).
- Produces:
  - `PERSONAS` — ordered array `["umum","keluarga","mahasiswa","lansia","pekerja"]`.
  - `PERSONA_WEIGHTS[personaKey][categoryKey]` → number, per spec §6.1.
  - `rescore(payload, personaKey)` → `{score, breakdown}` where `breakdown[cat] = {count, weight, score}` re-weighted.
  - `personaTopCategories(personaKey, n)` → array of category keys, highest weight first.
  - `setCenterLabel(lat, lon, label, score, bandVar)` in `map.js` — the name+score pill marker.

- [ ] **Step 1: Write `web/js/persona.js`.** `umum` must be byte-identical to `radius_core.CATEGORY_WEIGHTS`:

```js
const PERSONAS = ["umum", "keluarga", "mahasiswa", "lansia", "pekerja"];
const PERSONA_WEIGHTS = {
  umum:      { warung_minimarket: 20, kuliner: 10, sekolah: 15, faskes: 20, transit: 20, taman_ruang_terbuka: 10, peribadatan: 5 },
  keluarga:  { warung_minimarket: 15, kuliner: 5,  sekolah: 25, faskes: 25, transit: 12, taman_ruang_terbuka: 15, peribadatan: 3 },
  mahasiswa: { warung_minimarket: 25, kuliner: 25, sekolah: 2,  faskes: 10, transit: 25, taman_ruang_terbuka: 10, peribadatan: 3 },
  lansia:    { warung_minimarket: 20, kuliner: 4,  sekolah: 1,  faskes: 35, transit: 10, taman_ruang_terbuka: 15, peribadatan: 15 },
  pekerja:   { warung_minimarket: 25, kuliner: 20, sekolah: 2,  faskes: 12, transit: 30, taman_ruang_terbuka: 8,  peribadatan: 3 },
};

function rescore(payload, personaKey) {
  const w = PERSONA_WEIGHTS[personaKey] || PERSONA_WEIGHTS.umum;
  const src = payload.breakdown || {};
  let total = 0, weightSum = 0;
  const breakdown = {};
  for (const [cat, weight] of Object.entries(w)) {
    const item = src[cat];
    if (!item) continue;
    const factor = item.weight ? item.score / item.weight : 0;  // 0 | 0.75 | 1
    const catScore = weight * factor;
    breakdown[cat] = { count: item.count, weight, score: Math.round(catScore * 10) / 10 };
    total += catScore;
    weightSum += weight;
  }
  if (!weightSum) return { score: payload.score, breakdown: src };
  return { score: Math.round((total * 100 / weightSum) * 10) / 10, breakdown };
}

function personaTopCategories(personaKey, n) {
  const w = PERSONA_WEIGHTS[personaKey] || PERSONA_WEIGHTS.umum;
  return Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}
```

- [ ] **Step 2: Move the map code into `web/js/map.js`** — the `maplibregl.Map` construction, `addCustomLayers` (**keeping** the `isStyleLoaded()` guard verbatim), `setIsochrone`, `setPois`, `poiFeatures`, `geomBounds`, `fitIsochrone`, `circleColorExpr`, `firstSymbolId`, the POI click handler, `POI_POPUP_HTML`, `wirePoiPopup`, `openDirections`, `getUserLocation`. Behaviour must not change. Delete them from `app.js`.

- [ ] **Step 3: Replace `setCenterMarker` with the labelled pin** in `map.js`, per canvas f3:

```js
let centerMarker = null;
function setCenterLabel(lat, lon, label, score, bandVar) {
  if (centerMarker) centerMarker.remove();
  const el = document.createElement("div");
  el.className = "center-pin";
  el.innerHTML = `<span class="cp-pill"><span class="cp-name"></span><i class="cp-div"></i><span class="cp-score"></span></span><span class="cp-stem"></span><span class="cp-dot"></span>`;
  el.querySelector(".cp-name").textContent = label || "";
  const scoreEl = el.querySelector(".cp-score");
  if (score == null) { el.querySelector(".cp-div").hidden = true; scoreEl.hidden = true; }
  else { scoreEl.textContent = String(score); scoreEl.style.color = cssVal(bandVar); }
  centerMarker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([lon, lat]).addTo(map);
}
```
`anchor: "bottom"` so the dot sits on the coordinate.

- [ ] **Step 4: Add the persona chip row and bookmark button** to `web/index.html`. Chip row above the sheet: `<div class="chip-row" id="persona-row" role="radiogroup">` with one `<button class="chip" role="radio" data-persona="...">` per persona. Bookmark: `<button class="icon-btn" id="bookmark-btn">` in the map's floating header, with `bookmark` / `bookmark-fill` `<use>` swapped by class.

- [ ] **Step 5: Wire persona selection** in `app.js`:

```js
state.persona = Store.get("persona", "umum");
if (!PERSONAS.includes(state.persona)) state.persona = "umum";

els.personaRow.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-persona]");
  if (!btn) return;
  state.persona = btn.dataset.persona;
  Store.set("persona", state.persona);
  if (state.lastData) renderResult(state.lastData, { refetchDock: false });
  syncPersonaChips();
});
```
`syncPersonaChips()` sets `aria-checked` and the `is-on` class.

- [ ] **Step 6: Apply the persona inside `renderResult()`.** Immediately after `state.lastData = data`, derive the view model and use it everywhere the raw payload was used for score/breakdown:

```js
const view = rescore(data, state.persona);
const score = Math.round(view.score);
const band = bandFor(view.score);
const items = Object.entries(view.breakdown)
  .filter(([key]) => CATEGORY_META[key])
  .map(([key, item]) => ({ key, ...item }));
```
`els.ringValue.style.left` uses `view.score`. The persona badge shows when `state.persona !== "umum"`:

```js
els.personaBadge.hidden = state.persona === "umum";
if (state.persona !== "umum")
  els.personaBadge.textContent = t("persona.adjusted", { persona: t("persona." + state.persona) });
```
And rows whose category is in `personaTopCategories(state.persona, 2)` get `li.classList.add("row-persona")` when `count <= 1`.

- [ ] **Step 7: Wire the bookmark button:**

```js
els.bookmarkBtn.addEventListener("click", () => {
  if (!state.center || !state.lastData) return;
  const on = Store.toggleSaved({
    label: state.locationLabel || t("result.captionFallback"), kelurahan: "",
    lat: state.center.lat, lon: state.center.lon, minutes: state.minutes,
    score: state.lastScore ?? 0, band: "", total: null, at: new Date().toISOString(),
  });
  syncBookmark(on);
});
```
`syncBookmark(on)` toggles `.is-on` and swaps the `<use href>`; call it from `renderResult()` too so the state is right on load.

- [ ] **Step 8: Move the gauge into the sheet.** In `app.css`, the `.band-scale` block moves inside the sheet flow (canvas f3 puts it in a `--warn-bg` inset card below the verdict) and the floating-over-map positioning is removed.

- [ ] **Step 9: Add script tags and i18n keys.** `persona.js` and `map.js` load after `format.js`, before `app.js`; `map.js` must load **after** `maplibre-gl.js`. Keys: `persona.umum`, `persona.keluarga`, `persona.mahasiswa`, `persona.lansia`, `persona.pekerja`, `persona.adjusted`, `persona.label`, `save.add`, `save.remove`, `save.added`, `save.removed`, `gauge.low`, `gauge.high`.

- [ ] **Step 10: Verify the persona identity in the preview.** This is the correctness gate for the whole feature:

```js
JSON.stringify([state.lastData.score, rescore(state.lastData, "umum").score])
```
Expected: the two numbers are equal. Then switch to `keluarga` on a point missing `sekolah`/`faskes` and confirm `#score-num` drops. Confirm the pin pill shows `name │ score`, and `map.queryRenderedFeatures({layers:["radius-buildings"]}).length > 0` still proves the 3D layer paints.

- [ ] **Step 11: Run pytest** — `44 passed`.

- [ ] **Step 12: Commit**

```bash
git add web/js/persona.js web/js/map.js web/js/app.js web/index.html web/js/i18n.js web/css/app.css
git commit -m "feat(peta): persona-weighted score, name+score map pin, bookmark"
```

---

### Task 5: Kalkulator — rent stepper, work location, commuter cost

**Files:**
- Create: `web/js/cost.js`
- Modify: `web/index.html` (`#cost-view` rebuild), `web/js/app.js`, `web/js/i18n.js`, `web/css/app.css`

**Interfaces:**
- Consumes: `haversineKm` (Task 3), `Store`.
- Produces:
  - `COMMUTE = {RATE_PER_KM: 2075, MIN_FARE: 9000, ROUND_TRIPS: 30, SPEED_KMH: 22, RANGE_MARGIN: 0.20}`.
  - `commuterCost(home, work)` → `{km, fareOneway, monthly, low, high, hours}` or `null` when either point is missing.
  - `totalRange(rent, serverEst, commute)` → `{low, high}`.

- [ ] **Step 1: Write `web/js/cost.js`:**

```js
const COMMUTE = { RATE_PER_KM: 2075, MIN_FARE: 9000, ROUND_TRIPS: 30, SPEED_KMH: 22, RANGE_MARGIN: 0.20 };

function commuterCost(home, work) {
  if (!home || !work) return null;
  const km = haversineKm(home, work);
  const fareOneway = Math.max(COMMUTE.MIN_FARE, COMMUTE.RATE_PER_KM * km);
  const monthly = Math.round(COMMUTE.ROUND_TRIPS * 2 * fareOneway / 1000) * 1000;
  return {
    km,
    fareOneway: Math.round(fareOneway),
    monthly,
    low: Math.round(monthly * (1 - COMMUTE.RANGE_MARGIN) / 1000) * 1000,
    high: Math.round(monthly * (1 + COMMUTE.RANGE_MARGIN) / 1000) * 1000,
    hours: Math.round(COMMUTE.ROUND_TRIPS * 2 * km / COMMUTE.SPEED_KMH),
  };
}

function totalRange(rent, serverEst, commute) {
  const s = serverEst && serverEst.range ? serverEst.range : { low: 0, high: 0 };
  const c = commute ? { low: commute.low, high: commute.high } : { low: 0, high: 0 };
  return { low: rent + s.low + c.low, high: rent + s.high + c.high };
}
```
Rounding to Rp1,000 mirrors `app/costs.py::_round_rp` — no fake precision.

- [ ] **Step 2: Rebuild `#cost-view`** per canvas f4/f4b, keeping every contract id (`rent-input`, `cost-lines`, `cost-notes`, `cost-summary`, `cost-rent`, `cost-extra`, `cost-total`, `cost-disclaimer`, `compare-save`, `mini-*`): back-chevron header, location pill, a `.stepper` wrapping `#rent-input` with `−`/`+` buttons, a work-location block (`#work-input`, `#work-results`, `#work-error`, `#work-gps`), the dark `#total-card`, and two `.stat-tile`s `#commute-cost` / `#commute-time`.

- [ ] **Step 3: Wire the rent stepper.** Step is Rp100,000, floor 0, and it must reuse the existing `parseRent` + locale formatting so both paths agree:

```js
els.rentStep.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-step]");
  if (!btn) return;
  const delta = Number(btn.dataset.step) * 100000;
  state.rent = Math.max(0, state.rent + delta);
  els.rentInput.value = state.rent > 0 ? state.rent.toLocaleString(getLang() === "en" ? "en-US" : "id-ID") : "";
  Store.set("rent", state.rent);
  updateCostSummary();
});
```

- [ ] **Step 4: Wire the work-location search.** Reuse `/api/geocode` through a shared helper so `#/peta` and this field cannot drift:

```js
async function geocodeInto(query, listEl, errEl, onPick) {
  errEl.hidden = true;
  try {
    const resp = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).detail || t("search.failed"));
    const { results } = await resp.json();
    listEl.replaceChildren();
    if (!results.length) { errEl.textContent = t("search.notFound"); errEl.hidden = false; listEl.hidden = true; return; }
    for (const r of results) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button"; b.textContent = r.name;
      b.addEventListener("click", () => { listEl.hidden = true; onPick(r); });
      li.appendChild(b); listEl.appendChild(li);
    }
    listEl.hidden = false;
  } catch (err) { errEl.textContent = err.message; errEl.hidden = false; listEl.hidden = true; }
}
```
On pick: `state.work = {lat, lon, label}`, `Store.set("work", state.work)`, then `updateCostSummary()`. `#work-gps` calls the existing `getUserLocation()` and shows `t("poi.locDenied")` / `t("poi.locFail")` on rejection.

- [ ] **Step 5: Extend `updateCostSummary()`** to render both states of the total card. Without a work location it shows `fmtRp(rent) + t("cost.plusRides")` and the lime prompt `t("cost.needWork")` (canvas f4); with one it shows the full total, a `Sewa` row, an `Ojol/GoFood komuter (30x)` row using `t("cost.commuteRow", {n: COMMUTE.ROUND_TRIPS})`, and fills the two stat tiles with `fmtRange(low, high)` and `t("cost.hoursPerMonth", {n: hours})`.

- [ ] **Step 6: Restore rent and work from the store** in `init()`, and repaint on language change (the thousands separator is locale-dependent).

- [ ] **Step 7: Add i18n keys**: `cost.back`, `cost.locationLabel`, `cost.workLabel`, `cost.workPlaceholder`, `cost.workGps`, `cost.needWork`, `cost.plusRides`, `cost.commuteRow`, `cost.commuteCost`, `cost.commuteTime`, `cost.hoursPerMonth`, `cost.totalCardLabel`, `cost.scoreFootnote`, `cost.commuteDisclaimer`.

- [ ] **Step 8: Verify in the preview.** Pin the arithmetic:

```js
JSON.stringify(commuterCost({lat:-6.9150,lon:107.6590},{lat:-6.9175,lon:107.6098}))
```
Expected: `km` ≈ 5.45, `monthly` ≈ 679000, `hours` ≈ 15. Then confirm the total card switches from the partial to the full state when a work location is picked, and that `#cost-total` equals `totalRange(...)`.

- [ ] **Step 9: Run pytest** — `44 passed`.

- [ ] **Step 10: Commit**

```bash
git add web/js/cost.js web/index.html web/js/app.js web/js/i18n.js web/css/app.css
git commit -m "feat(biaya): rent stepper, work location, commuter and time cost"
```

---

### Task 6: Comparison screen

**Files:**
- Create: nothing
- Modify: `web/index.html` (`#banding-screen`), `web/js/app.js` (`renderCompare` rewrite), `web/js/i18n.js`, `web/css/app.css`

**Interfaces:**
- Consumes: `Store`, `commuterCost`, `totalRange`, `fmtRp`, `fmtRange`.
- Produces: `renderCompare()` handling all five states; `state.compare` entries gain `commute` (the mid-point monthly figure) so the verdict is computable without a refetch.

- [ ] **Step 1: Add `#banding-screen`** with `data-screen="banding"`: back-chevron header showing `A vs B`, `#compare-verdict`, `#compare-grid` (kept id), `#compare-note`, plus `#compare-loading` and `#compare-error` blocks. Keep `#compare-card` and `#compare-clear`.

- [ ] **Step 2: Compute the verdict.** Neutral band is `< 2%` of the smaller total:

```js
function compareVerdict(a, b) {
  const ta = a.rent + a.subtotal + (a.commute || 0);
  const tb = b.rent + b.subtotal + (b.commute || 0);
  const diff = Math.abs(ta - tb);
  const base = Math.min(ta, tb) || 1;
  if (diff / base < 0.02) return { kind: "tie", diff, winner: -1, ta, tb };
  const winner = ta < tb ? 0 : 1;
  const winScore = winner === 0 ? a.score : b.score;
  const loserScore = winner === 0 ? b.score : a.score;
  return { kind: winScore < loserScore ? "win-lower-score" : "win", diff, winner, ta, tb };
}
```

- [ ] **Step 3: Render the three result states.** `tie` → `.verdict-card.is-tie` on `--olive`, no card highlighted, copy `t("compare.tie", {diff})` deferring to the walk score. `win` → deep-green card, lime `t("compare.cheapest", {side})` badge, winner card gets `.win` (2px `--good` border) and a `TERMURAH` badge. `win-lower-score` → same as `win` but copy `t("compare.winLowerScore", {...})`, which states outright that the cheaper location scores worse.

- [ ] **Step 4: Render loading and error.** Loading (f7d): `#compare-loading` shows a `.spinner` plus two `.skeleton` blocks, and the verdict/grid are hidden. Error (f7e): `#compare-error` names the side — `t("compare.errNotFound", {side: t("compare.sideB")})` — with a `Cari Alamat Lain` button that focuses the search field. A generic message is not acceptable.

- [ ] **Step 5: Route the Beranda and sheet CTAs** to `#/banding`, and keep `#compare-save` working from `#/biaya` — it now also stores `commute` so the verdict can be recomputed without a refetch.

- [ ] **Step 6: Add i18n keys**: `compare.headTitle`, `compare.sideA`, `compare.sideB`, `compare.cheapest`, `compare.tie`, `compare.win`, `compare.winLowerScore`, `compare.badgeCheapest`, `compare.loading`, `compare.errNotFound`, `compare.errCta`, `compare.rowCommute`, `compare.rowTotalMonth`.

- [ ] **Step 7: Verify all five states in the preview** by driving `state.compare` directly:

```js
state.compare = [
  {label:"Dago Atas", minutes:15, score:78, rent:2400000, subtotal:300000, commute:0, low:300000, high:300000},
  {label:"Antapani",  minutes:15, score:55, rent:1400000, subtotal:1700000, commute:0, low:1700000, high:1700000},
];
renderCompare(); document.querySelector("#compare-verdict").className
```
Expected: the non-tie class, `Lokasi A` highlighted. Then set both totals within 1% and confirm `is-tie` with no highlight; then make B's score higher than A's while A is cheaper and confirm the `win-lower-score` copy appears.

- [ ] **Step 8: Run pytest** — `44 passed`.

- [ ] **Step 9: Commit**

```bash
git add web/index.html web/js/app.js web/js/i18n.js web/css/app.css
git commit -m "feat(banding): full comparison screen with verdict card and all five states"
```

---

### Task 7: Tersimpan and Riwayat

**Files:**
- Create: nothing
- Modify: `web/index.html` (`#tersimpan-screen`), `web/js/app.js`, `web/js/i18n.js`, `web/css/app.css`

**Interfaces:**
- Consumes: `Store.saved/history/toggleSaved`, `fmtRelativeTime`, `fmtRp`.
- Produces: `renderTersimpan()`; `state.savedTab ∈ {"saved","history"}`.

- [ ] **Step 1: Add `#tersimpan-screen`** with `data-screen="tersimpan"`: `Tersimpan` title, a `.segmented-pill` with two tabs (`#tab-saved`, `#tab-history`), `#saved-list`, `#saved-empty`, `#history-list`, `#history-empty`.

- [ ] **Step 2: Render saved cards** per canvas f8b — 46px gradient thumb, label, `kelurahan · Rp…/bln` sub, band-coloured score, filled bookmark that un-saves on click and re-renders. The thumb gradient is derived from the score band so it is meaningful rather than decorative.

- [ ] **Step 3: Render the empty state** per f8a — bookmark glyph in a circle, `Belum ada lokasi tersimpan`, sub, and a `Cek Lokasi Sekarang` button routing to `#/peta`.

- [ ] **Step 4: Render the history timeline** per f8c — `.timeline` rows with a dot (solid for today via `.is-today`, faded otherwise), the `fmtRelativeTime` label, and a card with label + band-coloured score. Clicking a row re-runs the analysis at those coordinates:

```js
row.addEventListener("click", () => {
  state.minutes = h.minutes;
  state.locationLabel = h.label;
  location.hash = "#/peta";
  map.jumpTo({ center: [h.lon, h.lat], zoom: 15 });
  runAnalysis(h.lat, h.lon);
});
```

- [ ] **Step 5: Wire the tab switch**, persist to `Store.set("savedTab", …)`, and call `renderTersimpan()` from `applyView()` when `view === "tersimpan"` and from `refreshLanguage()`.

- [ ] **Step 6: Add i18n keys**: `saved.title`, `saved.tabSaved`, `saved.tabHistory`, `saved.emptyTitle`, `saved.emptyBody`, `saved.emptyCta`, `saved.perMonth`, `history.emptyTitle`, `history.emptyBody`.

- [ ] **Step 7: Verify in the preview:**

```js
Store.set("saved", [{id:"a",label:"Dago Atas",kelurahan:"Coblong",lat:-6.86,lon:107.61,minutes:15,score:78,total:2700000,at:new Date().toISOString()}]);
location.hash = "#/tersimpan"; renderTersimpan();
document.querySelectorAll("#saved-list > *").length
```
Expected: `1`, empty state hidden. Clear the list and confirm the empty state appears. Switch to Riwayat and confirm today's row renders `.is-today`.

- [ ] **Step 8: Run pytest** — `44 passed`.

- [ ] **Step 9: Commit**

```bash
git add web/index.html web/js/app.js web/js/i18n.js web/css/app.css
git commit -m "feat(tersimpan): saved locations and history timeline"
```

---

### Task 8: Pengaturan with tri-state theme

**Files:**
- Create: nothing
- Modify: `web/index.html` (`#pengaturan-screen`), `web/js/app.js` (theme model), `web/js/i18n.js`, `web/css/app.css`

**Interfaces:**
- Consumes: `Store`.
- Produces: `themeMode()` → `"auto"|"light"|"dark"`; `setThemeMode(mode)`; `applyTheme()` unchanged in signature so existing callers keep working.

- [ ] **Step 1: Add `#pengaturan-screen`** per canvas f6: back-chevron header, `Tampilan` group (a 3-way `.segmented-pill` `#theme-seg` with `data-theme-mode="auto|light|dark"`, and the ID/EN `.lang-pill`), `Data` group (map-source row, `Hapus riwayat lokasi` in `--bad`), and the footer logo + `RADIUS versi 1.0 · …` line. The `Akun` group is omitted — there is no account this pass.

- [ ] **Step 2: Replace the binary theme model** in `app.js`. `radius_theme` now stores three values, and `auto` means the attribute is absent:

```js
function themeMode() {
  const m = Store.get("theme", "auto");
  return m === "light" || m === "dark" ? m : "auto";
}
function setThemeMode(mode) {
  const m = mode === "light" || mode === "dark" ? mode : "auto";
  Store.set("theme", m);
  if (m === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", m);
  applyTheme();
  syncThemeControls();
}
function toggleTheme() {  // header button cycles
  setThemeMode({ auto: "light", light: "dark", dark: "auto" }[themeMode()]);
}
```
`Store.get("theme", …)` reads the same `radius_theme` key the pre-paint script reads. **Note the encoding change:** `Store.set` writes JSON, so the value becomes `"dark"` with quotes. Update the pre-paint script in `web/index.html` to strip them so a stored choice still applies before first paint:

```js
var t = (localStorage.getItem("radius_theme") || "").replace(/"/g, "");
if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t);
```
This also keeps reading a pre-upgrade unquoted value, so no migration is needed.

- [ ] **Step 3: Confirm the pre-paint script covers `auto`.** With the Step 2 edit, `"auto"` matches neither branch, so no attribute is set and `prefers-color-scheme` governs — correct, and no flash.

- [ ] **Step 4: Wire the segmented control and clear-history row:**

```js
els.themeSeg.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-theme-mode]");
  if (b) setThemeMode(b.dataset.themeMode);
});
els.clearHistory.addEventListener("click", () => {
  Store.clearHistory();
  renderTersimpan();
  renderBeranda();
  els.clearHistoryDone.hidden = false;
});
```
`syncThemeControls()` sets `aria-checked` on the three segments and keeps the header button's icon in sync.

- [ ] **Step 5: Add i18n keys**: `set.title`, `set.groupDisplay`, `set.theme`, `set.themeAuto`, `set.themeLight`, `set.themeDark`, `set.lang`, `set.groupData`, `set.mapSource`, `set.mapSourceSub`, `set.clearHistory`, `set.clearHistoryDone`, `set.version`.

- [ ] **Step 6: Verify all three modes in the preview**, including that `auto` really follows the OS:

```js
setThemeMode("dark");  document.documentElement.getAttribute("data-theme")   // "dark"
setThemeMode("auto");  document.documentElement.getAttribute("data-theme")   // null
Store.get("theme", "?")                                                       // "auto"
```
Then `resize_window` with `colorScheme: "dark"` while in `auto` and confirm `--surface` resolves to `#161d18`; reload and confirm the choice survived first paint with no flash.

- [ ] **Step 7: Run pytest** — `44 passed`.

- [ ] **Step 8: Commit**

```bash
git add web/index.html web/js/app.js web/js/i18n.js web/css/app.css
git commit -m "feat(pengaturan): settings screen with tri-state theme and clear history"
```

---

### Task 9: i18n completion, PWA precache, full QA sweep

**Files:**
- Create: `web/js/selfcheck.js` (contract assertion, loaded last)
- Modify: `web/sw.js`, `web/js/i18n.js`, `web/index.html`, plus any fix the sweep turns up

**Interfaces:**
- Consumes: everything.
- Produces: `radiusSelfCheck()` → `{missingIds: [], missingKeys: [], personaIdentity: bool}`.

- [ ] **Step 1: Bump the service worker.** `CACHE = "radius-shell-v3"` and add every new asset. The list must match the tree **exactly** — one missing path makes `addAll` reject and precaching silently fails:

```js
const SHELL = [
  "/", "/index.html", "/css/tokens.css", "/css/base.css", "/css/components.css",
  "/css/app.css", "/js/i18n.js", "/js/store.js", "/js/format.js", "/js/persona.js",
  "/js/cost.js", "/js/map.js", "/js/app.js", "/js/selfcheck.js",
  "/vendor/maplibre/maplibre-gl.css", "/vendor/maplibre/maplibre-gl.js",
  "/vendor/icons/sprite.svg", "/vendor/fonts/outfit-variable.woff2",
  "/manifest.webmanifest",
];
```

- [ ] **Step 2: Write `web/js/selfcheck.js`** asserting the contract from spec §7:

```js
function radiusSelfCheck() {
  const IDS = ["search-input","search-results","search-error","duration-group","demo-chips",
    "state-empty","state-loading","result-view","notice-demo","notice-demo-text","ring-value",
    "score-num","score-band","score-caption","score-cached","verdict-gap","breakdown-title",
    "category-list","map","menu-screen","analysis-view","cost-view","rent-input","cost-lines",
    "cost-notes","cost-summary","cost-rent","cost-extra","cost-total","cost-disclaimer",
    "compare-save","compare-card","compare-grid","compare-clear","mini-score","mini-band",
    "mini-caption","panel","sheet-handle"];
  const missingIds = IDS.filter((id) => !document.getElementById(id));
  const idKeys = Object.keys(STRINGS.id), enKeys = Object.keys(STRINGS.en);
  const missingKeys = [
    ...idKeys.filter((k) => !enKeys.includes(k)).map((k) => "en:" + k),
    ...enKeys.filter((k) => !idKeys.includes(k)).map((k) => "id:" + k),
  ];
  const dom = [...document.querySelectorAll("[data-i18n]")].map((e) => e.dataset.i18n);
  const missingDom = dom.filter((k) => !idKeys.includes(k)).map((k) => "dict:" + k);
  const personaIdentity = !state.lastData ||
    Math.abs(rescore(state.lastData, "umum").score - state.lastData.score) < 0.05;
  return { missingIds, missingKeys: [...missingKeys, ...missingDom], personaIdentity };
}
```

- [ ] **Step 3: Sweep for hardcoded Indonesian** in render paths:

Run: `grep -nE '(textContent|innerHTML)\s*=\s*"[^"]*[a-z]{3,} [a-z]{3,}' web/js/*.js`
Expected: no hit that is user-visible copy. Every one that is becomes a `t()` key added to both dictionaries.

- [ ] **Step 4: Run the self-check in the preview** on every route:

```js
["#/landing","#/masuk","#/menu","#/peta","#/biaya","#/banding","#/tersimpan","#/pengaturan"]
  .map(h => { location.hash = h; return [h, radiusSelfCheck()]; })
```
Expected: `missingIds: []`, `missingKeys: []`, `personaIdentity: true` for every route.

- [ ] **Step 5: Full matrix sweep in the preview.** For each of {ID, EN} × {light, dark} × {375×812, 1280×800}: navigate all eight routes, `read_console_messages` (must be empty of errors), and confirm no horizontal body scroll:

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```
Expected: `true` everywhere. Screenshot the redesigned Beranda, `#/peta` result and comparison as proof.

- [ ] **Step 6: Prove the map still paints** after all the refactoring:

```js
({ buildings: map.queryRenderedFeatures({layers:["radius-buildings"]}).length,
   iso: map.getSource("iso") != null, poi: map.getSource("poi") != null,
   pitch: map.getPitch() })
```
Expected: non-zero buildings, both sources present, pitch 45. Toggle the theme twice rapidly and re-run — this exercises the `30207b9` guard.

- [ ] **Step 7: Verify on the emulator over CDP.** Boot `D:\Sdk\emulator\emulator.exe -avd Pixel_10_Pro_XL`, start the server, `adb shell pm clear id.ac.upi.radius` to defeat the WebView asset cache, launch, then forward and drive CDP:

```bash
adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof id.ac.upi.radius)
```
Evaluate `radiusSelfCheck()` and the map probe from Step 6 through `Runtime.evaluate`. Do **not** use `adb screencap` — the WebView is a hardware surface and returns black. Confirm touch behaviours by hand: sheet drag snaps to two positions, persona chips scroll, tabbar routes.

- [ ] **Step 8: Run pytest one final time**

Run: `"D:\Collage\Radius-APP\.venv\Scripts\python.exe" -m pytest -q`
Expected: `44 passed`

- [ ] **Step 9: Commit and push**

```bash
git add web/sw.js web/js/i18n.js web/js/selfcheck.js web/index.html
git commit -m "chore(ui): complete i18n, bump PWA precache, add contract self-check"
git push origin main
```

---

## Self-Review

**Spec coverage.** §1 → recorded in the spec itself. §2 auth → Task 2 Step 2; §2 desktop → Task 1 + Task 9 Step 5 wide viewport. §3 tokens → Task 1; §3 typography → Global Constraints. §4 routes → Task 2. §5 file structure → Tasks 1, 3, 4, 5 create the files; Task 9 Step 1 registers them. §6.1 persona → Task 4. §6.2 saved/history → Tasks 3, 7. §6.3 commuter → Task 5. §6.4 comparison → Task 6. §6.5 tri-state theme → Task 8. §6.6 pin label → Task 4 Step 3. §6.7 icons → Task 1 Step 4. §7 contracts → Task 9 Step 2 asserts them mechanically. §8 error handling → Task 3 Step 1 (`localStorage`), Task 5 Step 4 (geocode), Task 6 Step 4 (comparison), Task 4 Step 1 (`rescore` zero-guard). §9 verification → Task 9. §10 omissions → nothing to build.

**Two gaps found and closed.**

1. `web/js/screens.js` appears in spec §5's file list but no task created it — the render functions land in `app.js` alongside the router and state they mutate, which keeps each render function next to its data. Resolved by dropping `screens.js` from the Task 9 `SHELL` list rather than creating an empty file. Recorded here instead of silently diverging from the spec.
2. Spec §6.5 claimed the pre-paint theme script "needs no change". False: routing the theme through `Store` JSON-encodes the value, so the script would read `"dark"` (with quotes) and match neither branch — the stored theme would stop applying before first paint. Task 8 Step 2 now strips quotes, which also still reads pre-upgrade unquoted values.

**Placeholder scan.** No TBD/TODO. Every code step carries real code; every verification step carries a runnable expression and its expected value.

**Type consistency.** `rescore(payload, personaKey)` → `{score, breakdown}`, consumed that way in Tasks 4 and 9. `commuterCost` → `{km, fareOneway, monthly, low, high, hours}`, read as `.low/.high/.hours` in Task 5; Task 6 stores the scalar mid-point as `commute`, which is what `compareVerdict` adds. `Store.toggleSaved` returns the new membership boolean in Tasks 3, 4 and 7. `setCenterLabel(lat, lon, label, score, bandVar)` is defined and called with five arguments. `fmtRp`/`fmtRange` live only in `format.js` after Task 3 Step 2. `PERSONAS` is a string array in both Task 4 Step 1 and its `PERSONAS.includes(...)` use in Step 5.
