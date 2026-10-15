(function () {
  const { icon, esc, fmtDate, fmtDuration, fmtBytes, toast } = LTB;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  $$('[data-icon]').forEach((el) => { el.outerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 18); });

  // Trình soạn thảo (public/js/editor.js). Khung trong danh sách / chính sách chỉ tạo khi mở ra.
  const uploadDesc = LTBEditor.create($('#upload-desc'), '', { placeholder: 'Mô tả ảnh / âm thanh…' });
  const editors = new WeakMap(); // phần tử .rte-wrap → editor
  function editorIn(box, content) {
    const wrap = $('.rte-wrap', box);
    if (!editors.has(wrap)) editors.set(wrap, LTBEditor.create($('[data-rte]', wrap), content));
    return editors.get(wrap);
  }

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
    if (b.dataset.tab === 'backups') loadBackups();
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
    fd.append('description', uploadDesc.get());
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
      uploadDesc.clear();
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
          <details class="cr-edit" data-desc><summary>Mô tả${m.description ? '' : ' (trống)'}</summary><div class="rte-wrap"><div data-rte></div></div></details>
          <details class="cr-edit"><summary>Thông tin bản quyền</summary>${copyrightFieldsHTML(m.type, m)}</details>
        </div>
      </div>`).join('');
  }
  // 'toggle' không nổi bọt → bắt ở pha capture
  $('#items').addEventListener('toggle', (e) => {
    if (!e.target.matches('[data-desc]') || !e.target.open) return;
    const m = items.find((x) => x.id === e.target.closest('.item').dataset.id);
    editorIn(e.target, m.description);
  }, true);
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
          body: JSON.stringify({
            title: $('[name=title]', row).value, publishedAt: $('[name=publishedAt]', row).value, ...readCopyright(row),
            // Chỉ gửi mô tả khi đã mở khung sửa (chưa mở = không đổi)
            ...(editors.has($('[data-desc] .rte-wrap', row)) ? { description: editors.get($('[data-desc] .rte-wrap', row)).get() } : {}),
          }),
        });
        Object.assign(items.find((m) => m.id === id), updated);
        toast('Đã lưu');
      } else if (e.target.closest('[data-del]')) {
        const m = items.find((x) => x.id === id);
        if (!confirm(`Xoá "${m.title}"?\n\nFile được giữ trong thùng rác 30 ngày — lấy lại bằng tab Sao lưu → Khôi phục bản "Trước khi xoá".`)) return;
        await api(`/api/admin/media/${id}`, { method: 'DELETE' });
        items = items.filter((x) => x.id !== id);
        drawItems();
        toast('Đã xoá');
      }
    } catch (err) { toast(err.message, true); }
  });

  // ---------- Chính sách ----------
  const policyStatus = (p) => (p.content.trim() ? `Cập nhật ${fmtDate(p.updatedAt)}` : 'Chưa có nội dung');
  let policies = {};
  async function loadPolicies() {
    try {
      const list = await api('/api/admin/policies');
      policies = Object.fromEntries(list.map((p) => [p.slug, p]));
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
            <div class="field">Nội dung <div class="rte-wrap tall"><div data-rte></div></div></div>
            <div class="actions">
              <a class="btn btn-ghost btn-sm" href="/policy/${esc(p.slug)}" target="_blank">Xem trang</a>
              <button class="btn btn-primary btn-sm" type="submit">Lưu</button>
            </div>
          </form>
        </details>`).join('');
    } catch (err) { toast(err.message, true); }
  }
  $('#policy-editors').addEventListener('toggle', (e) => {
    if (e.target.matches('.policy-editor') && e.target.open) editorIn(e.target, policies[e.target.dataset.slug].content);
  }, true);
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
          title: f.title.value, content: editorIn(box).get(),
          effectiveDate: f.effectiveDate.value, updatedAt: f.updatedAt.value, operatedBy: f.operatedBy.value,
        }),
      });
      policies[box.dataset.slug] = { ...policies[box.dataset.slug], ...p };
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

  // ---------- Sao lưu & khôi phục ----------
  const REASON = {
    daily: 'Tự động hằng ngày', manual: 'Sao lưu thủ công', 'before-delete': 'Trước khi xoá',
    'before-restore': 'Trước khi khôi phục', upload: 'Tải lên từ máy', server: 'Máy chủ (trước cập nhật)', imported: 'Bản cũ trên máy chủ',
  };
  const when = (iso) => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
  const countText = (b) => (b.invalid ? 'File hỏng — không khôi phục được' : `${b.images} ảnh · ${b.audio} âm thanh`);
  let backups = [];

  async function loadBackups() {
    try {
      const s = await api('/api/admin/backups');
      backups = s.backups;
      $$('[data-keep-days]').forEach((el) => { el.textContent = s.keepDays; });
      const last = backups.find((b) => !['upload', 'imported'].includes(b.reason));
      const off = s.offsite;
      const offAge = off && (Date.now() - Date.parse(off.at)) / 3600000;
      $('#bk-stats').innerHTML = `
        <div class="bk-stat"><strong>Bản sao lưu gần nhất</strong>${last
          ? `${when(last.createdAt)}<br><span class="muted">${REASON[last.reason] || last.reason}</span>` : '<span class="bad">Chưa có</span>'}</div>
        <div class="bk-stat"><strong>Dữ liệu &amp; thùng rác</strong>${s.uploads.files} file · ${fmtBytes(s.uploads.bytes)}<br>
          <span class="muted">Thùng rác: ${s.trash.files} file · ${fmtBytes(s.trash.bytes)} (giữ ${s.keepDays} ngày)</span></div>
        <div class="bk-stat"><strong>Sao lưu ra ngoài máy chủ</strong>${!off
          ? '<span class="bad">Chưa cấu hình</span><br><span class="muted">Hãy tải toàn bộ dữ liệu định kỳ</span>'
          : off.ok && offAge < 48
            ? `<span class="ok">Hoạt động</span> · ${when(off.at)}<br><span class="muted">${esc(off.remote || '')}</span>`
            : `<span class="bad">${off.ok ? 'Quá 2 ngày chưa chạy' : 'Lỗi'}</span> · ${when(off.at)}<br><span class="muted">${esc(off.message || '')}</span>`}</div>`;
      $('#bk-full').innerHTML = `${icon('download', 16)} Tải toàn bộ dữ liệu (.tar · ~${fmtBytes(s.uploads.bytes)})`;
      $('#bk-list').innerHTML = backups.length ? backups.map((b) => `
        <div class="bk-row" data-name="${esc(b.name)}">
          <div><span class="when">${when(b.createdAt)}</span><span class="bk-tag ${esc(b.reason)}">${REASON[b.reason] || esc(b.reason)}</span>
            <div class="meta">${countText(b)} · ${fmtBytes(b.size)}</div></div>
          <span style="display:flex;gap:6px">
            <a class="btn btn-ghost btn-sm" href="/api/admin/backups/${encodeURIComponent(b.name)}" download>${icon('download', 16)} Tải về</a>
            <button class="btn btn-ghost btn-sm" data-restore ${b.invalid ? 'disabled' : ''}>${icon('history', 16)} Khôi phục</button>
          </span>
        </div>`).join('') : '<div class="empty">Chưa có bản sao lưu nào.</div>';
    } catch (err) { toast(err.message, true); }
  }

  $('#bk-create').addEventListener('click', async () => {
    try { await api('/api/admin/backups', { method: 'POST' }); toast('Đã tạo bản sao lưu'); loadBackups(); }
    catch (err) { toast(err.message, true); }
  });

  $('#bk-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await api('/api/admin/backups/upload', { method: 'POST', body: fd });
      toast('Đã thêm "' + file.name + '" vào danh sách — bấm Khôi phục ở dòng "Tải lên từ máy" để dùng');
      loadBackups();
    } catch (err) { toast(err.message, true); }
  });

  $('#bk-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-restore]');
    if (!btn) return;
    const b = backups.find((x) => x.name === btn.closest('.bk-row').dataset.name);
    if (!confirm(`Khôi phục dữ liệu về bản sao lưu lúc ${when(b.createdAt)} (${countText(b)})?\n\n`
      + 'Danh sách ảnh/âm thanh, cài đặt và chính sách sẽ trở về như lúc đó. Dữ liệu hiện tại được tự sao lưu trước '
      + '("Trước khi khôi phục") để có thể quay lại nếu cần.')) return;
    btn.disabled = true;
    try {
      const r = await api(`/api/admin/backups/${encodeURIComponent(b.name)}/restore`, { method: 'POST' });
      const missing = r.missing.length
        ? `<br><b>Thiếu ${r.missing.length} file</b> (đã quá ${$('[data-keep-days]').textContent} ngày hoặc mất ổ đĩa — cần chép lại từ bản sao lưu ngoài máy chủ):
           ${r.missing.slice(0, 10).map((m) => `${m.type === 'image' ? 'Ảnh' : 'Âm thanh'} #${m.no} ${esc(m.title)}`).join(', ')}${r.missing.length > 10 ? '…' : ''}`
        : '';
      $('#bk-result').innerHTML = `<div class="bk-result${r.missing.length ? ' warn' : ''}">
        Đã khôi phục: <b>${r.images} ảnh · ${r.audio} âm thanh</b>${r.recovered ? `, lấy lại ${r.recovered} file từ thùng rác` : ''}.${missing}</div>`;
      toast('Khôi phục thành công');
      loadItems(); loadSettings(); loadPolicies(); loadBackups();
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
    }
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
