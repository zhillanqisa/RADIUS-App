# RADIUS — Skor Kota 15 Menit

RADIUS mengukur seberapa layak-jalan-kaki satu titik lokasi: seberapa lengkap
kebutuhan harian (warung, sekolah, faskes, transit, taman, kuliner, tempat
ibadah) yang bisa dijangkau **berjalan kaki di jaringan jalan sungguhan**
dalam 5/10/15/20 menit. Bukan radius lingkaran — gang buntu, sungai, dan rel
kereta benar-benar membatasi jangkauan.

Dibangun untuk konteks perencanaan kota Indonesia (studi kasus: Bandung).

## Arsitektur

```
radius_core.py     ← logika domain: isochrone, POI, skor (OSMnx/Overpass)
app/
  config.py        ← semua konstanta & tuning (override via .env)
  cache.py         ← cache hasil per (lat, lon, menit), JSON di data/cache/
  services.py      ← orkestrasi: cache → live → fallback demo
  geocode.py       ← pencarian alamat (Nominatim)
  server.py        ← FastAPI: /api/analyze, /api/geocode, /api/config + static
web/               ← frontend Leaflet (vanilla JS, tanpa build step)
  vendor/          ← Leaflet, font, ikon di-vendor lokal (jalan tanpa CDN)
scripts/
  precompute_demo.py  ← pra-hitung 3 lokasi demo Bandung (pinned cache)
tests/             ← pytest; semua panggilan jaringan di-mock
```

**Keputusan arsitektur:** FastAPI + frontend statis (bukan Streamlit).
Model rerun Streamlit bertabrakan dengan interaksi peta (setiap klik memicu
rerun penuh dan peta ber-reset), dan kontrol penuh atas DOM/CSS dibutuhkan
untuk UI yang tidak terlihat generik. Satu proses uvicorn menyajikan API
dan frontend sekaligus — tanpa CORS, tanpa build Node, tetap satu perintah.

## Setup

Butuh **Python 3.11+** (osmnx 2.1.0 tidak mendukung 3.10 ke bawah).

```bash
# Windows
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Menjalankan

```bash
uvicorn app.server:app --host 127.0.0.1 --port 8000
```

Buka <http://127.0.0.1:8000> -- aplikasi dibuka ke **halaman menu** dengan dua
fitur terpisah:

- **Analisis Walkability** (`#/peta`): skor 0-100, isochrone, rincian kategori.
- **Kalkulator Biaya Lokasi** (`#/biaya`): mandiri -- pilih lokasi + durasi di
  halaman itu sendiri, masukkan sewa, dapatkan Total Biaya Lokasi + perbandingan
  2 lokasi.

Di kedua fitur: klik titik mana pun di peta, cari alamat, atau pakai chip
lokasi contoh. Tombol "Menu" di panel kembali ke halaman menu.

Menjalankan tes:

```bash
pytest
```

Pra-hitung ulang lokasi demo (perlu internet, ±3-5 menit):

```bash
python scripts/precompute_demo.py
```

## Metodologi skor

### Pipeline

1. **Graph jalan pejalan kaki** diunduh dari OSM (OSMnx, `network_type="walk"`)
   di sekitar titik, radius 1,3× jarak tempuh maksimum teoretis.
2. **Waktu tempuh per ruas** = panjang ruas ÷ kecepatan jalan 4,5 km/jam
   (asumsi umum literatur 15-minute city, kisaran 4-5 km/jam).
3. **Isochrone** = `ego_graph` berbobot waktu tempuh, lalu union buffer 40 m
   dari geometri ruas terjangkau ("network buffer") dalam CRS UTM. Convex
   hull sengaja TIDAK dipakai karena "menyeberangi" sungai/rel dan menutup
   area yang tidak terjangkau.
4. **POI** diambil satu query Overpass gabungan, difilter ke dalam polygon
   isochrone, lalu diklasifikasikan per kategori.
