# RADIUS Walkability Score Redesign — design spec

Date: 2026-07-30
Source of truth: Claude Design project `fad59be9-1e65-410a-a47d-9a83d80c65e9`,
file `RADIUS Alur Lengkap.dc.html`.
Baseline: `main` @ `5fb0a27` (MapLibre GL 3D map, i18n ID/EN, cost calculator,
compare card, PWA, Capacitor shell).

---

## 1. Which design source is authoritative

The design project holds four candidate sources. They are a **timeline**, not one
spec. Only the canvas is a target:

| Source | Status |
|---|---|
| `final/android-handoff/DESIGN-SPEC.md`, `PROMPT.md` | **Already implemented** (commit `cbd1120`). Stale in one respect: mandates CARTO `dark_all` raster tiles, superseded by OpenFreeMap vector styles in `53142fb`. |
| `final/web/index.html`, `css/app.css`, `js/app.js` | **Older than the repo.** Leaflet, no i18n, no menu screen, no cost calculator. Not a target. |
| `final/menu-patch/*` | **Superseded.** Self-dating: `z-index: 1200 /* di atas kontrol Leaflet (1000) */`. Its split-ink concentric-ring motif is preserved — canvas Landing (f1) is that motif, rendered as the product's entry screen. |
| `RADIUS Alur Lengkap.dc.html` | **Authoritative.** Carries live `data-comment-anchor` attributes and states the team's own resolved decisions in its header. |

Canvas header decisions, carried into this spec verbatim in intent:
dark bottom-nav pill kept; 5/10/15/20-minute duration chips kept; the
"susah–semua dekat" gauge kept but **moved into the bottom sheet** (no longer
floating over the map); map pin label now **merges name + score**; the
horizontally-scrolled "saved" rack is **removed** in favour of a static list.

## 2. Scope decisions (confirmed with user)

- **Auth: guest-first only.** Build canvas 5b (`RADIUS bisa dipakai tanpa akun`,
  prominent "Lanjut sebagai Tamu"). Saved locations and history are local.
  The Google/OTP affordance renders **disabled** with an honest note — no fake
  sign-in. Canvas 5a (phone + OTP) is not built: it requires backend endpoints
  and `app/` is frozen this pass.
- **Desktop: restyled to the new identity.** The new palette, type and
  components apply at every breakpoint; the existing desktop map + floating
  side panel keeps its shape, and the new screens get responsive wide layouts.
  This retires the old spec's "desktop TIDAK berubah" clause deliberately —
  keeping it would leave the product with two visual identities.
- **Backend frozen.** No file under `app/`, no `radius_core.py`, no
  `cost_assumptions.py` change. `pytest` must stay at 44 passing.

## 3. Design tokens

New values are re-pointed onto the **existing** custom-property names so the
~1150 lines of existing rules keep working instead of being rewritten.

### Light
```
--ink        #1c2116    ink-2 #5c6862   ink-3 #79847e   ink-4 #8a948e
--surface    #f3f1e6    (cream)         --surface-2 #eef0ec (page/landing)
--card       #ffffff    --line #eef0ec  --line-2 #e3e7e2
--accent     #0f2e22    (deep green)    --accent-ink #ffffff
--accent-soft #e2eee7                   --lime #d6e84a  --lime-ink #1c2116
--chrome     #1c2116    (bottom nav, dark pills)        --chrome-ink #aeb8a2
--olive      #3d4a1f    --spark #d1531f (logo dot)
--good #0e7d5e   --warn #8a6a14   --bad #a83b2f   --bad-2 #8f3f24
--good-bg #eef6f0  --warn-bg #f8f6ef  --bad-bg #f8f2ee  --bad-line #e3b8ab
--band-low #c8493a  --band-mid #e3b23a  --band-high #0e7d5e
```

### Dark (both `@media (prefers-color-scheme: dark)` on `:root:not([data-theme="light"])` and `:root[data-theme="dark"]`)
```
--ink #eef0ec   ink-2 #aeb8b0   ink-3 #8a948e
--surface #161d18   --surface-2 #121814   --card #22291f
--line #2c342a   --accent #9dc3ae   --accent-ink #12251d
--chrome #0c110d   --bad #e08672
```

Category colours (`--cat-*`) are **unchanged** — the map legend must stay
identical across themes and across this redesign.

Radii: `--r-pill 999px`, `--r-card 16px`, `--r-card-lg 20px`, `--r-sheet 24px`.
Shadows: `--sh-1 0 6px 16px rgba(28,33,22,.05)`, `--sh-2 0 10px 26px rgba(28,33,22,.08)`,
`--sh-sheet 0 -12px 30px rgba(28,33,22,.10)`.

