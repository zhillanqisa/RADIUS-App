/* RADIUS frontend v3: MapLibre GL map + panel/bottom-sheet, hash routing,
   dark mode (data-theme + prefers-color-scheme), i18n ID/EN (js/i18n.js).
   Vanilla JS, tanpa build step. Kontrak API & id elemen tidak berubah. */
"use strict";

const CATEGORY_META = {
  warung_minimarket: { labelKey: "cat.warung", icon: "storefront", cssVar: "--cat-warung" },
  kuliner: { labelKey: "cat.kuliner", icon: "fork-knife", cssVar: "--cat-kuliner" },
  sekolah: { labelKey: "cat.sekolah", icon: "student", cssVar: "--cat-sekolah" },
  faskes: { labelKey: "cat.faskes", icon: "first-aid-kit", cssVar: "--cat-faskes" },
  transit: { labelKey: "cat.transit", icon: "bus", cssVar: "--cat-transit" },
  taman_ruang_terbuka: { labelKey: "cat.taman", icon: "tree", cssVar: "--cat-taman" },
  peribadatan: { labelKey: "cat.ibadah", icon: "hands-praying", cssVar: "--cat-ibadah" },
};

const SCORE_BANDS = [
  { min: 70, labelKey: "result.band.high", cssVar: "--band-high" },
  { min: 40, labelKey: "result.band.mid", cssVar: "--band-mid" },
  { min: 0, labelKey: "result.band.low", cssVar: "--band-low" },
];

const DURATIONS = [5, 10, 15, 20];

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
const EMPTY_FC = { type: "FeatureCollection", features: [] };
// warna balok gedung 3D (di-refresh saat re-add layer pada ganti tema)
const BUILDING_LIGHT = "#c9ccce";
const BUILDING_DARK = "#3a4550";

const els = {
  searchInput: document.getElementById("search-input"),
  searchResults: document.getElementById("search-results"),
  searchError: document.getElementById("search-error"),
  durationGroup: document.getElementById("duration-group"),
  demoChips: document.getElementById("demo-chips"),
  stateEmpty: document.getElementById("state-empty"),
  stateLoading: document.getElementById("state-loading"),
  resultView: document.getElementById("result-view"),
  noticeDemo: document.getElementById("notice-demo"),
  noticeDemoText: document.getElementById("notice-demo-text"),
  ringValue: document.getElementById("ring-value"),        // marker pada skala band
  scoreNum: document.getElementById("score-num"),
  scoreBand: document.getElementById("score-band"),
  scoreCaption: document.getElementById("score-caption"),
  scoreCached: document.getElementById("score-cached"),
  verdictGap: document.getElementById("verdict-gap"),
  breakdownTitle: document.getElementById("breakdown-title"),
  categoryList: document.getElementById("category-list"),
  rentInput: document.getElementById("rent-input"),
  costLines: document.getElementById("cost-lines"),
  costNotes: document.getElementById("cost-notes"),
  costSummary: document.getElementById("cost-summary"),
  costRent: document.getElementById("cost-rent"),
  costExtra: document.getElementById("cost-extra"),
  costTotal: document.getElementById("cost-total"),
  costDisclaimer: document.getElementById("cost-disclaimer"),
  compareSave: document.getElementById("compare-save"),
  compareCard: document.getElementById("compare-card"),
  compareGrid: document.getElementById("compare-grid"),
  compareClear: document.getElementById("compare-clear"),
  menuScreen: document.getElementById("menu-screen"),
  analysisView: document.getElementById("analysis-view"),
  costView: document.getElementById("cost-view"),
  durationDock: document.querySelector(".duration-dock"),
  miniScore: document.getElementById("mini-score"),
  miniBand: document.getElementById("mini-band"),
  miniCaption: document.getElementById("mini-caption"),
  panel: document.getElementById("panel"),
  sheetHandle: document.getElementById("sheet-handle"),
  swipeTrack: document.getElementById("swipe-track"),
  swipeHint: document.getElementById("swipe-hint"),
};

