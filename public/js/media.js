// Hiển thị kho ảnh / kho âm thanh (dùng ở trang chủ và các trang kho).
(function () {
  const { icon, esc, richText, firstLine, fmtDate, fmtDateEn, fmtDuration } = LTB;

  function emptyHTML(kind) {
    return `<div class="empty" style="grid-column:1/-1">${icon(kind === 'image' ? 'image' : 'audio', 36, 1.5)}
      <div>Chưa có ${kind === 'image' ? 'hình ảnh' : 'âm thanh'} nào.</div></div>`;
  }

  // Ctrl/⌘/Shift/chuột giữa trên link chi tiết: để trình duyệt mở tab mới như link thường.
  const newTabClick = (e) => e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1;

  // ---------- Ảnh ----------
  function renderImages(el, list) {
    if (!list.length) { el.innerHTML = emptyHTML('image'); return; }
    list.forEach((m) => known.set(m.id, m));
    el.innerHTML = list.map((m, i) => `
      <a class="tile" href="${esc(m.path)}" data-i="${i}">
        <div class="thumb">
          <img src="${esc(m.url)}" alt="${esc(m.title)}" loading="lazy" draggable="false">
          ${m.protected === false ? '' : `<span class="badge-protected">${icon('shield', 12, 2.5)} Protected</span>`}
        </div>
        <div class="meta"><strong>${esc(m.title)}</strong>
          <span class="date">${icon('calendar', 14)} ${fmtDate(m.publishedAt)}</span></div>
      </a>`).join('');
    el.onclick = (e) => {
      const tile = e.target.closest('.tile');
      if (!tile || newTabClick(e)) return;
      e.preventDefault();
      openDetails(list[Number(tile.dataset.i)]);
    };
  }

  // ---------- Chi tiết + Copyright Information (admin nhập ở trang quản trị) ----------
  function copyrightHTML(m) {
    const pending = '<span class="cr-empty">Đang cập nhật</span>';
    const val = (v) => (v ? esc(v) : pending);
    const verified = m.verification === 'verified';
    const isImage = m.type === 'image';
    const date = m.protectionDate ? fmtDateEn(m.protectionDate) : pending;
    const verification = ['fileCheck', 'Verification Status',
      `<span class="cr-verify${verified ? ' ok' : ''}">${verified ? 'Verified' : 'Pending Verification'}</span>`];
    const rows = isImage ? [
      ['user', 'Author / Copyright Owner', val(m.owner)],
      ['shield', 'Protection Provider', val(m.provider)],
      ['calendarCheck', 'Protection Date', date],
      ['fingerprint', 'Evidence ID', val(m.evidenceId)],
      verification,
    ] : [
      ['music', 'Work Title', val(m.workTitle || m.title)],
      ['user', 'Composer / Author', val(m.composer)],
      ['mic', 'Performing Artist', val(m.performer)],
      ['disc', 'Sound Recording Owner', val(m.recordingOwner)],
      ['shield', 'Protection Provider', val(m.provider)],
      ['fingerprint', 'Evidence ID', val(m.evidenceId)],
      ['calendar', 'Date Recorded', date],
      verification,
    ];
    // Ảnh: "1920 × 1080 px · Published 20 Nov 2025". Âm thanh: "Audio · WAV · 48 kHz / 24-bit".
    const format = (m.url.match(/\.(\w+)$/) || [])[1]?.toUpperCase();
    const meta = isImage
      ? `${m.width} × ${m.height} px · Published ${fmtDateEn(m.publishedAt)}`
      : ['Audio', format, m.audioSpec].filter(Boolean).join(' · ');
    return `
      <div class="cr-head">
        <div class="cr-thumb${isImage ? '' : ' audio'}">${isImage
          ? `<img src="${esc(m.url)}" alt="" draggable="false">` : icon('music', 34, 2)}</div>
        <div class="cr-title">
          <h3>${esc(m.title)}</h3>
          <p>${esc(meta)}</p>
          <div class="cr-badges">
            <span class="pill${m.protected ? ' pill-ok' : ''}">${m.protected ? 'Protected' : 'Not Protected'}</span>
            <span class="pill">${isImage ? (m.active ? 'Active' : 'Inactive') : 'Audio Asset'}</span>
          </div>
        </div>
      </div>
      ${m.type === 'audio' ? `<audio class="cr-audio" controls controlslist="nodownload" preload="none" src="${esc(m.url)}"></audio>` : ''}
      ${m.description ? `<div class="cr-desc rich">${richText(m.description)}</div>` : ''}
      <h4 class="cr-heading">Copyright Information</h4>
      <ul class="cr-list">${rows.map(([ic, label, v]) =>
        `<li>${icon(ic, 20, 1.8)}<div><strong>${label}</strong><span>${v}</span></div></li>`).join('')}</ul>
      <div class="cr-actions">
        <button class="btn btn-primary btn-sm cr-cta" data-license>${icon('shield', 16)} Liên hệ cấp phép</button>
        <button class="btn btn-ghost btn-sm" data-copy-link>${icon('link', 16)} Sao chép link</button>
      </div>`;
  }

  async function copyLink(path) {
    const url = location.origin + path;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const t = Object.assign(document.createElement('textarea'), { value: url });
      document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    LTB.toast('Đã sao chép link: ' + url);
  }

  // URL đổi theo khung chi tiết: mở → /images/12, đóng / Back → về trang trước.
  const LIST_PATH = { image: '/images', audio: '/audio' };
  // Trang chi tiết do server trả về đã đổi <title> thành tên file; tiêu đề gốc của trang kho nằm ở thẻ meta.
  const baseTitle = document.querySelector('meta[name="ltb-page-title"]')?.content || document.title;
  let openBox = null; // { id, close }
  const known = new Map(); // id → mục đã hiển thị, để Forward mở lại được
  window.addEventListener('popstate', () => {
    const id = history.state?.ltbDetail;
    if (openBox && id !== openBox.id) openBox.close({ fromPop: true });
    if (id && !openBox && known.has(id)) openDetails(known.get(id), { viaHistory: true });
  });

  // Ảnh: xem lớn + khung thông tin bên cạnh (dưới trên điện thoại). Âm thanh: chỉ khung thông tin.
  // fromUrl: mở do người dùng vào thẳng link chi tiết (không thêm lịch sử).
  // viaHistory: mở lại khi bấm Forward — mục lịch sử đã có sẵn, đóng thì Back như thường.
  function openDetails(m, { fromUrl = false, viaHistory = false } = {}) {
    if (openBox) openBox.close({ silent: true });
    known.set(m.id, m);
    const pushed = viaHistory || (!fromUrl && !!m.path && location.pathname !== m.path);
    if (viaHistory) { /* URL đã đúng */ }
    else if (pushed) history.pushState({ ltbDetail: m.id }, '', m.path);
    else history.replaceState({ ltbDetail: m.id }, '');
    document.title = `${m.title} — LTB Media Network`;
    const box = document.createElement('div');
    box.className = 'lightbox' + (m.type === 'image' ? ' has-media' : '');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', m.title);
    box.innerHTML = `
      <div class="lightbox-top"><button class="icon-btn" data-close-box aria-label="Đóng">${icon('x', 26)}</button></div>
      <div class="details">
        ${m.type === 'image' ? `<div class="lightbox-body"><img src="${esc(m.url)}" alt="${esc(m.title)}" draggable="false"></div>` : ''}
        <aside class="cr-card">${copyrightHTML(m)}</aside>
      </div>`;
    const close = ({ fromPop = false, silent = false } = {}) => {
      box.remove();
      document.removeEventListener('keydown', onKey);
      openBox = null;
      document.title = baseTitle;
      if (fromPop || silent) return;
      if (pushed) history.back();
      else history.replaceState(null, '', LIST_PATH[m.type]); // vào thẳng link → đóng thì về trang kho
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    openBox = { id: m.id, close };
    box.addEventListener('click', (e) => {
      if (e.target.closest('[data-copy-link]')) { copyLink(m.path); return; }
      if (e.target.closest('[data-license]')) { close(); LTB.open('contact'); return; }
      if (e.target.closest('[data-close-box]') || e.target === box
        || e.target.classList.contains('details') || e.target.classList.contains('lightbox-body')) close();
    });
    box.querySelector('.cr-audio')?.addEventListener('play', () => player.pause());
    document.addEventListener('keydown', onKey);
    document.body.appendChild(box);
  }

  // Hạn chế lưu ảnh nhanh bằng chuột phải (chỉ là rào cản nhẹ).
  document.addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'IMG' && e.target.closest('.tile, .lightbox')) e.preventDefault();
  });

  // ---------- Âm thanh ----------
  const player = new Audio();
  player.preload = 'none';
  let current = null; // { row, item }

  function setPlaying(row, playing) {
    row.classList.toggle('playing', playing);
    row.querySelector('.play').innerHTML = icon(playing ? 'pause' : 'play', 20);
    row.querySelector('.play').setAttribute('aria-label', playing ? 'Tạm dừng' : 'Phát');
  }

  player.addEventListener('timeupdate', () => {
    if (!current || !player.duration) return;
    current.row.querySelector('.progress i').style.width = (player.currentTime / player.duration) * 100 + '%';
    current.row.querySelector('.dur').textContent = fmtDuration(player.currentTime) + ' / ' + fmtDuration(player.duration);
  });
  player.addEventListener('ended', () => {
    if (!current) return;
    setPlaying(current.row, false);
    current.row.querySelector('.progress i').style.width = '0';
    current.row.querySelector('.dur').textContent = fmtDuration(current.item.duration);
  });
  player.addEventListener('pause', () => current && setPlaying(current.row, false));
  player.addEventListener('play', () => current && setPlaying(current.row, true));

  function renderAudio(el, list) {
    if (!list.length) { el.innerHTML = emptyHTML('audio'); return; }
    list.forEach((m) => known.set(m.id, m));
    el.innerHTML = list.map((m, i) => `
      <div class="track" data-i="${i}">
        <button class="play" aria-label="Phát">${icon('play', 20)}</button>
        <div class="info">
          <strong data-info>${esc(m.title)}</strong>
          <div class="sub"><span class="date">${icon('calendar', 14)} ${fmtDate(m.publishedAt)}</span>
            ${m.description ? `<span class="desc-line" title="${esc(firstLine(m.description))}">${esc(firstLine(m.description))}</span>` : ''}</div>
          <div class="progress"><i></i></div>
        </div>
        <span class="dur">${fmtDuration(m.duration)}</span>
        <div class="track-actions">
          <a class="btn btn-ghost btn-sm" href="${esc(m.path)}" data-info>${icon('info', 16)} Copyright</a>
          <button class="btn btn-ghost btn-sm" data-license>Cấp phép</button>
        </div>
      </div>`).join('');

    el.onclick = (e) => {
      const row = e.target.closest('.track');
      if (!row) return;
      if (e.target.closest('[data-license]')) { LTB.open('contact'); return; }
      const item = list[Number(row.dataset.i)];
      if (e.target.closest('[data-info]')) {
        if (newTabClick(e)) return;
        e.preventDefault();
        openDetails(item);
        return;
      }

      const bar = e.target.closest('.progress');
      if (bar && current?.row === row && player.duration) {
        const r = bar.getBoundingClientRect();
        player.currentTime = ((e.clientX - r.left) / r.width) * player.duration;
        return;
      }
      if (!e.target.closest('.play')) return;

      if (current?.row === row) {
        player.paused ? player.play() : player.pause();
        return;
      }
      if (current) {
        player.pause();
        current.row.querySelector('.progress i').style.width = '0';
        current.row.querySelector('.dur').textContent = fmtDuration(current.item.duration);
      }
      current = { row, item };
      player.src = item.url;
      player.play().catch(() => LTB.toast('Không phát được file âm thanh này.', true));
    };
  }

  // ---------- Trang kho (lọc theo năm + tìm kiếm) ----------
  async function mountLibrary(kind) {
    const listEl = document.getElementById('library');
    const chipsEl = document.getElementById('years');
    const search = document.getElementById('search');
    const countEl = document.getElementById('count');
    const all = await fetch('/api/media?type=' + kind).then((r) => r.json()).catch(() => []);

    const years = [...new Set(all.map((m) => m.publishedAt.slice(0, 4)))].sort().reverse();
    let year = '';
    chipsEl.innerHTML = ['', ...years].map((y) =>
      `<button class="chip" data-y="${y}" aria-pressed="${y === year}">${y || 'Tất cả'}</button>`).join('');
    chipsEl.onclick = (e) => {
      const c = e.target.closest('.chip');
      if (!c) return;
      year = c.dataset.y;
      chipsEl.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', b === c));
      draw();
    };
    search.oninput = draw;

    function draw() {
      const q = search.value.trim().toLowerCase();
      const list = all.filter((m) =>
        (!year || m.publishedAt.startsWith(year)) &&
        (!q || (m.title + ' ' + (m.description || '')).toLowerCase().includes(q)));
      countEl.textContent = `${list.length} ${kind === 'image' ? 'hình ảnh' : 'âm thanh'}`;
      if (current) { player.pause(); current = null; }
      (kind === 'image' ? renderImages : renderAudio)(listEl, list);
    }
    draw();

    // Vào thẳng link chi tiết (/images/12) → mở khung chi tiết của đúng file đó.
    if (location.pathname !== LIST_PATH[kind]) {
      const item = all.find((m) => m.path === location.pathname);
      if (item) openDetails(item, { fromUrl: true });
      else history.replaceState(null, '', LIST_PATH[kind]);
    }
  }

  window.Media = { renderImages, renderAudio, mountLibrary };
})();
