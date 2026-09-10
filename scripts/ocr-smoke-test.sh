#!/usr/bin/env bash
# Smoke test KTP OCR langsung di server. Harus dijalankan dari direktori
# deploy project (mis. ~/docker/projects/menteng-kos-private).
#
#   bash scripts/ocr-smoke-test.sh <path-foto-ktp-asli>          # engine + pipeline Laravel
#   bash scripts/ocr-smoke-test.sh <path-foto-ktp-asli> --ui-only # cek engine saja
set -euo pipefail

PHOTO="${1:?Usage: $0 <foto-ktp> [--ui-only]}"
UI_ONLY="${2:-}"

if [ ! -f "$PHOTO" ]; then
  echo "GAGAL: file '$PHOTO' tidak ada. Beri path file foto KTP yang benar."
  echo "Cek lokasi foto: find ~ -maxdepth 3 -iname \"*.jpg\" 2>/dev/null | head"
  exit 1
fi

echo "== [1/3] Container OCR hidup? =="
docker compose ps --status running | grep -q ocr-service \
  && echo "OK: ocr-service running" \
  || echo "PERINGATAN: ocr-service tidak terlihat running — cek 'docker compose ps'"

echo "== [2/3] Engine PaddleOCR membaca foto? =="
# Port 8000 di-publish ke host (lihat docker-compose.yml). Hostname
# "menteng-kos-ocr" hanya valid DI DALAM jaringan Docker — dipakai oleh
# Laravel app, bukan dari shell host.
RAW=$(curl -sf -F "file=@${PHOTO};type=image/jpeg" http://localhost:8000/ocr || true)
if [ -z "$RAW" ]; then
  echo "GAGAL: tidak ada respons dari http://localhost:8000/ocr"
  echo "  - cek 'docker compose logs ocr-service | tail -50'"
  echo "  - pastikan port 8000 tidak dipakai proses lain: 'ss -ltnp | grep 8000'"
  echo "  - pastikan model ter-download: log berisi 'download ... to ~/.paddleocr'"
  exit 1
fi
BOX_COUNT=$(echo "$RAW" | grep -o '"text"' | wc -l)
echo "OK: engine membaca ${BOX_COUNT} baris teks."
echo "Contoh teks yang terbaca:"
echo "$RAW" | grep -o '"text": *"[^"]*"' | head -20

[ "$UI_ONLY" = "--ui-only" ] && exit 0

echo "== [3/3] Pipeline KtpOcrService (4 varian preprocessing + extractor) =="
docker compose exec -T kos-app sh -c 'cat > /tmp/ocr-smoke.jpg' < "$PHOTO"
docker compose exec -T kos-app php artisan tinker --execute='$r = app(App\Services\KtpOcrService::class)->extract("/tmp/ocr-smoke.jpg"); unset($r["raw"]); echo json_encode($r, JSON_PRETTY_PRINT), PHP_EOL;'

echo
echo "Verifikasi UI: upload foto yang sama lewat menu Tenancy (auto-process)."
echo "Jika field tidak masuk, cek log: docker compose logs -f kos-app | grep \"KTP OCR\""