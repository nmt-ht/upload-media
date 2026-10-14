#!/usr/bin/env bash
# Khôi phục TOÀN BỘ dữ liệu (danh sách nội dung + ảnh/âm thanh) — dùng khi mất máy chủ / hỏng ổ đĩa.
# (Lỡ xoá nhầm hay muốn quay về hôm trước thì KHÔNG cần script này: trang quản trị → Sao lưu → Khôi phục.)
#
#   sudo /opt/ltb-media/app/deploy/restore.sh ltb-media-full-2026-10-14.tar   # file "Tải toàn bộ dữ liệu" từ trang quản trị
#   sudo /opt/ltb-media/app/deploy/restore.sh drive                          # bản trên Google Drive (rclone "ltbbackup")
#
# Máy chủ mới: chạy deploy/setup.sh trước, rồi chạy script này.
# Dữ liệu đang có không bị xoá: được chuyển sang <STORAGE_DIR>.before-restore-<thời điểm>.
set -euo pipefail

SRC="${1:-}"
APP_USER=ltbmedia
REMOTE="${RCLONE_REMOTE:-ltbbackup:ltb-media}"
STORAGE_DIR=$(sed -n 's/^STORAGE_DIR=//p' "/opt/ltb-media/.env" 2>/dev/null | tail -1 || true)
STORAGE_DIR="${STORAGE_DIR:-/var/lib/ltb-media}"
STAMP=$(date +%Y%m%d-%H%M%S)
STAGE="$STORAGE_DIR.restore-$STAMP"

die() { printf '\033[1;31m!!  %s\033[0m\n' "$*" >&2; [[ -d $STAGE ]] && rm -rf "$STAGE"; exit 1; }
step() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }

[[ $EUID -eq 0 ]] || { echo "Cần chạy bằng root: sudo $0 $*"; exit 1; }
if [[ -z $SRC ]]; then
  sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
fi
mkdir -p "$STAGE"

if [[ $SRC == drive ]]; then
  command -v rclone >/dev/null && rclone listremotes | grep -qx "${REMOTE%%:*}:" \
    || die "Chưa cấu hình rclone remote '${REMOTE%%:*}' (xem README → Sao lưu ra ngoài máy chủ)."
  step "Tải dữ liệu từ $REMOTE"
  rclone copy "$REMOTE/uploads" "$STAGE/uploads" --progress || die "Không tải được uploads/ từ $REMOTE"
  rclone copy "$REMOTE/backups" "$STAGE/backups" --include 'db-*.json.gz' || true
  rclone copy "$REMOTE/data" "$STAGE/data" --include 'db.json' 2>/dev/null || true
  if [[ -f $STAGE/data/db.json ]]; then
    echo "Dùng dữ liệu của lần đẩy gần nhất (data/db.json)."
  else # bản đẩy từ phiên bản cũ của backup.sh chưa có data/ → lấy bản chụp mới nhất
    rclone copy "$REMOTE/db" "$STAGE/backups-legacy" --include 'db-*.json.gz' 2>/dev/null || true
    latest=$(ls "$STAGE"/backups/db-*Z-*.json.gz 2>/dev/null | grep -v -- '-upload\.json\.gz$' | sort | tail -1 || true)
    [[ -n $latest ]] || latest=$(ls "$STAGE"/backups-legacy/db-*.json.gz 2>/dev/null | sort | tail -1 || true)
    [[ -n $latest ]] || die "Không tìm thấy bản sao lưu db.json nào trên $REMOTE"
    echo "Dùng bản: $(basename "$latest")"
    mkdir -p "$STAGE/data"
    gunzip -c "$latest" > "$STAGE/data/db.json"
    rm -rf "$STAGE/backups-legacy"
  fi
  # File của mục đã bị xoá trên web nằm ở deleted/<ngày>/ trên remote — lấy lại những file db.json còn cần.
  node -e '
    const fs = require("fs"), path = require("path");
    const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    for (const m of d.media || []) if (!fs.existsSync(path.join(process.argv[2], m.url))) console.log(m.url.replace(/^\/uploads\//, ""));
  ' "$STAGE/data/db.json" "$STAGE" > "$STAGE/need.txt" || true
  if [[ -s $STAGE/need.txt ]]; then
    echo "Tìm $(wc -l < "$STAGE/need.txt") file còn thiếu trong $REMOTE/deleted …"
    rclone copy "$REMOTE/deleted" "$STAGE/deleted" --include-from <(sed 's#^#*/#' "$STAGE/need.txt") 2>/dev/null || true
    while IFS= read -r rel; do
      found=$(find "$STAGE/deleted" -path "*/$rel" 2>/dev/null | sort | tail -1)
      [[ -n $found ]] && mkdir -p "$(dirname "$STAGE/uploads/$rel")" && mv "$found" "$STAGE/uploads/$rel"
    done < "$STAGE/need.txt"
  fi
  rm -rf "$STAGE/deleted" "$STAGE/need.txt"
else
  [[ -f $SRC ]] || die "Không thấy file $SRC"
  step "Giải nén $SRC"
  tar -xf "$SRC" -C "$STAGE" || die "File .tar hỏng"
  [[ -f $STAGE/data/db.json ]] || die "File .tar không có data/db.json — có phải file \"Tải toàn bộ dữ liệu\" không?"
fi

step "Kiểm tra dữ liệu"
summary=$(node -e '
  const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  if (!Array.isArray(d.media) || typeof d.settings !== "object") throw new Error("sai cấu trúc");
  const fs = require("fs"), path = require("path");
  const missing = d.media.filter((m) => !fs.existsSync(path.join(process.argv[2], m.url))).length;
  console.log(`${d.media.filter((m) => m.type === "image").length} ảnh, ${d.media.filter((m) => m.type === "audio").length} âm thanh` +
    (missing ? ` — THIẾU ${missing} file` : ", đủ file"));
' "$STAGE/data/db.json" "$STAGE") || die "data/db.json không hợp lệ"
echo "Bản khôi phục: $summary"

if [[ ${ASSUME_YES:-} != 1 ]]; then
  read -rp "Thay toàn bộ dữ liệu đang chạy bằng bản này? Gõ 'co' để tiếp tục: " ans
  [[ $ans == co ]] || die "Đã huỷ, không thay đổi gì."
fi

step "Khôi phục"
systemctl stop ltb-media 2>/dev/null || true
SAFE="$STORAGE_DIR.before-restore-$STAMP"
if [[ -d $STORAGE_DIR ]]; then
  mv "$STORAGE_DIR" "$SAFE"
  echo "Dữ liệu cũ giữ tại: $SAFE (xoá khi chắc chắn không cần)"
fi
mv "$STAGE" "$STORAGE_DIR"
# Giữ lại các bản sao lưu của máy chủ cũ (nếu có) để còn quay về được.
mkdir -p "$STORAGE_DIR/backups"
for f in "$SAFE"/backups/db-*; do
  [[ -f $f && ! -e $STORAGE_DIR/backups/$(basename "$f") ]] && cp "$f" "$STORAGE_DIR/backups/"
done
chown -R "$APP_USER:" "$STORAGE_DIR"
chmod 750 "$STORAGE_DIR"
systemctl start ltb-media
sleep 2
curl -fsS -o /dev/null http://127.0.0.1:3000/api/settings \
  && echo "Đã khôi phục ($summary) — web đang chạy." \
  || die "Web không chạy sau khi khôi phục — xem: journalctl -u ltb-media -n 50. Dữ liệu cũ vẫn ở $SAFE"
