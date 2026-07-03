/* RADIUS frontend: Leaflet map + analysis panel.
   Vanilla JS, no build step. Talks only to the same-origin API. */
"use strict";

const CATEGORY_META = {
  warung_minimarket: { label: "Warung & Minimarket", icon: "storefront", cssVar: "--cat-warung" },
  kuliner: { label: "Kuliner", icon: "fork-knife", cssVar: "--cat-kuliner" },
  sekolah: { label: "Sekolah", icon: "student", cssVar: "--cat-sekolah" },
  faskes: { label: "Fasilitas Kesehatan", icon: "first-aid-kit", cssVar: "--cat-faskes" },
  transit: { label: "Transportasi Umum", icon: "bus", cssVar: "--cat-transit" },
  taman_ruang_terbuka: { label: "Taman & Ruang Terbuka", icon: "tree", cssVar: "--cat-taman" },
  peribadatan: { label: "Tempat Ibadah", icon: "hands-praying", cssVar: "--cat-ibadah" },
};

const SCORE_BANDS = [
  { min: 70, label: "Sangat layak jalan kaki", cssVar: "--band-high" },
  { min: 40, label: "Cukup terlayani", cssVar: "--band-mid" },
  { min: 0, label: "Bergantung kendaraan", cssVar: "--band-low" },
];

const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

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
  ringValue: document.getElementById("ring-value"),
  scoreNum: document.getElementById("score-num"),
  scoreBand: document.getElementById("score-band"),
  scoreCaption: document.getElementById("score-caption"),
  scoreCached: document.getElementById("score-cached"),
  categoryList: document.getElementById("category-list"),
};

const state = {
  minutes: 15,
  loading: false,
  center: null,
};

const cssVal = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* ---------- map ---------- */

const map = L.map("map", { zoomControl: false }).setView([-6.9147, 107.6098], 15);
L.control.zoom({ position: "bottomright" }).addTo(map);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 19,
}).addTo(map);

const isochroneLayer = L.layerGroup().addTo(map);
const poiLayer = L.layerGroup().addTo(map);
let centerMarker = null;

map.on("click", (e) => {
  if (!state.loading) runAnalysis(e.latlng.lat, e.latlng.lng);
});

