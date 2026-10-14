# LTB Media — Digital Rights Protection

Website giới thiệu + kho ảnh & âm thanh có bản quyền, kèm trang quản trị để tải nội dung lên và **tự chọn ngày đăng hiển thị**.

## Các trang

| Đường dẫn | Nội dung |
|---|---|
| `/` | Trang chủ: giới thiệu, nội dung mới, liên hệ |
| `/images` | Kho ảnh (lọc theo năm, tìm kiếm, xem phóng to) |
| `/audio` | Kho âm thanh (nghe thử ngay trên trang) |
| `/admin` | Quản trị: tải lên, sửa ngày đăng / tiêu đề, xoá, cài đặt liên hệ |

Nút trên trang chủ (theo mockup):
- **Đăng ký bảo vệ bản quyền** → popup WhatsApp · Zalo · Telegram
- **Khám phá kho tài nguyên** → popup Stock Images · Licensed Audio
- **Content Monitoring** → mở link nhập trong *Quản trị → Cài đặt* (chưa nhập thì báo "đang cập nhật")
- **Stock Images / Licensed Audio** → kho ảnh / kho âm thanh

## Chạy thử trên máy

Cần Node.js 22.9 trở lên.

```bash
npm install
cp .env.example .env      # rồi sửa ADMIN_PASSWORD
npm start
```

Mở http://localhost:3000, trang quản trị ở http://localhost:3000/admin.

## Quy định file (sửa trong `config.js`)

| Loại | Định dạng | Kích thước / thời lượng | Dung lượng tối đa |
|---|---|---|---|
| Ảnh | JPG, PNG, WebP | đúng 1920×1080 px | 1,5 MB |
| Âm thanh | MP3, WAV, M4A, OGG, FLAC | 10–15 giây | 1000 MB |

Server kiểm tra lại định dạng, dung lượng, kích thước ảnh và ngày đăng; trang quản trị kiểm tra trước khi gửi và báo lỗi cụ thể.

## Ngày đăng

- **Ngày đăng công khai**: admin chọn tuỳ ý (có nút nhanh Hôm nay / 2025 / 2024 / …), là ngày khách thấy trên web và dùng để sắp xếp, lọc theo năm. Sửa lại được bất cứ lúc nào ở tab *Quản lý kho*.
- **Ngày tải lên thật**: hệ thống tự ghi, chỉ hiện trong trang quản trị, không trả ra API công khai.

## Dữ liệu

Tất cả nằm trong thư mục `STORAGE_DIR` (mặc định: thư mục dự án):

- `data/db.json` — danh sách nội dung + cài đặt liên hệ
- `uploads/images`, `uploads/audio` — file đã tải lên
- `.tmp/` — file đang tải lên dở, xoá thoải mái

Nội dung chỉ bị xoá khi admin bấm Xoá trong trang quản trị — không có cơ chế tự xoá hay giới hạn số lượng.
Điều kiện duy nhất: `STORAGE_DIR` phải nằm trên ổ đĩa không bị xoá khi server khởi động lại (VPS, hoặc Render gói trả phí có Persistent Disk — xem `render.yaml`).
Nếu `db.json` bị hỏng, server sẽ dừng và báo lỗi thay vì tạo dữ liệu rỗng đè lên — khôi phục từ bản sao lưu rồi chạy lại.

Sao lưu `data/` và `uploads/` là đủ (nên sao lưu định kỳ). Xoá cả hai để làm trống website (dữ liệu demo hiện tại chỉ là ảnh gradient và âm thanh test).

### Có thể tải lên bao nhiêu file?

Không giới hạn số lượng trong code; giới hạn thực tế là dung lượng ổ đĩa. Ước tính cho mỗi 1 GB:

| Loại | Dung lượng mỗi file | Số file / 1 GB |
|---|---|---|
| Ảnh 1920×1080 | thường 0,3–1,5 MB | ~700–3.000 |
| Âm thanh MP3 10–15 giây | ~0,2–0,6 MB | ~1.700–5.000 |
| Âm thanh WAV 10–15 giây | ~1,7–2,6 MB | ~400–600 |

Giới hạn 1000 MB cho audio rộng hơn nhiều so với một file 10–15 giây thực tế (WAV 24-bit/96 kHz 15 giây cũng chỉ ~9 MB); file lớn mất nhiều thời gian tải lên và chiếm ổ đĩa tương ứng.

Trang kho ảnh / âm thanh hiện tải toàn bộ danh sách một lần, chạy mượt tới khoảng vài nghìn file mỗi loại; nhiều hơn nên thêm phân trang.

## Demo miễn phí trên Render.com

File `render.yaml` đã cấu hình sẵn (gói Free, mật khẩu admin do Render tự sinh).

1. Đẩy thư mục này lên một repo GitHub (nên để Private).
2. Vào https://dashboard.render.com → **New → Blueprint** → chọn repo → **Apply**.
3. Xem mật khẩu admin: service `ltb-media` → **Environment** → `ADMIN_PASSWORD`.

⚠ Lưu ý gói Free: server ngủ sau 15 phút không có truy cập (lần mở đầu chờ ~1 phút); ổ đĩa bị xoá mỗi lần khởi động lại nên **nội dung tải lên thêm sẽ mất**, website quay về dữ liệu demo trong `demo/`. Khi chạy thật, dùng VPS bên dưới hoặc gói Render trả phí có Persistent Disk (các bước có sẵn ở cuối `render.yaml`: `plan: starter`, `disk` gắn ở `/var/data`, `STORAGE_DIR=/var/data`, `DEMO_SEED=false`).