const state = {
  view: "menu",  // "menu" | "peta" | "biaya" (hash routing)
  minutes: 15,
  loading: false,
  center: null,
  rent: 0,
  locationLabel: null,
  costEst: null,
  compare: [],     // maks 2 snapshot untuk perbandingan
  lastData: null,  // payload terakhir, untuk re-render saat ganti bahasa/tema
  lastScore: null,
};

let compareToken = 0; // membatalkan update skor durasi lain saat titik berganti

const cssVal = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const catLabel = (key) => {
  const meta = CATEGORY_META[key];
  return meta ? t(meta.labelKey) : key;
};

/* ---------- tema (terang/gelap) ---------- */

const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

function isDark() {
  const manual = document.documentElement.getAttribute("data-theme");
  if (manual === "dark") return true;
  if (manual === "light") return false;
  return prefersDark.matches;
}

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

function toggleTheme() {
  const next = isDark() ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("radius_theme", next); } catch (e) { /* abaikan */ }
  applyTheme();
}

prefersDark.addEventListener("change", () => {
  if (!document.documentElement.hasAttribute("data-theme")) applyTheme();
});

/* ---------- bahasa ---------- */

function updateLangPills() {
  const lang = getLang();
  for (const btn of document.querySelectorAll(".lang-pill button")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
  }
}

function applyStaticExtras() {
  for (const el of document.querySelectorAll(".swipe-tool-tag")) {
    el.textContent = t("menu.toolTag", { n: el.dataset.tool });
  }
}

function refreshLanguage() {
  applyI18n();
  applyStaticExtras();
  updateLangPills();
  if (state.lastData) renderResult(state.lastData, { refetchDock: false });
  renderCompare();
  // dock skor yang sudah tampil ikut bahasa baru
  for (const btn of els.durationGroup.querySelectorAll("button")) {
    const el = btn.querySelector(".d-score");
    if (!el.hidden && el.dataset.n) el.textContent = t("dock.score", { n: el.dataset.n });
  }
}

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

function isDesktop() {
  return window.matchMedia("(min-width: 901px)").matches;
}

/* ---------- routing: menu | peta | biaya ---------- */

const VIEW_FOR_HASH = { "#/menu": "menu", "#/peta": "peta", "#/biaya": "biaya" };

function updateCompareVisibility() {
  els.compareCard.hidden = !(state.view === "biaya" && state.compare.length > 0);
}

function applyView() {
  const view = VIEW_FOR_HASH[location.hash] || "menu";
  state.view = view;
  document.body.dataset.view = view;
  els.menuScreen.hidden = view !== "menu";
  els.durationDock.hidden = view === "menu";
  els.analysisView.hidden = view !== "peta";
  els.costView.hidden = view !== "biaya";
  els.panel.classList.remove("sheet-full"); // sheet selalu mulai ringkas
  updateCompareVisibility();
  if (view !== "menu") {
    // peta diinisialisasi di balik overlay menu; pastikan ukurannya benar
    setTimeout(() => map.resize(), 60);
  }
}

window.addEventListener("hashchange", applyView);

/* ---------- state panel ---------- */

function showState(which) {
  els.stateEmpty.hidden = which !== "empty";
  els.stateLoading.hidden = which !== "loading";
  els.resultView.hidden = which !== "result";
  if (which !== "result") els.resultView.classList.remove("enter");
}

function showError(title, body) {
  els.stateEmpty.querySelector(".state-title").textContent = title;
  els.stateEmpty.querySelector(".state-body").textContent = body;
  els.stateEmpty.classList.add("is-error");
  showState("empty");
}

function resetEmptyState() {
  els.stateEmpty.querySelector(".state-title").textContent = t("state.empty.title");
  els.stateEmpty.querySelector(".state-body").textContent = t("state.empty.body");
  els.stateEmpty.classList.remove("is-error");
}

function bandFor(score) {
  return SCORE_BANDS.find((b) => score >= b.min) || SCORE_BANDS[SCORE_BANDS.length - 1];
}

/* ---------- biaya lokasi ---------- */

const EMPTY_COST = { lines: [], notes: [], subtotal: 0, range: { low: 0, high: 0 }, disclaimer: "" };

const fmtRp = (n) => "Rp " + Math.round(n).toLocaleString(getLang() === "en" ? "en-US" : "id-ID");