### Typography — deliberate deviation
The canvas loads **Space Grotesk** from the Google Fonts CDN for headings and
numerals. That is a canvas convenience, not a product decision: the design
project vendors only `vendor/fonts/outfit-variable.woff2`, and the app is
keyless, offline-capable (PWA precache) and vendors every asset. Adding a font
binary would mean a network download and a larger shell for one typeface.

**Decision:** vendored Outfit (300–700) serves both roles. The display role gets
`font-weight: 700; letter-spacing: -0.01em` and tabular numerals for scores.
If the user wants literal Space Grotesk later it is a drop-in: vendor the woff2
and re-point `--font-display`.

## 4. Routes

Hash routing is kept — it is the existing mechanism and `#/menu`, `#/peta`,
`#/biaya` are referenced by the README, the sheet CTAs and the menu cards.

| Hash | Screen | Canvas | State |
|---|---|---|---|
| `#/landing` | Landing | f1 | new |
| `#/masuk` | Guest-first entry | 5b | new |
| `#/menu` | Beranda dashboard | f2 | **replaces** the 2-card menu |
| `#/peta` | Cek Lokasi + result sheet | f3, f3b | restyle + new features |
| `#/biaya` | Kalkulator Biaya | f4, f4b | restyle + new features |
| `#/banding` | Perbandingan 2 lokasi | f7a–f7e | new (was a card inside `#/biaya`) |
| `#/tersimpan` | Tersimpan / Riwayat | f8a–f8c | new |
| `#/pengaturan` | Pengaturan | f6, f6b | new |

Empty hash resolves to `#/landing` on first run, `#/menu` thereafter
(`store.seen_landing`). Unknown hash → `#/menu`.

`#menu-screen` keeps its element id (it is what `applyView()` toggles); its
contents become the Beranda dashboard.

**Bottom nav** (`.tabbar`, dark pill, canvas f2/f6/f8): 4 tabs →
Beranda `#/menu`, Cek Lokasi `#/peta`, Tersimpan `#/tersimpan`,
Pengaturan `#/pengaturan`. Visible on `#/menu`, `#/tersimpan`, `#/pengaturan`,
`#/banding`; hidden on `#/landing`, `#/masuk`, and on `#/peta`/`#/biaya`
(the bottom sheet owns that edge). Active tab = lime circle, per canvas.

On the two screens where the tabbar is hidden, the **back chevron in the screen
header is the exit affordance** — this matches canvas f3/f4, which show a back
chevron and no tabbar. It routes to `#/menu`.

## 5. File structure

`app.js` (1023 lines) and `app.css` (1154 lines) cannot absorb 6 more screens.
Split into ordered **classic** scripts — no ES modules, no build step, existing
globals (`t`, `getLang`, `applyI18n`) keep working:

```
web/css/tokens.css       palette, themes, type scale, radii, shadows
web/css/base.css         element defaults, icons, a11y utilities, layout primitives
web/css/components.css   tabbar, pills, cards, chips, sheet, segmented, stat tiles,
                         verdict, gauge, category rows, timeline, steppers
web/css/app.css          screen composition, responsive/desktop, map furniture
web/js/i18n.js           dictionary (ID/EN) — grows substantially
web/js/store.js          localStorage facade: theme, lang, persona, saved[],
                         history[], rent, work location, seen_landing
web/js/persona.js        persona weight tables + rescore()
web/js/format.js         fmtRp, fmtRange, relative dates, haversine
web/js/map.js            MapLibre init, layers, pin label, isochrone, POI popup
web/js/cost.js           commuter + time cost on top of server cost_estimate
web/js/screens.js        per-screen render functions
web/js/app.js            router, state, event wiring, init (entry point)
```

Load order in `index.html`: maplibre → i18n → store → format → persona → cost →
map → screens → app. Every new file is added to the `sw.js` precache list and
`CACHE` is bumped to `radius-shell-v3`.

## 6. New features

### 6.1 Persona-weighted score (f3b)
Five personas re-weight the seven categories client-side. `/api/analyze` already
returns `breakdown[cat] = {count, weight, score}`, and `score` is recoverable as
a factor: `f = score / weight ∈ {0, 0.75, 1}`. Rescore:

```
score_persona = Σ(w_p[cat] · f[cat]) / Σ(w_p[cat]) · 100
```

| Category | Umum (baseline) | Keluarga | Mahasiswa | Lansia | Pekerja |
|---|---|---|---|---|---|
| warung_minimarket | 20 | 15 | 25 | 20 | 25 |
| kuliner | 10 | 5 | 25 | 4 | 20 |
| sekolah | 15 | 25 | 2 | 1 | 2 |
| faskes | 20 | 25 | 10 | 35 | 12 |
| transit | 20 | 12 | 25 | 10 | 30 |
| taman_ruang_terbuka | 10 | 15 | 10 | 15 | 8 |
| peribadatan | 5 | 3 | 3 | 15 | 3 |

