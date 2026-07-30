/* RADIUS - penyimpanan lokal (tema, bahasa, persona, sewa, lokasi kerja,
   lokasi tersimpan, riwayat). Dimuat SEBELUM app.js.

   Aturan utama: TIDAK BOLEH throw. Di WebView privat / mode incognito
   localStorage bisa melempar saat diakses, jadi setiap baca-tulis dibungkus
   try/catch dan jatuh ke Map di memori. Layar tetap jalan, cuma tidak persisten. */
"use strict";

const Store = (() => {
  const mem = new Map();
  const KEY = (k) => "radius_" + k;
  const CAP = 50; // batas daftar tersimpan & riwayat

  function raw(k) {
    try {
      return localStorage.getItem(KEY(k));
    } catch (e) {
      return mem.has(KEY(k)) ? mem.get(KEY(k)) : null;
    }
  }

  function write(k, s) {
    try {
      localStorage.setItem(KEY(k), s);
    } catch (e) {
      mem.set(KEY(k), s); // kuota penuh atau storage diblokir
    }
  }

  function get(k, fallback) {
    const s = raw(k);
    if (s == null) return fallback;
    try {
      return JSON.parse(s);
    } catch (e) {
      return fallback; // nilai lama non-JSON (mis. radius_theme "dark")
    }
  }

  function set(k, value) {
    write(k, JSON.stringify(value));
    return value;
  }

  const list = (k) => {
    const v = get(k, []);
    return Array.isArray(v) ? v : [];
  };

  // Satu titik dianggap sama kalau lat/lon dibulatkan 4 desimal (~11 m) dan
  // durasinya sama -- sejajar dengan coord_precision di app/config.py.
  const entryId = (e) =>
    `${Number(e.lat).toFixed(4)},${Number(e.lon).toFixed(4)},${e.minutes}`;

  return {
    get,
    set,
    entryId,

    saved: () => list("saved"),
    isSaved: (e) => list("saved").some((s) => s.id === entryId(e)),
    /** Toggle satu lokasi di daftar tersimpan. Mengembalikan keanggotaan BARU. */
    toggleSaved(e) {
      const id = entryId(e);
      const cur = list("saved");
      const next = cur.some((s) => s.id === id)
        ? cur.filter((s) => s.id !== id)
        : [{ ...e, id }, ...cur].slice(0, CAP);
      set("saved", next);
      return next.some((s) => s.id === id);
    },
    removeSaved(id) {
      set("saved", list("saved").filter((s) => s.id !== id));
    },

    history: () => list("history"),
    /** Catat satu analisis. Titik yang sama naik ke atas, tidak menumpuk. */
    pushHistory(e) {
      const id = entryId(e);
      set("history", [
        { ...e, id },
        ...list("history").filter((h) => h.id !== id),
      ].slice(0, CAP));
    },
    clearHistory: () => set("history", []),
  };
})();
