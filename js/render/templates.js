/* =============================================
   简历助手 · 模板
   ---------------------------------------------
   每个模板只负责两件事：
     page(i, ctx)  → 第 i 页的骨架 HTML（含 [data-col] 栏位容器）
     flows(ctx)    → { 栏位名: [块 HTML, …] }，块会被分页引擎依次填入各页
   块约定：
     .blk                 顶层块（分页的最小移动单位）
     data-keep="next"     与下一块保持在同一页（用于栏目标题）
     [data-split]         块内可拆分的容器，其子元素（p / li / 标签）是跨页拆分点
     [data-head]          拆分后续页部分会移除的“头部”
     data-sid / data-iid  点击预览时定位到编辑器对应栏目/条目
   ============================================= */
(function () {
  'use strict';

  const RB = window.RB;
  const { esc, str, color } = RB.util;
  const schema = RB.schema;
  const md = RB.md;

  const registry = new Map();
  const templates = (RB.templates = {
    register(tpl) { registry.set(tpl.id, tpl); },
    get(id) { return registry.get(id) || registry.get('classic'); },
    all() { return Array.from(registry.values()); },
    ids() { return Array.from(registry.keys()); }
  });

  templates.FONTS = {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif',
    serif: 'Georgia, "Times New Roman", "Songti SC", STSong, "Noto Serif SC", "Source Han Serif SC", SimSun, serif'
  };

  /* ---------- 上下文 ---------- */
  templates.resolveStyle = function (resume, tpl, override) {
    tpl = tpl || templates.get(resume.style.template);
    const s = Object.assign({}, resume.style, override || {});
    const d = tpl.defaults;
    const pick = k => (s[k] === null || s[k] === undefined ? d[k] : s[k]);
    return {
      fs: pick('fs'), lh: pick('lh'), sp: pick('sp'), px: pick('px'), py: pick('py'),
      font: pick('font'), photo: pick('photo'), icons: pick('icons'),
      showPhoto: s.showPhoto !== false,
      palette: color.palette(s.color)
    };
  };

  templates.columnOf = function (sec, tpl) {
    if (!tpl.twoColumn) return 'main';
    if (sec.column === 'main' || sec.column === 'side') return sec.column;
    return tpl.autoSide && tpl.autoSide(sec) ? 'side' : 'main';
  };

  function resolveInfo(item) {
    const def = schema.INFO_TYPES[item.type] || schema.INFO_TYPES.custom;
    const value = str(item.value).trim();
    return {
      id: item.id, type: item.type, icon: def.icon, value,
      label: def.showLabel ? str(item.label).trim() : '',
      href: def.href ? def.href(value) : null
    };
  }

  templates.context = function (resume, override) {
    const tpl = templates.get(resume.style.template);
    const style = templates.resolveStyle(resume, tpl, override);
    const b = resume.basics;
    const sections = resume.sections.filter(schema.sectionHasContent).map(sec => ({ sec, column: templates.columnOf(sec, tpl) }));
    const info = b.info.filter(i => str(i.value).trim()).map(resolveInfo);
    const ctx = {
      resume, tpl, style, sections, info,
      name: str(b.name).trim(),
      headline: str(b.headline).trim(),
      avatar: style.showPhoto && b.avatar ? b.avatar : ''
    };
    ctx.empty = !ctx.name && !ctx.headline && !info.length && !sections.length;
    return ctx;
  };

  /** 应用到 .rb-doc 上的类名与 CSS 变量 */
  templates.applyDoc = function (docEl, ctx) {
    const st = ctx.style;
    const p = st.palette;
    docEl.className = ['rb-doc', 'tpl-' + ctx.tpl.id, 'photo-' + st.photo, st.icons ? 'has-icons' : 'no-icons'].join(' ');
    const vars = {
      '--c': p.c, '--c-dark': p.dark, '--c-ink': p.ink, '--c-soft': p.soft, '--c-line': p.line,
      '--fs': st.fs + 'pt', '--lh': String(st.lh), '--sp': String(st.sp),
      '--px': st.px + 'mm', '--py': st.py + 'mm', '--font': templates.FONTS[st.font] || templates.FONTS.sans
    };
    Object.keys(vars).forEach(k => docEl.style.setProperty(k, vars[k]));
  };

  /* =============================================
     公共块构建
     ============================================= */
  const H = (templates.helpers = {});
  const attrs = (sid, iid) => `data-sid="${esc(sid)}"${iid ? ` data-iid="${esc(iid)}"` : ''}`;

  H.icon = name => RB.icon(name, 'r-ico');

  H.value = (text, href) => (href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text));

  H.info = function (i) {
    return `<span class="r-info r-info-${esc(i.type)}">${H.icon(i.icon)}${i.label ? `<span class="r-info-label">${esc(i.label)}：</span>` : ''}<span class="r-info-val">${H.value(i.value, i.href)}</span></span>`;
  };

  H.contact = (ctx, cls) => (ctx.info.length ? `<div class="r-contact${cls ? ' ' + cls : ''}">${ctx.info.map(H.info).join('')}</div>` : '');

  H.photo = ctx => (ctx.avatar ? `<img class="r-photo" src="${esc(ctx.avatar)}" alt="">` : '');

  H.name = ctx => (ctx.name ? `<div class="r-name">${esc(ctx.name)}</div>` : '');
  H.headline = ctx => (ctx.headline ? `<div class="r-headline">${esc(ctx.headline)}</div>` : '');

  H.date = function (item, sep) {
    const start = str(item.start).trim();
    const end = str(item.end).trim();
    if (start && end) return esc(start) + esc(sep) + esc(end);
    return esc(start || end);
  };

  H.secTitle = (sec, label) => `<div class="blk r-sec" data-keep="next" ${attrs(sec ? sec.id : 'basics')}><span class="r-sec-t">${esc(label || sec.title)}</span></div>`;

  H.entry = function (sec, item, o) {
    const f = sec.fields;
    const title = str(item.title).trim();
    const sub = f.subtitle ? str(item.subtitle).trim() : '';
    const loc = f.location ? str(item.location).trim() : '';
    const date = f.date ? H.date(item, o.dateSep) : '';
    const desc = f.description ? str(item.description).trim() : '';
    const cls = ['blk', 'r-entry', o.first ? 'is-first' : '', o.last ? 'is-last' : '', desc ? 'has-desc' : 'no-desc'].filter(Boolean).join(' ');
    let head = '<div class="r-entry-main">';
    if (title) head += `<span class="r-entry-title">${esc(title)}</span>`;
    if (sub) head += ` <span class="r-entry-sub">${esc(sub)}</span>`;
    head += '</div>';
    if (loc || date) {
      head += '<div class="r-entry-meta">';
      if (loc) head += `<span class="r-entry-loc">${esc(loc)}</span>`;
      if (date) head += `<span class="r-entry-date">${date}</span>`;
      head += '</div>';
    }
    return `<div class="${cls}" ${attrs(sec.id, item.id)}><div class="r-entry-head" data-head>${head}</div>${desc ? `<div class="r-desc" data-split>${md(desc)}</div>` : ''}</div>`;
  };

  H.text = sec => `<div class="blk r-text" ${attrs(sec.id)}><div class="r-desc" data-split>${md(sec.content)}</div></div>`;

  H.tags = function (sec, item) {
    const name = str(item.name).trim();
    const words = schema.splitKeywords(item.keywords);
    const list = words.map(w => `<span class="r-tag">${md.inline(w)}</span>`).join(' ');
    return `<div class="blk r-tags${name ? '' : ' is-plain'}" ${attrs(sec.id, item.id)}>${name ? `<span class="r-tags-name">${esc(name)}</span>` : ''}${list ? `<span class="r-tags-list" data-split>${list}</span>` : ''}</div>`;
  };

  H.list = function (sec, mode) {
    const items = sec.items.filter(it => schema.itemHasContent('list', it));
    if (mode === 'tags') {
      return `<div class="blk r-list is-tags" ${attrs(sec.id)}><div class="r-taglist" data-split>${items.map(it => `<span class="r-tag">${md.inline(str(it.text).trim())}</span>`).join('')}</div></div>`;
    }
    return `<div class="blk r-list" ${attrs(sec.id)}><ul class="r-bullets" data-split>${items.map(it => `<li>${md.inline(str(it.text).trim())}</li>`).join('')}</ul></div>`;
  };

  /** 把一个栏目展开为块数组（标题 + 内容块） */
  H.section = function (sec, o) {
    o = Object.assign({ dateSep: ' - ', listStyle: 'bullets' }, o);
    const blocks = [H.secTitle(sec)];
    if (sec.kind === 'text') {
      blocks.push(H.text(sec));
    } else if (sec.kind === 'entries') {
      const items = sec.items.filter(it => schema.itemHasContent('entries', it));
      items.forEach((it, i) => blocks.push(H.entry(sec, it, { dateSep: o.dateSep, first: i === 0, last: i === items.length - 1 })));
    } else if (sec.kind === 'tags') {
      sec.items.filter(it => schema.itemHasContent('tags', it)).forEach(it => blocks.push(H.tags(sec, it)));
    } else if (sec.kind === 'list') {
      blocks.push(H.list(sec, o.listStyle));
    }
    return blocks;
  };

  H.empty = () => '<div class="blk r-empty"><div class="r-empty-t">在左侧填写内容</div><div class="r-empty-d">简历预览会在这里实时更新</div></div>';

  /** 单栏模板通用 flows：页眉块 + 所有栏目 */
  function singleFlow(header, opts) {
    return function (ctx) {
      const main = [];
      if (ctx.empty) return { main: [H.empty()] };
      const head = header(ctx);
      if (head) main.push(head);
      ctx.sections.forEach(({ sec }) => main.push(...H.section(sec, opts)));
      return { main };
    };
  }

  const singlePage = () => '<div class="rb-page"><div class="rb-col" data-col="main"></div></div>';
  const isShortKind = sec => sec.kind === 'tags' || sec.kind === 'list';

  /* =============================================
     1. 经典（保留原版风格）
     ============================================= */
  templates.register({
    id: 'classic',
    name: '经典',
    desc: '纵向排版，照片居右，稳重通用',
    defaults: { fs: 11, lh: 1, sp: 1, px: 8.5, py: 8, font: 'sans', photo: 'rect', icons: true },
    columns: ['main'],
    page: singlePage,
    flows: singleFlow(ctx => {
      const photo = H.photo(ctx);
      return `<div class="blk r-head" data-sid="basics"><div class="r-head-info">${H.name(ctx)}${H.headline(ctx)}${H.contact(ctx)}</div>${photo ? `<div class="r-photo-wrap">${photo}</div>` : ''}</div>`;
    }, { dateSep: ' - ', listStyle: 'tags' })
  });

  /* =============================================
     2. 现代：深色侧栏 + 主栏
     ============================================= */
  templates.register({
    id: 'modern',
    name: '现代',
    desc: '深色侧栏承载联系方式与技能',
    defaults: { fs: 10.5, lh: 1, sp: 1, px: 9, py: 11, font: 'sans', photo: 'circle', icons: true },
    twoColumn: true,
    columns: ['main', 'side'],
    autoSide: isShortKind,
    page: () => '<div class="rb-page"><aside class="rb-col pg-side" data-col="side"></aside><div class="rb-col pg-main" data-col="main"></div></div>',
    flows(ctx) {
      if (ctx.empty) return { main: [H.empty()], side: [] };
      const opts = { dateSep: ' - ', listStyle: 'bullets' };
      const side = [];
      const main = [];
      if (ctx.avatar) side.push(`<div class="blk r-side-photo" data-sid="basics">${H.photo(ctx)}</div>`);
      if (ctx.info.length) {
        side.push(H.secTitle(null, '联系方式'));
        side.push(`<div class="blk r-side-info" data-sid="basics" data-split>${ctx.info.map(i => `<div class="r-info-row">${H.info(i)}</div>`).join('')}</div>`);
      }
      if (ctx.name || ctx.headline) main.push(`<div class="blk r-head" data-sid="basics">${H.name(ctx)}${H.headline(ctx)}</div>`);
      ctx.sections.forEach(({ sec, column }) => (column === 'side' ? side : main).push(...H.section(sec, opts)));
      return { main, side };
    }
  });

  /* =============================================
     3. 简约：标题居左栏，大量留白
     ============================================= */
  templates.register({
    id: 'minimal',
    name: '简约',
    desc: '标题置于左栏，留白充足，适合技术岗',
    defaults: { fs: 10.5, lh: 1, sp: 1, px: 14, py: 13, font: 'sans', photo: 'rounded', icons: false },
    columns: ['main'],
    page: singlePage,
    flows: singleFlow(ctx => {
      const photo = H.photo(ctx);
      return `<div class="blk r-head${photo ? ' has-photo' : ''}" data-sid="basics"><div class="r-head-info">${H.name(ctx)}${H.headline(ctx)}${H.contact(ctx)}</div>${photo}</div>`;
    }, { dateSep: ' – ', listStyle: 'bullets' })
  });

  /* =============================================
     4. 商务：通栏色带页眉 + 标签式栏目标题
     ============================================= */
  templates.register({
    id: 'business',
    name: '商务',
    desc: '通栏色带页眉，栏目标签醒目',
    defaults: { fs: 10.5, lh: 1, sp: 1, px: 11, py: 9, font: 'sans', photo: 'rect', icons: true },
    columns: ['main'],
    page(i, ctx) {
      let band = '';
      if (i === 0 && !ctx.empty) {
        const photo = H.photo(ctx);
        band = `<header class="pg-band" data-sid="basics"><div class="r-band-info">${H.name(ctx)}${H.headline(ctx)}${H.contact(ctx)}</div>${photo ? `<div class="r-photo-wrap">${photo}</div>` : ''}</header>`;
      }
      return `<div class="rb-page">${band}<div class="rb-col" data-col="main"></div></div>`;
    },
    flows: singleFlow(() => '', { dateSep: ' - ', listStyle: 'bullets' })
  });

  /* =============================================
     5. 时间轴：左侧彩条 + 经历时间线
     ============================================= */
  templates.register({
    id: 'timeline',
    name: '时间轴',
    desc: '彩色竖条与时间线，富有设计感',
    defaults: { fs: 10.5, lh: 1, sp: 1, px: 12, py: 11, font: 'sans', photo: 'rounded', icons: false },
    columns: ['main'],
    page: () => '<div class="rb-page"><i class="pg-stripe"></i><div class="rb-col" data-col="main"></div></div>',
    flows: singleFlow(ctx => {
      const photo = H.photo(ctx);
      return `<div class="blk r-head${photo ? ' has-photo' : ''}" data-sid="basics">${H.name(ctx)}<i class="r-name-bar"></i>${H.headline(ctx)}${H.contact(ctx)}${photo}</div>`;
    }, { dateSep: ' – ', listStyle: 'bullets' })
  });

  /* =============================================
     6. 雅致：衬线字体，居中对称
     ============================================= */
  templates.register({
    id: 'elegant',
    name: '雅致',
    desc: '衬线字体，居中对称，沉稳典雅',
    defaults: { fs: 10.5, lh: 1, sp: 1, px: 16, py: 14, font: 'serif', photo: 'rect', icons: false },
    columns: ['main'],
    page: singlePage,
    flows: singleFlow(ctx => {
      const photo = H.photo(ctx);
      return `<div class="blk r-head${photo ? ' has-photo' : ''}" data-sid="basics">${H.name(ctx)}${H.headline(ctx)}${H.contact(ctx)}${photo}</div>`;
    }, { dateSep: ' — ', listStyle: 'bullets' })
  });

  /* =============================================
     7. 清新：通栏页眉 + 浅色右侧栏
     ============================================= */
  templates.register({
    id: 'fresh',
    name: '清新',
    desc: '通栏页眉配浅色侧栏，轻盈明快',
    defaults: { fs: 10.5, lh: 1, sp: 1, px: 10, py: 10, font: 'sans', photo: 'circle', icons: true },
    twoColumn: true,
    columns: ['main', 'side'],
    autoSide: isShortKind,
    page(i, ctx) {
      let head = '';
      if (i === 0 && !ctx.empty) {
        const photo = H.photo(ctx);
        head = `<header class="pg-head" data-sid="basics">${photo}<div class="r-head-info">${H.name(ctx)}${H.headline(ctx)}${H.contact(ctx)}</div></header>`;
      }
      return `<div class="rb-page">${head}<div class="pg-cols"><div class="rb-col pg-main" data-col="main"></div><aside class="rb-col pg-side" data-col="side"></aside></div></div>`;
    },
    flows(ctx) {
      if (ctx.empty) return { main: [H.empty()], side: [] };
      const opts = { dateSep: ' – ', listStyle: 'bullets' };
      const main = [];
      const side = [];
      ctx.sections.forEach(({ sec, column }) => (column === 'side' ? side : main).push(...H.section(sec, opts)));
      return { main, side };
    }
  });

  /* =============================================
     8. 杂志：超大姓名 + 编号标题 + 左栏日期
     ============================================= */
  templates.register({
    id: 'editorial',
    name: '杂志',
    desc: '超大姓名、编号标题，杂志版式',
    defaults: { fs: 10.5, lh: 1, sp: 1, px: 14, py: 13, font: 'sans', photo: 'rect', icons: false },
    columns: ['main'],
    page(i, ctx) {
      const foot = ctx.name && !ctx.empty
        ? `<div class="pg-foot"><span>${esc(ctx.name)}${ctx.headline ? ' · ' + esc(ctx.headline) : ''}</span><span>${String(i + 1).padStart(2, '0')}</span></div>`
        : '';
      return `<div class="rb-page"><div class="rb-col" data-col="main"></div>${foot}</div>`;
    },
    flows: singleFlow(ctx => {
      const photo = H.photo(ctx);
      return `<div class="blk r-head${photo ? ' has-photo' : ''}" data-sid="basics">
        <div class="r-head-main">${H.name(ctx)}${H.headline(ctx)}</div>
        ${ctx.info.length ? `<div class="r-head-side">${H.contact(ctx)}</div>` : ''}
        ${photo ? `<div class="r-photo-wrap">${photo}</div>` : ''}
      </div>`;
    }, { dateSep: ' —\n', listStyle: 'bullets' })
  });

  /* =============================================
     9. 东方：竖排姓名色条 + 印章式标题
     ============================================= */
  templates.register({
    id: 'oriental',
    name: '东方',
    desc: '竖排姓名与印章标题，东方韵味',
    defaults: { fs: 10.5, lh: 1, sp: 1, px: 11, py: 12, font: 'sans', photo: 'rect', icons: true },
    columns: ['main'],
    page(i, ctx) {
      let strip = '';
      if (i === 0 && !ctx.empty) {
        const photo = H.photo(ctx);
        const seal = ctx.name ? Array.from(ctx.name)[0] : '';
        strip = `<aside class="pg-strip" data-sid="basics">
          ${photo ? `<div class="r-photo-wrap">${photo}</div>` : ''}
          ${ctx.name ? `<div class="r-vname">${esc(ctx.name)}</div>` : ''}
          ${ctx.headline ? `<div class="r-vheadline">${esc(ctx.headline)}</div>` : ''}
          ${seal ? `<div class="r-seal">${esc(seal)}</div>` : ''}
        </aside>`;
      } else {
        strip = `<aside class="pg-strip">${ctx.name && !ctx.empty ? `<div class="r-vname is-small">${esc(ctx.name)}</div>` : ''}</aside>`;
      }
      return `<div class="rb-page">${strip}<div class="rb-col" data-col="main"></div></div>`;
    },
    flows: singleFlow(ctx => (ctx.info.length ? `<div class="blk r-head" data-sid="basics">${H.contact(ctx)}</div>` : ''),
      { dateSep: ' – ', listStyle: 'bullets' })
  });
})();
