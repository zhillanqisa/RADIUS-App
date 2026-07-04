/* RADIUS frontend v2 "Peta Utama": Leaflet map penuh + panel verdict mengambang
   + dock durasi dengan skor per durasi. Vanilla JS, tanpa build step.
   Kontrak API tidak berubah: /api/config, /api/geocode, /api/analyze. */
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

const DURATIONS = [5, 10, 15, 20];

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
};

const EMPTY_DEFAULTS = {
  title: els.stateEmpty.querySelector(".state-title").textContent,
  body: els.stateEmpty.querySelector(".state-body").textContent,
};

const state = {
  minutes: 15,
  loading: false,
  center: null,
};

let compareToken = 0; // membatalkan update skor durasi lain saat titik berganti

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

function isDesktop() {
  return window.matchMedia("(min-width: 901px)").matches;
}

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
  els.stateEmpty.querySelector(".state-title").textContent = EMPTY_DEFAULTS.title;
  els.stateEmpty.querySelector(".state-body").textContent = EMPTY_DEFAULTS.body;
  els.stateEmpty.classList.remove("is-error");
}

function bandFor(score) {
  return SCORE_BANDS.find((b) => score >= b.min) || SCORE_BANDS[SCORE_BANDS.length - 1];
}

/* ---------- dock durasi: skor per durasi ---------- */

function setDurationScore(minutes, score) {
  const btn = els.durationGroup.querySelector(`button[data-minutes="${minutes}"]`);
  if (!btn) return;
  const el = btn.querySelector(".d-score");
  if (score == null) {
    el.hidden = true;
    el.textContent = "";
  } else {
    el.hidden = false;
    el.textContent = `skor ${score}`;
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

function renderResult(data) {
  const score = Math.round(data.score);
  const band = bandFor(data.score);
  const bandColor = cssVal(band.cssVar);

  // verdict
  els.scoreCaption.textContent = `Jangkauan ${data.minutes} menit jalan kaki dari titik terpilih`;
  animateScoreNum(score);
  els.scoreBand.textContent = band.label;
  els.scoreBand.style.color = bandColor;

  const items = Object.entries(data.breakdown)
    .filter(([key]) => CATEGORY_META[key])
    .map(([key, item]) => ({ key, ...item }));
  const missing = items.filter((i) => i.count === 0).length;
  const thin = items.filter((i) => i.count === 1).length;
  if (missing === 0 && thin === 0) {
    els.verdictGap.textContent = "Semua kategori kebutuhan harian terjangkau.";
  } else if (missing === 0) {
    els.verdictGap.textContent = `Semua kategori ada, ${thin} di antaranya hanya 1 pilihan.`;
  } else {
    els.verdictGap.textContent = `${missing} dari ${items.length} kategori tidak terjangkau jalan kaki.`;
  }

  // marker pada skala band 0-100
  els.ringValue.style.left = `${Math.max(0, Math.min(100, data.score))}%`;

  els.scoreCached.hidden = !(data.cached && data.source === "live");

  // notice demo
  const isDemo = data.source === "demo";
  els.noticeDemo.hidden = !isDemo;
  if (isDemo) els.noticeDemoText.textContent = data.notice || "Menampilkan data simulasi.";

  // kategori: kesenjangan terbesar dulu (0 tempat, lalu 1 tempat, lalu lengkap; bobot besar dulu)
  els.breakdownTitle.textContent = missing > 0 ? "Yang kurang dulu" : "Rincian per kategori";
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
    li.querySelector(".name").textContent = meta.label;
    li.querySelector(".count").textContent =
      item.count === 0
        ? "tidak ditemukan dalam jangkauan"
        : `${item.count} tempat terjangkau, nilai ${item.score}/${item.weight}`;
    const status = li.querySelector(".cat-status");
    if (item.count === 0) {
      status.textContent = "Tidak terjangkau";
      status.classList.add("is-bad");
    } else if (item.count === 1) {
      status.textContent = "Hanya 1 pilihan";
      status.classList.add("is-warn");
    } else {
      status.textContent = "Ada pilihan";
      status.classList.add("is-ok");
    }
    els.categoryList.appendChild(li);
  });

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
  if (isDesktop()) {
    // beri ruang untuk panel kiri dan dock durasi atas
    map.fitBounds(iso.getBounds(), {
      paddingTopLeft: L.point(462, 84),
      paddingBottomRight: L.point(40, 40),
    });
  } else {
    map.fitBounds(iso.getBounds(), { padding: [26, 26] });
  }

  showState("result");
  if (!REDUCED_MOTION) {
    els.resultView.classList.remove("enter");
    void els.resultView.offsetWidth; // restart animasi masuk
    els.resultView.classList.add("enter");
  }

  // dock: skor durasi aktif langsung, durasi lain menyusul di latar belakang.
  // Saat fallback demo aktif, jangan memicu 3 percobaan Overpass tambahan.
  setDurationScore(data.minutes, score);
  if (!isDemo) fetchOtherDurations(state.center);
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
      throw new Error(detail.detail || `Server mengembalikan status ${resp.status}`);
    }
    renderResult(await resp.json());
  } catch (err) {
    console.error("Analysis failed:", err);
    showError(
      "Analisis gagal",
      "Tidak dapat terhubung ke server RADIUS. Pastikan server berjalan, lalu coba lagi."
    );
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
    // Config gagal berarti API mati; peta tetap tampil.
    console.error("Config load failed:", err);
  }
}

init();
