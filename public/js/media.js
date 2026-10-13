// Hiển thị kho ảnh / kho âm thanh (dùng ở trang chủ và các trang kho).
(function () {
  const { icon, esc, fmtDate, fmtDuration } = LTB;

  function emptyHTML(kind) {
    return `<div class="empty" style="grid-column:1/-1">${icon(kind === 'image' ? 'image' : 'audio', 36, 1.5)}
      <div>Chưa có ${kind === 'image' ? 'hình ảnh' : 'âm thanh'} nào.</div></div>`;
  }

  // ---------- Ảnh ----------
  function renderImages(el, list) {
    if (!list.length) { el.innerHTML = emptyHTML('image'); return; }
    el.innerHTML = list.map((m, i) => `
      <button class="tile" data-i="${i}">
        <div class="thumb">
          <img src="${esc(m.url)}" alt="${esc(m.title)}" loading="lazy" draggable="false">
          <span class="badge-protected">${icon('shield', 12, 2.5)} Protected</span>
        </div>
        <div class="meta"><strong>${esc(m.title)}</strong>
          <span class="date">${icon('calendar', 14)} ${fmtDate(m.publishedAt)}</span></div>
      </button>`).join('');
    el.onclick = (e) => {
      const tile = e.target.closest('.tile');
      if (tile) openLightbox(list[Number(tile.dataset.i)]);
    };
  }

  function openLightbox(m) {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = `
      <div class="lightbox-top"><button class="icon-btn" aria-label="Đóng">${icon('x', 26)}</button></div>
      <div class="lightbox-body"><img src="${esc(m.url)}" alt="${esc(m.title)}" draggable="false"></div>
      <div class="lightbox-info">
        <div><h3>${esc(m.title)}</h3>
          <p>${m.description ? esc(m.description) + ' · ' : ''}${m.width}×${m.height}px · Đăng ngày ${fmtDate(m.publishedAt)}</p></div>
        <button class="btn btn-primary btn-sm" data-license>${icon('shield', 16)} Liên hệ cấp phép</button>
      </div>`;
    const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    box.addEventListener('click', (e) => {
      if (e.target.closest('[data-license]')) { close(); LTB.open('contact'); return; }
      if (e.target === box || e.target.closest('.icon-btn') || e.target.classList.contains('lightbox-body')) close();
    });
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
    el.innerHTML = list.map((m, i) => `
      <div class="track" data-i="${i}">
        <button class="play" aria-label="Phát">${icon('play', 20)}</button>
        <div class="info">
          <strong>${esc(m.title)}</strong>
          <div class="sub"><span class="date">${icon('calendar', 14)} ${fmtDate(m.publishedAt)}</span>
            ${m.description ? `<span class="muted" style="font-size:13px">${esc(m.description)}</span>` : ''}</div>
          <div class="progress"><i></i></div>
        </div>
        <span class="dur">${fmtDuration(m.duration)}</span>
        <button class="btn btn-ghost btn-sm license" data-license>Cấp phép</button>
      </div>`).join('');

    el.onclick = (e) => {
      const row = e.target.closest('.track');
      if (!row) return;
      if (e.target.closest('[data-license]')) { LTB.open('contact'); return; }
      const item = list[Number(row.dataset.i)];

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
  }

  window.Media = { renderImages, renderAudio, mountLibrary };
})();