5. **Skor per kategori**: 0 POI → 0; tepat 1 POI → 75% bobot (ada, tapi tanpa
   pilihan — satu warung tutup berarti akses hilang); ≥2 POI → bobot penuh.
   Skor akhir dinormalisasi ke 0-100.

### Bobot kategori dan justifikasinya

| Kategori | Bobot | Justifikasi |
|---|---|---|
| Warung & minimarket | 20 | Kebutuhan pangan harian; frekuensi akses tertinggi dari semua kategori. Di kota Indonesia, warung adalah unit dasar layanan lingkungan. |
| Fasilitas kesehatan | 20 | Akses layanan primer & kondisi darurat; dimensi "healthcare" dalam kerangka 15-minute city (Moreno et al., 2021). Konsekuensi ketiadaannya paling berat. |
| Transportasi umum | 20 | Penentu apakah warga bisa beraktivitas lintas kota tanpa kendaraan pribadi; halte/stasiun adalah gerbang keluar dari lingkungan 15 menit itu sendiri. |
| Sekolah | 15 | Perjalanan rutin harian keluarga; jarak jalan kaki yang aman untuk anak adalah indikator klasik walkability lingkungan. |
| Kuliner | 10 | Sering diakses tapi substitusinya tinggi (tumpang tindih dengan warung); lebih ke kualitas hidup daripada kebutuhan dasar. |
| Taman & ruang terbuka | 10 | Kesehatan publik & interaksi sosial (dimensi "living"/"enjoying" Moreno), tapi frekuensi pemakaian tidak harian bagi mayoritas warga. |
| Tempat ibadah | 5 | Frekuensi akses tinggi di Indonesia, tapi kepadatan tempat ibadah sudah sangat tinggi hampir di semua lingkungan — bobot besar akan menggelembungkan semua skor tanpa membedakan lokasi. |

Kerangka acuan: Moreno, C., Allam, Z., Chabaud, D., Gall, C., & Pratlong, F.
(2021). *Introducing the "15-Minute City": Sustainability, Resilience and
Place Identity in Future Post-Pandemic Cities.* Smart Cities, 4(1), 93-111.
Bobot spesifiknya adalah penilaian kami untuk konteks kota Indonesia dan
mudah diubah di `radius_core.py::CATEGORY_WEIGHTS` (skor ternormalisasi,
jadi total bobot tidak harus 100).

### Interpretasi skor

- **≥ 70** — sangat layak jalan kaki; hampir semua kebutuhan harian terjangkau.
- **40-69** — cukup terlayani; ada kesenjangan kategori tertentu.
- **< 40** — bergantung kendaraan untuk kebutuhan dasar.

## Biaya Lokasi Bulanan ("Total Cost of Location")

Sewa murah di lokasi yang tidak walkable sering kali lebih mahal secara
total: setiap kebutuhan yang tak terjangkau jalan kaki berubah jadi ongkos
ojol/GoFood bulanan. Fitur ini menghitung estimasi itu dan menjumlahkannya
dengan sewa.

### Metodologi

- Asumsi tarif dan frekuensi ada di `cost_assumptions.py`. Tarif per
  perjalanan bersumber dari data publik tarif GoRide Zona I (Bandung/Jawa
  non-Jabodetabek, ~pertengahan 2026): Rp1.850-2.300/km, tarif minimum 4 km
  Rp8.000-10.000, ongkir GoFood ~Rp9.000. **Frekuensi perjalanan per bulan
  adalah estimasi penulis, BUKAN data survei** -- akan direvisi bila ada
  data penggunaan nyata.
- Kategori `count == 0` (tidak terjangkau): 100% frekuensi bulanan dihitung
  sebagai perjalanan ojol (`trips_per_month × cost_per_trip`).
- Kategori `count == 1` (hanya 1 pilihan): dihitung **50%** dari frekuensi
  (`SINGLE_OPTION_FACTOR` di `app/costs.py`). Satu pilihan tetap bisa
  dijalani kaki; membebankan tarif penuh akan melebih-lebihkan biaya.
