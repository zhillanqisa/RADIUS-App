/* RADIUS - pemformatan angka, uang, jarak, dan waktu relatif.
   Dimuat setelah i18n.js (butuh t()/getLang()) dan sebelum app.js.
   fmtRp/fmtRange PINDAH ke sini dari app.js -- hanya boleh ada satu definisi. */
"use strict";

const fmtRp = (n) =>
  "Rp " + Math.round(n).toLocaleString(getLang() === "en" ? "en-US" : "id-ID");

function fmtRange(low, high) {
  return low === high ? fmtRp(low) : `${fmtRp(low)} - ${fmtRp(high)}`;
}

/** Jarak lingkaran besar dalam km. Dipakai untuk ongkos komuter (cost.js). */
function haversineKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "Hari ini · 09:20" / "Kemarin · 18:04" / "3 hari lalu · 14:47" (kanvas f8c). */
function fmtRelativeTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hhmm = d.toTimeString().slice(0, 5);
  // Dibandingkan per HARI KALENDER, bukan selisih 24 jam: pukul 23:00 lalu
  // 01:00 esoknya harus terbaca "Kemarin", bukan "Hari ini".
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const startOfThat = new Date(d.getTime()).setHours(0, 0, 0, 0);
  const days = Math.round((startOfToday - startOfThat) / 86400000);
  if (days <= 0) return t("time.today", { time: hhmm });
  if (days === 1) return t("time.yesterday", { time: hhmm });
  return t("time.daysAgo", { n: days, time: hhmm });
}

/** Apakah timestamp ini hari ini? (titik solid vs pudar di timeline riwayat) */
function isToday(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return new Date(d.getTime()).setHours(0, 0, 0, 0) === new Date().setHours(0, 0, 0, 0);
}
