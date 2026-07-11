# Backend RADIUS (FastAPI + OSMnx) untuk host always-on (Render/Railway/Fly).
# Vercel serverless TIDAK cocok untuk stack geospasial ini -> pakai container.
FROM python:3.11-slim

# libgomp kadang dibutuhkan runtime oleh wheel geospasial (shapely/pyproj/sklearn).
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Layer deps dulu supaya cache build efektif.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Folder cache harus writable oleh user non-root (Hugging Face Spaces
# menjalankan container sebagai UID 1000). data/cache berisi demo pinned.
RUN mkdir -p /app/data/cache /app/data/osmnx_cache && chmod -R 777 /app/data

# Host inject $PORT (Render/Koyeb). Hugging Face route ke app_port (README).
ENV RADIUS_HOST=0.0.0.0
ENV PORT=8000
EXPOSE 8000

# Shell-form supaya $PORT ter-expand.
CMD uvicorn app.server:app --host 0.0.0.0 --port ${PORT:-8000}