function setCenterMarker(lat, lon) {
  if (centerMarker) centerMarker.remove();
  centerMarker = L.marker([lat, lon], {
    icon: L.divIcon({ className: "", html: '<div class="center-pin"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
    interactive: false,
  }).addTo(map);
}

/* ---------- rendering ---------- */

function showState(which) {
  els.stateEmpty.hidden = which !== "empty";
  els.stateLoading.hidden = which !== "loading";
  els.resultView.hidden = which !== "result";
}

function bandFor(score) {
  return SCORE_BANDS.find((b) => score >= b.min) || SCORE_BANDS[SCORE_BANDS.length - 1];
}

function renderResult(data) {
  const band = bandFor(data.score);
  const bandColor = cssVal(band.cssVar);

  // score ring + numeral
  els.ringValue.style.stroke = bandColor;
  els.ringValue.style.strokeDashoffset =
    RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(100, data.score)) / 100);
  els.scoreNum.textContent = Math.round(data.score);
  els.scoreBand.textContent = band.label;
  els.scoreBand.style.color = bandColor;
  els.scoreCaption.textContent =
    `Skor ${data.score} dari 100 dalam ${data.minutes} menit jalan kaki`;
  els.scoreCached.hidden = !(data.cached && data.source === "live");

  // demo notice
  const isDemo = data.source === "demo";
  els.noticeDemo.hidden = !isDemo;
  if (isDemo) els.noticeDemoText.textContent = data.notice || "Menampilkan data simulasi.";

  // category rows
  els.categoryList.replaceChildren();
  for (const [key, meta] of Object.entries(CATEGORY_META)) {
    const item = data.breakdown[key];
    if (!item) continue;
    const color = cssVal(meta.cssVar);
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="cat-icon" style="background:${color}">
        <svg class="icon" aria-hidden="true"><use href="vendor/icons/sprite.svg#${meta.icon}"></use></svg>
      </div>
      <div class="cat-label">
        <span class="name"></span>
        <span class="count"></span>
      </div>
      <div class="cat-pts"></div>
      <div class="cat-bar"><i style="background:${color}"></i></div>`;
    li.querySelector(".name").textContent = meta.label;
    li.querySelector(".count").textContent =
      item.count === 0 ? "tidak ditemukan" : `${item.count} tempat terjangkau`;
    li.querySelector(".cat-pts").textContent = `${item.score}/${item.weight}`;
    els.categoryList.appendChild(li);
    const fill = li.querySelector(".cat-bar i");
    requestAnimationFrame(() => {
      fill.style.width = `${(item.score / item.weight) * 100}%`;
    });
  }

  // map layers
  isochroneLayer.clearLayers();
  poiLayer.clearLayers();
  const accent = cssVal("--accent");
  const iso = L.geoJSON(
    { type: "Feature", geometry: data.isochrone },
    { style: { color: accent, weight: 2, fillColor: accent, fillOpacity: 0.13 } }
  ).addTo(isochroneLayer);

  for (const poi of data.pois) {
    const meta = CATEGORY_META[poi.category];
    if (!meta) continue;
    L.circleMarker([poi.lat, poi.lon], {
      radius: 6,
      color: "#ffffff",
      weight: 1.5,
      fillColor: cssVal(meta.cssVar),
      fillOpacity: 0.95,
    })
      .bindPopup(
        `<div class="poi-popup"><span class="poi-name"></span><span class="poi-cat"></span></div>`
      )
      .on("popupopen", (e) => {
        const node = e.popup.getElement();
        node.querySelector(".poi-name").textContent = poi.name;
        node.querySelector(".poi-cat").textContent = meta.label;
      })
      .addTo(poiLayer);
  }

  setCenterMarker(data.center.lat, data.center.lon);
  map.fitBounds(iso.getBounds(), { padding: [28, 28] });
  showState("result");
}

/* ---------- API ---------- */

async function runAnalysis(lat, lon) {
  state.loading = true;
  state.center = { lat, lon };
  setCenterMarker(lat, lon);
  showState("loading");
  try {
    const url = `/api/analyze?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&minutes=${state.minutes}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const detail = await resp.json().catch(() => ({}));
      throw new Error(detail.detail || `Server mengembalikan status ${resp.status}`);
    }
    renderResult(await resp.json());
  } catch (err) {
    console.error("Analysis failed:", err);
    showState("empty");
    els.stateEmpty.querySelector(".state-title").textContent = "Analisis gagal";
    els.stateEmpty.querySelector(".state-body").textContent =
      "Tidak dapat terhubung ke server RADIUS. Pastikan server berjalan, lalu coba lagi.";
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
      throw new Error(detail.detail || "Pencarian gagal.");
    }
    const { results } = await resp.json();
    els.searchResults.replaceChildren();
    if (results.length === 0) {
      els.searchError.textContent = "Tempat tidak ditemukan. Coba kata kunci lain.";
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
        map.setView([r.lat, r.lon], 15);
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

/* ---------- controls ---------- */

els.durationGroup.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-minutes]");
  if (!btn || state.loading) return;
  for (const b of els.durationGroup.querySelectorAll("button")) {
    b.setAttribute("aria-checked", String(b === btn));
  }
  state.minutes = Number(btn.dataset.minutes);
  if (state.center) runAnalysis(state.center.lat, state.center.lon);
});

/* ---------- init ---------- */

async function init() {
  try {
    const resp = await fetch("/api/config");
    const cfg = await resp.json();
    state.minutes = cfg.default_minutes;
    map.setView([cfg.default_center.lat, cfg.default_center.lon], 15);
    for (const b of els.durationGroup.querySelectorAll("button")) {
      b.setAttribute("aria-checked", String(Number(b.dataset.minutes) === cfg.default_minutes));
    }
    for (const loc of cfg.demo_locations) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = loc.name;
      btn.addEventListener("click", () => {
        if (state.loading) return;
        map.setView([loc.lat, loc.lon], 15);
        runAnalysis(loc.lat, loc.lon);
      });
      els.demoChips.appendChild(btn);
    }
  } catch (err) {
    // Config fetch failing means the API is down; map still works visually.
    console.error("Config load failed:", err);
  }
}

init();
