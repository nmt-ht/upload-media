const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const config = require('./config');
require('./lib/seed-demo'); // phải chạy trước khi lib/db đọc dữ liệu
const db = require('./lib/db');
const imageSize = require('./lib/image-size');

const app = express();
const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const TMP_DIR = path.join(ROOT, '.tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });
for (const dir of ['images', 'audio']) fs.mkdirSync(path.join(UPLOAD_DIR, dir), { recursive: true });

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// ---------- Auth (cookie ký HMAC, đổi mật khẩu = tự đăng xuất mọi phiên) ----------
const COOKIE = 'ltb_admin';
const SESSION_MS = 7 * 24 * 3600 * 1000;
const secret = crypto.createHash('sha256').update('ltb:' + config.adminPassword).digest();

function sign(exp) {
  return crypto.createHmac('sha256', secret).update(String(exp)).digest('hex');
}
function makeToken() {
  const exp = Date.now() + SESSION_MS;
  return `${exp}.${sign(exp)}`;
}
function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}
function isAdmin(req) {
  const token = readCookie(req, COOKIE);
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = Buffer.from(sign(exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  res.status(401).json({ error: 'Chưa đăng nhập' });
}
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

app.post('/api/admin/login', async (req, res) => {
  const ok = safeEqual(req.body?.password || '', config.adminPassword);
  if (!ok) {
    await new Promise((r) => setTimeout(r, 600));
    return res.status(401).json({ error: 'Sai mật khẩu' });
  }
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${makeToken()}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_MS / 1000}${secure}`);
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`);
  res.json({ ok: true });
});
app.get('/api/admin/me', (req, res) => res.json({ admin: isAdmin(req) }));

// ---------- Public API ----------
function publicItem(m) {
  const { uploadedAt, originalName, ...rest } = m;
  return rest;
}
function sorted(list) {
  return [...list].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt) || b.uploadedAt.localeCompare(a.uploadedAt));
}

app.get('/api/settings', (req, res) => res.json(db.settings));
app.get('/api/limits', (req, res) => res.json({ image: config.image, audio: config.audio }));
app.get('/api/media', (req, res) => {
  const { type } = req.query;
  const list = db.media.filter((m) => !type || m.type === type);
  res.json(sorted(list).map(publicItem));
});

// ---------- Admin API ----------
app.get('/api/admin/media', requireAdmin, (req, res) => res.json(sorted(db.media)));

const EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/wave': '.wav',
  'audio/ogg': '.ogg', 'audio/aac': '.aac', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a',
  'audio/flac': '.flac', 'audio/x-flac': '.flac', 'audio/webm': '.webm',
};

function uploader(kind) {
  const rules = config[kind];
  return multer({
    dest: TMP_DIR,
    limits: { fileSize: rules.maxBytes, files: 1, fields: 10 },
    fileFilter: (req, file, cb) => {
      if (rules.mimes.includes(file.mimetype)) return cb(null, true);
      const err = new Error(`Định dạng ${file.mimetype} không được hỗ trợ`);
      err.status = 415;
      cb(err);
    },
  }).single('file');
}

function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function fmtBytes(n) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(0)}MB` : `${Math.round(n / 1024)}KB`;
}

for (const kind of ['image', 'audio']) {
  const upload = uploader(kind);
  app.post(`/api/admin/media/${kind}`, requireAdmin, (req, res) => {
    upload(req, res, async (err) => {
      const tmp = req.file?.path;
      const fail = (status, error) => {
        if (tmp) fs.rm(tmp, { force: true }, () => {});
        res.status(status).json({ error });
      };
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return fail(413, `File vượt quá ${fmtBytes(config[kind].maxBytes)}`);
        return fail(err.status || 400, err.message);
      }
      if (!req.file) return fail(400, 'Chưa chọn file');

      const publishedAt = req.body.publishedAt || today();
      if (!validDate(publishedAt)) return fail(400, 'Ngày đăng không hợp lệ');

      const item = {
        id: crypto.randomBytes(8).toString('hex'),
        type: kind,
        title: (req.body.title || '').trim().slice(0, 200) || path.parse(req.file.originalname).name,
        description: (req.body.description || '').trim().slice(0, 1000),
        mime: req.file.mimetype,
        size: req.file.size,
        originalName: req.file.originalname,
        publishedAt,                       // ngày hiển thị công khai (tuỳ chọn)
        uploadedAt: new Date().toISOString(), // ngày tải lên thật — chỉ admin thấy
      };

      if (kind === 'image') {
        const dim = imageSize(tmp);
        if (!dim) return fail(400, 'Không đọc được kích thước ảnh');
        const { width, height } = config.image;
        if (dim.width !== width || dim.height !== height) {
          return fail(400, `Ảnh phải đúng ${width}×${height}px (file đang là ${dim.width}×${dim.height})`);
        }
        Object.assign(item, dim);
      } else {
        const duration = Number(req.body.duration);
        const { minDuration, maxDuration } = config.audio;
        if (!(duration > 0)) return fail(400, 'Không xác định được thời lượng audio');
        if (duration < minDuration - 0.25 || duration > maxDuration + 0.25) {
          return fail(400, `Audio phải dài ${minDuration}–${maxDuration}s (file đang ${duration.toFixed(1)}s)`);
        }
        item.duration = Math.round(duration * 10) / 10;
      }

      const folder = kind === 'image' ? 'images' : 'audio';
      const filename = item.id + (EXT[item.mime] || path.extname(req.file.originalname));
      await fs.promises.rename(tmp, path.join(UPLOAD_DIR, folder, filename));
      item.url = `/uploads/${folder}/${filename}`;
      await db.addMedia(item);
      res.status(201).json(item);
    });
  });
}

app.patch('/api/admin/media/:id', requireAdmin, async (req, res) => {
  const patch = {};
  const { title, description, publishedAt } = req.body || {};
  if (typeof title === 'string' && title.trim()) patch.title = title.trim().slice(0, 200);
  if (typeof description === 'string') patch.description = description.trim().slice(0, 1000);
  if (publishedAt !== undefined) {
    if (!validDate(publishedAt)) return res.status(400).json({ error: 'Ngày đăng không hợp lệ' });
    patch.publishedAt = publishedAt;
  }
  const item = await db.updateMedia(req.params.id, patch);
  if (!item) return res.status(404).json({ error: 'Không tìm thấy' });
  res.json(item);
});

app.delete('/api/admin/media/:id', requireAdmin, async (req, res) => {
  const item = await db.removeMedia(req.params.id);
  if (!item) return res.status(404).json({ error: 'Không tìm thấy' });
  fs.rm(path.join(ROOT, item.url), { force: true }, () => {});
  res.json({ ok: true });
});

app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  await db.updateSettings(req.body || {});
  res.json(db.settings);
});

// ---------- Static ----------
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '30d',
  immutable: true,
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
}));
app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));
app.use((req, res) => res.status(404).sendFile(path.join(ROOT, 'public', 'index.html')));

app.listen(config.port, () => {
  console.log(`LTB Media đang chạy: http://localhost:${config.port}`);
  if (config.adminPassword === 'changeme') {
    console.warn('⚠  Đang dùng mật khẩu admin mặc định. Đặt biến môi trường ADMIN_PASSWORD trước khi đưa lên mạng.');
  }
});
