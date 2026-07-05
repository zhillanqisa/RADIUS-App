# RADIUS Android — Spesifikasi Desain Final
Sumber kebenaran visual: eksplorasi `RADIUS Eksplorasi UI.dc.html`, frame 6a/6b/6c (layout) + 7a/7b/7c (kontrol bahasa & tema). Dokumen ini adalah rincian yang diikuti Claude Code saat implementasi.

## 1. Rekomendasi platform
Codebase saat ini: FastAPI + web statis vanilla JS (`web/`), tanpa build step, semua aset di-vendor lokal. Cara tercepat dan paling konsisten untuk punya "aplikasi Android" tanpa menulis ulang logika (isochrone, skor, kalkulator biaya) di Kotlin:

**Bungkus `web/` sebagai WebView Android via Capacitor** (bukan Compose/Kotlin native). Alasan:
- Semua logika skor & fetch API tetap di server yang sama, nol duplikasi.
- UI yang didesain di kanvas (HTML/CSS/JS biasa) dipakai langsung, tanpa port ke Compose.
- Tetap "tanpa build step" dari sisi web; Capacitor cuma menambah shell native tipis.
- Kalau nanti user memang mau native murni, spesifikasi Bagian 3-7 di bawah tetap berlaku sebagai kontrak visual untuk dipindah ke Compose.

Jika Claude Code / user memutuskan native Kotlin+Compose sebagai gantinya, pakai token dan copy di bagian ini sebagai sumber kebenaran — jangan menerka ulang dari screenshot.

## 2. Struktur halaman baru
Tiga permukaan mobile, menggantikan/menambah yang ada di `web/index.html`:

1. **Menu awal (dua pintu geser)** — pengganti `#menu-screen` untuk viewport <900px.
2. **Analisis Walkability** — pengganti `.shell` untuk mobile: peta besar + bottom sheet.
3. **Kalkulator Biaya Lokasi** — tetap alur yang sudah ada (`#cost-view`), disesuaikan spacing mobile per referensi 5e.

Desktop (≥900px) TIDAK berubah — spesifikasi ini strictly untuk breakpoint mobile (`max-width: 900px`), ditambahkan sebagai override, bukan ganti total.

## 3. Token desain (tambahan ke `:root` yang sudah ada di app.css)
```css
:root {
  /* sudah ada: --ink, --ink-2, --surface, --card, --line, --accent (#124f5c), --radius (12px) ... */

  /* dark mode - ikut prefers-color-scheme, override manual via [data-theme="dark"] pada <html> */
  --bg-dark: #101815;
  --surface-dark: #141b18;
  --card-dark: #1c2823;
  --card-dark-border: #2c3a33;
  --ink-dark: #eef1ee;
  --ink-2-dark: #aeb8b0;
  --ink-3-dark: #8fa197;
  --accent-dark: #9dc3ae;        /* accent bergeser lebih terang di atas gelap agar AA */
  --accent-dark-ink: #101815;    /* teks di atas tombol accent gelap */
  --chrome-dark: #0b100e;        /* dock durasi tetap gelap gelap di kedua tema */

  --bad-bg-dark: #3d2a23;  --bad-ink-dark: #f0b9a6;
  --ok-bg-dark: #233d33;   --ok-ink-dark: #a9d8c2;
  --warn-ink-dark: #e3c268;
}
```
Aturan: JANGAN buat palet baru di luar ini. Warna 7 kategori (`--cat-*`) sama persis di kedua tema — legend harus konsisten.

## 4. Mode gelap: mekanisme
- Default: ikuti `prefers-color-scheme: dark` via media query.
- Override manual: tombol tema (ikon bulan/matahari) toggle atribut `data-theme="light"|"dark"` di `<html>`, disimpan di `localStorage.radius_theme`. Baca localStorage sebelum first paint (inline script kecil di `<head>`, sebelum CSS lain) supaya tidak ada flash.
- Implementasi CSS: dua jalur harus menghasilkan hasil sama —
  ```css
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { /* ganti var ke *-dark */ } }
  :root[data-theme="dark"] { /* ganti var ke *-dark, paksa meski OS-nya light */ }
  ```
  Cara termudah: definisikan semua warna tema sebagai custom property yang di-reassign di kedua selector di atas (bukan duplikasi seluruh ruleset).
