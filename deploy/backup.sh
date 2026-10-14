#!/usr/bin/env bash
# Sao lưu ra ngoài máy chủ (cron 2:30 sáng, do setup.sh cài). Chạy tay: sudo /opt/ltb-media/app/deploy/backup.sh
#
# Bản sao lưu trên máy chủ do chính web tạo (STORAGE_DIR/backups: mỗi ngày, trước khi xoá, trước khi khôi phục;
# ảnh/âm thanh đã xoá giữ 30 ngày trong STORAGE_DIR/trash) — xem/khôi phục ở trang quản trị → Sao lưu.
# Script này lo phần còn lại: phòng khi mất cả máy chủ.
#   backup.sh            đẩy backups/ và uploads/ lên rclone remote "ltbbackup" (Google Drive...) nếu đã cấu hình.
#                        File bị xoá trên web được chuyển vào deleted/<ngày> trên remote chứ không mất hẳn.
#   backup.sh server     như trên, nhưng chụp db.json thêm một bản trước (update.sh gọi trước khi cập nhật).
# Kết quả ghi vào backups/offsite-status.json để trang quản trị hiện "Sao lưu ra ngoài máy chủ".
set -uo pipefail

STORAGE_DIR="${STORAGE_DIR:-/var/lib/ltb-media}"
APP_USER="${APP_USER:-ltbmedia}"
REMOTE="${RCLONE_REMOTE:-ltbbackup:ltb-media}"
BK="$STORAGE_DIR/backups"
mkdir -p "$BK"

if [[ ${1:-} == server && -f $STORAGE_DIR/data/db.json ]]; then
  name="db-$(date -u +%Y%m%dT%H%M%SZ)-server.json.gz"
  gzip -c "$STORAGE_DIR/data/db.json" > "$BK/$name.tmp" && mv "$BK/$name.tmp" "$BK/$name"
  echo "$(date '+%F %T') đã chụp db.json → $BK/$name"
fi
chown -R "$APP_USER:" "$BK" 2>/dev/null || true

status() { # ok(true/false) message
  printf '{"at":"%s","ok":%s,"remote":"%s","message":"%s"}\n' \
    "$(date -u +%FT%TZ)" "$1" "$REMOTE" "$(printf '%s' "$2" | tr -d '"\\' | tr '\n' ' ' | cut -c1-300)" > "$BK/offsite-status.json"
  chown "$APP_USER:" "$BK/offsite-status.json" 2>/dev/null || true
}

if ! command -v rclone >/dev/null || ! rclone listremotes | grep -qx "${REMOTE%%:*}:"; then
  echo "$(date '+%F %T') chưa cấu hình rclone remote '${REMOTE%%:*}' — bản sao lưu chỉ nằm trên máy chủ" >&2
  exit 0
fi

log=$(mktemp)
# data/db.json: dữ liệu đúng lúc đẩy — restore.sh drive dùng bản này trước các bản chụp trong backups/.
if rclone copy "$STORAGE_DIR/data" "$REMOTE/data" --include 'db.json' >"$log" 2>&1 \
  && rclone copy "$BK" "$REMOTE/backups" --include 'db-*.json.gz' >>"$log" 2>&1 \
  && rclone sync "$STORAGE_DIR/uploads" "$REMOTE/uploads" --backup-dir "$REMOTE/deleted/$(date +%F)" >>"$log" 2>&1; then
  status true "Đã đẩy db.json, backups/ và uploads/"
  echo "$(date '+%F %T') đã đẩy ra $REMOTE"
else
  status false "$(tail -3 "$log")"
  echo "$(date '+%F %T') LỖI khi đẩy ra $REMOTE:" >&2
  cat "$log" >&2
  rm -f "$log"
  exit 1
fi
rm -f "$log"
