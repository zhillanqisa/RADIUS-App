/* RADIUS - ongkos komuter & biaya waktu (kanvas f4/f4b).

   Server (app/costs.py) sudah menghitung ongkos untuk kategori yang TIDAK
   terjangkau jalan kaki, dan itu tidak disentuh. File ini menambah blok
   TERPISAH: ongkos pulang-pergi ke lokasi kerja/kampus, yang tidak bisa
   dihitung server karena server tidak tahu di mana kantor pengguna.

   Angka tarif berasal dari asumsi yang sudah didokumentasikan di
   cost_assumptions.py (GoRide Zona I Bandung: Rp1.850-2.300/km, minimum 4 km
   Rp8.000-10.000). Semua konstanta diberi nama dan ditampilkan di disclaimer
   -- ini asumsi, bukan hasil pengukuran. */
"use strict";

const COMMUTE = {
  RATE_PER_KM: 2075,   // titik tengah 1.850-2.300
  MIN_FARE: 9000,      // titik tengah minimum 4 km 8.000-10.000
  ROUND_TRIPS: 30,     // perjalanan pulang-pergi per bulan (hari kerja)
  SPEED_KMH: 22,       // kecepatan rata-rata motor di kota, untuk biaya waktu
  RANGE_MARGIN: 0.20,  // sama dengan RANGE_MARGIN di app/costs.py
};

// Dibulatkan ke Rp1.000 seperti app/costs.py::_round_rp -- hindari presisi palsu.
const roundRp = (v) => Math.round(v / 1000) * 1000;

/**
 * Ongkos & waktu komuter bulanan dari rumah ke lokasi kerja.
 * @returns {{km, fareOneway, monthly, low, high, hours}|null} null kalau salah
 *          satu titik belum ada.
 */
function commuterCost(home, work) {
  if (!home || !work) return null;
  const km = haversineKm(home, work);
  const fareOneway = Math.max(COMMUTE.MIN_FARE, COMMUTE.RATE_PER_KM * km);
  const monthly = roundRp(COMMUTE.ROUND_TRIPS * 2 * fareOneway);
  return {
    km,
    fareOneway: Math.round(fareOneway),
    monthly,
    low: roundRp(monthly * (1 - COMMUTE.RANGE_MARGIN)),
    high: roundRp(monthly * (1 + COMMUTE.RANGE_MARGIN)),
    hours: Math.round((COMMUTE.ROUND_TRIPS * 2 * km) / COMMUTE.SPEED_KMH),
  };
}

/** Total bulanan: sewa + ongkos kategori (server) + ongkos komuter (klien). */
function totalRange(rent, serverEst, commute) {
  const s = serverEst && serverEst.range ? serverEst.range : { low: 0, high: 0 };
  const c = commute ? { low: commute.low, high: commute.high } : { low: 0, high: 0 };
  return { low: rent + s.low + c.low, high: rent + s.high + c.high };
}

/** Titik tengah total, dipakai untuk memutuskan pemenang di layar perbandingan. */
function totalMid(rent, serverSubtotal, commuteMonthly) {
  return (Number(rent) || 0) + (Number(serverSubtotal) || 0) + (Number(commuteMonthly) || 0);
}
