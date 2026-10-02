/* =============================================
   简历助手 · 模板与排版面板
   ============================================= */
(function () {
  'use strict';

  const RB = window.RB;
  const { $, $$, esc } = RB.util;
  const store = RB.store;
  const ui = RB.ui;
  const icon = RB.icon;
  const templates = RB.templates;

  const design = (RB.design = {});
  let root = null;

  const RANGES = [
    { key: 'fs', label: '字号', min: 8.5, max: 13, step: 0.25, fmt: v => v + 'pt' },
    { key: 'lh', label: '行距', min: 0.8, max: 1.5, step: 0.05, fmt: v => '×' + Number(v).toFixed(2) },
    { key: 'sp', label: '段落间距', min: 0.4, max: 1.8, step: 0.05, fmt: v => '×' + Number(v).toFixed(2) },
    { key: 'px', label: '左右页边距', min: 5, max: 25, step: 0.5, fmt: v => v + 'mm' },
    { key: 'py', label: '上下页边距', min: 5, max: 25, step: 0.5, fmt: v => v + 'mm' }
  ];

  /* ---------- 模板缩略图（SVG，颜色跟随主题色变量） ---------- */
  const R = (x, y, w, h, cls, rx) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx === undefined ? 1.5 : rx}" class="${cls || 'g'}"/>`;
  const lines = (x, y, widths, gap, cls) => widths.map((w, i) => R(x, y + i * (gap || 8), w, 3.2, cls || 'l')).join('');

  const THUMBS = {
    classic: () => R(14, 16, 64, 11, 'd') + R(14, 33, 46, 5, 'g') + R(14, 44, 120, 3.5, 'l') + R(166, 14, 30, 40, 'p', 2)
      + [66, 122, 178, 234].map(y => R(14, y, 34, 6, 'd') + R(14, y + 10, 182, 1.6, 'c', 0) + lines(14, y + 17, [176, 160, 120])).join(''),
    modern: () => R(0, 0, 66, 297, 'd', 0) + `<circle cx="33" cy="34" r="16" class="pw"/>` + lines(12, 64, [42, 36, 40], 8, 'lw')
      + R(12, 96, 30, 4, 'lw') + lines(12, 106, [40, 32, 38, 26], 8, 'lw')
      + R(80, 18, 70, 11, 'd') + R(80, 34, 48, 5, 'c')
      + [56, 116, 176, 232].map(y => R(80, y, 4, 7, 'c', 1) + R(88, y, 34, 7, 'd') + R(126, y + 3, 72, 1.4, 'l', 0) + lines(80, y + 14, [116, 104, 86])).join(''),
    minimal: () => R(16, 18, 66, 11, 'k') + R(16, 34, 44, 5, 'c') + R(16, 45, 110, 3.5, 'l')
      + [64, 120, 176, 232].map(y => R(16, y, 178, 1, 'l', 0) + R(16, y + 7, 26, 4, 'c') + lines(58, y + 7, [136, 120, 96])).join(''),
    business: () => `<rect x="0" y="0" width="210" height="62" class="band"/>` + R(16, 16, 60, 11, 'w') + R(16, 32, 40, 4.5, 'w2') + lines(16, 42, [60, 52], 7, 'w2') + R(168, 12, 28, 38, 'pw', 2)
      + [74, 130, 186, 242].map(y => `<polygon points="16,${y} 54,${y} 58,${y + 9} 16,${y + 9}" class="c"/>` + R(58, y + 8, 138, 1.2, 'c', 0) + lines(16, y + 16, [176, 162, 120])).join(''),
    timeline: () => R(0, 0, 6, 297, 'c', 0) + R(18, 16, 72, 13, 'd') + R(18, 34, 22, 3, 'c', 1.5) + R(18, 42, 44, 7, 'c', 3.5) + R(18, 54, 110, 3.5, 'l') + R(164, 14, 30, 30, 'p', 5)
      + [72, 136, 200].map(y => R(18, y, 3, 8, 'c', 1) + R(24, y, 40, 8, 'd') + R(23, y + 16, 1.2, 40, 's', 0)
        + `<circle cx="23.6" cy="${y + 18}" r="3" class="dot"/>` + lines(32, y + 16, [120, 150, 132]) + `<circle cx="23.6" cy="${y + 42}" r="3" class="dot"/>` + lines(32, y + 40, [110, 140])).join(''),
    elegant: () => R(70, 16, 70, 11, 'd') + R(80, 32, 50, 4.5, 'g') + R(50, 42, 110, 3.5, 'l') + R(16, 52, 178, 1, 'd', 0) + R(16, 54.5, 178, 0.8, 'd', 0)
      + [70, 126, 182, 238].map(y => R(16, y + 3, 62, 0.9, 's', 0) + R(86, y, 38, 6.5, 'd') + R(132, y + 3, 62, 0.9, 's', 0) + lines(16, y + 14, [178, 170, 140])).join(''),
    fresh: () => `<circle cx="32" cy="32" r="16" class="p"/>` + R(56, 18, 70, 11, 'd') + R(56, 34, 44, 5, 'c') + R(56, 45, 120, 3.5, 'l') + R(0, 58, 210, 3.5, 'c', 0)
      + R(140, 61.5, 70, 236, 's2', 0)
      + [74, 134, 194].map(y => `<circle cx="18" cy="${y + 3}" r="2.6" class="dot2"/>` + R(24, y, 40, 6.5, 'd') + lines(16, y + 14, [112, 104, 96, 80])).join('')
      + [74, 124, 174].map(y => `<circle cx="150" cy="${y + 3}" r="2.4" class="dot2"/>` + R(156, y, 30, 6, 'd') + lines(148, y + 13, [48, 40, 44])).join(''),
    editorial: () => R(16, 16, 82, 22, 'k', 1) + R(16, 45, 10, 1.8, 'c', 0) + R(30, 43.5, 46, 4.5, 'd')
      + R(124, 30, 34, 3, 'l') + R(130, 37, 28, 3, 'l') + R(126, 44, 32, 3, 'l')
      + R(171, 17, 23, 30, 'c', 0) + R(168, 14, 23, 30, 'p', 0) + R(16, 55, 178, 2.4, 'k', 0)
      + [68, 132, 196].map(y => R(16, y, 15, 9, 'c', 1) + R(42, y + 1.5, 32, 6.5, 'k') + R(80, y + 4.5, 114, 0.8, 'k', 0)
        + R(16, y + 16, 18, 3, 'l') + R(42, y + 16, 60, 4, 'k') + lines(42, y + 24, [146, 132, 140])
        + R(16, y + 44, 18, 3, 'l') + R(42, y + 44, 52, 4, 'k') + lines(42, y + 52, [140])).join('')
      + R(16, 284, 50, 2.2, 'l') + R(184, 284, 10, 2.2, 'l'),
    oriental: () => R(0, 0, 48, 297, 'd', 0) + R(3.5, 0, 0.6, 297, 'w3', 0) + R(44, 0, 0.6, 297, 'w3', 0)
      + R(12, 14, 24, 32, 'pw', 1) + R(19, 58, 10, 48, 'w', 2) + R(22, 112, 4, 40, 'w2', 1)
      + `<rect x="18" y="264" width="12" height="12" rx="1.5" class="ws"/>`
      + R(60, 16, 54, 3.5, 'l') + R(132, 16, 54, 3.5, 'l') + R(60, 24, 48, 3.5, 'l') + R(132, 24, 44, 3.5, 'l') + R(60, 34, 134, 0.8, 's', 0)
      + [48, 112, 176, 232].map(y => R(60, y, 7, 7, 'c', 1) + R(69, y + 1, 26, 5, 'd') + R(100, y + 3.2, 94, 0.8, 's', 0)
        + R(60, y + 14, 50, 4, 'k') + R(172, y + 14.5, 22, 3, 'l')
        + `<rect x="61" y="${y + 22}" width="2.4" height="2.4" class="c" transform="rotate(45 62.2 ${y + 23.2})"/>` + lines(67, y + 21.5, [118, 104])).join('')
  };

  function thumb(id) {
    const body = (THUMBS[id] || THUMBS.classic)();
    return `<svg class="tpl-svg" viewBox="0 0 210 297" aria-hidden="true">${body}</svg>`;
  }

  /* ---------- 渲染 ---------- */
  design.init = function () {
    root = document.getElementById('panel-design');
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
  };

  design.render = function () {
    if (!root) return;
    const doc = store.doc;
    const tpl = templates.get(doc.style.template);
    const st = templates.resolveStyle(doc, tpl);
    const pal = st.palette;
    const isPreset = RB.util.color.PRESETS.some(p => p.c === pal.c);
    const scroll = root.scrollTop;

    root.innerHTML = `
      <section class="ds">
        <h3 class="ds-title">模板</h3>
        <div class="tpl-grid" style="--tc:${pal.c};--tc-dark:${pal.dark};--tc-soft:${pal.soft};--tc-line:${pal.line}">
          ${templates.all().map(t => `
            <button type="button" class="tpl-card${t.id === tpl.id ? ' is-active' : ''}" data-act="template" data-id="${t.id}" aria-pressed="${t.id === tpl.id}">
              <span class="tpl-thumb">${thumb(t.id)}</span>
              <span class="tpl-name">${esc(t.name)}${t.id === 'classic' ? '<span class="tpl-badge">原版</span>' : ''}</span>
              <span class="tpl-desc">${esc(t.desc)}</span>
            </button>`).join('')}
        </div>
      </section>

      <section class="ds">
        <h3 class="ds-title">主题色</h3>
        <div class="swatches">
          ${RB.util.color.PRESETS.map(p => `<button type="button" class="swatch${p.c === pal.c ? ' is-active' : ''}" data-act="color" data-color="${p.c}" style="--sw:${p.c}" title="${esc(p.name)}" aria-label="${esc(p.name)}"></button>`).join('')}
          <label class="swatch swatch-custom${isPreset ? '' : ' is-active'}" title="自定义颜色" style="${isPreset ? '' : `--sw:${pal.c}`}">
            <input type="color" data-style="color" value="${pal.c}" aria-label="自定义颜色">
          </label>
        </div>
      </section>

      <section class="ds">
        <h3 class="ds-title">字体</h3>
        <div class="seg" role="group" aria-label="字体">
          ${segBtn('font', null, `模板默认（${tpl.defaults.font === 'serif' ? '宋体' : '黑体'}）`, doc.style.font === null)}
          ${segBtn('font', 'sans', '黑体', doc.style.font === 'sans')}
          ${segBtn('font', 'serif', '宋体', doc.style.font === 'serif')}
        </div>
      </section>

      <section class="ds">
        <h3 class="ds-title">排版<button type="button" class="link-btn" data-act="reset-style" ${RB.schema.STYLE_KEYS.some(k => doc.style[k] !== null) ? '' : 'disabled'}>${icon('reset')}恢复模板默认</button></h3>
        ${RANGES.map(r => {
          const value = st[r.key];
          const custom = doc.style[r.key] !== null;
          return `<div class="range-row${custom ? ' is-custom' : ''}">
            <label for="rg-${r.key}">${r.label}</label>
            <input type="range" id="rg-${r.key}" data-style="${r.key}" min="${r.min}" max="${r.max}" step="${r.step}" value="${value}">
            <output for="rg-${r.key}" data-out="${r.key}">${r.fmt(value)}</output>
          </div>`;
        }).join('')}
        <button type="button" class="btn btn-outline btn-block" data-act="fit-one">${icon('sparkles')}智能一页</button>
        <p class="ds-hint">自动微调字号、行距、间距与页边距，把内容收进一页 A4。</p>
      </section>

      <section class="ds">
        <h3 class="ds-title">照片</h3>
        <div class="ds-row">
          <label class="switch"><input type="checkbox" data-act="show-photo" ${doc.style.showPhoto !== false ? 'checked' : ''}><span class="switch-ui"></span><span>显示照片</span></label>
        </div>
        <div class="seg" role="group" aria-label="照片形状">
          ${segBtn('photo', null, '默认', doc.style.photo === null)}
          ${segBtn('photo', 'rect', '方形', doc.style.photo === 'rect')}
          ${segBtn('photo', 'rounded', '圆角', doc.style.photo === 'rounded')}
          ${segBtn('photo', 'circle', '圆形', doc.style.photo === 'circle')}
        </div>
        ${doc.basics.avatar ? '' : '<p class="ds-hint">尚未上传照片，可在「内容 → 基本信息」中上传。</p>'}
      </section>

      <section class="ds">
        <h3 class="ds-title">细节</h3>
        <label class="switch"><input type="checkbox" data-act="icons" ${st.icons ? 'checked' : ''}><span class="switch-ui"></span><span>联系方式显示图标</span></label>
      </section>`;
    root.scrollTop = scroll;
  };

  function segBtn(key, value, label, active) {
    return `<button type="button" class="seg-btn${active ? ' is-active' : ''}" data-act="seg" data-key="${key}" data-value="${value === null ? '' : value}" aria-pressed="${active}">${esc(label)}</button>`;
  }

  /* ---------- 事件 ---------- */
  function setStyle(patch, opts) {
    store.update(d => { Object.assign(d.style, patch); }, Object.assign({ type: 'style' }, opts));
  }

  function onClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'template') {
      if (btn.dataset.id === store.doc.style.template) return;
      setStyle({ template: btn.dataset.id });
      design.render();
    } else if (act === 'color') {
      setStyle({ color: btn.dataset.color });
      design.render();
    } else if (act === 'seg') {
      setStyle({ [btn.dataset.key]: btn.dataset.value || null });
      design.render();
    } else if (act === 'reset-style') {
      const patch = {};
      RB.schema.STYLE_KEYS.forEach(k => { patch[k] = null; });
      setStyle(patch);
      design.render();
      ui.toast('已恢复模板默认排版', { action: { label: '撤销', onClick: () => store.undo() } });
    } else if (act === 'fit-one') {
      design.fitOnePage();
    } else if (act === 'show-photo') {
      setStyle({ showPhoto: btn.checked });
    } else if (act === 'icons') {
      setStyle({ icons: btn.checked });
    }
  }

  function onInput(e) {
    const t = e.target;
    const key = t.dataset.style;
    if (!key) return;
    if (key === 'color') {
      const c = RB.util.color.normalize(t.value);
      if (!c) return;
      setStyle({ color: c }, { key: 'style.color' });
      const pal = RB.util.color.palette(c);
      const grid = $('.tpl-grid', root);
      grid.style.setProperty('--tc', pal.c);
      grid.style.setProperty('--tc-dark', pal.dark);
      grid.style.setProperty('--tc-soft', pal.soft);
      grid.style.setProperty('--tc-line', pal.line);
      $$('.swatch', root).forEach(s => s.classList.remove('is-active'));
      const custom = $('.swatch-custom', root);
      custom.classList.add('is-active');
      custom.style.setProperty('--sw', c);
      return;
    }
    const range = RANGES.find(r => r.key === key);
    const value = Number(t.value);
    setStyle({ [key]: value }, { key: 'style.' + key });
    const out = root.querySelector(`[data-out="${key}"]`);
    if (out) out.textContent = range.fmt(value);
    t.closest('.range-row').classList.add('is-custom');
    const reset = root.querySelector('[data-act="reset-style"]');
    if (reset) reset.disabled = false;
  }

  function onChange(e) {
    if (e.target.dataset.style) store.breakCoalesce();
  }

  design.fitOnePage = function () {
    RB.preview.flush();
    const result = RB.paginate.fitOnePage(store.doc);
    if (result.already) { ui.toast('当前内容已经在一页之内', { type: 'success' }); return; }
    if (!result.ok) {
      ui.toast('内容较多，压缩到最紧凑仍超过一页，建议精简部分描述', { type: 'error', duration: 5000 });
      return;
    }
    setStyle(result.values);
    design.render();
    ui.toast('已调整为一页', { type: 'success', action: { label: '撤销', onClick: () => store.undo() } });
  };
})();
