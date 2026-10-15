// Nội dung soạn bằng trình soạn thảo (mô tả ảnh/âm thanh, trang chính sách) được lưu dạng HTML.
// Chỉ giữ các thẻ định dạng cơ bản — bỏ hết script, style, màu, font… — nên kể cả khi tài khoản admin
// bị lộ cũng không chèn được mã độc lên trang công khai, và nội dung luôn khớp giao diện web.
// Lọc cả lúc lưu lẫn lúc trả ra (dữ liệu cũ có thể chưa qua bước lọc).
// Nội dung cũ dạng chữ thường (không bắt đầu bằng thẻ HTML) giữ nguyên, trình duyệt tự định dạng (LTB.formatText).
const sanitizeHtml = require('sanitize-html');

const OPTIONS = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'hr', 'blockquote'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: (tagName, attribs) => ({ tagName, attribs: { href: attribs.href, target: '_blank', rel: 'noopener noreferrer' } }),
    h1: 'h2',
    div: 'p',
  },
};

const isHtml = (s) => /^\s*<(p|h[1-6]|ul|ol|hr|blockquote|div|br)\b/i.test(s || '');

const cache = new Map();
function clean(s) {
  if (typeof s !== 'string' || !isHtml(s)) return s;
  if (!cache.has(s)) {
    if (cache.size > 2000) cache.clear();
    // Quill xuất khoảng trắng thành &nbsp; — đổi lại để chữ tự xuống dòng bình thường.
    cache.set(s, sanitizeHtml(s.replace(/&nbsp;/g, ' '), OPTIONS).trim());
  }
  return cache.get(s);
}

// Bản chữ thuần (thẻ chia sẻ Open Graph): mỗi khối một đoạn, cách nhau bằng dòng trống.
function toPlain(s) {
  if (!isHtml(s)) return s || '';
  return sanitizeHtml(clean(s).replace(/<\/(p|h[2-4]|li|blockquote)>|<br\s*\/?>|<hr\s*\/?>/gi, '$&\n\n'), { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = { isHtml, clean, toPlain };
