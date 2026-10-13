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
| Ảnh | JPG, PNG, WebP | đúng 1920×1080 px | 360 KB |
| Âm thanh | MP3, WAV, M4A, OGG, FLAC | 10–15 giây | 300 MB |

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
| Ảnh 1920×1080 | tối đa 360 KB | ~2.900 |
| Âm thanh MP3 10–15 giây | ~0,2–0,6 MB | ~1.700–5.000 |
| Âm thanh WAV 10–15 giây | ~1,7–2,6 MB | ~400–600 |

Trang kho ảnh / âm thanh hiện tải toàn bộ danh sách một lần, chạy mượt tới khoảng vài nghìn file mỗi loại; nhiều hơn nên thêm phân trang.

## Demo miễn phí trên Render.com

File `render.yaml` đã cấu hình sẵn (gói Free, mật khẩu admin do Render tự sinh).

1. Đẩy thư mục này lên một repo GitHub (nên để Private).
2. Vào https://dashboard.render.com → **New → Blueprint** → chọn repo → **Apply**.
3. Xem mật khẩu admin: service `ltb-media` → **Environment** → `ADMIN_PASSWORD`.

⚠ Lưu ý gói Free: server ngủ sau 15 phút không có truy cập (lần mở đầu chờ ~1 phút); ổ đĩa bị xoá mỗi lần khởi động lại nên **nội dung tải lên thêm sẽ mất**, website quay về dữ liệu demo trong `demo/`. Khi chạy thật, dùng VPS bên dưới hoặc gói Render trả phí có Persistent Disk (các bước có sẵn ở cuối `render.yaml`: `plan: starter`, `disk` gắn ở `/var/data`, `STORAGE_DIR=/var/data`, `DEMO_SEED=false`).

## Đưa lên máy chủ (VPS)

1. Copy thư mục lên server, chạy `npm install --omit=dev`.
2. Tạo `.env` với `ADMIN_PASSWORD` mạnh và `DEMO_SEED=false` (không nạp dữ liệu demo vào web thật). Nếu muốn để dữ liệu ngoài thư mục code (dễ cập nhật code, dễ sao lưu), thêm `STORAGE_DIR=/var/lib/ltb-media`.
3. Chạy nền bằng pm2: `pm2 start npm --name ltb-media -- start`.
4. Đặt Nginx phía trước + HTTPS (Let's Encrypt). **Nhớ tăng giới hạn upload** vì audio cho phép tới 300 MB:

```nginx
server {
    server_name ltbmedia.vn;
    client_max_body_size 310m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_request_buffering off;
    }
}
```

## Cấu trúc

```
server.js            API + phục vụ trang
config.js            giới hạn upload, cổng, mật khẩu
lib/db.js            lưu dữ liệu JSON
lib/image-size.js    đọc kích thước ảnh (không cần thư viện ngoài)
public/              giao diện (HTML/CSS/JS thuần, không cần build)
```