function fmtRange(low, high) {
  return low === high ? fmtRp(low) : `${fmtRp(low)} - ${fmtRp(high)}`;
}

function parseRent(text) {
  const digits = String(text).replace(/\D/g, "");
  return digits ? Math.min(parseInt(digits, 10), 1_000_000_000) : 0;
}

function costLineWhy(line) {
  const base = t("cost.why.base", {
    trips: line.trips_per_month,
    harga: fmtRp(line.cost_per_trip),
  });
  return t(line.reason === "missing" ? "cost.why.missing" : "cost.why.single", { base });
}

function renderCost(est) {
  state.costEst = est || EMPTY_COST;

  els.costLines.replaceChildren();
  if (state.costEst.lines.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="line-label"><span class="l-name"></span>
        <span class="line-why"></span></span>
      <span class="line-amount is-zero">Rp 0</span>`;
    li.querySelector(".l-name").textContent = t("cost.noExtra.title");
    li.querySelector(".line-why").textContent = t("cost.noExtra.desc");
    els.costLines.appendChild(li);
  }
  for (const line of state.costEst.lines) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="line-label"><span class="l-name"></span>
        <span class="line-why"></span></span>
      <span class="line-amount"></span>`;
    li.querySelector(".l-name").textContent = catLabel(line.category);
    li.querySelector(".line-why").textContent = costLineWhy(line);
    li.querySelector(".line-amount").textContent = fmtRp(line.monthly);
    els.costLines.appendChild(li);
  }

  els.costNotes.replaceChildren();
  for (const note of state.costEst.notes) {
    const li = document.createElement("li");
    li.innerHTML = `<svg class="icon" aria-hidden="true"><use href="vendor/icons/sprite.svg#info"></use></svg>
      <span><span class="note-cat"></span> <span class="note-text"></span></span>`;
    li.querySelector(".note-cat").textContent = catLabel(note.category) + ":";
    // teks catatan diterjemahkan dari kamus (server hanya kirim key kategori);
    // fallback ke teks server jika kunci belum ada.
    const noteKey = "cost.note." + note.category;
    const translated = t(noteKey);
    li.querySelector(".note-text").textContent =
      translated === noteKey ? note.note : translated;
    els.costNotes.appendChild(li);
  }

  // disclaimer dari kamus (bukan teks server) supaya ikut bahasa aktif
  els.costDisclaimer.textContent = t("cost.disclaimerLong");
  updateCostSummary();
}

function updateCostSummary() {
  const est = state.costEst;
  if (!est) {
    els.costSummary.hidden = true;
    return;
  }
  const { low, high } = est.range;
  els.costRent.textContent = state.rent > 0 ? fmtRp(state.rent) : t("cost.rentEmpty");
  els.costExtra.textContent = fmtRange(low, high);
  els.costTotal.textContent = fmtRange(state.rent + low, state.rent + high);
  els.costSummary.hidden = false;
}

/* ---------- perbandingan 2 lokasi ---------- */

function renderCompare() {
  updateCompareVisibility();
  els.compareGrid.replaceChildren();
  if (state.compare.length === 0) return;

  // pemenang = total titik tengah terendah (sewa + subtotal), hanya saat 2 slot terisi
  let winIdx = -1;
  if (state.compare.length === 2) {
    const mids = state.compare.map((s) => s.rent + s.subtotal);
    if (mids[0] !== mids[1]) winIdx = mids[0] < mids[1] ? 0 : 1;
  }

  state.compare.forEach((snap, idx) => {
    const col = document.createElement("div");
    col.className = "compare-col" + (idx === winIdx ? " win" : "");
    col.innerHTML = `
      <p class="c-label"></p>
      <div class="c-row"><span>${t("compare.rowScore", { menit: snap.minutes })}</span><strong>${snap.score}</strong></div>
      <div class="c-row"><span>${t("compare.rowRent")}</span><strong>${snap.rent > 0 ? fmtRp(snap.rent) : "-"}</strong></div>
      <div class="c-row"><span>${t("compare.rowExtra")}</span><strong>${fmtRange(snap.low, snap.high)}</strong></div>
      <div class="c-row"><span>${t("compare.rowTotal")}</span><strong>${fmtRange(snap.rent + snap.low, snap.rent + snap.high)}</strong></div>
      ${idx === winIdx ? `<span class="c-win-pill">${t("compare.winPill")}</span>` : ""}`;
    col.querySelector(".c-label").textContent = snap.label;
    els.compareGrid.appendChild(col);
  });

  if (state.compare.length === 1) {
    const ph = document.createElement("div");
    ph.className = "compare-col";
    const p = document.createElement("p");
    p.className = "c-slot";
    p.textContent = t("compare.slotHint");
    ph.appendChild(p);
    els.compareGrid.appendChild(ph);
  }
}

