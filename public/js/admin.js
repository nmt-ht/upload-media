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
  function showAdmin() { $('#view-login').hidden = true; $('#view-admin').hidden = false; loadItems(); loadSettings(); loadPolicies(); }

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

  // ---------- Thông tin bản quyền (khung Copyright Information ngoài trang) ----------
  const COPYRIGHT_KEYS = ['owner', 'provider', 'protectionDate', 'evidenceId', 'verification', 'protected', 'active',
    'workTitle', 'composer', 'performer', 'recordingOwner', 'audioSpec'];
  const NEW_COPYRIGHT = { provider: 'LTB Media Network' };

  function copyrightFieldsHTML(type, m = {}) {
    const v = (k) => esc(m[k] ?? '');
    const text = (name, label, ph = '') =>
      `<label class="field">${label}<input class="input" name="${name}" value="${v(name)}" placeholder="${esc(ph)}" maxlength="200"></label>`;
    const date = (label) =>
      `<label class="field">${label}<input class="input" type="date" name="protectionDate" value="${v('protectionDate')}"></label>`;
    const select = (name, label, opts, cur) => `<label class="field">${label}<select class="input" name="${name}">${
      opts.map(([val, t]) => `<option value="${val}"${String(cur) === val ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;
    const provider = text('provider', 'Protection Provider', 'LTB Media Network');
    const evidence = text('evidenceId', 'Evidence ID', type === 'image' ? 'LTB-IMG-2026-000001' : 'LTB-AUD-2026-000001');
    const verification = select('verification', 'Verification Status',
      [['pending', 'Pending Verification'], ['verified', 'Verified']], m.verification || 'pending');
    const prot = select('protected', 'Nhãn bảo hộ', [['true', 'Protected'], ['false', 'Not Protected']], m.protected ?? true);
    const fields = type === 'image' ? [
      text('owner', 'Author / Copyright Owner'), provider, date('Protection Date'), evidence, verification, prot,
      select('active', 'Trạng thái', [['true', 'Active'], ['false', 'Inactive']], m.active ?? true),
    ] : [
      text('workTitle', 'Work Title', 'Để trống = dùng tiêu đề'), text('composer', 'Composer / Author'),
      text('performer', 'Performing Artist'), text('recordingOwner', 'Sound Recording Owner'),
      provider, evidence, date('Date Recorded'),
      text('audioSpec', 'Thông số (vd 48 kHz / 24-bit)', 'Để trống = tự đọc từ file'),
      verification, prot,
    ];
    return `<div class="row2">${fields.join('')}</div>`;
  }
  function readCopyright(el) {
    const out = {};
    for (const k of COPYRIGHT_KEYS) { const f = $(`[name="${k}"]`, el); if (f) out[k] = f.value; }
    return out;
  }

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
    $('#upload-copyright').innerHTML = copyrightFieldsHTML(k, NEW_COPYRIGHT);
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
    for (const [k, v] of Object.entries(readCopyright($('#upload-copyright')))) fd.append(k, v);
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
      $('#upload-copyright').innerHTML = copyrightFieldsHTML(kind, NEW_COPYRIGHT);
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
              <a class="btn btn-ghost btn-sm" href="${esc(m.path)}" target="_blank" rel="noopener" title="Mở trang riêng của file này">${icon('link', 16)} #${m.no}</a>
              <button class="btn btn-ghost btn-sm" data-save>Lưu</button>
              <button class="btn btn-danger btn-sm" data-del aria-label="Xoá">${icon('trash', 16)}</button>
            </span>
          </div>
          <details class="cr-edit"><summary>Thông tin bản quyền</summary>${copyrightFieldsHTML(m.type, m)}</details>
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
          body: JSON.stringify({ title: $('[name=title]', row).value, publishedAt: $('[name=publishedAt]', row).value, ...readCopyright(row) }),
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

  // ---------- Chính sách ----------
  const policyStatus = (p) => (p.content.trim() ? `Cập nhật ${fmtDate(p.updatedAt)}` : 'Chưa có nội dung');
  async function loadPolicies() {
    try {
      const list = await api('/api/admin/policies');
      $('#policy-editors').innerHTML = list.map((p) => `
        <details class="policy-editor" data-slug="${esc(p.slug)}">
          <summary><span>${esc(p.title)}</span><small>${policyStatus(p)}</small></summary>
          <form>
            <label class="field">Tiêu đề <input class="input" name="title" value="${esc(p.title)}" maxlength="200" required></label>
            <div class="row3">
              <label class="field">Effective Date <input class="input" type="date" name="effectiveDate" value="${esc(p.effectiveDate)}"></label>
              <label class="field">Last Updated <input class="input" type="date" name="updatedAt" value="${esc(p.updatedAt)}"
                data-saved="${esc(p.updatedAt)}" title="Tự đổi thành hôm nay khi sửa nội dung, trừ khi bạn chọn ngày khác"></label>
              <label class="field">Operated by <input class="input" name="operatedBy" value="${esc(p.operatedBy)}" maxlength="200"></label>
            </div>
            <label class="field">Nội dung <textarea class="input" name="content">${esc(p.content)}</textarea></label>
            <div class="actions">
              <a class="btn btn-ghost btn-sm" href="/policy/${esc(p.slug)}" target="_blank">Xem trang</a>
              <button class="btn btn-primary btn-sm" type="submit">Lưu</button>
            </div>
          </form>
        </details>`).join('');
    } catch (err) { toast(err.message, true); }
  }
  $('#policy-editors').addEventListener('submit', async (e) => {
    e.preventDefault();
    const box = e.target.closest('.policy-editor');
    const f = e.target;
    // Admin không tự chọn ngày Last Updated → lấy hôm nay.
    if (f.updatedAt.value === f.updatedAt.dataset.saved) f.updatedAt.value = today();
    try {
      const p = await api(`/api/admin/policies/${encodeURIComponent(box.dataset.slug)}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: f.title.value, content: f.content.value,
          effectiveDate: f.effectiveDate.value, updatedAt: f.updatedAt.value, operatedBy: f.operatedBy.value,
        }),
      });
      f.updatedAt.value = f.updatedAt.dataset.saved = p.updatedAt;
      $('summary span', box).textContent = p.title;
      $('summary small', box).textContent = policyStatus(p);
      toast('Đã lưu "' + p.title + '"');
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
