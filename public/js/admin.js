(function () {
  const { icon, esc, fmtDate, fmtDuration, fmtBytes, toast } = LTB;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  $$('[data-icon]').forEach((el) => { el.outerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 18); });

  async function api(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !url.endsWith('/login')) { showLogin(); throw new Error('Phiên đăng nhập đã hết hạn'); }
    if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra');
    return data;
  }

  // ---------- Đăng nhập ----------
  function showLogin() { $('#view-login').hidden = false; $('#view-admin').hidden = true; }
  function showAdmin() { $('#view-login').hidden = true; $('#view-admin').hidden = false; loadItems(); loadSettings(); }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: e.target.password.value }) });
      e.target.reset();
      showAdmin();
    } catch (err) { toast(err.message, true); }
  });
  $('#logout').addEventListener('click', async () => { await api('/api/admin/logout', { method: 'POST' }); showLogin(); });

  // ---------- Tabs ----------
  $('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    $$('.tabs [data-tab]').forEach((t) => t.setAttribute('aria-selected', t === b));
    $$('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== b.dataset.tab; });
    if (b.dataset.tab === 'manage') loadItems();
  });

  // ---------- Tải lên ----------
  let limits = null;
  let kind = 'image';
  let picked = null; // { file, ok, duration }
  const form = $('#upload-form');
  const fileInput = $('#file');
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  function sameDayInYear(y) {
    const [, m, d] = today().split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
  }
  function renderQuickDates() {
    const y = Number(today().slice(0, 4));
    const opts = [['Hôm nay', today()], ...[1, 2, 3, 4, 5].map((n) => [String(y - n), sameDayInYear(y - n)])];
    $('#quick-dates').innerHTML = opts.map(([label, v]) => `<button type="button" class="chip" data-date="${v}">${label}</button>`).join('');
  }
  $('#quick-dates').addEventListener('click', (e) => {
    const c = e.target.closest('[data-date]');
    if (c) { form.publishedAt.value = c.dataset.date; showDatePreview(); }
  });
  function showDatePreview() {
    const v = form.publishedAt.value;
    $('#date-preview').textContent = v ? 'Khách sẽ thấy: ' + fmtDate(v) : '';
  }
  form.publishedAt.addEventListener('input', showDatePreview);

  function ruleText() {
    if (!limits) return '';
    if (kind === 'image') {
      const l = limits.image;
      return `JPG / PNG / WebP · đúng ${l.width}×${l.height}px · tối đa ${fmtBytes(l.maxBytes)}`;
    }
    const l = limits.audio;
    return `MP3 / WAV / M4A / OGG / FLAC · dài ${l.minDuration}–${l.maxDuration} giây · tối đa ${fmtBytes(l.maxBytes)}`;
  }
  function setKind(k) {
    kind = k;
    $$('#kind [data-kind]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.kind === k));
    fileInput.accept = k === 'image' ? 'image/jpeg,image/png,image/webp' : 'audio/*';
    $('#rule').textContent = ruleText();
    clearPicked();
  }
  $('#kind').addEventListener('click', (e) => { const b = e.target.closest('[data-kind]'); if (b) setKind(b.dataset.kind); });

  function clearPicked() {
    picked = null;
    fileInput.value = '';
    $('#preview').hidden = true;
    $('#preview').innerHTML = '';
    $('#submit').disabled = true;
  }

  const check = (ok, text) => `<li class="${ok ? 'ok' : 'bad'}">${icon(ok ? 'check' : 'alert', 16, 2.5)} <span>${text}</span></li>`;

  async function inspect(file) {
    const url = URL.createObjectURL(file);
    const checks = [];
    let ok = true;
    let duration;
    const add = (cond, text) => { checks.push(check(cond, text)); ok = ok && cond; };

    if (kind === 'image') {
      const l = limits.image;
      add(l.mimes.includes(file.type), `Định dạng: ${file.type || 'không rõ'}`);
      add(file.size <= l.maxBytes, `Dung lượng: ${fmtBytes(file.size)} (tối đa ${fmtBytes(l.maxBytes)})`);
      const dim = await new Promise((res) => {
        const img = new Image();
        img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => res(null);
        img.src = url;
      });
      add(dim && dim.w === l.width && dim.h === l.height, `Kích thước: ${dim ? `${dim.w}×${dim.h}` : 'không đọc được'} (yêu cầu ${l.width}×${l.height})`);
      $('#preview').innerHTML = `<img src="${url}" alt=""><ul class="checks">${checks.join('')}</ul>`;
    } else {
      const l = limits.audio;
      add(l.mimes.includes(file.type), `Định dạng: ${file.type || 'không rõ'}`);
      add(file.size <= l.maxBytes, `Dung lượng: ${fmtBytes(file.size)} (tối đa ${fmtBytes(l.maxBytes)})`);
      duration = await new Promise((res) => {
        const a = new Audio();
        a.preload = 'metadata';
        a.onloadedmetadata = () => res(a.duration);
        a.onerror = () => res(NaN);
        a.src = url;
      });
      const durOk = duration >= l.minDuration - 0.25 && duration <= l.maxDuration + 0.25;
      add(durOk, `Thời lượng: ${Number.isFinite(duration) ? duration.toFixed(1) + 's' : 'không đọc được'} (yêu cầu ${l.minDuration}–${l.maxDuration}s)`);
      $('#preview').innerHTML = `<audio controls src="${url}"></audio><ul class="checks">${checks.join('')}</ul>`;
    }
    $('#preview').hidden = false;
    picked = { file, ok, duration };
    $('#submit').disabled = !ok;
    if (!form.title.value) form.title.value = file.name.replace(/\.[^.]+$/, '');
  }

  fileInput.addEventListener('change', () => fileInput.files[0] && inspect(fileInput.files[0]));
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) inspect(f); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!picked?.ok) return;
    const fd = new FormData();
    fd.append('title', form.title.value);
    fd.append('description', form.description.value);
    fd.append('publishedAt', form.publishedAt.value);
    if (picked.duration) fd.append('duration', picked.duration);
    fd.append('file', picked.file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/admin/media/${kind}`);
    const bar = $('#progress .bar i');
    $('#progress').hidden = false;
    $('#submit').disabled = true;
    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      const pct = Math.round((ev.loaded / ev.total) * 100);
      bar.style.width = pct + '%';
      $('#progress-text').textContent = `Đang tải lên ${pct}% · ${fmtBytes(ev.loaded)} / ${fmtBytes(ev.total)}`;
    };
    xhr.onload = () => {
      $('#progress').hidden = true;
      bar.style.width = '0';
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status === 401) { showLogin(); return; }
      if (xhr.status >= 300) { toast(data.error || 'Tải lên thất bại', true); $('#submit').disabled = false; return; }
      toast(`Đã đăng "${data.title}" — ngày hiển thị ${fmtDate(data.publishedAt)}`);
      form.title.value = '';
      form.description.value = '';
      clearPicked();
    };
    xhr.onerror = () => { $('#progress').hidden = true; $('#submit').disabled = false; toast('Mất kết nối khi tải lên', true); };
    xhr.send(fd);
  });

  // ---------- Quản lý ----------
  let items = [];
  let filter = '';
  async function loadItems() {
    try { items = await api('/api/admin/media'); drawItems(); } catch (err) { toast(err.message, true); }
  }
  function drawItems() {
    const list = items.filter((m) => !filter || m.type === filter);
    const el = $('#items');
    if (!list.length) { el.innerHTML = '<div class="empty">Chưa có nội dung.</div>'; return; }
    el.innerHTML = list.map((m) => `
      <div class="item" data-id="${m.id}">
        <div class="thumb">${m.type === 'image' ? `<img src="${esc(m.url)}" alt="" loading="lazy">` : icon('audio', 28)}</div>
        <div class="fields">
          <div class="line">
            <input class="input" type="text" name="title" value="${esc(m.title)}" aria-label="Tiêu đề">
            <input class="input" type="date" name="publishedAt" value="${m.publishedAt}" aria-label="Ngày đăng công khai">
          </div>
          <div class="line" style="justify-content:space-between">
            <span class="real">${m.type === 'image' ? `${m.width}×${m.height}` : fmtDuration(m.duration)} · ${fmtBytes(m.size)} · Tải lên thật: ${new Date(m.uploadedAt).toLocaleString('vi-VN')}</span>
            <span style="display:flex;gap:6px">
              <button class="btn btn-ghost btn-sm" data-save>Lưu</button>
              <button class="btn btn-danger btn-sm" data-del aria-label="Xoá">${icon('trash', 16)}</button>
            </span>
          </div>
        </div>
      </div>`).join('');
  }
  $('#manage-filter').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    filter = c.dataset.f;
    $$('#manage-filter .chip').forEach((b) => b.setAttribute('aria-pressed', b === c));
    drawItems();
  });
  $('#items').addEventListener('click', async (e) => {
    const row = e.target.closest('.item');
    if (!row) return;
    const id = row.dataset.id;
    try {
      if (e.target.closest('[data-save]')) {
        const updated = await api(`/api/admin/media/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ title: $('[name=title]', row).value, publishedAt: $('[name=publishedAt]', row).value }),
        });
        Object.assign(items.find((m) => m.id === id), updated);
        toast('Đã lưu');
      } else if (e.target.closest('[data-del]')) {
        const m = items.find((x) => x.id === id);
        if (!confirm(`Xoá vĩnh viễn "${m.title}"? File sẽ bị xoá khỏi máy chủ.`)) return;
        await api(`/api/admin/media/${id}`, { method: 'DELETE' });
        items = items.filter((x) => x.id !== id);
        drawItems();
        toast('Đã xoá');
      }
    } catch (err) { toast(err.message, true); }
  });

  // ---------- Cài đặt ----------
  const sform = $('#settings-form');
  async function loadSettings() {
    const s = await api('/api/settings');
    for (const [k, v] of Object.entries(s)) if (sform[k]) sform[k].value = v;
  }
  sform.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(sform));
    try { await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(body) }); toast('Đã lưu cài đặt'); }
    catch (err) { toast(err.message, true); }
  });

  // ---------- Khởi động ----------
  (async () => {
    limits = await api('/api/limits');
    renderQuickDates();
    form.publishedAt.value = today();
    showDatePreview();
    setKind('image');
    const { admin } = await api('/api/admin/me');
    admin ? showAdmin() : showLogin();
  })();
})();