- Hasil disajikan sebagai **rentang ±20%**, dibulatkan ke Rp1.000 -- karena
  ini estimasi, angka presisi tunggal justru menyesatkan. UI menyatakannya
  eksplisit.
- `sekolah`, `peribadatan`, dan `transit` sengaja **tidak** dikonversi ke
  rupiah (pola perjalanannya bukan ojol per kebutuhan); UI menampilkan
  catatan kualitatif sebagai gantinya. Alasan lengkap ada di docstring
  `cost_assumptions.py`.
- Total Biaya Lokasi = sewa (input pengguna) + rentang ongkos tambahan.
  Perbandingan 2 lokasi menyorot **total** termurah, bukan sewa termurah.

Semua angka asumsi menunggu validasi data nyata (mis. survei kecil
pengguna); struktur file memisahkan asumsi dari logika supaya revisi murah.

## Keandalan demo (wifi venue tidak stabil)

- **3 lokasi Bandung sudah dipra-hitung** (kampus ITB Ganesha, Pasar Baru,
  perumahan Antapani) untuk keempat durasi — tersimpan sebagai cache
  *pinned* di `data/cache/` (ikut di-commit) dan dimuat instan tanpa network.
- **Leaflet, font, dan ikon di-vendor lokal** — UI tetap termuat penuh
  tanpa internet. Yang butuh network hanya *tile* peta (CARTO) dan analisis
  titik baru.
- **Fallback otomatis**: kalau Overpass gagal/timeout, aplikasi menampilkan
  data simulasi deterministik dengan banner pemberitahuan — tidak pernah
  crash, tidak pernah menampilkan stack trace.

## Keterbatasan yang diketahui

- **Kelengkapan data OSM di Indonesia tidak merata.** Warung kecil/informal
  dan PKL jarang terpetakan, terutama di luar kota besar — skor kategori
  warung & kuliner cenderung *underestimate* di lingkungan informal.
  Sebaliknya area pusat kota yang aktif komunitas OSM-nya (Bandung, Jakarta,
  Yogyakarta) jauh lebih lengkap. Skor sebaiknya dibaca sebagai *batas
  bawah* kelengkapan fasilitas.
- **Angkot tidak masuk kategori transit.** Rute angkot umumnya tidak punya
  halte formal di OSM, padahal perannya besar di kota Indonesia. Ini membuat
  skor transit *underestimate* untuk banyak koridor.
- **Kecepatan jalan seragam.** Tanjakan (relevan di Bandung utara!), panas,
  kualitas trotoar, dan keamanan penyeberangan belum dimodelkan.
- **POI dihitung sebagai titik.** Fasilitas besar (RS, taman kota) dihitung
  dari titik representatifnya; gerbang masuk sebenarnya bisa lebih jauh.
- **Isochrone bergantung kelengkapan jaringan pejalan kaki OSM** — gang
  kecil yang belum dipetakan berarti jangkauan *underestimate*.

## Aplikasi Android (Capacitor)

Frontend `web/` dibungkus jadi aplikasi Android via Capacitor (WebView),
tanpa menulis ulang logika ke Kotlin. Proyek `android/` sudah di-scaffold.

Menjalankan di emulator/HP:

```bash
# 1. server FastAPI harus bisa diakses emulator lewat 10.0.2.2
uvicorn app.server:app --host 0.0.0.0 --port 8000

# 2. buka proyek Android (butuh Android Studio + SDK)
npx cap open android
# lalu Run dari Android Studio ke emulator/device
```

`capacitor.config.json` mengarahkan WebView ke `http://10.0.2.2:8000` selama
dev (alias emulator untuk `localhost` host). Untuk build produksi: deploy
FastAPI ke server publik dan ganti `server.url` ke domain itu, atau hapus
`server.url` supaya `web/` di-bundle di dalam APK (fetch `/api/*` tetap harus
menunjuk domain publik). Scaffold ulang: `scripts/setup-capacitor.sh`.