`Umum` is exactly `radius_core.CATEGORY_WEIGHTS`, so the default persona
reproduces the server score bit-for-bit — verified by asserting
`rescore(payload, "umum") === payload.score` at runtime in the QA sweep.

Non-default persona adds the badge `Disesuaikan untuk: {persona}` under the
verdict title, and the categories that persona weights highest get the warm
`--bad-line` inset border when they are missing or thin. Selection persists in
`store.persona`. The canvas's 55→47 figures are illustrative mock data, not a
target to fit.

### 6.2 Saved locations + history (f8a–f8c)
`store.saved[]` — `{id, label, kelurahan, lat, lon, minutes, score, band, total, savedAt}`,
capped at 50, keyed by rounded `lat,lon,minutes`. Bookmark button in the
Cek Lokasi header toggles membership; icon switches outline ↔ filled.
`store.history[]` — same shape plus `at`, capped at 50, newest first,
deduped on the same key. Written on every successful analysis.

Beranda stat tiles read from these: `lokasi dicek` = `history.length`,
`skor tertinggi` = `max(history.score)`, `tersimpan` = `saved.length`.
"Rekomendasi buat kamu" = highest-scoring history entry, falling back to
`demo_locations` when history is empty. Riwayat renders the canvas timeline
(solid dot for today, faded for older) with `Hari ini · HH:MM` /
`Kemarin · HH:MM` / `N hari lalu · HH:MM` labels.

### 6.3 Commuter + time cost (f4/f4b)
Server `cost_estimate` is untouched and still covers unreachable categories.
The work-location input adds a **separate** commuter block, computed client-side
from the GoRide Zone I figures already documented in `cost_assumptions.py`
(base Rp1,850–2,300/km, 4 km minimum Rp8,000–10,000):

```
km          = haversine(home, work)
fare_oneway = max(MIN_FARE, RATE_PER_KM · km)      RATE_PER_KM 2075, MIN_FARE 9000
commute     = ROUND_TRIPS · 2 · fare_oneway        ROUND_TRIPS 30
range       = commute ± 20%                        (mirrors app/costs.py RANGE_MARGIN)
time_hours  = ROUND_TRIPS · 2 · km / SPEED_KMH     SPEED_KMH 22
```

Rendered as the canvas's two stat cards ("Ongkos komuter / bulan" as a range,
"Biaya waktu" in hours/month) plus the `Ojol/GoFood komuter (30x)` line inside
the dark total card. Before a work location is set, the total card shows the
partial state of f4 (`Rp… + ongkos` with the lime prompt). Every constant is
named and surfaced in the disclaimer — these are assumptions, not measurements.
The mock's `14 jam/bln` is illustrative.

### 6.4 Comparison screen (f7a–f7e)
Full screen at `#/banding`, replacing the compare card inside `#/biaya`.
Two slots fed from `store.saved` or the current analysis. Verdict logic on
**total** (rent + extra + commuter), not score:

- `|Δ| / min(total) < 2%` → **neutral** olive verdict card, no card highlighted,
  copy defers to the walk score (f7c).
- otherwise → deep-green verdict card, `Termurah: Lokasi A|B` lime badge, winner
  card gets a `--good` 2px border and a `TERMURAH` badge (f7a/f7b). When the
  winner has the *lower* walk score, the copy says so explicitly — the verdict
  follows the money and admits when that contradicts the score.
- loading → spinner + two flat skeletons (f7d).
- error → names the failing side (`Lokasi B tidak ditemukan`), with a
  "Cari Alamat Lain" escape (f7e). Generic messages are not acceptable here.

The existing `#compare-card`, `#compare-grid`, `#compare-clear`, `#compare-save`
ids are retained and relocated into this screen so nothing that references them
breaks.

### 6.5 Tri-state theme (f6)
Today's control is a binary toggle. The canvas specifies
**Otomatis / Terang / Gelap**. `store.theme ∈ {auto, light, dark}`:
`auto` removes the `data-theme` attribute (falls back to
`prefers-color-scheme`), the others set it. The pre-paint inline script in
`<head>` already handles `light|dark` and needs no change for `auto`. The
existing `.theme-btn` toggle stays in the map/panel headers for quick access and
cycles `auto → light → dark`; the Pengaturan segmented control sets absolutes.

