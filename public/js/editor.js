// Trình soạn thảo cho mô tả ảnh/âm thanh và trang chính sách — Quill 2 (BSD-3-Clause, miễn phí),
// nạp từ /vendor/quill (node_modules). Chỉ cho các định dạng khớp giao diện web: tiêu đề, đậm, nghiêng,
// gạch chân, danh sách, trích dẫn, link, đường kẻ ngang. Dán từ Word/Google Docs tự bỏ màu, font, cỡ chữ.
// Server lọc lại HTML trước khi lưu (lib/rich-text.js).
(function () {
  const BlockEmbed = Quill.import('blots/block/embed');
  class Divider extends BlockEmbed {
    static blotName = 'divider';
    static tagName = 'hr';
  }
  Quill.register(Divider);
  Quill.import('ui/icons').divider =
    '<svg viewBox="0 0 18 18"><line class="ql-stroke" x1="2" x2="16" y1="9" y2="9"></line></svg>';

  const TOOLBAR = [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'link', 'divider'],
    ['clean'],
  ];
  const FORMATS = ['header', 'bold', 'italic', 'underline', 'list', 'blockquote', 'link', 'divider'];
  const isHtml = (s) => /^\s*<(p|h[1-6]|ul|ol|hr|blockquote|div|br)\b/i.test(s || '');

  function create(el, content = '', { placeholder = 'Nhập nội dung…' } = {}) {
    const quill = new Quill(el, {
      theme: 'snow',
      placeholder,
      formats: FORMATS,
      modules: {
        toolbar: {
          container: TOOLBAR,
          handlers: {
            divider() {
              const range = this.quill.getSelection(true);
              this.quill.insertEmbed(range.index, 'divider', true, Quill.sources.USER);
              this.quill.setSelection(range.index + 1, Quill.sources.SILENT);
            },
          },
        },
      },
    });
    const api = {
      quill,
      // Nội dung cũ dạng chữ (dòng trống, ---, **, - …) được chuyển sang định dạng tương ứng.
      set(value) {
        const html = isHtml(value) ? value : LTB.formatText(value || '');
        quill.setContents(quill.clipboard.convert({ html }), Quill.sources.SILENT);
        quill.history.clear();
      },
      get() {
        if (!quill.getText().trim() && !quill.root.querySelector('hr')) return '';
        return quill.getSemanticHTML().replace(/&nbsp;/g, ' ');
      },
      clear() { api.set(''); },
    };
    api.set(content);
    return api;
  }

  window.LTBEditor = { create };
})();