Spesifikasi desain lengkap tampilan mobile ada di `DESIGN-SPEC.md`.

### Tema, bahasa, dan tampilan mobile

- **Mode gelap**: ikut `prefers-color-scheme`, bisa dipaksa via tombol tema
  (bulan/matahari) di header; pilihan disimpan `localStorage.radius_theme`
  dan dibaca sebelum first paint (tanpa flash). Tile peta ganti ke CARTO
  `dark_all` saat gelap.
- **Bahasa ID/EN**: pil di header, kamus di `web/js/i18n.js`
  (`localStorage.radius_lang`, default `id`). Semua teks lewat `t()`.
- **Menu mobile** (<900px): dua kartu penuh yang digeser (scroll-snap native).
- **Hasil mobile**: peta besar + bottom sheet dengan handle tarik (snap ke 2
  posisi: ringkas 3 kategori / penuh 7 kategori). Desktop tidak berubah.

## Deploy produksi (Supabase + Render + Vercel)

Arsitektur real: **Vercel** host frontend, **backend FastAPI** (analisis OSMnx)
di **Render** karena stack geospasial + Overpass 5-30 dtk tak muat di serverless
Vercel, **Supabase** untuk Postgres (cache hasil + data user) & Auth.

```
Vercel (web/)  --/api/*-->  Render (FastAPI)  --service key-->  Supabase Postgres
     |                                                              ^
     +--------------------- supabase-js (auth, saved) --------------+
```

Tanpa env Supabase, app tetap jalan pakai cache file lokal (fallback anggun).

### 1. Supabase
1. Buat project di <https://supabase.com>.
2. SQL Editor → tempel & jalankan `supabase/migrations/0001_init.sql`
   (buat tabel `analysis_cache`, `profiles`, `saved_locations`,
   `analysis_history` + RLS).
3. Settings → API: catat **Project URL**, **anon key**, **service_role key**.
4. (Opsional) Authentication → Providers: aktifkan Email dan/atau Google.

### 2. Backend → Render
1. Push repo ke GitHub.
2. Render → New → **Blueprint** → pilih repo (`render.yaml` terbaca otomatis;
   pakai `Dockerfile`).
3. Isi env di dashboard (jangan commit): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
   `SUPABASE_ANON_KEY`, dan `RADIUS_CORS_ORIGINS` = URL Vercel-mu nanti.
4. Deploy → catat URL, mis. `https://radius-backend.onrender.com`.
5. (Opsional) isi Supabase dengan data demo pra-hitung:
   `SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python scripts/seed_supabase.py`.

### 3. Frontend → Vercel
1. Edit `vercel.json` → ganti `destination` rewrite ke URL backend Render-mu.
2. Vercel → Import repo. Framework: **Other**; Output dir: `web` (sudah di
   `vercel.json`). Deploy.
3. Setelah dapat URL Vercel, tambahkan ke `RADIUS_CORS_ORIGINS` backend Render.

### Keamanan
- **service_role key** hanya di backend (Render env). JANGAN commit / kirim ke
  browser — key ini mem-bypass RLS.
- **anon key** aman diekspos ke frontend (dilindungi RLS); backend
  meneruskannya lewat `/api/config`.
- `.env` sudah di `.gitignore`.

### Status fitur
- Cache hasil di Supabase Postgres (backend, dengan fallback file lokal) - siap.
- Config deploy Vercel + Render + Docker + skema Auth/RLS lengkap - siap.
- UI akun (login, simpan lokasi, riwayat) via supabase-js di frontend - skema DB
  sudah siap; lapisan UI menyusul.

## Konfigurasi

Salin `.env.example` ke `.env` untuk mengubah kecepatan jalan, timeout
Overpass, TTL cache, koordinat default, dan lainnya tanpa menyentuh kode.
