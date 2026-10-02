/* =============================================
   简历助手 · 内容编辑器
   ---------------------------------------------
   - 输入框通过 data-bind 直接写入数据，不重绘编辑器（不丢焦点）
   - 结构性操作（增删、排序、显隐）后整体重绘，自动恢复焦点与滚动位置
   - data-bind 语法：
       basics.<key>            info.<id>.<key>
       sec.<sid>.<key>         item.<sid>.<iid>.<key>
   ============================================= */
(function () {
  'use strict';

  const RB = window.RB;
  const { $, $$, esc, str, el } = RB.util;
  const store = RB.store;
  const schema = RB.schema;
  const ui = RB.ui;
  const icon = RB.icon;
  const md = RB.md;

  const editor = (RB.editor = {});
  let root = null;
  const openItems = new Set();
  let closedSecs = new Set();

  const PLACEHOLDERS = {
    summary: '用 2~4 句话概括你的工作年限、擅长领域和核心优势。',
    hobbies: '如：长跑（完成 3 次全程马拉松）、摄影、开源社区贡献。',
    evaluation: '如：责任心强，善于沟通协作，对新技术保持好奇心。',
    description: '- 负责……\n- 主导……，带来 **可量化的成果**',
    text: '在此输入内容，支持 **加粗**、以「- 」开头的列表。'
  };

  /* ---------- 渲染 ---------- */
  editor.init = function () {
    root = document.getElementById('panel-content');
    closedSecs = new Set(store.pref('closedSecs', []));
    root.addEventListener('input', onInput);
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeydown);
    root.addEventListener('focusout', e => { if (e.target.dataset && e.target.dataset.bind) store.breakCoalesce(); });
    root.addEventListener('mousedown', e => { if (e.target.closest('.md-btn')) e.preventDefault(); });
    root.addEventListener('dragover', onDragOver);
    root.addEventListener('dragleave', e => { const box = e.target.closest('.avatar-box'); if (box) box.classList.remove('is-drop'); });
    root.addEventListener('drop', onDrop);
    ui.sortable(root, { handle: '.grip', onMove: onSortMove });
    document.getElementById('file-avatar').addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (file) setAvatar(file);
    });
  };

  editor.render = function () {
    if (!root) return;
    const snap = captureFocus();
    const doc = store.doc;
    root.innerHTML = renderNotice(doc)
      + renderBasics(doc)
      + `<div class="sec-list" data-sort="sections">${doc.sections.map(renderSection).join('')}</div>`
      + `<button type="button" class="add-section" data-act="add-section">${icon('plus')}<span>添加栏目</span></button>`
      + '<p class="panel-foot">内容自动保存在本机浏览器中，换设备前请在右上角「导出」中备份数据。</p>';
    editor.autosizeAll();
    restoreFocus(snap);
  };

  editor.autosizeAll = function () { $$('textarea', root).forEach(ui.autosize); };

  function renderNotice(doc) {
    if (!doc.meta.sample) return '';
    return `<div class="notice">
      <div class="notice-text"><strong>这是一份示例简历</strong>，直接修改即可变成你的简历，也可以从空白开始。</div>
      <div class="notice-actions">
        <button type="button" class="btn btn-sm btn-primary" data-act="notice-blank">从空白开始</button>
        <button type="button" class="btn btn-sm btn-ghost" data-act="notice-dismiss">知道了</button>
      </div>
    </div>`;
  }

  function renderBasics(doc) {
    const b = doc.basics;
    const closed = closedSecs.has('basics');
    const avatar = b.avatar
      ? `<img src="${esc(b.avatar)}" alt="照片"><span class="avatar-overlay">${icon('image')}更换</span>`
      : `<span class="avatar-empty">${icon('image')}<span>上传照片</span></span>`;
    return `
    <section class="card card-basics${closed ? ' is-collapsed' : ''}" id="card-basics" data-sid="basics">
      <div class="card-head">
        <span class="card-icon">${icon('user')}</span>
        <span class="card-label">基本信息</span>
        <button type="button" class="icon-btn sm chev" data-act="toggle-sec" data-sid="basics" aria-expanded="${!closed}" title="展开/收起">${icon('chevronDown')}</button>
      </div>
      <div class="card-body">
        <div class="basics-top">
          <div class="avatar-col">
            <button type="button" class="avatar-box${b.avatar ? ' has-img' : ''}" data-act="avatar-pick" aria-label="上传照片">${avatar}</button>
            ${b.avatar ? `<div class="avatar-tools">
              <label class="check" title="在简历中显示照片"><input type="checkbox" data-act="toggle-photo" ${doc.style.showPhoto !== false ? 'checked' : ''}><span>显示</span></label>
              <button type="button" class="link-btn danger" data-act="avatar-remove">移除</button>
            </div>` : '<div class="avatar-hint">可拖入图片</div>'}
          </div>
          <div class="basics-fields">
            <div class="field"><label for="f-name">姓名</label><input class="input input-lg" id="f-name" data-bind="basics.name" value="${esc(b.name)}" placeholder="你的姓名" autocomplete="name"></div>
            <div class="field"><label for="f-headline">求职意向 / 职位</label><input class="input" id="f-headline" data-bind="basics.headline" value="${esc(b.headline)}" placeholder="如：高级前端开发工程师"></div>
          </div>
        </div>
        <div class="subhead">联系方式与个人信息</div>
        <div class="row-list" data-sort="info">${b.info.map(renderInfoRow).join('')}</div>
        <button type="button" class="add-row" data-act="add-info">${icon('plus')}添加信息</button>
      </div>
    </section>`;
  }

  function renderInfoRow(item) {
    const def = schema.INFO_TYPES[item.type] || schema.INFO_TYPES.custom;
    const typeName = def.custom ? '自定义' : def.label;
    return `<div class="row info-row" data-key="${esc(item.id)}">
      <span class="grip" title="拖动排序">${icon('grip')}</span>
      <button type="button" class="type-btn" data-act="info-type" data-id="${esc(item.id)}" title="类型：${esc(typeName)}（点击更换）" aria-label="更换类型，当前为${esc(typeName)}">${icon(def.icon)}</button>
      ${def.showLabel ? `<input class="input input-label" data-bind="info.${item.id}.label" value="${esc(item.label)}" placeholder="${def.custom ? '名称' : esc(def.label)}" aria-label="名称">` : ''}
      <input class="input" data-bind="info.${item.id}.value" value="${esc(item.value)}" placeholder="${esc(def.placeholder)}" aria-label="${esc(def.label || '内容')}">
      <button type="button" class="icon-btn sm row-del" data-act="info-del" data-id="${esc(item.id)}" title="删除">${icon('x')}</button>
    </div>`;
  }

  function itemCount(sec) {
    if (sec.kind === 'text') return 0;
    return sec.items.filter(it => schema.itemHasContent(sec.kind, Object.assign({}, it, { hidden: false }))).length;
  }

  function renderSection(sec) {
    const closed = closedSecs.has(sec.id);
    const count = itemCount(sec);
    let body = '';
    if (sec.kind === 'text') body = mdEditor(`sec.${sec.id}.content`, sec.content, placeholderFor(sec), 4);
    else if (sec.kind === 'entries') body = `<div class="entry-list" data-sort="items:${sec.id}">${sec.items.map(it => renderEntry(sec, it)).join('')}</div>
        <button type="button" class="add-row" data-act="add-item" data-sid="${sec.id}">${icon('plus')}添加一条</button>`;
    else if (sec.kind === 'tags') body = `<div class="row-list" data-sort="items:${sec.id}">${sec.items.map(it => renderTagRow(sec, it)).join('')}</div>
        <button type="button" class="add-row" data-act="add-item" data-sid="${sec.id}">${icon('plus')}添加分组</button>
        <p class="field-hint">分类可留空；关键词之间用逗号或顿号分隔，如「React, Vue、TypeScript」。</p>`;
    else if (sec.kind === 'list') body = `<div class="row-list" data-sort="items:${sec.id}">${sec.items.map(it => renderListRow(sec, it)).join('')}</div>
        <button type="button" class="add-row" data-act="add-item" data-sid="${sec.id}">${icon('plus')}添加一项</button>`;

    return `
    <section class="card sec-card${closed ? ' is-collapsed' : ''}${sec.hidden ? ' is-hidden' : ''}" id="card-${sec.id}" data-key="${sec.id}" data-sid="${sec.id}">
      <div class="card-head">
        <span class="grip" title="拖动排序">${icon('grip')}</span>
        <input class="card-title-input" data-bind="sec.${sec.id}.title" value="${esc(sec.title)}" placeholder="栏目名称" aria-label="栏目名称" spellcheck="false">
        ${sec.hidden ? '<span class="badge">已隐藏</span>' : closed && count ? `<span class="count">${count}</span>` : ''}
        <button type="button" class="icon-btn sm" data-act="sec-visible" data-sid="${sec.id}" title="${sec.hidden ? '在简历中显示' : '在简历中隐藏'}">${icon(sec.hidden ? 'eyeOff' : 'eye')}</button>
        <button type="button" class="icon-btn sm" data-act="sec-menu" data-sid="${sec.id}" title="更多操作" aria-haspopup="menu">${icon('more')}</button>
        <button type="button" class="icon-btn sm chev" data-act="toggle-sec" data-sid="${sec.id}" aria-expanded="${!closed}" title="展开/收起">${icon('chevronDown')}</button>
      </div>
      <div class="card-body">${body}</div>
    </section>`;
  }

  function placeholderFor(sec) {
    if (/简介|概述|总结/.test(sec.title)) return PLACEHOLDERS.summary;
    if (/爱好|兴趣/.test(sec.title)) return PLACEHOLDERS.hobbies;
    if (/评价/.test(sec.title)) return PLACEHOLDERS.evaluation;
    return PLACEHOLDERS.text;
  }

  function mdEditor(bind, value, placeholder, rows) {
    return `<div class="md-editor">
      <div class="md-tools">
        <button type="button" class="md-btn" data-act="md-bold" title="加粗（Ctrl+B）">${icon('bold')}</button>
        <button type="button" class="md-btn" data-act="md-list" title="切换列表">${icon('list')}</button>
        <button type="button" class="md-btn" data-act="md-link" title="插入链接">${icon('link')}</button>
        <span class="md-hint">回车自动续写列表</span>
      </div>
      <textarea class="textarea" data-bind="${bind}" data-md rows="${rows || 3}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>
    </div>`;
  }

  function entrySummary(sec, item) {
    const title = str(item.title).trim();
    const sub = sec.fields.subtitle ? str(item.subtitle).trim() : '';
    const date = sec.fields.date ? [str(item.start).trim(), str(item.end).trim()].filter(Boolean).join(' - ') : '';
    return {
      title: title ? esc(title) : `<span class="muted">未填写${esc(sec.labels.title)}</span>`,
      sub: esc([sub, date].filter(Boolean).join(' · ') || md.plain(item.description).slice(0, 40))
    };
  }

  function renderEntry(sec, item) {
    const open = openItems.has(item.id) || !schema.itemHasContent('entries', Object.assign({}, item, { hidden: false }));
    const s = entrySummary(sec, item);
    const f = sec.fields;
    const L = sec.labels;
    const bind = key => `item.${sec.id}.${item.id}.${key}`;
    const input = (key, label, ph, cls) => `<div class="field${cls ? ' ' + cls : ''}"><label>${esc(label)}</label><input class="input" data-bind="${bind(key)}" value="${esc(item[key])}" placeholder="${esc(ph || '')}"></div>`;

    let fields = input('title', L.title, '', f.subtitle ? '' : 'span-2');
    if (f.subtitle) fields += input('subtitle', L.subtitle);
    if (f.date) {
      fields += input('start', '开始时间', '如 2022.03');
      fields += `<div class="field"><label>结束时间</label><div class="input-wrap"><input class="input" data-bind="${bind('end')}" value="${esc(item.end)}" placeholder="如 2024.06"><button type="button" class="chip-btn" data-act="end-present" title="填入「至今」">至今</button></div></div>`;
    }
    if (f.location) fields += input('location', L.location, '', 'span-2');
    if (f.description) fields += `<div class="field span-2"><label>${esc(L.description)}</label>${mdEditor(bind('description'), item.description, PLACEHOLDERS.description, 3)}</div>`;

    return `<div class="entry${open ? ' is-open' : ''}${item.hidden ? ' is-hidden' : ''}" data-key="${item.id}" data-iid="${item.id}" data-sid="${sec.id}">
      <div class="entry-head" data-act="toggle-item">
        <span class="grip" title="拖动排序">${icon('grip')}</span>
        <div class="entry-summary">
          <div class="entry-title">${s.title}</div>
          ${s.sub ? `<div class="entry-sub">${s.sub}</div>` : ''}
        </div>
        ${item.hidden ? '<span class="badge">已隐藏</span>' : ''}
        <button type="button" class="icon-btn sm" data-act="item-visible" title="${item.hidden ? '在简历中显示' : '在简历中隐藏'}">${icon(item.hidden ? 'eyeOff' : 'eye')}</button>
        <button type="button" class="icon-btn sm" data-act="item-menu" title="更多操作" aria-haspopup="menu">${icon('more')}</button>
        <span class="chev">${icon('chevronDown')}</span>
      </div>
      <div class="entry-body">${fields}</div>
    </div>`;
  }

  function renderTagRow(sec, item) {
    return `<div class="row tag-row" data-key="${item.id}" data-iid="${item.id}">
      <span class="grip" title="拖动排序">${icon('grip')}</span>
      <input class="input input-label" data-bind="item.${sec.id}.${item.id}.name" value="${esc(item.name)}" placeholder="分类" aria-label="分类">
      <input class="input" data-bind="item.${sec.id}.${item.id}.keywords" data-row="tags" value="${esc(item.keywords)}" placeholder="关键词，用逗号分隔" aria-label="关键词">
      <button type="button" class="icon-btn sm row-del" data-act="row-del" title="删除">${icon('x')}</button>
    </div>`;
  }

  function renderListRow(sec, item) {
    return `<div class="row list-row" data-key="${item.id}" data-iid="${item.id}">
      <span class="grip" title="拖动排序">${icon('grip')}</span>
      <input class="input" data-bind="item.${sec.id}.${item.id}.text" data-row="list" value="${esc(item.text)}" placeholder="输入内容，回车添加下一项" aria-label="内容">
      <button type="button" class="icon-btn sm row-del" data-act="row-del" title="删除">${icon('x')}</button>
    </div>`;
  }

  /* ---------- 焦点保持 ---------- */
  function captureFocus() {
    const a = document.activeElement;
    const snap = { scroll: root.scrollTop };
    if (!a || !root.contains(a)) return snap;
    if (a.dataset.bind) snap.sel = `[data-bind="${a.dataset.bind}"]`;
    else if (a.dataset.act) {
      const host = a.closest('[data-key]');
      snap.sel = (host ? `[data-key="${host.dataset.key}"] ` : '') + `[data-act="${a.dataset.act}"]`;
    }
    if (typeof a.selectionStart === 'number') { snap.start = a.selectionStart; snap.end = a.selectionEnd; }
    return snap;
  }

  function restoreFocus(snap) {
    root.scrollTop = snap.scroll;
    if (!snap.sel) return;
    const target = root.querySelector(snap.sel);
    if (!target) return;
    target.focus({ preventScroll: true });
    if (typeof snap.start === 'number' && target.setSelectionRange) {
      try { target.setSelectionRange(snap.start, snap.end); } catch (e) { /* 忽略 */ }
    }
  }

  function focusBind(bind, select) {
    requestAnimationFrame(() => {
      const t = root.querySelector(`[data-bind="${bind}"]`);
      if (!t) return;
      t.focus({ preventScroll: true });
      t.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (select && t.select) t.select();
    });
  }

  /* ---------- 数据写入 ---------- */
  function applyBind(bind, value) {
    const p = bind.split('.');
    store.update(doc => {
      if (p[0] === 'basics') doc.basics[p[1]] = value;
      else if (p[0] === 'info') { const it = doc.basics.info.find(i => i.id === p[1]); if (it) it[p[2]] = value; }
      else if (p[0] === 'sec') { const s = doc.sections.find(x => x.id === p[1]); if (s) s[p[2]] = value; }
      else if (p[0] === 'item') { const it = store.findItem(p[1], p[2]); if (it) it[p[3]] = value; }
    }, { type: 'content', key: bind });

    if (p[0] === 'item') {
      openItems.add(p[2]);
      const sec = store.findSection(p[1]);
      const node = root.querySelector(`.entry[data-iid="${p[2]}"]`);
      if (sec && node && sec.kind === 'entries') {
        const s = entrySummary(sec, store.findItem(p[1], p[2]));
        const summary = node.querySelector('.entry-summary');
        summary.innerHTML = `<div class="entry-title">${s.title}</div>${s.sub ? `<div class="entry-sub">${s.sub}</div>` : ''}`;
      }
    }
  }

  function structural(mutator, opts) {
    store.update(mutator, Object.assign({ type: 'structure' }, opts));
  }

  function moveInArray(list, from, to) {
    const [x] = list.splice(from, 1);
    list.splice(to, 0, x);
  }

  function onSortMove(container, from, to) {
    const key = container.dataset.sort;
    structural(doc => {
      if (key === 'sections') moveInArray(doc.sections, from, to);
      else if (key === 'info') moveInArray(doc.basics.info, from, to);
      else if (key.startsWith('items:')) {
        const sec = doc.sections.find(s => s.id === key.slice(6));
        if (sec) moveInArray(sec.items, from, to);
      }
    });
  }

  /* ---------- 事件 ---------- */
  function onInput(e) {
    const t = e.target;
    if (t.dataset.bind) {
      if (t.tagName === 'TEXTAREA') ui.autosize(t);
      applyBind(t.dataset.bind, t.value);
    }
  }

  function onClick(e) {
    if (e.target.closest('.grip')) return;
    const actEl = e.target.closest('[data-act]');
    if (!actEl || !root.contains(actEl)) {
      const head = e.target.closest('.card-head');
      if (head && !e.target.closest('input, button, textarea, label')) {
        const card = head.closest('[data-sid]');
        toggleSection(card.dataset.sid);
      }
      return;
    }
    if (actEl.tagName === 'INPUT' && actEl.type !== 'checkbox') return;
    const sid = actEl.dataset.sid || (actEl.closest('[data-sid]') || {}).dataset?.sid;
    const iidHost = actEl.closest('[data-iid]');
    const iid = iidHost ? iidHost.dataset.iid : null;
    const fn = ACTIONS[actEl.dataset.act];
    if (fn) fn(actEl, sid, iid, e);
  }

  function toggleSection(sid) {
    const card = sid === 'basics' ? $('#card-basics') : $(`#card-${CSS.escape(sid)}`);
    if (!card) return;
    const closed = !closedSecs.has(sid);
    if (closed) closedSecs.add(sid); else closedSecs.delete(sid);
    store.setPref('closedSecs', Array.from(closedSecs));
    card.classList.toggle('is-collapsed', closed);
    const chev = card.querySelector('.card-head .chev');
    if (chev) chev.setAttribute('aria-expanded', String(!closed));
    if (!closed) $$('textarea', card).forEach(ui.autosize);
  }

  function sectionName(sec) { return sec.title || '未命名栏目'; }

  const ACTIONS = {
    'toggle-sec': (btn, sid) => toggleSection(sid),

    'toggle-item': (head, sid, iid) => {
      const node = head.closest('.entry');
      const open = !node.classList.contains('is-open');
      if (open) openItems.add(iid); else openItems.delete(iid);
      node.classList.toggle('is-open', open);
      if (open) $$('textarea', node).forEach(ui.autosize);
    },

    'sec-visible': (btn, sid) => {
      structural(doc => { const s = doc.sections.find(x => x.id === sid); s.hidden = !s.hidden; });
    },

    'sec-menu': (btn, sid) => {
      const doc = store.doc;
      const index = doc.sections.findIndex(s => s.id === sid);
      const sec = doc.sections[index];
      const tpl = RB.templates.get(doc.style.template);
      const effective = RB.templates.columnOf(sec, tpl);
      const setColumn = col => structural(d => { d.sections[index].column = col; });
      ui.menu(btn, [
        { label: '重命名', icon: 'edit', onClick: () => focusBind(`sec.${sid}.title`, true) },
        { label: '复制栏目', icon: 'copy', onClick: () => duplicateSection(index) },
        sec.kind === 'entries' ? { label: '字段设置…', icon: 'sliders', onClick: () => fieldSettings(sid) } : null,
        { label: '上移', icon: 'arrowUp', disabled: index === 0, onClick: () => structural(d => moveInArray(d.sections, index, index - 1)) },
        { label: '下移', icon: 'arrowDown', disabled: index === doc.sections.length - 1, onClick: () => structural(d => moveInArray(d.sections, index, index + 1)) },
        { divider: true },
        { header: tpl.twoColumn ? `双栏位置（当前：${effective === 'side' ? '侧栏' : '主栏'}）` : '双栏模板中的位置' },
        { label: '自动', checked: sec.column === 'auto', onClick: () => setColumn('auto') },
        { label: '主栏', checked: sec.column === 'main', onClick: () => setColumn('main') },
        { label: '侧栏', checked: sec.column === 'side', onClick: () => setColumn('side') },
        { divider: true },
        { label: '删除栏目', icon: 'trash', danger: true, onClick: () => deleteSection(index) }
      ], { align: 'end' });
    },

    'add-item': (btn, sid) => {
      const sec = store.findSection(sid);
      const item = schema.createItem(sec.kind);
      openItems.add(item.id);
      structural(doc => { doc.sections.find(s => s.id === sid).items.push(item); });
      const key = sec.kind === 'entries' ? 'title' : sec.kind === 'tags' ? 'name' : 'text';
      focusBind(`item.${sid}.${item.id}.${key}`);
    },

    'item-visible': (btn, sid, iid) => {
      structural(() => { const it = store.findItem(sid, iid); it.hidden = !it.hidden; });
    },

    'item-menu': (btn, sid, iid) => {
      const sec = store.findSection(sid);
      const index = sec.items.findIndex(i => i.id === iid);
      ui.menu(btn, [
        { label: '复制', icon: 'copy', onClick: () => {
          const copy = RB.util.clone(sec.items[index]);
          copy.id = RB.util.uid('e');
          openItems.add(copy.id);
          structural(d => { d.sections.find(s => s.id === sid).items.splice(index + 1, 0, copy); });
        } },
        { label: '上移', icon: 'arrowUp', disabled: index === 0, onClick: () => structural(d => moveInArray(d.sections.find(s => s.id === sid).items, index, index - 1)) },
        { label: '下移', icon: 'arrowDown', disabled: index === sec.items.length - 1, onClick: () => structural(d => moveInArray(d.sections.find(s => s.id === sid).items, index, index + 1)) },
        { divider: true },
        { label: '删除', icon: 'trash', danger: true, onClick: () => {
          structural(d => { d.sections.find(s => s.id === sid).items.splice(index, 1); });
          ui.toast('已删除 1 条经历', { action: { label: '撤销', onClick: () => store.undo() } });
        } }
      ], { align: 'end' });
    },

    'row-del': (btn, sid, iid) => {
      structural(d => {
        const sec = d.sections.find(s => s.id === sid);
        sec.items = sec.items.filter(i => i.id !== iid);
      });
    },

    'end-present': (btn, sid, iid) => {
      const input = btn.parentElement.querySelector('input');
      input.value = '至今';
      applyBind(input.dataset.bind, '至今');
      store.breakCoalesce();
    },

    'add-info': btn => {
      const used = new Set(store.doc.basics.info.map(i => i.type));
      ui.menu(btn, schema.INFO_ORDER.map(type => {
        const def = schema.INFO_TYPES[type];
        return {
          label: def.custom ? '自定义…' : def.label,
          icon: def.icon,
          hint: used.has(type) && !def.custom ? '已添加' : '',
          onClick: () => {
            const item = schema.createInfo(type);
            structural(d => { d.basics.info.push(item); });
            focusBind(def.custom ? `info.${item.id}.label` : `info.${item.id}.value`);
          }
        };
      }), { className: 'menu-grid' });
    },

    'info-type': btn => {
      const id = btn.dataset.id;
      const current = store.doc.basics.info.find(i => i.id === id);
      ui.menu(btn, schema.INFO_ORDER.map(type => {
        const def = schema.INFO_TYPES[type];
        return {
          label: def.custom ? '自定义' : def.label, icon: def.icon, checked: current && current.type === type,
          onClick: () => structural(d => {
            const it = d.basics.info.find(i => i.id === id);
            const oldDef = schema.INFO_TYPES[it.type];
            if (!it.label || it.label === oldDef.label) it.label = def.label;
            it.type = type;
          })
        };
      }), { className: 'menu-grid' });
    },

    'info-del': btn => {
      const id = btn.dataset.id;
      structural(d => { d.basics.info = d.basics.info.filter(i => i.id !== id); });
    },

    'avatar-pick': () => document.getElementById('file-avatar').click(),
    'avatar-remove': () => structural(d => { d.basics.avatar = ''; }),
    'toggle-photo': input => {
      store.update(d => { d.style.showPhoto = input.checked; }, { type: 'style' });
      if (RB.design) RB.design.render();
    },

    'md-bold': btn => mdWrap(textareaOf(btn), '**', '**', '加粗文字'),
    'md-link': btn => mdWrap(textareaOf(btn), '[', '](https://)', '链接文字'),
    'md-list': btn => mdToggleList(textareaOf(btn)),

    'add-section': () => addSectionDialog(),

    'notice-blank': async () => {
      const ok = await ui.confirm('将清空示例内容并换成空白模板（可撤销）。', { title: '从空白开始', okText: '清空并开始' });
      if (!ok) return;
      const blank = schema.blankResume();
      structural(d => {
        d.basics = blank.basics;
        d.sections = blank.sections;
        d.meta.sample = false;
        d.meta.title = '';
      });
      focusBind('basics.name');
    },
    'notice-dismiss': () => {
      store.update(d => { d.meta.sample = false; }, { type: 'structure', history: false });
    }
  };

  /* ---------- 栏目操作 ---------- */
  function duplicateSection(index) {
    const copy = RB.util.clone(store.doc.sections[index]);
    copy.id = RB.util.uid('s');
    copy.title = copy.title + '（副本）';
    if (copy.items) copy.items.forEach(it => { it.id = RB.util.uid(it.id.split('_')[0]); });
    structural(d => { d.sections.splice(index + 1, 0, copy); });
    revealCard(copy.id);
  }

  function deleteSection(index) {
    const sec = store.doc.sections[index];
    structural(d => { d.sections.splice(index, 1); });
    ui.toast(`已删除「${sectionName(sec)}」`, { action: { label: '撤销', onClick: () => store.undo() } });
  }

  function revealCard(sid) {
    requestAnimationFrame(() => {
      const card = $(`#card-${CSS.escape(sid)}`);
      if (!card) return;
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      flash(card);
    });
  }

  function flash(node) {
    node.classList.remove('is-flash');
    void node.offsetWidth;
    node.classList.add('is-flash');
    setTimeout(() => node.classList.remove('is-flash'), 1300);
  }

  function addSectionDialog() {
    const existing = new Set(store.doc.sections.map(s => s.title));
    const body = el(`<div class="preset-groups">${schema.PRESET_GROUPS.map(g => `
      <div class="preset-group">
        <div class="preset-group-name">${esc(g.name)}</div>
        <div class="preset-grid">${g.keys.map(k => {
          const p = schema.PRESETS[k];
          return `<button type="button" class="preset" data-preset="${k}">
            <span class="preset-ico">${icon(p.icon)}</span>
            <span class="preset-text"><span class="preset-name">${esc(p.title)}${existing.has(p.title) ? '<span class="preset-tag">已有</span>' : ''}</span><span class="preset-desc">${esc(p.desc || '')}</span></span>
          </button>`;
        }).join('')}</div>
      </div>`).join('')}</div>`);
    const modal = ui.modal({ title: '添加栏目', body, width: 620, className: 'modal-wide' });
    body.addEventListener('click', e => {
      const btn = e.target.closest('[data-preset]');
      if (!btn) return;
      const sec = schema.createSection(btn.dataset.preset);
      if (sec.items) sec.items.forEach(it => openItems.add(it.id));
      closedSecs.delete(sec.id);
      structural(d => { d.sections.push(sec); });
      modal.close();
      revealCard(sec.id);
      const first = sec.kind === 'text' ? `sec.${sec.id}.content`
        : `item.${sec.id}.${sec.items[0].id}.${sec.kind === 'entries' ? 'title' : sec.kind === 'tags' ? 'name' : 'text'}`;
      setTimeout(() => {
        const t = root.querySelector(`[data-bind="${first}"]`);
        if (t) t.focus({ preventScroll: true });
      }, 350);
    });
  }

  function fieldSettings(sid) {
    const sec = store.findSection(sid);
    const rows = [
      ['title', '主标题', true],
      ['subtitle', '副标题', false],
      ['date', '时间', false],
      ['location', '地点', false],
      ['description', '描述', false]
    ];
    const body = el(`<div class="field-settings">
      <p class="modal-text">选择该栏目需要的字段，并可修改编辑时显示的名称（不影响简历排版）。</p>
      ${rows.map(([key, name, locked]) => `
        <div class="fs-row">
          <label class="check"><input type="checkbox" data-field="${key}" ${locked || sec.fields[key] ? 'checked' : ''} ${locked ? 'disabled' : ''}><span>${name}</span></label>
          <input class="input" data-label="${key}" value="${esc(sec.labels[key])}" placeholder="${name}">
        </div>`).join('')}
    </div>`);
    ui.modal({
      title: `字段设置 · ${sectionName(sec)}`,
      width: 460,
      body,
      actions: [
        { label: '取消' },
        { label: '保存', kind: 'primary', onClick: () => {
          structural(d => {
            const s = d.sections.find(x => x.id === sid);
            $$('[data-field]', body).forEach(cb => { if (cb.dataset.field !== 'title') s.fields[cb.dataset.field] = cb.checked; });
            $$('[data-label]', body).forEach(inp => { s.labels[inp.dataset.label] = inp.value.trim() || s.labels[inp.dataset.label]; });
          });
        } }
      ]
    });
  }

  /* ---------- 文本标记工具 ---------- */
  function textareaOf(btn) { return btn.closest('.md-editor').querySelector('textarea'); }

  function setTextarea(ta, value, selStart, selEnd) {
    ta.value = value;
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(selStart, selEnd);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    store.breakCoalesce();
  }

  function mdWrap(ta, before, after, placeholder) {
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const selected = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + selected + after + value.slice(e);
    setTextarea(ta, next, s + before.length, s + before.length + selected.length);
  }

  const LIST_RE = /^(\s*)([-*•·]|\d{1,2}[.、])\s+/;

  function mdToggleList(ta) {
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    let lineEnd = value.indexOf('\n', e);
    if (lineEnd < 0) lineEnd = value.length;
    const lines = value.slice(lineStart, lineEnd).split('\n');
    const allList = lines.every(l => !l.trim() || LIST_RE.test(l));
    const next = lines.map(l => (allList ? l.replace(LIST_RE, '$1') : l.trim() ? '- ' + l.replace(LIST_RE, '') : l)).join('\n');
    const full = value.slice(0, lineStart) + next + value.slice(lineEnd);
    setTextarea(ta, full, lineStart, lineStart + next.length);
  }

  function onKeydown(e) {
    const t = e.target;
    if (t.matches('textarea[data-md]')) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); mdWrap(t, '**', '**', '加粗文字'); return; }
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && t.selectionStart === t.selectionEnd) {
        const pos = t.selectionStart;
        const lineStart = t.value.lastIndexOf('\n', pos - 1) + 1;
        const line = t.value.slice(lineStart, pos);
        const m = line.match(LIST_RE);
        if (!m) return;
        e.preventDefault();
        if (line.slice(m[0].length).trim() === '' && t.value.slice(pos, t.value.indexOf('\n', pos) < 0 ? undefined : t.value.indexOf('\n', pos)).trim() === '') {
          // 空列表项：结束列表
          const next = t.value.slice(0, lineStart) + t.value.slice(pos);
          setTextarea(t, next, lineStart, lineStart);
          return;
        }
        let marker = m[2];
        const num = marker.match(/^(\d{1,2})([.、])$/);
        if (num) marker = (parseInt(num[1], 10) + 1) + num[2];
        const insert = '\n' + m[1] + marker + ' ';
        setTextarea(t, t.value.slice(0, pos) + insert + t.value.slice(pos), pos + insert.length, pos + insert.length);
      }
      return;
    }

    if (t.classList.contains('card-title-input') && e.key === 'Enter') { e.preventDefault(); t.blur(); return; }

    const rowType = t.dataset.row;
    if (!rowType || e.isComposing) return;
    const row = t.closest('[data-iid]');
    const sid = t.closest('[data-sid]').dataset.sid;
    const sec = store.findSection(sid);
    const index = sec.items.findIndex(i => i.id === row.dataset.iid);
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = schema.createItem(sec.kind);
      structural(d => { d.sections.find(s => s.id === sid).items.splice(index + 1, 0, item); });
      focusBind(`item.${sid}.${item.id}.${sec.kind === 'tags' ? 'name' : 'text'}`);
    } else if (e.key === 'Backspace' && rowType === 'list' && !t.value && sec.items.length > 1) {
      e.preventDefault();
      const prev = sec.items[index - 1] || sec.items[index + 1];
      structural(d => { d.sections.find(s => s.id === sid).items.splice(index, 1); });
      const target = root.querySelector(`[data-bind="item.${sid}.${prev.id}.text"]`);
      if (target) { target.focus(); target.setSelectionRange(target.value.length, target.value.length); }
    }
  }

  /* ---------- 照片 ---------- */
  function onDragOver(e) {
    const box = e.target.closest('.avatar-box');
    if (!box || !e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    box.classList.add('is-drop');
  }

  function onDrop(e) {
    const box = e.target.closest('.avatar-box');
    if (!box) return;
    e.preventDefault();
    box.classList.remove('is-drop');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) setAvatar(file);
  }

  async function setAvatar(file) {
    if (!/^image\//.test(file.type)) { ui.toast('请选择图片文件（JPG / PNG / WebP）', { type: 'error' }); return; }
    if (file.size > 15 * 1024 * 1024) { ui.toast('图片超过 15MB，请换一张较小的图片', { type: 'error' }); return; }
    try {
      const url = await RB.util.compressImage(file, 600, 800, 0.88);
      structural(d => { d.basics.avatar = url; d.style.showPhoto = true; });
      ui.toast('照片已更新', { type: 'success' });
    } catch (err) {
      ui.toast(err.message || '图片处理失败', { type: 'error' });
    }
  }

  /* ---------- 从预览定位 ---------- */
  editor.reveal = function (sid, iid) {
    if (RB.app) { RB.app.setTab('content'); RB.app.setView('editor'); }
    let changed = false;
    if (closedSecs.has(sid)) { closedSecs.delete(sid); store.setPref('closedSecs', Array.from(closedSecs)); changed = true; }
    if (iid && !openItems.has(iid)) { openItems.add(iid); changed = true; }
    if (changed) editor.render();
    requestAnimationFrame(() => {
      const card = sid === 'basics' ? $('#card-basics') : $(`#card-${CSS.escape(sid)}`);
      if (!card) return;
      const target = (iid && card.querySelector(`[data-key="${CSS.escape(iid)}"]`)) || card;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      flash(target);
      const input = target.querySelector('.entry-body input, .entry-body textarea, .card-body input, .card-body textarea, input.input, textarea');
      if (input) setTimeout(() => input.focus({ preventScroll: true }), 300);
    });
  };

  editor.forgetUiState = function () { openItems.clear(); };
})();
