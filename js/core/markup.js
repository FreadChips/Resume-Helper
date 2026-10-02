/* =============================================
   简历助手 · 轻量文本标记
   支持：**加粗**  *斜体*  [文字](链接)  以 - • · * 开头的列表行  1. 有序列表
   输出的块级元素（p / ul / ol / .md-gap）是分页时可拆分的最小单位
   ============================================= */
(function () {
  'use strict';

  const RB = window.RB;
  const { esc, str } = RB.util;

  const BULLET = /^\s*[-*•·▪●+]\s+(.*)$/;
  const ORDERED = /^\s*(\d{1,2})(?:[.)]\s+|、\s*)(.*)$/;

  function inline(text) {
    let s = esc(text);
    s = s.replace(/\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?![*\w])/g, '$1<em>$2</em>');
    return s;
  }

  function md(src) {
    const lines = str(src).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let list = null;
    let pendingGap = false;

    const closeList = () => {
      if (!list) return;
      out.push(`<${list.tag}>${list.items.map(i => `<li>${i}</li>`).join('')}</${list.tag}>`);
      list = null;
    };

    for (const line of lines) {
      if (!line.trim()) {
        closeList();
        if (out.length) pendingGap = true;
        continue;
      }
      if (pendingGap) { out.push('<div class="md-gap"></div>'); pendingGap = false; }

      const b = line.match(BULLET);
      const o = !b && line.match(ORDERED);
      if (b || o) {
        const tag = b ? 'ul' : 'ol';
        if (!list || list.tag !== tag) {
          closeList();
          list = { tag, items: [] };
        }
        list.items.push(inline((b ? b[1] : o[2]).trim()));
        continue;
      }
      closeList();
      out.push(`<p>${inline(line.trim())}</p>`);
    }
    closeList();
    return out.join('');
  }

  /** 去掉标记，得到纯文本（用于编辑器摘要等） */
  md.plain = function (src) {
    return str(src)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/(^|\n)\s*(?:[-*•·▪●+]|\d{1,2}[.)、])\s*/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  };

  md.inline = inline;
  RB.md = md;
})();