## Đưa lên máy chủ (Cloud Server / VPS Ubuntu 24.04)

Viết cho iNET **Cloud Server Linux 2** (1 core, 2 GB RAM, 20 GB SSD) hoặc VPS Ubuntu 24.04 tương đương. Không dùng gói *Hosting* của iNET (chỉ chạy PHP/WordPress).

### 1. Chuẩn bị

- Khi tạo máy chủ, chọn image **Linux Core → Ubuntu-24.04-LTS** (không chọn các image "Linux Phần Mềm" — chúng cài sẵn panel chiếm cổng 80/443).
- Ở nơi quản lý tên miền, tạo 2 bản ghi **A**: `@` và `www` → IP máy chủ. Làm trước để script cấp SSL luôn; làm sau cũng được.

### 2. Cài đặt (1 lệnh)

SSH vào máy chủ (`ssh root@IP_MAY_CHU`) rồi chạy:

```bash
curl -fsSL https://raw.githubusercontent.com/nmt-ht/upload-media/master/deploy/setup.sh -o setup.sh
sudo DOMAIN=ltbmedia.net EMAIL=contact@ltbmedia.net bash setup.sh
```

Script ([deploy/setup.sh](deploy/setup.sh)) tự làm: cập nhật Ubuntu, swap 1 GB, Node.js 22, tải code về `/opt/ltb-media/app`, tạo `.env` với **mật khẩu admin ngẫu nhiên** (in ra màn hình cuối cùng — lưu lại), dữ liệu ở `/var/lib/ltb-media` (`DEMO_SEED=false`, kho trống, giữ thông tin liên hệ), chạy nền bằng systemd (tự bật lại khi lỗi / khởi động lại máy), Nginx với giới hạn upload 1010 MB, tường lửa (chỉ mở SSH/HTTP/HTTPS), SSL Let's Encrypt (tự gia hạn), sao lưu `db.json` hằng ngày lúc 2:30.
Chạy lại script an toàn — không đụng tới dữ liệu và mật khẩu đã có.

Nếu lúc cài tên miền chưa trỏ về máy chủ, script bỏ qua SSL và in sẵn lệnh `certbot` để chạy sau.

### 3. Vận hành

| Việc | Lệnh |
|---|---|
| Cập nhật web lên bản mới nhất trên GitHub | `sudo /opt/ltb-media/app/deploy/update.sh` |
| Xem log | `journalctl -u ltb-media -f` |
| Khởi động lại web | `sudo systemctl restart ltb-media` |
| Xem mật khẩu admin | `sudo grep ADMIN_PASSWORD /opt/ltb-media/.env` |
| Đổi mật khẩu admin | sửa dòng đó trong `/opt/ltb-media/.env` rồi `sudo systemctl restart ltb-media` |
| Dung lượng ổ đĩa | `df -h /` và `sudo du -sh /var/lib/ltb-media/uploads` |

### 4. Sao lưu ra ngoài máy chủ (nên làm)

Mặc định chỉ sao lưu `db.json` trên chính máy chủ. Để đẩy cả `db.json` lẫn toàn bộ ảnh/âm thanh sang Google Drive mỗi đêm, cấu hình rclone 1 lần:

1. Trên máy chủ chạy `sudo rclone config` → `n` (new remote) → tên **`ltbbackup`** → chọn **Google Drive** → để trống client id/secret → scope `1` (full access) → các câu sau Enter mặc định.
2. Khi hỏi *"Use web browser to automatically authenticate?"* chọn **`n`**: rclone in ra một lệnh `rclone authorize "drive" "..."`. Chạy lệnh đó trên máy tính có trình duyệt (cài rclone từ rclone.org), đăng nhập Google, rồi dán mã nhận được vào máy chủ.
3. Kiểm tra: `sudo /opt/ltb-media/app/deploy/backup.sh` — dòng cuối phải là "đã đẩy ra ltbbackup:ltb-media".

Trên Drive sẽ có thư mục `ltb-media/` gồm `db/` (30 bản db.json gần nhất), `uploads/` (bản sao toàn bộ file) và `deleted/<ngày>` (file admin đã xoá trên web — xoá hẳn khi chắc chắn không cần).
Ngoài ra nên bật **Snapshot / Backup tự động** của nhà cung cấp máy chủ (iNET: mục Cloud Server → Snapshots).

**Khôi phục:** dừng web (`sudo systemctl stop ltb-media`), giải nén bản `db-<ngày>.json.gz` cần dùng vào `/var/lib/ltb-media/data/db.json`, chép lại `uploads/` từ Drive (`sudo rclone copy ltbbackup:ltb-media/uploads /var/lib/ltb-media/uploads`), `sudo chown -R ltbmedia: /var/lib/ltb-media`, rồi `sudo systemctl start ltb-media`.

## Cấu trúc

```
server.js            API + phục vụ trang
config.js            giới hạn upload, cổng, mật khẩu
lib/db.js            lưu dữ liệu JSON
lib/image-size.js    đọc kích thước ảnh (không cần thư viện ngoài)
lib/audio-info.js    đọc thông số âm thanh (kHz / bit / kbps)
deploy/              script cài đặt, cập nhật, sao lưu trên máy chủ Ubuntu
public/              giao diện (HTML/CSS/JS thuần, không cần build)
```
