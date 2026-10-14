// Lưu dữ liệu vào data/db.json — đủ cho kho vài nghìn file, không cần cài database.
const fs = require('fs');
const path = require('path');

const { storageDir } = require('../config');

const DATA_DIR = path.join(storageDir, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Dòng thông tin đầu mỗi trang chính sách (sửa được trong trang quản trị).
const POLICY_META = { effectiveDate: '2026-01-01', updatedAt: '', operatedBy: 'LTB Media' };

const DEFAULTS = {
  settings: {
    whatsapp: '',          // vd: 84901234567 hoặc link https://wa.me/...
    zalo: '',              // vd: 0901234567 hoặc link https://zalo.me/...
    telegram: '',          // vd: ltbmedia hoặc link https://t.me/...
    email: '',
    // Mục Liên hệ cuối trang chủ (ô trống sẽ không hiện)
    address: '',
    copyrightEmails: '',   // mỗi dòng một email
    website: '',
    workingHours: '',      // vd: Monday – Sunday | 8:00 AM – 9:00 PM (GMT+7)
    phone: '',
    facebook: '',          // link hoặc tên trang
    youtube: '',           // link hoặc @handle
    tiktok: '',            // link hoặc @handle
    monitoringUrl: '',     // link "Content Monitoring" — nhập sau
  },
  media: [],
  // Các trang chính sách (link dưới "Follow Us"), nội dung soạn ở trang quản trị → Chính sách.
  policies: {
    'copyright-notice': { title: 'Copyright & Digital Rights Notice', content: '', ...POLICY_META },
    terms: { title: 'Terms of Service', content: '', ...POLICY_META },
    privacy: { title: 'Privacy Policy', content: '', ...POLICY_META },
    'copyright-protection': { title: 'Copyright Protection Policy', content: '', ...POLICY_META },
    takedown: { title: 'Copyright Infringement & Takedown Policy', content: '', ...POLICY_META },
  },
};

fs.mkdirSync(DATA_DIR, { recursive: true });

let state;
if (fs.existsSync(DB_FILE)) {
  // File hỏng thì dừng hẳn thay vì khởi tạo rỗng — tránh ghi đè mất toàn bộ danh sách nội dung.
  try {
    state = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (err) {
    throw new Error(`Không đọc được ${DB_FILE} (${err.message}). Khôi phục từ bản sao lưu rồi khởi động lại.`);
  }
  state.settings = { ...DEFAULTS.settings, ...state.settings };
  state.media = state.media || [];
  // Giữ đúng thứ tự & danh sách trong DEFAULTS, lấy nội dung đã lưu nếu có.
  state.policies = Object.fromEntries(Object.entries(DEFAULTS.policies).map(([slug, def]) =>
    [slug, { ...def, ...state.policies?.[slug] }]));
} else {
  state = structuredClone(DEFAULTS);
}

let writing = Promise.resolve();
function save() {
  const snapshot = JSON.stringify(state, null, 2);
  // catch: một lần ghi lỗi không được chặn các lần ghi sau.
  writing = writing.catch(() => {}).then(async () => {
    const tmp = DB_FILE + '.tmp';
    await fs.promises.writeFile(tmp, snapshot);
    await fs.promises.rename(tmp, DB_FILE);
  });
  return writing;
}

// Số thứ tự cho đường dẫn /images/1, /audio/1 — đánh riêng từng loại, không cấp lại số của mục đã xoá
// (link cũ đã chia sẻ không được trỏ sang file khác). Dữ liệu cũ chưa có số: đánh theo thứ tự tải lên.
state.counters = { image: 0, audio: 0, ...state.counters };
let numbered = false;
for (const type of ['image', 'audio']) {
  const list = state.media.filter((m) => m.type === type);
  state.counters[type] = Math.max(state.counters[type], ...list.map((m) => m.no || 0));
  for (const m of list.filter((x) => !x.no).sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt))) {
    m.no = ++state.counters[type];
    numbered = true;
  }
}
if (numbered) save().catch((e) => console.error('Ghi số thứ tự vào db.json thất bại:', e));

module.exports = {
  get settings() { return state.settings; },
  get media() { return state.media; },
  updateSettings(patch) {
    for (const key of Object.keys(DEFAULTS.settings)) {
      if (typeof patch[key] === 'string') state.settings[key] = patch[key].trim();
    }
    return save();
  },
  get policies() { return state.policies; },
  // Ngày đã được server kiểm tra; không gửi updatedAt thì lấy ngày hôm nay.
  updatePolicy(slug, { title, content, effectiveDate, updatedAt, operatedBy }) {
    const p = state.policies[slug];
    if (!p) return null;
    if (typeof title === 'string' && title.trim()) p.title = title.trim().slice(0, 200);
    if (typeof content === 'string') p.content = content.slice(0, 100000);
    if (typeof operatedBy === 'string') p.operatedBy = operatedBy.trim().slice(0, 200);
    if (typeof effectiveDate === 'string') p.effectiveDate = effectiveDate;
    p.updatedAt = typeof updatedAt === 'string' ? updatedAt : new Date().toISOString().slice(0, 10);
    return save().then(() => p);
  },
  addMedia(item) {
    item.no = ++state.counters[item.type];
    state.media.push(item);
    return save();
  },
  updateMedia(id, patch) {
    const item = state.media.find((m) => m.id === id);
    if (!item) return null;
    Object.assign(item, patch);
    return save().then(() => item);
  },
  removeMedia(id) {
    const i = state.media.findIndex((m) => m.id === id);
    if (i === -1) return null;
    const [item] = state.media.splice(i, 1);
    return save().then(() => item);
  },
};
