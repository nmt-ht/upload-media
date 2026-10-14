// Sao lưu & khôi phục dữ liệu ngay trên máy chủ (không cần lệnh SSH):
//  - backups/db-<thời điểm UTC>-<lý do>.json.gz: bản chụp db.json (danh sách nội dung, cài đặt, chính sách).
//    Tạo tự động mỗi ngày, trước khi xoá nội dung, trước khi khôi phục, hoặc khi admin bấm "Sao lưu ngay".
//  - trash/: ảnh/âm thanh bị xoá trên trang quản trị được chuyển vào đây thay vì xoá hẳn, giữ KEEP_DAYS ngày.
//    File ảnh/âm thanh không bao giờ bị sửa sau khi tải lên, nên bản chụp db.json + uploads/ + trash/
//    đủ để khôi phục về bất kỳ bản sao lưu nào trong KEEP_DAYS ngày mà không phải chép trùng file.
// Mất cả máy chủ: dùng bản ngoài máy chủ (Google Drive qua deploy/backup.sh, hoặc file .tar tải về
// từ trang quản trị) và deploy/restore.sh.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { storageDir } = require('../config');

const BACKUP_DIR = path.join(storageDir, 'backups');
const TRASH_DIR = path.join(storageDir, 'trash');
const UPLOAD_DIR = path.join(storageDir, 'uploads');
const KEEP_DAYS = 30;
const KEEP_MIN = 10; // luôn giữ ít nhất 10 bản mới nhất dù đã quá hạn
const DAY = 24 * 3600 * 1000;
const NAME_RE = /^db-(\d{8}T\d{6}Z)-([a-z-]+)\.json\.gz$/;
const REASONS = ['daily', 'manual', 'before-delete', 'before-restore', 'upload', 'server', 'imported'];

for (const d of [BACKUP_DIR, path.join(TRASH_DIR, 'images'), path.join(TRASH_DIR, 'audio')]) fs.mkdirSync(d, { recursive: true });

const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'); // 20261014T023000Z
const parseStamp = (s) => new Date(s.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'));

// Kiểm tra cấu trúc trước khi cho phép khôi phục — tránh nạp nhầm file JSON khác làm hỏng dữ liệu.
function validate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'Không phải file sao lưu của website';
  if (!Array.isArray(data.media) || typeof data.settings !== 'object' || !data.settings) return 'Thiếu danh sách nội dung hoặc cài đặt';
  for (const m of data.media) {
    if (!m || typeof m.id !== 'string' || !['image', 'audio'].includes(m.type)
      || typeof m.url !== 'string' || !/^\/uploads\/(images|audio)\/[\w.-]+$/.test(m.url)) {
      return 'Danh sách nội dung không hợp lệ';
    }
  }
  return null;
}

// Đọc nội dung file sao lưu (.json hoặc .json.gz). Trả về { data } hoặc { error }.
function parse(buf) {
  try {
    const text = (buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf).toString('utf8');
    const data = JSON.parse(text);
    const error = validate(data);
    return error ? { error } : { data };
  } catch {
    return { error: 'File hỏng hoặc không đúng định dạng (.json / .json.gz)' };
  }
}

const countCache = new Map(); // tên file → { images, audio } (file sao lưu không bao giờ bị sửa)
function counts(name) {
  if (!countCache.has(name)) {
    const { data } = parse(fs.readFileSync(path.join(BACKUP_DIR, name)));
    countCache.set(name, data
      ? { images: data.media.filter((m) => m.type === 'image').length, audio: data.media.filter((m) => m.type === 'audio').length }
      : null);
  }
  return countCache.get(name);
}

function list() {
  return fs.readdirSync(BACKUP_DIR)
    .map((name) => {
      const m = name.match(NAME_RE);
      if (!m) return null;
      return { name, reason: m[2], createdAt: parseStamp(m[1]).toISOString(), size: fs.statSync(path.join(BACKUP_DIR, name)).size };
    })
    .filter(Boolean)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((b) => ({ ...b, ...(counts(b.name) || { invalid: true }) }));
}

function prune() {
  const now = Date.now();
  list().forEach((b, i) => {
    if (i >= KEEP_MIN && now - Date.parse(b.createdAt) > KEEP_DAYS * DAY) {
      fs.rmSync(path.join(BACKUP_DIR, b.name), { force: true });
      countCache.delete(b.name);
    }
  });
}

