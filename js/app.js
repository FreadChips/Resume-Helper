/* =============================================
   简历助手 · 应用入口
   顶栏、导入导出、多简历管理、快捷键、打印、移动端视图
   ============================================= */
(function () {
  'use strict';

  const RB = window.RB;
  const util = RB.util;
  const { $, $$, esc, el } = util;
  const store = RB.store;
  const schema = RB.schema;
  const ui = RB.ui;
  const icon = RB.icon;

  const app = (RB.app = {});
  const originalTitle = document.title;

  /* ---------- 启动 ---------- */
  function boot() {
    $$('[data-icon]').forEach(n => { n.innerHTML = icon(n.dataset.icon); });
    store.init();
    RB.preview.init();
    RB.editor.init();
    RB.design.init();
    initTopbar();
    initTabs();
    initMobile();
    initSplitter();
    initShortcuts();
    initPrint();

    store.on(onStoreEvent);
    renderAll();
    updateHistoryButtons();
    updateSaveState();

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => RB.preview.render());
    if (store.legacyMigrated) ui.toast('已自动导入旧版本中保存的简历', { type: 'success', duration: 4000 });
    document.body.classList.add('is-ready');
  }

  function renderAll() {
    RB.editor.render();
    RB.design.render();
    RB.preview.render();
    app.updateTitle();
  }

  function onStoreEvent(type) {
    if (type === 'content' || type === 'style') { RB.preview.schedule(); app.updateTitle(); }
    else if (type === 'structure') { RB.editor.render(); RB.preview.schedule(); app.updateTitle(); }
    else if (type === 'replace') { renderAll(); }
    else if (type === 'meta') { app.updateTitle(); }
    else if (type === 'history') updateHistoryButtons();
    else if (type === 'status') updateSaveState();
  }

  app.updateTitle = function () {
    $('#doc-title').textContent = schema.displayTitle(store.doc);
  };

  function updateHistoryButtons() {
    $('#btn-undo').disabled = !store.canUndo();
    $('#btn-redo').disabled = !store.canRedo();
  }

  function updateSaveState() {
    const node = $('#save-state');
    node.className = 'save-state is-' + store.status;
    if (store.status === 'error') {
      node.innerHTML = `${icon('info')}<span>保存失败</span>`;
      node.title = store.statusMessage;
    } else if (store.status === 'dirty') {
      node.innerHTML = '<span>保存中…</span>';
      node.title = '';
    } else {
      node.innerHTML = `${icon('check')}<span>已保存</span>`;
      node.title = '已自动保存到本机浏览器';
    }
  }

  /* ---------- 顶栏 ---------- */
  function initTopbar() {
    $('#btn-undo').addEventListener('click', () => store.undo());
    $('#btn-redo').addEventListener('click', () => store.redo());
    $('#btn-pdf').addEventListener('click', () => app.exportPDF());
    $('#m-pdf').addEventListener('click', () => app.exportPDF());
    $('#doc-switch').addEventListener('click', () => app.openManager());
    $('#save-state').addEventListener('click', () => { if (store.status === 'error') ui.toast(store.statusMessage, { type: 'error' }); });

    $('#btn-export').addEventListener('click', e => ui.menu(e.currentTarget, [
      { label: '下载 PDF', icon: 'printer', hint: 'Ctrl+P', onClick: () => app.exportPDF() },
      { label: '导出网页（HTML）', icon: 'code', onClick: () => app.exportHTML() },
      { divider: true },
      { label: '备份数据（JSON）', icon: 'download', onClick: () => app.exportJSON() }
    ], { align: 'end' }));

    $('#btn-more').addEventListener('click', e => ui.menu(e.currentTarget, [
      { label: '我的简历…', icon: 'files', onClick: () => app.openManager() },
      { label: '新建空白简历', icon: 'plus', onClick: () => newResume('blank') },
      { label: '从示例新建', icon: 'file', onClick: () => newResume('sample') },
      { divider: true },
      { label: '导入数据…', icon: 'upload', hint: 'JSON / HTML', onClick: () => $('#file-import').click() },
      { label: '清空当前内容', icon: 'trash', danger: true, onClick: () => clearCurrent() },
      { divider: true },
      { label: '使用帮助', icon: 'info', onClick: () => showHelp() }
    ], { align: 'end' }));

    $('#file-import').addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const text = await util.readFile(file, 'text');
        const doc = schema.parseImport(text);
        doc.meta.sample = false;
        store.create(doc);
        ui.toast(`已导入「${schema.displayTitle(doc)}」为新简历`, { type: 'success' });
      } catch (err) {
        ui.toast('导入失败：' + (err.message || '文件格式不正确'), { type: 'error' });
      }
    });
  }

  function newResume(kind) {
    store.create(kind === 'sample' ? schema.sampleResume() : schema.blankResume());
    app.setTab('content');
    ui.toast(kind === 'sample' ? '已从示例新建简历' : '已新建空白简历', { type: 'success' });
    if (kind === 'blank') setTimeout(() => { const n = $('#f-name'); if (n) n.focus(); }, 50);
  }

  async function clearCurrent() {
    const ok = await ui.confirm('当前简历的所有内容将被清空为空白模板。可以通过「撤销」恢复。', { title: '清空当前内容', okText: '清空', danger: true });
    if (!ok) return;
    const blank = schema.blankResume();
    store.update(d => { d.basics = blank.basics; d.sections = blank.sections; d.meta.sample = false; }, { type: 'structure' });
    ui.toast('已清空', { action: { label: '撤销', onClick: () => store.undo() } });
  }

  /* ---------- 多简历管理 ---------- */
  app.openManager = function () {
    const body = el('<div class="doc-manager"></div>');
    const renderList = () => {
      body.innerHTML = `<div class="doc-list">${store.list().map(e => `
        <div class="doc-row${e.id === store.doc.id ? ' is-current' : ''}" data-id="${esc(e.id)}">
          <button type="button" class="doc-row-main" data-act="open">
            <span class="doc-row-ico">${icon('file')}</span>
            <span class="doc-row-text"><span class="doc-row-title">${esc(e.title)}</span><span class="doc-row-meta">${e.id === store.doc.id ? '正在编辑 · ' : ''}更新于 ${esc(util.formatTime(e.updatedAt))}</span></span>
          </button>
          <div class="doc-row-actions">
            <button type="button" class="icon-btn sm" data-act="rename" title="重命名">${icon('edit')}</button>
            <button type="button" class="icon-btn sm" data-act="duplicate" title="复制">${icon('copy')}</button>
            <button type="button" class="icon-btn sm danger" data-act="delete" title="删除">${icon('trash')}</button>
          </div>
        </div>`).join('')}</div>
        <p class="ds-hint">可为不同岗位分别保存一份简历。数据仅保存在本机浏览器中。</p>`;
    };
    renderList();
    const modal = ui.modal({
      title: '我的简历',
      width: 520,
      body,
      actions: [
        { label: '从示例新建', align: 'start', onClick: () => { newResume('sample'); } },
        { label: '新建空白简历', kind: 'primary', onClick: () => { newResume('blank'); } }
      ]
    });
    body.addEventListener('click', async e => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const id = btn.closest('[data-id]').dataset.id;
      const entry = store.index.find(x => x.id === id);
      const act = btn.dataset.act;
      if (act === 'open') { store.open(id); modal.close(); }
      else if (act === 'rename') {
        const name = await ui.prompt('重命名简历', entry.title, { placeholder: '如：字节跳动-前端岗' });
        if (name) { store.rename(id, name); renderList(); }
      } else if (act === 'duplicate') { store.duplicate(id); renderList(); ui.toast('已复制并切换到副本', { type: 'success' }); }
      else if (act === 'delete') {
        const ok = await ui.confirm(`确定永久删除「${entry.title}」吗？此操作无法撤销。`, { title: '删除简历', okText: '删除', danger: true });
        if (ok) { store.remove(id); renderList(); ui.toast('已删除'); }
      }
    });
  };

  /* ---------- 导出 ---------- */
  function exportName() {
    const b = store.doc.basics;
    const parts = [b.name, b.headline].map(s => util.str(s).trim()).filter(Boolean);
    return util.sanitizeFilename(parts.length ? parts.join('-') + '-简历' : schema.displayTitle(store.doc));
  }

  app.exportPDF = function () {
    const go = () => {
      preparePrint();
      document.title = exportName();
      window.print();
    };
    if (store.pref('pdfTipSeen', false)) { go(); return; }
    ui.modal({
      title: '下载 PDF',
      width: 460,
      body: `<ol class="tip-list">
        <li>在打开的打印窗口中，将「目标打印机」选为 <strong>另存为 PDF</strong>。</li>
        <li>纸张选择 <strong>A4</strong>，边距选择 <strong>无</strong> 或 <strong>默认</strong>。</li>
        <li>在「更多设置」中勾选 <strong>背景图形</strong>，并取消「页眉和页脚」。</li>
      </ol>
      <p class="ds-hint">推荐使用 Chrome / Edge 浏览器，效果与预览完全一致。</p>`,
      actions: [
        { label: '取消' },
        { label: '知道了，开始导出', kind: 'primary', onClick: () => { store.setPref('pdfTipSeen', true); setTimeout(go, 160); } }
      ]
    });
  };

  async function getResumeCSS() {
    const link = document.getElementById('resume-css');
    try {
      const res = await fetch(link.href, { cache: 'no-cache' });
      if (res.ok) return await res.text();
    } catch (e) { /* file:// 下 fetch 不可用，退回读取样式表规则 */ }
    try {
      return Array.from(link.sheet.cssRules).map(r => r.cssText).join('\n');
    } catch (e) {
      throw new Error('无法读取样式文件，请通过网页服务（如 npm run dev）打开本工具后再导出');
    }
  }

  app.exportHTML = async function () {
    try {
      const css = await getResumeCSS();
      const doc = RB.preview.cloneDoc();
      const data = JSON.stringify(store.doc).replace(/</g, '\\u003c');
      const title = esc(exportName());
      const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
${css}
html { background: #eef0f3; }
body { margin: 0; padding: 32px 0; display: flex; justify-content: center; }
.rb-doc { gap: 28px; }
.rb-print { position: fixed; right: 24px; bottom: 24px; padding: 10px 18px; border: 0; border-radius: 999px; background: #111827; color: #fff; font: 600 14px/1 system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; box-shadow: 0 6px 20px rgba(0,0,0,.2); cursor: pointer; }
@media print { html, body { background: #fff; padding: 0; } .rb-doc { gap: 0; } .rb-print { display: none; } }
</style>
</head>
<body>
${doc.outerHTML}
<button class="rb-print" type="button" onclick="window.print()">打印 / 另存为 PDF</button>
<script>(function(){var d=document.querySelector('.rb-doc');function fit(){var w=window.innerWidth;d.style.zoom=w<840?String((w-16)/794):'';}fit();window.addEventListener('resize',fit);})();<\/script>
<script type="application/json" id="rb-data">${data}<\/script>
</body>
</html>`;
      util.download(html, exportName() + '.html', 'text/html');
      ui.toast('已导出网页文件，可直接发送或再次导入', { type: 'success' });
    } catch (err) {
      ui.toast(err.message || '导出失败', { type: 'error', duration: 6000 });
    }
  };

  app.exportJSON = function () {
    store.flush();
    const backup = { app: 'resume-builder', version: 2, exportedAt: new Date().toISOString(), resume: store.doc };
    util.download(JSON.stringify(backup, null, 2), exportName() + '-备份.json', 'application/json');
    ui.toast('已下载备份文件', { type: 'success' });
  };

  /* ---------- 打印 ---------- */
  function preparePrint() {
    const rootEl = $('#print-root');
    rootEl.replaceChildren(RB.preview.cloneDoc());
  }

  function initPrint() {
    window.addEventListener('beforeprint', () => {
      preparePrint();
      if (document.title === originalTitle) document.title = exportName();
    });
    window.addEventListener('afterprint', () => {
      $('#print-root').textContent = '';
      document.title = originalTitle;
    });
  }

  /* ---------- 面板标签页 ---------- */
  function initTabs() {
    $$('.panel-tab').forEach(tab => tab.addEventListener('click', () => app.setTab(tab.dataset.tab)));
    app.setTab(store.pref('tab', 'content'));
  }

  app.setTab = function (name) {
    $$('.panel-tab').forEach(t => {
      const on = t.dataset.tab === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
    });
    $('#panel-content').hidden = name !== 'content';
    $('#panel-design').hidden = name !== 'design';
    store.setPref('tab', name);
    if (name === 'content') requestAnimationFrame(() => RB.editor.autosizeAll());
  };

  /* ---------- 移动端：编辑 / 预览切换 ---------- */
  function initMobile() {
    $$('.mobile-nav [data-view]').forEach(btn => btn.addEventListener('click', () => app.setView(btn.dataset.view)));
    app.setView('editor');
  }

  app.setView = function (view) {
    document.body.dataset.view = view;
    $$('.mobile-nav [data-view]').forEach(b => b.classList.toggle('is-active', b.dataset.view === view));
    if (view === 'preview') requestAnimationFrame(() => RB.preview.applyScale());
  };

  /* ---------- 可拖动的分隔条 ---------- */
  function initSplitter() {
    const ws = $('#workspace');
    const bar = $('#splitter');
    const apply = w => ws.style.setProperty('--panel-w', w + 'px');
    const saved = store.pref('panelWidth', 0);
    if (saved) apply(saved);
    bar.addEventListener('pointerdown', e => {
      e.preventDefault();
      bar.setPointerCapture(e.pointerId);
      document.body.classList.add('is-resizing');
      const left = ws.getBoundingClientRect().left;
      const move = ev => apply(util.clamp(ev.clientX - left, 340, Math.min(760, window.innerWidth - 420)));
      const up = () => {
        bar.removeEventListener('pointermove', move);
        document.body.classList.remove('is-resizing');
        store.setPref('panelWidth', parseInt(getComputedStyle(ws).getPropertyValue('--panel-w'), 10) || 0);
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up, { once: true });
      bar.addEventListener('pointercancel', up, { once: true });
    });
    bar.addEventListener('dblclick', () => { ws.style.removeProperty('--panel-w'); store.setPref('panelWidth', 0); });
  }

  /* ---------- 快捷键 ---------- */
  function initShortcuts() {
    document.addEventListener('keydown', e => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.altKey) return;
      const key = e.key.toLowerCase();
      const inField = util.isTextField(document.activeElement);
      if (key === 'z' && !inField) { e.preventDefault(); if (e.shiftKey) store.redo(); else store.undo(); }
      else if (key === 'y' && !inField) { e.preventDefault(); store.redo(); }
      else if (key === 's') { e.preventDefault(); store.saveNow(); ui.toast(store.status === 'error' ? store.statusMessage : '已保存到本机浏览器', { type: store.status === 'error' ? 'error' : 'success' }); }
      else if (key === 'p') { e.preventDefault(); app.exportPDF(); }
    });
  }

  function showHelp() {
    ui.modal({
      title: '使用帮助',
      width: 520,
      body: `<div class="help">
        <h4>编辑</h4>
        <ul>
          <li>点击右侧预览中的任意内容，左侧会自动定位到对应的编辑位置。</li>
          <li>按住条目左侧的 <span class="kbd">⋮⋮</span> 拖动即可排序；眼睛图标可临时隐藏而不删除。</li>
          <li>描述支持 <code>**加粗**</code>、<code>*斜体*</code>、<code>[文字](链接)</code>，以 <code>- </code> 开头的行会成为列表，回车自动续写。</li>
        </ul>
        <h4>排版</h4>
        <ul>
          <li>预览即最终效果，按真实 A4 分页；内容多时可用「智能一页」自动压缩。</li>
          <li>双栏模板（现代、清新）中，可在栏目菜单里指定放在主栏或侧栏。</li>
        </ul>
        <h4>快捷键</h4>
        <ul>
          <li><span class="kbd">Ctrl</span> + <span class="kbd">Z</span> / <span class="kbd">Ctrl</span> + <span class="kbd">Shift</span> + <span class="kbd">Z</span>：撤销 / 重做（输入框外）</li>
          <li><span class="kbd">Ctrl</span> + <span class="kbd">P</span>：下载 PDF　<span class="kbd">Ctrl</span> + <span class="kbd">S</span>：立即保存</li>
        </ul>
        <h4>数据</h4>
        <ul>
          <li>内容只保存在本机浏览器中，不会上传。清理浏览器数据前请先「导出 → 备份数据」。</li>
          <li>导出的 HTML 文件内含简历数据，可以再次「导入」继续编辑。</li>
        </ul>
      </div>`
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
