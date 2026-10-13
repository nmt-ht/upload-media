// Lưu dữ liệu vào data/db.json — đủ cho kho vài nghìn file, không cần cài database.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

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
};

fs.mkdirSync(DATA_DIR, { recursive: true });

let state;
try {
  state = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  state.settings = { ...DEFAULTS.settings, ...state.settings };
  state.media = state.media || [];
} catch {
  state = structuredClone(DEFAULTS);
}

let writing = Promise.resolve();
function save() {
  const snapshot = JSON.stringify(state, null, 2);
  writing = writing.then(async () => {
    const tmp = DB_FILE + '.tmp';
    await fs.promises.writeFile(tmp, snapshot);
    await fs.promises.rename(tmp, DB_FILE);
  });
  return writing;
}

module.exports = {
  get settings() { return state.settings; },
  get media() { return state.media; },
  updateSettings(patch) {
    for (const key of Object.keys(DEFAULTS.settings)) {
      if (typeof patch[key] === 'string') state.settings[key] = patch[key].trim();
    }
    return save();
  },
  addMedia(item) { state.media.push(item); return save(); },
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
