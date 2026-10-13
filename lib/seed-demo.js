// Lần chạy đầu (chưa có data/db.json): nạp dữ liệu demo từ thư mục demo/.
// Cần cho host miễn phí như Render vì ổ đĩa bị xoá sạch mỗi lần khởi động lại.
// Tắt bằng biến môi trường DEMO_SEED=false.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEMO = path.join(ROOT, 'demo');
const DB_FILE = path.join(ROOT, 'data', 'db.json');

if (process.env.DEMO_SEED !== 'false' && !fs.existsSync(DB_FILE) && fs.existsSync(path.join(DEMO, 'db.json'))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.copyFileSync(path.join(DEMO, 'db.json'), DB_FILE);
  fs.cpSync(path.join(DEMO, 'uploads'), path.join(ROOT, 'uploads'), { recursive: true });
  console.log('Đã nạp dữ liệu demo.');
}
