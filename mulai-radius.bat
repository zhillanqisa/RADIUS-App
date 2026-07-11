@echo off
REM ====================================================================
REM  Nyalakan RADIUS ke internet (tanpa kartu, gratis).
REM  Klik-dua-kali file ini. Biarkan jendela terbuka selama dipakai.
REM  URL publik (https://...trycloudflare.com) muncul di bawah -- salin,
REM  buka di HP / share ke teman.
REM  Tutup jendela = app mati. URL BERGANTI tiap kali dijalankan.
REM ====================================================================
cd /d D:\Collage\Radius-APP

echo Menyalakan server RADIUS...
start "RADIUS server" .venv\Scripts\python.exe -m uvicorn app.server:app --host 127.0.0.1 --port 8000
timeout /t 6 /nobreak >nul

echo.
echo ============================================================
echo  URL publik muncul di baris "https://....trycloudflare.com"
echo  Salin URL itu, buka di HP.  (Ctrl+C untuk berhenti.)
echo ============================================================
echo.
tools\cloudflared.exe tunnel --url http://127.0.0.1:8000 --no-autoupdate