/* ---------- dock durasi: skor per durasi ---------- */

function setDurationScore(minutes, score) {
  const btn = els.durationGroup.querySelector(`button[data-minutes="${minutes}"]`);
  if (!btn) return;
  const el = btn.querySelector(".d-score");
  if (score == null) {
    el.hidden = true;
    el.textContent = "";
    delete el.dataset.n;
  } else {
    el.hidden = false;
    el.dataset.n = String(score);
    el.textContent = t("dock.score", { n: score });
  }
}

function clearDurationScores() {
  for (const m of DURATIONS) setDurationScore(m, null);
}

async function fetchOtherDurations(center) {
  const token = ++compareToken;
  for (const m of DURATIONS) {
    if (m === state.minutes) continue;
    try {
      const url = `/api/analyze?lat=${center.lat.toFixed(6)}&lon=${center.lon.toFixed(6)}&minutes=${m}`;
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const data = await resp.json();
      if (token !== compareToken) return; // titik sudah berganti
      if (data.source === "demo") continue; // jangan campur skor simulasi
      setDurationScore(m, Math.round(data.score));
    } catch (err) {
      /* skor durasi lain bersifat opsional; abaikan kegagalan */
    }
  }
}

/* ---------- animasi skor ---------- */

function animateScoreNum(target) {
  if (REDUCED_MOTION) {
    els.scoreNum.textContent = target;
    return;
  }
  const start = performance.now();
  const dur = 700;
  function frame(now) {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    els.scoreNum.textContent = Math.round(target * eased);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ---------- render hasil ---------- */

function renderResult(data, opts) {
  const refetchDock = !opts || opts.refetchDock !== false;
  state.lastData = data;

  const score = Math.round(data.score);
  const band = bandFor(data.score);
  const bandColor = cssVal(band.cssVar);

  // verdict
  els.scoreCaption.textContent = t("result.caption", {
    tempat: state.locationLabel || t("result.captionFallback"),
    menit: data.minutes,
  });
  if (refetchDock) animateScoreNum(score);
  else els.scoreNum.textContent = score;
  els.scoreBand.textContent = t(band.labelKey);
  els.scoreBand.style.color = bandColor;

  const items = Object.entries(data.breakdown)
    .filter(([key]) => CATEGORY_META[key])
    .map(([key, item]) => ({ key, ...item }));
  const missing = items.filter((i) => i.count === 0).length;
  const thin = items.filter((i) => i.count === 1).length;
  if (missing === 0 && thin === 0) {
    els.verdictGap.textContent = t("result.gap.none");
  } else if (missing === 0) {
    els.verdictGap.textContent = t("result.gap.thin", { n: thin });
  } else {
    els.verdictGap.textContent = t("result.gap.some", { n: missing, total: items.length });
  }

  // marker pada skala band 0-100
  els.ringValue.style.left = `${Math.max(0, Math.min(100, data.score))}%`;

  els.scoreCached.hidden = !(data.cached && data.source === "live");

  // verdict mini (halaman biaya)
  els.miniScore.textContent = score;
  els.miniScore.style.color = bandColor;
  els.miniBand.textContent = t(band.labelKey);
  els.miniBand.style.color = bandColor;
  els.miniCaption.textContent = t("result.miniCaption", { menit: data.minutes });

  // biaya lokasi (cost_estimate dihitung server; fallback aman kalau absen)
  state.lastScore = score;
  renderCost(data.cost_estimate);

  // notice demo
  const isDemo = data.source === "demo";
  els.noticeDemo.hidden = !isDemo;
  if (isDemo) els.noticeDemoText.textContent = data.notice || t("notice.demoFallback");

  // kategori: kesenjangan terbesar dulu (0 tempat, lalu 1 tempat, lalu lengkap)
  els.breakdownTitle.textContent =
    missing > 0 ? t("result.breakdown.gapTitle") : t("result.breakdown.title");
  items.sort((a, b) => (b.weight - b.score) - (a.weight - a.score) || b.weight - a.weight);

  els.categoryList.replaceChildren();
  items.forEach((item, idx) => {
    const meta = CATEGORY_META[item.key];
    const color = cssVal(meta.cssVar);
    const li = document.createElement("li");
    li.style.setProperty("--i", idx);
    li.innerHTML = `
      <div class="cat-icon" style="background:${color}">
        <svg class="icon" aria-hidden="true"><use href="vendor/icons/sprite.svg#${meta.icon}"></use></svg>
      </div>
      <div class="cat-label">
        <span class="name"></span>
        <span class="count"></span>
      </div>
      <span class="cat-status"></span>`;
    li.querySelector(".name").textContent = t(meta.labelKey);
    li.querySelector(".count").textContent =
      item.count === 0
        ? t("cat.count.none")
        : t("cat.count.some", { n: item.count, score: item.score, weight: item.weight });
    const status = li.querySelector(".cat-status");
    if (item.count === 0) {
      status.textContent = t("cat.status.bad");
      status.classList.add("is-bad");
      li.classList.add("row-bad");
    } else if (item.count === 1) {
      status.textContent = t("cat.status.warn");
      status.classList.add("is-warn");
      li.classList.add("row-warn");
    } else {
      status.textContent = t("cat.status.ok", { n: item.count });
      status.classList.add("is-ok");
    }
    els.categoryList.appendChild(li);
  });

  // layer peta (MapLibre GeoJSON sources)
  setIsochrone(data.isochrone);
  setPois(data.pois);
  setCenterMarker(data.center.lat, data.center.lon);
  if (refetchDock) fitIsochrone(data.isochrone);

  showState("result");
  if (refetchDock && !REDUCED_MOTION) {
    els.resultView.classList.remove("enter");
    void els.resultView.offsetWidth; // restart animasi masuk
    els.resultView.classList.add("enter");
  }

  // dock: skor durasi aktif langsung, durasi lain menyusul di latar belakang.
  // Saat fallback demo aktif, jangan memicu 3 percobaan Overpass tambahan.
  setDurationScore(data.minutes, score);
  if (refetchDock && !isDemo) fetchOtherDurations(state.center);
}

/* ---------- arahin POI (Google Maps jalan kaki) ---------- */

// Ambil lokasi GPS perangkat. Promise -> {lat, lon} atau reject dgn kode ramah.
// Di app Android (Capacitor) pakai plugin native @capacitor/geolocation yang
// meminta izin runtime sendiri; WebView navigator.geolocation ditolak Capacitor.
// Di browser biasa jatuh ke navigator.geolocation.
async function getUserLocation() {
  const cap = window.Capacitor;
  const geo = cap && cap.Plugins && cap.Plugins.Geolocation;
  if (geo && cap.isNativePlatform && cap.isNativePlatform()) {
    try {
      if (geo.checkPermissions && geo.requestPermissions) {
        let perm = await geo.checkPermissions();
        const granted = (p) => p.location === "granted" || p.coarseLocation === "granted";
        if (!granted(perm)) perm = await geo.requestPermissions();
        if (!granted(perm)) throw "denied";
      }
      const pos = await geo.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
      return { lat: pos.coords.latitude, lon: pos.coords.longitude };
    } catch (e) {
      if (e === "denied") throw "denied";
      const m = String((e && e.message) || e || "").toLowerCase();
      throw m.includes("den") ? "denied" : "fail";
    }
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject("fail");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err && err.code === 1 ? "denied" : "fail"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
}

function openDirections(origin, poi) {
  const url =
    "https://www.google.com/maps/dir/?api=1" +
    `&origin=${origin.lat},${origin.lon}` +
    `&destination=${poi.lat},${poi.lon}` +
    "&travelmode=walking";
  // URL off-origin -> Capacitor membukanya di app/browser sistem (Maps).
  window.open(url, "_blank");
}

function wirePoiPopup(node, poi, meta) {
  node.querySelector(".poi-name").textContent = poi.name;
  node.querySelector(".poi-cat").textContent = t(meta.labelKey);
  const labels = node.querySelectorAll(".poi-dir-label");
  labels[0].textContent = t("poi.dirFromPoint");
  labels[1].textContent = t("poi.dirFromGps");
  const msg = node.querySelector(".poi-msg");
  const setMsg = (text) => {
    msg.textContent = text;
    msg.hidden = !text;
  };
  setMsg("");

  const btnPoint = node.querySelector('.poi-dir[data-origin="point"]');
  const btnGps = node.querySelector('.poi-dir[data-origin="gps"]');

  // "dari titik ini" perlu titik analisis aktif
  btnPoint.disabled = !state.center;
  btnPoint.addEventListener("click", () => {
    if (state.center) openDirections(state.center, poi);
  });

  btnGps.addEventListener("click", async () => {
    setMsg(t("poi.locating"));
    btnGps.disabled = true;
    try {
      const coords = await getUserLocation();
      setMsg("");
      openDirections(coords, poi);
    } catch (code) {
      setMsg(t(code === "denied" ? "poi.locDenied" : "poi.locFail"));
    } finally {
      btnGps.disabled = false;
    }
  });
}

/* ---------- API ---------- */

async function runAnalysis(lat, lon) {
  state.loading = true;
  state.center = { lat, lon };
  compareToken++;            // batalkan update perbandingan durasi yang sedang berjalan
  clearDurationScores();
  resetEmptyState();
  setCenterMarker(lat, lon);
  showState("loading");
  try {
    const url = `/api/analyze?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&minutes=${state.minutes}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const detail = await resp.json().catch(() => ({}));
      throw new Error(detail.detail || `HTTP ${resp.status}`);
    }
    renderResult(await resp.json());
  } catch (err) {
    console.error("Analysis failed:", err);
    showError(t("state.error.title"), t("state.error.body"));
  } finally {
    state.loading = false;
  }
}

/* ---------- search ---------- */

let searchTimer = null;

function hideSearchResults() {
  els.searchResults.hidden = true;
  els.searchResults.replaceChildren();
}

async function doSearch(query) {
  els.searchError.hidden = true;
  try {
    const resp = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    if (!resp.ok) {
      const detail = await resp.json().catch(() => ({}));
      throw new Error(detail.detail || t("search.failed"));
    }
    const { results } = await resp.json();
    els.searchResults.replaceChildren();
    if (results.length === 0) {
      els.searchError.textContent = t("search.notFound");
      els.searchError.hidden = false;
      hideSearchResults();
      return;
    }
    for (const r of results) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "option");
      btn.textContent = r.name;
      btn.addEventListener("click", () => {
        hideSearchResults();
        els.searchInput.value = r.name.split(",")[0];
        state.locationLabel = r.name.split(",").slice(0, 2).join(",");
        map.jumpTo({ center: [r.lon, r.lat], zoom: 15 });
        runAnalysis(r.lat, r.lon);
      });
      li.appendChild(btn);
      els.searchResults.appendChild(li);
    }
    els.searchResults.hidden = false;
  } catch (err) {
    console.error("Geocode failed:", err);
    els.searchError.textContent = err.message;
    els.searchError.hidden = false;
    hideSearchResults();
  }
}

els.searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const q = els.searchInput.value.trim();
  if (q.length < 3) {
    hideSearchResults();
    return;
  }
  searchTimer = setTimeout(() => doSearch(q), 450);
});

els.searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    clearTimeout(searchTimer);
    const q = els.searchInput.value.trim();
    if (q.length >= 2) doSearch(q);
  }
  if (e.key === "Escape") hideSearchResults();
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-block")) hideSearchResults();
});

/* ---------- input sewa & simpan perbandingan ---------- */

els.rentInput.addEventListener("input", () => {
  state.rent = parseRent(els.rentInput.value);
  els.rentInput.value =
    state.rent > 0
      ? state.rent.toLocaleString(getLang() === "en" ? "en-US" : "id-ID")
      : "";
  updateCostSummary();
});

els.compareSave.addEventListener("click", () => {
  const est = state.costEst;
  if (!est || !state.center) return;
  const snap = {
    label: state.locationLabel ||
      `(${state.center.lat.toFixed(4)}, ${state.center.lon.toFixed(4)})`,
    minutes: state.minutes,
    score: state.lastScore ?? 0,
    rent: state.rent,
    subtotal: est.subtotal,
    low: est.range.low,
    high: est.range.high,
  };
  // simpan maksimal 2: slot ketiga menggantikan yang paling lama
  state.compare = [...state.compare.slice(-1), snap];
  renderCompare();
});

els.compareClear.addEventListener("click", () => {
  state.compare = [];
  renderCompare();
});

/* ---------- kontrol durasi ---------- */

els.durationGroup.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-minutes]");
  if (!btn || state.loading) return;
  for (const b of els.durationGroup.querySelectorAll("button")) {
    b.setAttribute("aria-checked", String(b === btn));
  }
  state.minutes = Number(btn.dataset.minutes);
  if (state.center) runAnalysis(state.center.lat, state.center.lon);
});

/* ---------- kontrol bahasa & tema (semua instance) ---------- */

document.addEventListener("click", (e) => {
  const langBtn = e.target.closest(".lang-pill button[data-lang]");
  if (langBtn) {
    setLang(langBtn.dataset.lang);
    refreshLanguage();
    return;
  }
  if (e.target.closest(".theme-btn")) toggleTheme();
});

/* ---------- bottom sheet (mobile, view peta) ---------- */

function setSheetFull(full) {
  els.panel.classList.toggle("sheet-full", full);
}

(function initSheetDrag() {
  const handle = els.sheetHandle;
  if (!handle) return;
  let startY = null;

  handle.addEventListener("pointerdown", (e) => {
    startY = e.clientY;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener("pointerup", (e) => {
    if (startY === null) return;
    const delta = startY - e.clientY; // positif = ditarik ke atas
    if (Math.abs(delta) > 40) setSheetFull(delta > 0);
    else setSheetFull(!els.panel.classList.contains("sheet-full")); // tap = toggle
    startY = null;
  });
  handle.addEventListener("pointercancel", () => { startY = null; });
})();

/* ---------- menu dua pintu geser (mobile) ---------- */

(function initMenuSwipe() {
  const track = els.swipeTrack;
  if (!track) return;
  const panes = [...track.querySelectorAll(".swipe-pane")];
  const dots = [...document.querySelectorAll(".swipe-dots span")];

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const idx = panes.indexOf(entry.target);
        dots.forEach((d, i) => d.classList.toggle("active", i === idx));
        const key = idx === 0 ? "menu.swipeHint" : "menu.swipeBack";
        els.swipeHint.dataset.i18n = key;
        els.swipeHint.textContent = t(key);
      }
    },
    { root: track, threshold: 0.6 }
  );
  panes.forEach((p) => observer.observe(p));

  // peek animation sekali saat mount (CSS .peek; dihormati reduced-motion)
  if (!REDUCED_MOTION) {
    track.classList.add("peek");
    track.addEventListener("animationend", () => track.classList.remove("peek"), { once: true });
  }
})();

/* ---------- init ---------- */

async function init() {
  try {
    const resp = await fetch("/api/config");
    const cfg = await resp.json();
    state.minutes = cfg.default_minutes;
    map.jumpTo({ center: [cfg.default_center.lon, cfg.default_center.lat], zoom: 15 });
    for (const b of els.durationGroup.querySelectorAll("button")) {
      b.setAttribute("aria-checked", String(Number(b.dataset.minutes) === cfg.default_minutes));
    }
    for (const loc of cfg.demo_locations) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = loc.name;
      btn.addEventListener("click", () => {
        if (state.loading) return;
        state.locationLabel = loc.name;
        map.jumpTo({ center: [loc.lon, loc.lat], zoom: 15 });
        runAnalysis(loc.lat, loc.lon);
      });
      els.demoChips.appendChild(btn);
    }
  } catch (err) {
    // Config gagal berarti API mati; peta tetap tampil.
    console.error("Config load failed:", err);
  }
}

applyI18n();
applyStaticExtras();
updateLangPills();
applyTheme();
applyView();
init();
