/* RADIUS - skor per persona (kanvas f3b).

   Dihitung SEPENUHNYA di klien, tanpa endpoint baru. /api/analyze sudah
   mengirim breakdown[cat] = {count, weight, score}, dan radius_core memberi
   skor kategori = weight x faktor dengan faktor 0 / 0.75 / 1 (0 tempat,
   1 tempat, >=2 tempat). Faktor itu bisa dipulihkan sebagai score/weight,
   lalu ditimbang ulang memakai bobot persona dan dinormalisasi kembali ke
   0-100. Karena bobot "umum" identik dengan radius_core.CATEGORY_WEIGHTS,
   persona default WAJIB menghasilkan skor server apa adanya -- itu yang
   diuji radiusSelfCheck(). */
"use strict";

const PERSONAS = ["umum", "keluarga", "mahasiswa", "lansia", "pekerja"];

const PERSONA_WEIGHTS = {
  // identik dengan radius_core.CATEGORY_WEIGHTS (total 100)
  umum:      { warung_minimarket: 20, kuliner: 10, sekolah: 15, faskes: 20, transit: 20, taman_ruang_terbuka: 10, peribadatan: 5 },
  // keluarga: sekolah & faskes paling menentukan, taman naik, kuliner turun
  keluarga:  { warung_minimarket: 15, kuliner: 5,  sekolah: 25, faskes: 25, transit: 12, taman_ruang_terbuka: 15, peribadatan: 3 },
  // mahasiswa: makan, transit, dan warung; sekolah hampir tak relevan
  mahasiswa: { warung_minimarket: 25, kuliner: 25, sekolah: 2,  faskes: 10, transit: 25, taman_ruang_terbuka: 10, peribadatan: 3 },
  // lansia: faskes dominan, ibadah & taman penting, jarak harus pendek
  lansia:    { warung_minimarket: 20, kuliner: 4,  sekolah: 1,  faskes: 35, transit: 10, taman_ruang_terbuka: 15, peribadatan: 15 },
  // pekerja: transit dominan, lalu makan & warung
  pekerja:   { warung_minimarket: 25, kuliner: 20, sekolah: 2,  faskes: 12, transit: 30, taman_ruang_terbuka: 8,  peribadatan: 3 },
};

/**
 * Timbang ulang payload analisis memakai bobot persona.
 * @returns {{score: number, breakdown: Object}} breakdown memakai bobot persona.
 */
function rescore(payload, personaKey) {
  const w = PERSONA_WEIGHTS[personaKey] || PERSONA_WEIGHTS.umum;
  const src = (payload && payload.breakdown) || {};
  let total = 0;
  let weightSum = 0;
  const breakdown = {};

  for (const [cat, weight] of Object.entries(w)) {
    const item = src[cat];
    if (!item) continue; // kategori tak dikirim server -> jangan karang
    const factor = item.weight ? item.score / item.weight : 0; // 0 | 0.75 | 1
    const catScore = weight * factor;
    breakdown[cat] = {
      count: item.count,
      weight,
      score: Math.round(catScore * 10) / 10,
    };
    total += catScore;
    weightSum += weight;
  }

  // Tak ada kategori yang cocok -> pakai angka server, jangan bagi nol.
  if (!weightSum) return { score: payload ? payload.score : 0, breakdown: src };

  return {
    score: Math.round((total * 100 / weightSum) * 10) / 10,
    breakdown,
  };
}

/** Kategori yang paling ditimbang persona ini, tertinggi dulu. */
function personaTopCategories(personaKey, n) {
  const w = PERSONA_WEIGHTS[personaKey] || PERSONA_WEIGHTS.umum;
  return Object.entries(w)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key]) => key);
}
