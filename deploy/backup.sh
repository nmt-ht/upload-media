#!/usr/bin/env bash
# Sao lưu hằng ngày (cron 2:30 sáng, do setup.sh cài). Chạy tay: sudo /opt/ltb-media/app/deploy/backup.sh
#  1. db.json (danh sách nội dung + cài đặt + chính sách) → BACKUP_DIR, giữ 30 ngày.
#  2. Nếu đã cấu hình rclone remote "ltbbackup" (Google Drive...): đẩy db.json và toàn bộ uploads/ ra ngoài.
#     File bị xoá trên web được chuyển vào deleted/<ngày> trên remote chứ không mất hẳn.
set -euo pipefail

STORAGE_DIR="${STORAGE_DIR:-/var/lib/ltb-media}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ltb-media}"
REMOTE="${RCLONE_REMOTE:-ltbbackup:ltb-media}"
KEEP_DAYS=30
stamp=$(date +%F)

mkdir -p "$BACKUP_DIR"
gzip -c "$STORAGE_DIR/data/db.json" > "$BACKUP_DIR/db-$stamp.json.gz"
find "$BACKUP_DIR" -name 'db-*.json.gz' -mtime +$KEEP_DAYS -delete
echo "$(date '+%F %T') db.json → $BACKUP_DIR/db-$stamp.json.gz"

if command -v rclone >/dev/null && rclone listremotes | grep -qx "${REMOTE%%:*}:"; then
  rclone copy "$BACKUP_DIR" "$REMOTE/db" --include 'db-*.json.gz'
  rclone sync "$STORAGE_DIR/uploads" "$REMOTE/uploads" --backup-dir "$REMOTE/deleted/$stamp"
  echo "$(date '+%F %T') đã đẩy ra $REMOTE"
else
  echo "$(date '+%F %T') chưa cấu hình rclone remote '${REMOTE%%:*}' — chỉ sao lưu db.json trên máy chủ" >&2
fi
