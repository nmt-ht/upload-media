#!/usr/bin/env bash
# Cập nhật web lên bản mới nhất trên GitHub: sudo /opt/ltb-media/app/deploy/update.sh
# Dữ liệu (STORAGE_DIR) không bị đụng tới; db.json được sao lưu trước khi cập nhật.
set -euo pipefail

APP_DIR=/opt/ltb-media/app
[[ $EUID -eq 0 ]] || { echo "Cần chạy bằng root: sudo $0"; exit 1; }

"$APP_DIR/deploy/backup.sh" || true
cd "$APP_DIR"
before=$(git rev-parse --short HEAD)
git pull --ff-only
npm ci --omit=dev --no-audit --no-fund
chmod +x deploy/*.sh
systemctl restart ltb-media
sleep 2
curl -fsS -o /dev/null http://127.0.0.1:3000/api/settings \
  && echo "Đã cập nhật $before → $(git rev-parse --short HEAD), web đang chạy." \
  || { echo "Web không chạy sau khi cập nhật — xem: journalctl -u ltb-media -n 50"; exit 1; }
