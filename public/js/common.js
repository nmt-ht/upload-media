// Dùng chung cho mọi trang: header, menu, popup Liên hệ / Kho tài nguyên, toast, tiện ích.
(function () {
  const P = {
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/><path d="m16 16-1.9-1.9"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
    audio: '<path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/>',
    arrowUpRight: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    arrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    whatsapp: '<path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/>',
    telegram: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    zalo: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 9h4l-4 6h4"/><path d="M15 9v6"/>',
    pin: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    calendarCheck: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
    fingerprint: '<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>',
    fileCheck: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
    disc: '<circle cx="12" cy="12" r="10"/><path d="M6 12c0-1.7.7-3.2 1.8-4.2"/><circle cx="12" cy="12" r="2"/><path d="M18 12c0 1.7-.7 3.2-1.8 4.2"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  };
  const icon = (name, size = 22, sw = 2) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

  // Logo mạng xã hội (dạng tô đặc, theo Simple Icons).
  const BRAND = {
    facebook: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
    youtube: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
    tiktok: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  };
  const brandIcon = (name, size = 20) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${BRAND[name]}"/></svg>`;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  // "20 Nov 2025" — dùng trong khung Copyright Information.
  function fmtDateEn(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return `${d} ${'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[m - 1]} ${y}`;
  }
  function fmtDuration(s) {
    s = Math.max(0, Math.round(s || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  function fmtBytes(n) {
    if (n >= 1024 * 1024) return +(n / 1024 / 1024).toFixed(1) + ' MB';
    return Math.round(n / 1024) + ' KB';
  }

  // Cho phép admin nhập số điện thoại / username hoặc link đầy đủ.
  function contactLinks(s) {
    const isUrl = (v) => /^https?:\/\//i.test(v);
    const digits = (v) => v.replace(/[^\d]/g, '').replace(/^0/, '84');
    const out = [];
    if (s.whatsapp) out.push({ key: 'whatsapp', name: 'WhatsApp', value: s.whatsapp, href: isUrl(s.whatsapp) ? s.whatsapp : `https://wa.me/${digits(s.whatsapp)}` });
    if (s.zalo) out.push({ key: 'zalo', name: 'Zalo', value: s.zalo, href: isUrl(s.zalo) ? s.zalo : `https://zalo.me/${s.zalo.replace(/[^\d]/g, '')}` });
    if (s.telegram) out.push({ key: 'telegram', name: 'Telegram', value: s.telegram, href: isUrl(s.telegram) ? s.telegram : `https://t.me/${s.telegram.replace(/^@/, '')}` });
    if (s.email) out.push({ key: 'mail', name: 'Email', value: s.email, href: `mailto:${s.email}` });
    return out;
  }

  // Luôn hiện đủ 4 kênh (kể cả Email); kênh chưa nhập sẽ hiện "Đang cập nhật".
  function contactOptionsHTML(settings) {
    const links = contactLinks(settings);
    const channels = [
      { key: 'whatsapp', name: 'WhatsApp' }, { key: 'zalo', name: 'Zalo' },
      { key: 'telegram', name: 'Telegram' }, { key: 'mail', name: 'Email liên hệ' },
    ];
    return channels.map((ch) => {
      const c = links.find((l) => l.key === ch.key);
      if (!c) {
        return `
        <div class="option disabled"><span class="opt-icon">${icon(ch.key)}</span>
          <span class="opt-body"><strong>${ch.name}</strong><span class="sub">Đang cập nhật</span></span></div>`;
      }
      return `
      <a class="option" href="${esc(c.href)}"${c.key === 'mail' ? '' : ' target="_blank" rel="noopener"'}>
        <span class="opt-icon">${icon(c.key)}</span>
        <span class="opt-body"><strong>${ch.name}</strong><span class="sub">${esc(c.value.replace(/^https?:\/\//, ''))}</span></span>
        ${icon('arrowUpRight', 18)}
      </a>`;
    }).join('');
  }

  // Mục Liên hệ cuối trang chủ. Dòng nào admin để trống thì không hiện.
  function contactInfoHTML(s) {
    const link = (href, text, external) =>
      `<a href="${esc(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${esc(text)}</a>`;
    const mail = (e) => link(`mailto:${e}`, e);
    const group = (title, items) => `<div class="info-group"><small>${title}</small>${items}</div>`;
    const copyright = String(s.copyrightEmails || '').split(/[\n,;]+/).map((e) => e.trim()).filter(Boolean);
    const emails = (s.email ? group('Business &amp; Partnerships', mail(s.email)) : '')
      + (copyright.length ? group('Copyright Department', copyright.map(mail).join('')) : '');
    const tg = contactLinks({ telegram: s.telegram })[0];
    const site = s.website && (/^https?:\/\//i.test(s.website) ? s.website : `https://${s.website}`);
    const rows = [
      { icon: 'pin', label: 'Business Address', body: s.address && link(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`, s.address, true) },
      { icon: 'phone', label: 'Phone', body: s.phone && link(`tel:${s.phone.replace(/[^\d+]/g, '')}`, s.phone) },
      { icon: 'mail', label: 'Email Addresses', body: emails },
      { icon: 'telegram', label: 'Telegram', body: tg && link(tg.href, tg.value, true) },
      { icon: 'globe', label: 'Official Website', body: site && link(site, s.website.replace(/^https?:\/\//i, '').replace(/\/$/, ''), true) },
      { icon: 'clock', label: 'Business Hours', body: s.workingHours && `<span>${esc(s.workingHours)}</span>` },
    ];
    return rows.filter((r) => r.body).map((r) =>
      `<li>${icon(r.icon, 22, 1.8)}<div class="info-body"><strong>${r.label}</strong>${r.body}</div></li>`).join('');
  }

  // Icon Facebook / YouTube / TikTok. Admin có thể nhập link đầy đủ hoặc chỉ tên trang / @handle.
  // Kênh chưa có link vẫn hiện icon (mờ, không bấm được) giống quy ước "Đang cập nhật".
  function socialLinksHTML(s) {
    const SOCIAL = [
      { key: 'facebook', name: 'Facebook', base: 'https://www.facebook.com/' },
      { key: 'youtube', name: 'YouTube', base: 'https://www.youtube.com/' },
      { key: 'tiktok', name: 'TikTok', base: 'https://www.tiktok.com/' },
    ];
    return SOCIAL.map((c) => {
      const v = (s[c.key] || '').trim();
      if (!v) return `<span class="social disabled" title="${c.name} — Đang cập nhật">${brandIcon(c.key)}</span>`;
      let href = v;
      if (!/^https?:\/\//i.test(v)) {
        href = /^(www\.)?[\w-]+\.(com|be)\//i.test(v) ? `https://${v}` // vd: facebook.com/ltbmedia
          : c.base + (c.key === 'facebook' ? v.replace(/^@/, '') : '@' + v.replace(/^@/, ''));
      }
      return `<a class="social" href="${esc(href)}" target="_blank" rel="noopener" aria-label="${c.name}" title="${c.name}">${brandIcon(c.key)}</a>`;
    }).join('');
  }

  // ---------- Layout ----------
  const page = document.body.dataset.page || '';
  const NAV = [
    { id: 'home', href: '/', label: 'Trang chủ', icon: 'home' },
    { id: 'images', href: '/images', label: 'Kho ảnh', icon: 'image' },
    { id: 'audio', href: '/audio', label: 'Kho âm thanh', icon: 'audio' },
    { id: 'contact', href: '/#lien-he', label: 'Liên hệ', icon: 'phone' },
  ];
  const cur = (id) => (id === page ? ' aria-current="page"' : '');

  const header = document.getElementById('site-header');
  if (header) {
    header.className = 'site-header';
    header.innerHTML = `
      <div class="wrap">
        <a class="brand" href="/" aria-label="LTB Media Network - Trang chủ">
          <img class="brand-logo" src="/img/logo.png" alt="LTB Media Network" width="167" height="48">
        </a>
        <nav class="nav-desktop">${NAV.map((n) => `<a href="${n.href}"${cur(n.id)}>${n.label}</a>`).join('')}</nav>
        <button class="icon-btn menu-toggle" data-open="drawer" aria-label="Mở menu">${icon('menu', 26)}</button>
      </div>`;
  }

  const footer = document.getElementById('site-footer');
  if (footer) {
    footer.className = 'site-footer';
    footer.innerHTML = `
      <div class="wrap">
        <span>© ${new Date().getFullYear()} LTB Media Network · Digital Rights Protection</span>
        <span class="footer-links"><a href="/images">Kho ảnh</a><a href="/audio">Kho âm thanh</a><a href="#" data-open="contact">Liên hệ</a>
          <span class="social-list" data-social></span></span>
      </div>`;
  }

  document.body.insertAdjacentHTML('beforeend', `
    <div class="overlay" data-close></div>
    <aside class="drawer" id="drawer" aria-label="Menu">
      <div class="drawer-head"><strong>Menu</strong><button class="icon-btn" data-close aria-label="Đóng">${icon('x')}</button></div>
      ${NAV.map((n) => `<a class="nav-item" href="${n.href}"${cur(n.id)}>${icon(n.icon, 20)} ${n.label}</a>`).join('')}
    </aside>
    <div class="sheet" id="sheet-contact" role="dialog" aria-modal="true" aria-labelledby="sc-title">
      <div class="sheet-head"><div><h3 id="sc-title">Đăng ký bảo vệ bản quyền</h3><p>Liên hệ trực tiếp với LTB Media Network qua kênh bạn muốn.</p></div>
        <button class="icon-btn" data-close aria-label="Đóng">${icon('x')}</button></div>
      <div class="option-list" data-contact-options></div>
    </div>
    <div class="sheet" id="sheet-explore" role="dialog" aria-modal="true" aria-labelledby="se-title">
      <div class="sheet-head"><div><h3 id="se-title">Khám phá kho tài nguyên</h3><p>Tài nguyên số đã được đăng ký bản quyền.</p></div>
        <button class="icon-btn" data-close aria-label="Đóng">${icon('x')}</button></div>
      <div class="option-list">
        <a class="option" href="/images"><span class="opt-icon">${icon('image')}</span>
          <span class="opt-body"><strong>Stock Images</strong><span class="sub">Kho ảnh có bản quyền</span></span>${icon('arrowRight', 18)}</a>
        <a class="option" href="/audio"><span class="opt-icon">${icon('audio')}</span>
          <span class="opt-body"><strong>Licensed Audio</strong><span class="sub">Âm nhạc và âm thanh</span></span>${icon('arrowRight', 18)}</a>
      </div>
    </div>
    <div class="toast" id="toast" role="status"></div>`);

  const overlay = document.querySelector('.overlay');
  const panels = { drawer: '#drawer', contact: '#sheet-contact', explore: '#sheet-explore' };
  function closeAll() {
    document.querySelectorAll('.drawer.open, .sheet.open').forEach((el) => el.classList.remove('open'));
    overlay.classList.remove('open');
  }
  function open(name) {
    closeAll();
    const el = document.querySelector(panels[name]);
    if (!el) return;
    el.classList.add('open');
    overlay.classList.add('open');
  }

  let toastTimer;
  function toast(msg, isError) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.toggle('error', !!isError);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  const settingsReady = fetch('/api/settings').then((r) => r.json()).catch(() => ({}));
  settingsReady.then((s) => {
    document.querySelectorAll('[data-contact-options]').forEach((el) => { el.innerHTML = contactOptionsHTML(s); });
    document.querySelectorAll('[data-contact-info]').forEach((el) => { el.innerHTML = contactInfoHTML(s); });
    document.querySelectorAll('[data-social]').forEach((el) => { el.innerHTML = socialLinksHTML(s); });
  });

  // Hàng link chính sách (dưới Follow Us, và trên trang /policy/...)
  const policyLists = document.querySelectorAll('[data-policies]');
  if (policyLists.length) {
    fetch('/api/policies').then((r) => r.json()).then((list) => {
      const html = list.map((p) => {
        const href = `/policy/${encodeURIComponent(p.slug)}`;
        return `<a href="${href}"${location.pathname === href ? ' aria-current="page"' : ''}>${esc(p.title)}</a>`;
      }).join('');
      policyLists.forEach((el) => { el.innerHTML = html; });
    }).catch(() => {});
  }

  document.addEventListener('click', async (e) => {
    const opener = e.target.closest('[data-open]');
    if (opener) { e.preventDefault(); open(opener.dataset.open); return; }
    if (e.target.closest('[data-close]')) { closeAll(); return; }
    const mon = e.target.closest('[data-monitoring]');
    if (mon) {
      e.preventDefault();
      const s = await settingsReady;
      if (s.monitoringUrl) window.open(s.monitoringUrl, '_blank', 'noopener');
      else toast('Tính năng Content Monitoring đang được cập nhật.');
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
  document.querySelectorAll('.drawer a').forEach((a) => a.addEventListener('click', closeAll));

  window.LTB = { icon, esc, fmtDate, fmtDateEn, fmtDuration, fmtBytes, toast, open, closeAll, settingsReady, contactOptionsHTML };
})();
