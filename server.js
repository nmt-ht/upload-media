const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const config = require('./config');
require('./lib/seed-demo'); // phải chạy trước khi lib/db đọc dữ liệu
const db = require('./lib/db');
const imageSize = require('./lib/image-size');
const audioInfo = require('./lib/audio-info');

const app = express();
const ROOT = __dirname;
// .tmp nằm cùng ổ đĩa với uploads để rename() không lỗi khi STORAGE_DIR là ổ gắn ngoài.
const UPLOAD_DIR = path.join(config.storageDir, 'uploads');
const TMP_DIR = path.join(config.storageDir, '.tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });
for (const dir of ['images', 'audio']) fs.mkdirSync(path.join(UPLOAD_DIR, dir), { recursive: true });

app.disable('x-powered-by');
app.use(express.json({ limit: '512kb' })); // đủ cho nội dung trang chính sách dài

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

// ---------- Đường dẫn riêng cho từng ảnh / âm thanh: /images/ten-anh-<id>, /audio/ten-audio-<id> ----------
const LIST_PATH = { image: '/images', audio: '/audio' };
function slugify(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
}
function itemPath(m) {
  const slug = slugify(m.title);
  return `${LIST_PATH[m.type]}/${slug ? slug + '-' : ''}${m.id}`;
}

// ---------- Public API ----------
function publicItem(m) {
  const { uploadedAt, originalName, ...rest } = m;
  return { ...COPYRIGHT_DEFAULTS, ...rest, path: itemPath(m) };
}
function sorted(list) {
  return [...list].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt) || b.uploadedAt.localeCompare(a.uploadedAt));
}

app.get('/api/settings', (req, res) => res.json(db.settings));
// Danh sách chính sách: chỉ slug + tiêu đề (dùng cho hàng link ngoài trang chủ).
app.get('/api/policies', (req, res) =>
  res.json(Object.entries(db.policies).map(([slug, p]) => ({ slug, title: p.title }))));
app.get('/api/policies/:slug', (req, res) => {
  const p = Object.hasOwn(db.policies, req.params.slug) && db.policies[req.params.slug];
  if (!p) return res.status(404).json({ error: 'Không tìm thấy' });
  res.json({ slug: req.params.slug, ...p });
});
app.get('/api/limits', (req, res) => res.json({ image: config.image, audio: config.audio }));
app.get('/api/media', (req, res) => {
  const { type } = req.query;
  const list = db.media.filter((m) => !type || m.type === type);
  res.json(sorted(list).map(publicItem));
});

// ---------- Admin API ----------
app.get('/api/admin/media', requireAdmin, (req, res) =>
  res.json(sorted(db.media).map((m) => ({ ...COPYRIGHT_DEFAULTS, ...m, path: itemPath(m) }))));

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
    limits: { fileSize: rules.maxBytes, files: 1, fields: 20 },
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
// Thông tin bản quyền của từng mục (admin tự nhập). Trả về { patch } hoặc { error }.
// Ảnh dùng owner; âm thanh dùng workTitle, composer, performer, recordingOwner, audioSpec.
// protectionDate: ảnh hiện là "Protection Date", âm thanh hiện là "Date Recorded".
const COPYRIGHT_TEXT = ['owner', 'provider', 'evidenceId', 'workTitle', 'composer', 'performer', 'recordingOwner', 'audioSpec'];
const VERIFICATION = ['pending', 'verified'];
function copyrightPatch(body) {
  const patch = {};
  for (const k of COPYRIGHT_TEXT) if (typeof body[k] === 'string') patch[k] = body[k].trim().slice(0, 200);
  if (body.protectionDate !== undefined) {
    if (body.protectionDate !== '' && !validDate(body.protectionDate)) return { error: 'Protection Date không hợp lệ' };
    patch.protectionDate = body.protectionDate;
  }
  if (body.verification !== undefined) {
    if (!VERIFICATION.includes(body.verification)) return { error: 'Verification Status không hợp lệ' };
    patch.verification = body.verification;
  }
  // multipart gửi chuỗi 'true'/'false', JSON gửi boolean
  for (const k of ['protected', 'active']) if (body[k] !== undefined) patch[k] = body[k] === true || body[k] === 'true';
  return { patch };
}
const COPYRIGHT_DEFAULTS = {
  owner: '', provider: 'LTB Media Network', protectionDate: '', evidenceId: '',
  verification: 'pending', protected: true, active: true,
  workTitle: '', composer: '', performer: '', recordingOwner: '', audioSpec: '',
};

