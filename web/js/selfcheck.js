/* RADIUS - pemeriksaan kontrak, dijalankan manual dari konsol.

   Menegaskan tiga hal yang mudah rusak diam-diam saat redesign:
   1. Semua id kontrak masih ada (app.js bergantung padanya).
   2. Kamus ID & EN punya kunci yang sama, dan setiap data-i18n di DOM ada
      kunci-nya -- kalau tidak, teks tampil sebagai nama kunci mentah.
   3. Persona "umum" menghasilkan skor server persis; kalau meleset, bobot
      persona sudah menyimpang dari radius_core.CATEGORY_WEIGHTS.

   Dipakai di sweep QA (preview + emulator lewat CDP Runtime.evaluate). */
"use strict";

const CONTRACT_IDS = [
  "search-input", "search-results", "search-error", "duration-group",
  "demo-chips", "state-empty", "state-loading", "result-view", "notice-demo",
  "notice-demo-text", "ring-value", "score-num", "score-band", "score-caption",
  "score-cached", "verdict-gap", "breakdown-title", "category-list", "map",
  "menu-screen", "analysis-view", "cost-view", "rent-input", "cost-lines",
  "cost-notes", "cost-summary", "cost-rent", "cost-extra", "cost-total",
  "cost-disclaimer", "compare-save", "compare-card", "compare-grid",
  "compare-clear", "mini-score", "mini-band", "mini-caption", "panel",
  "sheet-handle",
];

function radiusSelfCheck() {
  const missingIds = CONTRACT_IDS.filter((id) => !document.getElementById(id));

  const idKeys = Object.keys(STRINGS.id);
  const enKeys = Object.keys(STRINGS.en);
  const missingKeys = [
    ...idKeys.filter((k) => !enKeys.includes(k)).map((k) => "en:" + k),
    ...enKeys.filter((k) => !idKeys.includes(k)).map((k) => "id:" + k),
  ];

  // Kunci yang dirujuk DOM tapi tidak ada di kamus -> teks jadi nama kunci.
  const domKeys = new Set();
  for (const el of document.querySelectorAll("[data-i18n]")) {
    domKeys.add(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll("[data-i18n-attr]")) {
    for (const pair of el.dataset.i18nAttr.split(";")) {
      const key = pair.split(":")[1];
      if (key) domKeys.add(key.trim());
    }
  }
  const missingDom = [...domKeys]
    .filter((k) => !idKeys.includes(k))
    .map((k) => "dict:" + k);

  // Identitas persona: hanya bisa diuji kalau sudah ada payload.
  const personaIdentity =
    !state.lastData ||
    Math.abs(rescore(state.lastData, "umum").score - state.lastData.score) < 0.05;

  return {
    missingIds,
    missingKeys: [...missingKeys, ...missingDom],
    personaIdentity,
    ok:
      missingIds.length === 0 &&
      missingKeys.length === 0 &&
      missingDom.length === 0 &&
      personaIdentity,
  };
}
