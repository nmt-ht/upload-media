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

- `data/db.json` — danh sách nội dung + cài đặt liên hệ
- `uploads/images`, `uploads/audio` — file đã tải lên

Sao lưu 2 thư mục này là đủ. Xoá cả hai để làm trống website (dữ liệu demo hiện tại chỉ là ảnh gradient và âm thanh test).

## Đưa lên máy chủ (VPS)

1. Copy thư mục lên server, chạy `npm install --omit=dev`.
2. Tạo `.env` với `ADMIN_PASSWORD` mạnh.
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