- Komponen yang WAJIB diverifikasi di kedua tema: verdict card, band scale (3 segmen + marker), pill status kategori (ok/warn/bad), dock durasi, tile peta (ganti ke `dark_all` CARTO saat gelap: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`), search field, menu dua pintu.

## 5. Bahasa ID/EN: mekanisme
- Kontrol: pil segmented "ID / EN" di header (lihat 7a/7b). State aktif disimpan di `localStorage.radius_lang`, default `id`.
- Implementasi: dictionary JS sederhana, TANPA library i18n. Buat `web/js/i18n.js`:
  ```js
  const STRINGS = {
    id: { menuTitle: "Kota yang baik bisa dijalani kaki", cekLokasi: "Cek Lokasi Saya", ... },
    en: { menuTitle: "A good city can be lived on foot", cekLokasi: "Check My Area", ... },
  };
  function t(key) { return STRINGS[getLang()][key] ?? key; }
  ```
- Semua string yang tampil ke user (termasuk yang dihasilkan JS seperti status kategori, band label) HARUS lewat dictionary — tidak ada string ID hardcode di renderResult(). Kamus lengkap ada di Bagian 6.
- API tetap mengembalikan data mentah (angka, key kategori); JS yang menerjemahkan label ke UI, bukan server.
- Elemen dengan `id` yang dipakai kontrak (`score-band`, dst.) tetap sama, isinya saja yang berganti bahasa.

## 6. Kamus copy ID/EN (awam-friendly, tanpa istilah teknis)
| Key | ID | EN |
|---|---|---|
| menu.kicker | Skor Kota 15 Menit | 15-Minute City Score |
| menu.title | Kota yang baik bisa dijalani kaki | A good city can be lived on foot |
| menu.tool1.name | Cek Lokasi Saya | Check My Area |
| menu.tool1.desc | Nilai 0-100 dan peta: apa saja yang bisa dicapai jalan kaki dari titikmu. | A 0-100 score and a map of everything you can reach on foot. |
| menu.tool1.cta | Mulai cek | Start checking |
| menu.tool2.name | Hitung Biaya Tinggal | Estimate Living Cost |
| menu.tool2.desc | Sewa murah belum tentu hemat. Hitung sewa + ongkos ojek bulanan, bandingkan 2 lokasi. | Cheap rent isn't always cheaper. Add up rent + monthly ride costs, compare 2 spots. |
| menu.tool2.cta | Mulai hitung | Start estimating |
| menu.swipeHint | Geser untuk alat kedua | Swipe for the second tool |
| menu.swipeBack | Geser kembali ke alat pertama | Swipe back to the first tool |
| result.caption | {tempat} &middot; {menit} menit jalan kaki | {tempat} &middot; {menit}-min walk |
| result.band.high | Sangat layak jalan kaki | Very walkable |
| result.band.mid | Lumayan, ada yang kurang | Decent, some gaps |
| result.band.low | Susah tanpa kendaraan | Hard without a vehicle |
| result.scaleLow | 0 susah tanpa kendaraan | 0 hard without a vehicle |
| result.scaleHigh | 100 semua dekat | 100 everything nearby |
| result.gap.none | Semua kebutuhan harian terjangkau. | All daily needs are within reach. |
| result.gap.some | {n} dari {total} kebutuhan tidak tercapai jalan kaki | {n} of {total} needs are out of walking reach |
| cat.status.bad | Terlalu jauh | Too far |
| cat.status.warn | Cuma 1 pilihan | Only 1 option |
| cat.status.ok | {n} dekat | {n} nearby |
| cat.faskes | Puskesmas / klinik | Clinic / health post |
| cat.transit | Angkutan umum | Public transit |
| cat.kuliner | Tempat makan | Places to eat |
| cat.taman | Taman | Park |
| cat.warung | Warung & minimarket | Corner shop & minimart |
| cat.sekolah | Sekolah | School |
| cat.ibadah | Tempat ibadah | House of worship |
| search.placeholder | Cari alamat, atau ketuk peta | Search an address, or tap the map |
| sheet.pullHint | Tarik ke atas untuk semua kategori | Pull up to see all categories |
| cost.step1 | Langkah 1 &middot; Lokasi | Step 1 &middot; Location |
| cost.step2 | Langkah 2 &middot; Sewa per bulan | Step 2 &middot; Monthly rent |
| cost.totalLabel | Perkiraan total per bulan | Estimated total per month |
| cost.disclaimer | Ini perkiraan kasar, bukan angka pasti. | This is a rough estimate, not an exact figure. |
| cost.compareCta | Bandingkan lokasi lain | Compare another location |

Tambahkan kunci baru mengikuti pola ini untuk string lain di `index.html`/`app.js` yang belum tercakup (semua teks statis di panel, empty/loading/error state, dsb).

## 7. Menu dua pintu geser (mobile, gaya 6a/6b)
Berlaku hanya di `max-width: 900px`. Struktur:
```html
<nav class="menu-swipe" id="menu-swipe">
  <div class="swipe-track" id="swipe-track">
    <a class="swipe-pane pane-dark" href="#/peta">...</a>
    <a class="swipe-pane pane-light" href="#/biaya">...</a>
  </div>
  <div class="swipe-dots"><span class="active"></span><span></span></div>
  <p class="swipe-hint">...</p>
</nav>
```
Perilaku:
- `swipe-track`: `display:flex; overflow-x:auto; scroll-snap-type:x mandatory;` tiap `.swipe-pane { flex:0 0 88%; scroll-snap-align:center; }` — geser native, tidak perlu JS drag custom.
- Pintu 2 mengintip ~12% di kanan saat pintu 1 aktif (lebar pane 88%, bukan 100%).
- Dots dan hint teks diperbarui via `scroll` event listener + `IntersectionObserver` pada tiap pane (set `.active` pada dot yang sesuai, ganti teks hint antara `menu.swipeHint` / `menu.swipeBack`).
- Peek animation sekali di mount: translateX pane track -12px lalu kembali ke 0 via CSS animation, `@media (prefers-reduced-motion: reduce) { animation: none; }`.
- Tetap sertakan tombol CTA penuh ("Mulai cek" / "Mulai hitung") di dalam tiap pane untuk pengguna yang tidak menggeser — pane itu sendiri juga tetap `<a>` yang bisa diklik di mana pun.

## 8. Hasil analisis mobile (gaya 6c)
Ganti breakpoint mobile `.shell`/`.map-wrap`/`.panel` existing dengan:
- Peta full-bleed dari atas hingga ~59% tinggi viewport.
- Search field pill mengambang di atas peta (posisi tetap, bukan bagian dari scroll).
- Dock durasi (`#duration-group`, style sudah ada) diposisikan tepat di bawah search field, bukan lagi di tengah-atas.
- Bottom sheet: `position:fixed; left:0; right:0; bottom:0; height:41vh (default), border-radius:22px 22px 0 0`. Handle tarik `<div class="sheet-handle">` di tengah atas sheet.
- Sheet berisi (urut sesuai 6c): caption lokasi+durasi → skor besar + band label → band scale 3 segmen + marker → 3 kategori prioritas (kesenjangan terbesar dulu) → hint "Tarik ke atas untuk semua kategori".
- Tarik sheet: implementasi sederhana tanpa library — listen `touchstart/touchmove/touchend` pada handle, ubah `height` sheet antara 41vh (ringkas, 3 kategori) dan ~86vh (penuh, 7 kategori + 2 CTA lanjut, sesuai 6c yang sudah diverifikasi). Snap ke salah satu dari 2 posisi saat drag berakhir (bukan free-form).
- Kategori dengan status "Terlalu jauh"/"Cuma 1 pilihan" diberi border tipis warna hangat (lihat `--bad-bg`/`--warn-bg` existing) supaya langsung tertangkap mata (detail dari revisi 6c).

## 9. Kontrol bahasa & tema: penempatan
Di kedua breakpoint (desktop panel & mobile menu/hasil), pil "ID/EN" + tombol tema duduk di kanan header brand, sesuai 7a/7b. Ukuran hit target minimal 40x40px (tombol tema) dan 32px tinggi (pil bahasa) untuk mobile.

## 10. Checklist QA sebelum dianggap selesai
1. Toggle ID→EN mengganti SEMUA teks termasuk yang di-generate JS (band label, status kategori, cost disclaimer) — tidak ada sisa bahasa lama tercampur.
2. Toggle tema manual override menang atas `prefers-color-scheme`; refresh halaman mempertahankan pilihan (localStorage).
3. Tile peta ganti ke `dark_all` saat tema gelap, isochrone & marker kategori tetap kontras AA di kedua tema.
4. Menu swipe: scroll-snap bekerja dengan jari di Android sungguhan (bukan hanya mouse-drag di desktop), dots & hint sinkron dengan pane yang terlihat.
5. Bottom sheet: drag handle bekerja di device sungguhan, snap ke 2 posisi, tidak menutupi seluruh peta secara permanen di posisi ringkas.
6. Semua id kontrak (`search-input`, `duration-group`, `score-num`, dst.) tidak berubah — cek `web/js/app.js` existing masih jalan tanpa modifikasi API.
7. prefers-reduced-motion: peek animation menu dan transisi sheet dinonaktifkan/instan.
8. Kontras teks AA di kedua tema untuk semua pill status dan band label (pakai warna dari Bagian 3, jangan improvisasi).