### 6.6 Map pin label (f3)
The bare `.center-pin` becomes a dark pill marker merging **name + score**, with
a stem and dot, per canvas: `Simpang Antapani │ 55`. Implemented as a
`maplibregl.Marker` with a DOM element (not a symbol layer) so it survives
`setStyle` theme swaps without re-adding. Score colour follows the band.

### 6.7 Icons
~12 symbols added to `web/vendor/icons/sprite.svg`, authored from the path data
already present in the canvas: `chevron-left`, `chevron-right`, `arrow-right`,
`house`, `user`, `bookmark`, `bookmark-fill`, `heart`, `sliders`, `trash`,
`plus`, `minus`, `spinner`. No downloads.

## 7. Preserved contracts

Verified against `web/js/app.js` before and after:

- **Element ids:** `search-input`, `search-results`, `search-error`,
  `duration-group`, `demo-chips`, `state-empty`, `state-loading`, `result-view`,
  `notice-demo`, `notice-demo-text`, `ring-value`, `score-num`, `score-band`,
  `score-caption`, `score-cached`, `verdict-gap`, `breakdown-title`,
  `category-list`, `map`, `menu-screen`, `analysis-view`, `cost-view`,
  `rent-input`, `cost-lines`, `cost-notes`, `cost-summary`, `cost-rent`,
  `cost-extra`, `cost-total`, `cost-disclaimer`, `compare-save`, `compare-card`,
  `compare-grid`, `compare-clear`, `mini-score`, `mini-band`, `mini-caption`,
  `panel`, `sheet-handle`.
- **API:** `/api/analyze?lat&lon&minutes`, `/api/geocode?q`, `/api/config`.
  No new endpoint, no changed parameter.
- **i18n:** every user-visible string goes through `t()`. No hardcoded
  Indonesian in render paths. New keys follow the existing dotted convention.
- **POI "arahin":** `wirePoiPopup`, `openDirections`, `getUserLocation`
  (including the Capacitor Geolocation native path and its permission handling)
  move to `map.js` unchanged in behaviour.
- **PWA:** `manifest.webmanifest` untouched; `sw.js` gains the new files and a
  bumped cache name.
- **MapLibre 3D:** OpenFreeMap `liberty`/`dark`, pitch 45, `radius-buildings`
  fill-extrusion, and the `addCustomLayers` unready-style guard from `30207b9`
  are all retained.

## 8. Error handling

- `localStorage` unavailable (private WebView): every `store` read/write is
  `try/catch`'d and degrades to an in-memory object. No screen may throw.
- Analysis failure: existing `showError()` path, unchanged.
- Geocode failure on the work-location or comparison inputs: inline error next
  to that field, naming which field failed.
- Comparison with one slot empty: slot placeholder, no verdict card.
- Missing `cost_estimate` in a payload: `EMPTY_COST` fallback, as today.
- A persona whose weights sum to 0 is impossible by construction; `rescore`
  still guards division by zero and returns the server score.

## 9. Verification

- `pytest` → 44 passed, run with `.venv\Scripts\python.exe` from the repo root.
- Browser preview (`.claude/launch.json` config `radius`): every route rendered,
  console clean, `map.queryRenderedFeatures` proves the isochrone/POI/building
  layers actually paint, both themes, both languages, mobile + desktop viewport.
- Emulator (`Pixel_10_Pro_XL`, app `id.ac.upi.radius`): verified over **CDP**
  `Runtime.evaluate`, not `adb screencap` (hardware surface returns black).
  Hard-reload or `adb shell pm clear id.ac.upi.radius` after redeploy — the
  WebView caches assets across snapshots.
- Contract sweep: assert every id in §7 resolves, and
  `rescore(payload,"umum") === payload.score`.

## 10. Deliberate omissions

- **Canvas 5a (phone + OTP login)** — needs backend endpoints; `app/` frozen.
- **Beranda notification bell** — no data source exists anywhere in the product;
  rendering a badge would be fabricated state.
- **Beranda filter chips** (`Dekat kerja`, `Sekolah`) — no saved-place taxonomy
  exists to filter on. The persona chips on `#/peta` deliver the same intent
  with real behaviour, so these are dropped rather than faked as dead UI.
- **`final/web/` and `final/menu-patch/`** — superseded per §1.

## 11. Parts (one commit each)

1. Foundation — tokens, base, components, sprite symbols, file split scaffold
2. Chrome & routing — tabbar, Landing, guest entry, extended router
3. Beranda dashboard + `store.js`
4. Cek Lokasi — persona chips, pin label, bookmark, gauge in sheet
5. Kalkulator — rent stepper, work location, commuter + time cost
6. Comparison screen — 5 states
7. Tersimpan + Riwayat
8. Pengaturan — tri-state theme, language, clear history
9. i18n completion, `sw.js` precache, full QA sweep (preview + emulator)
