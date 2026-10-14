#!/usr/bin/env bash
# Cài LTB Media Network lên Cloud Server Ubuntu 24.04 (vd: iNET Cloud Server Linux) — chạy 1 lần với quyền root:
#
#   curl -fsSL https://raw.githubusercontent.com/nmt-ht/upload-media/master/deploy/setup.sh -o setup.sh
#   sudo DOMAIN=ltbmedia.net EMAIL=contact@ltbmedia.net bash setup.sh
#
# Chạy lại an toàn: bước nào đã làm thì bỏ qua, không đụng tới dữ liệu và mật khẩu admin đã có.
set -euo pipefail

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"                       # email nhận thông báo hết hạn SSL từ Let's Encrypt
REPO_URL="${REPO_URL:-https://github.com/nmt-ht/upload-media.git}"
BRANCH="${BRANCH:-master}"

APP_USER=ltbmedia
BASE_DIR=/opt/ltb-media
APP_DIR=$BASE_DIR/app
ENV_FILE=$BASE_DIR/.env
STORAGE_DIR=/var/lib/ltb-media           # data/ + uploads/ — đây là thứ cần giữ và sao lưu
BACKUP_DIR=/var/backups/ltb-media
PORT=3000

step() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;31m!!  %s\033[0m\n' "$*"; }

[[ $EUID -eq 0 ]] || { echo "Cần chạy bằng root: sudo bash setup.sh"; exit 1; }
grep -q '^ID=ubuntu' /etc/os-release || warn "Script viết cho Ubuntu 24.04 — hệ điều hành khác có thể lỗi."

[[ -n $DOMAIN ]] || read -rp "Tên miền (vd: ltbmedia.net): " DOMAIN
[[ -n $EMAIL ]] || read -rp "Email nhận thông báo SSL: " EMAIL
DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN#www.}"; DOMAIN="${DOMAIN%%/*}"

# ---------------------------------------------------------------------------
step "Cập nhật hệ thống và cài gói cần thiết"
export DEBIAN_FRONTEND=noninteractive
timedatectl set-timezone Asia/Ho_Chi_Minh || true
apt-get update -q
apt-get upgrade -yq
apt-get install -yq curl ca-certificates git nginx ufw certbot python3-certbot-nginx rclone unattended-upgrades

step "Bộ nhớ ảo (swap) 1 GB"
if ! swapon --show | grep -q .; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
  echo "Đã có swap — bỏ qua."
fi

step "Node.js 22"
if ! command -v node >/dev/null || [[ $(node -p 'process.versions.node.split(".")[0]') -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -yq nodejs
fi
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if (a<22||(a===22&&b<9)) { console.error("Cần Node >= 22.9, đang là "+process.version); process.exit(1) }'
echo "Node $(node -v)"

# ---------------------------------------------------------------------------
step "Người dùng hệ thống và thư mục"
id $APP_USER &>/dev/null || useradd --system --home-dir $BASE_DIR --shell /usr/sbin/nologin $APP_USER
mkdir -p $BASE_DIR $STORAGE_DIR $BACKUP_DIR
chown $APP_USER:$APP_USER $STORAGE_DIR    # web chỉ được ghi vào đây; code thuộc root, web không sửa được
chmod 750 $STORAGE_DIR $BACKUP_DIR

step "Tải code từ GitHub"
if [[ -d $APP_DIR/.git ]]; then
  git -C $APP_DIR pull --ff-only
else
  git clone --branch $BRANCH $REPO_URL $APP_DIR
fi
cd $APP_DIR
npm ci --omit=dev --no-audit --no-fund

step "Cấu hình (.env)"
NEW_PASSWORD=""
if [[ ! -f $ENV_FILE ]]; then
  NEW_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)
  cat > $ENV_FILE <<EOF
PORT=$PORT
ADMIN_PASSWORD=$NEW_PASSWORD
STORAGE_DIR=$STORAGE_DIR
DEMO_SEED=false
EOF
  chmod 600 $ENV_FILE
else
  echo "Đã có $ENV_FILE — giữ nguyên mật khẩu admin."
fi

step "Dữ liệu ban đầu"
if [[ ! -f $STORAGE_DIR/data/db.json ]]; then
  # Chỉ lấy thông tin liên hệ thật của khách từ demo; không nạp ảnh/âm thanh mẫu và số điện thoại demo.
  sudo -u $APP_USER STORAGE_DIR=$STORAGE_DIR node - <<'EOF'
const fs = require('fs'), path = require('path');
const demo = require('./demo/db.json').settings;
const keep = ['email', 'address', 'copyrightEmails', 'website', 'workingHours', 'telegram'];
const settings = Object.fromEntries(keep.map((k) => [k, demo[k] || '']));
const file = path.join(process.env.STORAGE_DIR, 'data', 'db.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify({ settings, media: [] }, null, 2) + '\n');
console.log('Đã tạo ' + file + ' (kho trống, giữ thông tin liên hệ).');
EOF
else
  echo "Đã có dữ liệu — giữ nguyên."
fi

# ---------------------------------------------------------------------------
step "Dịch vụ tự chạy nền (systemd)"
cat > /etc/systemd/system/ltb-media.service <<EOF
[Unit]
Description=LTB Media Network website
After=network.target

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$(command -v node) server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=$STORAGE_DIR

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now ltb-media
systemctl restart ltb-media
sleep 2
curl -fsS -o /dev/null http://127.0.0.1:$PORT/api/settings && echo "Web đang chạy ở cổng $PORT." \
  || { warn "Web chưa chạy — xem lỗi: journalctl -u ltb-media -n 50"; exit 1; }

step "Nginx (tên miền, giới hạn upload 1010 MB)"
cat > /etc/nginx/sites-available/ltb-media <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    client_max_body_size 1010m;  # audio cho phép tới 1000 MB (config.js)
    client_body_timeout 600s;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_request_buffering off;
        proxy_read_timeout 7200s;   # file lớn qua mạng chậm (khớp server.requestTimeout)
        proxy_send_timeout 600s;
    }
}
EOF
ln -sf /etc/nginx/sites-available/ltb-media /etc/nginx/sites-enabled/ltb-media
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

step "Tường lửa: chỉ mở SSH, HTTP, HTTPS"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
ufw status | sed -n '1,8p'

step "SSL miễn phí (Let's Encrypt)"
SERVER_IP=$(curl -4 -fsS https://api.ipify.org || true)
resolves() { [[ -n $SERVER_IP && "$(getent ahostsv4 "$1" | awk 'NR==1{print $1}')" == "$SERVER_IP" ]]; }
SSL_OK=false
if resolves "$DOMAIN"; then
  DOMAINS=(-d "$DOMAIN"); resolves "www.$DOMAIN" && DOMAINS+=(-d "www.$DOMAIN")
  certbot --nginx "${DOMAINS[@]}" --redirect --agree-tos -m "$EMAIL" --non-interactive && SSL_OK=true
else
  warn "$DOMAIN chưa trỏ về IP máy chủ ($SERVER_IP) — bỏ qua SSL."
  echo "    Trỏ bản ghi A của $DOMAIN và www.$DOMAIN về $SERVER_IP, đợi vài phút rồi chạy:"
  echo "    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --redirect --agree-tos -m $EMAIL"
fi

step "Sao lưu tự động hằng ngày (2:30 sáng)"
chmod +x $APP_DIR/deploy/backup.sh $APP_DIR/deploy/update.sh
cat > /etc/cron.d/ltb-media-backup <<EOF
30 2 * * * root STORAGE_DIR=$STORAGE_DIR BACKUP_DIR=$BACKUP_DIR $APP_DIR/deploy/backup.sh >> /var/log/ltb-media-backup.log 2>&1
EOF
STORAGE_DIR=$STORAGE_DIR BACKUP_DIR=$BACKUP_DIR $APP_DIR/deploy/backup.sh || true

# ---------------------------------------------------------------------------
step "XONG"
URL="http://$DOMAIN"; $SSL_OK && URL="https://$DOMAIN"
cat <<EOF

  Website:      $URL
  Quản trị:     $URL/admin
  Dữ liệu:      $STORAGE_DIR   (data/db.json + uploads/)
  Sao lưu:      $BACKUP_DIR    (db.json 30 ngày gần nhất)
  Xem log:      journalctl -u ltb-media -f
  Cập nhật:     sudo $APP_DIR/deploy/update.sh
EOF
if [[ -n $NEW_PASSWORD ]]; then
  cat <<EOF

  ┌──────────────────────────────────────────────────────────┐
     MẬT KHẨU ADMIN:  $NEW_PASSWORD
     Lưu lại ngay. Xem lại: sudo grep ADMIN_PASSWORD $ENV_FILE
  └──────────────────────────────────────────────────────────┘
EOF
fi
if ! rclone listremotes 2>/dev/null | grep -q '^ltbbackup:$'; then
  cat <<EOF

  Việc còn lại: đưa bản sao lưu ra ngoài máy chủ (Google Drive...) — xem mục
  "Sao lưu ra ngoài" trong README. Hiện mới sao lưu db.json trên chính máy chủ.
EOF
fi
