/* RADIUS i18n: kamus ID/EN sederhana tanpa library (DESIGN-SPEC.md Bag. 5-6).
   Dimuat SEBELUM app.js. Pilihan bahasa disimpan di localStorage.radius_lang. */
"use strict";

const STRINGS = {
  id: {
    // menu
    "menu.kicker": "Skor Kota 15 Menit",
    "menu.title": "Kota yang baik bisa dijalani kaki",
    "menu.sub": "Seberapa enak lokasimu untuk hidup tanpa kendaraan? Pilih alatnya.",
    "menu.tool1.name": "Cek Lokasi Saya",
    "menu.tool1.desc": "Nilai 0-100 dan peta: apa saja yang bisa dicapai jalan kaki dari titikmu.",
    "menu.tool1.cta": "Mulai cek",
    "menu.tool1.sample": "contoh: Antapani, lumayan",
    "menu.tool2.name": "Hitung Biaya Tinggal",
    "menu.tool2.desc": "Sewa murah belum tentu hemat. Hitung sewa + ongkos ojek bulanan, bandingkan 2 lokasi.",
    "menu.tool2.cta": "Mulai hitung",
    "menu.tool2.sample": "contoh total per bulan di Antapani",
    "menu.swipeHint": "Geser untuk alat kedua",
    "menu.swipeBack": "Geser kembali ke alat pertama",
    "menu.note": "Data: OpenStreetMap · analisis jaringan jalan pejalan kaki (OSMnx)",
    "menu.toolTag": "ALAT {n}",
    // brand / panel
    "brand.sub": "Skor Kota 15 Menit",
    "brand.menu": "Menu",
    "controls.demoLabel": "Coba lokasi contoh",
    "search.placeholder": "Cari alamat, atau ketuk peta",
    "search.notFound": "Tempat tidak ditemukan. Coba kata kunci lain.",
    "search.failed": "Pencarian gagal.",
    // states
    "state.empty.title": "Pilih titik untuk mulai",
    "state.empty.body": "Ketuk peta, cari alamat, atau pakai salah satu lokasi contoh di atas.",
    "state.loading.title": "Menganalisis jaringan jalan…",
    "state.loading.body": "Mengambil data jalan & fasilitas dari OpenStreetMap. Biasanya 5-30 detik untuk titik baru.",
    "state.error.title": "Analisis gagal",
    "state.error.body": "Tidak dapat terhubung ke server RADIUS. Pastikan server berjalan, lalu coba lagi.",
    "notice.demoFallback": "Menampilkan data simulasi.",
    // hasil
    "result.caption": "{tempat} · {menit} menit jalan kaki",
    "result.captionFallback": "Titik terpilih",
    "result.band.high": "Sangat layak jalan kaki",
    "result.band.mid": "Lumayan, ada yang kurang",
    "result.band.low": "Susah tanpa kendaraan",
    "result.scaleLow": "0 susah tanpa kendaraan",
    "result.scaleMid": "40 cukup",
    "result.scaleHigh": "100 semua dekat",
    "result.gap.none": "Semua kebutuhan harian terjangkau.",
    "result.gap.some": "{n} dari {total} kebutuhan tidak tercapai jalan kaki",
    "result.gap.thin": "Semua kebutuhan ada, {n} di antaranya cuma 1 pilihan.",
    "result.cached": "hasil tersimpan, dimuat instan",
    "result.breakdown.title": "Rincian per kategori",
    "result.breakdown.gapTitle": "Yang kurang dulu",
    "result.breakdown.hint": "warna = titik di peta",
    "result.miniCaption": "dalam {menit} menit jalan kaki dari titik terpilih",
    "data.note": "Data: OpenStreetMap · isochrone dihitung di jaringan jalan pejalan kaki (OSMnx)",
    // kategori
    "cat.warung": "Warung & minimarket",
    "cat.kuliner": "Tempat makan",
    "cat.sekolah": "Sekolah",
    "cat.faskes": "Puskesmas / klinik",
    "cat.transit": "Angkutan umum",
    "cat.taman": "Taman",
    "cat.ibadah": "Tempat ibadah",
    "cat.status.bad": "Terlalu jauh",
    "cat.status.warn": "Cuma 1 pilihan",
    "cat.status.ok": "{n} dekat",
    "cat.count.none": "tidak ditemukan dalam jangkauan",
    "cat.count.some": "{n} tempat terjangkau, nilai {score}/{weight}",
    // dock
    "dock.min": "mnt",
    "dock.score": "skor {n}",
    // bottom sheet
    "sheet.pullHint": "Tarik ke atas untuk semua kategori",
    "sheet.ctaCost": "Hitung Biaya Tinggal",
    "sheet.ctaMenu": "Kembali ke Menu",
    // biaya
    "cost.title": "Biaya Lokasi Bulanan",
    "cost.hint": "estimasi, bukan angka pasti",
    "cost.step1": "Langkah 1 · Lokasi",
    "cost.step2": "Langkah 2 · Sewa per bulan",
    "cost.rentLabel": "Sewa per bulan (Rp)",
    "cost.rentPlaceholder": "mis. 1.200.000",
    "cost.rentEmpty": "belum diisi",
    "cost.noExtra.title": "Tidak ada ongkos tambahan",
    "cost.noExtra.desc": "semua kategori berbiaya terjangkau jalan kaki",
    "cost.why.missing": "terlalu jauh jalan kaki · {base}",
    "cost.why.single": "cuma 1 pilihan · {base} × 50%",
    "cost.why.base": "{trips}x/bulan × {harga}",
    "cost.rowRent": "Sewa",
    "cost.rowExtra": "Estimasi ongkos tambahan",
    "cost.totalLabel": "Perkiraan total per bulan",
    "cost.disclaimer": "Ini perkiraan kasar, bukan angka pasti.",
    "cost.disclaimerLong": "Estimasi dari asumsi tarif ojol Zona I (Bandung) dan frekuensi perjalanan yang belum tervalidasi survei. Baca sebagai indikasi, bukan angka pasti.",
    "cost.note.sekolah": "Perjalanan sekolah biasanya bukan ojol harian - umumnya antar pribadi atau tetap jalan kaki meski jauh.",
    "cost.note.peribadatan": "Perjalanan ibadah rutin biasanya tetap dilakukan jalan kaki meski agak jauh, pola berbeda dari kebutuhan darurat.",
    "cost.note.transit": "Tanpa transit dalam radius jalan kaki, kemungkinan besar kamu bergantung penuh pada kendaraan pribadi untuk mobilitas sehari-hari - ini bukan biaya per-trip, tapi ketergantungan struktural.",
    "cost.compareCta": "Bandingkan lokasi lain",
    "cost.saveCompare": "Simpan untuk perbandingan",
    // perbandingan
    "compare.title": "Perbandingan 2 Lokasi",
    "compare.clear": "hapus",
    "compare.rowScore": "Skor ({menit} mnt)",
    "compare.rowRent": "Sewa",
    "compare.rowExtra": "Ongkos tambahan",
    "compare.rowTotal": "Total",
    "compare.winPill": "Lebih hemat total",
    "compare.slotHint": "Analisis lokasi lain, lalu simpan untuk membandingkan.",
    "compare.note": "Yang dibandingkan total biaya, bukan sewa. Sewa termurah belum tentu total termurah.",
    // kontrol tema
    "theme.toggle": "Ganti tema terang/gelap",
    "map.point": "Titik ({lat}, {lon})",
  },
  en: {
    "menu.kicker": "15-Minute City Score",
    "menu.title": "A good city can be lived on foot",
    "menu.sub": "How livable is your spot without a vehicle? Pick a tool.",
    "menu.tool1.name": "Check My Area",
    "menu.tool1.desc": "A 0-100 score and a map of everything you can reach on foot.",
    "menu.tool1.cta": "Start checking",
    "menu.tool1.sample": "sample: Antapani, decent",
    "menu.tool2.name": "Estimate Living Cost",
    "menu.tool2.desc": "Cheap rent isn't always cheaper. Add up rent + monthly ride costs, compare 2 spots.",
    "menu.tool2.cta": "Start estimating",
    "menu.tool2.sample": "sample monthly total in Antapani",
    "menu.swipeHint": "Swipe for the second tool",
    "menu.swipeBack": "Swipe back to the first tool",
    "menu.note": "Data: OpenStreetMap · walking street network analysis (OSMnx)",
    "menu.toolTag": "TOOL {n}",
    "brand.sub": "15-Minute City Score",
    "brand.menu": "Menu",
    "controls.demoLabel": "Try a sample location",
    "search.placeholder": "Search an address, or tap the map",
    "search.notFound": "Place not found. Try another keyword.",
    "search.failed": "Search failed.",
    "state.empty.title": "Pick a spot to start",
    "state.empty.body": "Tap the map, search an address, or use a sample location above.",
    "state.loading.title": "Analyzing the street network…",
    "state.loading.body": "Fetching streets & amenities from OpenStreetMap. Usually 5-30 seconds for a new spot.",
    "state.error.title": "Analysis failed",
    "state.error.body": "Could not reach the RADIUS server. Make sure it is running, then try again.",
    "notice.demoFallback": "Showing simulated data.",
    "result.caption": "{tempat} · {menit}-min walk",
    "result.captionFallback": "Selected point",
    "result.band.high": "Very walkable",
    "result.band.mid": "Decent, some gaps",
    "result.band.low": "Hard without a vehicle",
    "result.scaleLow": "0 hard without a vehicle",
    "result.scaleMid": "40 decent",
    "result.scaleHigh": "100 everything nearby",
    "result.gap.none": "All daily needs are within reach.",
    "result.gap.some": "{n} of {total} needs are out of walking reach",
    "result.gap.thin": "All needs covered, {n} of them with only 1 option.",
    "result.cached": "saved result, loaded instantly",
    "result.breakdown.title": "Category breakdown",
    "result.breakdown.gapTitle": "Biggest gaps first",
    "result.breakdown.hint": "color = dot on the map",
    "result.miniCaption": "within a {menit}-min walk of the selected point",
    "data.note": "Data: OpenStreetMap · isochrone computed on the walking street network (OSMnx)",
    "cat.warung": "Corner shop & minimart",
    "cat.kuliner": "Places to eat",
    "cat.sekolah": "School",
    "cat.faskes": "Clinic / health post",
    "cat.transit": "Public transit",
    "cat.taman": "Park",
    "cat.ibadah": "House of worship",
    "cat.status.bad": "Too far",
    "cat.status.warn": "Only 1 option",
    "cat.status.ok": "{n} nearby",
    "cat.count.none": "none within walking reach",
    "cat.count.some": "{n} places in reach, {score}/{weight} pts",
    "dock.min": "min",
    "dock.score": "score {n}",
    "sheet.pullHint": "Pull up to see all categories",
    "sheet.ctaCost": "Estimate Living Cost",
    "sheet.ctaMenu": "Back to Menu",
    "cost.title": "Monthly Location Cost",
    "cost.hint": "an estimate, not an exact figure",
    "cost.step1": "Step 1 · Location",
    "cost.step2": "Step 2 · Monthly rent",
    "cost.rentLabel": "Monthly rent (Rp)",
    "cost.rentPlaceholder": "e.g. 1,200,000",
    "cost.rentEmpty": "not set",
    "cost.noExtra.title": "No extra ride costs",
    "cost.noExtra.desc": "every cost category is within walking reach",
    "cost.why.missing": "too far to walk · {base}",
    "cost.why.single": "only 1 option · {base} × 50%",
    "cost.why.base": "{trips}x/month × {harga}",
    "cost.rowRent": "Rent",
    "cost.rowExtra": "Estimated extra rides",
    "cost.rowTotal": "Total",
    "cost.totalLabel": "Estimated total per month",
    "cost.disclaimer": "This is a rough estimate, not an exact figure.",
    "cost.disclaimerLong": "Estimated from Zone I (Bandung) ride-hailing fares and trip frequencies not yet survey-validated. Read as an indication, not an exact figure.",
    "cost.note.sekolah": "School trips usually aren't daily ride-hails - typically a personal drop-off, or still walked even when far.",
    "cost.note.peribadatan": "Regular worship trips are usually still made on foot even if a bit far, a different pattern from urgent errands.",
    "cost.note.transit": "With no transit within walking reach, you'll likely depend entirely on a private vehicle for daily mobility - not a per-trip cost, but a structural dependence.",
    "cost.compareCta": "Compare another location",
    "cost.saveCompare": "Save for comparison",
    "compare.title": "Comparing 2 Locations",
    "compare.clear": "clear",
    "compare.rowScore": "Score ({menit} min)",
    "compare.rowRent": "Rent",
    "compare.rowExtra": "Extra rides",
    "compare.rowTotal": "Total",
    "compare.winPill": "Cheaper overall",
    "compare.slotHint": "Analyze another location, then save it to compare.",
    "compare.note": "The comparison is about total cost, not rent. Cheapest rent is not always the cheapest total.",
    "theme.toggle": "Toggle light/dark theme",
    "map.point": "Point ({lat}, {lon})",
  },
};

function getLang() {
  const stored = localStorage.getItem("radius_lang");
  return stored === "en" ? "en" : "id";
}

function setLang(lang) {
  localStorage.setItem("radius_lang", lang === "en" ? "en" : "id");
}

/** Terjemahkan key; {placeholder} diisi dari params. Key tak dikenal -> key itu sendiri. */
function t(key, params) {
  let text = STRINGS[getLang()][key] ?? STRINGS.id[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** Isi semua elemen ber-atribut data-i18n / data-i18n-attr="attr:key". */
function applyI18n() {
  document.documentElement.lang = getLang();
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll("[data-i18n-attr]")) {
    for (const pair of el.dataset.i18nAttr.split(";")) {
      const [attr, key] = pair.split(":");
      if (attr && key) el.setAttribute(attr.trim(), t(key.trim()));
    }
  }
}