async function create(reason, json) {
  if (!REASONS.includes(reason)) throw new Error('reason?');
  let t = Date.now();
  let name;
  do { name = `db-${stamp(new Date(t))}-${reason}.json.gz`; t += 1000; } // trùng giây thì lùi 1 giây
  while (fs.existsSync(path.join(BACKUP_DIR, name)));
  const file = path.join(BACKUP_DIR, name);
  await fs.promises.writeFile(file + '.tmp', zlib.gzipSync(json));
  await fs.promises.rename(file + '.tmp', file);
  prune();
  return name;
}

function filePath(name) {
  if (!NAME_RE.test(name)) return null; // chặn đường dẫn kiểu ../
  const file = path.join(BACKUP_DIR, name);
  return fs.existsSync(file) ? file : null;
}

function read(name) {
  const file = filePath(name);
  return file ? parse(fs.readFileSync(file)) : { error: 'Không tìm thấy bản sao lưu' };
}

const lastOf = (reason) => list().find((b) => !reason || b.reason === reason);

// Trước khi xoá: đã có bản chụp dữ liệu hiện tại (≤ 10 phút) chứa mục này chưa? Có thì khỏi tạo thêm —
// xoá liền nhiều mục không đẻ ra hàng loạt bản sao lưu.
const idsCache = new Map();
function hasRecentWith(id) {
  const last = list().find((b) => !['upload', 'imported'].includes(b.reason));
  if (!last || Date.now() - Date.parse(last.createdAt) > 10 * 60 * 1000) return false;
  if (!idsCache.has(last.name)) idsCache.set(last.name, new Set((read(last.name).data?.media || []).map((m) => m.id)));
  return idsCache.get(last.name).has(id);
}

// ---------- Thùng rác ----------
const uploadFile = (url) => path.join(storageDir, url);                         // /uploads/images/x.png
const trashFile = (url) => path.join(TRASH_DIR, url.replace(/^\/uploads\//, '')); // trash/images/x.png

async function moveToTrash(url) {
  const dest = trashFile(url);
  try {
    await fs.promises.rename(uploadFile(url), dest);
    const now = new Date();
    await fs.promises.utimes(dest, now, now); // rename giữ ngày cũ của file — đặt lại để tính hạn 30 ngày
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

// Sau khi khôi phục: lấy lại từ thùng rác các file mà bản sao lưu cần. Trả về số file lấy lại + mục còn thiếu.
async function recoverFiles(media) {
  let recovered = 0;
  const missing = [];
  for (const m of media) {
    if (fs.existsSync(uploadFile(m.url))) continue;
    try {
      await fs.promises.rename(trashFile(m.url), uploadFile(m.url));
      recovered++;
    } catch {
      missing.push({ type: m.type, no: m.no, title: m.title });
    }
  }
  return { recovered, missing };
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [fs.statSync(path.join(dir, e.name))]);
}
function dirStats(dir) {
  const files = fs.existsSync(dir) ? walk(dir) : [];
  return { files: files.length, bytes: files.reduce((s, f) => s + f.size, 0) };
}

function purgeTrash() {
  const now = Date.now();
  for (const sub of ['images', 'audio']) {
    const dir = path.join(TRASH_DIR, sub);
    for (const name of fs.readdirSync(dir)) {
      const f = path.join(dir, name);
      if (now - fs.statSync(f).mtimeMs > KEEP_DAYS * DAY) fs.rmSync(f, { force: true });
    }
  }
}

// Trạng thái sao lưu ra ngoài máy chủ, do deploy/backup.sh ghi sau mỗi lần chạy.
function offsite() {
  try {
    return JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, 'offsite-status.json'), 'utf8'));
  } catch {
    return null;
  }
}

// Mỗi giờ kiểm tra: chưa có bản sao lưu tự động trong 24 giờ qua thì tạo; dọn thùng rác quá hạn.
function startDaily(getJSON) {
  const tick = async () => {
    try {
      const last = lastOf('daily');
      if (!last || Date.now() - Date.parse(last.createdAt) > DAY - 3600 * 1000) {
        console.log('Sao lưu tự động:', await create('daily', getJSON()));
      }
      purgeTrash();
    } catch (e) {
      console.error('Sao lưu tự động thất bại:', e);
    }
  };
  setTimeout(tick, 10 * 1000).unref();
  setInterval(tick, 3600 * 1000).unref();
}

module.exports = {
  KEEP_DAYS, BACKUP_DIR, UPLOAD_DIR, TRASH_DIR,
  list, create, read, parse, filePath, lastOf, hasRecentWith, moveToTrash, recoverFiles, dirStats, offsite, startDaily,
};
