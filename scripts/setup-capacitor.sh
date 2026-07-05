#!/usr/bin/env bash
# Scaffold Android (Capacitor WebView) wrapper around the existing web/ frontend.
# Run from the repo root (Radius-APP/). Requires Node.js + npm, and Android
# Studio / SDK installed for the final `npx cap open android` build step.
set -euo pipefail

APP_NAME="RADIUS"
APP_ID="id.ac.itb.radius"   # ganti sesuai kebutuhan (reverse-DNS)

if [ ! -d "web" ]; then
  echo "Jalankan skrip ini dari root repo Radius-APP (folder web/ harus ada di sini)." >&2
  exit 1
fi

if [ ! -f "package.json" ]; then
  npm init -y >/dev/null
fi

npm install --save @capacitor/core @capacitor/android
npm install --save-dev @capacitor/cli

npx cap init "$APP_NAME" "$APP_ID" --web-dir=web

# Pastikan capacitor.config.json menunjuk ke folder web statis yang sudah ada
node -e "
const fs = require('fs');
const path = 'capacitor.config.json';
const cfg = JSON.parse(fs.readFileSync(path, 'utf8'));
cfg.webDir = 'web';
cfg.server = cfg.server || {};
// Selama development, arahkan ke server FastAPI lokal supaya /api/* tetap hidup.
// Hapus/comment baris 'url' ini untuk build produksi offline-first.
cfg.server.url = 'http://10.0.2.2:8000';
cfg.server.cleartext = true;
fs.writeFileSync(path, JSON.stringify(cfg, null, 2));
console.log('capacitor.config.json diperbarui:', JSON.stringify(cfg, null, 2));
"

npx cap add android
npx cap sync android

cat <<'EOF'

Selesai scaffolding. Langkah berikutnya:
1. Jalankan server FastAPI seperti biasa: uvicorn app.server:app --host 0.0.0.0 --port 8000
   (host 0.0.0.0 supaya emulator Android bisa mengaksesnya lewat 10.0.2.2)
2. Buka proyek Android: npx cap open android
3. Run dari Android Studio ke emulator/device.

Untuk build produksi (tanpa bergantung server dev lokal), pertimbangkan:
- Deploy FastAPI ke server publik dan ganti cfg.server.url ke domain itu, ATAU
- Hapus cfg.server.url sepenuhnya supaya WebView memuat berkas web/ yang di-bundle
  langsung di dalam APK (fetch ke /api/* tetap harus menunjuk domain publik).
EOF