function today() {
  return new Date().toISOString().slice(0, 10);
}
function fmtBytes(n) {
  return n >= 1024 * 1024 ? `${+(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
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
      const copyright = copyrightPatch(req.body);
      if (copyright.error) return fail(400, copyright.error);

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
        ...COPYRIGHT_DEFAULTS,
        ...copyright.patch,
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
        // Thông số tự đọc từ file; admin nhập tay thì giữ giá trị admin.
        if (!item.audioSpec) item.audioSpec = audioInfo(tmp);
        if (!item.workTitle) item.workTitle = item.title;
      }

      const folder = kind === 'image' ? 'images' : 'audio';
      const filename = item.id + (EXT[item.mime] || path.extname(req.file.originalname));
      const dest = path.join(UPLOAD_DIR, folder, filename);
      try {
        await fs.promises.rename(tmp, dest);
      } catch (e) {
        console.error('Lưu file thất bại:', e);
        return fail(500, 'Không lưu được file, vui lòng thử lại');
      }
      item.url = `/uploads/${folder}/${filename}`;
      try {
        await db.addMedia(item);
      } catch (e) {
        // Mục đã nằm trong bộ nhớ và sẽ được ghi ở lần lưu kế tiếp — giữ nguyên file.
        console.error('Ghi db.json thất bại:', e);
        return res.status(500).json({ error: 'Đã nhận file nhưng chưa ghi được dữ liệu, vui lòng kiểm tra ổ đĩa máy chủ' });
      }
      res.status(201).json({ ...item, path: itemPath(item) });
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
  const copyright = copyrightPatch(req.body || {});
  if (copyright.error) return res.status(400).json({ error: copyright.error });
  Object.assign(patch, copyright.patch);
  const item = await db.updateMedia(req.params.id, patch);
  if (!item) return res.status(404).json({ error: 'Không tìm thấy' });
  res.json({ ...item, path: itemPath(item) });
});

app.delete('/api/admin/media/:id', requireAdmin, async (req, res) => {
  const item = await db.removeMedia(req.params.id);
  if (!item) return res.status(404).json({ error: 'Không tìm thấy' });
  fs.rm(path.join(config.storageDir, item.url), { force: true }, () => {});
  res.json({ ok: true });
});

app.get('/api/admin/policies', requireAdmin, (req, res) =>
  res.json(Object.entries(db.policies).map(([slug, p]) => ({ slug, ...p }))));
app.put('/api/admin/policies/:slug', requireAdmin, async (req, res) => {
  if (!Object.hasOwn(db.policies, req.params.slug)) return res.status(404).json({ error: 'Không tìm thấy' });
  const body = req.body || {};
  for (const [k, label] of [['effectiveDate', 'Effective Date'], ['updatedAt', 'Last Updated']]) {
    if (body[k] !== undefined && body[k] !== '' && !validDate(body[k])) return res.status(400).json({ error: label + ' không hợp lệ' });
  }
  res.json(await db.updatePolicy(req.params.slug, body));
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
app.get('/policy/:slug', (req, res) => res.sendFile(path.join(ROOT, 'public', 'policy.html')));

// Trang chi tiết: trả về trang kho tương ứng (media.js tự mở khung chi tiết theo URL), kèm thẻ
// title / Open Graph của đúng file để link chia sẻ qua Zalo, Facebook… hiện tên và ảnh xem trước.
const escAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
for (const [type, page] of [['image', 'images.html'], ['audio', 'audio.html']]) {
  app.get(`${LIST_PATH[type]}/:key`, async (req, res, next) => {
    const id = (req.params.key.match(/(?:^|-)([0-9a-f]{16})$/) || [])[1];
    const item = id && db.media.find((m) => m.id === id && m.type === type);
    if (!item) return next();
    const canonical = itemPath(item);
    // Tiêu đề đã đổi → về link mới. 302 (không phải 301) vì trình duyệt nhớ 301 vĩnh viễn,
    // đổi tiêu đề qua lại sẽ thành vòng lặp redirect.
    if (req.path !== canonical) return res.redirect(302, canonical);

    const origin = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;
    const title = `${item.title} — LTB Media Network`;
    const desc = item.description || (type === 'image' ? 'Hình ảnh có bản quyền — LTB Media Network' : 'Âm thanh có bản quyền — LTB Media Network');
    const meta = [
      `<link rel="canonical" href="${escAttr(origin + canonical)}">`,
      `<meta name="description" content="${escAttr(desc)}">`,
      `<meta property="og:type" content="${type === 'image' ? 'article' : 'music.song'}">`,
      `<meta property="og:title" content="${escAttr(title)}">`,
      `<meta property="og:description" content="${escAttr(desc)}">`,
      `<meta property="og:url" content="${escAttr(origin + canonical)}">`,
      `<meta property="og:image" content="${escAttr(origin + (type === 'image' ? item.url : '/img/logo.png'))}">`,
      type === 'audio' ? `<meta property="og:audio" content="${escAttr(origin + item.url)}">` : '',
    ].filter(Boolean).join('\n  ');
    try {
      const html = await fs.promises.readFile(path.join(ROOT, 'public', page), 'utf8');
      // Giữ tiêu đề gốc của trang kho để media.js trả lại khi đóng khung chi tiết.
      const pageTitle = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
      res.type('html').send(html
        .replace(/<title>[^<]*<\/title>/, `<title>${escAttr(title)}</title>\n  <meta name="ltb-page-title" content="${pageTitle}">`)
        .replace('</head>', `  ${meta}\n</head>`));
    } catch (e) {
      next(e);
    }
  });
}
app.use((req, res) => res.status(404).sendFile(path.join(ROOT, 'public', 'index.html')));

const server = app.listen(config.port, () => {
  console.log(`LTB Media Network đang chạy: http://localhost:${config.port}`);
  if (config.adminPassword === 'changeme') {
    console.warn('⚠  Đang dùng mật khẩu admin mặc định. Đặt biến môi trường ADMIN_PASSWORD trước khi đưa lên mạng.');
  }
});
// Mặc định Node huỷ request quá 5 phút — không đủ cho audio tới 1000 MB qua mạng chậm.
// Phải khớp với client_body_timeout / proxy_*_timeout của Nginx (deploy/setup.sh).
server.requestTimeout = 2 * 3600 * 1000;
