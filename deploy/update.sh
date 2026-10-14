#!/usr/bin/env bash
# Cập nhật web lên bản mới nhất trên GitHub: sudo /opt/ltb-media/app/deploy/update.sh
# Dữ liệu (STORAGE_DIR) không bị đụng tới; db.json được sao lưu trước khi cập nhật.
set -euo pipefail

APP_DIR=/opt/ltb-media/app
[[ $EUID -eq 0 ]] || { echo "Cần chạy bằng root: sudo $0"; exit 1; }
STORAGE_DIR=$(sed -n 's/^STORAGE_DIR=//p' "/opt/ltb-media/.env" 2>/dev/null | tail -1 || true)
export STORAGE_DIR="${STORAGE_DIR:-/var/lib/ltb-media}"

"$APP_DIR/deploy/backup.sh" server || true
cd "$APP_DIR"
before=$(git rev-parse --short HEAD)
git pull --ff-only
npm ci --omit=dev --no-audit --no-fund
chmod +x deploy/*.sh

# Bản sao lưu kiểu cũ (/var/backups/ltb-media/db-<ngày>.json.gz, chỉ root đọc được) → chép vào
# STORAGE_DIR/backups để hiện trong trang quản trị → Sao lưu. Chạy lại không chép trùng.
for f in /var/backups/ltb-media/db-????-??-??.json.gz; do
  [[ -f $f ]] || continue
  d=$(basename "$f" .json.gz); d=${d#db-}
  dest="$STORAGE_DIR/backups/db-${d//-/}T000000Z-imported.json.gz"
  [[ -f $dest ]] || { mkdir -p "$STORAGE_DIR/backups"; cp "$f" "$dest"; }
done
chown -R ltbmedia: "$STORAGE_DIR/backups" 2>/dev/null || true

# Đồng bộ giới hạn upload của Nginx với config.js (server cài từ bản cũ để 310 MB).
# Chỉ sửa từng dòng vì certbot đã thêm cấu hình SSL vào file; lỗi thì khôi phục bản cũ.
NGINX_CONF=/etc/nginx/sites-available/ltb-media
if [[ -f $NGINX_CONF ]] && ! grep -q 'client_max_body_size 1010m;' "$NGINX_CONF"; then
  cp "$NGINX_CONF" "$NGINX_CONF.bak"
  sed -i -E \
    -e 's/client_max_body_size [0-9]+[mMgG];.*/client_max_body_size 1010m;  # audio cho phép tới 1000 MB (config.js)/' \
    -e 's/client_body_timeout [0-9]+s;/client_body_timeout 600s;/' \
    -e 's/proxy_read_timeout [0-9]+s;.*/proxy_read_timeout 7200s;   # file lớn qua mạng chậm (khớp server.requestTimeout)/' \
    -e 's/proxy_send_timeout [0-9]+s;/proxy_send_timeout 600s;/' \
    "$NGINX_CONF"
  if nginx -t 2>/dev/null; then
    systemctl reload nginx && echo "Nginx: đã nâng giới hạn upload lên 1010 MB."
  else
    cp "$NGINX_CONF.bak" "$NGINX_CONF"
    echo "⚠  Nginx: không áp dụng được cấu hình mới, đã giữ nguyên bản cũ (upload audio > 300 MB sẽ bị chặn)."
  fi
fi
systemctl restart ltb-media
sleep 2
curl -fsS -o /dev/null http://127.0.0.1:3000/api/settings \
  && echo "Đã cập nhật $before → $(git rev-parse --short HEAD), web đang chạy." \
  || { echo "Web không chạy sau khi cập nhật — xem: journalctl -u ltb-media -n 50"; exit 1; }
