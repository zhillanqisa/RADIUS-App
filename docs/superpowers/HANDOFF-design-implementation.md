# RADIUS — Handoff prompt for the redesign implementation (new room, Opus 5 + ultracode)

> Paste the **"PROMPT TO PASTE"** block below into a fresh Claude Code room.
> First switch the model to **Opus 5** and type **ultracode** so it opts into
> multi-agent orchestration. Open the room in this repo
> (`D:\Collage\Radius-APP`) so all committed context is already present.

---

## Where things stand (already done, committed, pushed to origin/main)

- The map engine was migrated **Leaflet → MapLibre GL JS (3D)**, keyless via
  OpenFreeMap (`liberty` light ↔ `dark`). Branch merged to `main` at commit
  `30207b9`. Verified: pytest 44 pass, 3D building extrusions + pitch, live
  analysis → isochrone + POI, POI "arahin" popup, dark/light swap, and it runs
  on the Pixel emulator WebView.
- Design docs live in the repo: `docs/superpowers/specs/2026-07-15-maplibre-3d-migration-design.md`
  and `docs/superpowers/plans/2026-07-15-maplibre-3d-migration.md`.
- The frontend is `web/` (static, no build step), served by FastAPI in `app/`.
  Backend is **not** to be touched (pytest must stay 44 green).

## The Claude Design source (readable via the DesignSync tool)

Project: **"RADIUS Walkability Score Redesign"**
`projectId = fad59be9-1e65-410a-a47d-9a83d80c65e9` — `canEdit: true`, auth already
granted through the claude.ai login (DesignSync read methods work with no prompt).

Files that matter (read with `DesignSync get_file`, one at a time):
- `RADIUS Alur Lengkap.dc.html` — the main flow/redesign canvas (primary source).
- `android-frame.jsx`, `support.js` — imported by that canvas.
- `final/android-handoff/DESIGN-SPEC.md` — the written spec.
- `final/android-handoff/PROMPT.md` — the designer's own implementation prompt.
- `final/web/index.html`, `final/web/css/app.css`, `final/web/js/app.js` — a
  fully-built reference implementation of the redesign.
- `final/menu-patch/*` — a menu redesign patch (`INSTRUKSI.txt`, `menu.css`,
  `index-menu-snippet.html`).
- `data/demo-itb-15.json`, `uploads/*.png` (screenshots), `vendor/*` (fonts/icons).

## Environment gotchas (carry these into the new room)

- **venv is in the MAIN repo root**, not in worktrees:
  `"D:\Collage\Radius-APP\.venv\Scripts\python.exe"`. Run pytest from the repo
  cwd with that interpreter. Server:
  `.venv\Scripts\python.exe -m uvicorn app.server:app --host 127.0.0.1 --port 8000`.
- **Frontend verify without blind tapping:** `mcp__Claude_Preview__preview_start`
  (config "radius" in `.claude/launch.json`) + `preview_eval` runs JS in a headless
  browser where MapLibre WebGL actually paints — use `map.queryRenderedFeatures(...)`
  to prove render, `preview_console_logs` for errors, `preview_screenshot` for proof.
- **Emulator:** `D:\Sdk\emulator\emulator.exe -avd Pixel_10_Pro_XL`
  (`JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"`). App id `id.ac.upi.radius`
  loads `http://10.0.2.2:8000` per `capacitor.config.json`. The WebView is a
  **hardware surface → `adb screencap` returns black**; verify with CDP instead
  (forward `tcp:9222` → `localabstract:webview_devtools_remote_<pid>`, then CDP
  `Runtime.evaluate`). The WebView also **caches assets across snapshots** — after
  a redeploy, hard-reload the page or `adb shell pm clear id.ac.upi.radius` to
  pull new code.
- **ECC GateGuard:** the first Write/Bash per file per session is denied once
  with a "[Fact-Forcing Gate]" message. State the requested facts briefly, then
  retry the identical call — it succeeds.
- **Contracts to preserve** (unchanged through any redesign): element ids
  (`search-input`, `duration-group`, `score-num`, `category-list`, …), API
  (`/api/analyze`, `/api/geocode`, `/api/config`), i18n `t()` (ID/EN), POI
  "arahin" (`wirePoiPopup`/`openDirections`/`getUserLocation`), Capacitor
  Geolocation, PWA (manifest + `sw.js`), and the MapLibre 3D map that now exists.

---

## PROMPT TO PASTE

```
ultracode

Implement the "RADIUS Walkability Score Redesign" from Claude Design into this
repo's frontend (web/), building on the MapLibre 3D map that already shipped to
main (commit 30207b9). Backend (app/) stays untouched — pytest must stay 44 green.

Read the design first with the DesignSync tool (auth already works):
- projectId fad59be9-1e65-410a-a47d-9a83d80c65e9
- get_file, one at a time: "RADIUS Alur Lengkap.dc.html", "android-frame.jsx",
  "support.js", "final/android-handoff/DESIGN-SPEC.md",
  "final/android-handoff/PROMPT.md", and the reference build under
  "final/web/" (index.html, css/app.css, js/app.js) plus "final/menu-patch/".

Then: apply the design to the current app, and build any feature the design has
that the app doesn't yet. The goal is to FINISH it — a complete, working app
matching the redesign, not a partial pass.

Constraints: keep all contract element ids, the API contract, i18n t(), the POI
"arahin" feature, Capacitor Geolocation, PWA, and the existing MapLibre 3D map
working. Vanilla JS, no build step. Keyless (OpenFreeMap) only.

Read docs/superpowers/HANDOFF-design-implementation.md for full env notes
(venv location, preview/emulator verification, GateGuard, WebView cache gotcha).

Start with superpowers:brainstorming to reconcile the design against the current
code, then plan, then execute with review gates. Verify in the browser preview
and on the emulator (CDP, not screencap). Commit per part; push to origin/main.
```

---

## Note on the two things you must do by hand
1. **Model:** switch the model selector to **Opus 5** in the new room (I cannot
   change my own model — this session is Opus 4.8).
2. **New room:** start it yourself (there is no tool to move a conversation).
   Nothing is lost — all work from the previous room is committed to git and
   pushed to `origin/main`; this handoff doc carries the rest.
